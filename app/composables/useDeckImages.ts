/**
 * Slide pictures, fetched once and kept as object URLs while the deck is open.
 *
 * The server sends them `no-store` (they are the customer's words), so without this
 * every swipe back would fetch a 1-1.6 MB picture again. A key is a hash of what the
 * slide is made from, so a kept picture never goes stale: a changed slide has a new key.
 * Up to 12 full pictures stay, the oldest seen going first; thumbnails are 5 KB each
 * and all stay. They are one account's: another account signed in on the same device
 * finds none of them.
 */
import type { Ref } from 'vue'

const FULL_KEPT = 12
/** A strip of 60 thumbnails should not hold up the slide on screen, nor flood the server. */
const PARALLEL = 4
/** A picture that could not be fetched is asked for again after this, or when the connection is back. */
const RETRY_AFTER = 10_000
/** Rounds asked by the clock while nothing comes through; past them, a look at the slide or the connection asks. */
const RETRY_ROUNDS = 3

let urls: Ref<Record<string, string>> | null = null
/** Full pictures in the order last seen, oldest first. */
const recent: string[] = []
const asked = new Set<string>()
const queue: { name: string; url: string }[] = []
let active = 0
/** Goes up on `clear`, so a fetch that finishes after it keeps nothing. */
let generation = 0
/** Pictures shown by their raw address because the fetch failed, and when it last did. */
const failed = new Map<string, { url: string; at: number }>()
let listening = false
let retryTimer: ReturnType<typeof setTimeout> | null = null
let rounds = 0
/** The account the kept pictures are of. */
let owner: string | null = null

const isThumb = (url: string) => /\.thumb\.png(\?|$)/.test(url)
const nameOf = (key: string, url: string) => (isThumb(url) ? `${key}.thumb` : key)

function store() {
  urls ??= shallowRef<Record<string, string>>({})
  return urls
}

function put(name: string, value: string) {
  const map = store()
  if (map.value[name] !== value) map.value = { ...map.value, [name]: value }
  if (name.endsWith('.thumb')) return
  const at = recent.indexOf(name)
  if (at >= 0) recent.splice(at, 1)
  recent.push(name)
  while (recent.length > FULL_KEPT) drop(recent.shift()!)
}

function drop(name: string) {
  const map = store()
  const value = map.value[name]
  if (value?.startsWith('blob:')) URL.revokeObjectURL(value)
  const rest = { ...map.value }
  delete rest[name]
  map.value = rest
  failed.delete(name)
}

function touch(name: string) {
  const at = recent.indexOf(name)
  if (at >= 0) recent.push(...recent.splice(at, 1))
}

async function load(name: string, url: string) {
  const fetched = generation
  try {
    const response = await fetch(url, { credentials: 'include' })
    if (!response.ok) throw new Error(String(response.status))
    const blob = await response.blob()
    if (fetched === generation) {
      failed.delete(name)
      rounds = 0
      put(name, URL.createObjectURL(blob))
    }
  } catch {
    // The address itself may still show the picture. A moment's drop is not for the rest of the
    // visit: it is asked for again a little later (`retryLater`), or as soon as the connection is back.
    if (fetched === generation) {
      put(name, url)
      failed.set(name, { url, at: Date.now() })
      listen()
      retryLater()
    }
  } finally {
    asked.delete(name)
  }
}

function retryFailed() {
  for (const [name, { url }] of failed) {
    failed.set(name, { url, at: 0 })
    want(name, url, false)
  }
}

function back() {
  rounds = 0
  retryFailed()
}

function listen() {
  if (listening || typeof window === 'undefined') return
  window.addEventListener('online', back)
  listening = true
}

/** One round at a time, never while offline (the connection coming back asks then), never after `clear`. */
function retryLater() {
  if (retryTimer !== null || rounds >= RETRY_ROUNDS || typeof window === 'undefined') return
  retryTimer = setTimeout(() => {
    retryTimer = null
    rounds += 1
    if (failed.size && globalThis.navigator?.onLine !== false) retryFailed()
  }, RETRY_AFTER)
}

function pump() {
  while (active < PARALLEL && queue.length) {
    const { name, url } = queue.shift()!
    active += 1
    void load(name, url).finally(() => {
      active -= 1
      pump()
    })
  }
}

/** `first`: the slide on screen goes ahead of whatever was waiting. */
function want(name: string, url: string, first: boolean) {
  const miss = failed.get(name)
  if (name in store().value && !(miss && Date.now() - miss.at >= RETRY_AFTER)) return touch(name)
  if (asked.has(name)) {
    const waiting = queue.findIndex((item) => item.name === name)
    if (first && waiting > 0) queue.unshift(...queue.splice(waiting, 1))
    return
  }
  asked.add(name)
  if (first) queue.unshift({ name, url })
  else queue.push({ name, url })
  pump()
}

function clear() {
  generation += 1
  for (const value of Object.values(store().value)) if (value.startsWith('blob:')) URL.revokeObjectURL(value)
  store().value = {}
  recent.length = 0
  queue.length = 0
  asked.clear()
  failed.clear()
  if (retryTimer !== null) clearTimeout(retryTimer)
  retryTimer = null
  rounds = 0
  if (listening) window.removeEventListener('online', back)
  listening = false
}

export function useDeckImages() {
  const ws = useWorkspace()

  /** Another account signed in since these were fetched: theirs go before anything is shown. */
  function mine() {
    const id = String(ws.user.value?.id ?? '')
    if (owner !== id) {
      if (owner !== null) clear()
      owner = id
    }
  }

  /** The picture's object URL once fetched, null until then; the raw address if it could not be. */
  function src(key: string, url: string): Ref<string | null> {
    mine()
    const name = nameOf(key, url)
    want(name, url, true)
    return computed(() => store().value[name] ?? null)
  }

  /** In order: the pictures wanted soonest first. */
  function prefetch(list: { key: string; url: string }[]) {
    mine()
    for (const { key, url } of list) if (key && url) want(nameOf(key, url), url, false)
  }

  return { src, prefetch, clear }
}
