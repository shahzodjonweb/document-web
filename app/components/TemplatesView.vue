<script setup lang="ts">
const { t, path, locale } = useLocale()
const ws = useWorkspace()
const items = ref<any[]>([])
const published = ref<any[]>([])
const error = ref('')
const busy = ref(false)
const selected = ref<any>(null)
const form = reactive({ name: '', instructions: '', output_locale: locale.value })
const limit = ref<number | null>(null)
const presetNames: Record<string, string> = {
  clean: 'presetClean',
  classroom: 'presetClassroom',
  presentation: 'presetPresentation',
  executive_report: 'presetExecutive',
  compact_brief: 'presetBrief',
  study_notes: 'presetStudy',
}
const displayName = (item: any) => (presetNames[item.id] ? t(presetNames[item.id]!) : item.name)
async function load() {
  busy.value = true
  error.value = ''
  try {
    const data = await ws.api('/templates')
    items.value = data.results || []
    published.value = data.published || []
    limit.value = data.limit ?? null
  } catch (e: any) {
    error.value = e.data?.error?.message || t('genericError')
  } finally {
    busy.value = false
  }
}
onMounted(load)
function edit(item: any) {
  selected.value = item
  form.name = item.name
  form.output_locale = item.output_locale || locale.value
  form.instructions = item.content?.instructions || item.content?.body || ''
}
function reset() {
  selected.value = null
  form.name = ''
  form.instructions = ''
}
async function save() {
  busy.value = true
  error.value = ''
  try {
    await ws.api(selected.value ? `/templates/${selected.value.id}` : '/templates', {
      method: selected.value ? 'PATCH' : 'POST',
      body: {
        name: form.name,
        output_locale: form.output_locale,
        content: { ...selected.value?.content, title: form.name, instructions: form.instructions },
        ...(selected.value ? { version: selected.value.version } : {}),
      },
    })
    reset()
    await load()
  } catch (e: any) {
    error.value = e.data?.error?.message || t('genericError')
  } finally {
    busy.value = false
  }
}
async function remove(id: string) {
  try {
    await ws.api(`/templates/${id}`, { method: 'DELETE' })
    await load()
  } catch (e: any) {
    error.value = e.data?.error?.message || t('genericError')
  }
}
</script>
<template>
  <div class="page-heading">
    <div>
      <span class="eyebrow">{{ t('templates') }}</span>
      <h1>{{ t('templateTitle') }}</h1>
      <p>{{ t('templateSub') }}</p>
    </div>
    <NuxtLink :to="path('/app/create')" class="button secondary"
      ><AppIcon name="sparkle" :size="17" />{{ t('create') }}</NuxtLink
    >
  </div>
  <ErrorBanner v-if="error" :message="error" />
  <div class="library-layout">
    <div>
      <div v-if="items.length || published.length" class="template-grid">
        <section v-for="item in [...published, ...items]" :key="item.id" class="panel template-card">
          <div
            class="template-paper"
            :style="{ '--template-accent': item.style?.accent || undefined }"
            aria-hidden="true"
          >
            <span /><i /><i /><i />
            <div />
            <i /><i />
          </div>
          <h3>{{ displayName(item) }}</h3>
          <span v-if="item.eligible === false" class="template-plan-note"
            ><AppIcon name="lock" :size="12" />{{ t('billing') }}</span
          >
          <p>{{ (item.output_locale || locale).toUpperCase() }}</p>
          <div class="template-actions">
            <NuxtLink :to="path(`/app/create?template=${item.id}`)" class="text-link"
              >{{ t('useTemplate') }}<AppIcon name="right" :size="15" /></NuxtLink
            ><button
              v-if="items.some((p) => p.id === item.id)"
              class="icon-button"
              @click="edit(item)"
              :aria-label="t('edit')"
            >
              <AppIcon name="settings" :size="17" /></button
            ><button
              v-if="items.some((p) => p.id === item.id)"
              class="icon-button"
              @click="remove(item.id)"
              :aria-label="t('delete')"
            >
              <AppIcon name="trash" :size="17" />
            </button>
          </div>
        </section>
      </div>
      <div v-else class="empty-state panel">
        <AppIcon name="files" :size="29" />
        <h2>{{ busy ? t('loading') : t('emptyTemplates') }}</h2>
      </div>
    </div>
    <form class="panel library-editor" @submit.prevent="save">
      <h2>{{ t(selected ? 'edit' : 'saveTemplate') }}</h2>
      <label class="form-field"
        ><span>{{ t('templateName') }}</span
        ><input v-model="form.name" required maxlength="200" /></label
      ><label class="form-field"
        ><span>{{ t('outputLanguage') }}</span
        ><select v-model="form.output_locale">
          <option value="en">English</option>
          <option value="uz">O‘zbekcha</option>
          <option value="ru">Русский</option>
        </select></label
      ><label class="form-field"
        ><span>{{ t('templateContent') }}</span
        ><textarea v-model="form.instructions" rows="7" required maxlength="10000" /></label
      ><button class="button primary full" :disabled="busy">
        {{ busy ? t('working') : t('saveTemplate') }}</button
      ><button v-if="selected" type="button" class="text-link reset-form" @click="reset">
        {{ t('resetForm') }}</button
      ><small v-if="limit !== null" class="library-limit"
        >{{ items.length }} / {{ limit }} {{ t('templates') }}</small
      >
    </form>
  </div>
</template>
