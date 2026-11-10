<script setup lang="ts">
// The prompt guide on the public site: the same reference and ready-to-use
// examples as the app's guide (GuideView), laid out in the site's design.
definePageMeta({ layout: 'site' })
const { t, path, start } = useSite()
const { name } = useTools()
const examples = usePromptExamples()
const rows = ['Pages', 'Audience', 'Tone', 'Structure', 'Look', 'Layouts', 'Photos', 'Questions', 'Sources', 'Skip'] as const
const services = ['ai.pdf_topic', 'ai.pptx', 'ai.cv'] as const
const fallback: Record<string, string> = { 'ai.pdf_topic': 'PDF Document', 'ai.pptx': 'PowerPoint Slides', 'ai.cv': 'CV' }
// With no count asked for, a document or deck gets ten pages or slides.
const defaultPages = 10
const use = (feature: string, text: string) =>
  path(`/app/create?feature=${encodeURIComponent(feature)}&prompt=${encodeURIComponent(text)}`)
</script>
<template>
  <div class="site-guide">
    <SiteBreadcrumb />
    <section class="site-hero site-guide-hero">
      <div class="site-container site-guide-intro">
        <h1 class="site-h1">{{ t('guideTitle') }}</h1>
        <p class="site-lead">{{ t('guideSub') }}</p>
        <p class="site-note"><AppIcon name="sparkle" class="site-icon" /><span>{{ t('guideLead') }}</span></p>
        <NuxtLink class="site-btn is-primary" :to="start('ai.pdf_topic')"
          ><AppIcon name="sparkle" class="site-icon is-sm" />{{ t('create') }}</NuxtLink
        >
      </div>
    </section>

    <section class="site-section is-band" aria-labelledby="guide-understands">
      <div class="site-container">
        <SiteSectionHead id="guide-understands" :title="t('guideUnderstands')" />
        <div class="site-table-wrap">
          <table class="site-table site-guide-table">
            <tbody>
              <tr v-for="row in rows" :key="row">
                <th scope="row">{{ t(`guideRow${row}`) }}</th>
                <td>{{ t(`guideRow${row}Body`, { pages: defaultPages }) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="site-section" aria-labelledby="guide-examples">
      <div class="site-container">
        <SiteSectionHead id="guide-examples" :title="t('guideExamples')" />
        <div v-for="service in services" :key="service" class="site-guide-service">
          <h3 class="site-h3">{{ name(service, fallback[service]) }}</h3>
          <ol class="site-guide-examples">
            <li v-for="(example, index) in examples(service)" :key="index" class="site-guide-example">
              <p>{{ example }}</p>
              <NuxtLink class="site-btn is-secondary is-sm" :to="use(service, example)"
                >{{ t('guideUse') }}<AppIcon name="right" class="site-icon is-sm"
              /></NuxtLink>
            </li>
          </ol>
        </div>
      </div>
    </section>
  </div>
</template>
