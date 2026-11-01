export interface LabEnvironment {
  crossOriginIsolated: boolean
  sharedArrayBuffer: boolean
  atomics: boolean
  webAssembly: boolean
  workers: boolean
  /** True when the main pointer is a finger (phones and most tablets). */
  coarsePointer: boolean
  viewportWidth: number
  deviceMemoryGb: number | null
}

export type LabReadiness =
  | { status: 'ready'; warnings: string[] }
  | { status: 'small-device'; reasons: string[] }
  | { status: 'unsupported'; reasons: string[] }

/** The editor, output, and guide need about this much room side by side. */
export const MIN_DESKTOP_WIDTH = 900
export const LOW_MEMORY_GB = 4

export function readEnvironment(win: Window & typeof globalThis = window): LabEnvironment {
  const nav = win.navigator as Navigator & { deviceMemory?: number }
  return {
    crossOriginIsolated: win.crossOriginIsolated === true,
    sharedArrayBuffer: typeof win.SharedArrayBuffer === 'function',
    atomics: typeof win.Atomics === 'object' && typeof win.Atomics.wait === 'function',
    webAssembly: typeof win.WebAssembly === 'object' && typeof win.WebAssembly.compileStreaming === 'function',
    // Every browser with SharedArrayBuffer in isolated pages also has module workers.
    workers: typeof win.Worker === 'function',
    coarsePointer: win.matchMedia?.('(pointer: coarse)').matches ?? false,
    viewportWidth: win.innerWidth,
    deviceMemoryGb: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
  }
}

export function assessEnvironment(environment: LabEnvironment): LabReadiness {
  const missing: string[] = []
  if (!environment.webAssembly) missing.push('WebAssembly streaming compilation')
  if (!environment.workers) missing.push('Web Workers')
  if (!environment.sharedArrayBuffer || !environment.atomics) missing.push('SharedArrayBuffer and Atomics')
  if (!environment.crossOriginIsolated) missing.push('cross-origin isolation for this page')
  if (missing.length) return { status: 'unsupported', reasons: missing }

  const small: string[] = []
  if (environment.coarsePointer) small.push('This looks like a phone or tablet.')
  if (environment.viewportWidth < MIN_DESKTOP_WIDTH) small.push(`The window is narrower than ${MIN_DESKTOP_WIDTH}px.`)
  if (small.length) return { status: 'small-device', reasons: small }

  const warnings: string[] = []
  if (environment.deviceMemoryGb !== null && environment.deviceMemoryGb < LOW_MEMORY_GB) {
    warnings.push(`This device reports about ${environment.deviceMemoryGb} GB of memory; the compiler needs roughly 1.5 GB while it works.`)
  }
  return { status: 'ready', warnings }
}
