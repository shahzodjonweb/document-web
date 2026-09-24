/**
 * Editor document state: commands, selection, history, autosave and export.
 *
 * The server replaces the whole command array on every PATCH and demands the
 * exact current `version`, so this keeps one write in flight at a time and
 * reconciles the normalised response rather than assuming it round-trips.
 */
import {
  adoptServerCommands,
  commandIssues,
  payloadBudget,
  seedCommand,
  toServerCommands,
  type ClientCommand,
  type CommandType,
  type Issue,
} from './useEditorCommands'
import { clampCommand, type PageSize } from './useEditorGeometry'

export type EditorMode = 'edit' | 'pages' | 'redact'
export type SaveState = 'clean' | 'dirty' | 'saving' | 'saved' | 'failed' | 'paused'
export type Tool = 'select' | CommandType

export interface EditorDocument {
  id: string
  version: number
  file: { id: string; name: string; page_count: number; expires_at?: string }
  pages: PageSize[]
  form_fields: { name: string; type: string }[]
  image_counts: number[]
  commands: ClientCommand[]
  input_ids: string[]
}

interface Snapshot {
  commands: ClientCommand[]
  selection: string[]
  label: string
  at: number
}

const AUTOSAVE_DELAY = 900
const HISTORY_LIMIT = 50
const COALESCE_WINDOW = 500

