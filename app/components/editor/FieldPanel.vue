<script setup lang="ts">
/**
 * Commands that have no place on the page: form values, find-and-replace and
 * image operations. They are addressed by name or index, not by coordinate.
 */
import { COMMAND_FEATURE, LIMITS } from '~/composables/useEditorCommands'

const { t, path } = useLocale()
const ws = useWorkspace()
const session = useEditorSession()

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

function set(id: string, patch: Record<string, unknown>) {
  session.patchCommand(id, patch, `field:${id}`)
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
  <details class="editor-fieldpanel panel" :open="open" data-testid="editor-fields" @toggle="open = ($event.target as HTMLDetailsElement).open">
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
              @change="set(command._id, { field: ($event.target as HTMLInputElement).value })"
          /></label>
          <label class="form-field"
            ><span>{{ t('fieldValue') }}</span
            ><input
              :value="command.value"
              :maxlength="LIMITS.value"
              @change="set(command._id, { value: ($event.target as HTMLInputElement).value })"
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
            @change="set(command._id, { find: ($event.target as HTMLInputElement).value })"
        /></label>
        <label class="form-field"
          ><span>{{ t('replacement') }}</span
          ><input
            :value="command.replacement"
            :maxlength="LIMITS.findReplace"
            @change="set(command._id, { replacement: ($event.target as HTMLInputElement).value })"
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
        <NuxtLink :to="path('/app/billing')" class="text-link">{{ t('editorSeePlans') }}</NuxtLink>
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
