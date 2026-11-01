import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import './rustLab.css'
import { RustLab } from './RustLab'

// No service worker here: the main app's worker skips /labs/ so this page always loads fresh.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RustLab />
  </StrictMode>,
)
