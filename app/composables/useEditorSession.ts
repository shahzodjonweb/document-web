/**
 * Editor document state: commands, selection, history, autosave and export.
 *
 * The server replaces the whole command array on every PATCH and demands the
 * exact current `version`, so this keeps one write in flight at a time and
 * reconciles the normalised response rather than assuming it round-trips.
 *
 * A command with an issue never goes out, because the server would refuse the
 * whole array for it. It stays in the list, in its place, until it is complete,
 * and Review and export refuse while it is there. They also refuse text that runs
 * past the page, which saves like any other and only the file cannot be made from.
 */
import {
  COMMAND_SHAPE,
  adoptServerCommands,
  commandIssues,
  newCommandId,
  payloadBudget,
  renumberInputs,
  seedCommand,
  toServerCommands,
  type ClientCommand,
  type CommandType,
  type DraftLimits,
  type Issue,
  type ServerCommand,
} from './useEditorCommands'
import { clampCommand, type PageSize } from './useEditorGeometry'
import { editTextFit, linesOn } from './useEditorTextLayer'

export type EditorMode = 'edit' | 'pages' | 'redact'
export type SaveState = 'clean' | 'dirty' | 'saving' | 'saved' | 'failed' | 'paused'
export type Tool = 'select' | CommandType
/** Where a send of the stored draft goes: back to the Telegram chat, or to this browser. */
export type Deliver = 'chat' | 'download'

/** A refusal as the server gave it, for the screen that has a state for each code. */
export interface Refusal {
  code: string
  message: string
  params: Record<string, any>
  status?: number
}

export interface QuoteCost {
  kind: 'file_task' | 'included' | 'none'
  left: number | null
  limit: number | null
}
export interface QuoteSummary {
  changes_by_page: Record<string, number>
  pages_before: number
  pages_after: number
  raster_pages: number[]
  size_estimate: number
  kept_until: string
  cost: QuoteCost
}
export interface DraftQuote {
  id: string
  expires_at: string
  affordable?: boolean
  summary?: QuoteSummary
}

export interface EditorDocument {
  id: string
  version: number
  file: { id: string; name: string; page_count: number; expires_at?: string }
  pages: PageSize[]
  form_fields: { name: string; type: string }[]
  image_counts: number[]
  commands: ClientCommand[]
  input_ids: string[]
  limits?: DraftLimits
}

interface Snapshot {
  commands: ClientCommand[]
  selection: string[]
  label: string
  at: number
}

const AUTOSAVE_DELAY = 900
/** A save the server holds back for a moment, as while a generation runs, goes again after this. */
const BUSY_RETRY = 2000
const HISTORY_LIMIT = 50
const COALESCE_WINDOW = 500
const DUPLICATE_OFFSET = 12
/** Browsers refuse a `keepalive` request over 64 KiB; a bigger draft goes as a normal one. */
const KEEPALIVE_BYTES = 60000
/** How long leaving a document waits for its last write, which finishes on its own regardless. */
const LEAVE_WAIT = 3000
/** What the export engine can draw. The upload route takes documents and TIFF as well. */
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']

/**
 * What every `useEditorSession()` call shares about one document: each editor
 * component makes its own call, and they all undo one history and wait behind
 * one save. Plain data, because nothing here needs reactivity beyond `canUndo`,
 * `canRedo` and `saveState`.
 */
interface DocumentState {
  past: Snapshot[]
  future: Snapshot[]
  saveTimer: number | null
  /** The write in flight; the next one waits for it, as each PATCH needs the version it returns. */
  saving: Promise<boolean> | null
  /** The commands and inputs the server last confirmed, in the form `fingerprint` gives them. */
  onServer: string
  /**
   * Each draft sent with no answer since the last write that got one, in the same
   * form. Any of them may be the one that landed, however long ago, so none is let go.
   */
  unanswered: Set<string>
}

const documents = new Map<string, DocumentState>()
/** Counts `reset` calls, so a slow one cannot replace the document asked for after it. */
let opens = 0

function documentState(id: string): DocumentState {
  let state = documents.get(id)
  if (!state) {
    state = { past: [], future: [], saveTimer: null, saving: null, onServer: '', unanswered: new Set() }
    documents.set(id, state)
  }
  return state
}

