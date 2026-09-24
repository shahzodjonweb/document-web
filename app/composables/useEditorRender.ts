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
 *   server → <img src="/files/{id}/preview?page=N">, fixed 96 DPI
 *   blank  → a correctly proportioned empty page
 */
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'

export type RenderMode = 'idle' | 'loading' | 'pdfjs' | 'server' | 'blank'

/** Safari refuses canvases beyond roughly this area. */
const MAX_CANVAS_PIXELS = 16_000_000
const MAX_DEVICE_SCALE = 2
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
  const ws = useWorkspace()

  /**
   * Fetch the bytes and hand them to pdf.js. Any failure downgrades to the
   * server preview; callers keep working either way.
   */
  async function open(fileId: string): Promise<RenderMode> {
    if (session?.fileId === fileId && mode.value === 'pdfjs') return mode.value
    await teardown()
    mode.value = 'loading'

    const pdfjs = await loadLibrary()
    if (!pdfjs) {
      mode.value = 'server'
      return mode.value
    }
    try {
      const bytes = await ws.api<ArrayBuffer>(`/files/${fileId}/download`, { responseType: 'arrayBuffer' })
      // pdf.js transfers this buffer to its worker; never reuse it afterwards.
      const task = pdfjs.getDocument({
        data: new Uint8Array(bytes),
        cMapUrl: '/pdfjs/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: '/pdfjs/standard_fonts/',
        wasmUrl: '/pdfjs/wasm/',
        isEvalSupported: false,
      })
      const document = await task.promise
      session = { fileId, document, tasks: new Map(), thumbnails: new Map(), order: [] }
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
      const dpr = Math.min(globalThis.devicePixelRatio || 1, MAX_DEVICE_SCALE)
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
      const dpr = Math.min(globalThis.devicePixelRatio || 1, MAX_DEVICE_SCALE)
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

  return { mode, pageCount, open, renderPage, thumbnail, teardown, downgrade, serverPreview }
}
