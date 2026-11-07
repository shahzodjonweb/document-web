<script setup lang="ts">
// Where to reach a person: the support and the advertising Telegram accounts,
// as set in the admin.
const { t } = useLocale()
const { contacts, loaded } = useContacts()
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
