import type { LucideIcon } from 'lucide-react'

export type BottomNavItem<Id extends string> = {
  id: Id
  label: string
  icon: LucideIcon
  /** Marks the section the learner is in (`aria-current="page"`). */
  current?: boolean
  /** An accessible name when the short label alone is not enough. */
  ariaLabel?: string
}

type BottomNavProps<Id extends string> = {
  label: string
  items: readonly BottomNavItem<Id>[]
  onSelect: (id: Id) => void
}

/** The phone navigation: a bottom bar in portrait and a rail on a sideways phone (App.css). */
export function BottomNav<Id extends string>({ label, items, onSelect }: BottomNavProps<Id>) {
  return (
    <nav className="mobile-bottom-nav" aria-label={label}>
      {items.map(({ id, label: itemLabel, icon: Icon, current, ariaLabel }) => (
        <button
          key={id}
          className={current ? 'active' : ''}
          aria-current={current ? 'page' : undefined}
          aria-label={ariaLabel}
          type="button"
          onClick={() => onSelect(id)}
        >
          <Icon size={18} aria-hidden="true" />
          <span>{itemLabel}</span>
        </button>
      ))}
    </nav>
  )
}
