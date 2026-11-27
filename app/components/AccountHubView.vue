<script setup lang="ts">
/**
 * Profile: the Mini App's third place, the bot's My account, Plans, Invite friends,
 * Language and Contacts in one list (docs/design/MINI_APP.md). In a browser the same
 * screen answers /app/account, though the menus there lead to each page directly.
 */
const { t, path, date, timeZone, locale, localePath } = useLocale()
const ws = useWorkspace()
const studio = useStudio()
const telegram = useTelegramApp()
const user = ws.user
const initial = computed(() => (user.value?.display_name || 'D').trim().slice(0, 1).toUpperCase())
const plan = computed(() => ws.plans.value.find((item: any) => item.id === (user.value?.plan || 'free')) as any)
const resetsAt = computed(() => ws.usage.value?.week?.resets_at ?? ws.usage.value?.resets_at)
const hasWorkflows = computed(() => !!studio.config.value && Number(plan.value?.limits?.saved_workflows || 0) > 0)
type Row = { key: string; label: string; hint?: string; url: string; icon: string }
const accountRows = computed<Row[]>(() => [
  { key: 'referrals', label: 'referrals', hint: 'profileInviteHint', url: '/app/referrals', icon: 'gift' },
  { key: 'settings', label: 'settings', hint: 'profileSettingsHint', url: '/app/settings', icon: 'settings' },
])
const moreRows = computed<Row[]>(() => [
  ...(studio.config.value
    ? [{ key: 'editor', label: 'editor', hint: 'profileEditorHint', url: '/app/editor', icon: 'edit' }]
    : []),
  ...(hasWorkflows.value ? [{ key: 'workflows', label: 'workflows', url: '/app/workflows', icon: 'reorder' }] : []),
  ...(studio.config.value ? [{ key: 'guide', label: 'guide', hint: 'profileGuideHint', url: '/app/guide', icon: 'book' }] : []),
  { key: 'support', label: 'profileSupport', hint: 'profileSupportHint', url: '/app/support', icon: 'help' },
])
const languages = [
  { id: 'uz', label: 'O‘zbekcha' },
  { id: 'ru', label: 'Русский' },
  { id: 'en', label: 'English' },
]
const saving = ref(false)
async function changeLanguage(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (value === locale.value) return
  saving.value = true
  telegram.haptic('selection')
  try {
    await ws.updateProfile({ locale: value })
  } catch {
    // The page still changes language; the account follows the next time it is saved.
  } finally {
    saving.value = false
  }
  await navigateTo(localePath(value).split('#')[0]!, { replace: true })
}
async function signOut() {
  await ws.logout()
  await navigateTo(path('/app'))
}
</script>
<template>
  <div class="profile-page">
    <section class="profile-card panel">
      <div class="profile-who">
        <span class="avatar profile-avatar" aria-hidden="true">{{ initial }}</span>
        <div>
          <h1>{{ user?.display_name }}</h1>
          <p>
            <span class="profile-plan">{{ t(user?.plan || 'free') }}</span>
          </p>
        </div>
      </div>
      <WeeklyUsage />
      <p v-if="resetsAt" class="week-reset">{{ t('weekResets') }} {{ date(resetsAt, true) }} · {{ timeZone }}</p>
      <NuxtLink :to="path('/app/billing')" class="button primary full" data-testid="profile-plans"
        ><AppIcon name="billing" :size="18" />{{ t('profileSeePlans') }}</NuxtLink
      >
    </section>
    <section class="tg-section" :aria-label="t('account')">
      <h2 class="tg-section-head">{{ t('account') }}</h2>
      <nav class="tg-list">
        <NuxtLink v-for="row in accountRows" :key="row.key" :to="path(row.url)" class="tg-cell"
          ><span class="tg-cell-icon" :data-tone="row.key"><AppIcon :name="row.icon" :size="19" /></span
          ><span class="tg-cell-text"
            ><strong>{{ t(row.label) }}</strong><small v-if="row.hint">{{ t(row.hint) }}</small></span
          ><AppIcon class="tg-cell-chevron" name="chevron" :size="16"
        /></NuxtLink>
        <label class="tg-cell tg-cell-select"
          ><span class="tg-cell-icon" data-tone="language"><AppIcon name="globe" :size="19" /></span
          ><span class="tg-cell-text"><strong>{{ t('language') }}</strong></span
          ><select :value="locale" :disabled="saving" :aria-label="t('language')" @change="changeLanguage">
            <option v-for="item in languages" :key="item.id" :value="item.id">{{ item.label }}</option>
          </select></label
        >
      </nav>
    </section>
    <section class="tg-section" :aria-label="t('profileMore')">
      <h2 class="tg-section-head">{{ t('profileMore') }}</h2>
      <nav class="tg-list">
        <NuxtLink v-for="row in moreRows" :key="row.key" :to="path(row.url)" class="tg-cell"
          ><span class="tg-cell-icon" :data-tone="row.key"><AppIcon :name="row.icon" :size="19" /></span
          ><span class="tg-cell-text"
            ><strong>{{ t(row.label) }}</strong><small v-if="row.hint">{{ t(row.hint) }}</small></span
          ><AppIcon class="tg-cell-chevron" name="chevron" :size="16"
        /></NuxtLink>
      </nav>
    </section>
    <!-- Inside Telegram the account is the Telegram one: there is nothing to sign out of. -->
    <button v-if="!telegram.isMiniApp.value" class="button quiet profile-signout" type="button" @click="signOut">
      <AppIcon name="logout" :size="16" />{{ t('logout') }}
    </button>
  </div>
</template>
