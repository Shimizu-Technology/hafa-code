/**
 * Program output shared between the program worker and the page. The worker appends each
 * write to a SharedArrayBuffer; the page reads it on a timer and once more when the run ends,
 * so output printed just before Stop or the time limit (which terminate the worker) is kept,
 * and stdout and stderr stay in the order the program wrote them.
 *
 * Layout: Int32 [0] = bytes committed after the 8-byte header. Each record is
 * [stream: 1 byte][length: uint32 LE][bytes].
 */
export type OutputStream = 'stdout' | 'stderr'

const HEADER_BYTES = 8
const RECORD_HEADER_BYTES = 5
const STREAM_CODES: Record<OutputStream, number> = { stdout: 1, stderr: 2 }

/** Room for the output limit even if a program writes one byte at a time. */
export function createOutputBuffer(outputLimitBytes: number) {
  return new SharedArrayBuffer(HEADER_BYTES + outputLimitBytes * (RECORD_HEADER_BYTES + 1) + 1024)
}

export class OutputWriter {
  private readonly committed: Int32Array
  private readonly bytes: Uint8Array
  private readonly view: DataView

  constructor(buffer: SharedArrayBuffer) {
    this.committed = new Int32Array(buffer, 0, 1)
    this.bytes = new Uint8Array(buffer)
    this.view = new DataView(buffer)
  }

  /** Returns false when the buffer is full. */
  write(stream: OutputStream, data: Uint8Array) {
    if (!data.length) return true
    const offset = HEADER_BYTES + Atomics.load(this.committed, 0)
    const end = offset + RECORD_HEADER_BYTES + data.length
    if (end > this.bytes.length) return false
    this.bytes[offset] = STREAM_CODES[stream]
    this.view.setUint32(offset + 1, data.length, true)
    this.bytes.set(data, offset + RECORD_HEADER_BYTES)
    Atomics.store(this.committed, 0, end - HEADER_BYTES)
    return true
  }
}

export class OutputReader {
  private readonly committed: Int32Array
  private readonly bytes: Uint8Array
  private readonly view: DataView
  private offset = HEADER_BYTES
  private readonly decoders = { stdout: new TextDecoder(), stderr: new TextDecoder() }

  constructor(buffer: SharedArrayBuffer) {
    this.committed = new Int32Array(buffer, 0, 1)
    this.bytes = new Uint8Array(buffer)
    this.view = new DataView(buffer)
  }

  /** Everything written since the last read, with consecutive writes to one stream merged. */
  read(): Array<{ stream: OutputStream; text: string }> {
    const end = HEADER_BYTES + Atomics.load(this.committed, 0)
    const out: Array<{ stream: OutputStream; text: string }> = []
    while (this.offset + RECORD_HEADER_BYTES <= end) {
      const stream: OutputStream = this.bytes[this.offset] === STREAM_CODES.stderr ? 'stderr' : 'stdout'
      const length = this.view.getUint32(this.offset + 1, true)
      const start = this.offset + RECORD_HEADER_BYTES
      // Copy out of shared memory: TextDecoder does not accept shared views.
      const text = this.decoders[stream].decode(this.bytes.slice(start, start + length), { stream: true })
      this.offset = start + length
      const last = out[out.length - 1]
      if (last?.stream === stream) last.text += text
      else if (text) out.push({ stream, text })
    }
    return out
  }
}
