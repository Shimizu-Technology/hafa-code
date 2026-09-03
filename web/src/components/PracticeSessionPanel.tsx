import { useState } from 'react'
import { Check, ChevronDown, Circle, Dumbbell, Lightbulb, Loader2, RotateCcw, Sparkles } from 'lucide-react'
import type { PracticeChallenge, PracticeCheckResult } from '../lib/practiceLab'

interface PracticeSessionPanelProps {
  challenge: PracticeChallenge
  checking: boolean
  completed: boolean
  result: PracticeCheckResult | null
  onCheck: () => void
  onOpenLab: () => void
}

/** Keeps challenge instructions and feedback beside the editable project. */
export function PracticeSessionPanel({ challenge, checking, completed, result, onCheck, onOpenLab }: PracticeSessionPanelProps) {
  const [expanded, setExpanded] = useState(true)
  const [visibleHintCount, setVisibleHintCount] = useState(0)

  return (
    <section className={`practice-session panel surface-grid${result?.passed ? ' passed' : ''}`} aria-labelledby="practice-session-title">
      <div className="practice-session-heading">
        <div className="practice-session-title">
          <span className="practice-session-mark" aria-hidden="true"><Dumbbell size={18} /></span>
          <div>
            <p className="eyebrow">Practice · {challenge.difficulty}{completed ? ' · completed' : ''}</p>
            <h2 id="practice-session-title">{challenge.title}</h2>
          </div>
        </div>
        <div className="practice-session-actions">
          <button className="ghost compact" type="button" onClick={onOpenLab}><RotateCcw size={14} /> Choose another</button>
          <button className="ghost icon-button" type="button" aria-expanded={expanded} aria-label={expanded ? 'Collapse challenge instructions' : 'Expand challenge instructions'} onClick={() => setExpanded((current) => !current)}>
            <ChevronDown className={expanded ? 'practice-chevron expanded' : 'practice-chevron'} size={18} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="practice-session-body">
          <ol className="practice-instructions">
            {challenge.instructions.map((instruction) => <li key={instruction}>{instruction}</li>)}
          </ol>

          <div className="practice-hints">
            {challenge.hints.slice(0, visibleHintCount).map((hint, index) => (
              <p key={hint}><Lightbulb size={15} /><span><strong>Hint {index + 1}:</strong> {hint}</span></p>
            ))}
            {visibleHintCount < challenge.hints.length && (
              <button className="secondary compact" type="button" onClick={() => setVisibleHintCount((count) => count + 1)}>
                <Lightbulb size={14} /> {visibleHintCount === 0 ? 'Show a hint' : 'Show another hint'}
              </button>
            )}
          </div>

          {result && (
            <div className={`practice-result ${result.passed ? 'success' : 'needs-work'}`} role="status" aria-live="polite">
              <div className="practice-result-heading">
                {result.passed ? <Sparkles size={18} /> : <Dumbbell size={18} />}
                <strong>{result.passed ? 'Challenge complete' : 'Almost there — keep going'}</strong>
              </div>
              <ul>
                {result.checks.map((check) => (
                  <li key={check.label} className={check.passed ? 'passed' : ''}>
                    {check.passed ? <Check size={15} /> : <Circle size={14} />} {check.label}
                  </li>
                ))}
              </ul>
              {result.expectedOutput !== undefined && !result.passed && (
                <div className="practice-output-comparison">
                  <span>Expected <code>{result.expectedOutput.replace(/\n/g, ' ↵ ')}</code></span>
                  {result.actualOutput !== undefined && <span>Received <code>{result.actualOutput.trim() || '(no output)'}</code></span>}
                </div>
              )}
            </div>
          )}

          <div className="practice-check-row">
            <p>{challenge.expectedOutput === undefined ? 'Checks the files in your project.' : 'Runs your code, then checks its structure and output.'}</p>
            <button type="button" onClick={onCheck} disabled={checking}>
              {checking ? <Loader2 className="spin" size={16} /> : <Check size={16} />}
              {checking ? 'Checking…' : result?.passed ? 'Check again' : 'Check my work'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
