import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Globe, RefreshCw } from 'lucide-react'
import { buildHtmlPreview, type ProjectFile } from '../lib/codeRunner'

interface PreviewConsoleMessage {
  source: 'hafa-code-preview-console'
  level: 'log' | 'warn' | 'error'
  message: string
}

function isPreviewConsoleLevel(level: unknown): level is PreviewConsoleMessage['level'] {
  return level === 'log' || level === 'warn' || level === 'error'
}

export function WebPreview({ files, entryPath }: { files: ProjectFile[]; entryPath: string }) {
  const draftPreview = useMemo(() => buildHtmlPreview(files, entryPath), [entryPath, files])
  const [renderedPreview, setRenderedPreview] = useState(() => draftPreview)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const previewPortRef = useRef<MessagePort | null>(null)
  const [consoleMessages, setConsoleMessages] = useState<PreviewConsoleMessage[]>([])
  const previewFrameUrl = useMemo(() => `/preview-frame.html?parent=${encodeURIComponent(window.location.origin)}`, [])
  const previewIsStale = draftPreview !== renderedPreview

  const sendPreviewToFrame = useCallback((html: string) => {
    previewPortRef.current?.postMessage({
      source: 'hafa-code-preview-update',
      html,
    })
  }, [])

  const refreshPreview = useCallback(() => {
    setRenderedPreview(draftPreview)
    setConsoleMessages([])
    sendPreviewToFrame(draftPreview)
  }, [draftPreview, sendPreviewToFrame])

  const connectPreviewPort = useCallback((port: MessagePort) => {
    previewPortRef.current?.close()
    previewPortRef.current = port

    port.onmessage = (event) => {
      const message = event.data as Partial<PreviewConsoleMessage>
      if (message.source !== 'hafa-code-preview-console' || !message.level || !message.message) return
      const level = message.level
      if (!isPreviewConsoleLevel(level)) return

      const nextMessage: PreviewConsoleMessage = {
        source: 'hafa-code-preview-console',
        level,
        message: String(message.message),
      }
      setConsoleMessages((current) => [
        ...current,
        nextMessage,
      ].slice(-20))
    }
    port.start()

    port.postMessage({
      source: 'hafa-code-preview-update',
      html: renderedPreview,
    })
  }, [renderedPreview])

  useEffect(() => {
    const handlePreviewConnect = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return

      const message = event.data as { source?: string }
      const port = event.ports[0]
      if (message.source !== 'hafa-code-preview-connect' || !port) return

      connectPreviewPort(port)
    }

    window.addEventListener('message', handlePreviewConnect)
    return () => window.removeEventListener('message', handlePreviewConnect)
  }, [connectPreviewPort])

  useEffect(() => () => {
    previewPortRef.current?.close()
    previewPortRef.current = null
  }, [])

  return (
    <section className="panel preview-panel surface-grid">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Preview</p>
          <h2><Globe size={18} /> Web page</h2>
          <p className="helper-text">{previewIsStale ? 'Preview has unsaved changes.' : 'Sandboxed iframe, no same-origin access.'}</p>
        </div>
        <button className={previewIsStale ? '' : 'secondary'} type="button" onClick={refreshPreview}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>
      <iframe
        ref={iframeRef}
        title="Web preview"
        sandbox="allow-scripts allow-modals"
        referrerPolicy="no-referrer"
        src={previewFrameUrl}
      />
      <div className="preview-console" aria-live="polite">
        <div className="preview-console-header">
          <span>Browser console</span>
          {consoleMessages.length > 0 && (
            <button className="ghost compact" type="button" onClick={() => setConsoleMessages([])}>Clear</button>
          )}
        </div>
        {consoleMessages.length === 0 ? (
          <p>No console messages yet.</p>
        ) : (
          consoleMessages.map((message, index) => (
            <pre key={`${message.level}-${index}`} className={`preview-console-line ${message.level}`}>{message.message}</pre>
          ))
        )}
      </div>
    </section>
  )
}
