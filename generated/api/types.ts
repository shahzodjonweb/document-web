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
  expires_at?: string
  status?: string
}
export interface Artifact {
  id: string
  filename?: string
  name?: string
  size_bytes?: number
  size?: number
  download_url?: string
  expires_at?: string
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
