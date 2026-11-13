<script setup lang="ts">
/**
 * Black out: find the words or numbers to hide, or tap a place to cover it.
 *
 * What is found is outlined on its page; the MainButton blacks out all of it at once
 * and a tap on one covers that one. Boxes stay hatched until the file is made. Below,
 * each page with a box says what it comes to: its other words stay words, or it becomes
 * a picture, which Review asks "I understand" for. That is the server's check of the
 * saved draft (useEditorBlackOut), asked once the boxes have settled.
 */
import { BLACK_OUT_PRESETS, type BlackOutPreset } from '~/composables/useEditorTextLayer'

const { t, count } = useLocale()
const session = useEditorSession()
const tools = useEditorTools()
const hints = useEditorHints()
const pageOrder = useEditorPageOrder()
const telegram = useTelegramApp()
const blackout = useEditorBlackOut()
const send = useEditorSend()

const PRESET_LABEL: Record<BlackOutPreset, string> = {
  phone: 'editorBlackOutPhones',
  card: 'editorBlackOutCards',
  passport: 'editorBlackOutPassports',
  pinfl: 'editorBlackOutPinfl',
}
/** Why a page becomes a picture, as a person would put it; the rest say only that its words could not go another way. */
const REASON: Record<string, string> = {
  scan: 'editorBlackOutWhyScan',
  image: 'editorBlackOutWhyPicture',
  mark: 'editorBlackOutWhyMark',
  others: 'editorBlackOutWhyAround',
}

/** By their place in the file being made, as the page chip and Pages name them. */
const placeOf = (page: number) => pageOrder.positionOf(page) || page
const listed = (pages: number[]) => [...new Set(pages.map(placeOf))].sort((a, b) => a - b).join(', ')
const boxPages = computed(() => blackout.boxes.value.map((command) => command.page ?? 1))
const foundPages = computed(() => blackout.matches.value.map((match) => match.page))

const field = ref<HTMLInputElement>()
function typed(event: Event) {
  blackout.setQuery((event.target as HTMLInputElement).value)
}
function choose(preset: BlackOutPreset) {
  blackout.setPreset(preset)
  telegram.haptic('selection')
}

/** What the search says: still looking, how many it found where, or nothing on the pages' own words. */
const status = computed(() => {
  if (!blackout.query.value && !blackout.preset.value) return ''
  if (blackout.searching.value) return t('editorBlackOutLooking')
  if (!blackout.searched.value) return ''
  const found = blackout.matches.value.length
  // Pages whose words did not come just now, and the pages after the first matches, were not looked through: said so.
  const unread = blackout.unread.value ? ` ${t('editorBlackOutUnread')}` : ''
  if (!found) {
    if (blackout.truncated.value) return t('editorBlackOutFirstCovered', { count: blackout.most }) + unread
    return t(blackout.foundCount.value ? 'editorBlackOutAllCovered' : 'editorBlackOutNothing') + unread
  }
  const pages = foundPages.value
  return `${count('editorBlackOutFound', found)} · ${
    new Set(pages).size > 1
      ? t('editorBlackOutPages', { pages: listed(pages) })
      : t('editorBlackOutPage', { page: listed(pages) })
  }${blackout.truncated.value ? ` · ${t('editorBlackOutMoreLater')}` : ''}${unread}`
})

function blackOutAll() {
  const made = blackout.blackOutAll()
  if (!made) return
  hints.retire('blackout')
  telegram.haptic('success')
}
// "Black out all {n}" is the sheet's one filled button while there is something to black out.
telegram.usePrimaryAction('blackout', () => {
  const found = blackout.matches.value.length
  // Review over the sheet has its own button: this one stands down while a send is being looked at.
  if (!found || session.held.value || send.stage.value !== 'idle') return null
  return { text: t('editorBlackOutAll', { count: found }), onPress: blackOutAll }
})

