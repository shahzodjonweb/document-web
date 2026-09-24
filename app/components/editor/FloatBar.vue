<script setup lang="ts">
/**
 * Properties for the current selection.
 *
 * The numeric X/Y/W/H fields are the keyboard-and-screen-reader equivalent of
 * dragging, so every canvas gesture has a non-pointer path.
 */
import { COLOR_PATTERN, COMMAND_SHAPE, LIMITS } from '~/composables/useEditorCommands'

const { t } = useLocale()
const session = useEditorSession()
const metrics = useEditorFontMetrics()

const command = computed(() => session.selected.value[0] ?? null)
const shape = computed(() => (command.value ? COMMAND_SHAPE[command.value.type] : null))

const PRESETS = [
  ['#FFFF00', 'colorYellow'],
  ['#FF7AB6', 'colorPink'],
  ['#2FA36B', 'colorGreen'],
  ['#0275FC', 'colorBlue'],
  ['#FA3331', 'colorRed'],
  ['#17212E', 'colorBlack'],
] as const

function set(patch: Record<string, unknown>, label = 'edit') {
  if (command.value) session.patchCommand(command.value._id, patch, label)
}

function setColor(value: string) {
  if (COLOR_PATTERN.test(value)) set({ color: value.toUpperCase() }, 'colour')
}

const colorValid = computed(() => !command.value?.color || COLOR_PATTERN.test(command.value.color))

/** Insert real newlines: the export engine never wraps text itself. */
function wrapText() {
  const current = command.value
  if (!current || current.type !== 'add_text') return
  const page = session.pageSize(current.page ?? 1)
  const wrapped = metrics.wrapToWidth(current.text ?? '', current.font_size ?? 16, page.width - (current.x ?? 0))
  set({ text: wrapped }, 'wrap')
}

function duplicate() {
  const current = command.value
  if (!current) return
  session.addCommand(current.type, { page: current.page ?? 1, x: (current.x ?? 0) + 12, y: (current.y ?? 0) + 12 })
}
</script>

<template>
  <section class="editor-floatbar panel" :aria-label="t('editorProperties')" data-testid="editor-floatbar">
    <p v-if="!command" class="field-hint">{{ t('editorNoSelection') }}</p>
    <template v-else>
      <div class="editor-floatbar-head">
        <strong>{{ t(COMMAND_SHAPE[command.type].labelKey) }}</strong>
        <span>
          <button type="button" class="icon-button" :aria-label="t('editorDuplicate')" @click="duplicate">
            <AppIcon name="copy" :size="17" />
          </button>
          <button
            type="button"
            class="icon-button"
            :aria-label="t('delete')"
            @click="session.removeCommands([command._id])"
          >
            <AppIcon name="trash" :size="17" />
          </button>
        </span>
      </div>

      <div v-if="shape?.positional" class="form-row">
        <label class="form-field"
          ><span>{{ t('xCoordinate') }}</span
          ><input
            type="number"
            step="0.01"
            min="0"
            :value="command.x"
            @change="set({ x: Number(($event.target as HTMLInputElement).value) }, 'position')"
        /></label>
        <label class="form-field"
          ><span>{{ t('yCoordinate') }}</span
          ><input
            type="number"
            step="0.01"
            min="0"
            :value="command.y"
            @change="set({ y: Number(($event.target as HTMLInputElement).value) }, 'position')"
        /></label>
      </div>

      <div v-if="shape?.box" class="form-row">
        <label class="form-field"
          ><span>{{ t('width') }}</span
          ><input
            type="number"
            step="0.01"
            :min="LIMITS.minSize"
            :value="command.width"
            @change="set({ width: Number(($event.target as HTMLInputElement).value) }, 'size')"
        /></label>
        <label class="form-field"
          ><span>{{ t('height') }}</span
          ><input
            type="number"
            step="0.01"
            :min="LIMITS.minSize"
            :value="command.height"
            @change="set({ height: Number(($event.target as HTMLInputElement).value) }, 'size')"
        /></label>
      </div>

      <label v-if="command.type === 'add_text'" class="form-field"
        ><span>{{ t('fontSize') }}</span
        ><input
          type="number"
          :min="LIMITS.fontSize.min"
          :max="LIMITS.fontSize.max"
          :value="command.font_size"
          @change="set({ font_size: Number(($event.target as HTMLInputElement).value) }, 'size')"
      /></label>

      <label v-if="command.type === 'draw'" class="form-field"
        ><span>{{ t('editorStrokeWidth') }}</span
        ><input
          type="number"
          step="0.5"
          :min="LIMITS.strokeWidth.min"
          :max="LIMITS.strokeWidth.max"
          :value="command.stroke_width"
          @change="set({ stroke_width: Number(($event.target as HTMLInputElement).value) }, 'size')"
      /></label>

      <template v-if="command.color !== undefined">
        <label class="form-field"
          ><span>{{ t('editorColorHex') }}</span>
          <span class="editor-color-row">
            <input
              type="color"
              :value="command.color"
              :aria-label="t('color')"
              @input="setColor(($event.target as HTMLInputElement).value)"
            /><input
              class="editor-color-hex"
              :value="command.color"
              maxlength="7"
              pattern="#[0-9A-Fa-f]{6}"
              :aria-label="t('editorColorHex')"
              @change="setColor(($event.target as HTMLInputElement).value)"
            />
          </span>
          <small v-if="!colorValid" class="editor-invalid">{{ t('editorColorInvalid') }}</small>
        </label>
        <div class="editor-swatches" role="group" :aria-label="t('editorColorPresets')">
          <button
            v-for="[value, key] in PRESETS"
            :key="value"
            type="button"
            class="editor-swatch"
            :class="{ active: command.color?.toUpperCase() === value }"
            :style="{ background: value }"
            :aria-label="t(key)"
            @click="setColor(value)"
          />
        </div>
      </template>

      <button v-if="command.type === 'add_text'" type="button" class="button secondary full small" @click="wrapText">
        <AppIcon name="alignLeft" :size="15" />{{ t('editorWrapToPage') }}
      </button>

      <p v-if="shape?.image" class="field-hint">{{ t('editorImageLetterbox') }}</p>
      <p v-if="command.type === 'add_text'" class="field-hint">{{ t('editorOneFontNote') }}</p>
      <p class="field-hint">{{ t('editorNudgeHint') }}</p>
    </template>
  </section>
</template>
