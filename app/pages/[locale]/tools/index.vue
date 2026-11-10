<script setup lang="ts">
// The tools directory (docs/site/design/pages/tools-index.md): every tool in its group,
// a live search and group filter, the shared limits, and a pointer to the AI services.
import { toolCategoryKeys, type ToolCategory, type SiteTool } from '../../../../content/site/tools'

definePageMeta({ layout: 'site' })
const { t, path, tools, toolName, toolLine, toolPage } = useSite()
const ws = useWorkspace()
const { figure } = usePricing()

const query = ref('')
const group = ref<ToolCategory | 'all'>('all')
const categories = Object.keys(toolCategoryKeys) as ToolCategory[]

const desc = (item: SiteTool) => t(`${item.copyKeyPrefix}Desc`)
/** In the bot: owner-verified, and not withdrawn by the live catalog when it says. */
const inBot = (item: SiteTool) => {
  if (!(item.channels as readonly string[]).includes('bot')) return false
  const live = ws.features.value.find((feature) => feature.id === item.id) as { channels?: string[] } | undefined
  return !live?.channels || live.channels.includes('bot')
}
// The catalog hides what is switched off; an empty catalog means the API did not answer.
const offered = computed(() =>
  tools.filter((item) => !ws.features.value.length || ws.features.value.some((feature) => feature.id === item.id)),
)

const words = computed(() => query.value.trim().toLowerCase().split(/\s+/).filter(Boolean))
const matches = (item: SiteTool) => {
  if (!words.value.length) return true
  // The slug carries the English words ("merge", "word", "jpg") the empty state suggests in every language.
  const haystack = [toolName(item), toolLine(item), desc(item), item.slug.replaceAll('-', ' ')].join(' ').toLowerCase()
  return words.value.every((word) => haystack.includes(word))
}
const sections = computed(() =>
  categories
    .filter((category) => group.value === 'all' || group.value === category)
    .map((category) => ({
      category,
      title: t(toolCategoryKeys[category]),
      tools: offered.value.filter((item) => item.category === category && matches(item)),
    }))
    .filter((section) => section.tools.length),
)
const count = computed(() => sections.value.reduce((sum, section) => sum + section.tools.length, 0))
const filtering = computed(() => !!words.value.length || group.value !== 'all')
const reset = () => {
  query.value = ''
  group.value = 'all'
}

const freeTasks = computed(() => {
  const free = ws.plans.value.find((plan: any) => plan.id === 'free') as any
  const value = free?.limits?.weekly_file_jobs
  return typeof value === 'number' ? figure(value) : ''
})
</script>
<template>
  <div class="site-tools">
    <SiteBreadcrumb />
    <section class="site-tools-hero">
      <div class="site-container site-tools-hero-grid">
        <div class="site-tools-hero-copy">
          <h1 class="site-h1">{{ t('siteToolsHeroTitle') }}</h1>
          <p class="site-lead">{{ t('siteToolsHeroLead') }}</p>
        </div>
        <div class="site-tools-find" role="search">
          <label class="site-tools-search">
            <span class="site-visually-hidden">{{ t('siteToolsSearch') }}</span>
            <AppIcon name="search" class="site-icon" />
            <input v-model="query" type="search" :placeholder="t('siteToolsSearch')" autocomplete="off" enterkeyhint="search" />
          </label>
          <div class="site-tools-filter" role="group" :aria-label="t('siteToolsFilterLabel')">
            <button type="button" class="site-tools-tab" :aria-pressed="group === 'all'" @click="group = 'all'">
              {{ t('siteToolsFilterAll') }}
            </button>
            <button
              v-for="category in categories"
              :key="category"
              type="button"
              class="site-tools-tab"
              :aria-pressed="group === category"
              @click="group = category"
            >
              {{ t(toolCategoryKeys[category]) }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <section class="site-section site-tools-list" :aria-label="t('siteToolsHeroTitle')">
      <div class="site-container">
        <p class="site-tools-count" :class="{ 'site-visually-hidden': !filtering }" aria-live="polite">
          {{ t('siteToolsResultCount', { count }) }}
        </p>
        <div v-if="sections.length" class="site-tools-groups">
          <section v-for="section in sections" :key="section.category" class="site-toolgroup" :aria-labelledby="`tools-${section.category}`">
            <h2 :id="`tools-${section.category}`" class="site-tools-group-title">{{ section.title }}</h2>
            <ul>
              <li v-for="item in section.tools" :key="item.slug">
                <NuxtLink class="site-toollink site-tools-row" :to="toolPage(item.slug)"
                  ><span class="site-tool-ico" aria-hidden="true"><AppIcon :name="item.icon" class="site-icon" /></span
                  ><span
                    ><b>{{ toolName(item) }}</b><span>{{ desc(item) }}</span></span
                  ><span v-if="inBot(item)" class="site-tools-bot" :title="t('siteToolsBotLabel')"
                    ><AppIcon name="send" class="site-icon is-sm" /><span class="site-visually-hidden">{{ t('siteToolsBotLabel') }}</span></span
                  ><span v-else aria-hidden="true"></span
                ></NuxtLink>
              </li>
            </ul>
            <NuxtLink v-if="section.category === 'edit'" class="site-link-arrow site-tools-editor" :to="path('/pdf-editor')"
              >{{ t('siteToolEditorMoreLink') }}<AppIcon name="right" class="site-icon is-sm"
            /></NuxtLink>
          </section>
        </div>
        <div v-else class="site-tools-empty">
          <p>{{ t('siteToolsEmpty', { query: query.trim() }) }}</p>
          <button type="button" class="site-btn is-secondary" @click="reset">{{ t('siteToolsEmptyLink') }}</button>
        </div>
      </div>
    </section>

    <section class="site-section is-band" aria-labelledby="tools-limits">
      <div class="site-container">
        <SiteSectionHead id="tools-limits" :title="t('siteToolsLimitsTitle')" :to="path('/pricing')" :link="t('siteLinkComparePlans')" />
        <dl class="site-kv">
          <div>
            <dt>{{ t('siteToolLimitsWebLabel') }}</dt>
            <dd>{{ t('siteToolLimitsWebValue') }}<small>{{ t('siteToolLimitsWebNote') }}</small></dd>
          </div>
          <div>
            <dt>{{ t('siteToolLimitsBotLabel') }}</dt>
            <dd>{{ t('siteToolLimitsBotValue') }}<small>{{ t('siteToolLimitsBotNote') }}</small></dd>
          </div>
          <div v-if="freeTasks">
            <dt>{{ t('siteToolLimitsPlanLabel') }}</dt>
            <dd>{{ t('siteToolLimitsPlanValue', { count: freeTasks }) }}<small>{{ t('siteToolLimitsPlanNote') }}</small></dd>
          </div>
        </dl>
      </div>
    </section>

    <SiteFaq page="tools-index" :title="t('siteSectionFaqTitle')" :to="path('/help')" :link="t('siteFooterHelpCentre')" />

    <section class="site-section" aria-labelledby="tools-ai">
      <div class="site-container">
        <div class="site-tools-ai">
          <span class="site-tool-ico" aria-hidden="true"><AppIcon name="sparkle" class="site-icon" /></span>
          <div>
            <h2 id="tools-ai" class="site-h3">{{ t('siteToolsAiTitle') }}</h2>
            <p>{{ t('siteToolsAiLine') }}</p>
          </div>
          <NuxtLink class="site-btn is-secondary" :to="path('/ai')">{{ t('siteToolsAiButton') }}</NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>
