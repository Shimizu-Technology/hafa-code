export interface TarEntry { name: string; type: string; data: Uint8Array }

const decoder = new TextDecoder()
const field = (bytes: Uint8Array) => decoder.decode(bytes).replace(/\0.*$/s, '')

/**
 * A small reader for the ustar/GNU archives the toolchain ships in: regular files,
 * directories, and GNU long names. Anything else is skipped.
 */
export async function readTar(stream: ReadableStream<Uint8Array>, onEntry: (entry: TarEntry) => void) {
  const reader = stream.getReader()
  const pending: Uint8Array[] = []
  let pendingBytes = 0

  const fill = async (count: number) => {
    while (pendingBytes < count) {
      const { value, done } = await reader.read()
      if (done) return false
      pending.push(value)
      pendingBytes += value.length
    }
    return true
  }
  const take = (count: number) => {
    const out = new Uint8Array(count)
    let offset = 0
    while (offset < count) {
      const head = pending[0]
      const used = Math.min(head.length, count - offset)
      out.set(head.subarray(0, used), offset)
      offset += used
      if (used === head.length) pending.shift()
      else pending[0] = head.subarray(used)
    }
    pendingBytes -= count
    return out
  }

  let longName: string | null = null
  while (await fill(512)) {
    const header = take(512)
    if (header.every((byte) => byte === 0)) break
    let name = field(header.subarray(0, 100))
    const prefix = field(header.subarray(345, 500))
    if (prefix) name = `${prefix}/${name}`
    const size = parseInt(field(header.subarray(124, 136)).trim() || '0', 8)
    if (!Number.isFinite(size) || size < 0) throw new Error('The toolchain archive has an invalid entry size.')
    const type = header[156] ? String.fromCharCode(header[156]) : '0'
    const padded = Math.ceil(size / 512) * 512
    if (!(await fill(padded))) throw new Error('The toolchain archive ended early.')
    const data = take(padded).subarray(0, size)
    if (type === 'L') {
      longName = field(data)
      continue
    }
    if (longName) {
      name = longName
      longName = null
    }
    if (type === '0' || type === '5') onEntry({ name, type, data })
  }
  reader.releaseLock()
}
