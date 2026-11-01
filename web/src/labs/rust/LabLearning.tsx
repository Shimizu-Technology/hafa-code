import { useEffect, useState } from 'react'
import { ArrowRight, BookOpen, Bug, Check, Copy, Dumbbell, ExternalLink, GraduationCap, Lightbulb, MapPin, Play, TriangleAlert, X } from 'lucide-react'
import { useModalFocus } from '../../hooks/useModalFocus'
import { useOverlaySidecar } from '../../hooks/useOverlaySidecar'
import { RUST_CHALLENGES, type RustChallenge } from './challenges'
import type { RustCoaching } from './errorCoach'
import { RUST_GUIDE, guideTopic, type RustGuideTopic, type RustGuideTopicId } from './guide'

export type LabLearningTab = 'guide' | 'practice' | 'coach'

const TABS: { id: LabLearningTab; label: string; icon: typeof BookOpen }[] = [
  { id: 'guide', label: 'Guide', icon: BookOpen },
  { id: 'practice', label: 'Practice', icon: Dumbbell },
  { id: 'coach', label: 'Coach', icon: Bug },
]

type LabLearningProps = {
  open: boolean
  tab: LabLearningTab
  topicId: RustGuideTopicId
  coaching: RustCoaching | null
  completedChallenges: string[]
  startedChallenges: string[]
  activeChallengeId: string | null
  busy: boolean
  onTabChange: (tab: LabLearningTab) => void
  onTopicChange: (topic: RustGuideTopicId) => void
  onClose: () => void
  onTryExample: (topic: RustGuideTopic) => void
  onStartChallenge: (challenge: RustChallenge) => void
}

/**
 * The workspace's learning sidecar, for Rust: a column beside the code on wide screens and a
 * drawer (a full-screen sheet on phones) below 1600px.
 */
