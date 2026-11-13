<script setup lang="ts">
/**
 * Review for a deck: what changed since it was opened or last sent, then what the
 * send makes and uses as the server says it, and one Confirm. Inside Telegram the
 * MainButton is Confirm; in a browser it is drawn at the foot, as in ReviewSheet.vue.
 *
 * A slide the server will not send is a row to put right from here: too long (split
 * it, or another layout), or its picture no longer stored (a layout without one).
 */
import type { PrimaryAction } from '~/composables/useTelegramApp'

type FixAction = 'split' | 'layout' | 'pictureLayout' | 'show'
const emit = defineEmits<{
  close: []
  fix: [fix: { id: string; index: number; action: FixAction }]
  show: [index: number]
}>()

const { t, date, locale, path } = useLocale()
const deck = useDeckEditor()
const send = useDeckSend()
const telegram = useTelegramApp()

const plural = (key: string, amount: number, values: Record<string, string | number> = {}) =>
  t(`${key}_${new Intl.PluralRules(locale.value).select(amount)}`, { count: amount, ...values })

const stage = send.stage
const refusal = send.refusal
const summary = send.summary
const chat = computed(() => send.deliver.value === 'chat')


/** The title slide and question slides (`q1`…) are put right where they are, not split here. */
const elsewhere = (item: { id: string; index: number }) =>
  item.index === 0 ||
  (/^q\d+$/.test(item.id) && !deck.sections.value.some((section) => section.id === item.id))
/** A deck at the plan's count of slides takes none that Split would make: said once, above the slides. */
const full = computed(() => deck.sections.value.length >= deck.maxSlides.value)
const canSplit = (id: string) => {
  const section = deck.sections.value.find((item) => item.id === id)
  if (!section || full.value) return false
  return section.body.split('\n').filter((line) => line.trim()).length >= 2 || section.items.length >= 2
}

const formatName = computed(() =>
  t(
    send.pdfDropped.value || (summary.value?.format ?? send.format.value) === 'pptx'
      ? 'deckReviewPptx'
      : 'deckReviewBoth',
  ),
)
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
const asLink = computed(() => chat.value && (summary.value?.size_estimate ?? 0) > 50 * 1_048_576)
const costLine = computed(() => {
  const cost = send.cost.value
  if (!cost) return ''
  if (cost.kind === 'included') return t('editorCostIncluded')
  if (cost.kind === 'none') return t('editorCostNone')
  return t('editorCostTask', { left: cost.left ?? 0, limit: cost.limit ?? 0 })
})
const pptx = computed(() => send.results.value.find((result) => result.kind === 'pptx') ?? null)
const pdf = computed(() => send.results.value.find((result) => result.kind === 'pdf') ?? null)

/** Make again from the description this deck was made from, which never goes into the address. */
const handoff = useState<string>('studio-prompt-handoff', () => '')
function makeAgain() {
  handoff.value = deck.draft.value?.prompt || ''
}

