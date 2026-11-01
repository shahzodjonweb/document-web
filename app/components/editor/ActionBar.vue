<script setup lang="ts">
/** Save state, change budget, pre-flight problems, the week's file tasks and export. */
const { t, count, date, path } = useLocale()
const session = useEditorSession()

const redacting = computed(() => session.commands.value.some((command) => command.type === 'redact'))
const mixedRedaction = computed(
  () => redacting.value && session.commands.value.some((command) => command.type !== 'redact'),
)
const consent = ref(false)

const blocked = computed(
  () =>
    !session.commands.value.length ||
    session.issues.value.length > 0 ||
    mixedRedaction.value ||
    (redacting.value && !consent.value) ||
    session.budget.value.oversize,
)

/** Text past the page is saved like the rest: only the file cannot be made from it. */
const heldCount = computed(
  () => session.issues.value.filter((issue) => issue.code !== 'editorTextOverflow').length,
)
const firstIssue = computed(() => session.issues.value[0])
const saveFailed = computed(() => ['failed', 'paused'].includes(session.saveState.value))
const saveSettled = computed(() => ['saved', 'clean'].includes(session.saveState.value))

const saveLabel = computed(() => {
  switch (session.saveState.value) {
    case 'saving':
      return t('editorSaving')
    case 'dirty':
      return t('unsaved')
    case 'failed':
    case 'paused':
      return t('editorSaveFailed')
    default:
      return heldCount.value ? count('editorSaveNeedsFix', heldCount.value) : t('draftSaved')
  }
})

/** Go to where the fix is made, which on a phone is below every page. */
async function showIssue() {
  const issue = firstIssue.value
  if (!issue) return
  session.select(issue.id)
  await nextTick()
  const type = session.selected.value[0]?.type
  const panel = document.querySelector<HTMLDetailsElement>('[data-testid="editor-fields"]')
  const asset = document.querySelector('.editor-assetfield')
  const properties = document.querySelector('[data-testid="editor-floatbar"]')
  const wrap = issue.code === 'editorTextOverflow' ? document.querySelector('.editor-wrap-text') : null
  if (panel && (type === 'fill_form' || type === 'replace_text')) {
    panel.open = true
    panel.scrollIntoView({ block: 'start' })
  } else (wrap ?? asset ?? properties)?.scrollIntoView({ block: 'start' })
}
</script>

<template>
  <div class="editor-actionbar" data-testid="editor-actionbar">
    <div class="editor-actionbar-status">
      <span
        class="status-badge editor-save"
        :data-state="session.saveState.value"
        :class="{
          saved: saveSettled && !heldCount,
          failed: saveFailed || (saveSettled && heldCount),
        }"
        ><span />{{ saveLabel }}</span
      >
      <button
        v-if="session.saveState.value === 'failed'"
        type="button"
        class="text-link"
        data-testid="editor-save-now"
        @click="session.save()"
      >
        {{ t('editorSaveNow') }}
      </button>
      <span v-if="session.budget.value.commands" class="editor-budget field-hint">
        {{ t('editorChangeBudget', { used: session.budget.value.commands, total: session.budget.value.maxCommands }) }}
      </span>
    </div>

    <div class="editor-actionbar-notes">
      <p v-if="session.budget.value.oversize" class="editor-invalid" role="status">{{ t('editorSizeBudgetFull') }}</p>
      <p
        v-else-if="session.saveError.value"
        class="editor-invalid"
        role="status"
        data-testid="editor-save-error"
      >
        {{ session.saveError.value }}
      </p>
      <p v-else-if="mixedRedaction" class="editor-invalid" role="status">{{ t('editorRedactExclusive') }}</p>
      <p v-else-if="firstIssue" class="editor-invalid editor-issue" role="status" data-testid="editor-issue">
        <span>{{ session.describeIssue(firstIssue) }}</span>
        <button type="button" class="text-link" data-testid="editor-issue-show" @click="showIssue">
          {{ t('editorShowIssue') }}
        </button>
      </p>
      <p v-else-if="!session.commands.value.length" class="field-hint">{{ t('editorNothingToExport') }}</p>
      <label v-if="redacting && !mixedRedaction" class="check-label"
        ><input v-model="consent" type="checkbox" data-testid="editor-consent" /><span>{{
          t('acceptRasterization')
        }}</span></label
      >
    </div>

    <div class="editor-actionbar-actions">
      <template v-if="session.quote.value">
        <span class="editor-quote-meters">
          <WeeklyLine kind="file" :usage="session.quote.value.usage" />
          <small v-if="session.quote.value.expires_at">{{ t('quoteExpires') }} {{ date(session.quote.value.expires_at, true) }}</small>
        </span>
        <span v-if="session.quote.value.affordable === false" class="info-banner"
          >{{ t('quotaExceeded') }}
          <NuxtLink :to="path('/app/billing')" class="text-link">{{ t('studioSeePlans') }}</NuxtLink></span
        >
        <button
          type="button"
          class="button secondary"
          :disabled="session.isBusy('quote') || session.submissionPending.value"
          @click="session.review(consent)"
        >
          {{ t('refreshQuote') }}
        </button>
        <button
          type="button"
          class="button primary"
          data-testid="editor-export"
          :disabled="session.isBusy('export') || session.quote.value.affordable === false"
          @click="session.exportDocument"
        >
          {{
            session.isBusy('export')
              ? t('working')
              : session.submissionPending.value
                ? t('retry')
                : redacting
                  ? t('editorExportRedacted')
                  : t('exportPDF')
          }}
        </button>
      </template>
      <button
        v-else
        type="button"
        class="button primary"
        data-testid="editor-review"
        :disabled="blocked || session.isBusy('quote')"
        @click="session.review(consent)"
      >
        {{ session.isBusy('quote') ? t('working') : t('reviewExport') }}<AppIcon name="right" :size="16" />
      </button>
    </div>
  </div>
</template>
