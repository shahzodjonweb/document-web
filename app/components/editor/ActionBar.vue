<script setup lang="ts">
/** Save state, change budget, pre-flight problems, the week's file tasks and export. */
const { t, date, path } = useLocale()
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

const saveLabel = computed(() => {
  switch (session.saveState.value) {
    case 'saving':
      return t('editorSaving')
    case 'saved':
      return t('draftSaved')
    case 'failed':
    case 'paused':
      return t('editorSaveFailed')
    default:
      return session.commands.value.length ? t('unsaved') : t('draftSaved')
  }
})
</script>

<template>
  <div class="editor-actionbar" data-testid="editor-actionbar">
    <div class="editor-actionbar-status">
      <span
        class="status-badge editor-save"
        :class="{
          saved: session.saveState.value === 'saved' || session.saveState.value === 'clean',
          failed: session.saveState.value === 'failed' || session.saveState.value === 'paused',
        }"
        ><span />{{ saveLabel }}</span
      >
      <button
        v-if="session.saveState.value === 'failed' || session.saveState.value === 'paused'"
        type="button"
        class="text-link"
        @click="session.save"
      >
        {{ t('editorSaveNow') }}
      </button>
      <span v-if="session.budget.value.commands" class="editor-budget field-hint">
        {{ t('editorChangeBudget', { used: session.budget.value.commands, total: session.budget.value.maxCommands }) }}
      </span>
    </div>

    <div class="editor-actionbar-notes">
      <p v-if="session.budget.value.oversize" class="editor-invalid" role="status">{{ t('editorSizeBudgetFull') }}</p>
      <p v-else-if="mixedRedaction" class="editor-invalid" role="status">{{ t('editorRedactExclusive') }}</p>
      <p v-else-if="session.issues.value.length" class="editor-invalid" role="status">
        {{ t('editorIssues', { count: session.issues.value.length }) }}
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
