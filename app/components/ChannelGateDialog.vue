<script setup lang="ts">
/**
 * The Free and Plus plans are for members of the owner's Telegram channels;
 * Premium is never asked. When a task is refused because a Free or Plus account
 * has not joined them, this lists the channels, opens each in Telegram, and asks
 * the server again on "I've joined".
 */
const { t, path } = useLocale()
const ws = useWorkspace()
const gate = useState<{ channels: any[] } | null>('channel-gate', () => null)
const dialog = ref<HTMLDialogElement>()
const busy = ref(false)
const notice = ref('')
const joined = ref(false)

watch(
  gate,
  (value) => {
    if (!import.meta.client || !dialog.value) return
    if (value && !dialog.value.open) {
      notice.value = ''
      joined.value = false
      dialog.value.showModal()
    } else if (!value && dialog.value.open) dialog.value.close()
  },
  { flush: 'post' },
)
function close() {
  gate.value = null
}
async function check() {
  busy.value = true
  notice.value = ''
  try {
    const state: any = await ws.api('/channels/check', { method: 'POST' })
    if (state.joined) {
      joined.value = true
      gate.value = { channels: state.channels }
    } else {
      gate.value = { channels: state.channels }
      notice.value = t('channelsNotYet', {
        titles: state.channels.filter((c: any) => !c.joined).map((c: any) => c.title).join(', '),
      })
    }
  } catch {
    notice.value = t('genericError')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <dialog
    ref="dialog"
    class="antibot-dialog channel-dialog"
    aria-labelledby="channel-title"
    aria-describedby="channel-description"
    data-testid="channel-gate"
    @cancel.prevent="close"
  >
    <div class="antibot-heading">
      <BrandIcon />
      <h2 id="channel-title">{{ t(joined ? 'channelsWelcomeTitle' : 'channelsTitle') }}</h2>
    </div>
    <template v-if="joined">
      <p id="channel-description">{{ t('channelsWelcome') }}</p>
      <div class="antibot-actions">
        <button type="button" class="button primary" @click="close">{{ t('channelsContinue') }}</button>
      </div>
    </template>
    <template v-else>
      <p id="channel-description">{{ t('channelsBody') }}</p>
      <ul class="channel-list">
        <li v-for="channel in gate?.channels || []" :key="channel.url">
          <a class="button secondary full" :href="channel.url" target="_blank" rel="noopener"
            ><AppIcon :name="channel.joined ? 'check' : 'send'" :size="17" />{{ channel.title }}</a
          >
        </li>
      </ul>
      <p v-if="notice" class="error-banner" role="alert">{{ notice }}</p>
      <div class="antibot-actions">
        <button type="button" class="button primary" :disabled="busy" data-testid="channels-joined" @click="check">
          {{ busy ? t('working') : t('channelsJoined') }}</button
        ><button type="button" class="button secondary" @click="close">{{ t('cancel') }}</button>
      </div>
      <NuxtLink class="text-link channel-plans" :to="path('/app/billing')" @click="close">{{
        t('channelsOrPlans')
      }}</NuxtLink>
    </template>
  </dialog>
</template>
