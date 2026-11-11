/**
 * Signatures kept on this phone, at most three, and only when the person ticks
 * "Keep this signature on this phone" (off unless they do). They live in Telegram's
 * storage on the device from Bot API 9.0, else the browser's, and never on our
 * server: a placed one goes up as an ordinary 24-hour picture of that one draft.
 */
import { newCommandId } from './useEditorCommands'
import { dataUrlBlob, type PreparedImage } from './useEditorImages'

export interface KeptSignature {
  id: string
  /** A PNG data URL, as storage on the device holds strings. */
  src: string
  width: number
  height: number
}

const KEY = 'docmaster-signatures'
/** Their name while the product was PDF Master: moved to KEY on first read. */
const OLD_KEY = 'pdf-master-signatures'
const MOST = 3

const kept = ref<KeptSignature[]>([])
const loaded = ref(false)
let reading: Promise<void> | null = null

function parse(value: string | null): KeptSignature[] {
  try {
    const list = JSON.parse(value || '[]')
    if (!Array.isArray(list)) return []
    return list
      .filter(
        (item) =>
          item &&
          typeof item.id === 'string' &&
          typeof item.src === 'string' &&
          item.src.startsWith('data:image/png;base64,') &&
          item.width > 0 &&
          item.height > 0,
      )
      .slice(0, MOST)
  } catch {
    return []
  }
}

/** A kept signature as the picture a mark is placed with. */
export function keptImage(signature: KeptSignature): PreparedImage {
  return {
    blob: dataUrlBlob(signature.src),
    url: signature.src,
    width: signature.width,
    height: signature.height,
  }
}

export function useEditorSignatures() {
  const telegram = useTelegramApp()

  function load() {
    reading ??= (async () => {
      let value = await telegram.storageGet(KEY)
      if (value === null) {
        // Telegram's DeviceStorage is out of reach of the start-up migration.
        const old = await telegram.storageGet(OLD_KEY)
        if (old !== null) {
          value = old
          if (await telegram.storageSet(KEY, old)) await telegram.storageSet(OLD_KEY, null)
        }
      }
      kept.value = parse(value)
      loaded.value = true
    })()
    return reading
  }

  async function write(list: KeptSignature[]) {
    kept.value = list
    await telegram.storageSet(KEY, list.length ? JSON.stringify(list) : null)
  }

  /** The newest first; a fourth lets the oldest go. */
  async function keep(image: PreparedImage) {
    await load()
    if (!image.url.startsWith('data:image/png')) return null
    const signature: KeptSignature = {
      id: newCommandId(),
      src: image.url,
      width: image.width,
      height: image.height,
    }
    await write([signature, ...kept.value].slice(0, MOST))
    return signature
  }

  async function forget(id: string) {
    await load()
    await write(kept.value.filter((item) => item.id !== id))
  }

  /** A forgotten one back in its place, unless it is there already. */
  async function restore(signature: KeptSignature, index: number) {
    await load()
    if (kept.value.some((item) => item.id === signature.id)) return
    const list = [...kept.value]
    list.splice(index, 0, signature)
    await write(list.slice(0, MOST))
  }

  return {
    kept: computed(() => kept.value),
    loaded: computed(() => loaded.value),
    load,
    keep,
    forget,
    restore,
  }
}