/** The one filled button, whichever Telegram or the browser draws. */
const primary = computed<PrimaryAction | null>(() => {
  switch (stage.value) {
    case 'checking':
    case 'needs_fix':
    case 'pictures':
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
telegram.usePrimaryAction('deck-review', () =>
  telegram.isMiniApp.value ? (primary.value ?? 'hidden') : null,
)
const browserButton = computed(() => (telegram.isMiniApp.value ? null : primary.value))
const costShown = computed(() => !!summary.value && stage.value === 'ready')

// A conflict is the frame's to show, with its two choices; this sheet only gets in the way of it.
watch(
  () => refusal.value?.code,
  (code) => code === 'version_conflict' && emit('close'),
)
</script>

<template>
  <div class="editor-review" data-testid="deck-review-body" :data-stage="stage">
    <p v-if="stage === 'checking'" class="editor-review-status" role="status">
      <AppIcon name="loader" class="spin" :size="18" />{{ t('editorReviewChecking') }}
    </p>

    <!-- Words that would not all show: each slide put right here, or shown where it is -->
    <template v-if="stage === 'needs_fix'">
      <p class="warning-banner" role="alert">{{ t('deckReviewFixFirst') }}</p>
      <p v-if="full" class="field-hint" data-testid="deck-review-full">
        {{ t('deckSlidesFull', { max: deck.maxSlides.value }) }}
      </p>
      <ul class="deck-edit-fix">
        <li v-for="item in send.tooLong.value" :key="item.id" :data-testid="`deck-review-fix-${item.index}`">
          <span>{{ plural('deckReviewSlideWords', item.words_over, { n: item.index + 1 }) }}</span>
          <span class="editor-review-choices">
            <button
              v-if="elsewhere(item)"
              type="button"
              class="button secondary small"
              :data-testid="`deck-review-fix-${item.index}-show`"
              @click="emit('fix', { id: item.id, index: item.index, action: 'show' })"
            >
              {{ t('editorShowIt') }}
            </button>
            <template v-else>
              <button
                type="button"
                class="button secondary small"
                :disabled="!canSplit(item.id)"
                :title="
                  canSplit(item.id)
                    ? undefined
                    : full
                      ? t('deckSlidesFull', { max: deck.maxSlides.value })
                      : t('deckSplitNeedsLines')
                "
                :data-testid="`deck-review-fix-${item.index}-split`"
                @click="emit('fix', { id: item.id, index: item.index, action: 'split' })"
              >
                {{ t('deckSplit') }}
              </button>
              <button
                type="button"
                class="button secondary small"
                :data-testid="`deck-review-fix-${item.index}-layout`"
                @click="emit('fix', { id: item.id, index: item.index, action: 'layout' })"
              >
                {{ t('deckPickLayout') }}
              </button>
            </template>
          </span>
        </li>
      </ul>
    </template>

    <!-- Pictures no longer stored: a layout without one, or for the title slide a new deck -->
    <template v-if="stage === 'pictures'">
      <p class="warning-banner" role="alert">{{ t('deckPictureGone') }}</p>
      <ul class="deck-edit-fix">
        <li
          v-for="item in send.picturesGone.value"
          :key="item.id"
          :data-testid="`deck-review-picture-${item.index}`"
        >
          <template v-if="item.index === 0">
            <span>{{ t('deckPictureGoneCover') }}</span>
            <span class="editor-review-choices">
              <NuxtLink
                :to="path('/app/create?feature=ai.pptx')"
                class="button secondary small"
                data-testid="deck-review-make-again"
                @click="makeAgain"
                >{{ t('deckMakeAgain') }}</NuxtLink
              >
            </span>
          </template>
          <template v-else>
            <span>{{ t('deckPictureGoneSlide', { n: item.index + 1 }) }}</span>
            <span class="editor-review-choices">
              <button
                type="button"
                class="button secondary small"
                :data-testid="`deck-review-picture-${item.index}-layout`"
                @click="emit('fix', { id: item.id, index: item.index, action: 'pictureLayout' })"
              >
                {{ t('deckPickLayout') }}
              </button>
              <button
                type="button"
                class="button secondary small"
                :data-testid="`deck-review-picture-${item.index}-show`"
                @click="emit('fix', { id: item.id, index: item.index, action: 'show' })"
              >
                {{ t('editorShowIt') }}
              </button>
            </span>
          </template>
        </li>
      </ul>
    </template>

    <!-- What the files will be, and what changed since the deck was opened or last sent -->
    <template v-if="summary && stage === 'ready'">
      <DeckChangeList testid="deck-review-changes" :title="t('deckChanges')" @show="emit('show', $event)" />
      <p class="editor-review-facts" data-testid="editor-review-facts">
        <span>{{ t('deckArrives', { format: formatName }) }}</span
        ><span>{{ t('deckReviewSlides', { count: summary.slides }) }}</span
        ><span>{{ t('editorReviewSize', { size }) }}</span>
      </p>
      <p v-if="send.pdfDropped.value" class="field-hint" data-testid="deck-pptx-only">
        {{ t('deckPptxOnly') }}
      </p>
      <p v-if="asLink" class="field-hint">{{ t('editorReviewLink') }}</p>
      <p
        v-for="code in summary.warnings"
        :key="code"
        class="warning-banner"
        data-testid="deck-review-warning"
      >
        {{ t(code) }}
      </p>
      <p v-if="send.costChanged.value" class="warning-banner" role="alert" data-testid="editor-cost-changed">
        {{ t('editorCostChanged') }}
      </p>
      <p class="retention-note">
        <AppIcon name="clock" :size="15" /><span
          >{{ t('editorNothingUsed') }}
          {{ t('editorAvailableUntil', { time: date(summary.kept_until, true) }) }}</span
        >
      </p>
    </template>

    <p v-if="stage === 'sending'" class="editor-review-status" role="status" data-testid="editor-sending">
      <AppIcon name="loader" class="spin" :size="18" />{{ t('editorSending') }}
    </p>

    <!-- Accepted: in a chat the files are on their way; here they are being made -->
    <section
      v-if="stage === 'accepted' || stage === 'made'"
      class="editor-review-done"
      data-testid="editor-accepted"
    >
      <span class="result-symbol success"><AppIcon name="checks" :size="28" /></span>
      <p role="status">
        <strong>{{
          chat ? t('deckAccepted') : stage === 'made' ? t('editorReady') : t('editorMaking')
        }}</strong>
      </p>
      <template v-if="!chat && stage === 'made'">
        <a v-if="pptx" class="button primary full" :href="pptx.url" download data-testid="deck-download-pptx"
          ><AppIcon name="download" :size="17" />{{ t('deckDownloadPptx') }}</a
        >
        <a v-if="pdf" class="button secondary full" :href="pdf.url" download data-testid="deck-download-pdf"
          ><AppIcon name="download" :size="17" />{{ t('deckDownloadPdf') }}</a
        >
      </template>
      <button
        v-if="chat && send.stayOpen.value"
        type="button"
        class="button primary full"
        data-testid="editor-keep-editing"
        @click="emit('close')"
      >
        <AppIcon name="edit" :size="16" />{{ t('editorKeepEditing') }}
      </button>
    </section>

    <!-- Each refusal, by its code -->
    <section
      v-if="stage === 'failed' && refusal"
      class="editor-review-refused"
      role="alert"
      data-testid="editor-refused"
      :data-code="refusal.code"
    >
      <template v-if="refusal.code === 'weekly_file_limit'">
        <p>{{ t('editorWeekUsed', { time: date(deck.expiresAt.value, true) }) }}</p>
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
      <!-- A job request unanswered is tried again by the primary button, under its same key -->
      <p v-else-if="send.uncertain.value" data-testid="editor-send-failed">{{ t('editorSendFailed') }}</p>
      <template v-else>
        <p>
          {{
            refusal.code === 'unanswered'
              ? t('editorSendFailed')
              : refusal.code === 'not_saved'
                ? deck.saveError.value || t('editorNotSaved')
                : refusal.message || t('genericError')
          }}
        </p>
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
