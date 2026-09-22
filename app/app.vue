<script setup lang="ts">
const route = useRoute()
const { t, path, locale, localePath } = useLocale()
const ws = useWorkspace()
const { user, sessionReady, apiError } = ws
const isApp = computed(() => route.path.includes('/app'))
const theme = ref('light')
const nav = [
  { key: 'home', url: '/app', icon: 'home' },
  { key: 'tools', url: '/app/tools', icon: 'tools' },
  { key: 'tasks', url: '/app/jobs', icon: 'tasks' },
]
const current = (url: string) =>
  url === '/app' ? route.path === path(url) : route.path.startsWith(path(url))
const crumb = computed(() =>
  route.path.includes('/tools')
    ? t('tools')
    : route.path.includes('/jobs')
      ? t('tasks')
      : route.path.includes('/billing')
        ? t('billing')
        : route.path.includes('/settings')
          ? t('settings')
          : route.path.includes('/support')
            ? t('support')
            : t('home'),
)
async function changeLocale(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (user.value) {
    try {
      user.value = await ws.api('/me', { method: 'PATCH', body: { locale: value } })
    } catch {}
  }
  await navigateTo(localePath(value))
}
onMounted(async () => {
  const saved = localStorage.getItem('pdf-master-theme') || 'light'
  theme.value = saved
  document.documentElement.dataset.theme =
    saved === 'system' ? (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light') : saved
  await ws.init()
  if (user.value && user.value.locale !== locale.value) {
    try {
      user.value = await ws.api('/me', { method: 'PATCH', body: { locale: locale.value } })
    } catch {}
  }
  ws.restoreDraft()
  const telegram = (window as any).Telegram?.WebApp
  if (telegram) {
    telegram.ready()
    telegram.expand()
  }
  if (telegram?.initData && !user.value) {
    try {
      await ws.api('/auth/telegram/miniapp', { method: 'POST', body: { init_data: telegram.initData } })
      await ws.init()
      telegram.ready()
      telegram.expand()
    } catch {
      apiError.value = true
    }
  }
  await Promise.allSettled([ws.loadCatalog(), ws.loadPlans(), ws.loadAccount()])
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
  <a class="skip-link" href="#main-content">{{ t('start') }}</a>
  <div :class="isApp ? 'app-shell' : 'public-shell'">
    <aside v-if="isApp" class="sidebar">
      <NuxtLink :to="path('/app')" class="brand"
        ><span class="brand-icon"><AppIcon name="file" :size="23" /></span
        ><span
          >PDF <b>Master</b><small>{{ t('workspace') }}</small></span
        ></NuxtLink
      >
      <div class="workspace-picker">
        <span class="workspace-avatar"><AppIcon name="folder" :size="17" /></span
        ><span>{{ t('general') }}</span>
      </div>
      <nav class="main-nav" aria-label="Workspace">
        <NuxtLink
          v-for="item in nav"
          :key="item.key"
          :to="path(item.url)"
          :class="{ active: current(item.url) }"
          :aria-current="current(item.url) ? 'page' : undefined"
          ><AppIcon :name="item.icon" :size="20" /><span>{{ t(item.key) }}</span
          ><span v-if="item.key === 'tools'" class="nav-count">{{
            ws.features.value.length || '—'
          }}</span></NuxtLink
        >
      </nav>
      <div class="sidebar-bottom">
        <div class="sidebar-note">
          <span class="small-leaf"><AppIcon name="shield" :size="21" /></span
          ><strong>{{ t('privateTitle') }}</strong>
          <p>{{ t('retention') }}</p>
          <NuxtLink :to="path('/help/privacy')"
            >{{ t('learnMore') }} <AppIcon name="arrow" :size="14"
          /></NuxtLink>
        </div>
        <nav class="secondary-nav">
          <NuxtLink :to="path('/app/billing')" :class="{ active: current('/app/billing') }"
            ><AppIcon name="billing" :size="19" />{{ t('billing') }}</NuxtLink
          ><NuxtLink :to="path('/app/settings')" :class="{ active: current('/app/settings') }"
            ><AppIcon name="settings" :size="19" />{{ t('settings') }}</NuxtLink
          ><NuxtLink :to="path('/app/support')" :class="{ active: current('/app/support') }"
            ><AppIcon name="help" :size="19" />{{ t('support') }}</NuxtLink
          >
        </nav>
        <div v-if="user" class="sidebar-profile">
          <span class="avatar">{{ (user.display_name || 'P').slice(0, 1).toUpperCase() }}</span
          ><span
            ><strong>{{ user.display_name }}</strong
            ><small>{{ t(user.plan || 'free') }} · {{ t('account') }}</small></span
          ><NuxtLink :to="path('/app/settings')" :aria-label="t('settings')"
            ><AppIcon name="chevron" :size="16"
          /></NuxtLink>
        </div>
        <div v-else class="sidebar-profile">
          <span class="avatar"><AppIcon name="file" :size="17" /></span
          ><span
            ><strong>PDF Master</strong><small>{{ t('secureNote') }}</small></span
          >
        </div>
      </div>
    </aside>
    <div class="app-body">
      <header :class="isApp ? 'app-topbar' : 'public-topbar'">
        <div v-if="isApp" class="breadcrumb">
          <span>PDF Master</span><AppIcon name="chevron" :size="13" /><strong>{{ crumb }}</strong>
        </div>
        <NuxtLink v-else :to="path()" class="brand"
          ><span class="brand-icon"><AppIcon name="file" :size="22" /></span
          ><span>PDF <b>Master</b></span></NuxtLink
        >
        <NuxtLink v-if="isApp" :to="path('/app')" class="mobile-brand brand"
          ><span class="brand-icon"><AppIcon name="file" :size="21" /></span
          ><span>PDF <b>Master</b></span></NuxtLink
        >
        <nav v-if="!isApp" class="public-nav">
          <NuxtLink :to="path('/tools')">{{ t('tools') }}</NuxtLink
          ><NuxtLink :to="path('/pricing')">{{ t('pricing') }}</NuxtLink
          ><NuxtLink :to="path('/help')">{{ t('help') }}</NuxtLink>
        </nav>
        <div class="header-actions">
          <span v-if="isApp && user" class="plan-chip"><span />{{ t(user.plan || 'free') }}</span
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
          ><NuxtLink v-if="!isApp" :to="path('/app')" class="button primary small public-start"
            >{{ t('start') }}<AppIcon name="right" :size="15"
          /></NuxtLink>
        </div>
      </header>
      <main id="main-content" :class="isApp ? 'main-content' : 'public-content'"><NuxtPage /></main>
      <footer v-if="!isApp" class="public-footer">
        <div>
          <strong>PDF Master</strong>
          <p>{{ t('footerNote') }}</p>
        </div>
        <nav>
          <NuxtLink :to="path('/legal/privacy')">{{ t('privacy') }}</NuxtLink
          ><NuxtLink :to="path('/legal/terms')">{{ t('terms') }}</NuxtLink
          ><NuxtLink :to="path('/help')">{{ t('help') }}</NuxtLink>
        </nav>
      </footer>
    </div>
    <nav v-if="isApp" class="mobile-nav">
      <NuxtLink
        v-for="item in [...nav, { key: 'account', url: '/app/settings', icon: 'settings' }]"
        :key="item.key"
        :to="path(item.url)"
        :class="{ active: current(item.url) }"
        ><AppIcon :name="item.icon" :size="20" /><span>{{ t(item.key) }}</span></NuxtLink
      >
    </nav>
  </div>
</template>
