export interface AntiBotConfiguration {
  enabled: boolean
  configured: boolean
  site_key: string
  binding: string
}
interface VerificationRequest {
  id: number
  siteKey: string
  binding: string
}
let sequence = 0
let pending: { id: number; resolve: (token: string) => void; reject: (error: unknown) => void } | null = null
export const antiBotError = (code: string) => ({ data: { error: { code } } })

export function useAntiBot() {
  const ws = useWorkspace()
  const route = useRoute()
  const request = useState<VerificationRequest | null>('antibot-request', () => null)
  function finish(id: number, token?: string) {
    if (!pending || pending.id !== id) return
    const current = pending
    pending = null
    request.value = null
    if (token) current.resolve(token)
    else current.reject(antiBotError('antibot_cancelled'))
  }
  async function verify(): Promise<string> {
    if (!import.meta.client) throw antiBotError('antibot_unavailable')
    if (pending) throw antiBotError('antibot_busy')
    const startedRoute = route.fullPath
    let config: AntiBotConfiguration | undefined
    try {
      // Re-read settings for every attempt: the admin can enable protection at any time.
      const providers = await ws.api<{ antibot?: AntiBotConfiguration }>('/auth/providers')
      config = providers.antibot
    } catch {
      throw antiBotError('antibot_unavailable')
    }
    if (route.fullPath !== startedRoute) throw antiBotError('antibot_cancelled')
    if (!config || typeof config.enabled !== 'boolean') throw antiBotError('antibot_unavailable')
    if (!config.enabled) return ''
    if (
      !config.configured ||
      typeof config.site_key !== 'string' ||
      !config.site_key.trim() ||
      typeof config.binding !== 'string' ||
      !config.binding
    ) {
      throw antiBotError('antibot_unavailable')
    }
    if (pending) throw antiBotError('antibot_busy')
    return new Promise<string>((resolve, reject) => {
      const id = ++sequence
      pending = { id, resolve, reject }
      request.value = { id, siteKey: config.site_key, binding: config.binding }
    })
  }
  return { request, verify, finish }
}
