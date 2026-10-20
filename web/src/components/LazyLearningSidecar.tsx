import { useEffect, useState } from 'react'
import { BookOpen, Bug, Dumbbell, GraduationCap, Loader2, RotateCcw, X } from 'lucide-react'
import { useModalFocus } from '../hooks/useModalFocus'
import { useOverlaySidecar } from '../hooks/useOverlaySidecar'
import { projectKindDefinition } from '../lib/codeRunner'
import { createLazyModule } from '../lib/lazyModule'
import type { LearningSidecarProps } from './LearningSidecar'

/**
 * The Guide, Practice Lab, and Coach (their content, challenge checks, and the JavaScript
 * parser the checks use) are about a quarter of the app's code and most visits never open
 * them, so they download on first open.
 */
const learningSidecarModule = createLazyModule(() => import('./LearningSidecar'))

export function LazyLearningSidecar(props: LearningSidecarProps) {
  const { module, state, retry } = learningSidecarModule.useModule(props.open)
  // Adjusted during render (not in an effect) so the first render with content already knows.
  // `opener` is the control that had focus when the skeleton appeared; the skeleton then holds
  // focus, so the loaded panel needs to be told where to return it on close.
  const [skeleton, setSkeleton] = useState<{ opener: HTMLElement | null } | null>(null)
  if (!module && props.open && !skeleton) {
    setSkeleton({ opener: document.activeElement instanceof HTMLElement ? document.activeElement : null })
  }
  if (!props.open && skeleton) setSkeleton(null)
  // When the content replaces the skeleton, the panel is already on screen: skip its entrance.
  if (module) return <module.LearningSidecar {...props} entered={Boolean(skeleton)} returnFocusTo={skeleton?.opener} />
  if (!props.open) return null
  return <LearningSidecarSkeleton failed={state === 'failed'} kind={props.kind} activeTab={props.activeTab} opener={skeleton?.opener ?? null} onClose={props.onClose} onRetry={retry} />
}

const SKELETON_TABS = [
  { id: 'guide', label: 'Guide', Icon: BookOpen },
  { id: 'practice', label: 'Practice', Icon: Dumbbell },
  { id: 'coach', label: 'Coach', Icon: Bug },
] as const

/**
 * Same frame and dialog behavior as the real sidecar, so nothing moves when the content
 * arrives: as a drawer it takes focus, traps Tab, and closes on Escape. Focus returns to
 * the opener whether the skeleton or the loaded panel is closed.
 */
function LearningSidecarSkeleton({
  activeTab,
  failed,
  kind,
  opener,
  onClose,
  onRetry,
}: Pick<LearningSidecarProps, 'activeTab' | 'kind' | 'onClose'> & { failed: boolean; opener: HTMLElement | null; onRetry: () => void }) {
  const overlay = useOverlaySidecar()
  const dialogRef = useModalFocus<HTMLElement>(overlay, onClose, opener)
  const label = projectKindDefinition(kind).shortLabel
  const loadingLabel = activeTab === 'practice' ? 'Loading the practice lab…' : activeTab === 'coach' ? 'Loading the error coach…' : `Loading the ${label} guide…`

  useEffect(() => {
    if (!overlay) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [overlay])

  const sidecar = (
    <aside
      ref={dialogRef}
      className="learning-sidecar learning-sidecar-loading panel"
      role={overlay ? 'dialog' : 'complementary'}
      aria-modal={overlay || undefined}
      aria-labelledby="learning-sidecar-title"
      aria-busy={!failed}
      tabIndex={overlay ? -1 : undefined}
      onClick={(event) => event.stopPropagation()}
    >
      <header className="learning-sidecar-header">
        <div className="learning-sidecar-mark" aria-hidden="true"><GraduationCap size={21} /></div>
        <div>
          <p className="eyebrow">Stays beside your code</p>
          <h2 id="learning-sidecar-title">{label} learning</h2>
          <p>Guides, practice challenges, and error help for your project.</p>
        </div>
        <button className="ghost icon-button" type="button" onClick={onClose} aria-label="Close learning sidecar" data-modal-initial-focus>
          <X size={19} />
        </button>
      </header>

      <div className="learning-sidecar-tabs" aria-hidden="true">
        {SKELETON_TABS.map(({ id, label: tabLabel, Icon }) => (
          <span key={id} className={`learning-sidecar-tab-placeholder${activeTab === id ? ' active' : ''}`}><Icon size={16} /> {tabLabel}</span>
        ))}
      </div>

      <div className="learning-sidecar-body learning-sidecar-skeleton">
        {failed ? (
          <div className="learning-sidecar-load-failed" role="alert">
            <p>This part of Hafa Code could not load. Check your connection, then try again. Your code is safe.</p>
            <button className="secondary" type="button" onClick={onRetry}><RotateCcw size={16} aria-hidden="true" /> Try again</button>
          </div>
        ) : (
          <>
            <p className="learning-sidecar-load-status" role="status"><Loader2 className="spin" size={16} aria-hidden="true" /> {loadingLabel}</p>
            <div className="skeleton-lines" aria-hidden="true">
              <span /><span /><span /><span /><span />
            </div>
          </>
        )}
      </div>
    </aside>
  )

  return overlay
    ? <div className="learning-sidecar-backdrop" role="presentation" onClick={onClose}>{sidecar}</div>
    : sidecar
}
