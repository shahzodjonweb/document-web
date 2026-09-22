import type { components } from './schema'
type Schemas = components['schemas']
export type PublicRequest = <T = unknown>(path: string, options?: Record<string, unknown>) => Promise<T>
/** Thin same-origin transport over the pinned, generated public OpenAPI types. */
export function createPublicApi(request: PublicRequest) {
  return {
    session: () => request<Schemas['Session']>('/auth/session'),
    catalog: () => request<{ features: Schemas['Feature'][]; draft: boolean }>('/catalog'),
    usage: () => request<Schemas['Usage']>('/usage'),
    jobs: () => request<{ results: Schemas['Job'][]; count: number }>('/jobs'),
    job: (id: string) => request<Schemas['Job']>(`/jobs/${encodeURIComponent(id)}`),
    plans: () => request<{ plans: Schemas['Plan'][]; draft: boolean; checkout_enabled: boolean }>('/plans'),
  }
}
