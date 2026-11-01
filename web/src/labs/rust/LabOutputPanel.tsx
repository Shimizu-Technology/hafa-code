import { useState } from 'react'
import { Check, ChevronDown, CircleAlert, CircleCheck, Copy, Download, Laptop, Loader2, Play, Square, Terminal, TriangleAlert } from 'lucide-react'
import type { RunAvailability } from './capability'
import { primarySpan } from './diagnostics'
import { TOOLCHAIN, TOOLCHAIN_DOWNLOAD_BYTES, formatMegabytes, type ToolchainCacheState } from './toolchain'
import type { OutputLine, RunPhase, RunReport, ToolchainStatus } from './runTypes'
import { runHeadline, runStatus, runSummary, type RunTone } from './runStatus'

const PHASE_LABEL = {
  downloading: 'Downloading the compiler',
  unpacking: 'Unpacking rustc and the standard library',
  starting: 'Starting rustc',
} as const

type LabOutputPanelProps = {
  availability: RunAvailability
  unsupportedReasons: string[]
  warnings: string[]
  phase: RunPhase
  report: RunReport | null
  output: OutputLine[]
  toolchain: ToolchainStatus
  cacheState: ToolchainCacheState
  stdin: string
  onStdinChange: (value: string) => boolean
  onRun: () => void
  onStop: () => void
  onDownload: () => void
  onFocusLine: (line: number, column: number) => void
  onExport: () => void
  onTryHere: () => void
}