/** Each page with a box, numbered as Pages numbers it, with what it comes to. */
const outcomes = computed(() =>
  blackout.boxedPages.value
    .map((page) => ({
      page,
      place: placeOf(page),
      outcome: blackout.outcomeOf(page),
      reason: blackout.reasonOf(page),
    }))
    .sort((a, b) => a.place - b.place),
)
// Checked again once the boxes have settled and been saved, while this sheet is open.
watch(
  [
    () => JSON.stringify(blackout.boxes.value.map(({ _id, ...box }) => box)),
    () => session.doc.value?.version,
  ],
  () => blackout.checkSoon(),
  { immediate: true },
)
onBeforeUnmount(() => blackout.stopChecking())
</script>

<template>
  <div class="editor-blackout" data-testid="editor-blackout">
    <form
      v-if="blackout.canSearch.value"
      class="editor-blackout-find"
      role="search"
      @submit.prevent="field?.blur()"
    >
      <label class="visually-hidden" for="editor-blackout-search">{{ t('editorBlackOutFind') }}</label>
      <input
        id="editor-blackout-search"
        ref="field"
        type="search"
        class="input"
        :value="blackout.query.value"
        :placeholder="t('editorBlackOutFind')"
        enterkeyhint="search"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        data-testid="editor-blackout-search"
        @input="typed"
      />
      <div class="editor-blackout-presets" role="group" :aria-label="t('editorBlackOutPresets')">
        <button
          v-for="preset in BLACK_OUT_PRESETS"
          :key="preset"
          type="button"
          class="chip"
          :class="{ active: blackout.preset.value === preset }"
          :aria-pressed="blackout.preset.value === preset"
          :data-testid="`editor-blackout-preset-${preset}`"
          @click="choose(preset)"
        >
          {{ t(PRESET_LABEL[preset]) }}
        </button>
      </div>
      <!-- Always there, so what it says next is read out. -->
      <p class="editor-blackout-found" role="status" data-testid="editor-blackout-found">{{ status }}</p>
    </form>

    <p class="field-hint">
      {{ t(hints.showing('blackout') ? 'editorHintBlackOut' : 'editorBlackOutAgain') }}
    </p>
    <p
      v-if="blackout.boxes.value.length"
      class="editor-blackout-count"
      role="status"
      data-testid="editor-blackout-count"
    >
      {{ count('editorBlackOutBoxes', blackout.boxes.value.length) }} ·
      {{
        new Set(boxPages).size > 1
          ? t('editorBlackOutPages', { pages: listed(boxPages) })
          : t('editorBlackOutPage', { page: listed(boxPages) })
      }}
    </p>

    <div aria-live="polite">
      <ul
        v-if="blackout.keepsText.value && outcomes.length"
        class="editor-blackout-pages"
        data-testid="editor-blackout-pages"
      >
        <li v-for="row in outcomes" :key="row.page" :data-outcome="row.outcome" :data-page="row.place">
          <template v-if="row.outcome === 'keeps'">{{
            t('editorBlackOutKeeps', { page: row.place })
          }}</template>
          <template v-else-if="row.outcome === 'picture'">
            <strong>{{ t('editorBlackOutBecomes', { page: row.place }) }}</strong>
            <small>{{ t(REASON[row.reason] ?? 'editorBlackOutWhyOther') }}</small>
          </template>
          <template v-else-if="row.outcome === 'checking'">{{
            t('editorBlackOutChecking', { page: row.place })
          }}</template>
          <template v-else>{{ t('editorBlackOutMaybe', { page: row.place }) }}</template>
        </li>
      </ul>
    </div>
    <p class="field-hint">
      {{ t(blackout.keepsText.value ? 'editorBlackOutKeepsWhy' : 'editorBlackOutPictures') }}
    </p>
    <button
      type="button"
      class="button secondary small"
      data-testid="editor-blackout-done"
      @click="tools.stopBlackOut"
    >
      {{ t('editorDone') }}
    </button>
  </div>
</template>
