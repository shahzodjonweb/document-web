<script setup lang="ts">
interface TurnstileApi {
  render: (container: HTMLElement, options: Record<string, unknown>) => string | undefined
  remove: (id: string) => void
  ready: (callback: () => void) => void
}
const verification = useAntiBot()
const { t, locale } = useLocale()
const route = useRoute()
const dialog = ref<HTMLDialogElement>()
const container = ref<HTMLElement>()
const phase = ref<'loading' | 'checking' | 'failed'>('loading')
const problem = ref('antibotFailed')
let widgetId: string | undefined
let generation = 0
let abortScript: (() => void) | undefined
let previousFocus: HTMLElement | null = null
const turnstile = () => (window as typeof window & { turnstile?: TurnstileApi }).turnstile
function removeWidget() {
  if (widgetId !== undefined) {
    try {
      turnstile()?.remove(widgetId)
    } catch {}
    widgetId = undefined
  }
  container.value?.replaceChildren()
}
function cleanup() {
  generation++
  abortScript?.()
  abortScript = undefined
  removeWidget()
}
function cancel() {
  const id = verification.request.value?.id
  cleanup()
  if (id !== undefined) verification.finish(id)
}
function loadScript(): Promise<TurnstileApi> {
  const existing = turnstile()
  if (existing) return Promise.resolve(existing)
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.dataset.pdfMasterTurnstile = 'true'
    let settled = false
    const settle = (api?: TurnstileApi) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      script.onload = null
      script.onerror = null
      abortScript = undefined
      if (api) resolve(api)
      else {
        script.remove()
        reject(new Error('Verification script unavailable'))
      }
    }
    const timeout = window.setTimeout(() => settle(), 15000)
    abortScript = () => settle()
    script.onerror = () => settle()
    script.onload = () => {
      try {
        const api = turnstile()
        if (api) api.ready(() => settle(api))
        else settle()
      } catch {
        settle()
      }
    }
    document.head.appendChild(script)
  })
}
async function start() {
  cleanup()
  const request = verification.request.value
  if (!request) return
  const attempt = generation
  phase.value = 'loading'
  try {
    const api = await loadScript()
    if (attempt !== generation || !container.value) return
    phase.value = 'checking'
    const fail = (message: string) => {
      if (attempt !== generation) return
      generation++
      removeWidget()
      problem.value = message
      phase.value = 'failed'
    }
    const id = api.render(container.value, {
      sitekey: request.siteKey,
      action: 'customer_auth',
      cData: request.binding,
      appearance: 'interaction-only',
      execution: 'render',
      theme: 'auto',
      language: locale.value === 'ru' ? 'ru' : 'en',
      size: container.value.clientWidth < 300 ? 'compact' : 'flexible',
      retry: 'never',
      'refresh-expired': 'never',
      'refresh-timeout': 'never',
      'response-field': false,
      callback: (token: string) => {
        if (attempt !== generation) return
        if (typeof token !== 'string' || !token || token.length > 2048) return fail('antibotFailed')
        cleanup()
        verification.finish(request.id, token)
      },
      'error-callback': () => {
        fail('antibotFailed')
        return true
      },
      'expired-callback': () => fail('antibotExpired'),
      'timeout-callback': () => fail('antibotExpired'),
      'unsupported-callback': () => fail('antibotUnavailable'),
    })
    if (attempt !== generation && id !== undefined) api.remove(id)
    else if (id === undefined) fail('antibotFailed')
    else widgetId = id
  } catch {
    if (attempt !== generation) return
    problem.value = 'antibotUnavailable'
    phase.value = 'failed'
  }
}
watch(
  () => verification.request.value?.id,
  async (id) => {
    if (id === undefined) {
      cleanup()
      dialog.value?.close()
      await nextTick()
      if (previousFocus?.isConnected) previousFocus.focus()
      return
    }
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    await nextTick()
    if (verification.request.value?.id !== id) return
    dialog.value?.showModal()
    await start()
  },
)
watch(() => route.fullPath, cancel)
onBeforeUnmount(cancel)
</script>
<template>
  <dialog
    ref="dialog"
    class="antibot-dialog"
    aria-labelledby="antibot-title"
    aria-describedby="antibot-description"
    @cancel.prevent="cancel"
  >
    <div class="antibot-heading">
      <BrandIcon />
      <h2 id="antibot-title">{{ t('antibotTitle') }}</h2>
    </div>
    <p id="antibot-description">{{ t('antibotDescription') }}</p>
    <p v-if="phase !== 'failed'" class="antibot-status" role="status">
      <AppIcon name="loader" :size="18" class="spin" />{{
        t(phase === 'loading' ? 'antibotLoading' : 'antibotChecking')
      }}
    </p>
    <p v-else class="error-banner" role="alert">{{ t(problem) }}</p>
    <div ref="container" class="antibot-widget" />
    <div class="antibot-actions">
      <button v-if="phase === 'failed'" type="button" class="button primary" @click="start">
        {{ t('retry') }}</button
      ><button type="button" class="button secondary" @click="cancel">{{ t('cancel') }}</button>
    </div>
  </dialog>
</template>
