import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, Dumbbell, Search, X } from 'lucide-react'
import { useModalFocus } from '../hooks/useModalFocus'
import { PROJECT_KINDS, projectKindDefinition, type ProjectKind } from '../lib/codeRunner'
import { PRACTICE_CHALLENGES, type PracticeChallenge } from '../lib/practiceLab'

interface PracticeLabProps {
  completedChallengeIds: string[]
  initialKind: ProjectKind
  open: boolean
  onClose: () => void
  onStartChallenge: (challenge: PracticeChallenge) => void
}

/** Lets learners browse short, language-specific exercises without committing to a curriculum. */
export function PracticeLab({ completedChallengeIds, initialKind, open, onClose, onStartChallenge }: PracticeLabProps) {
  const [filters, setFilters] = useState({ initialKind, selectedKind: initialKind, query: '' })
  if (filters.initialKind !== initialKind) {
    setFilters({ initialKind, selectedKind: initialKind, query: '' })
  }
  const { selectedKind, query } = filters
  const dialogRef = useModalFocus<HTMLElement>(open, onClose)
  const completed = useMemo(() => new Set(completedChallengeIds), [completedChallengeIds])
  const visibleChallenges = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return PRACTICE_CHALLENGES.filter((challenge) => challenge.kind === selectedKind && (
      !normalizedQuery || [challenge.title, challenge.summary, ...challenge.concepts].join(' ').toLowerCase().includes(normalizedQuery)
    ))
  }, [query, selectedKind])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [open])

  if (!open) return null

  const languageChallenges = PRACTICE_CHALLENGES.filter((challenge) => challenge.kind === selectedKind)
  const languageCompletedCount = languageChallenges.filter((challenge) => completed.has(challenge.id)).length

  return (
    <div className="guide-backdrop" role="presentation" onClick={onClose}>
      <section
        ref={dialogRef}
        className="practice-lab"
        role="dialog"
        aria-modal="true"
        aria-labelledby="practice-lab-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="practice-lab-header">
          <div className="guide-heading-mark" aria-hidden="true"><Dumbbell size={23} /></div>
          <div>
            <p className="eyebrow">Learn by changing real code</p>
            <h2 id="practice-lab-title">Practice Lab</h2>
            <p>Choose a small challenge, work in a private project, and check your answer when you are ready.</p>
          </div>
          <button className="ghost icon-button guide-close-button" type="button" onClick={onClose} aria-label="Close practice lab">
            <X size={19} />
          </button>
        </header>

        <div className="practice-lab-body">
          <nav className="practice-language-tabs" aria-label="Practice languages">
            {PROJECT_KINDS.map((kind) => {
              const kindChallenges = PRACTICE_CHALLENGES.filter((challenge) => challenge.kind === kind)
              const count = kindChallenges.filter((challenge) => completed.has(challenge.id)).length
              return (
                <button
                  key={kind}
                  className={selectedKind === kind ? 'active' : 'secondary'}
                  type="button"
                  aria-current={selectedKind === kind ? 'page' : undefined}
                  onClick={() => {
                    setFilters((current) => ({ ...current, selectedKind: kind, query: '' }))
                  }}
                >
                  {projectKindDefinition(kind).shortLabel}
                  {count > 0 && <small>{count}/{kindChallenges.length}</small>}
                </button>
              )
            })}
          </nav>

          <div className="practice-lab-toolbar">
            <div>
              <p className="eyebrow">{projectKindDefinition(selectedKind).label}</p>
              <h3>{languageCompletedCount} of {languageChallenges.length} complete</h3>
            </div>
            <label className="guide-search" htmlFor="practice-search-input">
              <Search size={17} />
              <input
                id="practice-search-input"
                type="search"
                value={query}
                onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
                placeholder="Search challenges"
                autoComplete="off"
                data-modal-initial-focus
              />
            </label>
          </div>

          <div className="practice-challenge-grid">
            {visibleChallenges.map((challenge) => {
              const isComplete = completed.has(challenge.id)
              const challengeNumber = languageChallenges.findIndex((candidate) => candidate.id === challenge.id) + 1
              return (
                <article key={challenge.id} className={`practice-challenge-card${isComplete ? ' complete' : ''}`}>
                  <div className="practice-card-topline">
                    <span className="practice-number">{String(challengeNumber).padStart(2, '0')}</span>
                    <span className={`practice-difficulty difficulty-${challenge.difficulty.toLowerCase()}`}>{challenge.difficulty}</span>
                    {isComplete && <span className="practice-complete"><Check size={14} /> Complete</span>}
                  </div>
                  <h3>{challenge.title}</h3>
                  <p>{challenge.summary}</p>
                  <div className="practice-concepts" aria-label="Concepts">
                    {challenge.concepts.map((concept) => <span key={concept}>{concept}</span>)}
                  </div>
                  <button type="button" onClick={() => onStartChallenge(challenge)}>
                    {isComplete ? 'Practice again' : 'Start challenge'} <ArrowRight size={16} />
                  </button>
                </article>
              )
            })}
            {visibleChallenges.length === 0 && (
              <div className="practice-empty">
                <Search size={25} />
                <h3>No challenges match “{query}”</h3>
                <button className="secondary" type="button" onClick={() => setFilters((current) => ({ ...current, query: '' }))}>Clear search</button>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
