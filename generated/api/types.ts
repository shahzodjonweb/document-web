/** Public API v1 boundary. Source of truth: document-platform/contracts. No staff types. */
export interface User {
  id: string
  display_name: string
  first_name?: string
  telegram_id?: string | number
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
export interface Quote {
  id: string
  feature_id: string
  expires_at: string
  affordable?: boolean
  meters?: { meter: string; amount: number }[]
  cost?: Record<string, number>
  estimated_usage?: Record<string, number>
  remaining?: Record<string, number>
  input_pages?: number
  task_count?: number
  page_units?: number
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
  settled_usage?: Record<string, number>
  usage?: Record<string, number>
  [key: string]: unknown
}
export interface Usage {
  plan?: string
  plan_id?: string
  balances?: Record<string, number>
  remaining?: Record<string, number>
  daily_remaining?: number
  period_end?: string
  cycle_end?: string
  [key: string]: unknown
}
export interface Plan {
  id: string
  name?: string
  price_xtr: number | null
  file_tasks?: number
  max_file_mib?: number
  max_pages_per_job?: number
  daily_file_tasks?: number | null
  limits?: Record<string, number>
  [key: string]: unknown
}