export function LabLearning({
  open,
  tab,
  topicId,
  coaching,
  completedChallenges,
  startedChallenges,
  activeChallengeId,
  busy,
  onTabChange,
  onTopicChange,
  onClose,
  onTryExample,
  onStartChallenge,
}: LabLearningProps) {
  const overlay = useOverlaySidecar()
  const dialogRef = useModalFocus<HTMLElement>(open && overlay, onClose)

  useEffect(() => {
    if (!open || !overlay) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [open, overlay])

  if (!open) return null

  const sidecar = (
    <aside
      ref={dialogRef}
      className="learning-sidecar panel lab-learning"
      role={overlay ? 'dialog' : 'complementary'}
      aria-modal={overlay || undefined}
      aria-labelledby="lab-learning-title"
      tabIndex={overlay ? -1 : undefined}
      onClick={(event) => event.stopPropagation()}
    >
      <header className="learning-sidecar-header">
        <div className="learning-sidecar-mark" aria-hidden="true"><GraduationCap size={21} /></div>
        <div>
          <p className="eyebrow">Stays beside your code</p>
          <h2 id="lab-learning-title">Rust learning</h2>
          <p>Five short topics, five challenges, and coaching for rustc's error codes.</p>
        </div>
        <button className="ghost icon-button" type="button" onClick={onClose} aria-label="Close Rust learning" data-modal-initial-focus>
          <X size={19} aria-hidden="true" />
        </button>
      </header>

      <nav
        className="learning-sidecar-tabs"
        role="tablist"
        aria-label="Learning tools"
        onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
          event.preventDefault()
          const index = TABS.findIndex((candidate) => candidate.id === tab)
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length
          onTabChange(TABS[next].id)
          event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus()
        }}
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            id={`lab-learning-tab-${id}`}
            className={tab === id ? 'active' : 'secondary'}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls={`lab-learning-panel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => onTabChange(id)}
          >
            <Icon size={16} aria-hidden="true" /> {label}
            {id === 'coach' && coaching && <span className="learning-error-badge" aria-label="New error advice">1</span>}
          </button>
        ))}
      </nav>

      <div className="learning-sidecar-body">
        <section id="lab-learning-panel-guide" role="tabpanel" aria-labelledby="lab-learning-tab-guide" hidden={tab !== 'guide'}>
          <GuideContent topicId={topicId} busy={busy} onTopicChange={onTopicChange} onTryExample={onTryExample} onOpenPractice={() => onTabChange('practice')} />
        </section>
        <section id="lab-learning-panel-practice" role="tabpanel" aria-labelledby="lab-learning-tab-practice" hidden={tab !== 'practice'}>
          <PracticeContent
            completed={completedChallenges}
            started={startedChallenges}
            activeChallengeId={activeChallengeId}
            busy={busy}
            onStart={onStartChallenge}
          />
        </section>
        <section id="lab-learning-panel-coach" className="learning-coach-panel" role="tabpanel" aria-labelledby="lab-learning-tab-coach" hidden={tab !== 'coach'}>
          {coaching ? (
            <LabCoach coaching={coaching} onOpenTopic={(topic) => { onTopicChange(topic); onTabChange('guide') }} />
          ) : (
            <div className="learning-coach-empty">
              <Bug size={30} aria-hidden="true" />
              <h3>No error to untangle</h3>
              <p>Run your code. If rustc stops it or it panics, the Coach explains the message and what to try next.</p>
            </div>
          )}
        </section>
      </div>
    </aside>
  )

  return overlay
    ? <div className="learning-sidecar-backdrop" role="presentation" onClick={onClose}>{sidecar}</div>
    : sidecar
}

function GuideContent({ topicId, busy, onTopicChange, onTryExample, onOpenPractice }: {
  topicId: RustGuideTopicId
  busy: boolean
  onTopicChange: (topic: RustGuideTopicId) => void
  onTryExample: (topic: RustGuideTopic) => void
  onOpenPractice: () => void
}) {
  const topic = guideTopic(topicId)
  const [copied, setCopied] = useState<{ topic: RustGuideTopicId; ok: boolean } | null>(null)
  const copy = async () => {
    let ok = false
    try {
      await navigator.clipboard.writeText(topic.example)
      ok = true
    } catch {
      // Clipboard access can be blocked; the learner can still select the code.
    }
    setCopied({ topic: topic.id, ok })
  }
  const copyState = copied?.topic === topic.id ? copied : null

  return (
    <div className="guide-layout guide-content">
      <div className="guide-index">
        <p className="guide-result-count">{RUST_GUIDE.length} topics</p>
        <nav className="guide-topic-list" aria-label="Rust guide topics">
          {RUST_GUIDE.map((candidate, index) => (
            <button
              key={candidate.id}
              className={candidate.id === topic.id ? 'active' : ''}
              type="button"
              aria-current={candidate.id === topic.id ? 'page' : undefined}
              onClick={() => onTopicChange(candidate.id)}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{candidate.title}</strong>
            </button>
          ))}
        </nav>
      </div>
      <article className="guide-page" aria-labelledby="lab-guide-topic-title">
        <div className="guide-page-heading">
          <div>
            <p className="eyebrow">Rust field note</p>
            <h3 id="lab-guide-topic-title">{topic.title}</h3>
            <p>{topic.summary}</p>
          </div>
        </div>
        <ul className="lab-guide-points">{topic.points.map((point) => <li key={point}>{point}</li>)}</ul>
        <section className="guide-code-section" aria-label={`${topic.title} example`}>
          <div className="guide-section-heading">
            <span><Play size={15} aria-hidden="true" /> Complete example</span>
            <button className="guide-copy-button" type="button" onClick={() => void copy()}>
              {copyState?.ok ? <Check size={15} aria-hidden="true" /> : copyState ? <TriangleAlert size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
              {copyState?.ok ? 'Copied' : copyState ? 'Copy failed' : 'Copy'}
            </button>
          </div>
          <pre tabIndex={0} aria-label={`${topic.title} example code`}><code>{topic.example}</code></pre>
          {copyState && !copyState.ok && <p className="guide-copy-error" role="status">Copy was blocked. Select the code and copy it manually.</p>}
        </section>
        <footer className="guide-page-footer">
          <p><strong>Your current code stays untouched.</strong> Trying this opens the example as a new project.</p>
          <div className="guide-footer-actions">
            <button className="secondary" type="button" onClick={onOpenPractice}>
              <Dumbbell size={16} aria-hidden="true" /> Practice Rust
            </button>
            <button type="button" disabled={busy} onClick={() => onTryExample(topic)}>
              <Play size={16} aria-hidden="true" /> Try example
            </button>
          </div>
        </footer>
      </article>
    </div>
  )
}

function PracticeContent({ completed, started, activeChallengeId, busy, onStart }: {
  completed: string[]
  started: string[]
  activeChallengeId: string | null
  busy: boolean
  onStart: (challenge: RustChallenge) => void
}) {
  const passed = RUST_CHALLENGES.filter((challenge) => completed.includes(challenge.id)).length
  return (
    <div className="practice-lab-body practice-content">
      <div className="practice-lab-toolbar">
        <div>
          <p className="eyebrow">Rust</p>
          <h3>{passed} of {RUST_CHALLENGES.length} passed in this browser</h3>
        </div>
      </div>
      <div className="practice-challenge-grid">
        {RUST_CHALLENGES.map((challenge, index) => {
          const isComplete = completed.includes(challenge.id)
          const isCurrent = challenge.id === activeChallengeId
          return (
            <article
              key={challenge.id}
              className={`practice-challenge-card lab-challenge-card${isComplete ? ' complete' : ''}${isCurrent ? ' current' : ''}`}
              aria-labelledby={`lab-challenge-${challenge.id}`}
            >
              <div className="practice-card-topline">
                <span className="practice-number">{String(index + 1).padStart(2, '0')}</span>
                <span className="practice-difficulty">{challenge.level}</span>
                {isComplete && <span className="practice-complete"><Check size={14} aria-hidden="true" /> Passed</span>}
                {isCurrent && <span className="practice-current">Open now</span>}
              </div>
              <h3 id={`lab-challenge-${challenge.id}`}>{challenge.title}</h3>
              <p>{challenge.prompt}</p>
              <details className="lab-challenge-details">
                <summary>Expected output and hints</summary>
                <pre>{challenge.expectedOutput}</pre>
                <ul>{challenge.hints.map((hint) => <li key={hint}><Lightbulb size={14} aria-hidden="true" /> {hint}</li>)}</ul>
              </details>
              <button type="button" disabled={busy} onClick={() => onStart(challenge)}>
                {started.includes(challenge.id) ? 'Continue challenge' : 'Start challenge'} <ArrowRight size={16} aria-hidden="true" />
              </button>
            </article>
          )
        })}
      </div>
    </div>
  )
}

/** The workspace's error coach, with rustc's error code and a link to its explanation. */
export function LabCoach({ coaching, onOpenTopic }: { coaching: RustCoaching; onOpenTopic: (topic: RustGuideTopicId) => void }) {
  return (
    <section className="error-coach lab-coach" aria-labelledby="lab-coach-title">
      <div className="error-coach-heading">
        <span><Lightbulb size={16} aria-hidden="true" /> Error coach</span>
        {coaching.location && <small><MapPin size={13} aria-hidden="true" /> {coaching.location}</small>}
      </div>
      <h3 id="lab-coach-title">
        {coaching.code && <span className="lab-code-badge">{coaching.code}</span>} {coaching.title}
      </h3>
      {coaching.detail && <p className="lab-coach-detail">rustc says: <code>{coaching.detail}</code></p>}
      <p>{coaching.explanation}</p>
      <ol>{coaching.steps.map((step) => <li key={step}>{step}</li>)}</ol>
      <div className="lab-coach-links">
        {coaching.topic && (
          <button className="secondary compact" type="button" onClick={() => onOpenTopic(coaching.topic!)}>
            <BookOpen size={15} aria-hidden="true" /> Guide: {guideTopic(coaching.topic).title}
          </button>
        )}
        {coaching.docsUrl && (
          <a href={coaching.docsUrl} target="_blank" rel="noreferrer noopener">
            rustc's explanation of {coaching.code} <ExternalLink size={13} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
      </div>
    </section>
  )
}
