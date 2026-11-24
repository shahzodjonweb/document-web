import type { AutoRenewalState, CardCharge } from '../../generated/api/types'

/**
 * The customer's saved card (inPAY Avto PAY) and its monthly renewal, shared by
 * the billing page's panels: paying from the card changes what the renewal
 * panel shows. `null` when there is nothing to show, or the platform is older
 * than the endpoint.
 */
export function useRenewal() {
  const ws = useWorkspace()
  const state = useState<AutoRenewalState | null>('renewal-state', () => null)
  async function load() {
    try {
      state.value = await ws.api<AutoRenewalState>('/billing/renewal')
    } catch {
      state.value = null
    }
    return state.value
  }
  /** The saved card the website may charge in one tap: one saved here. */
  const card = computed(() => (state.value?.offered && state.value.card?.here ? state.value.card : null))
  return { state, card, load }
}

/** Why a saved card's charge failed, in the customer's words. */
export function cardReason(charge: CardCharge | null | undefined) {
  switch (charge?.reason) {
    case 'declined':
      return 'cardReasonDeclined'
    case 'consent_limit':
      return 'cardReasonConsentLimit'
    case 'card_removed':
      return 'cardReasonCardRemoved'
    default:
      return 'cardReasonUnavailable'
  }
}
