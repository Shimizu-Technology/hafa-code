/// <reference lib="webworker" />
/**
 * The WASI threads runtime's coordinator. Served from our origin instead of the library's
 * default blob: URL, so the lab's CSP can keep worker-src 'self'.
 */
import { wait_async_polyfill, worker_background_worker } from '@oligami/browser_wasi_shim-threads'

wait_async_polyfill()
worker_background_worker()
