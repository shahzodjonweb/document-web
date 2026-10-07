<script setup lang="ts">
// Where to reach a person: the support and the advertising Telegram accounts,
// as set in the admin. Public, so it works on the signed-out Help page too.
type Contact = { username: string; url: string }
const { t } = useLocale()
const contacts = ref<{ support: Contact; ads: Contact } | null>(null)
const loaded = ref(false)
onMounted(async () => {
  try {
    // A plain string: Nuxt's typed routes otherwise expand every server route here.
    const url: string = '/api/v1/contacts'
    contacts.value = await $fetch<{ support: Contact; ads: Contact }>(url)
  } catch {
    contacts.value = null
  } finally {
    loaded.value = true
  }
})
const people = computed(() =>
  (['support', 'ads'] as const)
    .filter((kind) => contacts.value?.[kind]?.username)
    .map((kind) => ({ kind, ...contacts.value![kind] })),
)
</script>
<template>
  <section class="panel contact-card">
    <h2>{{ t('contactsTitle') }}</h2>
    <p class="field-hint">{{ t('contactsLead') }}</p>
    <div v-if="people.length" class="contact-list">
      <a
        v-for="person in people"
        :key="person.kind"
        :href="person.url"
        target="_blank"
        rel="noopener"
        class="contact-row"
        ><span class="tool-icon"
          ><AppIcon :name="person.kind === 'support' ? 'help' : 'send'" :size="20" /></span
        ><span class="contact-copy"
          ><strong>{{ t(person.kind === 'support' ? 'supportAccount' : 'adsAccount') }}</strong
          ><small>@{{ person.username }}</small></span
        ><span class="button secondary small"
          >{{ t('writeOnTelegram') }}<AppIcon name="external" :size="15" /></span
      ></a>
    </div>
    <p v-else-if="loaded" class="muted">{{ t('contactsNone') }}</p>
  </section>
</template>
