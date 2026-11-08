/**
 * Page rendering for the editor.
 *
 * pdf.js draws the document in the browser so zoom stays crisp, every page is
 * available at once, and thumbnails cost nothing — the server's PNG preview is
 * a fixed 96 DPI and throttled to 30 requests a minute per IP.
 *
 * Rendering degrades in three steps and never blocks editing, because the
 * coordinate frame comes from the document's declared page sizes, not from
 * pixels:
 *
 *   pdfjs  → canvas rendering, crisp at any zoom
 *   server → /files/{id}/preview?page=N through PreviewImage, fixed 96 DPI
 *   blank  → a correctly proportioned empty page
 *
 * Under the switch pdf.js reads the file by HTTP ranges, only the parts a page on
 * screen needs, so a phone on a slow line draws the first page long before the
 * whole file has arrived; the first page's server picture shows meanwhile. Without
 * ranges the same request brings the whole file, as before.
 */
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist'

export type RenderMode = 'idle' | 'loading' | 'pdfjs' | 'server' | 'blank'

/**
 * A line of the file's own words as pdf.js reads it, in the editor's frame: PDF points
 * from the page's top-left, the crop box with /Rotate applied, as the server's page
 * sizes are. The box runs from 0.95 of the size above the baseline to 0.3 below it,
 * which holds the baseline the server matches a change by.
 */
export interface TextLine {
  /** `p{page}-{index}`: a tap's hit, never a mark's id. */
  id: string
  page: number
  text: string
  x: number
  y: number
  width: number
  height: number
  baseline: number
  size: number
  family: 'serif' | 'sans' | 'mono'
  bold: boolean
  italic: boolean
  /** pdf.js's own name for the face. */
  fontName: string
  /**
   * The family the browser drew the line in, as pdf.js registered it: the embedded face
   * under `fontName`, or for a face the file only names (Helvetica, Times) the system
   * face pdf.js put in its place.
   */
  face: string
}

/** One run of words as pdf.js gives it, already in the editor's frame. */
export interface TextRun {
  str: string
  x: number
  baseline: number
  width: number
  size: number
  fontName: string
}

interface PageText {
  proxy: PDFPageProxy
  runs: TextRun[]
  styles: Record<string, { fontFamily?: string }>
  /** Any words at all, turned ones too: what tells a scan from a page with words. */
  words: boolean
  lines: TextLine[]
  /** Whether the faces' bold and italic were known: pdf.js has them only once the page is drawn. */
  styled: boolean
  /** The faces drawn only out of sight, once read; see `unseenFaces`. */
  hidden: Promise<Set<string>> | null
  unseen: Set<string>
}

const SERIF_NAME = /times|serif|georgia|cambria|garamond|mincho|book|minion|palatino/i
const MONO_NAME = /courier|mono|consol/i
/** Tesseract's and OCRmyPDF's face for the words they lay unseen over a scan. */
const OCR_FACE = /glyphless/i

/**
 * Runs into lines: on one baseline (within a quarter of the size), of about one size
 * (within 15 %), and close (a gap of at most 0.6 of the size: pdf.js often leaves the
 * spaces out as gaps). Two columns on one baseline stay two lines.
 */
export function groupRuns(
  runs: TextRun[],
  page: number,
): Omit<TextLine, 'family' | 'bold' | 'italic' | 'face'>[] {
  const rows: TextRun[][] = []
  const sorted = [...runs].sort((a, b) => a.baseline - b.baseline || a.x - b.x)
  for (const run of sorted) {
    const row = rows.find((candidate) => {
      const first = candidate[0]!
      const size = Math.max(first.size, run.size)
      const level = Math.abs(first.baseline - run.baseline) <= 0.25 * size
      return level && Math.abs(first.size - run.size) <= 0.15 * size
    })
    if (row) row.push(run)
    else rows.push([run])
  }
  const lines: Omit<TextLine, 'family' | 'bold' | 'italic' | 'face'>[] = []
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x)
    let segment: TextRun[] = []
    const close = () => {
      if (!segment.length) return
      const size = Math.max(...segment.map((run) => run.size))
      let text = ''
      let end = -Infinity
      for (const run of segment) {
        // A space where the gap is one and neither side has it already.
        if (text && run.x - end > 0.15 * size && !/\s$/.test(text) && !/^\s/.test(run.str)) text += ' '
        text += run.str
        end = Math.max(end, run.x + run.width)
      }
      const baseline = segment[0]!.baseline
      const x = segment[0]!.x
      lines.push({
        id: '',
        page,
        text: text.trim(),
        x,
        y: baseline - 0.95 * size,
        width: end - x,
        height: 1.25 * size,
        baseline,
        size,
        fontName: segment[0]!.fontName,
      })
      segment = []
    }
    for (const run of row) {
      const last = segment[segment.length - 1]
      if (last) {
        const gap = run.x - (last.x + last.width)
        // The same words drawn twice a hair apart are one run: some files fake bold that way.
        if (run.str === last.str && Math.abs(run.x - last.x) < 0.1 * run.size) continue
        if (gap > 0.6 * Math.max(run.size, last.size)) close()
      }
      segment.push(run)
    }
    close()
  }
  lines.sort((a, b) => a.y - b.y || a.x - b.x)
  return lines.map((line, index) => ({ ...line, id: `p${page}-${index}` }))
}

