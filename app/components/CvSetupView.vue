<script setup lang="ts">
// A CV's template, chosen before paying. Opened from the bot's review as a
// Telegram Mini App; a template picked here is used as it is, and the review in
// the chat is redrawn with it. There is no count to choose: a CV is one or two
// pages, whatever its content needs in the template.
const route = useRoute()
const { t } = useLocale()
const ws = useWorkspace()
const cv = useCvTemplates()
const draftId = computed(() => String(route.query.draft || ''))
const draft = ref<any>(null)
const template = ref('auto')
const loading = ref(true)
const saving = ref(false)
const saved = ref(false)
const error = ref('')
const requestError = (e: any) => e.data?.error?.message || e.data?.message || t('genericError')
const chosenName = computed(() => cv.find(template.value)?.name || t('cvSetupAuto'))
// A portrait sent in the chat goes only on templates with a place for one.
const hasPhoto = computed(() => !!draft.value?.options?.portrait_asset_id)
const telegram = () => (import.meta.client ? (window as any).Telegram?.WebApp : null)

async function load() {
  if (!ws.user.value || !draftId.value) {
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  try {
    const [opened] = await Promise.all([ws.api(`/generation/drafts/${draftId.value}`), cv.load()])
    if (opened.feature_id !== 'ai.cv') throw { data: { message: t('cvSetupNotCv') } }
    draft.value = opened
    template.value = opened.options?.cv_template || 'auto'
    saved.value = false
  } catch (e: any) {
    const status = e.statusCode || e.status || e.response?.status
    error.value = status === 404 ? t('cvSetupExpired') : requestError(e)
  } finally {
    loading.value = false
  }
}
function choose(id: string) {
  template.value = id
  saved.value = false
}
async function save() {
  if (!draft.value || saving.value) return
  saving.value = true
  error.value = ''
  try {
    const result = await ws.api(`/generation/drafts/${draft.value.id}/setup`, {
      method: 'POST',
      body: { cv_template: template.value },
    })
    draft.value = result.draft
    saved.value = true
    // Back to the chat, where the review now names the template.
    telegram()?.HapticFeedback?.notificationOccurred?.('success')
    if (telegram()?.initData) setTimeout(() => telegram()?.close(), 700)
  } catch (e) {
    error.value = requestError(e)
  } finally {
    saving.value = false
  }
}
watch(() => ws.user.value?.id, load)
onMounted(load)
</script>

<template>
  <div class="cv-setup">
    <div class="page-heading">
      <div>
        <h1>{{ t('cvSetupTitle') }}</h1>
        <p>{{ t('cvSetupLead') }}</p>
      </div>
    </div>
    <ErrorBanner v-if="error" :message="error" />
    <div v-if="loading" class="loading-state">
      <AppIcon name="loader" class="spin" :size="28" />{{ t('loading') }}
    </div>
    <p v-else-if="!draftId" class="empty-state">{{ t('cvSetupExpired') }}</p>
    <template v-else-if="draft">
      <section class="panel cv-setup-templates" data-testid="cv-setup-templates">
        <div class="cv-setup-heading">
          <h2>{{ t('cvSetupTemplate') }}</h2>
          <p v-if="hasPhoto" class="field-hint" data-testid="cv-setup-photo">
            <AppIcon name="image" :size="16" />{{ t('cvSetupPhotoOn') }}
          </p>
        </div>
        <CvTemplatePicker
          :model-value="template"
          :categories="cv.categories.value"
          :default-id="cv.defaultId.value"
          @update:model-value="choose"
        />
      </section>

      <div class="cv-setup-actions">
        <p v-if="saved" class="success-banner" role="status" data-testid="cv-setup-saved">
          <AppIcon name="check" :size="17" />{{ t('cvSetupSaved') }}
        </p>
        <button
          class="button primary"
          type="button"
          data-testid="cv-setup-save"
          :disabled="saving"
          @click="save"
        >
          {{ t('cvSetupSave', { template: chosenName }) }}
        </button>
      </div>
    </template>
  </div>
</template>
