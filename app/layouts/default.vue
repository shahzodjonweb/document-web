<!-- The app's frame: the signed-in workspace and its sign-in. The public site has layouts/site.vue. -->
<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { t, count, path, locale, localePath } = useLocale()
const ws = useWorkspace()
const studio = useStudio()
const auth = useAuthentication()
const telegram = useTelegramApp()
const editorFrame = useEditorFrame()
const miniAppError = ref('')
const miniAppBusy = ref(false)
const { user, sessionReady } = ws
const isApp = computed(() => route.path.includes('/app'))
// The editor owns its own padding so the page canvas can use the full width.
const isEditor = computed(() => /\/app\/editor(\/|$)/.test(route.path))
// The resolved theme on screen: a saved "system" choice shows as light or dark.
const theme = ref('light')
type NavItem = { key: string; label: string; url: string; icon: string }
const plan = computed(
  () => ws.plans.value.find((item: any) => item.id === (user.value?.plan || 'free')) as any,
)
// Every plan keeps the same number of saved workflows. The menu still reads it
// from the plan, so a cap set to zero hides a page that could save nothing.
const hasWorkflows = computed(() => Number(plan.value?.limits?.saved_workflows || 0) > 0)
const workNav = computed<NavItem[]>(() => [
  { key: 'home', label: 'navHome', url: '/app', icon: 'home' },
  ...(studio.config.value
    ? [{ key: 'create', label: 'navCreate', url: '/app/create', icon: 'sparkle' }]
    : []),
  { key: 'tools', label: 'navTools', url: '/app/tools', icon: 'tools' },
  ...(studio.config.value ? [{ key: 'editor', label: 'editor', url: '/app/editor', icon: 'edit' }] : []),
  { key: 'tasks', label: 'navTasks', url: '/app/jobs', icon: 'tasks' },
  ...(studio.config.value && hasWorkflows.value
    ? [{ key: 'workflows', label: 'workflows', url: '/app/workflows', icon: 'reorder' }]
    : []),
])
const accountNav = computed<NavItem[]>(() => [
  { key: 'billing', label: 'navBilling', url: '/app/billing', icon: 'billing' },
  { key: 'referrals', label: 'referrals', url: '/app/referrals', icon: 'gift' },
  { key: 'settings', label: 'settings', url: '/app/settings', icon: 'settings' },
  { key: 'support', label: 'navHelp', url: '/app/support', icon: 'help' },
  ...(studio.config.value ? [{ key: 'guide', label: 'guide', url: '/app/guide', icon: 'book' }] : []),
])
// Phones keep the four everyday places in the bottom bar; the rest is in "More".
const phoneNav = computed(() =>
  workNav.value.filter((item) => ['home', 'create', 'tools', 'tasks'].includes(item.key)),
)
const moreNav = computed(() => [
  ...workNav.value.filter((item) => !phoneNav.value.includes(item)),
  ...accountNav.value,
])
const current = (url: string) =>
  url === '/app' ? route.path === path(url) : route.path.startsWith(path(url))
/*
 * Inside Telegram (a Mini App) Telegram draws the top bar, the close button and Back,
 * so the app keeps only three places in a bar of its own, shown on those three screens
 * alone; every other screen is a step away from one of them, and Telegram's Back leads
 * there (docs/design/MINI_APP.md).
 */
