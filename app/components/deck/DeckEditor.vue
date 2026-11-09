<script setup lang="ts">
/**
 * The slide editor for an AI-made deck: the slides as the server draws them, the
 * words behind each part one tap away. Phone first, in the PDF editor's frame and
 * Telegram buttons; at 980 px and over a strip on the left and one panel on the right.
 *
 * `useDeckEditor` owns the deck, its saves and its pictures. This owns what is open:
 * the dock, the sheets and the panel, and it puts their words in before anything
 * that would lose them (Send, hiding the app, leaving, another slide).
 */
import {
  primeKeyboard,
  type CommitReason,
  type DeckFit,
  type DeckQuestion,
  type DeckSection,
  type SlideRef,
} from '~/composables/useDeckEditor'

type Field = 'heading' | 'lines' | 'notes'
/** The open field: its slide, or the spot a slide is made at on its first words. */
interface Dock {
  session: number
  target: { id: string | null; after: number }
  field: Field
  /** The slide on screen when it opened, shown again if the slide this dock made goes. */
  from: SlideRef | null
  /** History's step once this dock made its slide; the same step later means nothing else changed. */
  madeStep?: number
}
interface Handle {
  dirty?: unknown
}
interface FieldsHandle extends Handle {
  commit: (options: { reason: CommitReason; keepOpen?: boolean }) => void
  done: (reason: CommitReason) => void
  focus?: () => void
}
interface FormHandle extends Handle {
  commit: (reason?: CommitReason) => void
}

const props = defineProps<{ draftId: string }>()

const { t, count, path, locale } = useLocale()
const deck = useDeckEditor()
const images = useDeckImages()
const send = useDeckSend()
const latin = useDeckLatin()
const cover = useDeckCover()
const telegram = useTelegramApp()
const frame = useEditorFrame()
const hints = useEditorHints()
const snackbar = useEditorSnackbar()
/** StudioView reads it once: a deck's description goes back there in memory, never in the address. */
const promptHandoff = useState<string>('studio-prompt-handoff', () => '')
const ws = useWorkspace()
/**
 * Each deck's description, for Make again, held for one account: after a sign-out and in on
 * the same device another account never gets these words, as the app does not reload.
 */
const openedPrompts = useState<{ owner: string; prompts: Record<string, string> }>(
  'deck-opened-prompts',
  () => ({ owner: '', prompts: {} }),
)
const promptOwner = () => String(ws.user.value?.id ?? '')
const promptsHere = () => (openedPrompts.value.owner === promptOwner() ? openedPrompts.value.prompts : {})

const dockFields = ref<FieldsHandle | null>(null)
const panelFields = ref<FieldsHandle | null>(null)
const coverForm = ref<FormHandle | null>(null)
const questionsSheet = ref<FormHandle | null>(null)
const questionsPanel = ref<FormHandle | null>(null)
const fields = computed(() => dockFields.value ?? panelFields.value)
const questionsForm = computed(() => questionsSheet.value ?? questionsPanel.value)

const dock = ref<Dock | null>(null)
let dockSessions = 0
const panel = ref<'slides' | 'cover' | null>(null)
const menuOpen = ref(false)
const layoutsFor = ref<{ id: string; fit: DeckFit | null; pictureMode: boolean; fromReview: boolean } | null>(
  null,
)
const layoutsChecking = ref(false)
const questionsOpen = ref(false)
const moreOpen = ref(false)
const reviewOpen = ref(false)
const online = ref(true)
const outlined = ref(false)
const seenImage = ref(false)
const sheetTyping = ref(false)
const shortScreen = ref(false)
const shortenedHidden = ref(false)

const wide = computed(() => frame.wide.value)
const slides = computed(() => deck.slides.value)
const sectionById = (id: string | null | undefined) =>
  (id && deck.sections.value.find((section) => section.id === id)) || null
const currentRef = computed<SlideRef | null>(
  () => slides.value[deck.current.value] ?? slides.value[0] ?? null,
)
const currentSection = computed(() =>
  currentRef.value?.kind === 'section' ? sectionById(currentRef.value.id) : null,
)
/** Where a new slide goes: after this one, or after the last slide when questions are on screen. */
const currentSectionIndex = computed(() => {
  const ref = currentRef.value
  const sections = deck.sections.value
  const at = ref?.kind === 'section' ? sections.findIndex((section) => section.id === ref.id) : -1
  return at >= 0 ? at : sections.length - 1
})
const coverSection = computed(() => deck.sections.value[0] ?? null)
const onCover = computed(() => !!currentSection.value && currentSection.value.id === coverSection.value?.id)
const onQuestions = computed(() => currentRef.value?.kind === 'questions')
const questionCount = computed(() => deck.content.value.questions?.length ?? 0)
const canAdd = computed(() => deck.sections.value.length < deck.maxSlides.value)
const currentImage = computed(() => (currentRef.value ? deck.imageOf(currentRef.value) : null))
const slideHeading = computed(() =>
  onQuestions.value ? t('deckQuestionsTitle') : (currentSection.value?.heading ?? ''),
)

const sameSlide = (a: SlideRef, b: SlideRef) =>
  a.kind === 'section' ? b.kind === 'section' && a.id === b.id : b.kind === 'questions' && a.page === b.page
const refOf = (id: string) => slides.value.find((ref) => ref.kind === 'section' && ref.id === id) ?? null

/**
 * The slide on screen is asked for first, and again last: each thumbnail asked for
 * goes to the front of the queue, and a long strip would otherwise hold it up. The
 * strip, the list and the dock read the same answers.
 */
const pictures = computed(() => {
  const image = currentImage.value
  const current = image ? images.src(image.key, image.url).value : null
  const items = slides.value.map((ref) => {
    const shot = deck.imageOf(ref)
    return {
      ref,
      thumb: shot ? images.src(shot.key, shot.thumb).value : null,
      fits: shot ? shot.fits : null,
      question: ref.kind === 'questions',
      key: shot?.key ?? (ref.kind === 'section' ? ref.id : `questions:${ref.page}`),
    }
  })
  if (image) images.src(image.key, image.url)
  return { current, items }
})
const listThumbs = computed(() => {
  const thumbs: Record<string, string | null> = {}
  const fits: Record<string, boolean | null> = {}
  for (const item of pictures.value.items)
    if (item.ref.kind === 'section') {
      thumbs[item.ref.id] = item.thumb
      fits[item.ref.id] = item.fits
    }
  return { thumbs, fits }
})

