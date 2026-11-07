/**
 * The pictures a draft's marks show, and the work done on a picture before it goes.
 *
 * A mark shows the real image, read once from the server and kept as an object URL
 * for as long as the document is open. Anything picked on the phone is made ready
 * here, on the phone: a photo is made small enough to send, a signature on paper
 * loses its paper, and a picture turned a quarter is a new picture.
 */

export interface PreparedImage {
  blob: Blob
  /** For showing it at once, before the server has it. */
  url: string
  width: number
  height: number
}

/** A phone photo is 4000 px and more; the page never needs that much. */
const LONGEST_SIDE = 2000
/** What a kept signature is drawn into: wide enough to stay sharp at any size on a page. */
const SIGNATURE_WIDTH = 900
/** Below this share of the photo there is no signature in it, above it no paper. */
const INK_LEAST = 0.0008
const INK_MOST = 0.4

const urls = reactive(new Map<string, string>())
const loading = new Set<string>()
let openFor = ''

function decode(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('image'))
    image.src = source
  })
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

function canvasOf(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  return canvas
}

/** A data URL as bytes, without asking `fetch` to read one. */
export function dataUrlBlob(url: string): Blob {
  const [head = '', body = ''] = url.split(',')
  const type = /data:([^;]+)/.exec(head)?.[1] ?? 'image/png'
  const bytes = atob(body)
  const out = new Uint8Array(bytes.length)
  for (let index = 0; index < bytes.length; index += 1) out[index] = bytes.charCodeAt(index)
  return new Blob([out], { type })
}

/**
 * A picture as it will go: PNG stays PNG, for its see-through parts, and anything
 * larger than the page needs becomes a smaller JPEG. The browser turns a photo
 * the way its camera meant as it draws it.
 */
export async function preparePicture(file: Blob): Promise<PreparedImage | null> {
  const source = URL.createObjectURL(file)
  try {
    const image = await decode(source)
    const width = image.naturalWidth
    const height = image.naturalHeight
    if (!width || !height) return null
    const scale = Math.min(1, LONGEST_SIDE / Math.max(width, height))
    const png = file.type === 'image/png'
    if (scale === 1 && ['image/png', 'image/jpeg', 'image/webp'].includes(file.type) && file.size < 3_000_000)
      return { blob: file, url: source, width, height }
    const canvas = canvasOf(width * scale, height * scale)
    canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await toBlob(canvas, png ? 'image/png' : 'image/jpeg', 0.88)
    URL.revokeObjectURL(source)
    if (!blob) return null
    return { blob, url: URL.createObjectURL(blob), width: canvas.width, height: canvas.height }
  } catch {
    URL.revokeObjectURL(source)
    return null
  }
}

/** A quarter turn clockwise, as a new picture of the same kind. */
export async function turnPicture(url: string, type: string): Promise<PreparedImage | null> {
  try {
    const image = await decode(url)
    const canvas = canvasOf(image.naturalHeight, image.naturalWidth)
    const context = canvas.getContext('2d')
    if (!context) return null
    context.translate(canvas.width, 0)
    context.rotate(Math.PI / 2)
    context.drawImage(image, 0, 0)
    const png = type === 'image/png'
    const blob = await toBlob(canvas, png ? 'image/png' : 'image/jpeg', 0.92)
    if (!blob) return null
    return { blob, url: URL.createObjectURL(blob), width: canvas.width, height: canvas.height }
  } catch {
    return null
  }
}

/** The smallest box holding every pixel that is not see-through, with a little room. */
function inkBox(data: Uint8ClampedArray, width: number, height: number) {
  let left = width
  let top = height
  let right = -1
  let bottom = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3]! < 24) continue
      if (x < left) left = x
      if (x > right) right = x
      if (y < top) top = y
      if (y > bottom) bottom = y
    }
  }
  if (right < 0) return null
  const room = Math.round(Math.max(right - left, bottom - top) * 0.04) + 2
  return {
    left: Math.max(0, left - room),
    top: Math.max(0, top - room),
    right: Math.min(width - 1, right + room),
    bottom: Math.min(height - 1, bottom + room),
  }
}

