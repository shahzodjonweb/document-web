import { promptExamples } from '../../locales/extended'

/**
 * Complete descriptions a customer can drop into the form. They are the same
 * set the Telegram bot offers, so both surfaces teach the same thing.
 */
export function usePromptExamples() {
  const { locale } = useLocale()
  const index = computed(() => ['en', 'uz', 'ru'].indexOf(locale.value))
  return (featureId: string) =>
    (promptExamples[featureId] || []).map((row) => row[index.value < 0 ? 0 : index.value]!)
}
