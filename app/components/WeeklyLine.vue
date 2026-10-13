<script setup lang="ts">
import type { Usage } from '../../generated/api/types'
/**
 * This week's allowance beside a task: "File tasks this week · 4 of 15 used".
 * It reads the quote's own figures when it has them, else the account's.
 * Nothing shows on an unlimited plan or when the server did not say.
 */
const props = defineProps<{ kind: 'ai' | 'file'; usage?: Partial<Usage> | null }>()
const { t } = useLocale()
const ws = useWorkspace()
const block = computed(() => {
  const usage = props.usage?.ai_documents || props.usage?.file_jobs ? props.usage : ws.usage.value
  return props.kind === 'ai' ? usage?.ai_documents : usage?.file_jobs
})
</script>
<template>
  <p v-if="block && typeof block.limit === 'number'" class="weekly-line" data-testid="weekly-line">
    <span>{{ t(kind === 'ai' ? 'weekAiDocuments' : 'weekFileJobs') }}</span
    ><strong>{{ t('weekUsed', { used: block.used, limit: block.limit }) }}</strong>
  </p>
</template>
