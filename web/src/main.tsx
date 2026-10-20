import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import './index.css'
import App from './App.tsx'
import { AuthProvider, configureE2EAuthToken, E2EAuthProvider } from './contexts/AuthContext.tsx'
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

// Fetch the editor chunk alongside the first render instead of inside the main bundle.
void loadEditorRuntime().catch(() => {
  // EditorWorkspace offers a retry when the editor chunk cannot load.
})

registerServiceWorker()