/* ------------------------------------------------------------ over budget */

/** Words of the slide on screen that do not show, from the server's count once its picture says so. */
const overBy = ref<{ key: string; words: number } | null>(null)
const overKey = computed(() => {
  const ref = currentRef.value
  if (!ref || currentImage.value?.fits !== false) return ''
  return ref.kind === 'section' ? JSON.stringify(currentSection.value) : `questions:${ref.page}`
})
watch(
  overKey,
  async (key) => {
    if (!key) return
    const section = currentSection.value
    // A question slide cannot be measured: its picture alone says some words do not show.
    const fit = section ? await deck.measure(section) : null
    if (overKey.value !== key) return
    overBy.value = fit?.fits ? null : { key, words: fit?.words_over || -1 }
  },
  { immediate: true },
)
const tooLong = computed(() =>
  overKey.value && overBy.value?.key === overKey.value ? overBy.value.words : null,
)
/** Splitting halves the lines, or the items: it needs two of either, and never the cover. */
function splittable(section: DeckSection | null) {
  if (!section || section.id === coverSection.value?.id) return false
  return section.body.split('\n').filter((line) => line.trim()).length >= 2 || section.items.length >= 2
}
/** What stops Split on a slide, said beside it, or '' when it can be done: a full deck first. */
function splitBlocked(section: DeckSection | null) {
  if (!canAdd.value) return t('deckSlidesFull', { max: deck.maxSlides.value })
  return splittable(section) ? '' : t('deckSplitNeedsLines')
}

/* ------------------------------------------------------------------ hint */

let flashTimer: ReturnType<typeof setTimeout> | null = null
/** The parts' outlines for 2 s, with the words that say what they are for. */
function flash() {
  outlined.value = true
  if (flashTimer !== null) clearTimeout(flashTimer)
  flashTimer = setTimeout(() => {
    outlined.value = false
    flashTimer = null
  }, 2000)
}
// Shown with the first picture, not with the deck: before it there is nothing to tap.
watch(currentImage, (image) => {
  if (!image || seenImage.value) return
  seenImage.value = true
  flash()
})
/** The outlines' line while they show (on the first picture and on a tap that missed), then the first-use tip. */
const hintKey = computed(() => {
  if (dock.value && !wide.value) return ''
  if (outlined.value) return 'deckHintRegions'
  return seenImage.value && hints.showing('deckEdit') ? 'deckHintTap' : ''
})

/* --------------------------------------------------------------- notices */

const saveFailed = computed(() => deck.saveState.value === 'failed')
const previewOff = computed(() => deck.preview.value === 'unavailable' || deck.preview.value === 'busy')
const previewWords = computed(() =>
  [
    t(deck.preview.value === 'busy' ? 'deckPreviewBusy' : 'deckPreviewUnavailable'),
    ['saved', 'clean'].includes(deck.saveState.value) ? t('deckSavedInFile') : '',
    deck.previewError.value === 'pinned_asset_expired' ? t('deckPictureGone') : '',
  ]
    .filter(Boolean)
    .join(' '),
)
const firstHidden = computed(() => slides.value.findIndex((ref) => deck.imageOf(ref)?.fits === false))
/** Two at most, the most pressing first: the rest wait their turn rather than push the slide off a phone. */
const notices = computed(() =>
  (
    [
      ['conflict', deck.conflict.value],
      ['held', deck.held.value && !reviewOpen.value],
      ['saveFailed', saveFailed.value],
      ['offline', !online.value],
      ['latin', !!latin.offer.value],
      ['preview', previewOff.value],
      ['shortened', deck.hiddenAtFirstRender.value > 0 && !shortenedHidden.value],
      ['expiring', deck.expiresSoon.value],
    ] as const
  )
    .filter(([, on]) => on)
    .slice(0, 2)
    .map(([name]) => name as string),
)
const notice = (name: string) => notices.value.includes(name)

/**
 * Today's time alone; a deck kept into tomorrow says the day after it, never a year (a
 * deck lives a day): on a narrow top bar the time is never what gives way. Uzbek says the
 * day first, "10-noyabr, 01:43 gacha", and the bar's second line keeps the time in sight.
 */
const untilText = computed(() => {
  const at = deck.expiresAt.value
  const when = at ? new Date(at) : null
  if (!when || Number.isNaN(when.getTime())) return ''
  // A time ("12:44 AM") and a day ("Nov 10") each stay on one line when the bar wraps.
  const whole = (text: string) => text.replace(/\s/g, '\u00a0')
  const pad = (part: number) => String(part).padStart(2, '0')
  const time =
    locale.value === 'uz'
      ? `${pad(when.getHours())}:${pad(when.getMinutes())}`
      : whole(new Intl.DateTimeFormat(locale.value, { timeStyle: 'short' }).format(when))
  if (when.toDateString() === new Date().toDateString()) return time
  if (locale.value === 'uz') {
    // Spelt from the bot's own table, given the deck's own year so that it adds none.
    const year = when.getFullYear()
    return `${dayLabel(`${year}-${when.getMonth() + 1}-${when.getDate()}`, 'uz', year)}, ${time}`
  }
  const day = new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short' }).format(when)
  return `${time}, ${whole(day)}`
})

/* ---------------------------------------------------------------- frame */

const isDirty = (handle: Handle | null | undefined) => {
  const value = unref(handle?.dirty)
  return typeof value === 'function' ? !!value() : !!value
}
const anyBufferDirty = computed(
  () => isDirty(fields.value) || isDirty(coverForm.value) || isDirty(questionsForm.value),
)
const unsaved = () =>
  ['dirty', 'saving', 'failed', 'paused'].includes(deck.saveState.value) || anyBufferDirty.value

telegram.useViewport()
telegram.bindClosingConfirmation(unsaved)
/** Send to chat inside Telegram, Download elsewhere: the same Review either way. */
telegram.usePrimaryAction('deck', () =>
  deck.openState.value !== 'ready'
    ? 'hidden'
    : {
        text: t(send.deliver.value === 'chat' ? 'editorSendToChat' : 'editorDownload'),
        enabled: !deck.held.value && !deck.conflict.value && online.value,
        onPress: openReview,
      },
)

