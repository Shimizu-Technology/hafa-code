import { FlaskConical } from 'lucide-react'
import { LAB_DESTINATIONS, LAB_LINK_SUFFIX } from '../lib/labDestinations'

/**
 * The experimental labs, listed after the project kinds in a language picker. Each is a link
 * to a separate page, not a new project, so it reads "Rust · Lab" and announces that it leaves.
 */
export function LabDestinationLinks({ className = '' }: { className?: string }) {
  return (
    <>
      {LAB_DESTINATIONS.map((destination) => (
        <a
          key={destination.id}
          className={`lab-destination-link${className ? ` ${className}` : ''}`}
          href={destination.href}
          title={destination.description}
          data-lab-destination={destination.id}
        >
          <FlaskConical size={14} aria-hidden="true" />
          <span>{destination.shortLabel}</span>
          <span className="lab-destination-tag">Lab</span>
          <span className="sr-only">{LAB_LINK_SUFFIX}</span>
        </a>
      ))}
    </>
  )
}
