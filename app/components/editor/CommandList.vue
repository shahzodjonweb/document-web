<script setup lang="ts">
/**
 * Every change as a list.
 *
 * This is the canonical keyboard and screen-reader path: selecting, inspecting
 * and deleting a mark must never require the canvas. `docs/design/EXTENDED_WORKSPACE.md`
 * forbids drag-only interaction, so this panel is always present.
 */
import { COMMAND_SHAPE } from '~/composables/useEditorCommands'

const { t } = useLocale()
const session = useEditorSession()

const issueFor = (id: string) => session.issues.value.find((issue) => issue.id === id)
</script>

<template>
  <section class="editor-command-list panel" :aria-label="t('editorCommands')" data-testid="editor-command-list">
    <div class="panel-heading">
      <h2>{{ t('editorCommands') }}<span class="count-tag">{{ session.commands.value.length }}</span></h2>
    </div>
    <p v-if="!session.commands.value.length" class="field-hint">{{ t('editorToolHint') }}</p>
    <ul v-else class="editor-command-rows">
      <li v-for="(command, index) in session.commands.value" :key="command._id">
        <button
          type="button"
          class="editor-command-row"
          :class="{ active: session.selection.value.includes(command._id), invalid: issueFor(command._id) }"
          :aria-pressed="session.selection.value.includes(command._id)"
          @click="session.select(command._id)"
        >
          <AppIcon :name="COMMAND_SHAPE[command.type].icon" :size="16" />
          <span>
            <strong>{{ index + 1 }}. {{ t(COMMAND_SHAPE[command.type].labelKey) }}</strong>
            <small v-if="command.page">{{ t('page') }} {{ command.page }}</small>
            <small v-if="issueFor(command._id)" class="editor-invalid">{{
              t(issueFor(command._id)!.code)
            }}</small>
          </span>
        </button>
        <button
          type="button"
          class="icon-button"
          :aria-label="`${t('delete')} ${index + 1}`"
          @click="session.removeCommands([command._id])"
        >
          <AppIcon name="trash" :size="16" />
        </button>
      </li>
    </ul>
  </section>
</template>
