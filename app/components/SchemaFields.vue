<script setup lang="ts">
const props = withDefaults(
  defineProps<{ schema?: Record<string, any>; modelValue: Record<string, any>; exclude?: string[] }>(),
  { exclude: () => [] },
)
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, any>] }>()
const { t } = useLocale()
const properties = computed<[string, any][]>(() =>
  Object.entries<any>(props.schema?.properties || {}).filter(([key]) => !props.exclude.includes(key)),
)
const labels: Record<string, string> = {
  pages: 'rangeLabel',
  order: 'rangeLabel',
  angle: 'angle',
  language: 'outputLanguage',
  output_language: 'outputLanguage',
  dpi: 'resolution',
  format: 'format',
  paper_size: 'paperSize',
  orientation: 'orientation',
  length: 'length',
  question_count: 'questionCount',
  grade: 'grade',
  subject: 'subject',
  duration: 'duration',
  objectives: 'objectives',
  audience: 'audience',
  style: 'style',
  difficulty: 'difficulty',
  text: 'text',
  title: 'title',
  mode: 'conversionMode',
  strategy: 'tableDetection',
  margin: 'margin',
  ranges: 'rangeLabel',
}
function option(value: any) {
  const key = String(value)
  if (['auto', 'portrait', 'landscape', 'text', 'ocr', 'lines'].includes(key))
    return t(
      key === 'lines' ? 'tableLines' : key === 'text' ? 'plainText' : key === 'ocr' ? 'ocrCategory' : key,
    )
  const names: Record<string, string> = { eng: 'English', rus: 'Русский', uzb: 'O‘zbekcha' }
  return key
    .split('+')
    .map((v) => names[v] || v)
    .join(' + ')
}
function label(key: string, value: any) {
  return labels[key] ? t(labels[key]!) : value.title || key.replaceAll('_', ' ')
}
function set(key: string, value: any) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}
function complex(key: string, event: Event, field: any) {
  const value = (event.target as HTMLTextAreaElement).value
  try {
    set(key, JSON.parse(value))
  } catch {
    if (field.type === 'array')
      set(
        key,
        value.split(',').map((v) => (field.items?.type === 'integer' ? Number(v.trim()) : v.trim())),
      )
  }
}
</script>
<template>
  <div class="schema-fields">
    <label v-for="[key, field] in properties" :key="key" class="form-field"
      ><span
        >{{ label(key, field)
        }}<small v-if="schema?.required?.includes(key)" class="required-dot">*</small></span
      ><select
        v-if="field.enum"
        :value="modelValue[key] ?? field.default ?? field.enum[0]"
        @change="
          set(
            key,
            field.type === 'integer'
              ? Number(($event.target as HTMLSelectElement).value)
              : ($event.target as HTMLSelectElement).value,
          )
        "
      >
        <option v-for="value in field.enum" :key="String(value)" :value="value">
          {{ option(value) }}
        </option></select
      ><input
        v-else-if="['integer', 'number'].includes(field.type)"
        type="number"
        :value="modelValue[key] ?? field.default"
        :min="field.minimum"
        :max="field.maximum"
        :step="field.type === 'integer' ? 1 : 'any'"
        @input="set(key, Number(($event.target as HTMLInputElement).value))" /><input
        v-else-if="field.type === 'boolean'"
        type="checkbox"
        :checked="!!modelValue[key]"
        @change="set(key, ($event.target as HTMLInputElement).checked)" /><textarea
        v-else-if="['array', 'object'].includes(field.type)"
        rows="3"
        :value="JSON.stringify(modelValue[key] ?? field.default ?? (field.type === 'array' ? [] : {}))"
        @change="complex(key, $event, field)" /><input
        v-else
        :value="modelValue[key] ?? field.default ?? ''"
        @input="set(key, ($event.target as HTMLInputElement).value)"
    /></label>
  </div>
</template>
