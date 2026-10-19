<script setup lang="ts">
/**
 * What to write in the description. The AI services take one free-text brief
 * and read everything out of it, so this is the whole manual — and every
 * example here is a complete description that can be used as it stands.
 */
const { t, path } = useLocale()
const studio = useStudio()
const { name } = useTools()
const examples = usePromptExamples()

const rows = [
  'Pages',
  'Audience',
  'Tone',
  'Structure',
  'Look',
  'Layouts',
  'Photos',
  'Questions',
  'Sources',
  'Skip',
] as const
// What a description with no count gets; the server's own default until the config loads.
const defaultPages = computed(() => studio.config.value?.default_pages ?? 10)
const services = computed(() =>
  studio.features.value.length
    ? studio.features.value
    : [
        { id: 'ai.pdf_topic', name: 'PDF Document' },
        { id: 'ai.pptx', name: 'PowerPoint Slides' },
        { id: 'ai.cv', name: 'CV' },
      ],
)
const useExample = (featureId: string, text: string) =>
  path(`/app/create?feature=${encodeURIComponent(featureId)}&prompt=${encodeURIComponent(text)}`)

onMounted(() => {
  if (!studio.loaded.value) studio.load()
})
</script>

<template>
  <div class="page-heading">
    <div>
      <h1>{{ t('guideTitle') }}</h1>
      <p>{{ t('guideSub') }}</p>
    </div>
    <NuxtLink :to="path('/app/create')" class="button primary"
      ><AppIcon name="sparkle" :size="17" />{{ t('create') }}</NuxtLink
    >
  </div>

  <section class="panel guide-lead">
    <p>{{ t('guideLead') }}</p>
  </section>

  <section class="section-block">
    <div class="section-heading">
      <h2>{{ t('guideUnderstands') }}</h2>
    </div>
    <div class="panel guide-table">
      <dl>
        <template v-for="row in rows" :key="row">
          <dt>{{ t(`guideRow${row}`) }}</dt>
          <dd>{{ t(`guideRow${row}Body`, { pages: defaultPages }) }}</dd>
        </template>
      </dl>
    </div>
  </section>

  <section class="section-block">
    <div class="section-heading">
      <h2>{{ t('guideExamples') }}</h2>
    </div>
    <div v-for="service in services" :key="service.id" class="guide-service">
      <h3>{{ name(service.id, service.name) }}</h3>
      <ul class="guide-examples">
        <li v-for="(example, index) in examples(service.id)" :key="index" class="panel">
          <div class="guide-example-brief">
            <span class="guide-example-index" aria-hidden="true">{{ index + 1 }}.</span>
            <p>{{ example }}</p>
          </div>
          <NuxtLink
            class="button secondary small"
            :data-testid="`guide-use-${service.id}-${index}`"
            :to="useExample(service.id, example)"
            >{{ t('guideUse') }}<AppIcon name="right" :size="15"
          /></NuxtLink>
        </li>
      </ul>
    </div>
  </section>
</template>
