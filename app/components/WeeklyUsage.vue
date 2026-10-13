<script setup lang="ts">
import type { WeeklyAllowance } from '../../generated/api/types'
/**
 * The plan's week in one row, as Home and billing show it: AI documents and
 * file tasks used so far against their limits, and on billing the AI edits
 * each file allows. A limit the server does not send is left out; null is
 * unlimited.
 */
const props = defineProps<{ edits?: boolean }>()
const { t } = useLocale()
const ws = useWorkspace()
const number = (value: number) => value.toLocaleString('ru-RU').replace(/\u00a0/g, ' ')
const rows = computed(() => {
  const usage = ws.usage.value
  const rows: { key: string; block: WeeklyAllowance }[] = []
  if (usage?.ai_documents) rows.push({ key: 'weekAiDocuments', block: usage.ai_documents })
  if (usage?.file_jobs) rows.push({ key: 'weekFileJobs', block: usage.file_jobs })
  return rows
})
const edits = computed(() =>
  props.edits && ws.usage.value && 'edits_per_file' in ws.usage.value
    ? ws.usage.value.edits_per_file
    : undefined,
)
const share = (block: WeeklyAllowance) =>
  `${Math.max(0, Math.min(100, (block.used / Math.max(1, block.limit || 1)) * 100))}%`
</script>
<template>
  <div v-if="rows.length" class="plan-meters" data-testid="weekly-usage">
    <div v-for="row in rows" :key="row.key" class="plan-meter">
      <span class="plan-meter-label">{{ t(row.key) }}</span>
      <template v-if="typeof row.block.limit === 'number'">
        <p>
          <strong class="tabular">{{ number(row.block.used) }}</strong>
          <span>{{ t('meterOf', { limit: number(row.block.limit) }) }}</span>
        </p>
        <div class="usage-track"><span :style="{ width: share(row.block) }" /></div>
      </template>
      <p v-else>
        <strong>{{ t('unlimitedCount') }}</strong
        ><span>{{ t('weekUsedCount', { used: number(row.block.used) }) }}</span>
      </p>
    </div>
    <div v-if="edits !== undefined" class="plan-meter">
      <span class="plan-meter-label">{{ t('editsPerFile') }}</span>
      <p>
        <strong class="tabular">{{ edits === null ? t('unlimitedCount') : number(edits) }}</strong>
      </p>
    </div>
  </div>
</template>