/** Words still in a field or form go in. Hiding the app keeps them open: it may come back. */
function commitOpen(reason: CommitReason) {
  fields.value?.commit({ reason, keepOpen: reason === 'hide' })
  coverForm.value?.commit(reason)
  questionsForm.value?.commit()
}
// Across 980 px the fields move between the dock and the panel, each read from the deck
// as it mounts: the words go in first, while the ones they were typed into are still there.
watch(wide, () => commitOpen('hide'), { flush: 'pre' })

// Each deck starts with nothing open. No id is a deck that cannot exist: `open` asks nothing for it.
watch(
  () => props.draftId,
  (id, before) => {
    if (before) commitOpen('leave')
    dock.value = null
    panel.value = null
    menuOpen.value = false
    layoutsFor.value = null
    questionsOpen.value = false
    reviewOpen.value = false
    seenImage.value = false
    shortenedHidden.value = false
    void deck.open(id)
  },
  { immediate: true },
)
// Make again after a later refusal starts from what this deck was asked for.
watch(
  () => deck.draft.value,
  (draft) => {
    if (draft?.id && draft.prompt)
      openedPrompts.value = { owner: promptOwner(), prompts: { ...promptsHere(), [draft.id]: draft.prompt } }
  },
  { immediate: true },
)
function handOffPrompt() {
  const prompt = promptsHere()[props.draftId]
  if (prompt) promptHandoff.value = prompt
}
// A deck that is no longer on screen leaves nothing open behind its refusal.
watch(deck.openState, (state) => {
  if (state === 'ready') return
  dock.value = null
  panel.value = null
  menuOpen.value = false
  layoutsFor.value = null
  questionsOpen.value = false
  moreOpen.value = false
  if (reviewOpen.value) {
    reviewOpen.value = false
    send.dismiss(false)
  }
})
// A step later than a snack's makes its Undo take back the wrong thing.
watch(deck.steps, (step) => {
  if (snackbar.snack.value?.step !== undefined && snackbar.snack.value.step !== step) snackbar.dismiss()
})
// The dock's slide gone (an Undo, the other version taken): nothing left to type into.
watch(
  () => !!dock.value?.target.id && !sectionById(dock.value.target.id),
  (gone) => {
    if (gone) dock.value = null
  },
)

/* ------------------------------------------------------------ navigation */

/**
 * The dock's words go to its own slide and it closes. While the deck cannot take
 * them (a choice between versions, a send holding it), it stays, words and all.
 */
function closeDock() {
  if (!dock.value) return true
  if (!deck.editable.value) return false
  fields.value?.done('navigate')
  dock.value = null
  return true
}

/** Another slide: the open field's words go to its own slide first. */
function go(index: number, swiped = false) {
  const wanted = slides.value[index]
  if (!wanted) return
  if (!deck.editable.value && anyBufferDirty.value) return
  if (dock.value) {
    if (!closeDock()) return
  } else if (wide.value) commitOpen('navigate')
  // A slide made by that commit moves the ones after it along.
  const at = slides.value.findIndex((ref) => sameSlide(ref, wanted))
  deck.current.value = at >= 0 ? at : Math.min(index, slides.value.length - 1)
  if (swiped) telegram.haptic('selection')
}

/**
 * A field of slide `id`, or of a slide made after `after` on its first words. The
 * words still open go in first; a slide they make does not take the screen from
 * the one tapped, and a second new slide follows the first.
 */
function openDock(id: string | null, field: Field, after?: number) {
  if (!deck.editable.value) return
  const showing = currentRef.value
  if (dock.value) fields.value?.commit({ reason: 'navigate', keepOpen: false })
  else if (wide.value) commitOpen('navigate')
  if (panel.value && !wide.value) coverForm.value?.commit('close')
  if (id !== null && showing) {
    const at = slides.value.findIndex((ref) => sameSlide(ref, showing))
    if (at >= 0) deck.current.value = at
  }
  panel.value = null
  menuOpen.value = false
  dock.value = {
    session: ++dockSessions,
    target: { id, after: after ?? currentSectionIndex.value },
    field,
    from: currentRef.value,
  }
  // The panel never takes focus by itself (arrows would land in it); words clicked on are another matter.
  if (wide.value) void nextTick(() => panelFields.value?.focus?.())
}

/** On a phone a tap on the slide with a sheet up only puts the sheet away. */
function closeSheetsForTap() {
  if (!menuOpen.value && (wide.value || !panel.value)) return false
  commitOpen('close')
  panel.value = null
  menuOpen.value = false
  return true
}

function onRegion(field: 'heading' | 'body') {
  if (closeSheetsForTap()) return
  const ref = currentRef.value
  if (!ref) return
  if (!deck.editable.value) return flash()
  if (ref.kind === 'questions') return openQuestions()
  // The cover's lines are its details, in a form of their own; its title is a headline like any other.
  if (onCover.value && field === 'body') return openCover()
  if (!wide.value) primeKeyboard()
  openDock(ref.id, field === 'heading' ? 'heading' : 'lines')
}
function onFlash() {
  if (!closeSheetsForTap()) flash()
}

function addFromStrip() {
  if (!deck.editable.value || !canAdd.value) return
  if (!wide.value) primeKeyboard()
  openDock(null, 'heading')
}

function openCover() {
  menuOpen.value = false
  if (!wide.value) {
    if (closeDock()) panel.value = 'cover'
    return
  }
  panel.value = null
  go(0)
}
function openQuestions() {
  if (!wide.value) {
    if (closeDock()) questionsOpen.value = true
    return
  }
  panel.value = null
  const at = slides.value.findIndex((ref) => ref.kind === 'questions')
  if (at >= 0) go(at)
}
function openNotes() {
  const section = currentSection.value
  if (section) openDock(section.id, 'notes')
}
function openMenu() {
  if (panel.value && !wide.value) {
    commitOpen('close')
    panel.value = null
  }
  menuOpen.value = true
}
function menuSplit() {
  menuOpen.value = false
  split(currentSection.value?.id)
}
/** The copy is shown, as the one being made. */
function menuDuplicate() {
  menuOpen.value = false
  const copy = currentSection.value ? deck.duplicateSlide(currentSection.value.id) : null
  const at = copy ? slides.value.findIndex((ref) => ref.kind === 'section' && ref.id === copy) : -1
  if (at >= 0) deck.current.value = at
}
function menuDelete() {
  menuOpen.value = false
  const before = deck.sections.value.length
  if (currentSection.value) deck.deleteSlide(currentSection.value.id)
  if (deck.sections.value.length < before) undoSnack(t('editorDeleted'))
}
function onMenuField(field: Field) {
  menuOpen.value = false
  const section = currentSection.value
  if (!section) return
  if (field === 'lines' && onCover.value) return openCover()
  openDock(section.id, field)
}

