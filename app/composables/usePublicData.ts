import type { Contacts } from './useContacts'

/**
 * Fills the plans, the tools and the contacts on the server, so a rendered page
 * carries its prices and its tools in the HTML. Their state goes to the browser
 * with the page; the app still asks the API for fresh copies once it mounts.
 * Call it from setup, on the server only: the states are taken before the wait.
 */
export async function loadPublicData() {
  const ws = useWorkspace()
  const { contacts, loaded } = contactsState()
  // A plain string: Nuxt's typed routes otherwise expand every server route here.
  const url: string = '/_site/data'
  const data = await $fetch<{ plans: any; catalog: any; contacts: Contacts | null }>(url).catch(() => null)
  if (!data) return
  if (data.plans) ws.plans.value = plansFrom(data.plans)
  if (data.catalog) ws.features.value = featuresFrom(data.catalog)
  if (data.contacts) {
    contacts.value = data.contacts
    loaded.value = true
  }
}