/** The workspace runner's look for the lab: status, Run or Stop, the terminal, and its footer. */
export function LabOutputPanel({
  availability,
  unsupportedReasons,
  warnings,
  phase,
  report,
  output,
  toolchain,
  cacheState,
  stdin,
  onStdinChange,
  onRun,
  onStop,
  onDownload,
  onFocusLine,
  onExport,
  onTryHere,
}: LabOutputPanelProps) {
  const busy = phase === 'loading' || phase === 'compiling' || phase === 'running'
  const status = availability === 'available'
    ? runStatus(phase, report, toolchain)
    : { label: availability === 'unsupported' ? 'Browser not supported' : 'Desktop only', tone: 'neutral' as RunTone }
  const errors = report?.diagnostics?.diagnostics.filter((diagnostic) => diagnostic.level === 'error') ?? []
  const title = runHeadline(report, errors)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const transcript = [report?.diagnostics?.rendered ?? '', ...output.map((line) => line.text)].join('')

  const copyOutput = async () => {
    try {
      await navigator.clipboard.writeText(transcript)
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 2000)
    } catch {
      setCopyState('failed')
    }
  }

  return (
    <section className="panel output-panel lab-output-panel" aria-labelledby="lab-output-heading" data-run-status={busy ? 'running' : status.tone}>
      <div className="panel-header runner-header">
        <div className="runner-title">
          <h2 id="lab-output-heading"><Terminal size={18} aria-hidden="true" /> Output</h2>
          <p className="run-status lab-status" data-tone={status.tone}>
            {status.tone === 'running'
              ? <Loader2 className="spin" size={14} aria-hidden="true" />
              : status.tone === 'success'
                ? <CircleCheck size={14} aria-hidden="true" />
                : status.tone === 'danger'
                  ? <CircleAlert size={14} aria-hidden="true" />
                  : availability !== 'available' ? <Laptop size={14} aria-hidden="true" /> : null}
            <span className="run-status-label">{status.label}</span>
          </p>
        </div>
        {availability === 'available' && (busy ? (
          <button className="secondary" type="button" onClick={onStop} data-lab-run-button>
            <Square size={16} aria-hidden="true" /> Stop
          </button>
        ) : (
          <button className="primary" type="button" onClick={onRun} aria-keyshortcuts="Control+Enter Meta+Enter" data-lab-run-button>
            <Play size={16} aria-hidden="true" /> Run
          </button>
        ))}
      </div>

      {availability !== 'available' ? (
        <DeviceNotice availability={availability} reasons={unsupportedReasons} onExport={onExport} onTryHere={onTryHere} />
      ) : (
        <>
          {warnings.map((warning) => <p key={warning} className="run-empty-hint lab-warning">{warning}</p>)}
          <details className="lab-stdin">
            <summary><ChevronDown size={16} aria-hidden="true" />Program input (stdin){stdin ? ' · has input' : ''}</summary>
            <label htmlFor="lab-stdin-text" className="helper-text">
              Text your program reads with std::io::stdin(), one line per read_line. Type it before you run; the program cannot ask while it runs.
            </label>
            <textarea
              id="lab-stdin-text"
              rows={3}
              value={stdin}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              onChange={(event) => { onStdinChange(event.target.value) }}
            />
          </details>
          {copyState === 'failed' && <p className="runner-copy-error" role="alert">Copy was blocked by this browser. Select the output below and copy it manually.</p>}
          <div className="terminal lab-terminal" tabIndex={0} role="region" aria-label="Program output and rustc messages">
            {title && (
              <div className="run-error-headline">
                <TriangleAlert size={17} aria-hidden="true" />
                <div>
                  <strong>{title}</strong>
                  {report?.kind === 'compile-error' && <span>Fix this error, then run again. The Coach explains it.</span>}
                </div>
              </div>
            )}
            {errors.length > 0 && (
              <ul className="lab-error-list" aria-label="Compile errors">
                {errors.map((diagnostic, index) => {
                  const span = primarySpan(diagnostic)
                  return (
                    <li key={`${diagnostic.code}-${index}`}>
                      <button type="button" disabled={!span} onClick={() => span && onFocusLine(span.line, span.column)}>
                        {span ? `Line ${span.line}` : 'main.rs'}
                        <span>error{diagnostic.code ? `[${diagnostic.code}]` : ''}: {diagnostic.message}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            <CompilerState toolchain={toolchain} cacheState={cacheState} phase={phase} onDownload={onDownload} onCancel={onStop} />
            {phase === 'compiling' && (
              <div className="runner-progress">
                <Loader2 className="spin" size={16} aria-hidden="true" />
                <div><strong>Compiling main.rs with rustc…</strong><span>Usually a few seconds; the first compile takes longer.</span></div>
              </div>
            )}
            {phase === 'running' && output.length === 0 && (
              <div className="runner-progress">
                <Loader2 className="spin" size={16} aria-hidden="true" />
                <div><strong>Running main.rs…</strong><span>Stops after 10 seconds.</span></div>
              </div>
            )}
            {report?.diagnostics?.rendered && (
              <pre className="lab-rustc-output" aria-label="rustc output">{report.diagnostics.rendered}</pre>
            )}
            {output.length > 0 && (
              <pre className="lab-program-output">
                {output.map((line, index) => <span key={index} className={`stream-${line.stream}`}>{line.text}</span>)}
              </pre>
            )}
            {!report && output.length === 0 && phase === 'idle' && toolchain.kind !== 'failed' && (cacheState === 'complete' || toolchain.kind === 'ready') && (
              <div className="empty-output">
                <p><strong>Press Run</strong> to compile and run main.rs.</p>
                <p>{toolchain.kind === 'ready' ? `rustc ${TOOLCHAIN.rustcVersion} is ready.` : 'The compiler is saved in this browser and starts when you run.'} Your code never leaves this computer.</p>
              </div>
            )}
          </div>
          <div className="terminal-footer" data-dock-avoid>
            <span className="terminal-footer-detail lab-run-summary">
              {toolchain.kind === 'ready' && !report && phase === 'idle'
                ? `rustc ${TOOLCHAIN.rustcVersion} ready (${toolchain.fromCache ? 'from this browser' : 'downloaded'}, ${(toolchain.durationMs / 1000).toFixed(1)} s)`
                : runSummary(report)}
            </span>
            <button className="ghost runner-copy-button" type="button" onClick={() => void copyOutput()} disabled={!transcript} aria-label={copyState === 'copied' ? 'Output copied' : 'Copy output'}>
              {copyState === 'copied' ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              <span>{copyState === 'copied' ? 'Copied' : 'Copy output'}</span>
            </button>
          </div>
        </>
      )}
    </section>
  )
}

function CompilerState({ toolchain, cacheState, phase, onDownload, onCancel }: {
  toolchain: ToolchainStatus
  cacheState: ToolchainCacheState
  phase: RunPhase
  onDownload: () => void
  onCancel: () => void
}) {
  if (toolchain.kind === 'loading') {
    const progress = toolchain.progress
    const percent = progress && progress.totalBytes ? Math.min(100, Math.round((progress.loadedBytes / progress.totalBytes) * 100)) : 0
    const step = progress?.phase ?? 'downloading'
    return (
      <div className="runner-progress lab-compiler-progress" role="status" aria-live="polite">
        <Loader2 className="spin" size={16} aria-hidden="true" />
        <div>
          <strong>{progress ? PHASE_LABEL[progress.phase] : 'Preparing the compiler'}…</strong>
          {progress?.phase === 'downloading' && (
            <>
              <progress max={100} value={percent} aria-label="Compiler download progress">{percent}%</progress>
              <span className="runner-progress-elapsed">{formatMegabytes(progress.loadedBytes)} of {formatMegabytes(progress.totalBytes)}</span>
            </>
          )}
          {progress && progress.phase !== 'downloading' && <span>This takes a few seconds and uses a lot of memory.</span>}
          <ol className="runner-steps" aria-label="Compiler steps">
            <li data-state={step === 'downloading' ? 'current' : 'done'}>Download {formatMegabytes(TOOLCHAIN_DOWNLOAD_BYTES)} · first time only</li>
            <li data-state={step === 'unpacking' ? 'current' : step === 'starting' ? 'done' : 'todo'}>Unpack rustc and the standard library</li>
            <li data-state={step === 'starting' ? 'current' : 'todo'}>Start rustc, then run main.rs</li>
          </ol>
          <button className="secondary compact lab-on-code" type="button" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    )
  }
  if (toolchain.kind === 'failed') {
    return (
      <div className="lab-compiler-card error" role="alert">
        <strong>The compiler could not start</strong>
        <p>{toolchain.message}</p>
        <button className="primary" type="button" onClick={onDownload}>Try again</button>
      </div>
    )
  }
  if (toolchain.kind === 'ready' || cacheState === 'complete') return null
  return (
    <div className={`lab-compiler-card${phase === 'needs-consent' ? ' highlighted' : ''}`}>
      <strong>Download the Rust compiler to run code</strong>
      <p>
        One-time download of {formatMegabytes(TOOLCHAIN_DOWNLOAD_BYTES)} (rustc {TOOLCHAIN.rustcVersion} and the standard library).
        It is checked against pinned checksums and saved in this browser. Your code never leaves this computer.
      </p>
      <button className="primary" type="button" onClick={onDownload}>
        <Download size={16} aria-hidden="true" /> {phase === 'needs-consent' ? 'Download and run' : 'Download compiler'}
      </button>
      {cacheState === 'partial' && <p className="lab-compiler-note">Part of it is already saved; only the rest downloads.</p>}
    </div>
  )
}

/** Phones, tablets, and unsupported browsers: what to do instead of a Run button. */
function DeviceNotice({ availability, reasons, onExport, onTryHere }: {
  availability: Exclude<RunAvailability, 'available'>
  reasons: string[]
  onExport: () => void
  onTryHere: () => void
}) {
  const unsupported = availability === 'unsupported'
  return (
    <div className="lab-device-notice" role="region" aria-labelledby="lab-device-title">
      <span className="lab-device-mark" aria-hidden="true"><Laptop size={22} /></span>
      <h3 id="lab-device-title">{unsupported ? 'This browser cannot run Rust yet' : 'Running Rust needs a desktop browser'}</h3>
      {unsupported ? (
        <>
          <p>The in-browser compiler needs features this browser or page is missing:</p>
          <ul className="lab-device-reasons">{reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          <p>Open this page in a current version of Chrome or Edge on a computer. Nothing was downloaded.</p>
        </>
      ) : (
        <p>
          The compiler is a {formatMegabytes(TOOLCHAIN_DOWNLOAD_BYTES)} download and needs about 1.5 GB of memory while it works,
          more than phones and tablets can usually spare. Nothing was downloaded.
        </p>
      )}
      <ul className="lab-device-can" aria-label="What works here">
        <li><Check size={15} aria-hidden="true" /> Write and save main.rs in this browser</li>
        <li><Check size={15} aria-hidden="true" /> Read the Rust guide and try the practice challenges</li>
        <li><Check size={15} aria-hidden="true" /> Export a project, then import it in Chrome or Edge on a computer</li>
      </ul>
      <div className="lab-device-actions">
        <button className="primary" type="button" onClick={onExport}>
          <Download size={16} aria-hidden="true" /> Export this project
        </button>
        {!unsupported && (
          <button className="ghost" type="button" onClick={onTryHere}>Try running on this device</button>
        )}
      </div>
    </div>
  )
}
