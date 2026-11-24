/** Public API v1 boundary. Source of truth: document-platform/contracts. No staff types. */
export interface User {
  id: string
  display_name: string
  first_name?: string
  telegram_id?: string | number
  telegram_user_id?: string | null
  email?: string | null
  email_verified?: boolean
  google_email?: string | null
  login_methods?: { email: boolean; google: boolean; telegram: boolean }
  locale: string
  mode?: string
  timezone?: string
  time_zone?: string
  plan?: string
  is_test?: boolean
  preferences?: Record<string, unknown>
}
export interface Feature {
  id: string
  name: string
  category: string
  released?: boolean
  enabled?: boolean
  available?: boolean
  slug?: string
  plans?: Record<string, string>
  allowed?: boolean
  /** Server's plan verdict for this account; absent means unknown, treat as allowed. */
  eligible?: boolean
  parameter_schema?: Record<string, unknown>
}
export interface FileAsset {
  preview_url?: string | null
  id: string
  name?: string
  filename?: string
  original_name?: string
  size?: number
  size_bytes?: number
  pages?: number
  page_count?: number
  mime_type?: string
  /** Null for a file kept as long as an AI document that needs it (its source, its logo). */
  expires_at?: string | null
  status?: string
}
export interface Artifact {
  id: string
  filename?: string
  name?: string
  size_bytes?: number
  size?: number
  download_url?: string
  expires_at?: string | null
}
/** One weekly allowance; a null limit is unlimited. */
export interface WeeklyAllowance {
  limit: number | null
  used: number
  remaining: number | null
}
export interface Quote {
  id: string
  feature_id: string
  expires_at: string
  /** False when this week's allowance (or the file's edits) has no room for the task. */
  affordable?: boolean
  usage?: {
    ai_documents?: WeeklyAllowance
    file_jobs?: WeeklyAllowance
    edits_per_file?: number | null
    resets_at?: string
  }
  [key: string]: unknown
}
export interface Job {
  id: string
  feature_id: string
  status: string
  stage?: string
  created_at: string
  completed_at?: string | null
  artifacts?: Artifact[]
  outputs?: Artifact[]
  expires_at?: string
  input_names?: string[]
  parameters?: Record<string, unknown>
  error?: unknown
  warnings?: string[]
  [key: string]: unknown
}
/** This week's allowance. A week starts on Monday 00:00 in Tashkent for everyone. */
export interface Usage {
  plan?: string
  week?: { starts_at: string; resets_at: string; time_zone: string }
  ai_documents?: WeeklyAllowance
  file_jobs?: WeeklyAllowance
  edits_per_file?: number | null
  resets_at?: string
  [key: string]: unknown
}
/** A time-limited price cut on a plan; `price` is what the buyer pays, `regular` the undiscounted price, `until` the last day (ISO date). */
export interface PlanDiscount {
  price: number
  regular: number
  percent: number
  until: string
}
/** Prices are in UZS; a null price is a free plan. `discount` is null when no promotion is running. */
export interface Plan {
  id: string
  name?: string
  price_uzs: number | null
  discount: PlanDiscount | null
  /** Plan limits by key (weekly_ai_documents, weekly_file_jobs, edits_per_file, …); null is unlimited. */
  limits?: Record<string, number | null>
  [key: string]: unknown
}
/** One paid plan as the billing page offers it: today's price and the regular one it replaces. */
export interface BillingPlanOption {
  plan: 'plus' | 'premium'
  price: number
  regular_price: number
  discount: PlanDiscount | null
}
/** A card transfer: the customer pays the owner's card and uploads the receipt; the owner approves it. */
export interface ManualPayment {
  id: string
  reference: string
  plan: 'plus' | 'premium'
  amount: number
  currency: string
  status: 'awaiting' | 'submitted' | 'approved' | 'rejected' | 'cancelled' | 'expired' | 'refunded'
  channel?: string
  card: { number: string | null; last4: string; holder: string; label: string }
  receipt_received: boolean
  payer_note?: string
  created_at: string
  expires_at: string
  submitted_at?: string | null
  decided_at?: string | null
  rejection_reason?: string | null
  starts_at?: string | null
  active_until?: string | null
}
/**
 * An automatic payment through inPAY: the customer pays on inPAY's hosted page
 * and the plan switches on by itself. `test` is the owner trying the payment
 * system with test keys: no money moves and no plan is granted.
 */
