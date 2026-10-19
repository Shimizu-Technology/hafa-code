import { Archive, Eye, HardDrive, RotateCcw } from 'lucide-react'
import type { SavedProject } from '../lib/codeRunner'
import { formatSourceBytes, isArchived, PROJECT_SOURCE_LIMIT_BYTES, projectSourceUsage } from '../lib/workspace'

type ProjectStatusBannerProps = {
  canEditProject: boolean
  localBackupAvailable: boolean | null
  ownerLabel: string
  project: SavedProject
  readOnlyReview: boolean
  onRestore: () => void
}

/**
 * Project conditions that need attention stay visible above the code instead of
 * hiding in a menu: archived, read-only review, nearly full, or no local backup.
 */
export function ProjectStatusBanner({ canEditProject, localBackupAvailable, ownerLabel, project, readOnlyReview, onRestore }: ProjectStatusBannerProps) {
  const sourceUsage = projectSourceUsage(project)
  const messages = []

  if (isArchived(project)) {
    messages.push(
      <div key="archived" className="status-banner" data-tone="info">
        <Archive size={16} aria-hidden="true" />
        <span>This project is archived. Restore it to put it back in your active list.</span>
        {canEditProject && <button className="secondary sm" type="button" onClick={onRestore}><RotateCcw size={14} aria-hidden="true" /> Restore</button>}
      </div>,
    )
  }
  if (!canEditProject && !isArchived(project)) {
    messages.push(
      <div key="read-only" className="status-banner" data-tone="info">
        <Eye size={16} aria-hidden="true" />
        <span>{readOnlyReview ? 'Read-only instructor view' : 'Read-only'}{ownerLabel ? ` · by ${ownerLabel}` : ''}. Duplicate it to make changes.</span>
      </div>,
    )
  }
  if (sourceUsage.state !== 'comfortable') {
    messages.push(
      <p key="size" className="status-banner" data-tone={sourceUsage.state === 'full' ? 'danger' : 'warning'} role="status">
        <HardDrive size={16} aria-hidden="true" />
        <span>
          {sourceUsage.state === 'full'
            ? `This project is at the source limit (${formatSourceBytes(sourceUsage.bytes)} of ${formatSourceBytes(PROJECT_SOURCE_LIMIT_BYTES)}). Remove unused code or files before saving again.`
            : `This project is getting full (${formatSourceBytes(sourceUsage.bytes)} of ${formatSourceBytes(PROJECT_SOURCE_LIMIT_BYTES)}). Remove unused code or download a backup before making a large change.`}
        </span>
      </p>,
    )
  }
  if (localBackupAvailable === false) {
    messages.push(
      <p key="backup" className="status-banner" data-tone="danger" role="alert">
        <HardDrive size={16} aria-hidden="true" />
        <span>Local backup is unavailable. Free browser storage or download a workspace backup before closing this tab.</span>
      </p>,
    )
  }

  if (messages.length === 0) return null
  return <div className="project-status">{messages}</div>
}
