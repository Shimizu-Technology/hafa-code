import manifest from './toolchainManifest.json'

export interface ToolchainChunk { sha256: string; bytes: number }
export interface ToolchainAsset { name: 'rustc' | 'sysroot'; file: string; sha256: string; bytes: number; unpackedBytes: number; chunks: ToolchainChunk[] }

export const TOOLCHAIN = manifest as { release: string; rustcVersion: string; target: string; chunkBytes: number; assets: ToolchainAsset[] }
export const TOOLCHAIN_CACHE_NAME = 'hafa-rust-lab-toolchain-v1'

/** Matches chunkFileName() in scripts/rustToolchain.mjs: the URL is a prefix of the chunk's SHA-256. */
export function chunkUrl(chunk: ToolchainChunk) {
  return `/assets/rust-toolchain/${chunk.sha256.slice(0, 32)}.bin`
}

export function toolchainAsset(name: ToolchainAsset['name']) {
  const asset = TOOLCHAIN.assets.find((candidate) => candidate.name === name)
  if (!asset) throw new Error(`The Rust Lab toolchain manifest has no ${name} entry.`)
  return asset
}

export const TOOLCHAIN_DOWNLOAD_BYTES = TOOLCHAIN.assets.reduce((total, asset) => total + asset.bytes, 0)
export const TOOLCHAIN_UNPACKED_BYTES = TOOLCHAIN.assets.reduce((total, asset) => total + asset.unpackedBytes, 0)

export function formatMegabytes(bytes: number) {
  return `${(bytes / 1_000_000).toFixed(1)} MB`
}

export type ToolchainCacheState = 'none' | 'partial' | 'complete' | 'unavailable'

/** Whether this browser already holds the verified chunks (checked properly again when they load). */
export async function toolchainCacheState(): Promise<ToolchainCacheState> {
  if (typeof caches === 'undefined') return 'unavailable'
  try {
    const cache = await caches.open(TOOLCHAIN_CACHE_NAME)
    const chunks = TOOLCHAIN.assets.flatMap((asset) => asset.chunks)
    const present = await Promise.all(chunks.map(async (chunk) => Boolean(await cache.match(chunkUrl(chunk)))))
    const count = present.filter(Boolean).length
    return count === 0 ? 'none' : count === chunks.length ? 'complete' : 'partial'
  } catch {
    return 'unavailable'
  }
}

export async function removeToolchainDownload() {
  if (typeof caches === 'undefined') return false
  return caches.delete(TOOLCHAIN_CACHE_NAME)
}