/** The drawn part of a canvas as a PNG, cut to the ink so it lands the size it looks. */
export async function cropToInk(canvas: HTMLCanvasElement): Promise<PreparedImage | null> {
  const context = canvas.getContext('2d')
  if (!context) return null
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  const box = inkBox(pixels.data, canvas.width, canvas.height)
  if (!box) return null
  const width = box.right - box.left + 1
  const height = box.bottom - box.top + 1
  const scale = Math.min(1, SIGNATURE_WIDTH / width)
  const out = canvasOf(width * scale, height * scale)
  out.getContext('2d')?.drawImage(canvas, box.left, box.top, width, height, 0, 0, out.width, out.height)
  const blob = await toBlob(out, 'image/png')
  if (!blob) return null
  return { blob, url: out.toDataURL('image/png'), width: out.width, height: out.height }
}

/**
 * A signature photographed on paper, as ink on nothing. The paper is the
 * brightest common tone in the photo; what is clearly darker is ink, kept in the
 * pen's own colour, and the rest goes. `null` when that finds no signature.
 */
export async function signatureFromPhoto(file: Blob): Promise<PreparedImage | null> {
  const source = URL.createObjectURL(file)
  try {
    const image = await decode(source)
    const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = canvasOf(image.naturalWidth * scale, image.naturalHeight * scale)
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return null
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
    const data = pixels.data
    const light = new Uint32Array(256)
    for (let index = 0; index < data.length; index += 4)
      light[Math.round(0.299 * data[index]! + 0.587 * data[index + 1]! + 0.114 * data[index + 2]!)]! += 1
    // The tone at the 80th percentile stands for the paper, shadows and all.
    let seen = 0
    let paper = 255
    const total = data.length / 4
    for (let tone = 0; tone < 256; tone += 1) {
      seen += light[tone]!
      if (seen >= total * 0.8) {
        paper = tone
        break
      }
    }
    const solid = paper * 0.62
    const faint = paper * 0.8
    let ink = 0
    for (let index = 0; index < data.length; index += 4) {
      const tone = 0.299 * data[index]! + 0.587 * data[index + 1]! + 0.114 * data[index + 2]!
      const alpha =
        tone <= solid ? 255 : tone >= faint ? 0 : Math.round((255 * (faint - tone)) / (faint - solid))
      data[index + 3] = alpha
      if (alpha > 128) ink += 1
    }
    if (ink < total * INK_LEAST || ink > total * INK_MOST) return null
    context.putImageData(pixels, 0, 0)
    return await cropToInk(canvas)
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(source)
  }
}

export function useEditorImages() {
  const ws = useWorkspace()

  /** One document's pictures at a time: opening another lets the last one's go. */
  function forDocument(id: string) {
    if (id === openFor) return
    openFor = id
    for (const url of urls.values()) URL.revokeObjectURL(url)
    urls.clear()
    loading.clear()
  }

  async function load(assetId: string) {
    if (!assetId || urls.has(assetId) || loading.has(assetId)) return
    loading.add(assetId)
    try {
      const bytes = await ws.api<Blob>(`/files/${assetId}/download`, { responseType: 'blob' })
      if (loading.has(assetId)) urls.set(assetId, URL.createObjectURL(bytes))
    } catch {
      // The mark keeps its outline, and the server still has the picture.
    } finally {
      loading.delete(assetId)
    }
  }

  /** A picture this phone already holds, under the id the server gave it. */
  function adopt(assetId: string, url: string) {
    urls.set(assetId, url)
  }

  return {
    urlFor: (assetId?: string) => (assetId ? (urls.get(assetId) ?? '') : ''),
    load,
    adopt,
    forDocument,
  }
}
