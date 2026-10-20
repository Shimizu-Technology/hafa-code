/** Controls a toast must never cover, plus regions marked `data-dock-avoid` (footers). */
export const DOCK_OBSTACLE_SELECTOR = 'button, a[href], input, select, textarea, summary, [data-dock-avoid]'
const GAP_PX = 8
const MIN_TOP_PX = 8
const MAX_PASSES = 6

export type DockRect = { top: number; bottom: number; left: number; right: number }

/**
 * How far the dock must rise from its resting place so nothing in `obstacles` sits
 * under it. Rises past each overlapping control in turn; if the dock would leave the
 * top of the screen it stays where it was (covering something is better than vanishing).
 */
export function dockLift(dock: { left: number; right: number; height: number; restingBottom: number }, viewportHeight: number, obstacles: DockRect[]) {
  let lift = 0
  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    const bottomEdge = viewportHeight - dock.restingBottom - lift
    const topEdge = bottomEdge - dock.height
    if (topEdge < MIN_TOP_PX) return 0
    const blocking = obstacles.filter((rect) => rect.left < dock.right && dock.left < rect.right && rect.top < bottomEdge && topEdge < rect.bottom)
    if (blocking.length === 0) return lift
    const highestTop = Math.min(...blocking.map((rect) => rect.top))
    lift = viewportHeight - dock.restingBottom - highestTop + GAP_PX
  }
  return 0
}
