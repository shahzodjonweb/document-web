<script setup lang="ts">
const route = useRoute()
const { t } = useLocale()
const ws = useWorkspace()
const view = computed(() => route.path.replace(/^\/(en|uz|ru)/, '').replace(/\/$/, '') || '/')
// Statuses grouped the way people think of a task: done, still going, or not finished.
const STATUS_GROUPS: Record<string, string[] | null> = {
  statusAll: null,
  succeeded: ['succeeded', 'no_op'],
  statusInProgress: ['queued', 'running', 'finalizing'],
  statusProblems: ['failed', 'canceled', 'expired'],
}
const selectedStatus = ref('statusAll')
const filteredJobs = computed(() => {
  const group = STATUS_GROUPS[selectedStatus.value]
  return ws.jobs.value.filter((j) => !group || group.includes(j.status))
})
const error = ref('')
const authNotice = ref('')
const callbackError = ref('')
const authentication = useAuthentication()
onMounted(async () => {
  if (!route.query.auth_status && !route.query.auth_error) return
  if (route.query.auth_error)
    callbackError.value = authentication.errorMessage(String(route.query.auth_error))
  else if (route.query.auth_status === 'success') authNotice.value = t('authGoogleComplete')
  const { auth_status, auth_error, ...query } = route.query
  await navigateTo({ path: route.path, query, hash: route.hash }, { replace: true })
})
const isCustomer = computed(() => view.value.startsWith('/app'))
async function retry() {
  error.value = ''
  await ws.init()
  try {
    await Promise.all([ws.loadCatalog(), ws.loadPlans(), ws.loadAccount()])
  } catch {
    error.value = t('apiError')
  }
}
watch(
  () => route.path,
  () => {
    if (view.value === '/app/jobs' && ws.user.value)
      ws.loadAccount().catch(() => {
        error.value = t('apiError')
      })
  },
)
// The browser tab names the page, as the top bar does.
const titles: [string, string][] = [
  ['/app/create', 'navCreate'],
  ['/app/tools', 'navTools'],
  ['/tools', 'navTools'],
  ['/app/jobs', 'navTasks'],
  ['/app/editor', 'editor'],
  ['/app/billing', 'navBilling'],
  ['/pricing', 'pricing'],
  ['/app/settings', 'settings'],
  ['/app/support', 'navHelp'],
  ['/app/guide', 'guide'],
  ['/app/workflows', 'workflows'],
  ['/app/referrals', 'referrals'],
  ['/help', 'help'],
]
useHead(() => ({
  title:
    view.value === '/'
      ? `PDF Master · ${t('heroTitle')}`
      : `${t(titles.find(([prefix]) => view.value.startsWith(prefix))?.[1] || 'navHome')} · PDF Master`,
}))
</script>
<template>
  <ErrorBanner v-if="callbackError" :message="callbackError" />
  <p v-if="authNotice" class="success-banner" role="status">
    <AppIcon name="check" :size="17" />{{ authNotice }}
  </p>
  <ErrorBanner v-if="ws.apiError.value || error" :message="error"
    ><button class="text-link" @click="retry">{{ t('retry') }}</button></ErrorBanner
  >
  <div v-if="isCustomer && !ws.sessionReady.value" class="loading-state">
    <AppIcon name="loader" class="spin" :size="28" />{{ t('loading') }}
  </div>
  <AuthPanel v-else-if="(isCustomer && !ws.user.value) || view === '/auth/telegram'" /><DashboardView
    v-else-if="view === '/app'"
  /><BatchView
    v-else-if="view.startsWith('/app/tools/batch.')"
    :feature-id="view.slice('/app/tools/'.length)"
  /><ToolWorkspace
    v-else-if="view.startsWith('/app/tools/')"
    :tool-id="decodeURIComponent(view.slice('/app/tools/'.length))"
  /><StudioView
    v-else-if="view === '/app/create' || view.startsWith('/app/create/')"
    :draft-id="view.split('/')[3]"
  /><GuideView v-else-if="view === '/app/guide' || view === '/guide'" /><WorkflowsView
    v-else-if="view === '/app/workflows'"
  /><LazyEditorShell
    v-else-if="view === '/app/editor' || view.startsWith('/app/editor/')"
    :document-id="view.split('/')[3]"
  /><ReferralsView v-else-if="view === '/app/referrals'" /><BotView
    v-else-if="view === '/app/bot'"
  /><ToolsView v-else-if="view === '/app/tools' || view === '/tools'" /><PublicToolView
    v-else-if="view.startsWith('/tools/')"
    :tool-id="decodeURIComponent(view.slice('/tools/'.length))"
  /><JobDetail v-else-if="view.startsWith('/app/jobs/')" :job-id="view.slice('/app/jobs/'.length)" />
  <div v-else-if="view === '/app/jobs'" class="tasks-page">
    <div class="page-heading">
      <div>
        <h1>{{ t('navTasks') }}</h1>
        <p>{{ t('tasksLead') }}</p>
      </div>
      <button class="button secondary small" type="button" @click="ws.loadAccount">
        <AppIcon name="rotate" :size="16" />{{ t('refresh') }}
      </button>
    </div>
    <div class="category-tabs task-filter" role="group" :aria-label="t('status')">
      <button
        v-for="status in Object.keys(STATUS_GROUPS)"
        :key="status"
        type="button"
        :class="{ selected: selectedStatus === status }"
        :aria-pressed="selectedStatus === status"
        @click="selectedStatus = status"
      >
        {{ t(status) }}
      </button>
    </div>
    <section class="panel"><JobList :jobs="filteredJobs" :filtered="selectedStatus !== 'statusAll'" /></section>
  </div>
  <BillingView v-else-if="view === '/app/billing' || view === '/pricing'" /><SettingsView
    v-else-if="view === '/app/settings'"
  /><SupportView v-else-if="view === '/app/support'" /><HelpView
    v-else-if="view.startsWith('/help')"
  /><HelpView v-else-if="view.startsWith('/legal/')" :legal="view.slice('/legal/'.length)" /><LandingView
    v-else
  />
</template>
