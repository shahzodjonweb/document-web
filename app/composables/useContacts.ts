/** A Telegram account customers are pointed to, as set in the admin. */
export type Contact = { username: string; url: string }
/** The company behind the service; `phone` and `email` are empty until the admin sets them. */
export type Company = { name: string; tin: string; address: string; phone: string; email: string }
/** `bot` is the bot's public username and link, empty until the admin sets it (absent from an older platform). */
export type Contacts = { support: Contact; ads: Contact; bot?: Contact; company: Company }

// The contact links and the company details sit on the same pages and mount
// together: they share one request instead of making two.
let pending: Promise<Contacts | null> | null = null

/** The page's contacts, shared by every reader; a server-rendered page arrives with them. */
export function contactsState() {
  return {
    contacts: useState<Contacts | null>('contacts', () => null),
    loaded: useState('contacts-loaded', () => false),
  }
}

/**
 * The public contacts: the support and advertising Telegram accounts and the
 * company's legal details. Public, so it works on the signed-out Help page too.
 */
export function useContacts() {
  const { contacts, loaded } = contactsState()
  onMounted(async () => {
    if (loaded.value) return
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
