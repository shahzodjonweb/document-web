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
  <ErrorBanner v-if="ws.apiError.value || error" :message="error"
    ><button class="text-link" @click="retry">{{ t('retry') }}</button></ErrorBanner
  >
  <div v-if="isCustomer && !ws.sessionReady.value" class="loading-state">
    <AppIcon name="loader" class="spin" :size="28" />{{ t('loading') }}
  </div>
  <AuthPanel v-else-if="(isCustomer && !ws.user.value) || view === '/auth/telegram'" /><DashboardView
    v-else-if="view === '/app'"
  /><ToolWorkspace
    v-else-if="view.startsWith('/app/tools/')"
    :tool-id="decodeURIComponent(view.slice('/app/tools/'.length))"
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
