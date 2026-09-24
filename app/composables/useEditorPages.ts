/**
 * Page organisation: rotate, reorder, remove and extract.
 *
 * These are ordinary `pdf.*` jobs, not editor commands, so the result is a new
 * file and the editing draft is left untouched. The engine applies one
 * operation per job and cannot chain them, so a plan that needs more than one
 * step is shown as such rather than pretended away.
 */
export type Angle = 90 | 180 | 270

export interface PageJobStep {
  feature_id: 'pdf.rotate' | 'pdf.delete_pages' | 'pdf.reorder' | 'pdf.extract_pages'
  parameters: Record<string, unknown>
  /** Source pages this step touches, for the explainer. */
  pages: number[]
}

/** "1,2,3,5" → "1-3,5". Only safe when the list is ascending. */
export function compressRanges(pages: number[]): string {
  const sorted = [...pages].sort((a, b) => a - b)
  const parts: string[] = []
  let start: number | null = null
  let previous: number | null = null
  for (const page of sorted) {
    if (start === null || previous === null) {
      start = page
      previous = page
      continue
    }
    if (page === previous + 1) {
      previous = page
      continue
    }
    parts.push(start === previous ? `${start}` : `${start}-${previous}`)
    start = page
    previous = page
  }
  if (start !== null && previous !== null) parts.push(start === previous ? `${start}` : `${start}-${previous}`)
  return parts.join(',')
}

export function useEditorPages() {
  const ws = useWorkspace()
  const { t, path } = useLocale()
  const session = useEditorSession()

  const order = useState<number[]>('editor-page-order', () => [])
  const removed = useState<number[]>('editor-page-removed', () => [])
  const rotation = useState<Record<number, Angle>>('editor-page-rotation', () => ({}))
  const busy = useState('editor-pages-busy', () => false)
  const error = useState('editor-pages-error', () => '')

  const pageCount = computed(() => session.doc.value?.file.page_count ?? 0)
  const kept = computed(() => order.value.filter((page) => !removed.value.includes(page)))

  function reset() {
    order.value = Array.from({ length: pageCount.value }, (_, index) => index + 1)
    removed.value = []
    rotation.value = {}
    error.value = ''
  }

  function rotate(page: number, direction: 1 | -1) {
    const current = rotation.value[page] ?? 0
    const next = (((current + direction * 90) % 360) + 360) % 360
    const value = { ...rotation.value }
    if (next === 0) delete value[page]
    else value[page] = next as Angle
    rotation.value = value
  }

  function toggleRemoved(page: number) {
    if (removed.value.includes(page)) removed.value = removed.value.filter((value) => value !== page)
    else if (kept.value.length > 1) removed.value = [...removed.value, page]
    else error.value = t('editorPagesKeepOne')
  }

  function move(page: number, direction: 1 | -1) {
    const index = order.value.indexOf(page)
    const target = index + direction
    if (index < 0 || target < 0 || target >= order.value.length) return
    const next = [...order.value]
    const [moved] = next.splice(index, 1)
    if (moved !== undefined) next.splice(target, 0, moved)
    order.value = next
  }

  /**
   * Rotation runs as one job per angle because the engine takes a single angle.
   * The structural change is always one job: `pdf.extract_pages` preserves the
   * order it is given, so removing and reordering collapse into one step.
   */
  const plan = computed<PageJobStep[]>(() => {
    const steps: PageJobStep[] = []
    const byAngle = new Map<Angle, number[]>()
    for (const [page, angle] of Object.entries(rotation.value)) {
      const number = Number(page)
      if (removed.value.includes(number)) continue
      byAngle.set(angle, [...(byAngle.get(angle) ?? []), number])
    }
    for (const [angle, pages] of [...byAngle.entries()].sort((a, b) => a[0] - b[0]))
      steps.push({
        feature_id: 'pdf.rotate',
        parameters: { pages: compressRanges(pages), angle },
        pages: [...pages].sort((a, b) => a - b),
      })

    const remaining = kept.value
    const ascending = remaining.every((page, index) => index === 0 || page > (remaining[index - 1] ?? 0))
    if (remaining.length === pageCount.value && ascending) return steps
    if (ascending)
      steps.push({
        feature_id: 'pdf.delete_pages',
        parameters: { pages: compressRanges(removed.value) },
        pages: [...removed.value].sort((a, b) => a - b),
      })
    else if (remaining.length === pageCount.value)
      steps.push({ feature_id: 'pdf.reorder', parameters: { order: remaining }, pages: remaining })
    else
      // Explicit list, never compressed: extract preserves the supplied order.
      steps.push({ feature_id: 'pdf.extract_pages', parameters: { pages: remaining.join(',') }, pages: remaining })
    return steps
  })

  const idempotency = useState<Record<string, string>>('idempotency', () => ({}))

  /** Extract exactly the selected pages, in their current order, as a new file. */
  async function extract(pages: number[]) {
    if (!pages.length) return
    await run({ feature_id: 'pdf.extract_pages', parameters: { pages: pages.join(',') }, pages })
  }

  async function run(step: PageJobStep) {
    const current = session.doc.value
    if (!current || busy.value) return
    busy.value = true
    error.value = ''
    try {
      const quote = await ws.api<{ id: string }>('/quotes', {
        method: 'POST',
        body: {
          feature_id: step.feature_id,
          input_ids: [current.file.id],
          parameters: step.parameters,
        },
      })
      if (!idempotency.value[quote.id]) idempotency.value[quote.id] = crypto.randomUUID()
      const key = idempotency.value[quote.id] as string
      sessionStorage.setItem('pdf-master-pending-job', JSON.stringify({ quote_id: quote.id, key }))
      const job = await ws.api<{ id: string }>('/jobs', {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: { quote_id: quote.id },
      })
      sessionStorage.removeItem('pdf-master-pending-job')
      await ws.loadAccount()
      await navigateTo(path(`/app/jobs/${job.id}`))
    } catch (e: any) {
      const status = e?.statusCode || e?.status || e?.response?.status
      if (status >= 400 && status < 500) sessionStorage.removeItem('pdf-master-pending-job')
      error.value = session.requestError(e)
    } finally {
      busy.value = false
    }
  }

  async function apply() {
    const steps = plan.value
    if (!steps.length) return
    const first = steps[0]
    if (first) await run(first)
  }

  return { order, removed, rotation, kept, plan, busy, error, pageCount, reset, rotate, toggleRemoved, move, apply, extract }
}