const slidesOpen = computed(() => panel.value === 'slides')
function toggleSlides() {
  if (slidesOpen.value) {
    panel.value = null
    return
  }
  commitOpen('close')
  dock.value = null
  menuOpen.value = false
  panel.value = 'slides'
}
function closePanel() {
  commitOpen('close')
  panel.value = null
}

/* ------------------------------------------------------------ the fields */

const BLANK: DeckSection = {
  id: '',
  heading: '',
  body: '',
  notes: '',
  layout: 'bullets',
  items: [],
  columns: [],
  image_query: '',
}
const FIELD_NAMES: Record<Field, string> = {
  heading: 'deckFieldHeadline',
  lines: 'deckFieldLines',
  notes: 'deckFieldNotes',
}
/** The dock's slide, a new one's empty start, or on a wide screen the slide on screen. */
const fieldsSection = computed<DeckSection | null>(() => {
  const open = dock.value
  if (!open) return currentSection.value
  return open.target.id === null ? BLANK : sectionById(open.target.id)
})
const fieldsNumber = computed(() => {
  const open = dock.value
  if (!open) return deck.current.value + 1
  if (open.target.id === null) return Math.max(1, open.target.after + 1) + 1
  return deck.sections.value.findIndex((section) => section.id === open.target.id) + 1
})
const fieldsImage = computed(() => {
  const ref = fieldsSection.value?.id ? refOf(fieldsSection.value.id) : null
  return ref ? deck.imageOf(ref) : null
})
const fieldsThumb = computed(() => {
  const image = fieldsImage.value
  return image ? images.src(image.key, image.thumb).value : null
})

/** What a commit wrote, for the Latin check: the lines one by one, as the offer shows one. */
function writtenStrings(patch: Partial<DeckSection>) {
  return [
    patch.heading ?? '',
    ...(patch.body ?? '').split('\n'),
    patch.notes ?? '',
    ...(patch.items ?? []).flatMap((item) => [item.label, item.text, item.value]),
    ...(patch.columns ?? []),
  ].filter((text) => text.trim())
}
/** Taking the offer changes the deck itself; a form still open on those words reads them again from it. */
const reread = () => {}

function onFieldsCommit(
  patch: Partial<DeckSection>,
  options: { keepOpen: boolean; amend: boolean; reason: CommitReason },
) {
  const open = dock.value
  let id = open ? open.target.id : fieldsSection.value?.id || null
  if (open && id === null) {
    // A new slide is made by its first words, so an empty one is never saved.
    if (!Object.keys(patch).length) return
    id = deck.addSlide(open.target.after, patch)
    if (!id) return
    open.target.id = id
    open.madeStep = deck.steps.value
  } else if (id) {
    // Words amended into the step that made the slide leave it that one step.
    const folded = options.amend && open?.madeStep !== undefined && open.madeStep === deck.steps.value
    deck.setSection(id, patch, `field:${id}:${open?.field ?? 'panel'}`, { amend: options.amend })
    if (folded && open) open.madeStep = deck.steps.value
  } else return
  if (options.keepOpen) return
  hints.retire('deckEdit')
  void latin.check(id, writtenStrings(patch), reread, options.reason)
}

/**
 * The slide a dock made goes again (its Cancel, or every word taken out). Nothing else
 * changed since: the step that made it is taken back, leaving no trace in history.
 */
function onFieldsDiscard() {
  const open = dock.value
  const id = open?.target.id
  dock.value = null
  if (!open || !id || !sectionById(id)) return
  if (open.madeStep === deck.steps.value) deck.undo()
  else deck.deleteSlide(id)
  const from = open.from
  const at = from ? slides.value.findIndex((ref) => sameSlide(ref, from)) : -1
  if (at >= 0) deck.current.value = at
}

/** The field's words in and the dock away, for an action that changes the slide under it. */
function settleFields() {
  const open = dock.value
  fields.value?.commit({ reason: 'navigate', keepOpen: false })
  const id = open ? open.target.id : fieldsSection.value?.id || null
  if (open) {
    dock.value = null
    telegram.hideKeyboard()
  }
  return id
}

/** Latin letters taken on the cover: kept lines go in Latin too. An open form keeps each line in its row by its place. */
function coverLatin(map: Map<string, string>) {
  void cover.rewrite(map).then((saved) => saved || snackbar.show({ message: t('genericError') }))
}

function onCoverCommit(patch: { heading: string; body: string }, reason: CommitReason) {
  const id = coverSection.value?.id
  if (!id) return
  deck.setSection(id, patch, 'cover')
  if (reason === 'hide' || reason === 'leave' || reason === 'send') return
  hints.retire('deckEdit')
  // Line by line, as the dock's lines are; the check itself asks only for a commit the person is looking at.
  void latin.check(id, writtenStrings(patch), coverLatin, reason)
}

function onQuestionsCommit(next: DeckQuestion[]) {
  deck.setQuestions(next)
}
function closeQuestions() {
  questionsForm.value?.commit()
  questionsOpen.value = false
  const strings = deck.content.value.questions.flatMap((question) => [
    question.stem,
    question.answer,
    ...(question.options ?? []),
  ])
  void latin.check(
    'questions',
    strings.filter((text) => text?.trim()),
    reread,
    'close',
  )
}

/* ------------------------------------------------------------ slide changes */

