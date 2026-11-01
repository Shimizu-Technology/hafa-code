/** Messages between the Rust Lab page and its workers. Everything stays in this browser tab. */

export type ToolchainPhase = 'downloading' | 'unpacking' | 'starting'

export type ToolchainRequest =
  | { type: 'load' }
  | { type: 'compile'; id: number; source: string }

export type ToolchainResponse =
  | { type: 'progress'; phase: ToolchainPhase; loadedBytes: number; totalBytes: number }
  | { type: 'ready'; fromCache: boolean; durationMs: number }
  | { type: 'compiled'; id: number; wasm: ArrayBuffer | null; diagnostics: string; durationMs: number; crashed: boolean }
  | { type: 'failed'; message: string; integrity?: boolean }

export type CompilerRequest =
  | { type: 'init'; module: WebAssembly.Module; farm: unknown; threadUrl: string; backgroundUrl: string }
  | { type: 'compile'; args: string[] }

export type CompilerResponse =
  | { type: 'ready' }
  | { type: 'done'; exitCode: number | null; error?: string }

export type ProgramRequest = { type: 'run'; wasm: ArrayBuffer; stdin: string; outputLimitBytes: number }

export type ProgramResponse =
  | { type: 'output'; stream: 'stdout' | 'stderr'; text: string }
  | { type: 'exit'; exitCode: number; panicked: boolean; outputLimited: boolean; durationMs: number }
