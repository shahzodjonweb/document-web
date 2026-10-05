<script setup lang="ts">
const { t, localePath } = useLocale()
const ws = useWorkspace()
const saving = ref(false)
const error = ref('')
const saved = ref(false)
const form = reactive({
  output_locale: String(ws.user.value?.preferences?.output_locale || ws.user.value?.locale || 'en'),
  paper_size: String(ws.user.value?.preferences?.paper_size || 'A4'),
  locale: ws.user.value?.locale || 'en',
  mode: ws.user.value?.mode || 'general',
  adult_assistance: !!ws.user.value?.preferences?.adult_assistance,
  time_zone: ws.user.value?.time_zone || Intl.DateTimeFormat().resolvedOptions().timeZone,
  theme: import.meta.client ? localStorage.getItem('pdf-master-theme') || 'light' : 'light',
})
async function save() {
  saving.value = true
  error.value = ''
  saved.value = false
  try {
    const account = await ws.api('/me', {
      method: 'PATCH',
      body: {
        locale: form.locale,
        mode: form.mode,
        time_zone: form.time_zone,
        preferences: {
          ...ws.user.value?.preferences,
          theme: form.theme,
          output_locale: form.output_locale,
          paper_size: form.paper_size,
          adult_assistance: form.adult_assistance,
        },
      },
    })
    ws.user.value = account.user || account
    localStorage.setItem('pdf-master-theme', form.theme)
    document.documentElement.dataset.theme =
      form.theme === 'system'
        ? matchMedia('(prefers-color-scheme:dark)').matches
          ? 'dark'
          : 'light'
        : form.theme
    saved.value = true
    await navigateTo(localePath(form.locale))
  } catch (e: any) {
    error.value = e.data?.error?.message || t('genericError')
  } finally {
    saving.value = false
  }
}
</script>
<template>
  <div class="settings-page">
    <div class="page-heading">
      <div>
        <h1>{{ t('settings') }}</h1>
        <p>{{ t('settingsLead') }}</p>
      </div>
    </div>
    <section class="panel profile-panel">
      <span class="avatar large-avatar" aria-hidden="true">{{
        (ws.user.value?.display_name || 'P').slice(0, 1).toUpperCase()
      }}</span>
      <div class="profile-copy">
        <h2>{{ ws.user.value?.display_name }}</h2>
        <p>
          <span class="status-badge succeeded">{{ t(ws.user.value?.plan || 'free') }}</span>
          <span class="muted">{{
            ws.user.value?.is_test
              ? t('testAccount')
              : ws.user.value?.email ||
                ws.user.value?.google_email ||
                ws.user.value?.telegram_user_id ||
                ws.user.value?.telegram_id ||
                '—'
          }}</span>
        </p>
      </div>
      <button class="button secondary small" type="button" @click="ws.logout">
        <AppIcon name="logout" :size="16" />{{ t('logout') }}
      </button>
    </section>
    <form class="panel preferences-panel" @submit.prevent="save">
      <ErrorBanner v-if="error" :message="error" />
      <div v-if="saved" class="success-banner" role="status">
        <AppIcon name="check" :size="17" />{{ t('saved') }}
      </div>
      <fieldset class="settings-group">
        <legend>{{ t('sectionLanguage') }}</legend>
        <div class="settings-fields">
          <label class="form-field"
            ><span>{{ t('interfaceLanguage') }}</span
            ><select v-model="form.locale">
              <option value="en">English</option>
              <option value="uz">O‘zbekcha</option>
              <option value="ru">Русский</option>
            </select></label
          ><label class="form-field"
            ><span>{{ t('timezone') }}</span
            ><input v-model="form.time_zone" :aria-label="t('timezone')" list="timezones" required /><datalist
              id="timezones"
            >
              <option>Asia/Tashkent</option>
              <option>UTC</option>
              <option>Europe/Moscow</option>
              <option>Europe/London</option>
              <option>America/New_York</option>
            </datalist></label
          >
        </div>
      </fieldset>
      <fieldset class="settings-group">
        <legend>{{ t('sectionDocuments') }}</legend>
        <div class="settings-fields">
          <label class="form-field"
            ><span>{{ t('documentLanguage') }}</span
            ><select v-model="form.output_locale">
              <option value="en">English</option>
              <option value="uz">O‘zbekcha</option>
              <option value="ru">Русский</option>
            </select></label
          ><label class="form-field"
            ><span>{{ t('paperSize') }}</span
            ><select v-model="form.paper_size">
              <option>A4</option>
              <option>Letter</option>
            </select></label
          >
        </div>
      </fieldset>
      <fieldset class="settings-group">
        <legend>{{ t('sectionWorkspace') }}</legend>
        <div class="settings-fields">
          <label class="form-field"
            ><span>{{ t('workspaceMode') }}</span
            ><select v-model="form.mode">
              <option v-for="mode in ['general', 'student', 'school', 'teacher']" :key="mode" :value="mode">
                {{ t(mode) }}
              </option>
            </select></label
          >
        </div>
        <label v-if="form.mode === 'school'" class="check-label"
          ><input v-model="form.adult_assistance" type="checkbox" /><span>{{
            t('adultAssistance')
          }}</span></label
        >
      </fieldset>
      <fieldset class="settings-group theme-selector">
        <legend>{{ t('theme') }}</legend>
        <div class="theme-options">
          <label
            v-for="item in ['light', 'dark', 'system']"
            :key="item"
            :class="{ selected: form.theme === item }"
            ><input v-model="form.theme" type="radio" name="theme" :value="item" /><AppIcon
              :name="item === 'dark' ? 'moon' : 'sun'"
              :size="18"
            />{{ t(item) }}</label
          >
        </div>
      </fieldset>
      <div class="settings-actions">
        <button class="button primary" :disabled="saving">
          {{ saving ? t('working') : t('saveChanges') }}<AppIcon name="check" :size="17" />
        </button>
      </div>
    </form>
    <AccountSignInSettings />
  </div>
</template>
