/// <reference lib="webworker" />
/**
 * Monaco's editor worker under the Rust Lab's own name, so public/_headers can give it the
 * COEP header that workers of a cross-origin-isolated page need.
 */
import 'monaco-editor/esm/vs/editor/editor.worker.js'
