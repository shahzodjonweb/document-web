export interface SignInProvider {
  enabled: boolean
  configured: boolean
}
export interface SignInProviders {
  email: SignInProvider
  google: SignInProvider
  telegram: SignInProvider
}
export function useAuthentication() {
  const ws = useWorkspace()
  const { t, locale } = useLocale()
  const providers = useState<SignInProviders | null>('sign-in-providers', () => null)
  const providerError = useState('sign-in-providers-error', () => false)
  const providerLoading = useState('sign-in-providers-loading', () => false)
  const ready = (provider: keyof SignInProviders) =>
    !!providers.value?.[provider]?.enabled && !!providers.value?.[provider]?.configured
  async function loadProviders() {
    providerLoading.value = true
    providerError.value = false
    try {
      providers.value = await ws.api<SignInProviders>('/auth/providers')
    } catch {
      providers.value = null
      providerError.value = true
    } finally {
      providerLoading.value = false
    }
  }
  function errorMessage(error: any) {
    const code = typeof error === 'string' ? error : error?.data?.error?.code || ''
    const messages: Record<string, string> = {
      invalid_credentials: 'authInvalidCredentials',
      invalid_login: 'authInvalidCredentials',
      invalid_code: 'authInvalidCode',
      invalid_verification_code: 'authInvalidCode',
      invalid_email: 'authInvalidEmail',
      verification_locked: 'authVerificationLocked',
      identity_already_linked: 'authIdentityConflict',
      email_already_linked: 'authIdentityConflict',
      google_already_linked: 'authIdentityConflict',
      session_changed: 'authSessionExpired',
      google_login_failed: 'authGoogleFailed',
      invalid_oauth_state: 'authGoogleFailed',
      verification_invalid: 'authInvalidCode',
      verification_expired: 'authExpiredCode',
      challenge_expired: 'authExpiredCode',
      expired: 'authExpiredCode',
      invalid_challenge: 'authExpiredCode',
      identity_conflict: 'authIdentityConflict',
      account_conflict: 'authIdentityConflict',
      email_conflict: 'authIdentityConflict',
      email_in_use: 'authIdentityConflict',
      telegram_already_linked: 'authIdentityConflict',
      already_linked: 'authIdentityConflict',
      rate_limited: 'authRateLimited',
      too_many_attempts: 'authRateLimited',
      invalid_password: 'authPasswordInvalid',
      weak_password: 'authPasswordInvalid',
      invalid_current_password: 'authCurrentPasswordInvalid',
      provider_unavailable: 'authProviderUnavailable',
      provider_not_configured: 'authProviderUnavailable',
      auth_disabled: 'authProviderUnavailable',
      email_not_configured: 'authProviderUnavailable',
      google_not_configured: 'authProviderUnavailable',
      email_unavailable: 'authEmailUnavailable',
      email_delivery_failed: 'authEmailUnavailable',
      google_cancelled: 'authGoogleCancelled',
      access_denied: 'authGoogleCancelled',
      google_failed: 'authGoogleFailed',
      oauth_failed: 'authGoogleFailed',
      invalid_state: 'authGoogleFailed',
      authentication_required: 'authSessionExpired',
      session_expired: 'authSessionExpired',
    }
    return t(messages[code] || 'authFailed')
  }
  async function refreshAccount() {
    await ws.init()
    await Promise.allSettled([ws.loadAccount(), ws.loadCatalog(), ws.loadPlans()])
  }
  async function startGoogle(intent: 'login' | 'link') {
    const result = await ws.api<{ authorization_url: string }>('/auth/google/start', {
      method: 'POST',
      body: { intent, locale: locale.value },
    })
    // Only the Google authorization host can receive this browser navigation.
    const destination = new URL(result.authorization_url)
    if (destination.protocol !== 'https:' || destination.hostname !== 'accounts.google.com') {
      throw new Error('Invalid Google authorization destination')
    }
    window.location.assign(destination.href)
  }
  return {
    providers,
    providerLoading,
    providerError,
    ready,
    loadProviders,
    errorMessage,
    refreshAccount,
    startGoogle,
  }
}
