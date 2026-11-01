export const SOURCE_PATH = '/main.rs'
export const OUTPUT_DIRECTORY = '/out'
export const OUTPUT_FILE = 'main.wasm'
export const RUST_EDITION = '2021'

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
  ]
}