function undoSnack(message: string) {
  snackbar.show({ message, actionLabel: t('editorUndo'), onAction: deck.undo, step: deck.steps.value })
}
/** At the plan's count of slides Split is off where it is offered; a tap that still gets here hears why. */
function split(id: string | null | undefined) {
  if (!id) return
  if (!canAdd.value) return snackbar.show({ message: t('deckSlidesFull', { max: deck.maxSlides.value }) })
  const at = deck.sections.value.findIndex((section) => section.id === id)
  if (deck.splitSlide(id)) undoSnack(t('deckSplitDone', { a: at + 1, b: at + 2 }))
}
// The Slides list only asks: what it takes away is offered back here, as the slide menu's is.
function duplicateSlide(id: string) {
  deck.duplicateSlide(id)
}
function deleteSlide(id: string) {
  const before = deck.sections.value.length
  deck.deleteSlide(id)
  if (deck.sections.value.length < before) undoSnack(t('editorDeleted'))
}
function fewerQuestions() {
  const before = questionCount.value
  deck.fewerQuestions()
  if (questionCount.value < before) undoSnack(t('deckQuestionsLeft', { count: questionCount.value }))
}
function removeQuiz() {
  if (!questionCount.value) return
  deck.removeQuiz()
  if (!questionCount.value) undoSnack(t('deckQuizRemoved'))
}
function moveSlide(id: string, to: number) {
  deck.moveSlide(id, to)
}
function addFromList(after: number) {
  deck.addSlide(after)
}

/* ---------------------------------------------------------------- layouts */

const layoutsSection = computed(() => sectionById(layoutsFor.value?.id))
function openLayouts(id: string, fit: DeckFit | null, pictureMode = false, fromReview = false) {
  if (!deck.editable.value) return
  menuOpen.value = false
  // Checking from the start, so the chooser does not take a moment's empty list for "fits nowhere".
  layoutsChecking.value = !fit
  layoutsFor.value = { id, fit, pictureMode, fromReview }
  if (!fit) void measureLayouts()
}
/** The chooser asks once more by itself when the answer names none (a timed-out answer does). */
async function measureLayouts() {
  const target = layoutsFor.value
  const section = sectionById(target?.id)
  if (!target || !section) {
    layoutsChecking.value = false
    return
  }
  layoutsChecking.value = true
  const fit = await deck.measure(section)
  if (layoutsFor.value !== target) return
  layoutsChecking.value = false
  target.fit = fit
}
function closeLayouts() {
  layoutsFor.value = null
  layoutsChecking.value = false
}
function pickLayout(layout: string) {
  const target = layoutsFor.value
  if (!target) return
  commitOpen('close')
  deck.setLayout(target.id, layout)
  closeLayouts()
  // Chosen to fix a send: Review asks again with it.
  if (target.fromReview) openReview()
}
function splitFromLayouts() {
  const id = layoutsFor.value?.id
  closeLayouts()
  split(id)
}
function onFieldsSplit() {
  split(settleFields())
}
function onFieldsPickLayout(fit: DeckFit | null) {
  const id = settleFields()
  if (id) openLayouts(id, fit)
}

/* ----------------------------------------------------------------- review */

// Words still open go with it: nothing typed is left out of a send.
function openReview() {
  const typing = !!dock.value
  commitOpen('send')
  dock.value = null
  panel.value = null
  menuOpen.value = false
  if (typing) telegram.hideKeyboard()
  reviewOpen.value = true
  void send.begin()
}
/** `chosen`: the person closed it, having read what it said; not so when it gives way by itself. */
function closeReview(chosen = true) {
  // A send being asked for has to hear its answer first: that answer would close the app on what came next.
  if (send.stage.value === 'sending') return
  reviewOpen.value = false
  send.dismiss(chosen)
}
function onFix(fix: { id: string; index: number; action: 'split' | 'layout' | 'pictureLayout' | 'show' }) {
  if (fix.action === 'split') {
    split(fix.id)
    void send.check()
    return
  }
  closeReview()
  if (fix.action === 'show') return showSlide(fix.id, fix.index)
  go(fix.index)
  if (sectionById(fix.id)) openLayouts(fix.id, null, fix.action === 'pictureLayout', true)
}
function showSlide(id: string, index: number) {
  if (index === 0) return openCover()
  go(Math.min(index, slides.value.length - 1))
  if (/^q\d+$/.test(id) && !sectionById(id)) {
    if (wide.value) panel.value = null
    else questionsOpen.value = true
    return
  }
  openDock(id, 'lines')
}
function onShow(index: number) {
  closeReview()
  go(index)
}

/* --------------------------------------------------------------- keyboard */

function onKeydown(event: KeyboardEvent) {
  if (deck.openState.value !== 'ready') return
  const target = event.target as HTMLElement | null
  const typing =
    !!target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)
  const meta = event.metaKey || event.ctrlKey
  // `code` as well: on a Russian layout the Z key reports "я".
  const pressed = (letter: string) =>
    event.key.toLowerCase() === letter || event.code === `Key${letter.toUpperCase()}`
  // Saving is never the browser's page save, in a field or not.
  if (meta && pressed('s')) {
    event.preventDefault()
    void deck.flush()
    return
  }
  if (typing) return
  const modal = !!document.querySelector('dialog[open][data-modal]')
  if (meta && pressed('z')) {
    event.preventDefault()
    // A sheet that waits for an answer has the screen: a step undone under it changes what it says.
    if (modal) return
    if (event.shiftKey) deck.redo()
    else deck.undo()
    return
  }
  if (modal || meta || event.altKey || event.shiftKey) return
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  // In the strip, the list and the chooser the arrows move between their own buttons.
  if (target?.closest('.deck-edit-strip, .deck-edit-list, .deck-edit-layouts')) return
  event.preventDefault()
  go(deck.current.value + (event.key === 'ArrowRight' ? 1 : -1))
}

/* ------------------------------------------------------------ page events */

/**
 * Telegram can be minimised and the app closed without warning, and the timers
 * of a hidden page may never fire: this is the last chance to send the work.
 */
function onHide() {
  commitOpen('hide')
  void deck.flush({ keepalive: true })
}
function onVisibility() {
  if (document.visibilityState === 'hidden') onHide()
}
function onBeforeUnload(event: BeforeUnloadEvent) {
  if (telegram.isMiniApp.value || !unsaved()) return
  event.preventDefault()
  event.returnValue = ''
}
// The deck saves on `online` itself; this is only what the screen says.
function onOnline() {
  online.value = true
}
function onOffline() {
  online.value = false
}

/** Sheets are measured on the height Telegram calls stable, never on one the keyboard has shrunk. */
function measureScreen() {
  if (telegram.keyboardInset.value > 0) return
  const stable = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tg-stable-h'))
  shortScreen.value = (stable > 0 ? stable : window.innerHeight) < 600
}

const TYPED = 'textarea, input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit])'
const sheetField = (node: EventTarget | null): node is HTMLElement =>
  node instanceof HTMLElement && node.matches(TYPED) && !!node.closest('.editor-sheet')
