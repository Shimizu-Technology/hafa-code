import { useEffect, useMemo, useState } from 'react'
import { Eye, Loader2, MessageSquare, RefreshCw, Search } from 'lucide-react'
import { api, type CloudOrgMember, type CloudProjectSummary } from '../lib/api'
import { projectKindDefinition, type ProjectVisibility, type SavedProject } from '../lib/codeRunner'
import { formatUpdatedAt, visibilityLabels } from '../lib/workspace'

type ProjectStatusFilter = 'active' | 'archived' | 'all'
type UpdatedFilter = 'all' | '7' | '30'
type FeedbackFilter = 'all' | 'unresolved'

interface ClassroomReviewPanelProps {
  organizationId: string
  members: CloudOrgMember[]
  membersError: string
  membersLoading: boolean
  onOpenProject: (project: SavedProject) => void
  onRefreshMembers: () => void
}

function matchesUpdatedFilter(project: CloudProjectSummary, filter: UpdatedFilter) {
  if (filter === 'all') return true
  const cutoff = Date.now() - Number(filter) * 24 * 60 * 60 * 1_000
  return new Date(project.updatedAt).getTime() >= cutoff
}

export function ClassroomReviewPanel({ organizationId, members, membersError, membersLoading, onOpenProject, onRefreshMembers }: ClassroomReviewPanelProps) {
  const [projects, setProjects] = useState<CloudProjectSummary[]>([])
  const [studentId, setStudentId] = useState('all')
  const [status, setStatus] = useState<ProjectStatusFilter>('active')
  const [visibility, setVisibility] = useState<ProjectVisibility | 'all'>('all')
  const [updated, setUpdated] = useState<UpdatedFilter>('all')
  const [feedback, setFeedback] = useState<FeedbackFilter>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [reloadRevision, setReloadRevision] = useState(0)

  useEffect(() => {
    let cancelled = false
    const selectedStudentId = studentId === 'all' ? undefined : Number(studentId)

    api.getOrganizationProjects(organizationId, { studentId: selectedStudentId }).then((response) => {
      if (cancelled) return
      if (response.error) {
        setProjects([])
        setError(`Could not load class work: ${response.error}`)
      } else {
        setProjects(response.data ?? [])
      }
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [organizationId, reloadRevision, studentId])

  const studentProjects = useMemo(() => {
    if (membersLoading || membersError) return []
    const studentMemberIds = new Set(members.filter((member) => member.organization_role === 'student').map((member) => member.id))
    return projects.filter((project) => project.owner && studentMemberIds.has(project.owner.id))
  }, [members, membersError, membersLoading, projects])

  const visibleProjects = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return studentProjects.filter((project) => {
      if (status === 'active' && project.archivedAt) return false
      if (status === 'archived' && !project.archivedAt) return false
      if (visibility !== 'all' && project.visibility !== visibility) return false
      if (feedback === 'unresolved' && project.unresolvedFeedbackCount === 0) return false
      if (!matchesUpdatedFilter(project, updated)) return false
      if (!normalizedSearch) return true
      return [project.title, project.owner?.fullName ?? '', projectKindDefinition(project.kind).label]
        .some((value) => value.toLowerCase().includes(normalizedSearch))
    })
  }, [feedback, search, status, studentProjects, updated, visibility])

  const openProject = async (summary: CloudProjectSummary) => {
    if (openingId) return
    setOpeningId(summary.id)
    setError('')
    const response = await api.getProject(summary.id)
    if (response.error || !response.data) {
      setError(`Could not open ${summary.title}: ${response.error || 'unknown error'}`)
    } else {
      setOpeningId(null)
      onOpenProject(response.data)
      return
    }
    setOpeningId(null)
  }

  const studentMembers = members.filter((member) => member.organization_role === 'student')

  const changeStudent = (nextStudentId: string) => {
    setLoading(true)
    setError('')
    setStudentId(nextStudentId)
  }

  const reloadProjects = () => {
    setLoading(true)
    setError('')
    onRefreshMembers()
    setReloadRevision((current) => current + 1)
  }

  return (
    <div className="classroom-review-panel">
      <div className="classroom-review-intro">
        <div>
          <strong>Student work</strong>
          <p className="helper-text">Browse lightweight project details first. Source files load only when you open a project for review.</p>
        </div>
        <button className="secondary compact" type="button" onClick={reloadProjects} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : undefined} /> Refresh
        </button>
      </div>

      <div className="classroom-review-filters" aria-label="Filter student work">
        <label>
          <span>Student</span>
          <select value={studentId} onChange={(event) => changeStudent(event.target.value)} disabled={membersLoading || Boolean(membersError)}>
            <option value="all">All students</option>
            {studentMembers.map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}
          </select>
        </label>
        <label>
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as ProjectStatusFilter)}>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
        </label>
        <label>
          <span>Visibility</span>
          <select value={visibility} onChange={(event) => setVisibility(event.target.value as ProjectVisibility | 'all')}>
            <option value="all">Any visibility</option>
            <option value="private">Teacher only</option>
            <option value="organization">Class</option>
            <option value="unlisted">Unlisted</option>
            <option value="public">Public</option>
          </select>
        </label>
        <label>
          <span>Updated</span>
          <select value={updated} onChange={(event) => setUpdated(event.target.value as UpdatedFilter)}>
            <option value="all">Any time</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </select>
        </label>
        <label>
          <span>Feedback</span>
          <select value={feedback} onChange={(event) => setFeedback(event.target.value as FeedbackFilter)}>
            <option value="all">Any feedback</option>
            <option value="unresolved">Needs follow-up</option>
          </select>
        </label>
        <label className="classroom-review-search">
          <span>Search</span>
          <span className="classroom-review-search-field"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Project or student" /></span>
        </label>
      </div>

      <div className="classroom-review-summary" role="status" aria-live="polite">
        {membersLoading ? 'Loading class roster…' : loading ? 'Loading class work…' : `${visibleProjects.length} of ${studentProjects.length} project${studentProjects.length === 1 ? '' : 's'} shown`}
      </div>
      {membersError && <p className="classroom-review-error" role="alert">{membersError}</p>}
      {!membersError && error && <p className="classroom-review-error" role="alert">{error}</p>}
      {!membersLoading && !membersError && !loading && !error && visibleProjects.length === 0 && (
        <p className="empty-project-list">No projects match these filters.</p>
      )}
      <div className="classroom-review-list" role="list" aria-label="Student projects">
        {visibleProjects.map((project) => (
          <article className="classroom-review-card" role="listitem" key={project.id}>
            <div className="classroom-review-card-main">
              <strong>{project.title}</strong>
              <small>{project.owner?.fullName || 'Unknown student'} · {projectKindDefinition(project.kind).label}</small>
              <div className="classroom-review-badges">
                <span>{visibilityLabels[project.visibility]}</span>
                {project.archivedAt && <span>Archived</span>}
                <span>{project.fileCount} file{project.fileCount === 1 ? '' : 's'}</span>
                {project.unresolvedFeedbackCount > 0 && (
                  <span className="feedback-badge"><MessageSquare size={12} /> {project.unresolvedFeedbackCount} unresolved</span>
                )}
              </div>
            </div>
            <small className="classroom-review-updated">Updated {formatUpdatedAt(project.updatedAt)}</small>
            <button className="secondary classroom-review-open" type="button" onClick={() => void openProject(project)} disabled={Boolean(openingId)}>
              {openingId === project.id ? <Loader2 className="spin" size={15} /> : <Eye size={15} />}
              {openingId === project.id ? 'Opening…' : 'Open review'}
            </button>
          </article>
        ))}
      </div>
    </div>
  )
}
