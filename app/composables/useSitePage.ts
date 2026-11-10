import { localized, sitePage } from '../../content/site/routes'

/**
 * The public page on screen (content/site/routes.ts) and its breadcrumb trail,
 * named in the page's language: what the visible breadcrumb and the head's
 * structured data both show, so the two never differ.
 */
export function useSitePage() {
  const route = useRoute()
  const { t, locale } = useLocale()
  const view = computed(() => route.path.replace(/^\/(en|uz|ru)/, '').replace(/\/$/, '') || '/')
  const page = computed(() => sitePage(view.value))
  const crumbs = computed(() =>
    page.value
      ? [...page.value.parents, view.value].map((path) => ({
          name: t(sitePage(path)?.crumb || 'siteCrumbHome'),
          path: localized(locale.value, path),
          view: path,
        }))
      : [],
  )
  return { view, page, crumbs }
}
