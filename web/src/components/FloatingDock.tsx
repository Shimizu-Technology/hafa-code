import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { DOCK_OBSTACLE_SELECTOR, dockLift } from '../lib/dockPlacement'

/**
 * Toasts and "Fix this error" float bottom-right (above the phone navigation). At short
 * window heights that spot holds the output footer, Copy output, and the page footer, so
 * the dock lifts itself just above whatever control would be underneath.
 */
export function FloatingDock({ children }: { children: ReactNode }) {
  const dockRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const dock = dockRef.current
    if (!dock) return
    let frame = 0

    const place = () => {
      frame = 0
      if (dock.childElementCount === 0) {
        dock.style.removeProperty('--dock-lift')
        return
      }
      const currentLift = parseFloat(dock.style.getPropertyValue('--dock-lift')) || 0
      const rect = dock.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      // `bottom` ignores the lift transform, so this stays right while the dock is moving.
      const restingBottom = parseFloat(getComputedStyle(dock).bottom) || 0
      const obstacles = Array.from(document.querySelectorAll<HTMLElement>(DOCK_OBSTACLE_SELECTOR))
        .filter((element) => !dock.contains(element) && !element.closest('[aria-hidden="true"], [inert]'))
        .map((element) => element.getBoundingClientRect())
        .filter((box) => box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < viewportHeight)
      const lift = dockLift({ left: rect.left, right: rect.right, height: dock.offsetHeight, restingBottom }, viewportHeight, obstacles)
      if (lift !== currentLift) dock.style.setProperty('--dock-lift', `${lift}px`)
    }
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(place)
    }

    place()
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null
    resizeObserver?.observe(dock)
    const mutationObserver = new MutationObserver(schedule)
    mutationObserver.observe(dock, { childList: true, subtree: true, characterData: true })
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, { capture: true, passive: true })
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
      mutationObserver.disconnect()
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, { capture: true })
    }
  }, [])

  return <div className="floating-dock" ref={dockRef}>{children}</div>
}
