import type { LocationQueryValue } from 'vue-router'

/**
 * The Telegram bot hands a document over as `?file_id=…`, repeated once per
 * file already attached to its draft. Vue Router gives a string for one and an
 * array for several, so normalise both shapes into the ids we can act on.
 */
export function linkedFileIds(
  value: LocationQueryValue | LocationQueryValue[] | undefined,
): string[] {
  return (Array.isArray(value) ? value : [value])
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean)
}
