<script setup lang="ts">
import type { Job } from '../../generated/api/types'
defineProps<{ jobs: Job[]; filtered?: boolean }>()
const { t, path, date } = useLocale()
const { icon, name } = useTools()
const title = (job: Job) =>
  job.artifacts?.[0]?.name ||
  job.input_names?.[0] ||
  (job.input_files as any)?.[0]?.name ||
  name(job.feature_id)
</script>
<template>
  <ul v-if="jobs.length" class="job-list">
    <li v-for="job in jobs" :key="job.id">
      <NuxtLink :to="path(`/app/jobs/${job.id}`)" class="job-row"
        ><span class="file-tile"><AppIcon :name="icon(job.feature_id)" :size="19" /></span
        ><span class="job-main"
          ><strong :title="title(job)">{{ title(job) }}</strong
          ><small
            >{{ title(job) === name(job.feature_id) ? '' : `${name(job.feature_id)} · `
            }}{{ date(job.created_at, true) }}</small
          ></span
        ><StatusBadge :status="job.status" /><AppIcon class="job-arrow" name="right" :size="16"
      /></NuxtLink>
    </li>
  </ul>
  <div v-else class="empty-state">
    <span class="empty-icon"><AppIcon name="folder" :size="24" /></span>
    <h3>{{ filtered ? t('noTasksFiltered') : t('noTasks') }}</h3>
    <p v-if="!filtered">{{ t('noTasksBody') }}</p>
    <NuxtLink v-if="!filtered" :to="path('/app/tools')" class="text-link"
      >{{ t('exploreTools') }}<AppIcon name="right" :size="16"
    /></NuxtLink>
  </div>
</template>
