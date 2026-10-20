import { useEffect, useState } from 'react'

/**
 * The phone layout in App.css: bottom navigation in portrait, a navigation rail on a
 * sideways phone. Keep this in step with the matching `@media` rules there.
 */
export const PHONE_LAYOUT_QUERY = '(max-width: 640px), (max-height: 500px) and (max-width: 950px) and (orientation: landscape)'

export function usePhoneLayout() {
  const [phone, setPhone] = useState(() => (
    typeof window.matchMedia === 'function' && window.matchMedia(PHONE_LAYOUT_QUERY).matches
  ))

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(PHONE_LAYOUT_QUERY)
    const update = () => setPhone(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return phone
}
