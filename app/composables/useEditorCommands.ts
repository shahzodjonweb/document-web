/**
 * The client half of the editor command contract.
 *
 * Every table here mirrors `document-platform/processors/editor.py` and
 * `apps/studio/editor_policy.py`. The server rejects a command outright when it
 * carries a key outside `FIELDS[type]`, so the projection below is a strict
 * whitelist rather than a blacklist — this is the only safe way to send state.
 *
 * Keep this file in step with the Python source; nothing else may hold these
 * bounds.
 */

export const COMMAND_TYPES = [
  'add_text',
  'highlight',
  'note',
  'draw',
  'fill_form',
  'signature',
  'insert_image',
  'replace_text',
  'replace_image',
  'remove_image',
  'redact',
] as const

export type CommandType = (typeof COMMAND_TYPES)[number]

/** Exactly `processors/editor.py: FIELDS`. Extra keys are a hard rejection. */
export const COMMAND_FIELDS: Record<CommandType, readonly string[]> = {
  add_text: ['type', 'page', 'x', 'y', 'text', 'font_size', 'color'],
  highlight: ['type', 'page', 'x', 'y', 'width', 'height', 'color'],
  note: ['type', 'page', 'x', 'y', 'text'],
  draw: ['type', 'page', 'points', 'color', 'stroke_width'],
  fill_form: ['type', 'field', 'value'],
  signature: ['type', 'page', 'x', 'y', 'width', 'height', 'input_index'],
  insert_image: ['type', 'page', 'x', 'y', 'width', 'height', 'input_index'],
  replace_text: ['type', 'page', 'find', 'replacement'],
  replace_image: ['type', 'page', 'image_index', 'input_index'],
  remove_image: ['type', 'page', 'image_index'],
  redact: ['type', 'page', 'x', 'y', 'width', 'height'],
}

/** Exactly `apps/studio/editor_policy.py: COMMAND_FEATURES`. */
export const COMMAND_FEATURE: Record<CommandType, string> = {
  add_text: 'editor.add_text',
  highlight: 'editor.highlight',
  note: 'editor.annotate',
  draw: 'editor.annotate',
  fill_form: 'editor.fill_forms',
  signature: 'editor.signature_image',
  insert_image: 'editor.insert_images',
  replace_text: 'editor.existing_text',
  replace_image: 'editor.replace_images',
  remove_image: 'editor.replace_images',
  redact: 'editor.redact',
}

/** `normalize()` fills these in server-side; we seed them so previews match. */
export const COMMAND_DEFAULTS = { fontSize: 16, strokeWidth: 2, textColor: '#17212E', highlightColor: '#FFFF00' }

export const LIMITS = {
  commands: 100,
  commandBytes: 20000,
  bodyBytes: 32768,
  coordinate: 14400,
  minSize: 1,
  text: 2000,
  fontSize: { min: 6, max: 96 },
  strokeWidth: { min: 0.5, max: 12 },
  points: { min: 2, max: 200 },
  field: 200,
  value: 2000,
  findReplace: 500,
  imageIndex: 999,
} as const

export const COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/

export interface ClientCommand {
  /** Client-only identity for selection and undo; stripped before sending. */
  _id: string
  type: CommandType
  page?: number
  x?: number
  y?: number
  width?: number
  height?: number
  text?: string
  font_size?: number
  color?: string
  points?: [number, number][]
  stroke_width?: number
  field?: string
  value?: string
  find?: string
  replacement?: string
  image_index?: number
  input_index?: number
}

export type ServerCommand = Omit<ClientCommand, '_id'>

interface Shape {
  /** Carries x/y, so it can be placed by clicking the page. */
  positional: boolean
  /** Also carries width/height, so it can be resized. */
  box: boolean
  /** Needs an attached image asset (`input_index`). */
  image: boolean
  icon: string
  labelKey: string
}

export const COMMAND_SHAPE: Record<CommandType, Shape> = {
  add_text: { positional: true, box: false, image: false, icon: 'type', labelKey: 'addText' },
  highlight: { positional: true, box: true, image: false, icon: 'highlighter', labelKey: 'highlight' },
  note: { positional: true, box: false, image: false, icon: 'sticky', labelKey: 'note' },
  draw: { positional: false, box: false, image: false, icon: 'draw', labelKey: 'editorToolDraw' },
  fill_form: { positional: false, box: false, image: false, icon: 'files', labelKey: 'fillForm' },
  signature: { positional: true, box: true, image: true, icon: 'signature', labelKey: 'signature' },
  insert_image: { positional: true, box: true, image: true, icon: 'image', labelKey: 'insertImage' },
  replace_text: { positional: false, box: false, image: false, icon: 'replace', labelKey: 'replaceText' },
  replace_image: { positional: false, box: false, image: true, icon: 'image', labelKey: 'replaceImage' },
  remove_image: { positional: false, box: false, image: false, icon: 'trash', labelKey: 'removeImage' },
  redact: { positional: true, box: true, image: false, icon: 'redact', labelKey: 'redact' },
}

/**
 * Tools offered on the canvas, in tool-strip order.
 *
 * `redact` is deliberately absent: the draft PATCH normalises with
 * `accept_rasterization: true`, so a draft mixing redaction with anything else
 * is refused at *save* time, not just export. It therefore gets its own mode.
 */
export const CANVAS_TOOLS: CommandType[] = ['add_text', 'highlight', 'note', 'draw', 'signature', 'insert_image']

export function isCommandType(value: unknown): value is CommandType {
  return typeof value === 'string' && (COMMAND_TYPES as readonly string[]).includes(value)
}

