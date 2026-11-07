<script setup lang="ts">
// The company behind the service, which payment providers require on the site:
// its legal name, taxpayer number and address, then a phone and an email once
// they are set in the admin. Shown at the end of the Help pages.
const { t } = useLocale()
const { contacts } = useContacts()
const LABELS = {
  name: 'companyName',
  tin: 'companyTin',
  address: 'companyAddress',
  phone: 'companyPhone',
  email: 'companyEmail',
} as const
const rows = computed(() => {
  const company = contacts.value?.company
  if (!company) return []
  return (Object.keys(LABELS) as (keyof typeof LABELS)[])
    .filter((field) => company[field])
    .map((field) => ({
      field,
      label: LABELS[field],
      value: company[field],
      href:
        field === 'phone'
          ? `tel:${company.phone.replace(/[^\d+]/g, '')}`
          : field === 'email'
            ? `mailto:${company.email}`
            : '',
    }))
})
</script>
<template>
  <section v-if="rows.length" id="company" class="panel contact-card">
    <h2>{{ t('companyTitle') }}</h2>
    <dl class="company-details">
      <div v-for="row in rows" :key="row.field">
        <dt>{{ t(row.label) }}</dt>
        <dd>
          <a v-if="row.href" :href="row.href" class="text-link">{{ row.value }}</a
          ><template v-else>{{ row.value }}</template>
        </dd>
      </div>
    </dl>
  </section>
</template>
