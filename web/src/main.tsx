import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js'
import 'monaco-editor/esm/vs/editor/editor.all.js'
import 'monaco-editor/esm/vs/basic-languages/css/css.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/html/html.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/java/java.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/python/python.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/ruby/ruby.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution.js'
import 'monaco-editor/esm/vs/language/css/monaco.contribution.js'
import 'monaco-editor/esm/vs/language/html/monaco.contribution.js'
import 'monaco-editor/esm/vs/language/json/monaco.contribution.js'
import 'monaco-editor/esm/vs/language/typescript/monaco.contribution.js'
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
import { registerServiceWorker } from './pwa.ts'

declare global {
  interface Window {
    __HAFA_E2E_EDITOR__?: {
      runAction: (actionId: string) => Promise<boolean>
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

if (e2eAuthEnabled) {
  configureE2EAuthToken()
  window.__HAFA_E2E_EDITOR__ = {
    async runAction(actionId) {
      const editors = monaco.editor.getEditors()
      const editor = editors.find((candidate) => candidate.hasTextFocus()) ?? editors.at(-1)
      const action = editor?.getAction(actionId)
      if (!action) return false
      await action.run()
      return true
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