export function useEditorSession() {
  const ws = useWorkspace()
  const { t } = useLocale()

  const doc = useState<EditorDocument | null>('editor-doc', () => null)
  const commands = useState<ClientCommand[]>('editor-commands', () => [])
  const selection = useState<string[]>('editor-selection', () => [])
  const activeTool = useState<Tool>('editor-tool', () => 'select')
  const mode = useState<EditorMode>('editor-mode', () => 'edit')
  const zoom = useState('editor-zoom', () => 1)
  const fitMode = useState<'width' | 'page' | 'custom'>('editor-fit', () => 'width')
  const assets = useState<any[]>('editor-assets', () => [])
  const busy = useState<string[]>('editor-busy', () => [])
  const saveState = useState<SaveState>('editor-save-state', () => 'clean')
  const conflict = useState('editor-conflict', () => false)
  const error = useState('editor-error', () => '')
  const notice = useState('editor-notice', () => '')
  const quote = useState<any>('editor-quote', () => null)
  const submissionPending = useState('editor-submission-pending', () => false)
  const canUndo = useState('editor-can-undo', () => false)
  const canRedo = useState('editor-can-redo', () => false)

  // Plain module-scope stacks: history is large-ish and never needs reactivity
  // beyond the two booleans above.
  const past: Snapshot[] = []
  const future: Snapshot[] = []
  let saveTimer: number | null = null
  let saving = false
  let saveAgain = false

  const isBusy = (task: string) => busy.value.includes(task)
  function begin(task: string) {
    if (!busy.value.includes(task)) busy.value = [...busy.value, task]
  }
  function end(task: string) {
    busy.value = busy.value.filter((value) => value !== task)
  }

  const pageSize = (page: number): PageSize => doc.value?.pages[page - 1] ?? { width: 595.276, height: 841.89 }
  const selected = computed(() => commands.value.filter((command) => selection.value.includes(command._id)))
  const budget = computed(() => payloadBudget(commands.value))
  const issues = computed<Issue[]>(() =>
    commands.value.map(commandIssues).filter((issue): issue is Issue => issue !== null),
  )

  function requestError(e: any) {
    return e?.data?.error?.message || e?.data?.message || t('genericError')
  }

  function syncHistoryFlags() {
    canUndo.value = past.length > 0
    canRedo.value = future.length > 0
  }

  /**
   * Every command change goes through here. Consecutive changes sharing a
   * label within half a second collapse into one undo entry, so a drag or a
   * burst of typing is a single step.
   */
  function mutate(label: string, apply: () => void, options: { silent?: boolean } = {}) {
    if (!options.silent) {
      const previous = past[past.length - 1]
      const now = Date.now()
      if (!previous || previous.label !== label || now - previous.at > COALESCE_WINDOW) {
        past.push({
          commands: structuredClone(toPlain(commands.value)),
          selection: [...selection.value],
          label,
          at: now,
        })
        if (past.length > HISTORY_LIMIT) past.shift()
      } else previous.at = now
      future.length = 0
      syncHistoryFlags()
    }
    apply()
    if (!options.silent) markDirty()
  }

  // structuredClone cannot handle Vue proxies directly in every browser.
  function toPlain(value: ClientCommand[]): ClientCommand[] {
    return JSON.parse(JSON.stringify(value))
  }

  function restore(snapshot: Snapshot) {
    commands.value = snapshot.commands
    selection.value = snapshot.selection.filter((id) => snapshot.commands.some((command) => command._id === id))
  }

  function undo() {
    const snapshot = past.pop()
    if (!snapshot) return
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
    if (saveState.value === 'paused') return
    saveState.value = 'dirty'
    if (saveTimer !== null) clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => {
      saveTimer = null
      void save()
    }, AUTOSAVE_DELAY)
  }

  function addCommand(type: CommandType, at: { page: number; x?: number; y?: number }) {
    if (budget.value.full) {
      error.value = t('editorBudgetFull')
      return null
    }
    const command = clampCommand(
      seedCommand(type, { ...at, inputIndex: assets.value.length ? 1 : undefined }),
      pageSize(at.page),
    )
    mutate('add', () => {
      commands.value = [...commands.value, command]
      selection.value = [command._id]
    })
    return command
  }

  function patchCommand(id: string, patch: Partial<ClientCommand>, label = 'edit', mode: 'move' | 'resize' = 'move') {
    mutate(label, () => {
      commands.value = commands.value.map((command) => {
        if (command._id !== id) return command
        const next = { ...command, ...patch } as ClientCommand
        return next.page ? clampCommand(next, pageSize(next.page), mode) : next
      })
    })
  }

  function removeCommands(ids: string[]) {
    mutate('remove', () => {
      commands.value = commands.value.filter((command) => !ids.includes(command._id))
      selection.value = selection.value.filter((id) => !ids.includes(id))
    })
  }

  function select(id: string | null, additive = false) {
    if (id === null) selection.value = []
    else if (additive)
      selection.value = selection.value.includes(id)
        ? selection.value.filter((value) => value !== id)
        : [...selection.value, id]
    else selection.value = [id]
  }

  async function save(): Promise<boolean> {
    const current = doc.value
    if (!current || saveState.value === 'paused') return false
    if (saving) {
      saveAgain = true
      return false
    }
    if (saveTimer !== null) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    saving = true
    saveState.value = 'saving'
    const payload = toServerCommands(commands.value)
    const sent = JSON.stringify(payload)
    try {
      const fresh = await ws.api<EditorDocument>(`/editor/documents/${current.id}`, {
        method: 'PATCH',
        body: {
          version: current.version,
          commands: payload,
          input_ids: [current.file.id, ...assets.value.map((asset) => asset.id)],
        },
      })
      doc.value = { ...current, version: fresh.version }
      // Adopt the server's normalised commands only when nothing changed while
      // the request was in flight — otherwise the user's newer edit wins and
      // the next save normalises it.
      if (JSON.stringify(toServerCommands(commands.value)) === sent)
        commands.value = adoptServerCommands(fresh.commands ?? [], commands.value)
      saveState.value = 'saved'
      error.value = ''
      return true
    } catch (e: any) {
      const code = e?.data?.error?.code
      if (code === 'version_conflict') {
        conflict.value = true
        saveState.value = 'paused'
      } else {
        // A payload the server will never accept must not be retried on a
        // timer; switch to manual saving and show exactly why.
        saveState.value = 'failed'
        if (
          code === 'invalid_editor_command' ||
          code === 'editor_out_of_bounds' ||
          code === 'feature_not_in_plan' ||
          code === 'redaction_requires_separate_export' ||
          code === 'rasterization_consent_required'
        )
          saveState.value = 'paused'
      }
      error.value = requestError(e)
      return false
    } finally {
      saving = false
      if (saveAgain && saveState.value !== 'paused') {
        saveAgain = false
        markDirty()
      } else saveAgain = false
    }
  }

  /** Take the server's version and drop local edits. */
  async function resolveTakeServer() {
    const current = doc.value
    if (!current) return
    const fresh = await ws.api<EditorDocument>(`/editor/documents/${current.id}`)
    doc.value = fresh
    commands.value = adoptServerCommands(fresh.commands ?? [], [])
    selection.value = []
    past.length = 0
    future.length = 0
    syncHistoryFlags()
    conflict.value = false
    saveState.value = 'clean'
  }

  /** Re-issue the local commands against whatever version now exists. */
  async function resolveKeepMine() {
    const current = doc.value
    if (!current) return
    const fresh = await ws.api<EditorDocument>(`/editor/documents/${current.id}`)
    doc.value = { ...current, version: fresh.version }
    conflict.value = false
    saveState.value = 'dirty'
    await save()
  }

  async function reset(documentId?: string) {
    if (saveTimer !== null) clearTimeout(saveTimer)
    saveTimer = null
    past.length = 0
    future.length = 0
    syncHistoryFlags()
    commands.value = []
    selection.value = []
    assets.value = []
    quote.value = null
    conflict.value = false
    error.value = ''
    notice.value = ''
    submissionPending.value = false
    activeTool.value = 'select'
    mode.value = 'edit'
    saveState.value = 'clean'
    doc.value = null
    if (documentId) await load(documentId)
  }

  async function load(documentId: string) {
    begin('load')
    try {
      const fresh = await ws.api<EditorDocument>(`/editor/documents/${documentId}`)
      doc.value = fresh
      commands.value = adoptServerCommands(fresh.commands ?? [], [])
      const extra = (fresh.input_ids ?? []).slice(1)
      assets.value = extra.length
        ? await Promise.all(extra.map((id) => ws.api(`/files/${id}`).catch(() => null))).then((list) =>
            list.filter(Boolean),
          )
        : []
      saveState.value = 'clean'
    } catch (e) {
      error.value = requestError(e)
    } finally {
      end('load')
    }
  }

  async function review(acceptRasterization = false) {
    const current = doc.value
    if (!current || isBusy('quote') || submissionPending.value) return
    begin('quote')
    error.value = ''
    try {
      if (saveState.value !== 'saved' && saveState.value !== 'clean') {
        const ok = await save()
        if (!ok) return
      }
      const fresh = doc.value
      if (!fresh) return
      quote.value = await ws.api(`/editor/documents/${fresh.id}/quote`, {
        method: 'POST',
        body: { version: fresh.version, accept_rasterization: acceptRasterization },
      })
    } catch (e) {
      error.value = requestError(e)
    } finally {
      end('quote')
    }
  }

  const idempotency = useState<Record<string, string>>('idempotency', () => ({}))

  async function exportDocument() {
    const active = quote.value
    if (!active || isBusy('export') || active.affordable === false) return
    begin('export')
    error.value = ''
    // Keyed by quote id so a double-click cannot submit two jobs.
    if (!idempotency.value[active.id]) idempotency.value[active.id] = crypto.randomUUID()
    const key = idempotency.value[active.id] as string
    submissionPending.value = true
    sessionStorage.setItem('pdf-master-pending-job', JSON.stringify({ quote_id: active.id, key }))
    try {
      const job = await ws.api<{ id: string }>('/jobs', {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: { quote_id: active.id },
      })
      sessionStorage.removeItem('pdf-master-pending-job')
      submissionPending.value = false
      await ws.loadAccount()
      await navigateTo(useLocale().path(`/app/jobs/${job.id}`))
    } catch (e: any) {
      // A refused request is decided. An uncertain one must be retried with the
      // same quote and key so the server settles it exactly once.
      const status = e?.statusCode || e?.status || e?.response?.status
      if (status >= 400 && status < 500) {
        submissionPending.value = false
        sessionStorage.removeItem('pdf-master-pending-job')
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
    selected,
    activeTool,
    mode,
    zoom,
    fitMode,
    assets,
    saveState,
    conflict,
    error,
    notice,
    quote,
    submissionPending,
    canUndo,
    canRedo,
    budget,
    issues,
    isBusy,
    begin,
    end,
    pageSize,
    mutate,
    addCommand,
    patchCommand,
    removeCommands,
    select,
    undo,
    redo,
    save,
    load,
    reset,
    review,
    exportDocument,
    resolveTakeServer,
    resolveKeepMine,
    requestError,
  }
}