/** A field in a sheet stays in sight above the keyboard, scrolled within the sheet alone. */
function keepInSheet(field: HTMLElement) {
  const body = field.closest<HTMLElement>('.sheet-body')
  if (!body || document.activeElement !== field) return
  // What sticks at the top: the sheet's head, or the Done row standing in for it while typing.
  const head = Math.max(
    0,
    ...[...body.querySelectorAll<HTMLElement>('.sheet-head, .deck-edit-sheet-done')].map(
      (node) => node.offsetHeight,
    ),
  )
  // The bottom edge is the field's; the top is its label's, so the words saying what it is for stay in sight.
  const box = field.getBoundingClientRect()
  const top = (field.closest('label') ?? field).getBoundingClientRect().top
  const room = body.getBoundingClientRect()
  // Air around them, up to 8 px, as far as the room left by the keyboard allows: none when they barely fit.
  const air = Math.max(0, Math.min(8, (room.bottom - room.top - head - (box.bottom - top)) / 2))
  if (box.bottom > room.bottom) body.scrollTop += box.bottom - room.bottom + air
  else if (top < room.top + head) body.scrollTop -= room.top + head - top + air
}
function onFocusIn(event: FocusEvent) {
  const field = event.target
  if (!sheetField(field)) return
  sheetTyping.value = true
  field.focus({ preventScroll: true })
  void nextTick(() => keepInSheet(field))
}
/** Focus going to another control of the same sheet keeps the layout: the tap that moved it must land. */
function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget
  const sheet = event.target instanceof HTMLElement ? event.target.closest('.editor-sheet') : null
  if (sheetField(next) || (next instanceof Node && sheet?.contains(next))) return
  sheetTyping.value = false
}
/**
 * WebKit (iOS Telegram) takes a focused field away with its sheet and says nothing,
 * no focusout: the typing layout would stay, the Slides tab hidden under it.
 */
function settleSheetTyping() {
  if (sheetTyping.value && !sheetField(document.activeElement)) sheetTyping.value = false
}
watch(
  [panel, questionsOpen, reviewOpen, moreOpen, menuOpen, () => !!layoutsFor.value, () => !!dock.value],
  () => void nextTick(settleSheetTyping),
)
watch(
  () => telegram.keyboardInset.value,
  (inset) => {
    measureScreen()
    const field = document.activeElement
    if (sheetTyping.value && sheetField(field)) void nextTick(() => keepInSheet(field))
    else if (!inset) settleSheetTyping()
  },
)

onMounted(() => {
  online.value = navigator.onLine
  measureScreen()
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('pagehide', onHide)
  window.addEventListener('beforeunload', onBeforeUnload)
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  window.addEventListener('resize', measureScreen)
  document.addEventListener('visibilitychange', onVisibility)
  document.addEventListener('focusin', onFocusIn)
  document.addEventListener('focusout', onFocusOut)
})
// Runs while the children are still mounted, so their words can go in: whatever takes the page away
// without a link (a sign-out) never reaches the guards below.
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('pagehide', onHide)
  window.removeEventListener('beforeunload', onBeforeUnload)
  window.removeEventListener('online', onOnline)
  window.removeEventListener('offline', onOffline)
  window.removeEventListener('resize', measureScreen)
  document.removeEventListener('visibilitychange', onVisibility)
  document.removeEventListener('focusin', onFocusIn)
  document.removeEventListener('focusout', onFocusOut)
  if (flashTimer !== null) clearTimeout(flashTimer)
  commitOpen('leave')
  void deck.flush({ keepalive: true })
  deck.close()
  images.clear()
})
onBeforeRouteLeave(async () => {
  commitOpen('leave')
  await deck.flushBriefly()
  return true
})
// Most links stay on this route record (Tasks, another deck's Open it), and the page they open is
// set up before this one goes: another deck opened there takes the editor, and would refuse what
// is still open here. Its words go in first, to this deck.
onBeforeRouteUpdate((to, from) => {
  if (to.path !== from.path) commitOpen('leave')
})

/* -------------------------------------------------------------- open states */

const refusal = computed(() => {
  switch (deck.openState.value) {
    case 'gone':
      return { icon: 'clock', text: t('deckExpired'), action: 'again' }
    case 'not_editable':
      return { icon: 'files', text: t('deckNotEditable'), action: 'again' }
    case 'off':
      return { icon: 'lock', text: t('deckEditorOff'), action: 'tasks' }
    case 'failed':
      return { icon: 'alert', text: deck.openError.value || t('genericError'), action: 'retry' }
    default:
      return null
  }
})

const panelContent = computed(() => {
  if (slidesOpen.value) return 'slides'
  if (!wide.value) return panel.value
  if (dock.value) return 'fields'
  if (onCover.value) return 'cover'
  return onQuestions.value ? 'questions' : 'fields'
})
const panelTitle = computed(() => {
  switch (panelContent.value) {
    case 'slides':
      return t('deckTabSlides')
    case 'cover':
      return t('deckCoverDetails')
    case 'questions':
      return t('deckQuestionsTitle')
    case 'fields':
      return dock.value
        ? t('deckDockTitle', { n: fieldsNumber.value, field: t(FIELD_NAMES[dock.value.field]) })
        : t('deckSlideNumber', { n: fieldsNumber.value })
    default:
      return ''
  }
})
</script>

