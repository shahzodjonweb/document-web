<script setup lang="ts">
const route = useRoute()
const { t, count, path, locale, localePath } = useLocale()
const ws = useWorkspace()
const studio = useStudio()
const auth = useAuthentication()
const miniAppError = ref('')
const miniAppBusy = ref(false)
const { user, sessionReady } = ws
const isApp = computed(() => route.path.includes('/app'))
// The editor owns its own padding so the page canvas can use the full width.
const isEditor = computed(() => /\/app\/editor(\/|$)/.test(route.path))
// The resolved theme on screen: a saved "system" choice shows as light or dark.
const theme = ref('light')
type NavItem = { key: string; label: string; url: string; icon: string }
const plan = computed(() => ws.plans.value.find((item: any) => item.id === (user.value?.plan || 'free')) as any)
// Every plan keeps the same number of saved workflows. The menu still reads it
// from the plan, so a cap set to zero hides a page that could save nothing.
const hasWorkflows = computed(() => Number(plan.value?.limits?.saved_workflows || 0) > 0)
const workNav = computed<NavItem[]>(() => [
  { key: 'home', label: 'navHome', url: '/app', icon: 'home' },
  ...(studio.config.value ? [{ key: 'create', label: 'navCreate', url: '/app/create', icon: 'sparkle' }] : []),
  { key: 'tools', label: 'navTools', url: '/app/tools', icon: 'tools' },
  ...(studio.config.value ? [{ key: 'editor', label: 'editor', url: '/app/editor', icon: 'edit' }] : []),
  { key: 'tasks', label: 'navTasks', url: '/app/jobs', icon: 'tasks' },
  ...(studio.config.value && hasWorkflows.value
    ? [{ key: 'workflows', label: 'workflows', url: '/app/workflows', icon: 'reorder' }]
    : []),
])
const accountNav = computed<NavItem[]>(() => [
  { key: 'billing', label: 'navBilling', url: '/app/billing', icon: 'billing' },
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
const moreActive = computed(() => moreNav.value.some((item) => current(item.url)))
watch(user, (value) => {
  if (value) studio.load()
  else studio.config.value = null
})
const title = computed(() => {
  const item = [...workNav.value, ...accountNav.value]
    .sort((a, b) => b.url.length - a.url.length)
    .find((entry) => current(entry.url))
  if (item) return t(item.label)
  if (route.path.includes('/referrals')) return t('referrals')
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
    localStorage.setItem('pdf-master-theme', next)
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
  const telegram = (window as any).Telegram?.WebApp
  if (!telegram?.initData || user.value || miniAppBusy.value) return
  miniAppError.value = ''
  miniAppBusy.value = true
  try {
    await auth.startRequest('/auth/telegram/miniapp', { init_data: telegram.initData })
    await auth.refreshAccount()
    telegram.ready()
    telegram.expand()
  } catch (error) {
    miniAppError.value = auth.errorMessage(error)
  } finally {
    miniAppBusy.value = false
  }
}
onMounted(async () => {
  let saved = ''
  try {
    saved = localStorage.getItem('pdf-master-theme') || ''
  } catch {}
  // Inside Telegram, a customer who never chose a theme gets Telegram's own.
  applyTheme(saved || (window as any).Telegram?.WebApp?.colorScheme || 'light')
  // Settings changes the theme too; the toggle follows whatever is on screen.
  new MutationObserver(() => {
    theme.value = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  await ws.init()
  if (user.value && user.value.locale !== locale.value) {
    try {
      await ws.updateProfile({ locale: locale.value })
    } catch {}
  }
  ws.restoreDraft()
  const telegram = (window as any).Telegram?.WebApp
  if (telegram) {
    telegram.ready()
    telegram.expand()
  }
  if (telegram?.initData && !user.value) await signInMiniApp()
  await Promise.allSettled([ws.loadCatalog(), ws.loadPlans(), ws.loadAccount(), studio.load()])
  if (user.value) {
    try {
      const pending = JSON.parse(sessionStorage.getItem('pdf-master-pending-job') || 'null')
      if (pending) {
        const job = await ws.api('/jobs', {
          method: 'POST',
          headers: { 'Idempotency-Key': pending.key },
          body: { quote_id: pending.quote_id },
        })
        sessionStorage.removeItem('pdf-master-pending-job')
        await navigateTo(path(`/app/jobs/${job.id}`))
      }
    } catch (e: any) {
      if (e.statusCode && e.statusCode < 500) sessionStorage.removeItem('pdf-master-pending-job')
    }
  }
})
watch(
  locale,
  () => {
    document.documentElement.lang = locale.value
  },
  { immediate: import.meta.client },
)
</script>
<template>
  <a class="skip-link" href="#main-content">{{ t('skipToContent') }}</a>
  <div :class="framed ? 'app-shell' : 'public-shell'">
    <aside v-if="framed" class="sidebar">
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
            ><strong>{{ user.display_name }}</strong><small>{{ t(user.plan || 'free') }}</small></span
          ><AppIcon name="chevron" :size="16"
        /></NuxtLink>
      </div>
    </aside>
    <div class="app-body">
      <header v-if="framed" class="app-topbar">
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
      <header v-else class="public-topbar">
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
        <NuxtPage />
      </main>
      <footer v-if="!isApp" class="public-footer">
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
    <nav v-if="framed && user" class="mobile-nav" :aria-label="t('navLabel')">
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
      v-if="framed && user"
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
            ><strong>{{ user.display_name }}</strong><small>{{ t(user.plan || 'free') }}</small></span
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
