/**
 * Experimental language labs: separate pages that are not Hafa Code project kinds.
 *
 * A lab has no entry in languageRegistry.ts or the Rails project kinds and never creates a
 * workspace project. The language pickers render these after the project kinds, as links
 * that leave the workspace, so learners find a lab where they already look for languages.
 */
export interface LabDestination {
  id: string
  /** The language name shown on the picker button, like a project kind's short label. */
  shortLabel: string
  /** The lab's own name, used for links and headings. */
  title: string
  href: string
  /** What the link opens, read by screen readers and shown as a tooltip. */
  description: string
}

export const LAB_DESTINATIONS: readonly LabDestination[] = Object.freeze([
  {
    id: 'rust',
    shortLabel: 'Rust',
    title: 'Rust Lab',
    href: '/labs/rust/',
    description: 'Opens a separate page. You can write Rust anywhere; running it needs a desktop browser and a one-time compiler download.',
  },
])

/** Screen-reader text after a lab link's visible name: it is experimental and leaves this page. */
export const LAB_LINK_SUFFIX = ' (experimental, opens a separate page)'