/** Whitelisted fields in a fixed order, whatever order the database handed them back in. */
function fingerprint(commands: ServerCommand[], inputIds: string[]) {
  return JSON.stringify([toServerCommands(commands), inputIds])
}

export function useEditorSession() {
  const ws = useWorkspace()
  const { t } = useLocale()
  const metrics = useEditorFontMetrics()

  const doc = useState<EditorDocument | null>('editor-doc', () => null)
  const commands = useState<ClientCommand[]>('editor-commands', () => [])
  const selection = useState<string[]>('editor-selection', () => [])
  const editingId = useState('editor-editing', () => '')
  const activeTool = useState<Tool>('editor-tool', () => 'select')
  const mode = useState<EditorMode>('editor-mode', () => 'edit')
  const zoom = useState('editor-zoom', () => 1)
  const fitMode = useState<'width' | 'page' | 'custom'>('editor-fit', () => 'width')
  const assets = useState<any[]>('editor-assets', () => [])
  const busy = useState<string[]>('editor-busy', () => [])
  const saveState = useState<SaveState>('editor-save-state', () => 'clean')
  const conflict = useState('editor-conflict', () => false)
  const error = useState('editor-error', () => '')
  /** Why the server refused the last save, kept apart as the action bar is where it shows. */
  const saveError = useState('editor-save-error', () => '')
  const notice = useState('editor-notice', () => '')
  const quote = useState<any>('editor-quote', () => null)
  const submissionPending = useState('editor-submission-pending', () => false)
  const canUndo = useState('editor-can-undo', () => false)
  const canRedo = useState('editor-can-redo', () => false)
  /**
   * A send in flight: its job reads the draft when it starts, and a draft changed
   * before then fails it with `version_conflict`. So nothing changes meanwhile.
   */
  const held = useState('editor-held', () => false)
  /** Goes up with every change to the history, so an offer to undo one step can tell it is still the last. */
  const steps = useState('editor-steps', () => 0)

  const openDocument = () => documentState(doc.value?.id ?? '')
  /** The open document's state, if it has one, without making one: it changes when the document is left or opened again. */
  const openedState = (): object | null => documents.get(doc.value?.id ?? '') ?? null

  const isBusy = (task: string) => busy.value.includes(task)
  function begin(task: string) {
    if (!busy.value.includes(task)) busy.value = [...busy.value, task]
  }
  function end(task: string) {
    busy.value = busy.value.filter((value) => value !== task)
  }

  const pageSize = (page: number): PageSize => doc.value?.pages[page - 1] ?? { width: 595.276, height: 841.89 }
  const selected = computed(() => commands.value.filter((command) => selection.value.includes(command._id)))
  const budget = computed(() => payloadBudget(commands.value, doc.value?.limits))

  /** The engine never wraps, and fails the whole job for one line past the page. */
  function overflowIssue(command: ClientCommand): Issue | null {
    if (command.type !== 'add_text' || !metrics.ready.value) return null
    const page = pageSize(command.page ?? 1)
    const { horizontal, vertical } = metrics.textOverflow(
      command.text ?? '',
      command.font_size ?? 16,
      command.x ?? 0,
      command.y ?? 0,
      page.width,
      page.height,
    )
    return horizontal || vertical ? { id: command._id, code: 'editorTextOverflow' } : null
  }

  /**
   * A line of the file's own words given more than the server can shrink to fit:
   * saved like any other change, and only the file cannot be made from it.
   */
  function tooLongIssue(command: ClientCommand): Issue | null {
    if (command.type !== 'edit_text' || !metrics.ready.value) return null
    const page = command.page ?? 1
    const fit = editTextFit(command, pageSize(page), linesOn(page), metrics.stringWidth)
    return fit.state === 'tooLong' ? { id: command._id, code: 'editorEditTextTooLong' } : null
  }

  const issues = computed<Issue[]>(() =>
    commands.value
      // The mark being typed into is not a problem yet.
      .filter((command) => command._id !== editingId.value)
      .map(
        (command) =>
          commandIssues(command, assets.value.length) ?? overflowIssue(command) ?? tooLongIssue(command),
      )
      .filter((issue): issue is Issue => issue !== null),
  )

  function requestError(e: any) {
    return e?.data?.error?.message || e?.data?.message || t('genericError')
  }

  /** Which change it is, numbered as the list of changes numbers it, and what it lacks. */
  function describeIssue(issue: Issue) {
    const index = commands.value.findIndex((command) => command._id === issue.id)
    const command = commands.value[index]
    return command
      ? `${index + 1}. ${t(COMMAND_SHAPE[command.type].labelKey)}: ${t(issue.code)}`
      : t(issue.code)
  }

  /**
   * Two versions exist and only the customer can say which stands, so autosave
   * waits for that, and a quote made from one of them goes.
   */
  function holdForChoice() {
    conflict.value = true
    saveState.value = 'paused'
    saveError.value = ''
    quote.value = null
  }

  function syncHistoryFlags() {
    const { past, future } = openDocument()
    canUndo.value = past.length > 0
    canRedo.value = future.length > 0
    steps.value += 1
  }

  /**
   * Every command change goes through here. Consecutive changes sharing a
   * label within half a second collapse into one undo entry, so a drag or a
   * burst of typing is a single step. `amend` folds a change into the step
   * before it, however long ago that was, and leaves no step at all when the
   * two together changed nothing. False when nothing changed, as while a send holds the draft.
   */
  function mutate(label: string, apply: () => void, options: { silent?: boolean; amend?: boolean } = {}) {
    if (held.value) return false
    if (options.silent) {
      apply()
      return true
    }
    const { past, future } = openDocument()
    const previous = past[past.length - 1]
    const now = Date.now()
    if (previous && (options.amend || (previous.label === label && now - previous.at <= COALESCE_WINDOW))) {
      previous.at = now
      previous.label = label
    } else {
      past.push({ commands: toPlain(commands.value), selection: [...selection.value], label, at: now })
      if (past.length > HISTORY_LIMIT) past.shift()
    }
    future.length = 0
    apply()
    if (
      options.amend &&
      previous &&
      JSON.stringify(toServerCommands(previous.commands)) === JSON.stringify(toServerCommands(commands.value))
    )
      past.pop()
    syncHistoryFlags()
    markDirty()
    return true
  }

  // structuredClone cannot handle Vue proxies directly in every browser.
  function toPlain(value: ClientCommand[]): ClientCommand[] {
    return JSON.parse(JSON.stringify(value))
  }

  function restore(snapshot: Snapshot) {
    commands.value = snapshot.commands
    selection.value = snapshot.selection.filter((id) => snapshot.commands.some((command) => command._id === id))
    // An open text field goes with its mark, and stays closed if Redo brings the mark back.
    if (!snapshot.commands.some((command) => command._id === editingId.value)) editingId.value = ''
  }

  function undo() {
    if (held.value) return
    const { past, future } = openDocument()
    const snapshot = past.pop()
    if (!snapshot) return
    // A field still empty is dropped as closing it would drop it, with nothing for Redo to bring back;
    // so is a change of the file's own words still holding them as they were, which is no change.
    const typing = commands.value.find((command) => command._id === editingId.value)
    const nothing =
      typing?.type === 'edit_text'
        ? (typing.text ?? '').trim() === (typing.original ?? '').trim()
        : !typing?.text?.trim()
    if (!typing || !nothing)
      future.push({
        commands: toPlain(commands.value),
        selection: [...selection.value],
        label: snapshot.label,
        at: Date.now(),
      })
    restore(snapshot)
    syncHistoryFlags()
    markDirty()
  }

  function redo() {
    if (held.value) return
    const { past, future } = openDocument()
    const snapshot = future.pop()
    if (!snapshot) return
    past.push({
      commands: toPlain(commands.value),
      selection: [...selection.value],
      label: snapshot.label,
      at: Date.now(),
    })
    restore(snapshot)
    syncHistoryFlags()
    markDirty()
  }

  function markDirty() {
    quote.value = null
    saveError.value = ''
    // An export that may have failed will not be retried now: its quote has just gone.
    if (submissionPending.value) {
      submissionPending.value = false
      sessionStorage.removeItem('docmaster-pending-job')
    }
    if (saveState.value === 'paused') return
    saveState.value = 'dirty'
    // A send holds the draft until its job has read it: this goes once it lets go.
    if (held.value) return
    const state = openDocument()
    if (state.saveTimer !== null) clearTimeout(state.saveTimer)
    state.saveTimer = window.setTimeout(() => {
      state.saveTimer = null
      void save()
    }, AUTOSAVE_DELAY)
  }

  /**
   * Attach an image for signature/insert_image/replace_image. Index 0 is the
   * source PDF, so the first upload is `input_index` 1. `refused` hears why not, for
   * the chooser to say beside the button: the top of the screen is out of sight on a phone.
   */
  async function uploadAsset(file: File, refused: (why: string) => void): Promise<number | null> {
    // Nothing new goes into a draft a send holds; one already on its way lands and waits.
    if (held.value) return null
    const state = openDocument()
    begin('asset')
    error.value = ''
    try {
      const body = new FormData()
      body.append('file', file)
      const asset = await ws.api<{ id: string; name: string; mime_type: string }>('/files/uploads', {
        method: 'POST',
        body,
      })
      // `accept` is only a hint to the picker. Anything else, once attached, would
      // have the server refuse every later save, and nothing here can detach it.
      if (!IMAGE_TYPES.includes(asset.mime_type)) {
        refused(t('editorImageRefused'))
        return null
      }
      // Finished after a `reset`, or while one is leaving the document, it is no image of what is open
      // now: the draft is on its way out, and a change to it now would not be saved.
      if (openDocument() !== state || isBusy('load')) return null
      assets.value = [...assets.value, asset]
      // Attaching an image changes input_ids, which only a save persists.
      markDirty()
      return assets.value.length
    } catch (e) {
      refused(requestError(e))
      return null
    } finally {
      end('asset')
    }
  }

  /** `extra` is what a placing tool knows better than the seed: the words, the size, the line. */
  function addCommand(
    type: CommandType,
    at: { page: number; x?: number; y?: number },
    extra: Partial<Omit<ClientCommand, '_id' | 'type'>> = {},
  ) {
    if (held.value) return null
    if (budget.value.full) {
      error.value = t('editorBudgetFull')
      return null
    }
    const command = clampCommand(
      // With nothing attached yet the command deliberately points at 0, which
      // `commandIssues` reports as "choose an image" instead of letting the
      // server reject an index that does not exist.
      { ...seedCommand(type, { ...at, inputIndex: assets.value.length ? 1 : 0 }), ...extra },
      pageSize(at.page),
    )
    // Placing is one step each time, however quickly the next one follows.
    mutate(`add:${command._id}`, () => {
      commands.value = [...commands.value, command]
      selection.value = [command._id]
    })
    return command
  }

  /** A copy of every field, a little down and to the right, on top of the others. */
  function duplicateCommand(id: string) {
    const source = commands.value.find((command) => command._id === id)
    if (!source || held.value) return null
    if (budget.value.full) {
      error.value = t('editorBudgetFull')
      return null
    }
    const copy: ClientCommand = { ...JSON.parse(JSON.stringify(source)), _id: newCommandId() }
    if (copy.x !== undefined) copy.x += DUPLICATE_OFFSET
    if (copy.y !== undefined) copy.y += DUPLICATE_OFFSET
    if (copy.points) copy.points = copy.points.map(([x, y]) => [x + DUPLICATE_OFFSET, y + DUPLICATE_OFFSET])
    const command = copy.page ? clampCommand(copy, pageSize(copy.page)) : copy
    mutate(`add:${command._id}`, () => {
      commands.value = [...commands.value, command]
      selection.value = [command._id]
    })
    return command
  }

  function patchCommand(
    id: string,
    patch: Partial<ClientCommand>,
    label = 'edit',
    mode: 'move' | 'resize' = 'move',
    options: { amend?: boolean } = {},
  ) {
    const current = commands.value.find((command) => command._id === id)
    return mutate(
      label,
      () => {
        commands.value = commands.value.map((command) => {
          if (command._id !== id) return command
          const next = { ...command, ...patch } as ClientCommand
          if (next.page === undefined) return next
          next.page = Math.max(1, Math.min(Math.round(next.page) || 1, doc.value?.file.page_count ?? 1000))
          return clampCommand(next, pageSize(next.page), mode)
        })
      },
      // The first words of a mark belong to placing it, and every point of a line
      // does: one Undo takes it all away, rather than leaving an empty mark or part
      // of a line behind.
      { amend: options.amend ?? ('points' in patch || ('text' in patch && !current?.text)) },
    )
  }

  /**
   * A mark placed before its picture finished uploading points at 0 until now. It
   * takes its picture everywhere it is, Undo's copies too, so no step brings back
   * a mark that has none; nothing else of that step changes.
   */
  function attachInput(id: string, index: number) {
    const { past, future } = openDocument()
    const fix = (list: ClientCommand[]) =>
      list.map((command) =>
        command._id === id && !command.input_index ? { ...command, input_index: index } : command,
      )
    for (const snapshot of [...past, ...future]) snapshot.commands = fix(snapshot.commands)
    commands.value = fix(commands.value)
    markDirty()
  }

  /** Drawn under or over the marks it overlaps on its page: the engine draws them in order. */
  function restack(id: string, direction: -1 | 1) {
    const list = commands.value
    const index = list.findIndex((command) => command._id === id)
    const page = list[index]?.page
    if (index < 0 || page === undefined) return false
    // Only another mark on that page: a page's own changes keep their place.
    const mark = (command: ClientCommand) =>
      command.page === page && (COMMAND_SHAPE[command.type].positional || command.type === 'draw')
    let other = index + direction
    while (other >= 0 && other < list.length && !mark(list[other]!)) other += direction
    if (other < 0 || other >= list.length) return false
    mutate(`restack:${id}`, () => {
      const next = [...list]
      ;[next[index], next[other]] = [next[other]!, next[index]!]
      commands.value = next
    })
    return true
  }

  /** `amend` is for dropping an empty mark, which should leave nothing to undo but the steps before it. */
  function removeCommands(ids: string[], options: { amend?: boolean } = {}) {
    return mutate(
      `remove:${ids.join()}`,
      () => {
        commands.value = commands.value.filter((command) => !ids.includes(command._id))
        selection.value = selection.value.filter((id) => !ids.includes(id))
      },
      options,
    )
  }

  function select(id: string | null, additive = false) {
    if (id === null) selection.value = []
    else if (additive)
      selection.value = selection.value.includes(id)
        ? selection.value.filter((value) => value !== id)
        : [...selection.value, id]
    else selection.value = [id]
  }

  /**
   * Resolves true once the server holds everything sendable that was here when
   * this was called. Whoever asks during a write waits for it, then sends what
   * is newest by then, so a save never overlaps another and never goes missing.
   */
  async function save(): Promise<boolean> {
    const current = doc.value
    if (!current || saveState.value === 'paused' || held.value) return false
    const state = documentState(current.id)
    if (state.saveTimer !== null) {
      clearTimeout(state.saveTimer)
      state.saveTimer = null
    }
    if (state.saving) {
      await state.saving
      return save()
    }
    const write = send(current, state)
    state.saving = write
    try {
      return await write
    } finally {
      state.saving = null
    }
  }

  async function send(current: EditorDocument, state: DocumentState): Promise<boolean> {
    const incomplete = commands.value.filter((command) => commandIssues(command, assets.value.length))
    const held = new Set(incomplete.map((command) => command._id))
    const payload = toServerCommands(commands.value.filter((command) => !held.has(command._id)))
    const inputIds = [current.file.id, ...assets.value.map((asset) => asset.id)]
    const sending = fingerprint(payload, inputIds)
    // The server has all of it, as when only an incomplete mark changed. Writing
    // anyway would use up a version, and read as a conflict on another device.
    // A write with no answer may have changed that, so only one that was answered says so.
    if (sending === state.onServer && !state.unanswered.size) {
      saveState.value = 'saved'
      error.value = ''
      saveError.value = ''
      return true
    }
    saveState.value = 'saving'
    const body = { version: current.version, commands: payload, input_ids: inputIds }
    try {
      const fresh = await ws.api<EditorDocument>(`/editor/documents/${current.id}`, {
        method: 'PATCH',
        body,
        // The app can close while any write is on its way, not just one sent as it hides.
        keepalive: new TextEncoder().encode(JSON.stringify(body)).length <= KEEPALIVE_BYTES,
      })
      state.onServer = fingerprint(fresh.commands ?? [], inputIds)
      state.unanswered.clear()
      // Sent before a `reset`, it has no say over what is open now, even the same document again.
      if (documents.get(current.id) !== state) return true
      // A re-render puts every field back to its saved value, wiping whatever is
      // being typed in one. So a save touches only what it changed: the version
      // in place, and the commands when normalising altered them.
      current.version = fresh.version
      // Adopt the server's normalised commands only when nothing changed while
      // the request was in flight — otherwise the user's newer edit wins and
      // the next save normalises it.
      if (saveState.value === 'saving') {
        const adopted = adoptServerCommands(fresh.commands ?? [], commands.value, held)
        if (JSON.stringify(toServerCommands(adopted)) !== JSON.stringify(toServerCommands(commands.value)))
          commands.value = adopted
        saveState.value = 'saved'
      }
      error.value = ''
      saveError.value = ''
      return true
    } catch (e: any) {
      if (documents.get(current.id) !== state) return false
      if (e?.data?.error?.code === 'version_conflict') return onVersionConflict(current, state, e)
      // Held back while a generation runs, not refused: it goes again by itself, and says nothing.
      if (e?.data?.error?.code === 'generation_running') return retryLater(state)
      // Not an answer from the server itself, so it may still have landed.
      if (!e?.data?.error) state.unanswered.add(sending)
      return saveRefused(e)
    }
  }

  function retryLater(state: DocumentState) {
    saveState.value = 'dirty'
    if (state.saveTimer !== null) clearTimeout(state.saveTimer)
    state.saveTimer = window.setTimeout(() => {
      state.saveTimer = null
      void save()
    }, BUSY_RETRY)
    return false
  }

  /** Any refusal but a conflict is shown, and the next edit tries again: it may be the fix. */
  function saveRefused(e: unknown) {
    saveState.value = 'failed'
    saveError.value = requestError(e)
    return false
  }

  /**
   * A write can land with its answer lost, as when the app is hidden straight
   * after it, and the next one then reads as a conflict with a device that does
   * not exist. So look first: only something else on the server is a choice.
   */
  async function onVersionConflict(
    current: EditorDocument,
    state: DocumentState,
    refusal: unknown,
  ): Promise<boolean> {
    if (state.unanswered.size) {
      let latest: EditorDocument
      try {
        latest = await ws.api<EditorDocument>(`/editor/documents/${current.id}`)
      } catch (e) {
        return documents.get(current.id) === state ? saveRefused(e) : false
      }
      if (documents.get(current.id) !== state) return false
      const onServer = fingerprint(latest.commands ?? [], latest.input_ids ?? [])
      const ours = state.unanswered.has(onServer)
      state.unanswered.clear()
      if (ours) {
        state.onServer = onServer
        current.version = latest.version
        return send(current, state)
      }
    }
    holdForChoice()
    error.value = requestError(refusal)
    return false
  }

  /**
   * Send what is waiting now, because a hidden or closing app may never run the
   * timer. Resolves when this document's writes are done.
   */
  async function flush() {
    if (saveState.value === 'dirty' || saveState.value === 'failed') await save()
    else await documents.get(doc.value?.id ?? '')?.saving
  }

  /** Leaving holds the customer up only so long: a write already sent finishes on its own. */
  function flushBriefly() {
    return Promise.race([flush(), new Promise<void>((resolve) => setTimeout(resolve, LEAVE_WAIT))])
  }

  /**
   * The images a draft holds, in the server's order, as `input_index` counts them.
   * `null` is one the server says has gone, which would have it refuse every save
   * and quote until let go. One that merely could not be read keeps its place.
   */
  function readAssets(inputIds: string[]) {
    return Promise.all(
      inputIds.slice(1).map((id) =>
        ws.api<any>(`/files/${id}`).then(
          (asset) => (asset.state === 'ready' ? asset : null),
          (e) => (e?.statusCode === 404 ? null : { id, name: '' }),
        ),
      ),
    )
  }

  /** Take a document as the server holds it, all at once, so that nothing can be edited half known. */
  function adopt(fresh: EditorDocument, attached: any[]) {
    doc.value = fresh
    commands.value = renumberInputs(adoptServerCommands(fresh.commands ?? [], []), attached.map(Boolean))
    assets.value = attached.filter(Boolean)
    selection.value = []
    const state = documentState(fresh.id)
    state.onServer = fingerprint(fresh.commands ?? [], fresh.input_ids ?? [])
    state.unanswered.clear()
    conflict.value = false
    error.value = ''
    saveError.value = ''
    saveState.value = 'clean'
    // Letting an image go is a change the server has yet to hear, and Review needs it to.
    if (attached.includes(null)) markDirty()
  }

  /** Take the server's version and drop local edits. */
  async function resolveTakeServer() {
    const current = doc.value
    if (!current) return
    const fresh = await ws.api<EditorDocument>(`/editor/documents/${current.id}`)
    const attached = await readAssets(fresh.input_ids ?? [])
    if (doc.value?.id !== current.id) return
    adopt(fresh, attached)
    const state = documentState(current.id)
    state.past.length = 0
    state.future.length = 0
    syncHistoryFlags()
  }

  /** Re-issue the local commands against whatever version now exists. */
  async function resolveKeepMine() {
    const current = doc.value
    if (!current) return
    const state = documentState(current.id)
    const fresh = await ws.api<EditorDocument>(`/editor/documents/${current.id}`)
    // Asked before a `reset`, it has no say over what is open now: `save` would send
    // that document's marks, or none, over this one's.
    if (documents.get(current.id) !== state) return
    doc.value = { ...current, version: fresh.version }
    state.onServer = fingerprint(fresh.commands ?? [], fresh.input_ids ?? [])
    conflict.value = false
    // Its "reload" would now throw away the very edits just kept.
    error.value = ''
    saveState.value = 'dirty'
    await save()
  }

  async function reset(documentId?: string) {
    const opening = ++opens
    // While this is busy no document is on screen, so nothing can be edited and then lost.
    begin('load')
    try {
      // What is waiting goes out first, so nothing is lost and a document reopened
      // straight away loads what its last write saved.
      await flushBriefly()
      const previous = doc.value?.id ?? ''
      const state = documents.get(previous)
      if (state?.saveTimer != null) clearTimeout(state.saveTimer)
      documents.delete(previous)
      canUndo.value = false
      canRedo.value = false
      commands.value = []
      selection.value = []
      editingId.value = ''
      assets.value = []
      quote.value = null
      conflict.value = false
      error.value = ''
      saveError.value = ''
      notice.value = ''
      submissionPending.value = false
      held.value = false
      activeTool.value = 'select'
      mode.value = 'edit'
      fitMode.value = 'width'
      saveState.value = 'clean'
      doc.value = null
      if (documentId) await load(documentId, () => opening !== opens)
    } finally {
      if (opening === opens) end('load')
    }
  }

  async function load(documentId: string, superseded = () => false) {
    try {
      const fresh = await ws.api<EditorDocument>(`/editor/documents/${documentId}`)
      const attached = await readAssets(fresh.input_ids ?? [])
      if (!superseded()) adopt(fresh, attached)
    } catch (e) {
      if (!superseded()) error.value = requestError(e)
    }
  }

  /** The file is made from what was saved: rather than leave a change out, say which one is in the way. */
  function refusedForIssues() {
    const issue = issues.value[0]
    if (issue) error.value = describeIssue(issue)
    return !!issue
  }

  /** A refusal's code, words and parameters; one with no answer from the server is `unanswered`. */
  function refusalOf(e: any): Refusal {
    const refused = e?.data?.error
    return {
      code: refused?.code || 'unanswered',
      message: requestError(e),
      params: refused?.message_params ?? {},
      status: e?.statusCode || e?.status || e?.response?.status,
    }
  }

  /**
   * Quotes what the server holds. With `deliver` this is a send of the stored draft:
   * the answer carries its `summary`, and a refusal comes back to say rather than
   * landing in `error`, as the Review sheet has a state for each code. Without it,
   * today's editor's quote, whose marks travel with it.
   */
  async function review(
    acceptRasterization = false,
    deliver?: Deliver,
  ): Promise<DraftQuote | Refusal | null> {
    const current = doc.value
    if (!current || isBusy('quote') || submissionPending.value) return null
    if (!deliver && refusedForIssues()) return null
    begin('quote')
    if (!deliver) error.value = ''
    try {
      if (saveState.value !== 'saved' && saveState.value !== 'clean') {
        const ok = await save()
        if (!ok)
          return {
            code: saveState.value === 'paused' ? 'version_conflict' : 'not_saved',
            message: '',
            params: {},
          }
      }
      const fresh = doc.value
      if (!fresh) return null
      const { id, version } = fresh
      const made = await ws.api<DraftQuote>(`/editor/documents/${id}/quote`, {
        method: 'POST',
        body: deliver
          ? { version, deliver, accept_rasterization: acceptRasterization }
          : { version, accept_rasterization: acceptRasterization },
      })
      // A change made meanwhile is not in this quote, and Export would leave it out.
      const unchanged = doc.value?.id === id && doc.value.version === version
      const settled = saveState.value === 'saved' || saveState.value === 'clean'
      if (unchanged && settled) quote.value = made
      return unchanged && settled ? made : { code: 'changed_meanwhile', message: '', params: {} }
    } catch (e: any) {
      if (e?.data?.error?.code === 'version_conflict') holdForChoice()
      if (!deliver) error.value = requestError(e)
      return refusalOf(e)
    } finally {
      end('quote')
    }
  }

  const idempotency = useState<Record<string, string>>('idempotency', () => ({}))

  async function exportDocument() {
    const active = quote.value
    if (!active || isBusy('export') || active.affordable === false || refusedForIssues()) return
    begin('export')
    error.value = ''
    // Keyed by quote id so a double-click cannot submit two jobs.
    if (!idempotency.value[active.id]) idempotency.value[active.id] = crypto.randomUUID()
    const key = idempotency.value[active.id] as string
    submissionPending.value = true
    sessionStorage.setItem('docmaster-pending-job', JSON.stringify({ quote_id: active.id, key }))
    try {
      const job = await ws.api<{ id: string }>('/jobs', {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: { quote_id: active.id },
      })
      sessionStorage.removeItem('docmaster-pending-job')
      submissionPending.value = false
      await ws.loadAccount()
      await navigateTo(useLocale().path(`/app/jobs/${job.id}`))
    } catch (e: any) {
      // A refused request is decided. An uncertain one must be retried with the
      // same quote and key so the server settles it exactly once.
      const status = e?.statusCode || e?.status || e?.response?.status
      if (status >= 400 && status < 500) {
        submissionPending.value = false
        sessionStorage.removeItem('docmaster-pending-job')
        if (e?.data?.error?.code === 'quote_expired') quote.value = null
      }
      error.value = requestError(e)
    } finally {
      end('export')
    }
  }

  return {
    doc,
    commands,
    selection,
    editingId,
    selected,
    activeTool,
    mode,
    zoom,
    fitMode,
    assets,
    saveState,
    conflict,
    held,
    steps,
    error,
    saveError,
    notice,
    quote,
    submissionPending,
    canUndo,
    canRedo,
    budget,
    issues,
    isBusy,
    openedState,
    begin,
    end,
    pageSize,
    mutate,
    uploadAsset,
    addCommand,
    duplicateCommand,
    patchCommand,
    attachInput,
    restack,
    removeCommands,
    select,
    undo,
    redo,
    save,
    flush,
    flushBriefly,
    load,
    reset,
    review,
    exportDocument,
    resolveTakeServer,
    resolveKeepMine,
    requestError,
    refusalOf,
    describeIssue,
    holdForChoice,
  }
}
