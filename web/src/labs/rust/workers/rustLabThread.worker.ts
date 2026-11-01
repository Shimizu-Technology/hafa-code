/// <reference lib="webworker" />
/** One rustc thread (wasi-threads); started by the WASI threads runtime. */
import { thread_spawn_on_worker } from '@oligami/browser_wasi_shim-threads'

self.onmessage = async (event: MessageEvent) => {
  await thread_spawn_on_worker(event.data)
}
