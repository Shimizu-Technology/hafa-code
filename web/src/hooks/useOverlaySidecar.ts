import { useEffect, useState } from 'react'

/**
 * Below this width a side column would squeeze the editor under ~480px, so the
 * Guide, Practice, and Coach open as a drawer and the Coach waits for "Fix this error".
 */
export const LEARNING_SIDECAR_OVERLAY_QUERY = '(max-width: 1599px)'

export function useOverlaySidecar() {
  const [overlay, setOverlay] = useState(() => (
    typeof window.matchMedia === 'function' && window.matchMedia(LEARNING_SIDECAR_OVERLAY_QUERY).matches
  ))

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(LEARNING_SIDECAR_OVERLAY_QUERY)
    const update = () => setOverlay(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return overlay
}
