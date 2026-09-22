<script setup lang="ts">
const props = defineProps<{ projectId?: string }>()
const { t, path, date } = useLocale()
const ws = useWorkspace()
const projects = ref<any[]>([])
const project = ref<any>(null)
const result = ref<any>(null)
const answers = reactive<Record<string, string>>({})
const busy = ref(false)
const error = ref('')
const questions = computed<any[]>(() => project.value?.content?.questions || project.value?.questions || [])
async function load() {
  busy.value = true
  error.value = ''
  try {
    if (props.projectId) {
      project.value = await ws.api(`/education/projects/${props.projectId}`)
      result.value = null
      Object.keys(answers).forEach((k) => delete answers[k])
    } else {
      project.value = null
      result.value = null
      const data = await ws.api('/education/projects')
      projects.value = data.results || data.projects || []
    }
  } catch (e: any) {
    error.value = e.data?.error?.message || t('genericError')
  } finally {
    busy.value = false
  }
}
onMounted(load)
watch(() => props.projectId, load)
async function remove(id: string) {
  busy.value = true
  try {
    await ws.api(`/education/projects/${id}`, { method: 'DELETE' })
    project.value = null
    await navigateTo(path('/app/projects'))
    await load()
  } catch (e: any) {
    error.value = e.data?.error?.message || t('genericError')
  } finally {
    busy.value = false
  }
}
async function submit() {
  busy.value = true
  error.value = ''
  try {
    result.value = await ws.api(`/education/projects/${props.projectId}/practice`, {
      method: 'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: { answers: { ...answers } },
    })
  } catch (e: any) {
    error.value = e.data?.error?.message || t('genericError')
  } finally {
    busy.value = false
  }
}
const optionValue = (option: any, index: number) =>
  typeof option === 'string' ? option : String(option.id ?? option.value ?? index)
const optionLabel = (option: any) =>
  typeof option === 'string' ? option : option.text || option.label || String(option.value)
</script>
<template>
  <div class="page-heading">
    <div>
      <span class="eyebrow">{{ t('projects') }}</span>
      <h1>{{ project?.title || t('projectsTitle') }}</h1>
      <p>{{ t('projectsSub') }}</p>
    </div>
    <NuxtLink :to="path('/app/study')" class="button secondary"
      ><AppIcon name="plus" :size="17" />{{ t('newDocument') }}</NuxtLink
    >
  </div>
  <ErrorBanner v-if="error" :message="error" />
  <div v-if="busy && !project && !projects.length" class="loading-state">
    <AppIcon class="spin" name="loader" :size="28" />{{ t('loading') }}
  </div>
  <template v-else-if="project"
    ><div class="project-meta">
      <span class="status-badge succeeded">{{ t('expiry90') }}</span
      ><span>{{ t('expires') }} {{ date(project.expires_at, true) }}</span
      ><button class="text-link danger-link" @click="remove(project.id)" :disabled="busy">
        <AppIcon name="trash" :size="15" />{{ t('deleteProject') }}
      </button>
    </div>
    <div class="project-layout">
      <section class="panel saved-content">
        <h2>{{ t('contentStep') }}</h2>
        <article v-for="(section, index) in project.content?.sections || []" :key="index">
          <h3>{{ section.heading }}</h3>
          <p>{{ section.body }}</p>
        </article>
      </section>
      <section class="panel practice-panel">
        <h2>{{ t('practice') }}</h2>
        <p v-if="!questions.length" class="muted">{{ t('noQuestions') }}</p>
        <form v-else @submit.prevent="submit">
          <fieldset
            v-for="(question, index) in questions"
            :key="question.id || index"
            class="practice-question"
          >
            <legend>
              <span>{{ Number(index) + 1 }}</span
              >{{ question.stem }}
            </legend>
            <label v-for="(option, i) in question.options || []" :key="i" class="practice-choice"
              ><input
                v-model="answers[question.id || String(index)]"
                type="radio"
                :name="`question-${question.id || index}`"
                :value="optionValue(option, Number(i))"
                :disabled="!!result"
              /><span>{{ optionLabel(option) }}</span></label
            ><label v-if="!question.options?.length" class="form-field"
              ><span>{{ t('yourAnswer') }}</span
              ><input v-model="answers[question.id || String(index)]" :disabled="!!result"
            /></label>
          </fieldset>
          <button v-if="!result" class="button primary full" :disabled="busy">
            {{ busy ? t('working') : t('submitAnswers') }}<AppIcon name="checks" :size="17" />
          </button>
        </form>
        <section v-if="result" class="practice-result" role="status">
          <span class="result-symbol"><AppIcon name="checks" :size="27" /></span>
          <h3>{{ t('practiceResult') }}</h3>
          <p class="field-hint">{{ t('practiceGradingNote') }}</p>
          <p class="practice-score">
            {{ result.score }} <span>/ {{ result.max_score }}</span>
          </p>
          <div v-if="result.weak_topics?.length">
            <strong>{{ t('weakTopics') }}</strong>
            <div class="topic-chips">
              <span v-for="topic in result.weak_topics" :key="topic">{{ topic }}</span>
            </div>
          </div>
          <div
            v-for="feedback in result.questions || []"
            :key="feedback.question_id || feedback.id"
            class="answer-feedback"
          >
            <strong>{{ feedback.correct ? t('succeeded') : t('explanation') }}</strong>
            <p>{{ feedback.explanation || feedback.feedback }}</p>
          </div>
          <button class="button secondary" @click="result = null">{{ t('retry') }}</button>
        </section>
      </section>
    </div></template
  ><template v-else
    ><div v-if="projects.length" class="saved-grid">
      <NuxtLink
        v-for="item in projects"
        :key="item.id"
        :to="path(`/app/projects/${item.id}`)"
        class="panel saved-card"
        ><span class="tool-icon purple"><AppIcon name="word" :size="25" /></span>
        <h2>{{ item.title }}</h2>
        <p>{{ t('expires') }} {{ date(item.expires_at) }}</p>
        <span class="text-link">{{ t('practice') }}<AppIcon name="right" :size="15" /></span
      ></NuxtLink>
    </div>
    <div v-else class="empty-state panel">
      <span class="empty-icon"><AppIcon name="folder" :size="28" /></span>
      <h2>{{ t('emptyProjects') }}</h2>
      <p>{{ t('emptyProjectsBody') }}</p>
      <NuxtLink :to="path('/app/study')" class="button primary">{{ t('education') }}</NuxtLink>
    </div></template
  >
</template>
