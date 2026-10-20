import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { CloudAuthProvider, configureE2EAuthToken, E2EAuthProvider } from './contexts/AuthContext.tsx'
import { hasClerkPublishableKey } from './lib/clerk.ts'
import { e2eAuthEnabled } from './lib/e2eAuth.ts'
import { loadEditorRuntime } from './lib/editorRuntime.ts'
import { registerServiceWorker } from './pwa.ts'

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const cloudEnabled = hasClerkPublishableKey(clerkPublishableKey)

if (e2eAuthEnabled) configureE2EAuthToken()

const app = e2eAuthEnabled ? (
  <E2EAuthProvider>
    <App />
  </E2EAuthProvider>
) : cloudEnabled ? (
  // Clerk itself loads on demand (see CloudAuthProvider), never in the entry bundle.
  <CloudAuthProvider publishableKey={clerkPublishableKey}>
    <App />
  </CloudAuthProvider>
) : (
  <App />
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {app}
  </StrictMode>,
)

// Fetch the editor chunk alongside the first render instead of inside the main bundle.
void loadEditorRuntime().catch(() => {
  // EditorWorkspace offers a retry when the editor chunk cannot load.
})

registerServiceWorker()
