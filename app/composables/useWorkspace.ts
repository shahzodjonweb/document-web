import { createPublicApi } from '../../generated/api/client'
import type { User, Feature, Usage, Plan, Job, FileAsset, Quote } from '../../generated/api/types'
export function useWorkspace() {
  const user = useState<User | null>('account', () => null)
  const sessionReady = useState('session-ready', () => false)
  const devAvailable = useState('development-auth', () => false)
  const features = useState<Feature[]>('features', () => [])
  const usage = useState<Usage | null>('usage', () => null)
  const plans = useState<Plan[]>('plans', () => [])
  const jobs = useState<Job[]>('jobs', () => [])
  const apiError = useState('api-error', () => false)
  const csrfToken = useState('csrf-token', () => '')
  const activeUploads = useState<FileAsset[]>('active-uploads', () => [])
  const activeTool = useState('active-tool', () => 'pdf.merge')
  const activeParameters = useState<Record<string, unknown>>('active-parameters', () => ({}))
  const quote = useState<Quote | null>('active-quote', () => null)
  const cookie = (name: string) =>
    import.meta.client
      ? document.cookie
          .split('; ')
          .find((c) => c.startsWith(`${name}=`))
          ?.split('=')
          .slice(1)
          .join('=') || ''
      : ''
  async function api<T = any>(url: string, options: Record<string, any> = {}): Promise<T> {
    return (await $fetch<T>(`/api/v1${url}`, {
      credentials: 'include',
      ...options,
      headers: {
        ...(options.method && options.method !== 'GET'
          ? { 'X-CSRFToken': decodeURIComponent(cookie('csrftoken') || csrfToken.value) }
          : {}),
        ...options.headers,
      },
    })) as T
  }
  const client = createPublicApi(api)
  async function init() {
    try {
      const s = await client.session()
      user.value = s.user || null
      devAvailable.value = !!s.development_login_enabled
      csrfToken.value = s.csrf_token || ''
      apiError.value = false
    } catch {
      apiError.value = true
    } finally {
      sessionReady.value = true
    }
  }
  async function loadCatalog() {
    let data
    try {
      data = await client.catalog()
    } catch (e) {
      apiError.value = true
      throw e
    }
    features.value = data.features
      .map((f) => ({ ...f, category: f.category || '' }))
      .filter(
        (f: Feature) =>
          f.released !== false &&
          f.enabled !== false &&
          f.available !== false &&
          /^(pdf\.(merge|compress|split|extract_pages|delete_pages|reorder|rotate|images_to_pdf|to_images|protect|unlock_known)|convert\.(word_to_pdf|pptx_to_pdf))$/.test(
            f.id,
          ),
      )
  }
  async function loadPlans() {
    let data
    try {
      data = await client.plans()
    } catch (e) {
      apiError.value = true
      throw e
    }
    const p = data.plans
    plans.value = Array.isArray(p)
      ? p
      : Object.entries(p)
          .filter(([, v]) => typeof v === 'object')
          .map(([id, v]) => ({ id, ...(v as any) }))
  }
  async function loadAccount() {
    if (!user.value) return
    try {
      const [u, j] = await Promise.all([client.usage(), client.jobs()])
      usage.value = u
      jobs.value = j.results
    } catch (e) {
      apiError.value = true
      throw e
    }
  }
  async function loginDev() {
    await api('/auth/dev-login', { method: 'POST', body: {} })
    await init()
    await loadAccount()
  }
  async function logout() {
    await api('/auth/session', { method: 'DELETE' })
    user.value = null
    usage.value = null
    jobs.value = []
    activeUploads.value = []
    quote.value = null
    if (import.meta.client) sessionStorage.removeItem('pdf-master-draft')
  }
  function persistDraft() {
    if (import.meta.client)
      sessionStorage.setItem(
        'pdf-master-draft',
        JSON.stringify({
          tool: activeTool.value,
          files: activeUploads.value,
          parameters: Object.fromEntries(
            Object.entries(activeParameters.value).filter(([key]) => !key.includes('password')),
          ),
        }),
      )
  }
  function restoreDraft() {
    if (!import.meta.client) return
    try {
      const d = JSON.parse(sessionStorage.getItem('pdf-master-draft') || 'null')
      if (d) {
        activeTool.value = d.tool
        activeUploads.value = d.files || []
        activeParameters.value = d.parameters || {}
      }
    } catch {}
  }
  return {
    user,
    sessionReady,
    devAvailable,
    features,
    usage,
    plans,
    jobs,
    apiError,
    activeUploads,
    activeTool,
    activeParameters,
    quote,
    api,
    init,
    loadCatalog,
    loadPlans,
    loadAccount,
    loginDev,
    logout,
    persistDraft,
    restoreDraft,
  }
}
