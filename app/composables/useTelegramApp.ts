/**
 * The one reader of `window.Telegram.WebApp`.
 *
 * Telegram's script is on every page and makes a `WebApp` even in a plain browser,
 * so "inside Telegram" means it was given `initData`. Everything else is asked of
 * the version the client says it runs, as an older client warns or throws on a
 * call it does not know. The versions are core.telegram.org/bots/webapps's own.
 *
 * Module state, because one MainButton, one BackButton and one swipe setting serve
 * every component that wants them.
 */
import type { MaybeRefOrGetter, WatchSource } from 'vue'

const BACK_BUTTON = '6.1'
const HAPTICS = '6.1'
const CLOSING_CONFIRMATION = '6.2'
const VERTICAL_SWIPES = '7.7'
const SAFE_AREAS = '8.0'
const FULLSCREEN = '8.0'
const DEVICE_STORAGE = '9.0'
const HIDE_KEYBOARD = '9.1'
/** A lost pointerup must not leave Telegram's swipe switched off for good. */
const SWIPE_SAFETY_RELEASE = 10_000
/** Less than this between the window and what is visible is browser bars, not a keyboard. */
const KEYBOARD_MIN = 80
/** On a screen this short a MainButton above the keyboard leaves no room for the page. */
const MAIN_BUTTON_MIN_HEIGHT = 600

export interface PrimaryAction {
  text: string
  enabled?: boolean
  busy?: boolean
  onPress: () => void
}
/** `null` leaves the choice to the layer below; `hidden` is this layer saying there is no button now. */
export type PrimaryClaim = PrimaryAction | 'hidden' | null
export type Haptic = 'success' | 'warning' | 'error' | 'light' | 'medium' | 'selection'

interface Layer {
  layer: string
  claim: () => PrimaryClaim
}

const webApp = (): any => (import.meta.client ? ((window as any).Telegram?.WebApp ?? null) : null)
const isVersionAtLeast = (version: string) => webApp()?.isVersionAtLeast?.(version) === true

const miniApp = ref(false)
const layers = shallowRef<Layer[]>([])
const backStack = shallowRef<(() => void)[]>([])
const stableHeight = ref(0)
const keyboardInset = ref(0)
const fullscreen = ref(false)

/** The top layer that says anything decides; a layer's text can change while it stays on top. */
const primary = computed<PrimaryAction | null>(() => {
  for (let index = layers.value.length - 1; index >= 0; index -= 1) {
    const claim = layers.value[index]!.claim()
    if (claim) return claim === 'hidden' ? null : claim
  }
  return null
})
const typingOnShortScreen = computed(
  () => keyboardInset.value > 0 && stableHeight.value > 0 && stableHeight.value < MAIN_BUTTON_MIN_HEIGHT,
)

let mainButtonOwned = false
let viewportTracked = false
function pressPrimary() {
  const action = primary.value
  if (action && action.enabled !== false && !action.busy) action.onPress()
}
function driveMainButton() {
  const button = miniApp.value ? webApp()?.MainButton : null
  if (!button) return
  const action = typingOnShortScreen.value ? null : primary.value
  if (!action) {
    // Never asked for, never touched: other screens have no business with this button.
    if (!mainButtonOwned) return
    mainButtonOwned = false
    button.offClick?.(pressPrimary)
    button.hideProgress?.()
    button.hide?.()
    if (viewportTracked) applyViewport()
    return
  }
  button.setParams?.({
    text: action.text,
    is_active: action.enabled !== false && !action.busy,
    is_visible: true,
  })
  if (action.busy) button.showProgress?.(false)
  else button.hideProgress?.()
  if (!mainButtonOwned) {
    mainButtonOwned = true
    button.onClick?.(pressPrimary)
    if (viewportTracked) applyViewport()
  }
}