/** Safari refuses canvases beyond roughly this area. */
const MAX_CANVAS_PIXELS = 16_000_000
const MAX_DEVICE_SCALE = 2
/** A phone's 3x screen draws a page nine times over for little a person can see: 1.5 is plenty. */
const PHONE_DEVICE_SCALE = 1.5
/** pdf.js's own default: a range read asks for at least this much at a time. */
const RANGE_CHUNK = 65536
const THUMBNAIL_CACHE = 48
const THUMBNAIL_WIDTH = 96

type Pdfjs = typeof import('pdfjs-dist')

let libPromise: Promise<Pdfjs | null> | null = null

/**
 * Loaded on first use only, so pdf.js never reaches the main bundle. The bare
 * specifier is deliberate: `pdfjs-dist/build/pdf.mjs` ships no adjacent
 * declaration file and would resolve to `any` under `strict`.
 */
async function loadLibrary(): Promise<Pdfjs | null> {
  if (!libPromise) {
    libPromise = (async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default
        return pdfjs
      } catch {
        return null
      }
    })()
  }
  return libPromise
}

interface Session {
  fileId: string
  document: PDFDocumentProxy | null
  tasks: Map<number, RenderTask>
  thumbnails: Map<number, string>
  order: number[]
  /** Each page's words, read once: the scan check and the text layer share it. */
  text: Map<number, Promise<PageText | null>>
}

let session: Session | null = null

function disposeThumbnails(current: Session) {
  for (const url of current.thumbnails.values()) URL.revokeObjectURL(url)
  current.thumbnails.clear()
  current.order = []
}

function cancelAll(current: Session) {
  for (const task of current.tasks.values()) {
    try {
      task.cancel()
    } catch {
      // A task that already settled throws; nothing to clean up.
    }
  }
  current.tasks.clear()
}

async function teardown() {
  if (!session) return
  const current = session
  session = null
  cancelAll(current)
  disposeThumbnails(current)
  try {
    await current.document?.destroy()
  } catch {
    // Destroying an already-closed document is not an error worth surfacing.
  }
}

