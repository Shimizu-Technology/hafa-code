import { useEffect, useState } from 'react'
import { BookOpen, Bug, Dumbbell, GraduationCap, Loader2, RotateCcw, X } from 'lucide-react'
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
  const [skeletonShown, setSkeletonShown] = useState(false)
  // Adjusted during render (not in an effect) so the first render with content already knows.
  if (!module && props.open && !skeletonShown) setSkeletonShown(true)
  if (!props.open && skeletonShown) setSkeletonShown(false)
  // When the content replaces the skeleton, the panel is already on screen: skip its entrance.
  if (module) return <module.LearningSidecar {...props} entered={skeletonShown} />
  if (!props.open) return null
  return <LearningSidecarSkeleton failed={state === 'failed'} kind={props.kind} activeTab={props.activeTab} onClose={props.onClose} onRetry={retry} />
}

const SKELETON_TABS = [
  { id: 'guide', label: 'Guide', Icon: BookOpen },
  { id: 'practice', label: 'Practice', Icon: Dumbbell },
  { id: 'coach', label: 'Coach', Icon: Bug },
] as const

/**
 * Same frame as the real sidecar, so nothing moves when the content arrives. It leaves
 * focus on the button that opened it: the real sidecar then takes focus and returns it
 * to that button on close. As a drawer, Escape still closes it.
 */
function LearningSidecarSkeleton({
  activeTab,
  failed,
  kind,
  onClose,
  onRetry,
}: Pick<LearningSidecarProps, 'activeTab' | 'kind' | 'onClose'> & { failed: boolean; onRetry: () => void }) {
  const overlay = useOverlaySidecar()
  const label = projectKindDefinition(kind).shortLabel
  const loadingLabel = activeTab === 'practice' ? 'Loading the practice lab…' : activeTab === 'coach' ? 'Loading the error coach…' : `Loading the ${label} guide…`

  useEffect(() => {
    // Matches the loaded sidecar: Escape closes the drawer, not the docked column.
    if (!overlay) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, overlay])

  useEffect(() => {
    if (!overlay) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [overlay])

  const sidecar = (
    <aside
      className="learning-sidecar learning-sidecar-loading panel"
      aria-labelledby="learning-sidecar-title"
      aria-busy={!failed}
      onClick={(event) => event.stopPropagation()}
    >
      <header className="learning-sidecar-header">
        <div className="learning-sidecar-mark" aria-hidden="true"><GraduationCap size={21} /></div>
        <div>
          <p className="eyebrow">Stays beside your code</p>
          <h2 id="learning-sidecar-title">{label} learning</h2>
          <p>Guides, practice challenges, and error help for your project.</p>
        </div>
        <button className="ghost icon-button" type="button" onClick={onClose} aria-label="Close learning sidecar">
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
