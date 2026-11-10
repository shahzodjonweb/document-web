/**
 * The public plans, catalog and contacts a server-rendered page shows, read
 * from the platform's public API.
 *
 * Kept for a minute, so a busy page does not ask the API on every visit, and
 * never longer: an admin's discount must not outlive its last day on a page.
 * The browser asks the API again after the page loads, and `usePricing` drops a
 * discount whose day has passed, so a minute-old answer is only ever a start.
 * A slow or failing API never fails the page: whatever did not arrive is null
 * and the browser fills it in.
 */
export type SiteData = { plans: unknown; catalog: unknown; contacts: unknown }

const FRESH_FOR = 60_000
/** A stale answer still beats an empty page while the API is down, but not for long. */
const STALE_FOR = 10 * 60_000
const TIMEOUT = 2_000

let kept: { at: number; data: SiteData } | null = null
let pending: Promise<SiteData> | null = null

async function read(origin: string, name: string): Promise<unknown> {
  try {
    return await $fetch(`${origin}/api/v1/${name}`, { timeout: TIMEOUT, retry: 0 })
  } catch {
    return null
  }
}

async function load(): Promise<SiteData> {
  const origin = String(useRuntimeConfig().apiOrigin || '').replace(/\/$/, '')
  const [plans, catalog, contacts] = await Promise.all(
    ['plans', 'catalog', 'contacts'].map((name) => read(origin, name)),
  )
  const data = { plans, catalog, contacts }
  if (plans && catalog && contacts) kept = { at: Date.now(), data }
  else if (kept && Date.now() - kept.at < STALE_FOR)
    return {
      plans: plans ?? kept.data.plans,
      catalog: catalog ?? kept.data.catalog,
      contacts: contacts ?? kept.data.contacts,
    }
  return data
}

export function publicData(): Promise<SiteData> {
  if (kept && Date.now() - kept.at < FRESH_FOR) return Promise.resolve(kept.data)
  pending ||= load().finally(() => {
    pending = null
  })
  return pending
}
