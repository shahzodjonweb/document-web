export interface StudioFeature {
  id: string
  name: string
  surface: string
  eligible?: boolean
  requires_provider?: boolean
  parameter_schema?: Record<string, any>
  parameters?: Record<string, any>
  locales?: string[]
  /** Most pages this account can be given in one document of this kind. */
  max_pages?: number
  /** Stock photos one deck can carry on this plan; 0 when photos are off. */
  max_images?: number
}
export interface StudioConfig {
  provider: { mode: string; label: string; configured: boolean; image_configured?: boolean }
  features: StudioFeature[]
  generation_features?: StudioFeature[]
  editor_features?: StudioFeature[]
  templates?: any[]
  /** Pages produced when the description names no count. */
  default_pages?: number
  [key: string]: any
}
export function useStudio() {
  const ws = useWorkspace()
  const config = useState<StudioConfig | null>('studio-config', () => null)
  const loaded = useState('studio-loaded', () => false)
  async function load() {
    if (!ws.user.value) {
      config.value = null
      loaded.value = true
      return
    }
    try {
      config.value = await ws.api('/studio/config')
    } catch {
      config.value = null
    } finally {
      loaded.value = true
    }
  }
  const features = computed(() => config.value?.features || config.value?.generation_features || [])
  const localProvider = computed(() => config.value?.provider?.mode === 'local_fixture')
  return { config, features, loaded, localProvider, load }
}
