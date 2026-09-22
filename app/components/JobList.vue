<script setup lang="ts">
import type { Job } from '../../generated/api/types'
defineProps<{ jobs: Job[] }>()
const { t, path, date } = useLocale()
const { icons, colors } = useTools()
</script>
<template>
  <div v-if="jobs.length" class="job-table">
    <div class="job-table-head">
      <span>{{ t('fileName') }}</span
      ><span>{{ t('tool') }}</span
      ><span>{{ t('date') }}</span
      ><span>{{ t('status') }}</span
      ><span />
    </div>
    <NuxtLink v-for="job in jobs" :key="job.id" :to="path(`/app/jobs/${job.id}`)" class="job-row"
      ><div class="job-document">
        <span class="file-tile"><AppIcon name="file" :size="21" /></span
        ><span
          ><strong :title="job.input_names?.[0] || (job.input_files as any)?.[0]?.name">{{
            job.artifacts?.[0]?.name ||
            job.input_names?.[0] ||
            (job.input_files as any)?.[0]?.name ||
            t(`${job.feature_id}.name`)
          }}</strong
          ><small>{{ job.id.slice(0, 8) }}</small></span
        >
      </div>
      <span class="job-tool-name">{{ t(`${job.feature_id}.name`) }}</span
      ><span class="job-created">{{ date(job.created_at) }}</span
      ><StatusBadge :status="job.status" /><AppIcon class="job-arrow" name="arrow" :size="17"
    /></NuxtLink>
  </div>
  <div v-else class="empty-state">
    <span class="empty-icon"><AppIcon name="folder" :size="27" /></span>
    <h3>{{ t('noTasks') }}</h3>
    <p>{{ t('noTasksBody') }}</p>
    <NuxtLink :to="path('/app/tools')" class="text-link"
      >{{ t('exploreTools') }}<AppIcon name="right" :size="16"
    /></NuxtLink>
  </div>
</template>
