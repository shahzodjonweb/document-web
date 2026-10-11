import { createPublicApi } from '../../generated/api/client'
import type { User, Feature, Usage, Plan, Job, FileAsset, Quote } from '../../generated/api/types'
let profileWrites: Promise<unknown> = Promise.resolve()
let zoneSent = ''
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
  // A free account that has not joined the owner's Telegram channels is refused
  // any task with `channels_required`; the dialog that lists the channels opens
  // from here, so every page that starts a task gets it.
  const channelGate = useState<{ channels: any[] } | null>('channel-gate', () => null)
  async function api<T = any>(url: string, options: Record<string, any> = {}): Promise<T> {
    try {
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
    } catch (error: any) {
      const refused = error?.data?.error
      if (refused?.code === 'channels_required') channelGate.value = { channels: refused.message_params?.channels || [] }
      throw error
    }
  }
  const client = createPublicApi(api)
  // PATCH /me saves every profile field it read, so writes in flight together could undo
  // each other; they go one at a time.
  function updateProfile(body: Record<string, unknown>) {
    const write = profileWrites.then(() => api<User>('/me', { method: 'PATCH', body }))
    profileWrites = write.catch(() => {})
    return write.then((account) => (user.value?.id === account.id ? (user.value = account) : account))
  }
  // The bot has no device clock to read, so the account keeps the zone of the device last used.
  function syncTimeZone() {
    const zone = deviceTimeZone()
    if (!user.value || !zone || user.value.time_zone === zone || zoneSent === `${user.value.id}:${zone}`)
      return
    zoneSent = `${user.value.id}:${zone}`
    updateProfile({ time_zone: zone }).catch(() => {})
  }
  async function init() {
    try {
      const s = await client.session()
      user.value = s.user || null
      devAvailable.value = !!s.development_login_enabled
      csrfToken.value = s.csrf_token || ''
      apiError.value = false
      syncTimeZone()
    } catch {
      apiError.value = true
    } finally {
      sessionReady.value = true
    }
  }
  async function loadCatalog() {
    const accountId = user.value?.id
    let data
    try {
      data = await client.catalog()
    } catch (e) {
      apiError.value = true
      throw e
    }
    if (user.value?.id !== accountId) return
    features.value = data.features
      .map((f) => ({ ...f, category: f.category || '' }))
      .filter((f: Feature) => f.released !== false && f.enabled !== false && f.available !== false)
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
    await Promise.all([loadAccount(), loadCatalog(), loadPlans()])
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
        // Image-to-PDF had scanning switches from 6 to 11 Oct 2026. A draft a
        // tab saved then still carries them, and the server would only drop
        // them and log an out-of-date client. Drafts last as long as their
        // tab, so this can go once the server's warning has stopped.
        const parameters = { ...(d.parameters || {}) }
        delete parameters.auto_crop
        delete parameters.enhance_text
        activeParameters.value = parameters
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
    updateProfile,
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