const tg = telegram.isMiniApp
const tgTabs: NavItem[] = [
  { key: 'home', label: 'navHome', url: '/app', icon: 'home' },
  { key: 'tasks', label: 'navTasks', url: '/app/jobs', icon: 'tasks' },
  { key: 'profile', label: 'navProfile', url: '/app/account', icon: 'user' },
]
const view = computed(() => route.path.replace(/^\/(en|uz|ru)(?=\/|$)/, '').replace(/\/$/, '') || '/')
const tabRoot = computed(() => tgTabs.some((tab) => tab.url === view.value))
const tabCurrent = (url: string) => view.value === url || (url === '/app/jobs' && view.value.startsWith('/app/jobs/'))
// Whether this screen was reached inside the app, so Back can return the way it came.
const cameInApp = ref(false)
const readHistory = () => {
  cameInApp.value = import.meta.client && !!window.history.state?.back
}
onScopeDispose(router.afterEach(readHistory))
// Opened straight from a bot button (the editor, a deck's or CV's setup): Telegram's
// Close is the way out, as those screens keep their own Back for their sheets.
const STANDALONE = /^\/app\/(editor|deck-setup|cv-setup|pay|card)(\/|$)/
// Opened on one of them, Close stays while the customer moves among them (the editor
// opening its draft, say); once they leave for the rest of the app, Back leads back.
const enteredStandalone = ref<boolean | null>(null)
watch(
  view,
  (value) => {
    if (enteredStandalone.value === null) enteredStandalone.value = STANDALONE.test(value)
    else if (!STANDALONE.test(value)) enteredStandalone.value = false
  },
  { immediate: true },
)
const routeBack = computed(
  () =>
    tg.value &&
    !!user.value &&
    !tabRoot.value &&
    (!STANDALONE.test(view.value) || (cameInApp.value && !enteredStandalone.value)),
)
function parentOf(value: string) {
  if (value.startsWith('/app/jobs/')) return '/app/jobs'
  if (/^\/app\/(billing|referrals|settings|support|guide|workflows)(\/|$)/.test(value)) return '/app/account'
  return '/app'
}
telegram.useBackLayer(routeBack, () => {
  if (window.history.state?.back) router.back()
  else void navigateTo(path(parentOf(view.value)), { replace: true })
})
const moreActive = computed(() => moreNav.value.some((item) => current(item.url)))
watch(user, (value) => {
  // A saved profile is a new `user` too; a deep link has what it needs from the first read.
  if (value && !(editorFrame.onDocument.value && studio.config.value)) studio.load()
  else if (!value) studio.config.value = null
})
const title = computed(() => {
  // Under the editor's menu entry, but slides, not a PDF.
  if (editorFrame.onDeck.value) return t('deckEditorTitle')
  const item = [...workNav.value, ...accountNav.value]
    .sort((a, b) => b.url.length - a.url.length)
    .find((entry) => current(entry.url))
  if (item) return t(item.label)
  if (route.path.includes('/referrals')) return t('referrals')
  if (route.path.includes('/app/pay')) return t('checkoutTitle')
  if (route.path.includes('/app/card/')) return t('cardReturnTitle')
  if (route.path.includes('/bot')) return t('bot')
  if (route.path.includes('/deck-setup') || route.path.includes('/cv-setup')) return t('navCreate')
  return t('navHome')
})
// File tasks left this week; an unlimited plan (null) shows no count.
const tasksLeft = computed(() => ws.usage.value?.file_jobs?.remaining ?? null)
const initial = computed(() => (user.value?.display_name || 'P').slice(0, 1).toUpperCase())
// A visitor who is not signed in gets the plain public frame around the
// sign-in panel; the app menu would only lead back to it. While the session
// or the mini-app sign-in is still settling, the app frame stays up so a
// returning customer never sees the frame change under them.
const framed = computed(() => isApp.value && (!!user.value || !sessionReady.value || miniAppBusy.value))
// A document on a phone, or inside Telegram, has the whole screen and scrolls only its pages.
const bare = computed(() => framed.value && editorFrame.bare.value)
watch(bare, (on) => document.documentElement.classList.toggle('editor-bare', on), {
  immediate: import.meta.client,
})
const showTabs = computed(() => framed.value && !!user.value && !bare.value && (!tg.value || tabRoot.value))
// The Mini App's frame (assets/css/miniapp.css) and whether its bar takes room at the bottom.
watch(tg, (on) => document.documentElement.classList.toggle('tg-app', on), { immediate: import.meta.client })
watch(
  () => tg.value && showTabs.value,
  (on) => document.documentElement.classList.toggle('tg-tabs', on),
  { immediate: import.meta.client },
)
// The frame shows no plans, so a deep link does not wait on them, but the app's menus do once it leaves.
let plansWaiting = false
watch(bare, (on) => {
  if (on || !plansWaiting) return
  plansWaiting = false
  void ws.loadPlans().catch(() => {})
})
const more = ref<HTMLDialogElement | null>(null)
function openMore() {
  more.value?.showModal()
}
function closeMore() {
  if (more.value?.open) more.value.close()
}
function closeOnBackdrop(event: MouseEvent) {
  if (event.target === more.value) closeMore()
}
watch(() => route.fullPath, closeMore)
function applyTheme(value: string) {
  const dark = value === 'dark' || (value === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  theme.value = dark ? 'dark' : 'light'
  document.documentElement.dataset.theme = theme.value
}
function toggleTheme() {
  const next = theme.value === 'dark' ? 'light' : 'dark'
  try {
    localStorage.setItem('docmaster-theme', next)
  } catch {}
  applyTheme(next)
}
async function signOut() {
  closeMore()
  await ws.logout()
  await navigateTo(path('/app'))
}
async function changeLocale(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (user.value) {
    try {
      await ws.updateProfile({ locale: value })
    } catch {}
  }
  await navigateTo(localePath(value))
}
async function signInMiniApp() {
  if (!telegram.initData() || user.value || miniAppBusy.value) return
  miniAppError.value = ''
  miniAppBusy.value = true
  try {
    await auth.startRequest('/auth/telegram/miniapp', { init_data: telegram.initData() })
    await auth.refreshAccount()
    telegram.ready()
    telegram.expand()
  } catch (error) {
    miniAppError.value = auth.errorMessage(error)
  } finally {
    miniAppBusy.value = false
  }
}
/**
 * Where `t.me/<bot>?startapp=…` leads: a bot message or a post can open one screen. Only
 * these names, and a task by its id; anything else is the home screen.
 */
const START_SCREENS: Record<string, string> = {
  tools: '/app/tools',
  jobs: '/app/jobs',
  plans: '/app/billing',
  invite: '/app/referrals',
  settings: '/app/settings',
  help: '/app/support',
  profile: '/app/account',
  create_pdf: '/app/create?feature=ai.pdf_topic',
  create_slides: '/app/create?feature=ai.pptx',
  create_cv: '/app/create?feature=ai.cv',
  scan: '/app/tools/pdf.images_to_pdf',
}
function startScreen(value: string) {
  if (START_SCREENS[value]) return START_SCREENS[value]
  const job = value.match(/^job_([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})$/)
  return job ? `/app/jobs/${job.slice(1).join('-')}` : ''
}
// A link outside the app opens in Telegram (t.me) or the phone's browser, the app left open.
function openOutside(event: MouseEvent) {
  if (!tg.value || event.defaultPrevented || event.button !== 0) return
  const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
  if (!anchor || anchor.hasAttribute('download')) return
  let url: URL
  try {
    url = new URL(anchor.href, location.href)
  } catch {
    return
  }
  if (url.origin === location.origin || !/^https?:$/.test(url.protocol)) return
  const opened = url.hostname === 't.me' ? telegram.openTelegramLink(url.href) : telegram.openLink(url.href)
  if (opened) event.preventDefault()
}
onMounted(async () => {
  let saved = ''
  try {
    saved = localStorage.getItem('docmaster-theme') || ''
  } catch {}
  readHistory()
  // A customer who never chose a theme gets Telegram's own; inside Telegram, always
  // Telegram's, colours and all, following it when it changes.
  applyTheme((!tg.value && saved) || telegram.colorScheme() || 'light')
  telegram.useTelegramFrame({
    onSettings: () => void navigateTo(path('/app/settings')),
    // Back from being minimised: a task may have finished, a plan been paid.
    onActive: () => {
      if (user.value) void ws.loadAccount().catch(() => {})
    },
  })
  document.addEventListener('click', openOutside, true)
  // Settings changes the theme too; the toggle follows whatever is on screen.
  new MutationObserver(() => {
    theme.value = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  await ws.init()
  // Inside Telegram the account's language leads, as the menu button opens one address
  // for everyone; in a browser the address chosen leads and the account follows it.
  if (user.value && user.value.locale !== locale.value && !tg.value) {
    try {
      await ws.updateProfile({ locale: locale.value })
    } catch {}
  }
  ws.restoreDraft()
  telegram.ready()
  telegram.expand()
  // The web view's cookies can outlive a switch of Telegram account on the phone: the
  // person Telegram opened the app for is the one signed in, never the last one.
  const launchedAs = telegram.telegramUserId()
  if (tg.value && user.value && launchedAs && String(user.value.telegram_user_id || '') !== launchedAs)
    await ws.logout().catch(() => {})
  if (telegram.initData() && !user.value) await signInMiniApp()
  if (tg.value && user.value) {
    const target = startScreen(telegram.startParam())
    const language = ['en', 'uz', 'ru'].includes(user.value.locale) ? user.value.locale : locale.value
    if (language !== locale.value) await navigateTo(localePath(language).split('#')[0]!, { replace: true })
    if (target && view.value === '/app') await navigateTo(`/${language}${target}`)
  }
  // The switch for the frame lives in the studio's config, so a document reads that once.
  const config = editorFrame.onDocument.value && studio.config.value ? null : studio.load()
  // Decided now, as everything else here waits on it: only the frame expected on a document holds the plans back.
  if (bare.value) {
    await Promise.allSettled([ws.loadCatalog(), ws.loadAccount(), config])
    if (bare.value) plansWaiting = true
    else await ws.loadPlans().catch(() => {})
  } else await Promise.allSettled([ws.loadCatalog(), ws.loadPlans(), ws.loadAccount(), config])
  if (user.value) {
    try {
      const pending = JSON.parse(sessionStorage.getItem('docmaster-pending-job') || 'null')
      if (pending) {
        const job = await ws.api('/jobs', {
          method: 'POST',
          headers: { 'Idempotency-Key': pending.key },
          body: { quote_id: pending.quote_id },
        })
        sessionStorage.removeItem('docmaster-pending-job')
        await navigateTo(path(`/app/jobs/${job.id}`))
      }
    } catch (e: any) {
      if (e.statusCode && e.statusCode < 500) sessionStorage.removeItem('docmaster-pending-job')
    }
  }
})
onBeforeUnmount(() => document.removeEventListener('click', openOutside, true))
</script>
<template>
  <a class="skip-link" href="#main-content">{{ t('skipToContent') }}</a>
  <div :class="framed ? 'app-shell' : 'public-shell'">
    <aside v-if="framed && !bare && !tg" class="sidebar">
      <div class="sidebar-inner">
        <NuxtLink :to="path('/app')" class="brand sidebar-brand"><BrandLogo /></NuxtLink>
        <nav class="side-nav" :aria-label="t('navLabel')">
          <p class="nav-group">{{ t('navWork') }}</p>
          <NuxtLink
            v-for="item in workNav"
            :key="item.key"
            :to="path(item.url)"
            :class="{ active: current(item.url) }"
            :aria-current="current(item.url) ? 'page' : undefined"
            ><AppIcon :name="item.icon" :size="18" /><span>{{ t(item.label) }}</span
            ><span v-if="item.key === 'tools' && ws.features.value.length" class="nav-count">{{
              ws.features.value.length
            }}</span></NuxtLink
          >
          <p class="nav-group">{{ t('account') }}</p>
          <NuxtLink
            v-for="item in accountNav"
            :key="item.key"
            :to="path(item.url)"
            :class="{ active: current(item.url) }"
            :aria-current="current(item.url) ? 'page' : undefined"
            ><AppIcon :name="item.icon" :size="18" /><span>{{ t(item.label) }}</span></NuxtLink
          >
        </nav>
        <NuxtLink v-if="user" :to="path('/app/settings')" class="sidebar-profile"
          ><span class="avatar" aria-hidden="true">{{ initial }}</span
          ><span class="profile-text"
            ><strong>{{ user.display_name }}</strong
            ><small>{{ t(user.plan || 'free') }}</small></span
          ><AppIcon name="chevron" :size="16"
        /></NuxtLink>
      </div>
    </aside>
    <div class="app-body">
      <header v-if="framed && !bare && !tg" class="app-topbar">
        <NuxtLink :to="path('/app')" class="brand mobile-brand"><BrandLogo /></NuxtLink>
        <p class="topbar-title">{{ title }}</p>
        <div class="header-actions">
          <NuxtLink v-if="user" :to="path('/app/billing')" class="plan-chip"
            ><span class="plan-chip-name">{{ t(user.plan || 'free') }}</span
            ><span v-if="tasksLeft !== null" class="plan-chip-left">{{
              count('tasksLeft', Math.max(0, tasksLeft))
            }}</span></NuxtLink
          ><label class="locale-picker"
            ><AppIcon name="globe" :size="16" /><select
              :value="locale"
              @change="changeLocale"
              aria-label="Language"
            >
              <option value="en">English</option>
              <option value="uz">O‘zbekcha</option>
              <option value="ru">Русский</option></select
            ><AppIcon name="down" :size="12" /></label
          ><button
            class="icon-button theme-toggle"
            type="button"
            :aria-label="t(theme === 'dark' ? 'switchToLight' : 'switchToDark')"
            @click="toggleTheme"
          >
            <AppIcon :name="theme === 'dark' ? 'sun' : 'moon'" :size="18" />
          </button>
        </div>
      </header>
      <header v-else-if="!framed && !tg" class="public-topbar">
        <NuxtLink :to="path()" class="brand"><BrandLogo /></NuxtLink>
        <nav class="public-nav">
          <NuxtLink :to="path('/tools')">{{ t('navTools') }}</NuxtLink
          ><NuxtLink :to="path('/pricing')">{{ t('pricing') }}</NuxtLink
          ><NuxtLink :to="path('/help')">{{ t('help') }}</NuxtLink>
        </nav>
        <div class="header-actions">
          <label class="locale-picker"
            ><AppIcon name="globe" :size="16" /><select
              :value="locale"
              @change="changeLocale"
              aria-label="Language"
            >
              <option value="en">English</option>
              <option value="uz">O‘zbekcha</option>
              <option value="ru">Русский</option></select
            ><AppIcon name="down" :size="12" /></label
          ><NuxtLink v-if="!isApp" :to="path('/app')" class="button primary small public-start"
            >{{ t('start') }}<AppIcon name="right" :size="15"
          /></NuxtLink>
        </div>
      </header>
      <main
        id="main-content"
        tabindex="-1"
        :class="[framed ? 'main-content' : 'public-content', { 'main-content-wide': framed && isEditor }]"
      >
        <ErrorBanner v-if="miniAppError && !user" :message="miniAppError"
          ><button class="text-link" :disabled="miniAppBusy" @click="signInMiniApp">
            {{ t('retry') }}
          </button></ErrorBanner
        >
        <slot />
      </main>
      <footer v-if="!isApp && !tg" class="public-footer">
        <div>
          <NuxtLink :to="path()" class="brand footer-brand"><BrandLogo /></NuxtLink>
          <p>{{ t('footerNote') }}</p>
        </div>
        <nav>
          <NuxtLink :to="path('/legal/privacy')">{{ t('privacy') }}</NuxtLink
          ><NuxtLink :to="path('/legal/terms')">{{ t('terms') }}</NuxtLink
          ><NuxtLink :to="path('/help')">{{ t('help') }}</NuxtLink>
        </nav>
      </footer>
    </div>
    <nav v-if="showTabs && tg" class="mobile-nav tg-tabbar" :aria-label="t('navLabel')">
      <NuxtLink
        v-for="item in tgTabs"
        :key="item.key"
        :to="path(item.url)"
        replace
        :class="{ active: tabCurrent(item.url) }"
        :aria-current="tabCurrent(item.url) ? 'page' : undefined"
        @click="!tabCurrent(item.url) && telegram.haptic('selection')"
        ><AppIcon :name="item.icon" :size="22" /><span>{{ t(item.label) }}</span></NuxtLink
      >
    </nav>
    <nav v-else-if="showTabs" class="mobile-nav" :aria-label="t('navLabel')">
      <NuxtLink
        v-for="item in phoneNav"
        :key="item.key"
        :to="path(item.url)"
        :class="{ active: current(item.url) }"
        :aria-current="current(item.url) ? 'page' : undefined"
        ><AppIcon :name="item.icon" :size="20" /><span>{{
          t(item.key === 'create' ? 'create' : item.label)
        }}</span></NuxtLink
      ><button type="button" :class="{ active: moreActive }" aria-haspopup="dialog" @click="openMore">
        <AppIcon name="menu" :size="20" /><span>{{ t('navMore') }}</span>
      </button>
    </nav>
    <dialog
      v-if="framed && user && !bare && !tg"
      ref="more"
      class="more-sheet"
      :aria-label="t('navMore')"
      @click="closeOnBackdrop"
    >
      <div class="sheet-body">
        <div class="sheet-head">
          <strong>{{ t('navMore') }}</strong
          ><button class="icon-button" type="button" :aria-label="t('closeMenu')" @click="closeMore">
            <AppIcon name="x" :size="18" />
          </button>
        </div>
        <nav class="sheet-nav" :aria-label="t('navMore')">
          <NuxtLink
            v-for="item in moreNav"
            :key="item.key"
            :to="path(item.url)"
            :class="{ active: current(item.url) }"
            :aria-current="current(item.url) ? 'page' : undefined"
            ><AppIcon :name="item.icon" :size="19" /><span>{{ t(item.label) }}</span
            ><AppIcon name="chevron" :size="15"
          /></NuxtLink>
        </nav>
        <div class="sheet-prefs">
          <label class="locale-picker"
            ><AppIcon name="globe" :size="16" /><select
              :value="locale"
              @change="changeLocale"
              aria-label="Language"
            >
              <option value="en">English</option>
              <option value="uz">O‘zbekcha</option>
              <option value="ru">Русский</option></select
            ><AppIcon name="down" :size="12" /></label
          ><button class="button secondary small" type="button" @click="toggleTheme">
            <AppIcon :name="theme === 'dark' ? 'sun' : 'moon'" :size="16" />{{
              t(theme === 'dark' ? 'switchToLight' : 'switchToDark')
            }}
          </button>
        </div>
        <div class="sheet-account">
          <span class="avatar" aria-hidden="true">{{ initial }}</span
          ><span class="profile-text"
            ><strong>{{ user.display_name }}</strong
            ><small>{{ t(user.plan || 'free') }}</small></span
          ><button class="button quiet small" type="button" @click="signOut">
            <AppIcon name="logout" :size="16" />{{ t('logout') }}
          </button>
        </div>
      </div>
    </dialog>
  </div>
  <AntiBotDialog />
  <ChannelGateDialog />
</template>
