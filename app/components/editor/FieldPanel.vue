<script setup lang="ts">
/**
 * Commands that have no place on the page: form values, find-and-replace and
 * image operations. They are addressed by name or index, not by coordinate.
 *
 * Under `editor_v2` this is "Fill in the form": the file's own text fields as a list,
 * each value typed in place. Filling by tapping the field on the page comes later.
 */
import { COMMAND_FEATURE, LIMITS } from '~/composables/useEditorCommands'

const { t } = useLocale()
const ws = useWorkspace()
const session = useEditorSession()
const editorV2 = useEditorV2()

const open = ref(false)
const doc = computed(() => session.doc.value)
const formFields = computed(() => doc.value?.form_fields ?? [])
const fills = computed(() => session.commands.value.filter((command) => command.type === 'fill_form'))
const replacements = computed(() => session.commands.value.filter((command) => command.type === 'replace_text'))

function allowed(type: 'fill_form' | 'replace_text') {
  const features = ws.features.value
  if (!features.length) return true
  const feature = features.find((item) => item.id === COMMAND_FEATURE[type])
  return feature ? feature.eligible !== false : true
}

/** Words count from the first letter, so hiding the app while typing here still saves them. */
function set(id: string, patch: Record<string, unknown>) {
  session.patchCommand(id, patch, `field:${id}`)
}

/** The fields the engine can write words into; the rest are counted, not offered. */
const textFields = computed(() => formFields.value.filter((field) => field.type === '/Tx'))
const otherFields = computed(() => formFields.value.length - textFields.value.length)
const valueOf = (name: string) => fills.value.find((command) => command.field === name)?.value ?? ''

/** A value starts its change with the first letter and ends it when emptied: an empty fill is no change. */
function fill(name: string, value: string) {
  const current = fills.value.find((command) => command.field === name)
  if (current && !value) return session.removeCommands([current._id])
  if (current) return set(current._id, { value })
  if (!value || !allowed('fill_form')) return
  session.addCommand('fill_form', { page: 1 }, { field: name, value })
  // The list is the form here; a change with no place on the page has nothing to select.
  session.select(null)
}

/** A saved template replaces the form values wholesale, never merges them. */
function applyTemplate(commands: any[]) {
  session.mutate('template', () => {
    const others = session.commands.value.filter((command) => command.type !== 'fill_form')
    const applied = commands.map((command) => ({ ...command, _id: crypto.randomUUID() }))
    session.commands.value = [...others, ...applied]
    session.selection.value = applied.length ? [applied[applied.length - 1]._id] : []
  })
}
</script>

<template>
  <section v-if="editorV2" class="editor-fill" :aria-label="t('editorFillForm')" data-testid="editor-fields">
    <p v-if="!textFields.length" class="field-hint">{{ t('editorNoFormFields') }}</p>
    <template v-else>
      <p v-if="!allowed('fill_form')" class="editor-lock">
        <AppIcon name="lock" :size="15" />
        <span>{{ t('editorLockedTool', { tool: t('editorFillForm') }) }}</span>
      </p>
      <label v-for="field in textFields" :key="field.name" class="form-field">
        <span>{{ field.name }}</span>
        <input
          :value="valueOf(field.name)"
          :maxlength="LIMITS.value"
          :disabled="!allowed('fill_form')"
          :data-testid="`editor-field-${field.name}`"
          @input="fill(field.name, ($event.target as HTMLInputElement).value)"
        />
      </label>
      <p v-if="otherFields" class="field-hint">{{ t('editorOtherFields', { count: otherFields }) }}</p>
    </template>
  </section>
  <details
    v-else
    class="editor-fieldpanel panel"
    :open="open"
    data-testid="editor-fields"
    @toggle="open = ($event.target as HTMLDetailsElement).open"
  >
    <summary>{{ t('editorFormFields') }} · {{ t('editorFindReplace') }}</summary>

    <section :aria-label="t('editorFormFields')">
      <h3>{{ t('editorFormFields') }}</h3>
      <p v-if="!formFields.length" class="field-hint">{{ t('editorNoFormFields') }}</p>
      <template v-else>
        <p class="field-hint">{{ t('editorFormValueHint') }}</p>
        <div v-for="command in fills" :key="command._id" class="editor-field-row">
          <label class="form-field"
            ><span>{{ t('fieldName') }}</span
            ><input
              :value="command.field"
              list="editor-form-fields"
              :maxlength="LIMITS.field"
              :aria-label="t('fieldName')"
              @input="set(command._id, { field: ($event.target as HTMLInputElement).value })"
          /></label>
          <label class="form-field"
            ><span>{{ t('fieldValue') }}</span
            ><input
              :value="command.value"
              :maxlength="LIMITS.value"
              @input="set(command._id, { value: ($event.target as HTMLInputElement).value })"
          /></label>
          <button type="button" class="icon-button" :aria-label="t('delete')" @click="session.removeCommands([command._id])">
            <AppIcon name="trash" :size="16" />
          </button>
        </div>
        <datalist id="editor-form-fields">
          <option v-for="field in formFields" :key="field.name" :value="field.name" />
        </datalist>
        <button
          type="button"
          class="button secondary small"
          :aria-disabled="!allowed('fill_form')"
          @click="allowed('fill_form') && session.addCommand('fill_form', { page: 1 })"
        >
          <AppIcon name="plus" :size="15" />{{ t('fillForm') }}
        </button>
      </template>
    </section>

    <section :aria-label="t('editorFindReplace')">
      <h3>{{ t('editorFindReplace') }}</h3>
      <p class="field-hint">{{ t('editorFindReplaceNote') }}</p>
      <div v-for="command in replacements" :key="command._id" class="editor-field-row">
        <label class="form-field"
          ><span>{{ t('findText') }}</span
          ><input
            :value="command.find"
            :maxlength="LIMITS.findReplace"
            @input="set(command._id, { find: ($event.target as HTMLInputElement).value })"
        /></label>
        <label class="form-field"
          ><span>{{ t('replacement') }}</span
          ><input
            :value="command.replacement"
            :maxlength="LIMITS.findReplace"
            @input="set(command._id, { replacement: ($event.target as HTMLInputElement).value })"
        /></label>
        <label class="form-field editor-field-page"
          ><span>{{ t('page') }}</span
          ><input
            type="number"
            min="1"
            :max="doc?.file.page_count"
            :value="command.page"
            @change="set(command._id, { page: Number(($event.target as HTMLInputElement).value) })"
        /></label>
        <button type="button" class="icon-button" :aria-label="t('delete')" @click="session.removeCommands([command._id])">
          <AppIcon name="trash" :size="16" />
        </button>
      </div>
      <button
        v-if="allowed('replace_text')"
        type="button"
        class="button secondary small"
        @click="session.addCommand('replace_text', { page: 1 })"
      >
        <AppIcon name="plus" :size="15" />{{ t('replaceText') }}
      </button>
      <p v-else class="editor-lock">
        <AppIcon name="lock" :size="15" />
        <span>{{ t('editorLockedTool', { tool: t('replaceText') }) }}</span>
      </p>
    </section>

    <FormTemplates
      v-if="doc && formFields.length"
      :commands="session.commands.value"
      :file-id="doc.file.id"
      @apply="applyTemplate"
    />
  </details>
</template>