function pressBack() {
  backStack.value[backStack.value.length - 1]?.()
}
let backButtonOwned = false
function driveBackButton() {
  const button = miniApp.value && isVersionAtLeast(BACK_BUTTON) ? webApp()?.BackButton : null
  if (!button) return
  const wanted = backStack.value.length > 0
  if (wanted === backButtonOwned) return
  backButtonOwned = wanted
  if (wanted) {
    button.onClick?.(pressBack)
    button.show?.()
  } else {
    button.offClick?.(pressBack)
    button.hide?.()
  }
}

// These outlive the component that first asks, so they belong to no component's scope.
let driving = false
function startDriving() {
  if (driving || !import.meta.client) return
  driving = true
  // Telegram's script is deferred like the app itself, and may run just after it.
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', () => (miniApp.value = !!webApp()?.initData), {
      once: true,
    })
  effectScope(true).run(() => {
    watch([primary, typingOnShortScreen], driveMainButton)
    watch(backStack, driveBackButton)
  })
}

let swipeHolds = 0
function applySwipeHolds(change: number) {
  const before = swipeHolds > 0
  swipeHolds += change
  const after = swipeHolds > 0
  if (before === after || !miniApp.value || !isVersionAtLeast(VERTICAL_SWIPES)) return
  if (after) webApp()?.disableVerticalSwipes?.()
  else webApp()?.enableVerticalSwipes?.()
}

/** Telegram's own view of the page, written where the frame's CSS reads it. */
function applyViewport() {
  const root = document.documentElement
  const app = webApp()
  const stable = miniApp.value ? Number(app?.viewportStableHeight) : 0
  stableHeight.value = stable > 0 ? stable : 0
  if (stable > 0) root.style.setProperty('--tg-stable-h', `${stable}px`)
  fullscreen.value = app?.isFullscreen === true
  if (miniApp.value && isVersionAtLeast(SAFE_AREAS)) {
    // The MainButton sits under the page and clears the home bar itself.
    const bottom = mainButtonOwned
      ? 0
      : (app?.safeAreaInset?.bottom ?? 0) + (app?.contentSafeAreaInset?.bottom ?? 0)
    const top = (app?.safeAreaInset?.top ?? 0) + (app?.contentSafeAreaInset?.top ?? 0)
    root.style.setProperty('--editor-safe-bottom', `${bottom}px`)
    root.style.setProperty('--editor-safe-top', `${top}px`)
  }
}

/**
 * iOS Telegram does not resize for the keyboard, so only the visual viewport knows.
 * Measured from the stable height there and the tallest window seen elsewhere, as
 * Android and browsers shrink the window itself.
 */
let tallest = 0
let measuredWidth = 0
function applyKeyboard() {
  const view = window.visualViewport
  // Turning the phone changes what "tallest" means; a keyboard never changes the width.
  if (window.innerWidth !== measuredWidth) tallest = 0
  measuredWidth = window.innerWidth
  tallest = Math.max(tallest, window.innerHeight)
  const covered =
    view && view.scale <= 1.01 ? (stableHeight.value || tallest) - view.height - view.offsetTop : 0
  keyboardInset.value = covered >= KEYBOARD_MIN ? Math.round(covered) : 0
  document.documentElement.style.setProperty('--editor-keyboard', `${keyboardInset.value}px`)
}
function onViewport(event?: { isStateStable?: boolean }) {
  // Mid-drag values are not worth laying the page out for.
  if (event?.isStateStable !== false) applyViewport()
  applyKeyboard()
}
/**
 * The frames up now. The next one (another deck's, opened from this one) sets up before
 * this one goes: only the last to go stops listening and takes the heights away.
 */
let viewportUsers = 0

