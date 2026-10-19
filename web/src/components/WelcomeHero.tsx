import { Play, Plus, X } from 'lucide-react'

type WelcomeHeroProps = {
  starterLabel: string
  canRunStarter: boolean
  onDismiss: () => void
  onNewPythonProject: () => void
  onRunStarter: () => void
}

/**
 * First-visit welcome. It only appears before a visitor has any saved work and
 * leads straight to a Python project or to running the starter that is already open.
 */
export function WelcomeHero({ starterLabel, canRunStarter, onDismiss, onNewPythonProject, onRunStarter }: WelcomeHeroProps) {
  return (
    <section className="welcome-hero" aria-labelledby="welcome-title">
      <div className="welcome-copy">
        <p className="eyebrow">Hafa adai</p>
        <h2 id="welcome-title">Write code, press Run, see what happens.</h2>
        <p className="welcome-lede">Everything runs in your browser. No setup and no account needed, and your projects stay on this device until you choose to sync or share.</p>
      </div>
      <div className="welcome-actions">
        <button className="primary lg" type="button" onClick={onNewPythonProject}>
          <Plus size={18} aria-hidden="true" /> New Python project
        </button>
        {canRunStarter && (
          <button className="secondary lg" type="button" onClick={onRunStarter}>
            <Play size={18} aria-hidden="true" /> Run the {starterLabel} starter
          </button>
        )}
      </div>
      <button className="ghost icon-button welcome-dismiss" type="button" aria-label="Hide welcome" title="Hide welcome" onClick={onDismiss}>
        <X size={18} aria-hidden="true" />
      </button>
    </section>
  )
}
