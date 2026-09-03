import { useEffect, useState } from 'react'
import { BookOpen, Bug, Dumbbell, GraduationCap, X } from 'lucide-react'
import { useModalFocus } from '../hooks/useModalFocus'
import type { ErrorCoachContext } from '../lib/errorCoach'
import { languageGuideFor, type LanguageGuideTopic } from '../lib/languageGuides'
import type { PracticeChallenge } from '../lib/practiceLab'
import type { ProjectKind } from '../lib/projectTypes'
import { ErrorCoach } from './ErrorCoach'
import { LanguageGuideContent } from './LanguageGuide'
import { PracticeLabContent } from './PracticeLab'

export type LearningTab = 'guide' | 'practice' | 'coach'

const LEARNING_TABS: LearningTab[] = ['guide', 'practice', 'coach']
export const LEARNING_SIDECAR_OVERLAY_QUERY = '(max-width: 1100px)'

interface LearningSidecarProps {
  activeTab: LearningTab
  coachContext: ErrorCoachContext
  completedChallengeIds: string[]
  focusChallengeId?: string | null
  guideKind: ProjectKind
  guideNavigationRevision: number
  guideTopicId: string | null
  kind: ProjectKind
  open: boolean
  onActiveTabChange: (tab: LearningTab) => void
  onClose: () => void
  onOpenGuideTopic: (topicId: string, kind: ProjectKind) => void
  onStartChallenge: (challenge: PracticeChallenge) => void
  onTryExample: (topic: LanguageGuideTopic, kind: ProjectKind) => void
}

function useOverlaySidecar() {
  const [overlay, setOverlay] = useState(() => (
    typeof window.matchMedia === 'function' && window.matchMedia(LEARNING_SIDECAR_OVERLAY_QUERY).matches
  ))

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(LEARNING_SIDECAR_OVERLAY_QUERY)
    const update = () => setOverlay(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return overlay
}

/** Keeps reference, practice, and error help next to the learner's code. */
export function LearningSidecar({
  activeTab,
  coachContext,
  completedChallengeIds,
  focusChallengeId,
  guideKind,
  guideNavigationRevision,
  guideTopicId,
  kind,
  open,
  onActiveTabChange,
  onClose,
  onOpenGuideTopic,
  onStartChallenge,
  onTryExample,
}: LearningSidecarProps) {
  const overlay = useOverlaySidecar()
  const dialogRef = useModalFocus<HTMLElement>(open && overlay, onClose)
  const guide = languageGuideFor(guideKind)
  const visibleKind = activeTab === 'guide' ? guideKind : activeTab === 'coach' && coachContext ? coachContext.kind : kind
  const visibleGuide = languageGuideFor(visibleKind)

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
      className="learning-sidecar panel"
      role={overlay ? 'dialog' : 'complementary'}
      aria-modal={overlay || undefined}
      aria-labelledby="learning-sidecar-title"
      tabIndex={overlay ? -1 : undefined}
      onClick={(event) => event.stopPropagation()}
    >
      <header className="learning-sidecar-header">
        <div className="learning-sidecar-mark" aria-hidden="true"><GraduationCap size={21} /></div>
        <div>
          <p className="eyebrow">Stays beside your code</p>
          <h2 id="learning-sidecar-title">{visibleGuide.label} learning</h2>
          <p>{visibleGuide.introduction}</p>
        </div>
        <button className="ghost icon-button" type="button" onClick={onClose} aria-label="Close learning sidecar" data-modal-initial-focus>
          <X size={19} />
        </button>
      </header>

      <nav
        className="learning-sidecar-tabs"
        role="tablist"
        aria-label="Learning tools"
        onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
          event.preventDefault()
          const currentIndex = LEARNING_TABS.indexOf(activeTab)
          const nextIndex = event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? LEARNING_TABS.length - 1
              : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + LEARNING_TABS.length) % LEARNING_TABS.length
          onActiveTabChange(LEARNING_TABS[nextIndex])
          event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')[nextIndex]?.focus()
        }}
      >
        <button
          className={activeTab === 'guide' ? 'active' : 'secondary'}
          type="button"
          role="tab"
          aria-selected={activeTab === 'guide'}
          aria-controls="learning-guide-panel"
          tabIndex={activeTab === 'guide' ? 0 : -1}
          onClick={() => onActiveTabChange('guide')}
        >
          <BookOpen size={16} /> Guide
        </button>
        <button
          className={activeTab === 'practice' ? 'active' : 'secondary'}
          type="button"
          role="tab"
          aria-selected={activeTab === 'practice'}
          aria-controls="learning-practice-panel"
          tabIndex={activeTab === 'practice' ? 0 : -1}
          onClick={() => onActiveTabChange('practice')}
        >
          <Dumbbell size={16} /> Practice
        </button>
        <button
          className={activeTab === 'coach' ? 'active' : 'secondary'}
          type="button"
          role="tab"
          aria-selected={activeTab === 'coach'}
          aria-controls="learning-coach-panel"
          tabIndex={activeTab === 'coach' ? 0 : -1}
          onClick={() => onActiveTabChange('coach')}
        >
          <Bug size={16} /> Coach
          {coachContext && <span className="learning-error-badge" aria-label="New error advice">1</span>}
        </button>
      </nav>

      <div className="learning-sidecar-body">
        <section id="learning-guide-panel" role="tabpanel" aria-label={`${guide.label} guide`} hidden={activeTab !== 'guide'}>
          <LanguageGuideContent
            key={`${guideKind}:${guideTopicId ?? 'default'}:${guideNavigationRevision}`}
            kind={guideKind}
            initialTopicId={guideTopicId}
            onOpenPractice={() => onActiveTabChange('practice')}
            onTryExample={(topic) => onTryExample(topic, guideKind)}
          />
        </section>
        <section id="learning-practice-panel" role="tabpanel" aria-label="Practice lab" hidden={activeTab !== 'practice'}>
          <PracticeLabContent
            completedChallengeIds={completedChallengeIds}
            focusChallengeId={focusChallengeId}
            initialKind={kind}
            onStartChallenge={onStartChallenge}
          />
        </section>
        <section id="learning-coach-panel" className="learning-coach-panel" role="tabpanel" aria-label="Error coach" hidden={activeTab !== 'coach'}>
          {coachContext ? (
            <>
              {coachContext.kind !== kind && (
                <p className="learning-coach-context">Advice from your last {languageGuideFor(coachContext.kind).label} run</p>
              )}
              <ErrorCoach
                advice={coachContext.advice}
                kind={coachContext.kind}
                onOpenGuideTopic={(topicId) => onOpenGuideTopic(topicId, coachContext.kind)}
              />
            </>
          ) : (
            <div className="learning-coach-empty">
              <Bug size={30} />
              <h3>No error to untangle</h3>
              <p>Run your project. If something breaks, the Coach will explain the message and give you three concrete next steps.</p>
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
