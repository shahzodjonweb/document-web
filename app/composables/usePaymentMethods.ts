/**
 * The ways to pay that are open to everyone right now, for copy read before
 * signing in: the pricing page's steps, the FAQ, the footer. Until the platform
 * names them, card transfer is the one way, as it always was.
 */
export function usePaymentMethods() {
  const { paymentMethods } = useWorkspace()
  const automatic = computed(() => paymentMethods.value?.automatic === true)
  const card = computed(() => (paymentMethods.value ? paymentMethods.value.card : true))
  // inPAY takes Click, Payme, Uzcard and Humo; a transfer from a bank app also works with Visa and Mastercard.
  const names = computed(() =>
    automatic.value
      ? ['Click', 'Payme', 'Uzcard', 'Humo', ...(card.value ? ['Visa', 'Mastercard'] : [])]
      : ['Uzcard', 'Humo', 'Visa', 'Mastercard'],
  )
  return { automatic, card, names }
}
