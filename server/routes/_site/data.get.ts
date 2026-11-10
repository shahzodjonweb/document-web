// Outside `/api/**`, which is proxied to the platform as a whole.
export default defineEventHandler((event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return publicData()
})
