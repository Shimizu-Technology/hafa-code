export const SOURCE_PATH = '/main.rs'
export const OUTPUT_DIRECTORY = '/out'
export const OUTPUT_FILE = 'main.wasm'
export const RUST_EDITION = '2021'
/**
 * The most memory a learner's program may grow to. Without a cap a runaway allocation grows the
 * program's memory to WebAssembly's 4 GiB limit in about a second, on top of the compiler's
 * memory, which can crash the tab on a school laptop. A multiple of the 64 KiB wasm page.
 */
export const PROGRAM_MEMORY_LIMIT_BYTES = 512 * 1024 * 1024

/** rustc flags for one single-file binary. JSON diagnostics keep error codes and spans structured. */
export function rustcArguments() {
  return [
    SOURCE_PATH,
    '--sysroot', '/sysroot',
    '--target', 'wasm32-wasip1',
    '--edition', RUST_EDITION,
    '--crate-name', 'main',
    '--crate-type', 'bin',
    '-o', `${OUTPUT_DIRECTORY}/${OUTPUT_FILE}`,
    '--error-format', 'json',
    '-Ccodegen-units=1',
    '-Cdebuginfo=0',
    '-Clinker-flavor=wasm-ld',
    '-Clinker=wasm-ld',
    `-Clink-arg=--max-memory=${PROGRAM_MEMORY_LIMIT_BYTES}`,
  ]
}
