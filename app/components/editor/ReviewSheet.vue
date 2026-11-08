<script setup lang="ts">
/**
 * Review: what this send makes and what it uses, as the server says it, and one
 * Confirm. Inside Telegram the MainButton is Confirm. In a browser the modal sheet
 * would cover the frame's own button, so it is drawn here instead.
 *
 * Nothing here counts or prices anything: pages, size, expiry and cost are the
 * quote's summary, and every refusal is a state for the server's code.
 */
import { kindLabel } from '~/composables/useEditorTools'
import type { PrimaryAction } from '~/composables/useTelegramApp'

const emit = defineEmits<{ close: []; showPage: [page: number] }>()

const { t, date, locale, path } = useLocale()
const session = useEditorSession()
const send = useEditorSend()
const telegram = useTelegramApp()
const pageOrder = useEditorPageOrder()

const plural = (key: string, amount: number, values: Record<string, string | number> = {}) =>
  t(`${key}_${new Intl.PluralRules(locale.value).select(amount)}`, { count: amount, ...values })

const summary = send.summary
const stage = send.stage
const refusal = send.refusal

/**
 * The changes by page as the server counted them, by the uploaded page's number.
 * A page is named by its place in the file being made, as the stage and Pages
 * name it. A removed page has no place there: it is named once, below, by its
 * number in the original.
 */
const rows = computed(() =>
  Object.entries(summary.value?.changes_by_page ?? {})
    .map(([key, changes]) => ({ page: Number(key), changes, position: pageOrder.positionOf(Number(key)) }))
    .filter((row) => row.position)
    .sort((a, b) => a.position - b.position),
)
/** The server names them as uploaded; they are said by their place in the file being made, as the rows are. */
const pictured = computed(() =>
  send.consentPages.value
    .map((page) => pageOrder.positionOf(page) || page)
    .sort((a, b) => a - b)
    .join(', '),
)
const removedPages = computed(() =>
  Object.keys(summary.value?.changes_by_page ?? {})
    .map(Number)
    .filter((page) => pageOrder.isRemoved(page))
    .sort((a, b) => a - b),
)
const pagesLine = computed(() => {
  const now = summary.value
  if (!now) return ''
  return now.pages_before === now.pages_after
    ? t('editorReviewPageCount', { count: now.pages_after })
    : t('editorReviewPages', { before: now.pages_before, after: now.pages_after })
})
const size = computed(() => {
  const bytes = summary.value?.size_estimate ?? 0
  const megabytes = bytes / 1_048_576
  const big = megabytes >= 1
  return new Intl.NumberFormat(locale.value === 'uz' ? 'uz-Latn' : locale.value, {
    style: 'unit',
    unit: big ? 'megabyte' : 'kilobyte',
    unitDisplay: 'short',
    maximumFractionDigits: big && megabytes < 10 ? 1 : 0,
  }).format(big ? megabytes : Math.max(1, bytes / 1024))
})
/** Telegram takes files up to 50 MB; past that, the chat gets a link. */
const asLink = computed(
  () => send.deliver.value === 'chat' && (summary.value?.size_estimate ?? 0) > 50 * 1_048_576,
)
const costLine = computed(() => {
  const cost = send.cost.value
  if (!cost) return ''
  if (cost.kind === 'included') return t('editorCostIncluded')
  if (cost.kind === 'none') return t('editorCostNone')
  return t('editorCostTask', { left: cost.left ?? 0, limit: cost.limit ?? 0 })
})
/** Near the draft's limit: say so before the send, as the next change may not fit (spec 4.6). */
const nearLimit = computed(() => {
  const budget = session.budget.value
  return budget.commands >= budget.maxCommands * 0.8 || budget.bytes >= budget.maxBytes * 0.8
})

/** "3. Text, page 2": the change a refusal names, as the list of changes numbers it, on the page the rows name. */
function describe(index: number) {
  const command = send.changeAt(index)
  if (!command) return ''
  const name = `${index + 1}. ${t(kindLabel(command.type))}`
  const page = command.page ? pageOrder.positionOf(command.page) || command.page : 0
  return page ? `${name}, ${t('editorReviewPage', { page })}` : name
}
const refusedIndex = computed(() => {
  const index = Number(refusal.value?.params.index)
  return Number.isInteger(index) && send.changeAt(index) ? index : null
})
function showChange(id: string | undefined) {
  if (!id) return
  emit('close')
  session.select(id)
}

/** The one filled button, whichever Telegram or the browser draws. */
const primary = computed<PrimaryAction | null>(() => {
  switch (stage.value) {
    case 'checking':
      return { text: t('editorConfirm'), enabled: false, onPress: () => {} }
    case 'ready':
      return {
        text: send.cost.value?.kind === 'file_task' ? t('editorConfirmTask') : t('editorConfirm'),
        enabled: send.canConfirm.value,
        busy: send.busy.value,
        onPress: () => void send.confirm(),
      }
    case 'sending':
      return { text: t('editorSending'), busy: true, onPress: () => {} }
    case 'failed':
      return send.uncertain.value ? { text: t('editorTryAgain'), onPress: () => void send.confirm() } : null
    default:
      return null
  }
})
telegram.usePrimaryAction('review', () => (telegram.isMiniApp.value ? (primary.value ?? 'hidden') : null))
const browserButton = computed(() => (telegram.isMiniApp.value ? null : primary.value))
const costShown = computed(() => !!summary.value && ['ready', 'checking'].includes(stage.value))

