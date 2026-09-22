export default defineNuxtRouteMiddleware((to) => {
  if (!/^\/(en|uz|ru)(\/|$)/.test(to.path))
    return navigateTo(`/en${to.path === '/' ? '' : to.fullPath}`, { replace: true })
})
