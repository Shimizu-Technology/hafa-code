export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return

  if (!import.meta.env.PROD) {
    cleanupDevelopmentServiceWorkers()
    return
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Service worker registration failed:', error)
    })
  })
}

function cleanupDevelopmentServiceWorkers() {
  window.addEventListener('load', () => {
    Promise.all([
      navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(
        registrations.map((registration) => registration.unregister()),
      )),
      'caches' in window ? caches.keys().then((keys) => Promise.all(
        keys.filter((key) => key.startsWith('hafa-code-')).map((key) => caches.delete(key)),
      )) : Promise.resolve([]),
    ]).then(([unregistered]) => {
      if (unregistered.flat().some(Boolean) && navigator.serviceWorker.controller) {
        window.location.reload()
      }
    }).catch((error) => {
      console.warn('Service worker cleanup failed:', error)
    })
  })
}
