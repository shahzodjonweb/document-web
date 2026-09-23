<script setup lang="ts">
const route = useRoute()
const { t } = useLocale()
const ws = useWorkspace()
const view = computed(() => route.path.replace(/^\/(en|uz|ru)/, '').replace(/\/$/, '') || '/')
const selectedStatus = ref('allStatuses')
const filteredJobs = computed(() =>
  ws.jobs.value.filter((j) => selectedStatus.value === 'allStatuses' || j.status === selectedStatus.value),
)
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
useHead(() => ({
  title: `${view.value === '/' ? 'A little less paperwork' : view.value.includes('/tools') ? t('tools') : view.value.includes('/jobs') ? t('tasks') : t('workspace')} · PDF Master`,
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
  /><ImageStudio v-else-if="view === '/app/images'" /><StudioView
    v-else-if="view === '/app/create' || view.startsWith('/app/create/')"
    :draft-id="view.split('/')[3]"
  /><EducationView
    v-else-if="['/app/study', '/app/school', '/app/teach'].includes(view)"
    :mode="view.split('/')[2]"
  /><ProjectsView
    v-else-if="view === '/app/projects' || view.startsWith('/app/projects/')"
    :project-id="view.split('/')[3]"
  /><TemplatesView v-else-if="view === '/app/templates'" /><WorkflowsView
    v-else-if="view === '/app/workflows'"
  /><EditorView
    v-else-if="view === '/app/editor' || view.startsWith('/app/editor/')"
    :document-id="view.split('/')[3]"
  /><ReferralsView v-else-if="view === '/app/referrals'" /><BotView
    v-else-if="view === '/app/bot'"
  /><ToolsView v-else-if="view === '/app/tools' || view === '/tools'" /><PublicToolView
    v-else-if="view.startsWith('/tools/')"
    :tool-id="decodeURIComponent(view.slice('/tools/'.length))"
  /><JobDetail v-else-if="view.startsWith('/app/jobs/')" :job-id="view.slice('/app/jobs/'.length)" />
  <div v-else-if="view === '/app/jobs'">
    <div class="page-heading">
      <div>
        <h1>{{ t('tasks') }}</h1>
        <p>{{ t('historySub') }}</p>
      </div>
      <button class="button secondary" @click="ws.loadAccount">
        <AppIcon name="rotate" :size="16" />{{ t('refresh') }}
      </button>
    </div>
    <div class="history-toolbar">
      <label class="form-field"
        ><select v-model="selectedStatus" :aria-label="t('status')">
          <option
            v-for="status in ['allStatuses', 'succeeded', 'queued', 'running', 'failed', 'no_op']"
            :key="status"
            :value="status"
          >
            {{ t(status) }}
          </option>
        </select></label
      >
    </div>
    <section class="panel"><JobList :jobs="filteredJobs" /></section>
  </div>
  <BillingView v-else-if="view === '/app/billing' || view === '/pricing'" /><SettingsView
    v-else-if="view === '/app/settings'"
  /><SupportView v-else-if="view === '/app/support'" /><HelpView
    v-else-if="view.startsWith('/help')"
  /><HelpView v-else-if="view.startsWith('/legal/')" :legal="view.slice('/legal/'.length)" /><LandingView
    v-else
  />
</template>
