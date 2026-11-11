/**
 * The product was PDF Master, and the browser kept its choices under
 * `pdf-master-…` keys (theme, drafts, pending orders, editor marks). They are
 * `docmaster-…` now. Before anything reads them, each old key in local and
 * session storage moves to its new name: copied when the new one is absent,
 * then removed, so nothing a visitor chose is lost. Keys that carry a suffix
 * (the deck editor's `…:<account>`) keep it. Signatures kept in Telegram's
 * DeviceStorage move separately, in useEditorSignatures, once Telegram is ready.
 */
const OLD_STORAGE_PREFIX = 'pdf-master-'
const STORAGE_PREFIX = 'docmaster-'

function migrate(storage: () => Storage) {
  let store: Storage
  try {
    store = storage()
  } catch {
    return
  }
  let old: string[] = []
  try {
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i)
      if (key?.startsWith(OLD_STORAGE_PREFIX)) old.push(key)
    }
  } catch {
    old = []
  }
  for (const key of old) {
    try {
      const renamed = STORAGE_PREFIX + key.slice(OLD_STORAGE_PREFIX.length)
      const value = store.getItem(key)
      if (value !== null && store.getItem(renamed) === null) store.setItem(renamed, value)
      // Only once the value is safely under its new name (or one was already there).
      if (store.getItem(renamed) !== null || value === null) store.removeItem(key)
    } catch {
      // Storage full or blocked: the old key stays, to be tried on the next visit.
    }
  }
}

export default defineNuxtPlugin({
  name: 'storage-migration',
  enforce: 'pre',
  setup() {
    migrate(() => localStorage)
    migrate(() => sessionStorage)
  },
})
