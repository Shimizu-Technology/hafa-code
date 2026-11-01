import init, { BrotliDecStream, BrotliStreamResultCode } from 'brotli-dec-wasm/web'
import brotliWasmUrl from 'brotli-dec-wasm/web/bg.wasm?url'

let ready: Promise<unknown> | null = null
const OUTPUT_CHUNK = 1 << 20

/** Decompresses a brotli stream; the toolchain is published brotli-compressed but not Content-Encoded. */
export async function brotliDecompressStream(): Promise<TransformStream<Uint8Array, Uint8Array>> {
  ready ??= init({ module_or_path: brotliWasmUrl })
  await ready
  const decoder = new BrotliDecStream()
  return new TransformStream({
    transform(chunk, controller) {
      let offset = 0
      let code: BrotliStreamResultCode
      do {
        const result = decoder.decompress(chunk.subarray(offset), OUTPUT_CHUNK)
        if (result.buf.length) controller.enqueue(result.buf)
        code = result.code
        offset += result.input_offset
      } while (code === BrotliStreamResultCode.NeedsMoreOutput)
      if (code !== BrotliStreamResultCode.NeedsMoreInput && code !== BrotliStreamResultCode.ResultSuccess) {
        controller.error(new Error(`The toolchain could not be unpacked (brotli code ${code}).`))
      }
    },
  })
}
