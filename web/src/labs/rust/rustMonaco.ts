/**
 * Monaco for the Rust Lab: the editor core, Rust highlighting, and the Hafa themes only.
 * Loaded with a dynamic import so the lab's first paint does not wait for it.
 */
import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js'
import 'monaco-editor/esm/vs/editor/editor.all.js'
import 'monaco-editor/esm/vs/basic-languages/rust/rust.contribution.js'
import { defineHafaEditorThemes } from '../../lib/monacoThemes'

window.MonacoEnvironment = {
  getWorker() {
    return new Worker(new URL('./workers/rustLabEditor.worker.ts', import.meta.url), { type: 'module', name: 'Rust Lab editor' })
  },
}

loader.config({ monaco })
defineHafaEditorThemes(monaco)

export { monaco }
