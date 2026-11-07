/**
 * A page's own changes under the switch: commands of the draft like the marks, sent
 * in the same job. Turning writes `rotate_page`, removing `delete_page`, and moving
 * one `reorder` that lists every page as uploaded, removed ones too, so restoring a
 * page never leaves the order short.
 *
 * Every page here is numbered as uploaded, as every mark is: the engine draws the
 * marks first and applies these last (processors/editor.py, `_page_stage`). So a
 * mark stays where it was put whatever happens to its page, and the stage only
 * shows the pages turned and in their new order.
 */
import { isPageCommand, newCommandId, type ClientCommand, type RotateAngle } from './useEditorCommands'

export interface PagePlan {
  /** Source page → the quarter turns it gains, clockwise. */
  turns: Record<number, RotateAngle>
  removed: number[]
  /** Every source page, removed ones too, in the order they will come. */
  order: number[]
}

/** How a page stands once turned: its width and height trade places on a quarter turn. */
export function turnedSize(size: { width: number; height: number }, turn = 0) {
  return turn % 180 ? { width: size.height, height: size.width } : size
}

export function useEditorPageOrder() {
  const session = useEditorSession()

  const count = computed(() => session.doc.value?.file.page_count ?? 0)
  const identity = computed(() => Array.from({ length: count.value }, (_, index) => index + 1))

  const plan = computed<PagePlan>(() => {
    const turns: Record<number, RotateAngle> = {}
    const removed: number[] = []
    let order = identity.value
    for (const command of session.commands.value) {
      if (command.type === 'rotate_page' && command.page && command.angle) turns[command.page] = command.angle
      else if (command.type === 'delete_page' && command.page) removed.push(command.page)
      // A stored order that no longer lists every page is not one to show.
      else if (command.type === 'reorder' && command.order?.length === count.value) order = command.order
    }
    return { turns, removed, order }
  })
  /** The pages that will be in the file, in their order. */
  const kept = computed(() => plan.value.order.filter((page) => !plan.value.removed.includes(page)))
  const changed = computed(() => session.commands.value.some(isPageCommand))

  const turnOf = (page: number) => plan.value.turns[page] ?? 0
  const isRemoved = (page: number) => plan.value.removed.includes(page)
  /** Where a page comes in the file being made, from 1; 0 for one removed. */
  const positionOf = (page: number) => kept.value.indexOf(page) + 1
  /** The marks a page holds, which go with it if it is removed. */
  const marksOn = (page: number) =>
    session.commands.value.filter((command) => command.page === page && !isPageCommand(command)).length

  /**
   * Writes a whole plan as one step of history. The page commands keep their ids
   * where they stay, and go after the marks there are; where they stand among them
   * makes no difference to the engine.
   */
  function write(label: string, next: PagePlan) {
    const previous = session.commands.value.filter(isPageCommand)
    const reuse = (match: (command: ClientCommand) => boolean) => previous.find(match)?._id ?? newCommandId()
    const made: ClientCommand[] = []
    for (const page of identity.value) {
      const angle = next.turns[page]
      if (angle)
        made.push({
          _id: reuse((command) => command.type === 'rotate_page' && command.page === page),
          type: 'rotate_page',
          page,
          angle,
        })
    }
    for (const page of [...next.removed].sort((a, b) => a - b))
      made.push({
        _id: reuse((command) => command.type === 'delete_page' && command.page === page),
        type: 'delete_page',
        page,
      })
    if (next.order.some((page, index) => page !== index + 1))
      made.push({ _id: reuse((command) => command.type === 'reorder'), type: 'reorder', order: next.order })
    return session.mutate(label, () => {
      session.commands.value = [
        ...session.commands.value.filter((command) => !isPageCommand(command)),
        ...made,
      ]
    })
  }

  function turn(page: number, direction: 1 | -1) {
    const angle = ((((turnOf(page) + direction * 90) % 360) + 360) % 360) as RotateAngle | 0
    const turns = { ...plan.value.turns }
    if (angle) turns[page] = angle
    else delete turns[page]
    write(`turn:${page}`, { ...plan.value, turns })
  }

  /** False when it is the last page left, as a file has at least one, or when a send holds the draft. */
  function remove(page: number) {
    if (isRemoved(page)) return true
    if (kept.value.length <= 1) return false
    return write(`remove:${page}`, { ...plan.value, removed: [...plan.value.removed, page] })
  }

  function restore(page: number) {
    if (!isRemoved(page)) return
    write(`restore:${page}`, { ...plan.value, removed: plan.value.removed.filter((value) => value !== page) })
  }

  /**
   * Puts a page before the kept page now at `position` (from 0), or last. Removed
   * pages keep their places among the rest, where Restore brings them back.
   */
  function moveTo(page: number, position: number) {
    const target = kept.value.filter((value) => value !== page)[position]
    const order = plan.value.order.filter((value) => value !== page)
    const at = target === undefined ? order.length : order.indexOf(target)
    order.splice(at, 0, page)
    if (order.every((value, index) => value === plan.value.order[index])) return false
    return write(`move:${page}`, { ...plan.value, order })
  }

  /** One place earlier or later among the pages that stay. */
  function moveBy(page: number, direction: 1 | -1) {
    const index = kept.value.indexOf(page)
    const next = index + direction
    if (index < 0 || next < 0 || next >= kept.value.length) return
    moveTo(page, next)
  }

  return {
    count,
    plan,
    kept,
    changed,
    turnOf,
    isRemoved,
    positionOf,
    marksOn,
    turn,
    remove,
    restore,
    moveTo,
    moveBy,
  }
}
