import { afterEach } from 'vitest'

afterEach(() => {
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})
