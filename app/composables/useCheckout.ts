import type { Checkout } from '../../generated/api/types'

/**
 * inPAY's payment page as the browser may open it, or null for any other
 * address: https on inpay.uz or a subdomain of it, and nothing else.
 */
export function checkoutDestination(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null
  try {
    const destination = new URL(value)
    const host = destination.hostname
    if (destination.protocol !== 'https:' || (host !== 'inpay.uz' && !host.endsWith('.inpay.uz'))) return null
    return destination.href
  } catch {
    return null
  }
}
/** A link the server sent, as a page may show it: https only, and on `host` when one is named. */
export function httpsLink(value: unknown, host?: string): string | null {
  if (typeof value !== 'string' || !value) return null
  try {
    const link = new URL(value)
    return link.protocol === 'https:' && (!host || link.hostname === host) ? link.href : null
  } catch {
    return null
  }
}

/**
 * One automatic payment, followed until it is settled. While it is pending the
 * server asks inPAY for the result on every read (throttled there), so reading
 * it every few seconds is how a page waits. It reads only while the tab is on
 * screen and gives up after `limit`; the customer can still ask by hand.
 */
export function useCheckout(options: { every: number; limit: number }) {
  const ws = useWorkspace()
  const telegram = useTelegramApp()
  const checkout = ref<Checkout | null>(null)
  /** A check the customer asked for is on its way. */
  const checking = ref(false)
  /** The page stopped checking by itself. */
  const waitedOut = ref(false)
  /** The customer asked and inPAY has still not confirmed. */
  const notYet = ref(false)
  /** The check the customer asked for did not get through. */
  const failed = ref(false)
  /** No such payment, as the server says (or a platform without automatic payment). */
  const missing = ref(false)
  const pending = computed(() => checkout.value?.status === 'pending')
  let timer: ReturnType<typeof setInterval> | undefined
  let deadline = 0
  let reading = false

  function stop() {
    if (timer) clearInterval(timer)
    timer = undefined
  }
  function tick() {
    if (Date.now() >= deadline) {
      stop()
      waitedOut.value = true
    } else if (document.visibilityState === 'visible') void read(checkout.value?.id)
  }
  /** Shows this payment and, while it is pending, keeps reading it. */
  function follow(value: Checkout | null) {
    const same = !!value && value.id === checkout.value?.id
    checkout.value = value
    if (value?.status !== 'pending') {
      stop()
      waitedOut.value = false
      notYet.value = false
    } else if (!same || (!timer && !waitedOut.value)) {
      stop()
      waitedOut.value = false
      notYet.value = false
      deadline = Date.now() + options.limit
      timer = setInterval(tick, options.every)
    }
  }
  /**
   * Takes the payment a wider answer names (`GET /billing/manual`). What this
   * page already learned stands: a pending payment it follows is not dropped by
   * an answer without it, and a settled one is not set back to pending by an
   * answer that was already on its way.
   */
  function adopt(value: Checkout | null) {
    const held = checkout.value
    if (!value) {
      if (held?.status !== 'pending') follow(null)
    } else if (!(held?.id === value.id && held.status !== 'pending' && value.status === 'pending'))
      follow(value)
  }
  async function read(id: string | undefined, asked = false) {
    // A read by the clock waits its turn; one the customer asked for always goes.
    if (!id || (reading && !asked)) return
    reading = true
    if (asked) {
      checking.value = true
      failed.value = false
      notYet.value = false
    }
    try {
      const value = await ws.api<Checkout>(`/billing/checkout/${encodeURIComponent(id)}`)
      if (checkout.value && checkout.value.id !== id) return
      missing.value = false
      follow(value)
      if (asked) notYet.value = value.status === 'pending'
    } catch (e: any) {
      const status = e?.statusCode ?? e?.status ?? e?.response?.status
      if (status === 404 && !checkout.value) missing.value = true
      else if (asked) failed.value = true
    } finally {
      reading = false
      if (asked) checking.value = false
    }
  }
  /** The customer's own "check now", for the payment on screen or the one an address names. */
  const check = (id: string | undefined = checkout.value?.id) => read(id, true)
  /** The first read of a payment an address names: nobody has asked twice yet. */
  async function find(id: string) {
    await read(id, true)
    notYet.value = false
  }

  /** Sends the customer to inPAY's page; inside Telegram it opens in the phone's browser and the Mini App stays. */
  function goToPayment() {
    // Only inPAY's payment host can receive this browser navigation.
    const destination = checkoutDestination(checkout.value?.checkout_url)
    if (!destination) throw new Error('Invalid checkout destination')
    if (!telegram.openLink(destination)) window.location.assign(destination)
  }

  // Coming back to the tab is when the answer matters most, whether or not the clock has run out.
  const onVisible = () => {
    if (document.visibilityState === 'visible' && pending.value) void read(checkout.value?.id)
  }
  onMounted(() => document.addEventListener('visibilitychange', onVisible))
  onBeforeUnmount(() => {
    stop()
    document.removeEventListener('visibilitychange', onVisible)
  })

  return {
    checkout,
    pending,
    checking,
    waitedOut,
    notYet,
    failed,
    missing,
    follow,
    adopt,
    find,
    check,
    goToPayment,
  }
}
