<script setup lang="ts">
const { count } = useLocale()
import { faq as allFaq } from '../../../content/site/faq'
// The help centre (docs/site/design/pages/help.md): every help question grouped
// by topic, a search that narrows them, and the ways to reach a person.
// The server renders every question (and, for ?q=, the filtered list), so the
// page works without JavaScript; in the browser the search filters as you type.
definePageMeta({ layout: 'site' })
const { t, st, path, faq } = useSite()
const { contacts } = contactsState()
const route = useRoute()

const TOPICS = [
  ['tools', 'Tools', 'tools'],
  ['editor', 'Editor', 'edit'],
  ['ai', 'Ai', 'sparkle'],
  ['plans', 'Plans', 'billing'],
  ['invite', 'Invite', 'gift'],
  ['telegram', 'Telegram', 'send'],
  ['account', 'Account', 'user'],
  ['files', 'Files', 'shield'],
] as const
const GROUP = new Map(allFaq.map((item) => [item.id, item.group]))
const life = [
  ['upload', 1],
  ['download', 2],
  ['trash', 3],
] as const

const query = ref(String(route.query.q ?? ''))
// Folds case, accents and the Uzbek apostrophes so "o'chirish" finds "o‘chirish".
const fold = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’ʼʻ`'´]/g, '')
// "1 000" and "20 MB" never break across lines.
const glue = (text: string) => text.replace(/(\d) (?=\d{3}\b|MB|GB|KB|МБ|ГБ)/g, '$1\u00a0')
const items = computed(() =>
  faq('help').map((item) => ({ ...item, a: glue(item.a), group: GROUP.get(item.id) || '', text: fold(`${item.q} ${item.a}`) })),
)
const words = computed(() => fold(query.value).split(/\s+/).filter(Boolean))
const matches = computed(() => items.value.filter((item) => words.value.every((word) => item.text.includes(word))))
const topics = computed(() =>
  TOPICS.map(([id, key, icon]) => ({
    id,
    icon,
    title: t(`siteHelpTopic${key}`),
    all: items.value.filter((item) => item.group === id),
    shown: matches.value.filter((item) => item.group === id),
  })).filter((topic) => topic.all.length),
)
const searching = computed(() => words.value.length > 0)
const support = computed(() => contacts.value?.support ?? null)
const company = computed(() => contacts.value?.company ?? null)
const hours = computed(() => st('siteHelpHours'))

// A link to one question opens it.
const opened = ref('')
// The topic list marks the topic being read.
const current = ref('')
let spy: IntersectionObserver | null = null
onMounted(() => {
  const hash = decodeURIComponent(location.hash.slice(1))
  if (hash.startsWith('q-')) opened.value = hash
  spy = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) if (entry.isIntersecting) current.value = entry.target.id
    },
    { rootMargin: '-30% 0px -60% 0px' },
  )
  watchEffect(() => {
    if (!spy) return
    spy.disconnect()
    for (const topic of topics.value) if (topic.shown.length) {
      const el = document.getElementById(`topic-${topic.id}`)
      if (el) spy.observe(el)
    }
  }, { flush: 'post' })
})
onBeforeUnmount(() => spy?.disconnect())
function submit(event: Event) {
  // In the browser the list is already filtered; without JavaScript the form reloads with ?q=.
  event.preventDefault()
}

useHead(() => ({
  script: [
    {
      key: 'ld-faq',
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: items.value.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      }),
    },
  ],
}))
</script>
<template>
  <div class="site-help">
    <SiteBreadcrumb />
    <section class="site-hero site-help-hero">
      <div class="site-container">
        <div class="site-help-head">
          <h1 class="site-h1">{{ t('siteHelpTitle') }}</h1>
          <p class="site-lead">{{ t('siteHelpLead') }}</p>
        </div>
        <form class="site-help-search" role="search" method="get" @submit="submit">
          <label for="help-q" class="site-visually-hidden">{{ t('siteHelpSearch') }}</label>
          <AppIcon name="search" class="site-icon" />
          <input
            id="help-q"
            v-model="query"
            name="q"
            type="search"
            autocomplete="off"
            enterkeyhint="search"
            :placeholder="t('siteHelpSearch')"
          />
        </form>
        <p class="site-help-count" aria-live="polite">
          <template v-if="searching">{{ t('siteHelpResultCount', { count: matches.length }) }}</template>
        </p>
      </div>
    </section>

    <nav v-if="!searching" class="site-section site-help-topics-wrap" :aria-label="t('siteFooterHelpCentre')">
      <div class="site-container">
        <ul class="site-help-topics">
          <li v-for="topic in topics" :key="topic.id">
            <a :href="`#topic-${topic.id}`" class="site-help-topic"
              ><span class="site-tool-ico"><AppIcon :name="topic.icon" class="site-icon" /></span
              ><b>{{ topic.title }}</b
              ><span class="site-help-n">{{ count('siteHelpTopicCount', topic.all.length) }}</span></a
            >
          </li>
        </ul>
      </div>
    </nav>

    <div class="site-section site-help-body">
      <div :class="['site-container site-help-grid', { 'is-empty': !matches.length }]">
        <div v-if="matches.length" class="site-toc site-help-toc">
          <ol>
            <template v-for="topic in topics" :key="topic.id">
              <li v-if="topic.shown.length">
                <a :href="`#topic-${topic.id}`" :aria-current="current === `topic-${topic.id}` ? 'true' : undefined"
                  >{{ topic.title }}<span v-if="searching" class="site-help-n">{{ topic.shown.length }}</span></a
                >
              </li>
            </template>
          </ol>
        </div>
        <div class="site-help-list">
          <p v-if="searching && !matches.length" class="site-note">
            <AppIcon name="info" class="site-icon" />
            <span
              >{{ t('siteHelpEmpty', { query }) }}
              <a v-if="support?.url" class="site-link" :href="support.url" target="_blank" rel="noopener">@{{ support.username }}</a></span
            >
          </p>
          <template v-for="topic in topics" :key="topic.id">
            <section v-if="topic.shown.length" :id="`topic-${topic.id}`" class="site-help-group" :aria-labelledby="`topic-${topic.id}-title`">
              <h2 :id="`topic-${topic.id}-title`" class="site-h3 site-help-group-title">
                <span class="site-tool-ico" aria-hidden="true"><AppIcon :name="topic.icon" class="site-icon" /></span>{{ topic.title }}
              </h2>
              <ol v-if="topic.id === 'files' && !searching" class="site-life site-help-life">
                <li v-for="[icon, n] in life" :key="n">
                  <span class="site-life-dot"><AppIcon :name="icon" class="site-icon is-sm" /></span>
                  <b>{{ t(`siteLifecycle${n}Title`) }}</b>
                  <span class="site-life-time">{{ t(`siteLifecycle${n}Time`) }}</span>
                </li>
              </ol>
              <div class="site-faq">
                <details v-for="item in topic.shown" :id="`q-${item.id}`" :key="item.id" :open="searching || topic.all.length === 1 || opened === `q-${item.id}` || undefined">
                  <summary>{{ item.q }}<AppIcon name="plus" class="site-icon" /></summary>
                  <div><p>{{ item.a }}</p></div>
                </details>
              </div>
            </section>
          </template>
        </div>
      </div>
    </div>

    <section class="site-section is-band" aria-labelledby="help-contact">
      <div class="site-container site-help-contact">
        <div class="site-help-contact-head">
          <SiteSectionHead id="help-contact" :title="t('siteHelpContactTitle')" :intro="t('siteHelpContactLine')" />
          <p v-if="hours" class="site-help-hours"><AppIcon name="clock" class="site-icon is-sm" />{{ hours }}</p>
        </div>
        <ul class="site-help-contacts">
          <li v-if="support?.url">
            <a :href="support.url" target="_blank" rel="noopener"
              ><span class="site-tool-ico"><AppIcon name="send" class="site-icon" /></span
              ><span><b>{{ t('siteContactTelegram') }}</b><small>@{{ support.username }}</small><small>{{ t('siteContactTelegramHint') }}</small></span
              ><AppIcon name="external" class="site-icon is-sm" /></a
            >
          </li>
          <li>
            <NuxtLink :to="path('/app/support')"
              ><span class="site-tool-ico"><AppIcon name="help" class="site-icon" /></span
              ><span><b>{{ t('siteContactInApp') }}</b><small>{{ t('siteContactInAppHint') }}</small></span
              ><AppIcon name="chevron" class="site-icon is-sm" /></NuxtLink
            >
          </li>
          <li v-if="company?.email">
            <a :href="`mailto:${company.email}`"
              ><span class="site-tool-ico"><AppIcon name="mail" class="site-icon" /></span
              ><span><b>{{ t('siteContactEmail') }}</b><small>{{ company.email }}</small><small>{{ t('siteContactEmailHint') }}</small></span
              ><AppIcon name="chevron" class="site-icon is-sm" /></a
            >
          </li>
          <li v-if="company?.phone">
            <a :href="`tel:${company.phone.replace(/[^+\d]/g, '')}`"
              ><span class="site-tool-ico"><AppIcon name="phone" class="site-icon" /></span
              ><span><b>{{ t('siteContactPhone') }}</b><small>{{ company.phone }}</small><small>{{ t('siteContactPhoneHint') }}</small></span
              ><AppIcon name="chevron" class="site-icon is-sm" /></a
            >
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>