export function useTelegramApp() {
  miniApp.value = !!webApp()?.initData
  startDriving()

  function ready() {
    webApp()?.ready?.()
  }
  function expand() {
    webApp()?.expand?.()
  }
  function close() {
    webApp()?.close?.()
  }
  const initData = (): string => webApp()?.initData || ''
  const colorScheme = (): string => webApp()?.colorScheme || ''

  function haptic(kind: Haptic) {
    if (!miniApp.value || !isVersionAtLeast(HAPTICS)) return
    const feedback = webApp()?.HapticFeedback
    if (kind === 'selection') feedback?.selectionChanged?.()
    else if (kind === 'light' || kind === 'medium') feedback?.impactOccurred?.(kind)
    else feedback?.notificationOccurred?.(kind)
  }

  /** Telegram's MainButton inside Telegram; `MainButtonFallback.vue` reads `browserPrimary` elsewhere. */
  function usePrimaryAction(layer: string, claim: MaybeRefOrGetter<PrimaryClaim>) {
    const entry: Layer = { layer, claim: () => toValue(claim) }
    layers.value = [...layers.value.filter((item) => item.layer !== layer), entry]
    onScopeDispose(() => {
      layers.value = layers.value.filter((item) => item !== entry)
    })
  }
  const browserPrimary = computed(() => (miniApp.value ? null : primary.value))

  /**
   * A way back for as long as `active` holds: field over sheet over Pages. At the
   * root the stack is empty, so the button goes and Telegram shows Close.
   */
  function useBackLayer(active: WatchSource<boolean>, handler: () => void) {
    let entry: (() => void) | null = null
    const leave = () => {
      if (!entry) return
      const gone = entry
      entry = null
      backStack.value = backStack.value.filter((item) => item !== gone)
    }
    watch(
      active,
      (on) => {
        if (on && !entry) {
          entry = () => handler()
          backStack.value = [...backStack.value, entry]
        } else if (!on) leave()
      },
      { immediate: true },
    )
    onScopeDispose(leave)
  }
  /** Telegram draws the arrow from 6.1; below that, and in a browser, the top bar has to. */
  const hasBackButton = computed(() => miniApp.value && isVersionAtLeast(BACK_BUTTON))
  const canGoBack = computed(() => backStack.value.length > 0)

  /**
   * Keeps a drag or a sheet from dragging the whole app down. A gesture can lose
   * its pointerup, so its hold lets go by itself after 10 s; `lasting` is for a
   * sheet, whose hold ends with the sheet and can be held open for minutes.
   */
  function holdSwipes(options: { lasting?: boolean } = {}) {
    applySwipeHolds(1)
    let released = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const release = () => {
      if (released) return
      released = true
      if (timer !== null) clearTimeout(timer)
      applySwipeHolds(-1)
    }
    if (!options.lasting) timer = setTimeout(release, SWIPE_SAFETY_RELEASE)
    return release
  }

  /** Telegram asks before closing while `unsaved` holds. Below 6.2 the page saves as it hides instead. */
  function bindClosingConfirmation(unsaved: WatchSource<boolean>) {
    const supported = () => miniApp.value && isVersionAtLeast(CLOSING_CONFIRMATION)
    let enabled = false
    const set = (value: boolean) => {
      if (value === enabled || !supported()) return
      enabled = value
      if (value) webApp()?.enableClosingConfirmation?.()
      else webApp()?.disableClosingConfirmation?.()
    }
    watch(unsaved, set, { immediate: true })
    onScopeDispose(() => set(false))
  }

  /**
   * Heights and insets for the frame's lifetime. Set only while it is up, so every
   * other screen, and today's editor, keeps the `100dvh` its rules fall back to.
   */
  function useViewport() {
    if (!import.meta.client) return
    const app = webApp()
    const view = window.visualViewport
    viewportTracked = true
    applyViewport()
    applyKeyboard()
    if (++viewportUsers === 1) {
      app?.onEvent?.('viewportChanged', onViewport)
      if (isVersionAtLeast(SAFE_AREAS)) {
        app?.onEvent?.('safeAreaChanged', applyViewport)
        app?.onEvent?.('contentSafeAreaChanged', applyViewport)
      }
      if (isVersionAtLeast(FULLSCREEN)) app?.onEvent?.('fullscreenChanged', applyViewport)
      view?.addEventListener('resize', applyKeyboard)
      view?.addEventListener('scroll', applyKeyboard)
    }
    onScopeDispose(() => {
      if (--viewportUsers > 0) return
      viewportTracked = false
      app?.offEvent?.('viewportChanged', onViewport)
      if (isVersionAtLeast(SAFE_AREAS)) {
        app?.offEvent?.('safeAreaChanged', applyViewport)
        app?.offEvent?.('contentSafeAreaChanged', applyViewport)
      }
      if (isVersionAtLeast(FULLSCREEN)) app?.offEvent?.('fullscreenChanged', applyViewport)
      view?.removeEventListener('resize', applyKeyboard)
      view?.removeEventListener('scroll', applyKeyboard)
      const root = document.documentElement
      for (const name of ['--tg-stable-h', '--editor-safe-bottom', '--editor-safe-top', '--editor-keyboard'])
        root.style.removeProperty(name)
      stableHeight.value = 0
      keyboardInset.value = 0
    })
  }

  /**
   * Below 7.7 Telegram cannot be told to leave a vertical drag alone, so a mark
   * dragged down would pull the whole app down with it: there, marks move by buttons.
   */
  const canDragMarks = computed(() => !miniApp.value || isVersionAtLeast(VERTICAL_SWIPES))

  /** The keyboard goes with the field's Done; from 9.1 Telegram can be asked as well, as iOS keeps it up otherwise. */
  function hideKeyboard() {
    if (miniApp.value && isVersionAtLeast(HIDE_KEYBOARD)) webApp()?.hideKeyboard?.()
  }

  /**
   * Telegram's storage on this phone from 9.0, 5 MB a person, which outlives the web
   * view's own; the browser's elsewhere. Nothing here leaves the device.
   */
  const deviceStorage = () =>
    miniApp.value && isVersionAtLeast(DEVICE_STORAGE) ? webApp()?.DeviceStorage : null
  function storageGet(key: string): Promise<string | null> {
    const store = deviceStorage()
    if (!store) {
      try {
        return Promise.resolve(localStorage.getItem(key))
      } catch {
        return Promise.resolve(null)
      }
    }
    return new Promise((resolve) => {
      try {
        store.getItem(key, (error: unknown, value?: string) => resolve(error || !value ? null : value))
      } catch {
        resolve(null)
      }
    })
  }
  function storageSet(key: string, value: string | null): Promise<boolean> {
    const store = deviceStorage()
    if (!store) {
      try {
        if (value === null) localStorage.removeItem(key)
        else localStorage.setItem(key, value)
        return Promise.resolve(true)
      } catch {
        return Promise.resolve(false)
      }
    }
    return new Promise((resolve) => {
      const done = (error: unknown, ok?: boolean) => resolve(!error && ok !== false)
      try {
        if (value === null) store.removeItem(key, done)
        else store.setItem(key, value, done)
      } catch {
        resolve(false)
      }
    })
  }

  /** Telegram Desktop only: a phone's mini app already fills what it can. */
  const canExpand = computed(
    () =>
      miniApp.value &&
      isVersionAtLeast(FULLSCREEN) &&
      ['tdesktop', 'macos'].includes(String(webApp()?.platform)),
  )
  function toggleExpanded() {
    if (!canExpand.value) return
    if (fullscreen.value) webApp()?.exitFullscreen?.()
    else webApp()?.requestFullscreen?.()
  }

  return {
    isMiniApp: computed(() => miniApp.value),
    isVersionAtLeast,
    initData,
    colorScheme,
    ready,
    expand,
    close,
    haptic,
    usePrimaryAction,
    browserPrimary,
    pressPrimary,
    useBackLayer,
    hasBackButton,
    canGoBack,
    goBack: pressBack,
    holdSwipes,
    bindClosingConfirmation,
    useViewport,
    canExpand,
    isExpanded: computed(() => fullscreen.value),
    toggleExpanded,
    keyboardInset: computed(() => keyboardInset.value),
    canDragMarks,
    hideKeyboard,
    storageGet,
    storageSet,
  }
}
