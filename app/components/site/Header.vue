<script setup lang="ts">
// The public site's header (docs/site/design/spec.md §9): Tools as a mega menu,
// AI as a small menu, the language, sign-in and the main action; on narrow
// screens the same groups in one sheet behind the menu button.
const { t, st, path, locale, groups, toolName, toolPage } = useSite()
const { localePath } = useLocale()
const route = useRoute()
const brand = String(useRuntimeConfig().public.productName)

const open = ref<'' | 'tools' | 'ai' | 'lang'>('')
const sheet = ref(false)
const root = ref<HTMLElement | null>(null)
const toggle = (menu: 'tools' | 'ai' | 'lang') => (open.value = open.value === menu ? '' : menu)
const close = () => {
  open.value = ''
  sheet.value = false
}
watch(() => route.fullPath, close)
function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && (open.value || sheet.value)) close()
}
function onClick(event: MouseEvent) {
  if (open.value && root.value && !root.value.contains(event.target as Node)) open.value = ''
}
onMounted(() => {
  document.addEventListener('keydown', onKey)
  document.addEventListener('click', onClick)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  document.removeEventListener('click', onClick)
})

const ai = computed(() => [
  { to: path('/ai/documents'), icon: 'file', title: t('siteAiCardDocsTitle'), line: t('siteAiCardDocsLine') },
  { to: path('/ai/slides'), icon: 'slides', title: t('siteAiCardSlidesTitle'), line: t('siteAiCardSlidesLine') },
  { to: path('/ai/cv'), icon: 'user', title: t('siteAiCardCvTitle'), line: t('siteAiCardCvLine') },
  { to: path('/ai/referat'), icon: 'book', title: t('siteCrumbReferat'), line: st('siteAiHubReferatLine') },
  { to: path('/guide'), icon: 'sparkle', title: t('siteCrumbGuide'), line: '' },
])
const languages = [
  { code: 'uz', key: 'siteLangUz' },
  { code: 'ru', key: 'siteLangRu' },
  { code: 'en', key: 'siteLangEn' },
] as const
const current = (to: string) => route.path === to || route.path.startsWith(`${to}/`)
</script>
<template>
  <header ref="root" class="site-header">
    <div class="site-container site-header-row">
      <NuxtLink class="site-header-logo" :to="path()" :aria-label="t('siteNavHome')"
        ><img class="site-logo-light" src="/brand/docmaster-logo.svg" :alt="brand" width="176" height="28" /><img
          class="site-logo-dark"
          src="/brand/docmaster-logo-dark.svg"
          :alt="brand"
          width="176"
          height="28"
      /></NuxtLink>
      <nav class="site-nav" :aria-label="t('siteNavLabel')">
        <div class="site-nav-item" :class="{ 'is-open': open === 'tools' }">
          <button
            class="site-nav-link"
            type="button"
            :aria-expanded="open === 'tools'"
            aria-controls="site-mega-tools"
            @click="toggle('tools')"
          >
            {{ t('siteNavTools') }}<AppIcon name="down" class="site-icon" />
          </button>
          <div id="site-mega-tools" class="site-mega">
            <div v-for="group in groups" :key="group.key">
              <h3>{{ group.title }}</h3>
              <ul>
                <li v-for="item in group.tools" :key="item.slug">
                  <NuxtLink :to="toolPage(item.slug)"
                    ><AppIcon :name="item.icon" class="site-icon" />{{ toolName(item) }}</NuxtLink
                  >
                </li>
              </ul>
            </div>
            <div>
              <h3>{{ t('siteMegaEdit') }}</h3>
              <ul>
                <li>
                  <NuxtLink :to="path('/pdf-editor')"><AppIcon name="edit" class="site-icon" />{{ t('siteNavEditor') }}</NuxtLink>
                </li>
              </ul>
            </div>
            <div class="site-mega-foot">
              <span>{{ t('siteMegaLimits') }}</span
              ><NuxtLink class="site-link-arrow" :to="path('/tools')"
                >{{ t('siteNavAllTools') }}<AppIcon name="right" class="site-icon is-sm"
              /></NuxtLink>
            </div>
          </div>
        </div>
        <div class="site-nav-item">
          <NuxtLink
            class="site-nav-link"
            :to="path('/pdf-editor')"
            :aria-current="current(path('/pdf-editor')) ? 'page' : undefined"
            >{{ t('siteNavEditor') }}</NuxtLink
          >
        </div>
        <div class="site-nav-item" :class="{ 'is-open': open === 'ai' }">
          <button
            class="site-nav-link"
            type="button"
            :aria-expanded="open === 'ai'"
            aria-controls="site-mega-ai"
            @click="toggle('ai')"
          >
            {{ t('siteNavAi') }}<AppIcon name="down" class="site-icon" />
          </button>
          <div id="site-mega-ai" class="site-mega is-small">
            <ul>
              <li v-for="item in ai" :key="item.to">
                <NuxtLink :to="item.to"
                  ><AppIcon :name="item.icon" class="site-icon" /><div>
                    {{ item.title }}<span v-if="item.line">{{ item.line }}</span>
                  </div></NuxtLink
                >
              </li>
            </ul>
          </div>
        </div>
        <div class="site-nav-item">
          <NuxtLink
            class="site-nav-link"
            :to="path('/pricing')"
            :aria-current="current(path('/pricing')) ? 'page' : undefined"
            >{{ t('siteNavPricing') }}</NuxtLink
          >
        </div>
        <div class="site-nav-item">
          <NuxtLink
            class="site-nav-link"
            :to="path('/telegram')"
            :aria-current="current(path('/telegram')) ? 'page' : undefined"
            >{{ t('siteNavTelegram') }}</NuxtLink
          >
        </div>
      </nav>
      <div class="site-header-end">
        <div class="site-nav-item site-lang-item" :class="{ 'is-open': open === 'lang' }">
          <button
            class="site-lang"
            type="button"
            :aria-expanded="open === 'lang'"
            aria-controls="site-lang-menu"
            :aria-label="t('siteLangCurrent', { language: t(`siteLang${locale[0]!.toUpperCase()}${locale[1]}`) })"
            @click="toggle('lang')"
          >
            <AppIcon name="globe" class="site-icon is-sm" />{{
              t(`siteLang${locale[0]!.toUpperCase()}${locale[1]}`)
            }}<AppIcon name="down" class="site-icon is-sm" />
          </button>
          <div id="site-lang-menu" class="site-mega is-small site-lang-menu">
            <ul>
              <li v-for="language in languages" :key="language.code">
                <a :href="localePath(language.code)" :lang="language.code" :aria-current="language.code === locale ? 'true' : undefined">{{
                  t(language.key)
                }}</a>
              </li>
            </ul>
          </div>
        </div>
        <NuxtLink class="site-btn is-ghost is-sm site-signin" :to="path('/app')">{{ t('siteNavSignIn') }}</NuxtLink>
        <NuxtLink class="site-btn is-primary is-sm site-header-cta" :to="path('/app')"
          ><span class="site-cta-long">{{ t('siteNavStart') }}</span
          ><span class="site-cta-short">{{ t('siteNavStartShort') }}</span></NuxtLink
        >
        <button
          class="site-burger"
          type="button"
          :aria-label="t(sheet ? 'siteNavMenuClose' : 'siteNavMenuOpen')"
          :aria-expanded="sheet"
          aria-controls="site-mobile-menu"
          @click="sheet = !sheet"
        >
          <AppIcon :name="sheet ? 'x' : 'menu'" class="site-icon" />
        </button>
      </div>
    </div>
    <div id="site-mobile-menu" class="site-mobile-menu" :class="{ 'is-open': sheet }">
      <details>
        <summary>{{ t('siteNavTools') }}<AppIcon name="down" class="site-icon" /></summary>
        <ul>
          <template v-for="group in groups" :key="group.key">
            <li v-for="item in group.tools" :key="item.slug">
              <NuxtLink :to="toolPage(item.slug)">{{ toolName(item) }}</NuxtLink>
            </li>
          </template>
          <li>
            <NuxtLink :to="path('/tools')"><b>{{ t('siteNavAllTools') }}</b></NuxtLink>
          </li>
        </ul>
      </details>
      <NuxtLink :to="path('/pdf-editor')">{{ t('siteNavEditor') }}<AppIcon name="chevron" class="site-icon" /></NuxtLink>
      <details>
        <summary>{{ t('siteNavAi') }}<AppIcon name="down" class="site-icon" /></summary>
        <ul>
          <li v-for="item in ai" :key="item.to">
            <NuxtLink :to="item.to">{{ item.title }}</NuxtLink>
          </li>
        </ul>
      </details>
      <NuxtLink :to="path('/pricing')">{{ t('siteNavPricing') }}<AppIcon name="chevron" class="site-icon" /></NuxtLink>
      <NuxtLink :to="path('/telegram')">{{ t('siteNavTelegram') }}<AppIcon name="chevron" class="site-icon" /></NuxtLink>
      <div class="site-mobile-menu-end">
        <div class="site-mobile-menu-langs" role="group" :aria-label="t('siteLangLabel')">
          <a
            v-for="language in languages"
            :key="language.code"
            :href="localePath(language.code)"
            :lang="language.code"
            :aria-current="language.code === locale ? 'true' : undefined"
            >{{ t(language.key) }}</a
          >
        </div>
        <NuxtLink class="site-btn is-secondary" :to="path('/app')">{{ t('siteNavSignIn') }}</NuxtLink>
      </div>
    </div>
  </header>
</template>
