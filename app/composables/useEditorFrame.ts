/**
 * Which frame the editor stands in.
 *
 * `/studio/config` holds the switch, and that answer takes a moment on a deep link.
 * The last answer seen on this device stands in meanwhile, so someone already on
 * the new frame does not see the old one flash first, and anyone else, who has
 * never seen it on, gets today's until the server says otherwise.
 */
const REMEMBERED = 'pdf-master-editor-v2'

function remembered() {
  try {
    return localStorage.getItem(REMEMBERED) === '1'
  } catch {
    return false
  }
}
function remember(on: boolean) {
  try {
    if (on) localStorage.setItem(REMEMBERED, '1')
    else localStorage.removeItem(REMEMBERED)
  } catch {
    // Only the flash above comes back without it.
  }
}

/** Below this the frame is the phone's; at it and over, the same tools get more room. */
const WIDE = '(min-width: 980px)'
const wide = ref(false)
let watchingWidth = false
function watchWidth() {
  if (watchingWidth || !import.meta.client) return
  watchingWidth = true
  const query = window.matchMedia(WIDE)
  wide.value = query.matches
  query.addEventListener('change', (event) => (wide.value = event.matches))
}

/** Whether the frame has the room of 980 px and over, for what is not a component of it. */
export function useEditorWide() {
  watchWidth()
  return computed(() => wide.value)
}

/** Only the server's own `true` turns it on: absent, or a config that failed, is today's editor. */
export function useEditorV2() {
  const studio = useStudio()
  return computed(() => studio.config.value?.limits?.editor?.editor_v2 === true)
}

export function useEditorFrame() {
  const route = useRoute()
  const studio = useStudio()
  const telegram = useTelegramApp()
  const v2 = useEditorV2()
  watchWidth()

  const known = computed(() => studio.loaded.value)
  // Taking a `config` that is back to null after signing out as "off" would forget it for the next account.
  watch(
    () => [known.value, studio.config.value] as const,
    ([settled, config]) => {
      if (settled && config) remember(v2.value)
    },
    { immediate: true },
  )

  /** A document, or the bot's link to one. The list of documents needs the app's menus to leave by. */
  const onDocument = computed(
    () =>
      /\/app\/editor\/[^/]+/.test(route.path) ||
      (/\/app\/editor\/?$/.test(route.path) && !!route.query.file_id),
  )
  /** The deck editor has no older frame to fall back to, so it never waits on the switch. */
  const onDeck = computed(() => /\/app\/editor\/deck(\/|$)/.test(route.path))
  /** The server's answer, or until it comes the last one this device saw. */
  const expected = computed(() => onDeck.value || (known.value ? v2.value : remembered()))
  /** The frame alone on screen, with no app menus: there is no room for them, or Telegram has its own. */
  const bare = computed(() => onDocument.value && expected.value && (telegram.isMiniApp.value || !wide.value))

  return { v2, known, expected, onDocument, onDeck, bare, wide: computed(() => wide.value) }
}
