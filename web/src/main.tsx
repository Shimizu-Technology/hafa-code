import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js'
import type * as MonacoApi from 'monaco-editor'
import 'monaco-editor/esm/vs/editor/editor.all.js'
import 'monaco-editor/esm/vs/editor/standalone/browser/iPadShowKeyboard/iPadShowKeyboard.js'
import 'monaco-editor/esm/vs/editor/standalone/browser/inspectTokens/inspectTokens.js'
import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneHelpQuickAccess.js'
import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneGotoLineQuickAccess.js'
import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneGotoSymbolQuickAccess.js'
import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneCommandsQuickAccess.js'
import 'monaco-editor/esm/vs/editor/standalone/browser/referenceSearch/standaloneReferenceSearch.js'
import 'monaco-editor/esm/vs/editor/standalone/browser/toggleHighContrast/toggleHighContrast.js'
import 'monaco-editor/esm/vs/basic-languages/css/css.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/html/html.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/java/java.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/python/python.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/ruby/ruby.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/sql/sql.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution.js'
import 'monaco-editor/esm/vs/language/css/monaco.contribution.js'
import 'monaco-editor/esm/vs/language/html/monaco.contribution.js'
import 'monaco-editor/esm/vs/language/json/monaco.contribution.js'
import * as monacoTypeScriptRuntime from 'monaco-editor/esm/vs/language/typescript/monaco.contribution.js'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker.js?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker.js?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker.js?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker.js?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker.js?worker'
import './index.css'
import App from './App.tsx'
import { AuthProvider, configureE2EAuthToken, E2EAuthProvider } from './contexts/AuthContext.tsx'
import { hasClerkPublishableKey } from './lib/clerk.ts'
import { e2eAuthEnabled } from './lib/e2eAuth.ts'
import { runE2EEditorAction, setE2EEditorValue } from './lib/e2eEditorBridge.ts'
import { HAFA_TYPESCRIPT_DECLARATIONS } from './lib/typescriptEnvironment.ts'
import { registerServiceWorker } from './pwa.ts'

declare global {
  interface Window {
    __HAFA_E2E_EDITOR__?: {
      runAction: (actionId: string) => Promise<boolean>
      setValue: (value: string) => boolean
      getMarkers: () => Array<{ code: string; message: string; path: string; line: number; column: number }>
    }
    MonacoEnvironment?: {
      getWorker: (_workerId: string, label: string) => Worker
    }
  }
}

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const cloudEnabled = hasClerkPublishableKey(clerkPublishableKey)

window.MonacoEnvironment = {
  getWorker(_workerId, label) {
    if (label === 'json') return new jsonWorker()
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker()
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker()
    if (label === 'typescript' || label === 'javascript') return new tsWorker()
    return new editorWorker()
  },
}

loader.config({ monaco })

const monacoTypeScript = monacoTypeScriptRuntime as unknown as typeof MonacoApi.typescript
monacoTypeScript.typescriptDefaults.setCompilerOptions({
  target: monacoTypeScript.ScriptTarget.ES2020,
  module: monacoTypeScript.ModuleKind.CommonJS,
  moduleResolution: monacoTypeScript.ModuleResolutionKind.NodeJs,
  strict: true,
  noEmit: true,
  lib: ['es2020'],
  types: [],
})
monacoTypeScript.typescriptDefaults.setDiagnosticsOptions({
  noSemanticValidation: false,
  noSyntaxValidation: false,
})
monacoTypeScript.typescriptDefaults.setExtraLibs([
  { content: HAFA_TYPESCRIPT_DECLARATIONS, filePath: 'file:///lib/hafa-code.d.ts' },
])
monacoTypeScript.typescriptDefaults.setEagerModelSync(true)

if (e2eAuthEnabled) {
  configureE2EAuthToken()
  window.__HAFA_E2E_EDITOR__ = {
    async runAction(actionId) {
      return runE2EEditorAction(monaco.editor.getEditors(), actionId)
    },
    setValue(value) {
      return setE2EEditorValue(monaco.editor.getEditors(), value)
    },
    getMarkers() {
      return monaco.editor.getModelMarkers({}).map((marker) => ({
        code: String(marker.code ?? ''),
        message: marker.message,
        path: marker.resource.path,
        line: marker.startLineNumber,
        column: marker.startColumn,
      }))
    },
  }
}

const app = e2eAuthEnabled ? (
  <E2EAuthProvider>
    <App />
  </E2EAuthProvider>
) : cloudEnabled ? (
  <ClerkProvider publishableKey={clerkPublishableKey}>
    <AuthProvider>
      <App />
    </AuthProvider>
  </ClerkProvider>
) : (
  <App />
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {app}
  </StrictMode>,
)

registerServiceWorker()
