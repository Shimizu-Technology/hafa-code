const SERVICE_WORKER_VERSION = '__HAFA_CODE_SW_VERSION__'
const CACHE_PREFIX = 'hafa-code-shell'
const CACHE_NAME = `${CACHE_PREFIX}-${SERVICE_WORKER_VERSION}`
const APP_SHELL = __HAFA_CODE_APP_SHELL__

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    ))
  )
  self.clients.claim()
})

function shouldHandleRequest(request, url) {
  if (request.method !== 'GET') return false
  if (url.origin !== self.location.origin) return false
  if (url.pathname.startsWith('/api/')) return false
  if (url.pathname.startsWith('/@')) return false
  if (url.pathname.startsWith('/src/')) return false
  if (url.pathname.startsWith('/node_modules/')) return false
  return true
}

async function cacheResponse(key, response) {
  if (!response.ok) return

  const cache = await caches.open(CACHE_NAME)
  await cache.put(key, response.clone())
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  const url = new URL(request.url)
  if (!shouldHandleRequest(request, url)) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          await cacheResponse('/', response)
          return response
        })
        .catch(() => caches.match('/'))
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached

      return fetch(request).then((response) => {
        event.waitUntil(cacheResponse(request, response))
        return response
      })
    })
  )
})