// A conflict is the frame's to show, with its two choices; this sheet only gets in the way of it.
watch(
  () => refusal.value?.code,
  (code) => code === 'version_conflict' && emit('close'),
)
</script>

<template>
  <div class="editor-review" data-testid="editor-review-body" :data-stage="stage">
    <p v-if="stage === 'checking'" class="editor-review-status" role="status">
      <AppIcon name="loader" class="spin" :size="18" />{{ t('editorReviewChecking') }}
    </p>

    <!-- Pictures that never got in: said before Confirm, which sends the file as it is -->
    <div
      v-if="send.notices.value.length && ['checking', 'ready', 'failed'].includes(stage)"
      class="warning-banner editor-review-notices"
      role="alert"
      data-testid="editor-review-notices"
    >
      <p v-for="notice in send.notices.value" :key="notice">{{ notice }}</p>
      <p>{{ t('editorCheckPage') }}</p>
    </div>

    <!-- Pages that become pictures: the server's list, and the person's word for it -->
    <section
      v-if="send.consentPages.value.length && ['ready', 'checking'].includes(stage)"
      class="editor-review-consent"
      data-testid="editor-review-consent"
    >
      <p>
        <strong>{{ t('editorPicturePages', { pages: pictured }) }}</strong>
      </p>
      <p class="field-hint">{{ t('editorPicturePagesWhy') }}</p>
      <label class="check-label"
        ><input
          type="checkbox"
          :checked="send.consent.value"
          :disabled="stage === 'checking'"
          data-testid="editor-consent"
          @change="send.understand(($event.target as HTMLInputElement).checked)"
        /><span>{{ t('editorUnderstand') }}</span></label
      >
    </section>

    <!-- What the file will be -->
    <template v-if="summary && ['ready', 'checking'].includes(stage)">
      <ul
        v-if="rows.length || removedPages.length"
        class="editor-review-pages"
        data-testid="editor-review-pages"
      >
        <li v-for="row in rows" :key="row.page">
          <span>{{ t('editorReviewPage', { page: row.position }) }}</span>
          <small>{{ plural('editorReviewChanges', row.changes) }}</small>
          <button
            type="button"
            class="text-link"
            :aria-label="`${t('editorShowIssue')}: ${t('editorReviewPage', { page: row.position })}`"
            @click="emit('showPage', row.page)"
          >
            {{ t('editorShowIssue') }}
          </button>
        </li>
        <li v-if="removedPages.length" data-testid="editor-review-removed">
          <small>{{
            plural('editorReviewRemoved', removedPages.length, { pages: removedPages.join(', ') })
          }}</small>
        </li>
      </ul>
      <p class="editor-review-facts" data-testid="editor-review-facts">
        <span>{{ pagesLine }}</span
        ><span>{{ t('editorReviewSize', { size }) }}</span>
      </p>
      <p v-if="asLink" class="field-hint">{{ t('editorReviewLink') }}</p>
      <p v-if="send.costChanged.value" class="warning-banner" role="alert" data-testid="editor-cost-changed">
        {{ t('editorCostChanged') }}
      </p>
      <p class="retention-note">
        <AppIcon name="clock" :size="15" /><span
          >{{ t('editorNothingUsed') }}
          {{ t('editorAvailableUntil', { time: date(summary.kept_until, true) }) }}</span
        >
      </p>
      <p v-if="nearLimit" class="field-hint">{{ t('editorTooMuchSoon') }}</p>
    </template>

    <p v-if="stage === 'sending'" class="editor-review-status" role="status" data-testid="editor-sending">
      <AppIcon name="loader" class="spin" :size="18" />{{ t('editorSending') }}
    </p>

    <!-- Accepted: in a chat it is on its way; here it is being made -->
    <section
      v-if="['accepted', 'made'].includes(stage)"
      class="editor-review-done"
      data-testid="editor-accepted"
    >
      <span class="result-symbol success"><AppIcon name="checks" :size="28" /></span>
      <p role="status">
        <strong>{{
          send.deliver.value === 'chat'
            ? t('editorAccepted')
            : stage === 'made'
              ? t('editorReady')
              : t('editorMaking')
        }}</strong>
      </p>
      <p v-if="refusal" class="editor-invalid" role="alert">{{ refusal.message || t('genericError') }}</p>
      <p v-if="send.skipped.value" class="field-hint" data-testid="editor-skipped">
        {{ plural('editorSkipped', send.skipped.value) }}
      </p>
      <p v-if="send.retyped.value" class="field-hint" data-testid="editor-retyped">
        {{ plural('editorTextRetyped', send.retyped.value) }}
      </p>
      <a
        v-if="send.deliver.value === 'download' && stage === 'made' && send.result.value"
        class="button primary full"
        :href="send.result.value.download_url"
        download
        data-testid="editor-download"
        ><AppIcon name="download" :size="17" />{{ t('download') }}</a
      >
      <button
        v-if="send.deliver.value === 'download' || send.stayOpen.value"
        type="button"
        class="button full"
        :class="send.deliver.value === 'chat' ? 'primary' : 'secondary'"
        :disabled="stage !== 'made' || !send.result.value?.file_id || send.busy.value"
        data-testid="editor-keep-editing"
        @click="send.keepEditing()"
      >
        <AppIcon
          :name="stage === 'made' ? 'edit' : 'loader'"
          :class="{ spin: stage !== 'made' }"
          :size="16"
        />{{ t('editorKeepEditing') }}
      </button>
      <p v-if="send.deliver.value === 'chat' && send.stayOpen.value && stage !== 'made'" class="field-hint">
        {{ t('editorMaking') }}
      </p>
    </section>

    <!-- A picture chosen once the send had gone: whatever became of the send, it is not in it -->
    <p v-if="send.late.value" class="warning-banner editor-review-notices" role="alert" data-testid="editor-late">
      {{ t('editorLateChange') }}
    </p>

    <!-- Each refusal, by its code -->
    <section
      v-if="stage === 'failed' && refusal"
      class="editor-review-refused"
      role="alert"
      data-testid="editor-refused"
      :data-code="refusal.code"
    >
      <template v-if="refusal.code === 'needs_fix'">
        <p>{{ refusal.message }}</p>
        <button
          type="button"
          class="button secondary"
          data-testid="editor-review-show"
          @click="showChange(refusal.params.id)"
        >
          {{ t('editorShowIt') }}
        </button>
      </template>
      <template v-else-if="refusal.code === 'weekly_file_limit'">
        <p>{{ t('editorWeekUsed', { time: date(session.doc.value?.file.expires_at, true) }) }}</p>
        <NuxtLink :to="path('/app/billing')" class="button secondary">{{ t('studioSeePlans') }}</NuxtLink>
      </template>
      <p v-else-if="refusal.code === 'send_limit'">
        {{
          t(refusal.params.per === 'hour' ? 'editorSendLimitHour' : 'editorSendLimitDay', {
            limit: refusal.params.limit ?? '',
          })
        }}
      </p>
      <template v-else-if="refusal.code === 'telegram_link_required'">
        <p>{{ t('editorNoChat') }}</p>
        <NuxtLink :to="path('/app/settings')" class="button secondary">{{ t('authLinkTelegram') }}</NuxtLink>
      </template>
      <p v-else-if="refusal.code === 'payload_too_large'">{{ t('editorTooMuch') }}</p>
      <template v-else-if="refusedIndex !== null">
        <p>
          {{
            refusal.code === 'editor_check_failed'
              ? t('editorCheckFailed')
              : t('editorChangeRefused', { change: describe(refusedIndex) })
          }}
        </p>
        <p v-if="refusal.code === 'editor_check_failed'" class="field-hint">{{ describe(refusedIndex) }}</p>
        <span class="editor-review-choices">
          <button
            type="button"
            class="button secondary"
            data-testid="editor-review-show"
            @click="showChange(send.changeAt(refusedIndex)?._id)"
          >
            {{ t('editorShowIt') }}
          </button>
          <button
            type="button"
            class="button secondary"
            data-testid="editor-send-without"
            @click="send.sendWithout(refusedIndex)"
          >
            {{ t('editorSendWithout') }}
          </button>
        </span>
      </template>
      <p v-else-if="send.uncertain.value" data-testid="editor-send-failed">{{ t('editorSendFailed') }}</p>
      <template v-else>
        <p>{{ refusal.code === 'not_saved' ? t('editorNotSaved') : refusal.message || t('genericError') }}</p>
        <button
          type="button"
          class="button secondary"
          data-testid="editor-review-again"
          @click="send.check()"
        >
          {{ t('editorTryAgain') }}
        </button>
      </template>
    </section>

    <!-- The cost stays in sight above Confirm, however far the list of changes runs on a small screen. -->
    <div v-if="costShown || browserButton" class="editor-review-foot">
      <p v-if="costShown" class="weekly-line editor-review-cost" data-testid="editor-review-cost">
        <strong>{{ costLine }}</strong>
      </p>
      <button
        v-if="browserButton"
        type="button"
        class="button primary full"
        data-testid="editor-confirm"
        :disabled="browserButton.enabled === false || browserButton.busy"
        @click="browserButton.onPress"
      >
        <AppIcon v-if="browserButton.busy" name="loader" class="spin" :size="16" />{{ browserButton.text }}
      </button>
    </div>
  </div>
</template>
