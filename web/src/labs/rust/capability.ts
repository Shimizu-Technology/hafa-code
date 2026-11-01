export interface LabEnvironment {
  crossOriginIsolated: boolean
  sharedArrayBuffer: boolean
  atomics: boolean
  webAssembly: boolean
  workers: boolean
  /** True when the main pointer is a finger (phones and most tablets). */
  coarsePointer: boolean
  deviceMemoryGb: number | null
}

export type LabReadiness =
  | { status: 'ready'; warnings: string[] }
  | { status: 'small-device'; reasons: string[] }
  | { status: 'unsupported'; reasons: string[] }

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

  // The layout works at any width, so a narrow desktop window can still run; a finger-first
  // device usually lacks the memory the compiler needs.
  if (environment.coarsePointer) return { status: 'small-device', reasons: ['This looks like a phone or tablet.'] }

  const warnings: string[] = []
  if (environment.deviceMemoryGb !== null && environment.deviceMemoryGb < LOW_MEMORY_GB) {
    warnings.push(`This device reports about ${environment.deviceMemoryGb} GB of memory; the compiler needs roughly 1.5 GB while it works.`)
  }
  return { status: 'ready', warnings }
}

/**
 * What the Run control offers. Phones and tablets can read and write Rust but do not run it
 * (or download the compiler) unless the learner chooses to try; an unsupported browser cannot run.
 */
export type RunAvailability = 'available' | 'needs-desktop' | 'unsupported'

export function runAvailability(readiness: LabReadiness, tryOnThisDevice: boolean): RunAvailability {
  if (readiness.status === 'unsupported') return 'unsupported'
  if (readiness.status === 'small-device' && !tryOnThisDevice) return 'needs-desktop'
  return 'available'
}