export interface Checkout {
  id: string
  plan: 'plus' | 'premium'
  /** In so'm. */
  amount: number
  currency: string
  status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'expired' | 'refunded'
  test: boolean
  channel: 'web' | 'bot'
  /** inPAY's payment page: only while pending, and only for the signed-in owner. */
  checkout_url: string | null
  /** The bot's address, for a payment started in Telegram. */
  bot_url: string | null
  created_at: string
  expires_at: string
  paid_at: string | null
  /** The plan period it paid for, once paid. */
  starts_at: string | null
  active_until: string | null
  /** The fiscal receipt, when inPAY provides one. */
  receipt_url: string | null
}
/**
 * `GET /billing/manual`. `enabled` is card transfer alone; `plans` are listed
 * when either way to pay is open. An older platform sends `automatic` as
 * `{ available: false }` and no `checkout`.
 */
export interface BillingOptions {
  enabled: boolean
  currency: string
  period_days: number
  plans: BillingPlanOption[]
  automatic: { available: boolean; provider?: string; test?: boolean }
  payment: ManualPayment | null
  /** This customer's latest automatic payment worth showing: a pending one, or one finished in the last week. */
  checkout?: Checkout | null
}
/**
 * `GET /billing/renewal`: the card a customer saved through inPAY Avto PAY, on
 * the website or in the bot, and its monthly renewal. The website turns renewal
 * on (`POST`) and off (`DELETE /billing/renewal`) and removes the card
 * (`DELETE /billing/cards/{id}`).
 */
export interface AutoRenewalState {
  /** Whether this customer may save a card on the website and renew monthly now. */
  offered: boolean
  card: {
    id: string
    masked: string
    last4: string
    expiry: string
    consent_max: number | null
    /** Saved on the website: only such a card is charged in one tap here. */
    here: boolean
  } | null
  /** Renewal is off and can be turned on again from the saved card. */
  can_turn_on: boolean
  renewal: {
    status: 'on' | 'off' | 'stopped'
    plan: string
    /** When the next charge is due: the end of the paid period. */
    renews_at: string
    /** Today's price of the plan, in so'm; null when it is no longer sold. */
    amount: number | null
    /** Declined tries of this renewal so far, and when the next one is. */
    attempts: number
    next_try_at: string | null
    stopped_reason: string
    card_last4: string
  } | null
}
/** One charge of a saved card: `pending` while inPAY's answer is awaited; `reason` says why a failed one failed. */
export interface CardCharge {
  id: string
  status: 'pending' | 'paid' | 'failed' | 'review' | 'refunded'
  plan: 'plus' | 'premium'
  amount: number
  currency: string
  last4: string
  reason: 'declined' | 'consent_limit' | 'card_removed' | 'unavailable' | null
  active_until: string | null
  /** When renewal next charges this card, for a first month that turned it on. */
  renews_at: string | null
}
/**
 * `POST /billing/cards` and `GET /billing/cards/{id}`: a card being saved on
 * inPAY's page (`binding`, with `bind_url` while the page is open), then
 * `active` with the first month's `charge`, or `expired`/`removed`.
 */
export interface SavedCardState {
  id: string
  status: 'binding' | 'active' | 'expired' | 'removing' | 'removed'
  plan: 'plus' | 'premium' | null
  last4: string
  bind_url: string | null
  charge: CardCharge | null
}
/** `checkout` of `GET /plans`: which ways to pay are open to everyone. Absent from an older platform. */
export interface PaymentMethods {
  automatic: boolean
  card: boolean
}
