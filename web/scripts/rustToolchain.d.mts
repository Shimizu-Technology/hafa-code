export const MANIFEST_PATH: string
export const CACHE_DIRECTORY: string
export const TOOLCHAIN_ASSET_DIRECTORY: string
export const CHUNK_BYTES: number
export const PINNED_FILES: Array<{ name: string; file: string; sha256: string }>
export function chunkFileName(chunkSha256: string): string
export function splitIntoChunks(bytes: Uint8Array): Array<{ sha256: string; bytes: number; data: Uint8Array }>
export function readManifest(): unknown
export function toolchainOutputFiles(manifest?: unknown): Promise<Array<{ fileName: string; source: Uint8Array }>>
