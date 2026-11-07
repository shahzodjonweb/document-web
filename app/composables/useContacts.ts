/** A Telegram account customers are pointed to, as set in the admin. */
export type Contact = { username: string; url: string }
/** The company behind the service; `phone` and `email` are empty until the admin sets them. */
export type Company = { name: string; tin: string; address: string; phone: string; email: string }
export type Contacts = { support: Contact; ads: Contact; company: Company }

// The contact links and the company details sit on the same Help page and
// mount together: they share one request instead of making two.
let pending: Promise<Contacts | null> | null = null

/**
 * The public contacts: the support and advertising Telegram accounts and the
 * company's legal details. Public, so it works on the signed-out Help page too.
 */
export function useContacts() {
  const contacts = ref<Contacts | null>(null)
  const loaded = ref(false)
  onMounted(async () => {
    // A plain string: Nuxt's typed routes otherwise expand every server route here.
    const url: string = '/api/v1/contacts'
    pending ||= $fetch<Contacts>(url)
      .catch(() => null)
      .finally(() => {
        pending = null
      })
    contacts.value = await pending
    loaded.value = true
  })
  return { contacts, loaded }
}