export function useEditorRender() {
  const mode = useState<RenderMode>('editor-render-mode', () => 'idle')
  const pageCount = useState('editor-render-pages', () => 0)
  /** Goes up with each file opened, so whatever was read of the last one is known for stale. */
  const generation = useState('editor-render-generation', () => 0)
  const ws = useWorkspace()
  const v2 = useEditorV2()
  const deviceScale = () =>
    Math.min(globalThis.devicePixelRatio || 1, v2.value ? PHONE_DEVICE_SCALE : MAX_DEVICE_SCALE)

  const options = {
    cMapUrl: '/pdfjs/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/pdfjs/standard_fonts/',
    wasmUrl: '/pdfjs/wasm/',
    isEvalSupported: false,
  }

  /**
   * By ranges, read here rather than by pdf.js's own loader, which wants the whole
   * file's Content-Length on a first full answer: the app's /api proxy streams that
   * answer without one. A 206 says how long the file is in its Content-Range, and
   * pdf.js then asks for only the parts a page on screen needs. A server that
   * answers 200 has sent the file itself, which is read as before.
   */
  async function openByRanges(pdfjs: Pdfjs, fileId: string): Promise<PDFDocumentProxy | null> {
    const url = `/api/v1/files/${fileId}/download`
    const read = (from: number, to: number) =>
      fetch(url, { credentials: 'include', headers: { Range: `bytes=${from}-${to - 1}` } })
    try {
      const first = await read(0, RANGE_CHUNK)
      if (first.status === 200)
        return await pdfjs.getDocument({ ...options, data: new Uint8Array(await first.arrayBuffer()) })
          .promise
      const total = Number(/\/(\d+)$/.exec(first.headers.get('content-range') ?? '')?.[1])
      if (first.status !== 206 || !total) return null
      const initial = new Uint8Array(await first.arrayBuffer())
      if (initial.length >= total) return await pdfjs.getDocument({ ...options, data: initial }).promise
      // A part that does not come is cut from the whole file instead, fetched once.
      let whole: Promise<ArrayBuffer> | null = null
      const wholeFile = () =>
        (whole ??= fetch(url, { credentials: 'include' }).then((answer) =>
          answer.ok ? answer.arrayBuffer() : Promise.reject(answer.status),
        ))
      let opened = false
      let fail: (reason: unknown) => void = () => {}
      const failed = new Promise<never>((_resolve, reject) => (fail = reject))
      class Ranges extends pdfjs.PDFDataRangeTransport {
        override requestDataRange(begin: number, end: number) {
          void read(begin, end)
            .then((answer) => (answer.status === 206 ? answer.arrayBuffer() : Promise.reject(answer.status)))
            // pdf.js waits for the part it asked for, at the place it asked: a copy, as it takes the buffer.
            .catch(() => wholeFile().then((file) => file.slice(begin, Math.min(end, total))))
            .then(
              (part) => {
                try {
                  this.onDataRange(begin, new Uint8Array(part))
                } catch {
                  // Closed meanwhile: nothing waits for it any more.
                }
              },
              // Not even that: the server draws the pages, as pdf.js would wait for good.
              (reason) => {
                if (!opened) fail(reason)
                else if (session?.fileId === fileId && mode.value === 'pdfjs') downgrade('server')
              },
            )
        }
      }
      const task = pdfjs.getDocument({
        ...options,
        range: new Ranges(total, initial),
        disableAutoFetch: true,
        disableStream: true,
        rangeChunkSize: RANGE_CHUNK,
      })
      try {
        const document = await Promise.race([task.promise, failed])
        opened = true
        return document
      } catch (reason) {
        void task.destroy()
        throw reason
      }
    } catch {
      return null
    }
  }

  /**
   * Fetch the bytes and hand them to pdf.js. Any failure downgrades to the
   * server preview; callers keep working either way.
   */
  async function open(fileId: string): Promise<RenderMode> {
    if (session?.fileId === fileId && mode.value === 'pdfjs') return mode.value
    await teardown()
    // Whatever was read of the last file goes now, whether or not pdf.js opens this one.
    generation.value += 1
    mode.value = 'loading'

    const pdfjs = await loadLibrary()
    if (!pdfjs) {
      mode.value = 'server'
      return mode.value
    }
    try {
      let document = v2.value ? await openByRanges(pdfjs, fileId) : null
      if (!document) {
        const bytes = await ws.api<ArrayBuffer>(`/files/${fileId}/download`, { responseType: 'arrayBuffer' })
        // pdf.js transfers this buffer to its worker; never reuse it afterwards.
        document = await pdfjs.getDocument({ ...options, data: new Uint8Array(bytes) }).promise
      }
      session = { fileId, document, tasks: new Map(), thumbnails: new Map(), order: [], text: new Map() }
      pageCount.value = document.numPages
      mode.value = 'pdfjs'
    } catch {
      mode.value = 'server'
    }
    return mode.value
  }

  /**
   * Draw one page. `cssWidth` is the on-screen width in CSS pixels; the canvas
   * backing store is sized by device pixel ratio and capped so a big page at
   * high zoom cannot crash the tab.
   */
  async function renderPage(page: number, canvas: HTMLCanvasElement, cssWidth: number): Promise<boolean> {
    const current = session
    if (!current?.document || mode.value !== 'pdfjs') return false

    const previous = current.tasks.get(page)
    if (previous) {
      try {
        previous.cancel()
      } catch {
        // Already finished.
      }
      current.tasks.delete(page)
    }

    try {
      const proxy = await current.document.getPage(page)
      const base = proxy.getViewport({ scale: 1 })
      const dpr = deviceScale()
      const wanted = (cssWidth / base.width) * dpr
      const ceiling = Math.sqrt(MAX_CANVAS_PIXELS / (base.width * base.height))
      const scale = Math.max(0.05, Math.min(wanted, ceiling))
      const viewport = proxy.getViewport({ scale })
      const context = canvas.getContext('2d')
      if (!context) return false
      canvas.width = Math.max(1, Math.round(viewport.width))
      canvas.height = Math.max(1, Math.round(viewport.height))
      const task = proxy.render({ canvas, canvasContext: context, viewport })
      current.tasks.set(page, task)
      await task.promise
      current.tasks.delete(page)
      proxy.cleanup()
      return true
    } catch {
      // A cancelled render is the normal result of zooming or scrolling away.
      current.tasks.delete(page)
      return false
    }
  }

  /** Object URL for a small page image, cached with a bounded LRU. */
  async function thumbnail(page: number): Promise<string | null> {
    const current = session
    if (!current?.document || mode.value !== 'pdfjs') return null
    const cached = current.thumbnails.get(page)
    if (cached) {
      current.order = current.order.filter((value) => value !== page)
      current.order.push(page)
      return cached
    }
    try {
      const proxy = await current.document.getPage(page)
      const base = proxy.getViewport({ scale: 1 })
      const dpr = deviceScale()
      const viewport = proxy.getViewport({ scale: (THUMBNAIL_WIDTH / base.width) * dpr })
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(viewport.width))
      canvas.height = Math.max(1, Math.round(viewport.height))
      const context = canvas.getContext('2d')
      if (!context) return null
      await proxy.render({ canvas, canvasContext: context, viewport }).promise
      proxy.cleanup()
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.8))
      // Release the backing store immediately; Safari leaks it otherwise.
      canvas.width = 0
      canvas.height = 0
      if (!blob) return null
      const url = URL.createObjectURL(blob)
      current.thumbnails.set(page, url)
      current.order.push(page)
      while (current.order.length > THUMBNAIL_CACHE) {
        const evicted = current.order.shift()
        if (evicted === undefined) break
        const stale = current.thumbnails.get(evicted)
        if (stale) URL.revokeObjectURL(stale)
        current.thumbnails.delete(evicted)
      }
      return url
    } catch {
      return null
    }
  }

  /** Give up on client rendering — used when a page fails to draw repeatedly. */
  function downgrade(next: Exclude<RenderMode, 'idle' | 'loading'>) {
    mode.value = next
  }

  function serverPreview(fileId: string, page: number) {
    return `/api/v1/files/${fileId}/preview?page=${page}`
  }

  /**
   * A page's words, read once per file and kept with it. Runs that are turned,
   * mirrored, empty or only spaces are no line anyone could change in place.
   */
  function readText(page: number): Promise<PageText | null> {
    const current = session
    if (!current?.document || mode.value !== 'pdfjs') return Promise.resolve(null)
    const known = current.text.get(page)
    if (known) return known
    const reading = (async (): Promise<PageText | null> => {
      try {
        const pdfjs = await loadLibrary()
        const proxy = await current.document!.getPage(page)
        const content = await proxy.getTextContent()
        if (!pdfjs) return null
        const frame = proxy.getViewport({ scale: 1 }).transform
        const runs: TextRun[] = []
        let words = false
        for (const item of content.items) {
          if (!('str' in item) || !item.str.trim()) continue
          words = true
          const [a, b, c, d, x, baseline] = pdfjs.Util.transform(frame, item.transform) as number[]
          const size = Math.hypot(c!, d!)
          const turned = Math.abs(b!) > size * 1e-3 || Math.abs(c!) > size * 1e-3 || a! <= 0 || d! >= 0
          if (!(size > 0) || turned) continue
          runs.push({
            str: item.str,
            x: x!,
            baseline: baseline!,
            width: item.width,
            size,
            fontName: item.fontName,
          })
        }
        const text: PageText = {
          proxy,
          runs,
          styles: content.styles,
          words,
          lines: [],
          styled: false,
          hidden: null,
          unseen: new Set(),
        }
        style(text)
        return text
      } catch {
        // Read again next time: a range that did not come is no reason to give up on the page.
        current.text.delete(page)
        return null
      }
    })()
    current.text.set(page, reading)
    return reading
  }

  /**
   * Family, bold and italic of each line, from the faces pdf.js has loaded for drawing.
   * Before the page is drawn only the family is known; read again once it has been.
   */
  function style(text: PageText) {
    const faces = text.proxy.commonObjs
    let complete = true
    type Face = {
      name?: string
      bold?: boolean
      black?: boolean
      italic?: boolean
      systemFontInfo?: { loadedName?: string } | null
    }
    const faceOf = (name: string): Face | null => {
      try {
        if (faces.has(name)) return faces.get(name) as any
      } catch {
        // Not resolved yet.
      }
      complete = false
      return null
    }
    // Words laid unseen over a picture, as OCR lays them over a scan, are the picture's: a change
    // to them would show here and leave the file's page as it was.
    const shown = text.runs.filter(
      (run) => !text.unseen.has(run.fontName) && !OCR_FACE.test(faceOf(run.fontName)?.name ?? ''),
    )
    text.lines = groupRuns(shown, Number(text.proxy.pageNumber)).map((line) => {
      const face = faceOf(line.fontName)
      const name = face?.name ?? ''
      const generic = text.styles[line.fontName]?.fontFamily ?? ''
      const family: TextLine['family'] =
        generic === 'monospace' || MONO_NAME.test(name)
          ? 'mono'
          : generic === 'serif' || (SERIF_NAME.test(name) && !/sans/i.test(name))
            ? 'serif'
            : 'sans'
      return {
        ...line,
        family,
        bold: !!(face?.bold || face?.black) || /bold|black|heavy|semibold|demibold/i.test(name),
        italic: !!face?.italic || /italic|oblique/i.test(name),
        face: face?.systemFontInfo?.loadedName || line.fontName,
      }
    })
    text.styled = complete
  }

  /**
   * The lines of a page's own words, for a tap to change in place; null when that
   * cannot be known here, as with server pictures.
   */
  async function textLines(page: number): Promise<TextLine[] | null> {
    const text = await readText(page)
    if (!text) return null
    text.hidden ??= unseenFaces(text.proxy).then((faces) => {
      text.unseen = faces
      text.styled = false
      return faces
    })
    await text.hidden
    if (!text.styled) style(text)
    return text.lines
  }

  /**
   * The faces a page draws only out of sight (text render mode 3, or 7 which only clips),
   * as an OCR layer lies over a scan's picture so its words can be found and copied. A
   * face drawn in sight anywhere on the page is kept. Read once per page, and only for the
   * lines: whether a page has words at all counts these too, so an OCR'd scan is not
   * offered OCR again. Unknown, every face counts as in sight.
   */
  async function unseenFaces(proxy: PDFPageProxy): Promise<Set<string>> {
    const unseen = new Set<string>()
    try {
      const pdfjs = await loadLibrary()
      if (!pdfjs) return unseen
      const { OPS } = pdfjs
      const { fnArray, argsArray } = await proxy.getOperatorList()
      const shows = new Set<number>([
        OPS.showText,
        OPS.showSpacedText,
        OPS.nextLineShowText,
        OPS.nextLineSetSpacingShowText,
      ])
      const seen = new Set<string>()
      // The render mode and face are part of the graphics state: saved and restored with it.
      const saved: [number, string][] = []
      let mode = 0
      let face = ''
      for (let index = 0; index < fnArray.length; index++) {
        const fn = fnArray[index]
        const args = argsArray[index] as any[] | null
        if (fn === OPS.save || fn === OPS.paintFormXObjectBegin) saved.push([mode, face])
        else if (fn === OPS.restore || fn === OPS.paintFormXObjectEnd)
          [mode, face] = saved.pop() ?? [mode, face]
        else if (fn === OPS.setTextRenderingMode) mode = Number(args?.[0]) || 0
        else if (fn === OPS.setFont) face = String(args?.[0] ?? '')
        else if (fn === OPS.setGState) {
          for (const [key, value] of (args?.[0] ?? []) as [string, any][])
            if (key === 'Font') face = String(value?.[0] ?? '')
        } else if (fn !== undefined && shows.has(fn)) (mode === 3 || mode === 7 ? unseen : seen).add(face)
      }
      for (const name of seen) unseen.delete(name)
    } catch {
      unseen.clear()
    }
    return unseen
  }

  /**
   * Whether a page has any words of its own, as pdf.js reads them; null when that
   * cannot be known here, as with server pictures.
   */
  async function hasWords(page: number): Promise<boolean | null> {
    const text = await readText(page)
    return text ? text.words : null
  }

  return {
    mode,
    pageCount,
    generation,
    open,
    renderPage,
    thumbnail,
    teardown,
    downgrade,
    serverPreview,
    hasWords,
    textLines,
  }
}
