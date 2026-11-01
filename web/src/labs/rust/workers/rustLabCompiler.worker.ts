/// <reference lib="webworker" />
/**
 * Runs rustc.wasm against the toolchain worker's filesystem. block_start_on_thread() blocks
 * this worker until rustc exits, so every compile gets a fresh WASI instance and threads.
 */
import { WASIFarmAnimal } from '@oligami/browser_wasi_shim-threads'
import type { CompilerRequest, CompilerResponse } from '../protocol'

declare const self: DedicatedWorkerGlobalScope

const post = (message: CompilerResponse) => self.postMessage(message)
/** Wasm pages (64 KiB): 25 MiB initial and the 1 GiB maximum rustc.wasm declares. */
const INITIAL_PAGES = 399
const MAXIMUM_PAGES = 16384
let setup: Extract<CompilerRequest, { type: 'init' }> | null = null

self.onmessage = async (event: MessageEvent<CompilerRequest>) => {
  const request = event.data
  if (request.type === 'init') {
    setup = request
    post({ type: 'ready' })
    return
  }
  if (!setup) {
    post({ type: 'done', exitCode: null, error: 'The compiler worker was not initialized.' })
    return
  }
  let wasi: WASIFarmAnimal | null = null
  try {
    wasi = new WASIFarmAnimal([setup.farm as never], ['rustc', ...request.args], ['RUST_MIN_STACK=16777216'], {
      can_thread_spawn: true,
      thread_spawn_worker_url: setup.threadUrl,
      thread_spawn_wasm: setup.module,
      share_memory: { memory: new WebAssembly.Memory({ initial: INITIAL_PAGES, maximum: MAXIMUM_PAGES, shared: true }) },
      worker_background_worker_url: setup.backgroundUrl,
    })
    await wasi.wait_worker_background_worker()
    const exitCode = wasi.block_start_on_thread()
    post({ type: 'done', exitCode })
  } catch (error) {
    // rustc aborts (a wasm trap) after printing compile errors, so a throw is expected there.
    post({ type: 'done', exitCode: null, error: error instanceof Error ? error.message : String(error) })
  } finally {
    try {
      wasi?.destroy()
    } catch {
      // Already torn down.
    }
  }
}
