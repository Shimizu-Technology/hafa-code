import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, Dumbbell, Search, X } from 'lucide-react'
import { useModalFocus } from '../hooks/useModalFocus'
import { PROJECT_KINDS, projectKindDefinition, type ProjectKind } from '../lib/codeRunner'
import {
  PRACTICE_DIFFICULTIES,
  practiceChallengeById,
  practiceChallengesFor,
  type PracticeChallenge,
  type PracticeDifficulty,
} from '../lib/practiceLab'

type DifficultyFilter = PracticeDifficulty | 'All'
type StatusFilter = 'All' | 'Not started' | 'Completed'

interface PracticeLabProps {
  completedChallengeIds: string[]
  focusChallengeId?: string | null
  initialKind: ProjectKind
  open: boolean
  onClose: () => void
  onStartChallenge: (challenge: PracticeChallenge) => void
}

export type PracticeLabContentProps = Pick<PracticeLabProps, 'completedChallengeIds' | 'focusChallengeId' | 'initialKind' | 'onStartChallenge'>

function initialFilters(initialKind: ProjectKind, focusChallengeId?: string | null) {
  const focusedChallenge = practiceChallengeById(focusChallengeId)
  return {
    sourceKind: initialKind,
    sourceFocusChallengeId: focusChallengeId ?? null,
    selectedKind: focusedChallenge?.kind ?? initialKind,
    query: '',
    difficulty: 'All' as DifficultyFilter,
    status: 'All' as StatusFilter,
  }
}

/** Lets learners browse short, language-specific exercises without committing to a curriculum. */
export function PracticeLabContent({ completedChallengeIds, focusChallengeId, initialKind, onStartChallenge }: PracticeLabContentProps) {
  const [filters, setFilters] = useState(() => initialFilters(initialKind, focusChallengeId))
  if (filters.sourceKind !== initialKind || filters.sourceFocusChallengeId !== (focusChallengeId ?? null)) {
    setFilters(initialFilters(initialKind, focusChallengeId))
  }
  const { selectedKind, query, difficulty, status } = filters
  const completed = useMemo(() => new Set(completedChallengeIds), [completedChallengeIds])
  const visibleChallenges = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return practiceChallengesFor(selectedKind).filter((challenge) => (
      (difficulty === 'All' || challenge.difficulty === difficulty)
      && (status === 'All' || (status === 'Completed') === completed.has(challenge.id))
      && (!normalizedQuery || [challenge.title, challenge.summary, ...challenge.concepts].join(' ').toLowerCase().includes(normalizedQuery))
    ))
  }, [completed, difficulty, query, selectedKind, status])

  const languageChallenges = practiceChallengesFor(selectedKind)
  const languageCompletedCount = languageChallenges.filter((challenge) => completed.has(challenge.id)).length

  useEffect(() => {
    if (!focusChallengeId || !visibleChallenges.some((challenge) => challenge.id === focusChallengeId)) return
    Array.from(document.querySelectorAll<HTMLElement>('[data-practice-challenge-id]'))
      .find((element) => element.dataset.practiceChallengeId === focusChallengeId)
      ?.scrollIntoView?.({ block: 'nearest' })
  }, [focusChallengeId, visibleChallenges])

  const clearFilters = () => setFilters((current) => ({ ...current, query: '', difficulty: 'All', status: 'All' }))

  return (
        <div className="practice-lab-body practice-content">
          <nav className="practice-language-tabs" aria-label="Practice languages">
            {PROJECT_KINDS.map((kind) => {
              const kindChallenges = practiceChallengesFor(kind)
              const count = kindChallenges.filter((challenge) => completed.has(challenge.id)).length
              return (
                <button
                  key={kind}
                  className={selectedKind === kind ? 'active' : 'secondary'}
                  type="button"
                  aria-current={selectedKind === kind ? 'page' : undefined}
                  onClick={() => {
                    setFilters((current) => ({ ...current, selectedKind: kind, query: '', difficulty: 'All', status: 'All' }))
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

          <div className="practice-tier-progress" aria-label={`${projectKindDefinition(selectedKind).label} progress by level`}>
            {PRACTICE_DIFFICULTIES.map((level) => {
              const levelChallenges = languageChallenges.filter((challenge) => challenge.difficulty === level)
              const levelCompleted = levelChallenges.filter((challenge) => completed.has(challenge.id)).length
              return (
                <button
                  key={level}
                  className={difficulty === level ? 'active' : 'secondary'}
                  type="button"
                  aria-label={`${level}: ${levelCompleted} of ${levelChallenges.length} complete`}
                  aria-pressed={difficulty === level}
                  onClick={() => setFilters((current) => ({ ...current, difficulty: current.difficulty === level ? 'All' : level }))}
                >
                  <span><strong>{level}</strong><small>{levelCompleted}/{levelChallenges.length}</small></span>
                  <progress value={levelCompleted} max={levelChallenges.length || 1} aria-label={`${levelCompleted} of ${levelChallenges.length} ${level} challenges complete`} />
                </button>
              )
            })}
          </div>

          <div className="practice-filter-row" aria-label="Challenge filters">
            <fieldset>
              <legend>Difficulty</legend>
              <div>
                {(['All', ...PRACTICE_DIFFICULTIES] as DifficultyFilter[]).map((value) => (
                  <button key={value} className={difficulty === value ? 'active' : 'secondary'} type="button" aria-pressed={difficulty === value} onClick={() => setFilters((current) => ({ ...current, difficulty: value }))}>{value}</button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Status</legend>
              <div>
                {(['All', 'Not started', 'Completed'] as StatusFilter[]).map((value) => (
                  <button key={value} className={status === value ? 'active' : 'secondary'} type="button" aria-pressed={status === value} onClick={() => setFilters((current) => ({ ...current, status: value }))}>{value}</button>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="practice-challenge-grid">
            {visibleChallenges.map((challenge) => {
              const isComplete = completed.has(challenge.id)
              const challengeNumber = languageChallenges.findIndex((candidate) => candidate.id === challenge.id) + 1
              return (
                <article
                  key={challenge.id}
                  className={`practice-challenge-card${isComplete ? ' complete' : ''}${focusChallengeId === challenge.id ? ' current' : ''}`}
                  data-practice-challenge-id={challenge.id}
                >
                  <div className="practice-card-topline">
                    <span className="practice-number">{String(challengeNumber).padStart(2, '0')}</span>
                    <span className={`practice-difficulty difficulty-${challenge.difficulty.toLowerCase()}`}>{challenge.difficulty}</span>
                    {isComplete && <span className="practice-complete"><Check size={14} /> Complete</span>}
                    {focusChallengeId === challenge.id && <span className="practice-current">Your place</span>}
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
                <h3>No challenges match these filters</h3>
                <p>{query ? `Nothing matched “${query}”.` : 'Try a different difficulty or completion status.'}</p>
                <button className="secondary" type="button" onClick={clearFilters}>Clear filters</button>
              </div>
            )}
          </div>
        </div>
  )
}

/** Lets learners browse short, language-specific exercises without committing to a curriculum. */
export function PracticeLab({ completedChallengeIds, focusChallengeId, initialKind, open, onClose, onStartChallenge }: PracticeLabProps) {
  const dialogRef = useModalFocus<HTMLElement>(open, onClose)

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [open])

  if (!open) return null

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
        <PracticeLabContent
          completedChallengeIds={completedChallengeIds}
          focusChallengeId={focusChallengeId}
          initialKind={initialKind}
          onStartChallenge={onStartChallenge}
        />
      </section>
    </div>
  )
}