<template>
  <div
    class="editor-frame deck-edit"
    :class="{
      bare: frame.bare.value,
      typing: !!dock && !wide,
      'sheet-typing': sheetTyping,
      'keyboard-up': telegram.keyboardInset.value > 0,
    }"
    :data-panel="panel ?? undefined"
    data-testid="deck-editor"
  >
    <p
      v-if="deck.openState.value === 'loading'"
      class="editor-stage-status"
      role="status"
      data-testid="deck-opening"
    >
      <AppIcon name="loader" class="spin" :size="20" />{{ t('deckOpening') }}
    </p>

    <section
      v-else-if="refusal"
      class="editor-open-refusal"
      role="alert"
      data-testid="deck-refusal"
      :data-state="deck.openState.value"
    >
      <span class="result-symbol failed"><AppIcon :name="refusal.icon" :size="30" /></span>
      <p>{{ refusal.text }}</p>
      <template v-if="refusal.action === 'retry'">
        <button
          type="button"
          class="button primary"
          data-testid="deck-open-retry"
          @click="deck.open(draftId)"
        >
          {{ t('retry') }}
        </button>
        <NuxtLink :to="path('/app/jobs')" class="button secondary" data-testid="deck-tasks">{{
          t('navTasks')
        }}</NuxtLink>
      </template>
      <NuxtLink
        v-else-if="refusal.action === 'tasks'"
        :to="path('/app/jobs')"
        class="button secondary"
        data-testid="deck-tasks"
        >{{ t('navTasks') }}</NuxtLink
      >
      <NuxtLink
        v-else
        :to="path('/app/create?feature=ai.pptx')"
        class="button primary"
        data-testid="deck-make-again"
        @click="handOffPrompt"
        >{{ t('deckMakeAgain') }}</NuxtLink
      >
    </section>

    <template v-else-if="deck.openState.value === 'ready'">
      <!-- On a phone the field takes the top bar's place, over the keyboard. -->
      <DeckSlideFields
        v-if="dock && !wide && fieldsSection"
        :key="dock.session"
        ref="dockFields"
        :section="fieldsSection"
        :is-new="dock.target.id === null"
        :number="fieldsNumber"
        :field="dock.field"
        mode="dock"
        :thumb="fieldsThumb"
        :frames="fieldsImage?.frames ?? []"
        :editable="deck.editable.value"
        :locale="deck.deckLocale.value"
        :can-add="canAdd"
        @commit="onFieldsCommit"
        @close="dock = null"
        @discard="onFieldsDiscard"
        @split="onFieldsSplit"
        @pick-layout="onFieldsPickLayout"
      />
      <DeckTopBar
        v-else
        :name="deck.content.value.title || t('deckEditorTitle')"
        :until="untilText"
        :soon="deck.expiresSoon.value"
        :save-state="deck.saveState.value"
        :save-error="deck.saveError.value"
        :unsent="deck.unsent.value"
        :can-undo="deck.canUndo.value && deck.editable.value"
        :can-redo="deck.canRedo.value && deck.editable.value"
        @undo="deck.undo()"
        @redo="deck.redo()"
        @more="moreOpen = true"
      />

      <div class="editor-frame-notices">
        <section
          v-if="notice('conflict')"
          class="editor-conflict info-banner"
          role="alert"
          data-testid="deck-conflict"
        >
          <div>
            <strong>{{ t('deckConflictTitle') }}</strong>
            <p>{{ t('editorConflictBody') }}</p>
          </div>
          <span>
            <button
              type="button"
              class="button secondary small"
              data-testid="deck-conflict-take"
              @click="deck.resolveTakeServer()"
            >
              {{ t('editorConflictTakeServer') }}
            </button>
            <button
              type="button"
              class="button primary small"
              data-testid="deck-conflict-keep"
              @click="deck.resolveKeepMine()"
            >
              {{ t('editorConflictKeepMine') }}
            </button>
          </span>
        </section>
        <p v-if="notice('held')" class="info-banner" role="status" data-testid="editor-held">
          <AppIcon name="loader" class="spin" :size="17" /><span>{{ t('editorHeld') }}</span>
        </p>
        <p v-if="notice('saveFailed')" class="warning-banner" role="alert" data-testid="editor-save-failed">
          <span>{{ deck.saveError.value || t('editorNotSaved') }}</span
          ><button
            v-if="deck.saveRetryable.value"
            type="button"
            class="text-link"
            data-testid="editor-save-now"
            @click="deck.save()"
          >
            {{ t('editorSaveNow') }}</button
          ><button
            v-else
            type="button"
            class="text-link"
            data-testid="deck-save-undo"
            :disabled="!deck.canUndo.value"
            @click="deck.undo()"
          >
            {{ t('editorUndo') }}
          </button>
        </p>
        <div class="deck-edit-notice" role="status">
          <p v-if="notice('offline')" class="info-banner" data-testid="deck-offline">
            <AppIcon name="globe" :size="17" /><span>{{ t('deckOffline') }}</span>
          </p>
        </div>
        <DeckLatinOffer
          :offer="notice('latin') ? latin.offer.value : null"
          @switch="latin.accept()"
          @keep="latin.keep()"
        />
        <div class="deck-edit-notice" role="status">
          <p
            v-if="notice('preview')"
            class="info-banner"
            data-testid="deck-preview-off"
            :data-reason="deck.preview.value"
          >
            <AppIcon name="image" :size="17" /><span>{{ previewWords }}</span
            ><button
              type="button"
              class="text-link"
              data-testid="deck-preview-retry"
              @click="deck.retryPreview()"
            >
              {{ t('retry') }}
            </button>
          </p>
        </div>
        <p v-if="notice('shortened')" class="info-banner" role="status" data-testid="deck-shortened">
          <AppIcon name="alert" :size="17" /><span>{{
            count('deckSlidesHidden', deck.hiddenAtFirstRender.value)
          }}</span
          ><button
            v-if="firstHidden >= 0"
            type="button"
            class="text-link"
            data-testid="deck-shortened-show"
            @click="go(firstHidden)"
          >
            {{ t('editorShowIt') }}</button
          ><button
            type="button"
            class="icon-button"
            :aria-label="t('editorDismiss')"
            data-testid="deck-shortened-dismiss"
            @click="shortenedHidden = true"
          >
            <AppIcon name="x" :size="16" />
          </button>
        </p>
        <p v-if="notice('expiring')" class="warning-banner" role="status" data-testid="editor-expiring">
          <AppIcon name="clock" :size="17" /><span>{{ t('editorAvailableUntil', { time: untilText }) }}</span>
        </p>
      </div>

      <div class="editor-frame-work">
        <DeckSlideStrip
          v-if="wide"
          rail
          :items="pictures.items"
          :current="deck.current.value"
          :can-add="canAdd"
          :editable="deck.editable.value"
          @go="go"
          @add="addFromStrip"
        />

        <div class="editor-frame-canvas">
          <!-- Over budget, the slide's fix takes the pinned strip's place on a phone (screens.css). -->
          <div class="deck-edit-stage" :class="{ 'over-budget': tooLong !== null }">
            <DeckSlideView
              v-if="currentRef"
              :slide="currentRef"
              :image="currentImage"
              :src="pictures.current"
              :number="deck.current.value + 1"
              :total="deck.total.value"
              :heading="slideHeading"
              :stale="deck.isStale(currentRef)"
              :preview="deck.preview.value"
              :outlined="outlined"
              :editable="deck.editable.value"
              :is-cover="onCover"
              :too-long="tooLong"
              :can-split="splittable(currentSection)"
              @region="onRegion"
              @prev="go(deck.current.value - 1, true)"
              @next="go(deck.current.value + 1, true)"
              @flash="onFlash"
              @menu="openMenu"
              @cover="openCover"
              @split="split(currentSection?.id)"
              @pick-layout="currentSection && openLayouts(currentSection.id, null)"
            >
              <template #hint>
                <!-- The first-use line is `editor-hint`; the line a flash brings is not, as it comes back every visit. -->
                <p
                  v-if="hintKey"
                  class="editor-hint deck-edit-hint"
                  :data-testid="hintKey === 'deckHintTap' ? 'editor-hint' : 'deck-hint-regions'"
                >
                  {{ t(hintKey) }}
                </p>
              </template>
            </DeckSlideView>
            <DeckSlideStrip
              v-if="!wide"
              :items="pictures.items"
              :current="deck.current.value"
              :can-add="canAdd"
              :editable="deck.editable.value"
              @go="go"
              @add="addFromStrip"
            />
          </div>
          <EditorSnackbar />
        </div>

        <!-- One sheet: the Slides list or the cover's details on a phone, the panel at 980 px and over. -->
        <EditorSheet
          :open="wide || panel !== null"
          :permanent="wide"
          :size="!wide && panel === 'slides' && shortScreen ? 'tall' : 'compact'"
          :title="panelTitle"
          :testid="wide ? 'deck-panel' : panel === 'slides' ? 'deck-slides-sheet' : 'deck-cover-sheet'"
          @close="closePanel"
        >
          <DeckSlideList
            v-if="panelContent === 'slides'"
            :sections="deck.sections.value"
            :questions="questionCount"
            :current="deck.current.value"
            :thumbs="listThumbs.thumbs"
            :fits="listThumbs.fits"
            :can-add="canAdd"
            :editable="deck.editable.value"
            @go="go"
            @move="moveSlide"
            @duplicate="duplicateSlide"
            @delete="deleteSlide"
            @add="addFromList"
            @fewer="fewerQuestions"
            @remove-quiz="removeQuiz"
            @questions="openQuestions"
          />
          <DeckCoverSheet
            v-else-if="panelContent === 'cover' && coverSection"
            ref="coverForm"
            :section="coverSection"
            :title="deck.content.value.title"
            :mode="wide ? 'panel' : 'sheet'"
            :editable="deck.editable.value"
            :locale="deck.deckLocale.value"
            @commit="onCoverCommit"
          />
          <DeckQuestionsSheet
            v-else-if="panelContent === 'questions'"
            ref="questionsPanel"
            :questions="deck.content.value.questions"
            mode="panel"
            :editable="deck.editable.value"
            :locale="deck.deckLocale.value"
            @commit="onQuestionsCommit"
          />
          <DeckSlideFields
            v-else-if="panelContent === 'fields' && fieldsSection"
            :key="dock ? `dock-${dock.session}` : `slide-${fieldsSection.id}`"
            ref="panelFields"
            :section="fieldsSection"
            :is-new="!!dock && dock.target.id === null"
            :number="fieldsNumber"
            :field="dock?.field ?? 'heading'"
            mode="panel"
            :thumb="fieldsThumb"
            :frames="fieldsImage?.frames ?? []"
            :editable="deck.editable.value"
            :locale="deck.deckLocale.value"
            :can-add="canAdd"
            @commit="onFieldsCommit"
            @close="dock = null"
            @discard="onFieldsDiscard"
            @split="onFieldsSplit"
            @pick-layout="onFieldsPickLayout"
          />
        </EditorSheet>
      </div>

      <nav v-if="!dock || wide" class="editor-tabbar deck-edit-single" :aria-label="t('deckTabs')">
        <button
          type="button"
          class="editor-toolpill"
          :class="{ active: slidesOpen }"
          :aria-pressed="slidesOpen"
          data-testid="deck-tab-slides"
          @click="toggleSlides"
        >
          <AppIcon name="reorder" :size="20" /><span>{{ t('deckTabSlides') }}</span>
        </button>
      </nav>
      <EditorMainButtonFallback />

      <DeckSlideMenu
        :open="menuOpen"
        :section="currentSection"
        :number="deck.current.value + 1"
        :can-add="canAdd"
        :can-split="splittable(currentSection)"
        :editable="deck.editable.value"
        @close="menuOpen = false"
        @field="onMenuField"
        @pick-layout="currentSection && openLayouts(currentSection.id, null)"
        @split="menuSplit"
        @duplicate="menuDuplicate"
        @delete="menuDelete"
      />
      <DeckFitLayouts
        :open="!!layoutsFor"
        :current="layoutsSection?.layout ?? ''"
        :fit="layoutsFor?.fit ?? null"
        :checking="layoutsChecking"
        :picture-mode="layoutsFor?.pictureMode ?? false"
        :split-blocked="splitBlocked(layoutsSection)"
        @close="closeLayouts"
        @pick="pickLayout"
        @retry="measureLayouts"
        @split="splitFromLayouts"
      />
      <EditorSheet
        :open="questionsOpen && !wide"
        size="tall"
        modal
        :title="t('deckQuestionsTitle')"
        testid="deck-questions-sheet"
        @close="closeQuestions"
      >
        <DeckQuestionsSheet
          ref="questionsSheet"
          :questions="deck.content.value.questions"
          mode="sheet"
          :editable="deck.editable.value"
          :locale="deck.deckLocale.value"
          @commit="onQuestionsCommit"
        />
      </EditorSheet>
      <DeckMoreSheet
        v-model="moreOpen"
        :questions="questionCount > 0"
        :notes="!!currentSection"
        :editable="deck.editable.value"
        @cover="openCover"
        @questions="openQuestions"
        @notes="openNotes"
      />
      <EditorSheet
        :open="reviewOpen"
        size="tall"
        modal
        :locked="send.stage.value === 'sending'"
        :title="t(send.deliver.value === 'chat' ? 'editorReviewSend' : 'editorReviewDownload')"
        testid="deck-review-sheet"
        @close="closeReview"
      >
        <DeckReview @close="closeReview" @fix="onFix" @show="onShow" />
      </EditorSheet>
    </template>
  </div>
</template>
