<script setup lang="ts">
// Invite friends (docs/site/design/pages/invite.md): the reward ladder, how to
// invite and where the link lives. Rewards are Plus periods, never money, and
// the public page shows no counts of anyone's invitations.
definePageMeta({ layout: 'site' })
const { t, path, bot } = useSite()
// A number stays on the line of the word after it ("5 friends", "30 days").
const glue = (text: string) => text.replace(/(\d) (?=\p{L})/gu, '$1\u00a0')
</script>
<template>
  <div class="site-invite">
    <SiteBreadcrumb />
    <section class="site-hero" aria-labelledby="invite-title">
      <div class="site-container site-invite-head">
        <h1 id="invite-title" class="site-h1">{{ t('siteInviteTitle') }}</h1>
        <p class="site-lead">{{ glue(t('siteInviteLead')) }}</p>
        <div class="site-invite-track">
          <ol class="site-invite-ladder" :aria-label="t('siteInviteLadderLabel')">
            <li v-for="n in 4" :key="n">
              <span class="site-invite-rung" aria-hidden="true"><AppIcon name="gift" class="site-icon" /></span>
              <b>{{ t(`siteInviteStep${n}Count`) }}</b>
              <span>{{ t(`siteInviteStep${n}Reward`) }}</span>
            </li>
            <li class="is-more">
              <span class="site-invite-rung" aria-hidden="true"><AppIcon name="more" class="site-icon" /></span>
              <span>{{ t('siteInviteStepMore') }}</span>
            </li>
          </ol>
        </div>
        <div class="site-invite-notes">
          <p class="site-note"><AppIcon name="calendar" class="site-icon" /><span>{{ glue(t('siteInviteCapNote')) }}</span></p>
          <p class="site-note"><AppIcon name="info" class="site-icon" /><span>{{ glue(t('siteInviteNotMoney')) }}</span></p>
        </div>
      </div>
    </section>

    <section class="site-section is-band" aria-labelledby="invite-steps">
      <div class="site-container">
        <SiteSectionHead id="invite-steps" :title="t('siteInviteStepsTitle')" />
        <ol class="site-steps">
          <li v-for="n in 3" :key="n">
            <h3 class="site-h3">{{ t(`siteInviteHowStep${n}Title`) }}</h3>
            <p>{{ t(`siteInviteHowStep${n}Text`) }}</p>
          </li>
        </ol>
        <div class="site-actions site-invite-cta">
          <NuxtLink class="site-btn is-primary is-lg" :to="path('/app/referrals')"
            ><AppIcon name="share" class="site-icon" />{{ t('siteInviteCta') }}</NuxtLink
          >
          <a v-if="bot?.url" class="site-btn is-secondary is-lg" :href="bot.url" target="_blank" rel="noopener"
            ><AppIcon name="send" class="site-icon" />{{ t('siteInviteCtaTelegram') }}</a
          >
        </div>
      </div>
    </section>

    <SiteFaq page="invite" :title="t('siteInviteFaqTitle')" :to="path('/help')" :link="t('siteFooterHelpCentre')" open />
  </div>
</template>
