import { useState } from 'react'
import { ArrowLeft, Check, ChevronDown, Dumbbell, Lightbulb, Sparkles } from 'lucide-react'
import type { RustChallenge } from './challenges'

type LabChallengePanelProps = {
  challenge: RustChallenge
  completed: boolean
  /** The last run's check, or null before the first run. */
  result: { passed: boolean; compiled: boolean } | null
  onOpenPractice: () => void
}

/** The workspace's practice-session panel, for a Rust challenge: the task, hints, and the last check. */
export function LabChallengePanel({ challenge, completed, result, onOpenPractice }: LabChallengePanelProps) {
  const [expanded, setExpanded] = useState(true)
  const [visibleHints, setVisibleHints] = useState(0)

  return (
    <section className={`practice-session panel surface-grid lab-challenge-strip${result?.passed ? ' passed' : ''}`} aria-labelledby="lab-challenge-title">
      <div className="practice-session-heading">
        <div className="practice-session-title">
          <span className="practice-session-mark" aria-hidden="true"><Dumbbell size={18} /></span>
          <div>
            <p className="eyebrow">Rust challenge · {challenge.level}{completed ? ' · passed' : ''}</p>
            <h2 id="lab-challenge-title">{challenge.title}</h2>
          </div>
        </div>
        <div className="practice-session-actions">
          <button className="ghost compact" type="button" onClick={onOpenPractice}><ArrowLeft size={14} aria-hidden="true" /> All challenges</button>
          <button
            className="ghost icon-button"
            type="button"
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse challenge instructions' : 'Expand challenge instructions'}
            onClick={() => setExpanded((current) => !current)}
          >
            <ChevronDown className={expanded ? 'practice-chevron expanded' : 'practice-chevron'} size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="practice-session-body">
          <p className="lab-challenge-prompt">{challenge.prompt}</p>
          <div className="practice-hints">
            {challenge.hints.slice(0, visibleHints).map((hint, index) => (
              <p key={hint}><Lightbulb size={15} aria-hidden="true" /><span><strong>Hint {index + 1}:</strong> {hint}</span></p>
            ))}
            {visibleHints < challenge.hints.length && (
              <button className="secondary compact" type="button" onClick={() => setVisibleHints((count) => count + 1)}>
                <Lightbulb size={14} aria-hidden="true" /> {visibleHints === 0 ? 'Show a hint' : 'Show another hint'}
              </button>
            )}
          </div>
          {result && (
            <div className={`practice-result lab-challenge-result ${result.passed ? 'success passed' : 'needs-work not-yet'}`} role="status" aria-live="polite">
              <div className="practice-result-heading">
                {result.passed ? <Sparkles size={18} aria-hidden="true" /> : <Dumbbell size={18} aria-hidden="true" />}
                <strong>{result.passed ? `Challenge passed: ${challenge.title}` : 'Not yet.'}</strong>
              </div>
              {!result.passed && <p>{result.compiled ? 'The output does not match the expected output yet.' : 'Fix the compile errors first, then run again.'}</p>}
            </div>
          )}
          <div className="practice-check-row lab-challenge-expected">
            <p>Run your code to check it. It passes when it prints exactly:</p>
            <pre>{challenge.expectedOutput}</pre>
            {completed && !result && <p className="lab-challenge-done"><Check size={14} aria-hidden="true" /> You passed this one before.</p>}
          </div>
        </div>
      )}
    </section>
  )
}