/** 0.01pt is 1/7200 inch — invisible, and it keeps the 20 KB budget honest. */
export function quantize(value: number): number {
  return Math.round(value * 100) / 100
}

export function newCommandId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

interface SeedContext {
  page: number
  x?: number
  y?: number
  /** Index of the first attached image, when one exists. */
  inputIndex?: number
}

export function seedCommand(type: CommandType, context: SeedContext): ClientCommand {
  const command: ClientCommand = { _id: newCommandId(), type }
  if (type !== 'fill_form') command.page = context.page
  const shape = COMMAND_SHAPE[type]
  if (shape.positional) {
    command.x = quantize(context.x ?? 40)
    command.y = quantize(context.y ?? 60)
  }
  if (shape.box) {
    command.width = 160
    command.height = 40
  }
  switch (type) {
    case 'add_text':
      // Left empty on purpose: TextInput opens immediately and an untouched
      // command is dropped, so the server never sees the empty string it
      // rejects with `invalid_editor_command`.
      command.text = ''
      command.font_size = COMMAND_DEFAULTS.fontSize
      command.color = COMMAND_DEFAULTS.textColor
      break
    case 'note':
      command.text = ''
      break
    case 'highlight':
      command.color = COMMAND_DEFAULTS.highlightColor
      break
    case 'draw':
      command.points = []
      command.color = COMMAND_DEFAULTS.textColor
      command.stroke_width = COMMAND_DEFAULTS.strokeWidth
      break
    case 'fill_form':
      command.field = ''
      command.value = ''
      break
    case 'replace_text':
      command.find = ''
      command.replacement = ''
      break
    case 'replace_image':
    case 'remove_image':
      command.image_index = 0
      break
    default:
      break
  }
  // input_index is 1-based: index 0 is always the source PDF.
  if (shape.image) command.input_index = context.inputIndex ?? 1
  return command
}

/** Whitelist projection onto the wire format. Never send anything else. */
export function toServerCommand(command: ClientCommand): ServerCommand {
  const allowed = COMMAND_FIELDS[command.type]
  const source = command as unknown as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of allowed) {
    const value = source[key]
    if (value === undefined) continue
    out[key] = typeof value === 'number' ? quantize(value) : value
  }
  return out as ServerCommand
}

export function toServerCommands(commands: ClientCommand[]): ServerCommand[] {
  return commands.map(toServerCommand)
}

export function adoptServerCommands(commands: ServerCommand[], previous: ClientCommand[]): ClientCommand[] {
  // `normalize()` neither reorders nor drops, so position carries identity and
  // the local `_id`s survive — selection and undo stay pointing at the same
  // objects after a save materialises defaults.
  return commands.map((command, index) => ({ ...command, _id: previous[index]?._id ?? newCommandId() }))
}

export type IssueCode =
  | 'editorIssueEmptyText'
  | 'editorIssueNoImage'
  | 'editorIssueEmptyField'
  | 'editorIssueEmptyFind'
  | 'editorIssueOutOfBounds'
  | 'editorIssueShortLine'

export interface Issue {
  id: string
  code: IssueCode
}

function controlCharacters(text: string): boolean {
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0
    if (code < 32 && character !== '\n' && character !== '\t') return true
  }
  return false
}

/**
 * Problems we can see before the server does. Bounds are checked by
 * `useEditorGeometry`; this covers the value-shaped rejections.
 *
 * `assetCount` is how many images are attached after the source PDF, so an
 * image command pointing past the end is caught here rather than surfacing as
 * `invalid_editor_command` on the next autosave.
 */
export function commandIssues(command: ClientCommand, assetCount = 0): Issue | null {
  const id = command._id
  switch (command.type) {
    case 'add_text':
    case 'note': {
      const text = command.text ?? ''
      if (!text.trim() || controlCharacters(text) || [...text].length > LIMITS.text)
        return { id, code: 'editorIssueEmptyText' }
      return null
    }
    case 'draw':
      return (command.points?.length ?? 0) < LIMITS.points.min ? { id, code: 'editorIssueShortLine' } : null
    case 'fill_form':
      return !command.field?.trim() ? { id, code: 'editorIssueEmptyField' } : null
    case 'replace_text':
      return !command.find ? { id, code: 'editorIssueEmptyFind' } : null
    case 'signature':
    case 'insert_image':
    case 'replace_image': {
      const index = command.input_index ?? 0
      return index < 1 || index > assetCount ? { id, code: 'editorIssueNoImage' } : null
    }
    default:
      return null
  }
}

export interface Budget {
  commands: number
  maxCommands: number
  bytes: number
  maxBytes: number
  full: boolean
  oversize: boolean
}

export function payloadBudget(commands: ClientCommand[]): Budget {
  const bytes = new TextEncoder().encode(JSON.stringify(toServerCommands(commands))).length
  return {
    commands: commands.length,
    maxCommands: LIMITS.commands,
    bytes,
    maxBytes: LIMITS.commandBytes,
    full: commands.length >= LIMITS.commands,
    oversize: bytes > LIMITS.commandBytes,
  }
}

export function useEditorCommands() {
  return {
    COMMAND_TYPES,
    COMMAND_FIELDS,
    COMMAND_FEATURE,
    COMMAND_SHAPE,
    CANVAS_TOOLS,
    LIMITS,
    COLOR_PATTERN,
    isCommandType,
    seedCommand,
    toServerCommand,
    toServerCommands,
    adoptServerCommands,
    commandIssues,
    payloadBudget,
    quantize,
    newCommandId,
  }
}
