import { useEffect, useMemo, useRef, useState } from 'react'
import MonacoEditor from '@monaco-editor/react'
import { SignInButton, SignUpButton } from '@clerk/clerk-react'
import {
  Archive,
  BookOpen,
  Check,
  Cloud,
  Copy,
  Download,
  FilePlus2,
  Files,
  Globe,
  History,
  Import,
  Layers3,
  Loader2,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Rocket,
  Save,
  Search,
  Send,
  ShieldCheck,
  Terminal,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react'
import './App.css'
import {
  defaultEntryPath,
  inferFileLanguage,
  type ProjectFile,
  type ProjectCheckpoint,
  type ProjectKind,
  type ProjectVisibility,
  type SavedProject,
} from './lib/codeRunner'
import {
  createLocalCheckpoint,
  createProject,
  duplicateProject,
  encodeProjectForShare,
  exportProject,
  loadLocalCheckpoints,
  parseImportedProject,
  saveProjectLibrary,
  snapshotToProject,
  type ProjectLibrary,
} from './lib/projectStorage'
import { useAuthContext } from './contexts/AuthContext'
import { api, type CloudOrgInvitation, type CloudOrgMember } from './lib/api'
import { hasClerkPublishableKey } from './lib/clerk'
import { AuthControls } from './components/AuthControls'
import { RunnerPanel } from './components/RunnerPanel'
import { WebPreview } from './components/WebPreview'
import {
  COLOR_MODE_STORAGE_KEY,
  THEME_STORAGE_KEY,
  loadColorModePreference,
  loadThemePreference,
  useResponsiveEditorFontSize,
  useSystemDarkMode,
  type ColorModePreference,
  type ThemePreference,
} from './hooks/usePreferences'
import {
  PROJECT_FILE_LIMIT,
  availableVisibilityOptions,
  canAddWorkspaceFile,
  clearHashParam,
  formatCheckpointTime,
  formatFileLanguage,
  formatUpdatedAt,
  invitationUrl,
  isArchived,
  isCloudProjectId,
  kindLabels,
  languageForFile,
  loadInitialLibraryWithSharedProject,
  mergeCloudAndLocalProjects,
  nextAvailableCopyPath,
  normalizeWorkspacePath,
  projectContextMatches,
  projectOwnerLabel,
  readHashParam,
  starterContentForPath,
  starterPathForProject,
  validateWorkspacePath,
  visibilityDescriptions,
  visibilityLabels,
  writeClipboardText,
  type ClassroomTab,
  type ConfirmAction,
  type FileDialogState,
  type MobileTab,
} from './lib/workspace'

type ShareDialogState = {
  url: string
  mode: 'server' | 'offline'
  copied: boolean
  error?: string | null
} | null

export default function App() {
  const initial = useMemo(() => loadInitialLibraryWithSharedProject(), [])
  const [library, setLibrary] = useState<ProjectLibrary>(initial.library)
  const initialProject = initial.library.projects.find((candidate) => candidate.id === initial.library.activeProjectId) ?? initial.library.projects[0]
  const [activePath, setActivePath] = useState(initialProject.files[0].path)
  const [notice, setNotice] = useState(initial.notice)
  const [showArchived, setShowArchived] = useState(isArchived(initialProject))
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [editorExpanded, setEditorExpanded] = useState(false)
  const [projectActionsOpen, setProjectActionsOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [pendingCheckpoint, setPendingCheckpoint] = useState<ProjectCheckpoint | null>(null)
  const [fileDialog, setFileDialog] = useState<FileDialogState | null>(null)
  const [fileDialogError, setFileDialogError] = useState('')
  const [shareDialog, setShareDialog] = useState<ShareDialogState>(null)
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(null)
  const [orgMembers, setOrgMembers] = useState<CloudOrgMember[]>([])
  const [orgInvitations, setOrgInvitations] = useState<CloudOrgInvitation[]>([])
  const [inviteEmailDraft, setInviteEmailDraft] = useState('')
  const [inviteRoleDraft, setInviteRoleDraft] = useState<CloudOrgInvitation['role']>('student')
  const [lastInviteUrl, setLastInviteUrl] = useState('')
  const [classroomTab, setClassroomTab] = useState<ClassroomTab>('people')
  const [memberSearchDraft, setMemberSearchDraft] = useState('')
  const [pendingInvitationToken, setPendingInvitationToken] = useState(() => readHashParam('invite'))
  const [pendingInvitation, setPendingInvitation] = useState<CloudOrgInvitation | null>(null)
  const [invitationAccepting, setInvitationAccepting] = useState(false)
  const [instructorPanelOpen, setInstructorPanelOpen] = useState(false)
  const [orgCreateOpen, setOrgCreateOpen] = useState(false)
  const [orgNameDraft, setOrgNameDraft] = useState('')
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => loadThemePreference())
  const [colorModePreference, setColorModePreference] = useState<ColorModePreference>(() => loadColorModePreference())
  const [checkpoints, setCheckpoints] = useState<ProjectCheckpoint[]>(() => loadLocalCheckpoints(initialProject.id))
  const [checkpointMenuOpen, setCheckpointMenuOpen] = useState(false)
  const [mobileTab, setMobileTab] = useState<MobileTab>('home')
  const [hasImportedServerShare, setHasImportedServerShare] = useState(() => !new URLSearchParams(window.location.hash.replace(/^#/, '')).has('share'))
  const [hasLoadedCloudProjects, setHasLoadedCloudProjects] = useState(false)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const checkpointMenuRef = useRef<HTMLDetailsElement | null>(null)
  const syncTimerRef = useRef<number | null>(null)
  const replacingCloudIdRef = useRef(false)
  const acceptingInvitationTokenRef = useRef<string | null>(null)
  const libraryRef = useRef(library)
  const checkpointRequestIdRef = useRef(0)
  const { isSignedIn, isLoading: authLoading, user, organizations, syncSession } = useAuthContext()
  const cloudEnabled = hasClerkPublishableKey(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)
  const editorFontSize = useResponsiveEditorFontSize()
  const systemDark = useSystemDarkMode()

  const project = library.projects.find((candidate) => candidate.id === library.activeProjectId) ?? library.projects[0]
  const activeFile = project.files.find((file) => file.path === activePath) ?? project.files[0]
  const entryFile = project.files.find((file) => file.path === project.entryPath) ?? project.files[0]
  const activeProjects = library.projects.filter((candidate) => !isArchived(candidate))
  const archivedProjects = library.projects.filter(isArchived)
  const activeContextProjects = activeProjects.filter((candidate) => projectContextMatches(candidate, activeOrganizationId))
  const archivedContextProjects = archivedProjects.filter((candidate) => projectContextMatches(candidate, activeOrganizationId))
  const visibleProjects = showArchived ? archivedContextProjects : activeContextProjects
  const checkpointMenuIsOpen = mobileTab === 'history' || checkpointMenuOpen
  const optimisticInvitationOrganization = pendingInvitation?.organization && activeOrganizationId === String(pendingInvitation.organization.id)
    ? {
        id: pendingInvitation.organization.id,
        name: pendingInvitation.organization.name,
        slug: pendingInvitation.organization.slug,
        role: pendingInvitation.role,
      }
    : null
  const activeOrganization = organizations.find((organization) => String(organization.id) === activeOrganizationId) ?? optimisticInvitationOrganization
  const workspaceIsSettling = cloudEnabled && authLoading
  const canUseInstructorPanel = activeOrganization?.role === 'instructor' || activeOrganization?.role === 'owner' || user?.role === 'admin'
  const canInviteOrgMembers = activeOrganization?.role === 'instructor' || activeOrganization?.role === 'owner' || user?.role === 'admin'
  const canManageOrgMembers = activeOrganization?.role === 'owner' || user?.role === 'admin'
  const canCreateOrganization = user?.role === 'admin' || user?.role === 'mentor'
  const canEditProject = !isSignedIn || !project.owner || project.owner.id === user?.id
  const currentProjectOwnerLabel = projectOwnerLabel(project, user?.id)
  const pendingInvitations = orgInvitations.filter((invitation) => !invitation.accepted_at)
  const memberSearch = memberSearchDraft.trim().toLowerCase()
  const filteredOrgMembers = orgMembers.filter((member) => {
    if (!memberSearch) return true
    return [member.full_name, member.email, member.organization_role]
      .some((value) => value.toLowerCase().includes(memberSearch))
  })
  const inviteRequiresAuth = Boolean(pendingInvitationToken && pendingInvitation && !isSignedIn)
  const resolvedTheme = themePreference === 'system'
    ? (systemDark ? 'dark' : 'light')
    : themePreference

  const activateProject = (nextProject: SavedProject) => {
    setLibrary((current) => ({ ...current, activeProjectId: nextProject.id }))
    setActivePath(nextProject.files[0].path)
    setCheckpointMenuOpen(false)
  }

  const activateFallbackProject = (projects: SavedProject[], archivedView = showArchived) => {
    const preferred = projects.find((candidate) => (archivedView ? isArchived(candidate) : !isArchived(candidate))) ?? projects[0]
    if (preferred) {
      setLibrary({ activeProjectId: preferred.id, projects })
      setActivePath(preferred.files[0].path)
      return
    }

    const fallback = createProject('ruby')
    setLibrary({ activeProjectId: fallback.id, projects: [fallback] })
    setActivePath(fallback.files[0].path)
  }

  useEffect(() => {
    libraryRef.current = library
    saveProjectLibrary(library)
  }, [library])

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, themePreference)
  }, [themePreference])

  useEffect(() => {
    localStorage.setItem(COLOR_MODE_STORAGE_KEY, colorModePreference)
  }, [colorModePreference])

  useEffect(() => {
    const requestId = checkpointRequestIdRef.current + 1
    checkpointRequestIdRef.current = requestId
    let cancelled = false
    const isCurrentRequest = () => !cancelled && checkpointRequestIdRef.current === requestId && libraryRef.current.activeProjectId === project.id

    Promise.resolve().then(() => {
      if (isCurrentRequest()) setCheckpoints(loadLocalCheckpoints(project.id))
    })

    if (isSignedIn && isCloudProjectId(project.id)) {
      api.getCheckpoints(project.id).then((res) => {
        if (isCurrentRequest() && res.data) setCheckpoints(res.data)
      })
    }

    return () => {
      cancelled = true
    }
  }, [isSignedIn, project.id])

  useEffect(() => {
    if (hasImportedServerShare) return

    const shareToken = readHashParam('share')
    if (!shareToken) return

    api.getShare(shareToken).then((res) => {
      if (res.data) {
        setLibrary((current) => ({ activeProjectId: res.data!.id, projects: [res.data!, ...current.projects] }))
        setActivePath(res.data.files[0].path)
        setShowArchived(false)
        setNotice('Shared project imported locally.')
        window.history.replaceState(null, '', window.location.pathname)
      } else {
        setNotice(`Could not import share: ${res.error || 'unknown error'}`)
      }
      setHasImportedServerShare(true)
    })
  }, [hasImportedServerShare])

  useEffect(() => {
    if (!pendingInvitationToken) return

    api.getInvitation(pendingInvitationToken).then((res) => {
      if (res.data) {
        setPendingInvitation(res.data)
      } else {
        setNotice(`Could not load invitation: ${res.error || 'unknown error'}`)
        setPendingInvitationToken(null)
        clearHashParam('invite')
      }
    })
  }, [pendingInvitationToken])

  useEffect(() => {
    if (!pendingInvitationToken || !isSignedIn || invitationAccepting) return
    if (acceptingInvitationTokenRef.current === pendingInvitationToken) return

    acceptingInvitationTokenRef.current = pendingInvitationToken
    queueMicrotask(() => setInvitationAccepting(true))
    api.acceptInvitation(pendingInvitationToken).then(async (res) => {
      if (res.data) {
        await syncSession()
        setActiveOrganizationId(String(res.data.id))
        setPendingInvitationToken(null)
        setPendingInvitation(null)
        clearHashParam('invite')
        setNotice(`Joined ${res.data.name}.`)
      } else {
        setNotice(`Could not accept invitation: ${res.error || 'unknown error'}`)
        setPendingInvitationToken(null)
      }
    }).finally(() => {
      acceptingInvitationTokenRef.current = null
      setInvitationAccepting(false)
    })
  }, [invitationAccepting, isSignedIn, pendingInvitationToken, syncSession])

  useEffect(() => {
    if (!notice) return

    const timeout = window.setTimeout(() => setNotice(''), 4_500)
    return () => window.clearTimeout(timeout)
  }, [notice])

  useEffect(() => {
    queueMicrotask(() => {
      setHasLoadedCloudProjects(false)
      setInstructorPanelOpen(false)
      setOrgMembers([])
      setOrgInvitations([])
      setLastInviteUrl('')
    })
  }, [activeOrganizationId])

  useEffect(() => {
    if (!checkpointMenuOpen) return undefined

    const handlePointerDown = (event: PointerEvent) => {
      if (checkpointMenuRef.current?.contains(event.target as Node)) return
      setCheckpointMenuOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCheckpointMenuOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [checkpointMenuOpen])

  useEffect(() => {
    if (!isSignedIn || !activeOrganizationId || !canUseInstructorPanel) return

    api.getOrgMembers(activeOrganizationId).then((res) => {
      if (res.data) setOrgMembers(res.data)
      if (res.error) setNotice(`Could not load organization roster: ${res.error}`)
    })
  }, [activeOrganizationId, canUseInstructorPanel, isSignedIn])

  useEffect(() => {
    if (!isSignedIn || !activeOrganizationId || !canInviteOrgMembers) return

    api.getOrgInvitations(activeOrganizationId).then((res) => {
      if (res.data) setOrgInvitations(res.data)
      if (res.error) setNotice(`Could not load invitations: ${res.error}`)
    })
  }, [activeOrganizationId, canInviteOrgMembers, isSignedIn])

  useEffect(() => {
    if (!isSignedIn || hasLoadedCloudProjects) return

    api.getProjects(activeOrganizationId).then((res) => {
      if (res.error) {
        setNotice(`Cloud sync unavailable: ${res.error}`)
        setHasLoadedCloudProjects(true)
        return
      }
      if (res.data && res.data.length > 0) {
        const remainingContextProjects = libraryRef.current.projects.filter((candidate) => !projectContextMatches(candidate, activeOrganizationId))
        const baseLibrary = { ...libraryRef.current, projects: remainingContextProjects }
        const merged = mergeCloudAndLocalProjects(res.data, baseLibrary, activeOrganizationId)
        const nextProject = merged.projects.find((candidate) => candidate.id === merged.activeProjectId) ?? merged.projects[0]
        setLibrary(merged)
        setActivePath(nextProject.files[0].path)
        setShowArchived(isArchived(nextProject))
        setNotice(`Loaded ${res.data.length} ${activeOrganization ? `${activeOrganization.name} ` : ''}cloud project${res.data.length === 1 ? '' : 's'}.`)
      } else {
        if (activeOrganizationId) {
          const contextProjects = libraryRef.current.projects.filter((candidate) => projectContextMatches(candidate, activeOrganizationId))
          if (contextProjects.length === 0) {
            const next = createProject('ruby', `${activeOrganization?.name || 'Org'} Ruby Playground`)
            const orgProject = {
              ...next,
              organizationId: activeOrganizationId,
              organization: activeOrganization,
              visibility: 'private' as ProjectVisibility,
            }
            setLibrary((current) => ({ activeProjectId: orgProject.id, projects: [orgProject, ...current.projects] }))
            setActivePath(orgProject.files[0].path)
          }
        } else {
          setNotice('Signed in. Local projects will sync to your account as you edit.')
        }
      }
      setHasLoadedCloudProjects(true)
    })
  }, [activeOrganization, activeOrganizationId, hasLoadedCloudProjects, isSignedIn])

  useEffect(() => {
    if (!isSignedIn || !hasLoadedCloudProjects || replacingCloudIdRef.current || !canEditProject) return
    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current)

    syncTimerRef.current = window.setTimeout(async () => {
      if (isCloudProjectId(project.id)) {
        const res = await api.updateProject(project)
        if (res.error) setNotice(`Cloud save failed: ${res.error}`)
        return
      }

      const res = await api.createProject(project)
      if (res.error || !res.data) {
        setNotice(`Cloud save failed: ${res.error || 'unknown error'}`)
        return
      }

      replacingCloudIdRef.current = true
      setLibrary((current) => ({
        activeProjectId: current.activeProjectId === project.id ? res.data!.id : current.activeProjectId,
        projects: current.projects.map((candidate) => candidate.id === project.id ? res.data! : candidate),
      }))
      window.setTimeout(() => { replacingCloudIdRef.current = false }, 0)
    }, 900)

    return () => {
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current)
    }
  }, [canEditProject, hasLoadedCloudProjects, isSignedIn, library, project])

  const setActiveProject = (projectId: string) => {
    const nextProject = library.projects.find((candidate) => candidate.id === projectId)
    if (!nextProject) return
    activateProject(nextProject)
    setMobileTab('code')
  }

  const addProject = (kind: ProjectKind) => {
    const starter = createProject(kind)
    const next = {
      ...starter,
      organizationId: activeOrganizationId,
      organization: activeOrganization,
      visibility: 'private' as ProjectVisibility,
    }
    setLibrary((current) => ({ activeProjectId: next.id, projects: [next, ...current.projects] }))
    setActivePath(next.files[0].path)
    setShowArchived(false)
    setMobileTab('code')
    setNotice(`${next.title} created.`)
  }

  const updateProjectVisibility = (visibility: ProjectVisibility) => {
    updateCurrentProject((currentProject) => ({
      ...currentProject,
      visibility,
      updatedAt: new Date().toISOString(),
    }))
    setNotice(`Visibility set to ${visibilityLabels[visibility]}.`)
  }

  const createOrganization = async () => {
    const name = orgNameDraft.trim()
    if (!name) {
      setNotice('Enter an organization name.')
      return
    }

    const res = await api.createOrganization(name)
    if (res.error || !res.data) {
      setNotice(`Could not create organization: ${res.error || 'unknown error'}`)
      return
    }

    await syncSession()
    setActiveOrganizationId(String(res.data.id))
    setOrgNameDraft('')
    setOrgCreateOpen(false)
    setNotice(`${res.data.name} created.`)
  }

  const inviteOrgMember = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeOrganizationId) return

    const email = inviteEmailDraft.trim().toLowerCase()
    if (!email) {
      setNotice('Enter an email address to invite.')
      return
    }

    const role = canManageOrgMembers ? inviteRoleDraft : 'student'
    const res = await api.createOrgInvitation(activeOrganizationId, email, role)
    if (res.error || !res.data) {
      setNotice(`Could not create invitation: ${res.error || 'unknown error'}`)
      return
    }

    const url = res.data.invitation_url || invitationUrl(res.data.token)
    setOrgInvitations((current) => [res.data!, ...current.filter((candidate) => candidate.id !== res.data!.id)])
    setInviteEmailDraft('')
    setInviteRoleDraft('student')
    setLastInviteUrl(url)
    const copied = await writeClipboardText(url)
    if (res.data.email_sent) {
      setNotice(copied ? 'Invitation email sent. Backup link copied.' : 'Invitation email sent. Backup link is in the classroom panel.')
    } else {
      setNotice(copied ? 'Invitation created. Email is not configured yet, so the link was copied.' : 'Invitation created. Email is not configured yet, so copy the link from the classroom panel.')
    }
    setClassroomTab('invitations')
  }

  const copyInvitationLink = async (invitation: CloudOrgInvitation) => {
    const url = invitation.invitation_url || invitationUrl(invitation.token)
    const copied = await writeClipboardText(url)
    setLastInviteUrl(url)
    setNotice(copied ? 'Invitation link copied.' : 'Clipboard blocked. Select the invitation link to copy it.')
  }

  const resendInvitation = async (invitation: CloudOrgInvitation) => {
    if (!activeOrganizationId || !invitation.id) return

    const res = await api.resendOrgInvitation(activeOrganizationId, invitation.id)
    if (res.error || !res.data) {
      setNotice(`Could not resend invitation: ${res.error || 'unknown error'}`)
      return
    }

    const url = res.data.invitation_url || invitationUrl(res.data.token)
    setOrgInvitations((current) => current.map((candidate) => candidate.id === res.data!.id ? res.data! : candidate))
    setLastInviteUrl(url)
    setNotice(res.data.email_sent ? 'Invitation email resent.' : 'Invitation resent link is ready, but email is not configured yet.')
  }

  const revokeInvitation = async (invitation: CloudOrgInvitation) => {
    if (!activeOrganizationId || !invitation.id) return
    if (!window.confirm(`Revoke the invitation for ${invitation.email}? The current link will stop working.`)) return

    const res = await api.deleteOrgInvitation(activeOrganizationId, invitation.id)
    if (res.error) {
      setNotice(`Could not revoke invitation: ${res.error}`)
      return
    }

    setOrgInvitations((current) => current.filter((candidate) => candidate.id !== invitation.id))
    if (lastInviteUrl.includes(invitation.token)) setLastInviteUrl('')
    setNotice('Invitation revoked.')
  }

  const updateOrgMemberRole = async (member: CloudOrgMember, role: CloudOrgMember['organization_role']) => {
    if (!activeOrganizationId || role === member.organization_role) return

    const res = await api.updateOrgMember(activeOrganizationId, member.membership_id, role)
    if (res.error || !res.data) {
      setNotice(`Could not update member: ${res.error || 'unknown error'}`)
      return
    }

    setOrgMembers((current) => current.map((candidate) => candidate.membership_id === res.data!.membership_id ? res.data! : candidate))
    setNotice(`${res.data.full_name} is now ${res.data.organization_role}.`)
  }

  const removeOrgMember = async (member: CloudOrgMember) => {
    if (!activeOrganizationId) return
    if (!window.confirm(`Remove ${member.full_name} from ${activeOrganization?.name || 'this organization'}? Their projects stay in the workspace, but they lose organization access.`)) return

    const res = await api.deleteOrgMember(activeOrganizationId, member.membership_id)
    if (res.error) {
      setNotice(`Could not remove member: ${res.error}`)
      return
    }

    setOrgMembers((current) => current.filter((candidate) => candidate.membership_id !== member.membership_id))
    setNotice(`${member.full_name} removed from ${activeOrganization?.name || 'organization'}.`)
  }

  const requestArchiveProject = () => {
    if (activeContextProjects.length <= 1) {
      setNotice('Keep at least one active project in the library.')
      return
    }
    setProjectActionsOpen(false)
    setConfirmAction('archive')
  }

  const requestDeleteProject = () => {
    if (library.projects.length <= 1) {
      setNotice('Keep at least one project in the library.')
      return
    }
    setProjectActionsOpen(false)
    setConfirmAction('delete')
  }

  const removeProject = (projectId: string) => {
    if (library.projects.length === 1) {
      setNotice('Keep at least one project in the library.')
      return
    }
    const remaining = library.projects.filter((candidate) => candidate.id !== projectId)
    if (projectId === library.activeProjectId) {
      activateFallbackProject(remaining)
    } else {
      setLibrary((current) => ({ ...current, projects: remaining }))
    }
    if (isSignedIn && isCloudProjectId(projectId)) {
      api.deleteProject(projectId).then((res) => {
        setNotice(res.error ? `Cloud delete failed: ${res.error}` : 'Project deleted from cloud.')
      })
    } else {
      setNotice('Project deleted locally.')
    }
  }

  const flushCloudProject = async (projectToFlush: SavedProject) => {
    if (!isSignedIn || !isCloudProjectId(projectToFlush.id)) return projectToFlush

    if (syncTimerRef.current) {
      window.clearTimeout(syncTimerRef.current)
      syncTimerRef.current = null
    }

    const res = await api.updateProject(projectToFlush)
    if (res.error || !res.data) {
      setNotice(`Cloud save failed: ${res.error || 'unknown error'}`)
      return null
    }

    setLibrary((current) => ({
      ...current,
      projects: current.projects.map((candidate) => candidate.id === res.data!.id ? res.data! : candidate),
    }))
    return res.data
  }

  const archiveProject = async () => {
    if (activeContextProjects.length <= 1) {
      setNotice('Keep at least one active project in the library.')
      return
    }
    const projectToArchive = project
    const flushedProject = await flushCloudProject(projectToArchive)
    if (!flushedProject) return

    if (isSignedIn && isCloudProjectId(flushedProject.id)) {
      const res = await api.archiveProject(flushedProject.id)
      if (res.error || !res.data) {
        setNotice(`Cloud archive failed: ${res.error || 'unknown error'}`)
        return
      }

      const projects = libraryRef.current.projects.map((candidate) => candidate.id === res.data!.id ? res.data! : candidate)
      activateFallbackProject(projects, false)
      setShowArchived(false)
      setNotice(`${projectToArchive.title || 'Project'} archived.`)
      return
    }

    const archivedAt = new Date().toISOString()
    const projects = libraryRef.current.projects.map((candidate) => candidate.id === flushedProject.id
      ? { ...flushedProject, archivedAt, updatedAt: archivedAt }
      : candidate)
    activateFallbackProject(projects, false)
    setShowArchived(false)
    setNotice(`${projectToArchive.title || 'Project'} archived.`)
  }

  const restoreProject = async () => {
    const projectToRestore = project

    if (isSignedIn && isCloudProjectId(projectToRestore.id)) {
      const res = await api.unarchiveProject(projectToRestore.id)
      if (res.error || !res.data) {
        setNotice(`Cloud restore failed: ${res.error || 'unknown error'}`)
        return
      }

      setLibrary((current) => ({
        activeProjectId: res.data!.id,
        projects: current.projects.map((candidate) => candidate.id === res.data!.id ? res.data! : candidate),
      }))
      setActivePath(res.data.files[0].path)
      setShowArchived(false)
      setNotice(`${projectToRestore.title || 'Project'} restored.`)
      return
    }

    const restoredAt = new Date().toISOString()
    const projects = library.projects.map((candidate) => candidate.id === projectToRestore.id
      ? { ...candidate, archivedAt: null, updatedAt: restoredAt }
      : candidate)
    setLibrary({ activeProjectId: projectToRestore.id, projects })
    setActivePath(projectToRestore.files[0].path)
    setShowArchived(false)
    setNotice(`${projectToRestore.title || 'Project'} restored.`)
  }

  const cloneProject = () => {
    setProjectActionsOpen(false)
    const copy = duplicateProject(project)
    setLibrary((current) => ({ activeProjectId: copy.id, projects: [copy, ...current.projects] }))
    setActivePath(copy.files[0].path)
    setShowArchived(false)
    setMobileTab('code')
    setNotice('Project duplicated.')
  }

  const confirmProjectAction = () => {
    if (confirmAction === 'archive') archiveProject()
    if (confirmAction === 'delete') removeProject(project.id)
    if (confirmAction === 'checkpoint' && pendingCheckpoint) restoreCheckpoint(pendingCheckpoint)
    setConfirmAction(null)
    setPendingCheckpoint(null)
  }

  const renameProject = (title: string) => {
    if (!canEditProject) return
    setLibrary((current) => ({
      ...current,
      projects: current.projects.map((candidate) => candidate.id === project.id
        ? { ...candidate, title, updatedAt: new Date().toISOString() }
        : candidate),
    }))
  }

  const updateActiveFile = (content: string) => {
    if (!canEditProject) return
    setLibrary((current) => ({
      ...current,
      projects: current.projects.map((candidate) => candidate.id === project.id
        ? {
            ...candidate,
            files: candidate.files.map((file) => file.path === activeFile.path ? { ...file, content } : file),
            updatedAt: new Date().toISOString(),
          }
        : candidate),
    }))
  }

  const updateCurrentProject = (updater: (currentProject: SavedProject) => SavedProject) => {
    if (!canEditProject) return
    setLibrary((current) => ({
      ...current,
      projects: current.projects.map((candidate) => candidate.id === project.id ? updater(candidate) : candidate),
    }))
  }

  const openCreateFileDialog = () => {
    if (!canAddWorkspaceFile(project)) {
      setNotice(`Projects can include up to ${PROJECT_FILE_LIMIT} files.`)
      return
    }
    setFileDialogError('')
    setFileDialog({ mode: 'create', path: starterPathForProject(project.kind, project.files) })
  }

  const openRenameFileDialog = (file: ProjectFile) => {
    setFileDialogError('')
    setFileDialog({ mode: 'rename', path: file.path, sourcePath: file.path })
  }

  const openDuplicateFileDialog = (file: ProjectFile) => {
    if (!canAddWorkspaceFile(project)) {
      setNotice(`Projects can include up to ${PROJECT_FILE_LIMIT} files.`)
      return
    }
    setFileDialogError('')
    setFileDialog({ mode: 'duplicate', path: nextAvailableCopyPath(file.path, project), sourcePath: file.path })
  }

  const submitFileDialog = () => {
    if (!fileDialog) return

    const nextPath = normalizeWorkspacePath(fileDialog.path)
    const error = validateWorkspacePath(nextPath, project, fileDialog.mode === 'rename' ? fileDialog.sourcePath : undefined)
    if (error) {
      setFileDialogError(error)
      return
    }

    if (fileDialog.mode === 'create') {
      if (!canAddWorkspaceFile(project)) {
        setFileDialogError(`Projects can include up to ${PROJECT_FILE_LIMIT} files.`)
        return
      }
      const nextFile: ProjectFile = {
        path: nextPath,
        language: inferFileLanguage(nextPath, project.kind),
        content: starterContentForPath(nextPath, project.kind),
      }
      updateCurrentProject((currentProject) => ({
        ...currentProject,
        entryPath: currentProject.entryPath || nextPath,
        files: [...currentProject.files, nextFile],
        updatedAt: new Date().toISOString(),
      }))
      setActivePath(nextPath)
      setNotice(`${nextPath} created.`)
    }

    if (fileDialog.mode === 'rename' && fileDialog.sourcePath) {
      updateCurrentProject((currentProject) => ({
        ...currentProject,
        entryPath: currentProject.entryPath === fileDialog.sourcePath ? nextPath : currentProject.entryPath,
        files: currentProject.files.map((file) => file.path === fileDialog.sourcePath
          ? { ...file, path: nextPath, language: inferFileLanguage(nextPath, currentProject.kind) }
          : file),
        updatedAt: new Date().toISOString(),
      }))
      if (activePath === fileDialog.sourcePath) setActivePath(nextPath)
      setNotice(`${fileDialog.sourcePath} renamed.`)
    }

    if (fileDialog.mode === 'duplicate' && fileDialog.sourcePath) {
      if (!canAddWorkspaceFile(project)) {
        setFileDialogError(`Projects can include up to ${PROJECT_FILE_LIMIT} files.`)
        return
      }
      const sourceFile = project.files.find((file) => file.path === fileDialog.sourcePath)
      if (!sourceFile) return
      const nextFile = {
        ...sourceFile,
        path: nextPath,
        language: inferFileLanguage(nextPath, project.kind),
      }
      updateCurrentProject((currentProject) => ({
        ...currentProject,
        files: [...currentProject.files, nextFile],
        updatedAt: new Date().toISOString(),
      }))
      setActivePath(nextPath)
      setNotice(`${nextPath} duplicated.`)
    }

    setFileDialog(null)
    setFileDialogError('')
  }

  const deleteFile = (file: ProjectFile) => {
    if (project.files.length <= 1) {
      setNotice('Keep at least one file in the project.')
      return
    }

    const remaining = project.files.filter((candidate) => candidate.path !== file.path)
    const nextActivePath = activePath === file.path ? remaining[0].path : activePath
    updateCurrentProject((currentProject) => ({
      ...currentProject,
      entryPath: currentProject.entryPath === file.path ? defaultEntryPath(remaining, currentProject.kind) : currentProject.entryPath,
      files: remaining,
      updatedAt: new Date().toISOString(),
    }))
    if (activePath !== nextActivePath) setActivePath(nextActivePath)
    setNotice(`${file.path} deleted.`)
  }

  const setEntryPath = (file: ProjectFile) => {
    updateCurrentProject((currentProject) => ({
      ...currentProject,
      entryPath: file.path,
      updatedAt: new Date().toISOString(),
    }))
    setNotice(`${file.path} is now the entry file.`)
  }

  const runFromMobileCode = () => {
    setMobileTab('output')
    if (project.kind !== 'web') window.setTimeout(() => window.dispatchEvent(new CustomEvent('hafa-code-run-active-project')), 0)
  }

  const requestRestoreCheckpoint = (checkpoint: ProjectCheckpoint) => {
    setPendingCheckpoint(checkpoint)
    setConfirmAction('checkpoint')
  }

  const saveCheckpoint = async () => {
    const projectToCheckpoint = libraryRef.current.projects.find((candidate) => candidate.id === libraryRef.current.activeProjectId) ?? project
    const checkpointProjectId = projectToCheckpoint.id
    const isCurrentCheckpointProject = () => libraryRef.current.activeProjectId === checkpointProjectId
    const title = `Checkpoint ${formatCheckpointTime(new Date().toISOString())}`
    let cloudCheckpointError = ''
    let checkpointProject = projectToCheckpoint

    if (isSignedIn && isCloudProjectId(projectToCheckpoint.id)) {
      const flushedProject = await flushCloudProject(projectToCheckpoint)
      if (flushedProject) {
        checkpointProject = flushedProject
      } else {
        cloudCheckpointError = 'could not save latest changes to cloud'
      }
    }

    if (isSignedIn && isCloudProjectId(checkpointProject.id) && !cloudCheckpointError) {
      const res = await api.createCheckpoint(checkpointProject.id, title)
      if (res.data) {
        if (isCurrentCheckpointProject()) {
          setCheckpoints((current) => [res.data!, ...current].slice(0, 30))
          setNotice('Checkpoint saved to cloud.')
        }
        return
      }
      cloudCheckpointError = res.error || 'unknown error'
    }

    const checkpoint = createLocalCheckpoint(checkpointProject, title)
    if (isCurrentCheckpointProject()) {
      setCheckpoints((current) => [checkpoint, ...current].slice(0, 30))
      setNotice(cloudCheckpointError
        ? `Cloud checkpoint failed: ${cloudCheckpointError}. Saved locally instead.`
        : 'Checkpoint saved locally.')
    }
  }

  const restoreCheckpoint = async (checkpoint: ProjectCheckpoint) => {
    if (isSignedIn && isCloudProjectId(project.id) && isCloudProjectId(checkpoint.id)) {
      const res = await api.restoreCheckpoint(project.id, checkpoint.id)
      if (res.data) {
        setLibrary((current) => ({
          activeProjectId: res.data!.id,
          projects: current.projects.map((candidate) => candidate.id === res.data!.id ? res.data! : candidate),
        }))
        setActivePath(res.data.files[0].path)
        setShowArchived(isArchived(res.data))
        setMobileTab('code')
        setNotice(`Restored ${checkpoint.title}.`)
        return
      }
      setNotice(`Restore failed: ${res.error || 'unknown error'}`)
      return
    }

    if (!checkpoint.snapshot) {
      setNotice('This checkpoint can only be restored from cloud.')
      return
    }

    const restored = snapshotToProject(project, checkpoint.snapshot)
    setLibrary((current) => ({
      ...current,
      projects: current.projects.map((candidate) => candidate.id === project.id ? restored : candidate),
    }))
    setActivePath(restored.files[0].path)
    setShowArchived(false)
    setMobileTab('code')
    setNotice(`Restored ${checkpoint.title}.`)
  }

  const copyShareLink = async () => {
    const share = await api.createShare(project)
    const url = share.data
      ? `${window.location.origin}${window.location.pathname}#share=${share.data.token}`
      : `${window.location.origin}${window.location.pathname}#project=${encodeProjectForShare(project)}`
    const didCopy = await writeClipboardText(url)
    setShareDialog({
      url,
      mode: share.data ? 'server' : 'offline',
      copied: didCopy,
      error: share.error,
    })
    if (share.data) {
      setNotice(didCopy ? 'Share snapshot link copied.' : 'Share snapshot link is ready to copy.')
    } else {
      setNotice(didCopy
        ? `Offline share link copied.${share.error ? ` Server share failed: ${share.error}` : ''}`
        : 'Offline share link is ready to copy.')
    }
  }

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const imported = parseImportedProject(await file.text())
      setLibrary((current) => ({ activeProjectId: imported.id, projects: [imported, ...current.projects] }))
      setActivePath(imported.files[0].path)
      setShowArchived(false)
      setNotice('Project imported.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Import failed.')
    } finally {
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  return (
    <main
      className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${editorExpanded ? 'editor-expanded' : ''} ${inviteRequiresAuth ? 'invite-auth-mode' : ''} mobile-tab-${mobileTab}`}
      data-theme={resolvedTheme}
      data-color-mode={colorModePreference}
    >
      <header className="hero panel hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Open-source coding playground</p>
          <h1>Hafa Code</h1>
          <p className="lede">A tiny Replit alternative for CSG and FD students: Ruby, JavaScript, and HTML/CSS/JS in the browser.</p>
          <div className="trust-row" aria-label="Platform guardrails">
            <span><ShieldCheck size={15} /> Browser-sandboxed</span>
            <span><Rocket size={15} /> No setup</span>
            <span><BookOpen size={15} /> Beginner-first</span>
          </div>
        </div>
        <div className="hero-card" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="hero-card-inner">
            <Layers3 size={26} />
            <strong>{activeContextProjects.length}</strong>
            <span>{isSignedIn ? 'active cloud projects' : 'active local projects'}</span>
          </div>
        </div>
        <div className="hero-actions desktop-hero-actions">
          <AuthControls cloudEnabled={cloudEnabled} sessionLoading={authLoading} />
          <button className="secondary" onClick={() => exportProject(project)}><Download size={16} /> Export</button>
          <button className="secondary" onClick={() => importInputRef.current?.click()}><Import size={16} /> Import</button>
          <button onClick={copyShareLink}><Copy size={16} /> Share</button>
          <input ref={importInputRef} hidden type="file" accept="application/json,.json" onChange={(event) => handleImportFile(event.target.files?.[0])} />
        </div>
        <details className="mobile-actions-menu">
          <summary>
            <span>Sync and share</span>
            <strong>{isSignedIn ? 'Cloud on' : 'Local only'}</strong>
          </summary>
          <div className="mobile-actions-content">
            <AuthControls cloudEnabled={cloudEnabled} sessionLoading={authLoading} />
            <button className="secondary" onClick={() => exportProject(project)}><Download size={16} /> Export</button>
            <button className="secondary" onClick={() => importInputRef.current?.click()}><Import size={16} /> Import</button>
            <button onClick={copyShareLink}><Copy size={16} /> Share</button>
          </div>
        </details>
      </header>

      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button className="ghost" onClick={() => setNotice('')}>Dismiss</button>
        </div>
      )}

      {pendingInvitationToken && pendingInvitation && (
        <section className={`invite-accept-panel panel surface-grid${inviteRequiresAuth ? ' invite-accept-panel-focused' : ''}`} aria-label="Organization invitation">
          <div>
            <p className="eyebrow">Invitation</p>
            <h2>{pendingInvitation.organization?.name || 'Organization'} invited you as {pendingInvitation.role === 'instructor' ? 'an instructor' : 'a student'}</h2>
            <p className="helper-text">
              {isSignedIn
                ? invitationAccepting ? 'Accepting your invitation...' : `Signed in as ${user?.email || 'your account'}.`
                : 'Sign in or create your account with the invited email, then this invitation will be accepted here.'}
            </p>
          </div>
          {!isSignedIn && (
            <div className="invite-auth-actions">
              <SignInButton mode="modal">
                <button className="secondary" type="button"><Cloud size={16} /> Sign in</button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button type="button"><UserPlus size={16} /> Create account</button>
              </SignUpButton>
            </div>
          )}
          {isSignedIn && invitationAccepting && <Loader2 className="spin" size={20} />}
        </section>
      )}

      {!inviteRequiresAuth && (
      <>
      <section className="context-bar panel surface-grid" aria-label="Project context">
        <div className="context-copy">
          <p className="eyebrow">Workspace</p>
          <h2>{activeOrganization ? activeOrganization.name : 'Personal projects'}</h2>
          <p className="helper-text">
            {activeOrganization
              ? `${activeOrganization.role} workspace. Private projects are still visible to instructors.`
              : 'Your own projects, separate from any classroom or organization.'}
          </p>
        </div>
        <div className="context-actions">
          <div className="workspace-toolbar" aria-label="Workspace actions">
            <label className="workspace-select-label" htmlFor="workspace-select">
              <span>Switch workspace</span>
              <select
                id="workspace-select"
                className="workspace-select"
                disabled={workspaceIsSettling}
                value={activeOrganizationId ?? 'personal'}
                onChange={(event) => setActiveOrganizationId(event.target.value === 'personal' ? null : event.target.value)}
              >
                <option value="personal">Personal projects</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>
            {isSignedIn && canCreateOrganization ? (
              <button className="secondary context-chip" type="button" onClick={() => setOrgCreateOpen(true)}>
                <Plus size={14} /> Org
              </button>
            ) : (
              <span className="toolbar-slot placeholder-chip" aria-hidden="true" />
            )}
            {activeOrganization && canUseInstructorPanel ? (
              <button
                className={instructorPanelOpen ? 'active context-chip' : 'secondary context-chip'}
                type="button"
                onClick={() => setInstructorPanelOpen((current) => !current)}
              >
                <ShieldCheck size={14} /> Classroom
              </button>
            ) : (
              <span className="toolbar-slot placeholder-chip" aria-hidden="true" />
            )}
          </div>
        </div>
        <div className="preference-actions" aria-label="Display preferences">
          <button className={themePreference === 'system' ? 'active' : 'secondary'} type="button" onClick={() => setThemePreference('system')}>System</button>
          <button className={themePreference === 'light' ? 'active' : 'secondary'} type="button" onClick={() => setThemePreference('light')}>Light</button>
          <button className={themePreference === 'dark' ? 'active' : 'secondary'} type="button" onClick={() => setThemePreference('dark')}>Dark</button>
          <button
            className={colorModePreference === 'colorblind' ? 'active' : 'secondary'}
            type="button"
            onClick={() => setColorModePreference((current) => current === 'colorblind' ? 'default' : 'colorblind')}
          >
            Color-safe
          </button>
        </div>
      </section>

      {instructorPanelOpen && activeOrganization && (
        <section className="instructor-panel panel surface-grid">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Classroom</p>
              <h2><ShieldCheck size={18} /> {activeOrganization.name}</h2>
              <p className="helper-text">{orgMembers.length} member{orgMembers.length === 1 ? '' : 's'} · {pendingInvitations.length} pending invite{pendingInvitations.length === 1 ? '' : 's'}</p>
            </div>
            <button
              className="ghost"
              type="button"
              onClick={() => setInstructorPanelOpen(false)}
            >
              Close
            </button>
          </div>
          <div className="classroom-tabs" role="tablist" aria-label="Classroom tools">
            <button
              className={classroomTab === 'people' ? 'active' : 'secondary'}
              type="button"
              role="tab"
              aria-selected={classroomTab === 'people'}
              onClick={() => setClassroomTab('people')}
            >
              People
            </button>
            <button
              className={classroomTab === 'invitations' ? 'active' : 'secondary'}
              type="button"
              role="tab"
              aria-selected={classroomTab === 'invitations'}
              onClick={() => setClassroomTab('invitations')}
            >
              Invitations
            </button>
          </div>
          {classroomTab === 'invitations' && canInviteOrgMembers && (
            <div className="invite-workflow">
              <form className="invite-form" onSubmit={inviteOrgMember}>
                <label className="file-path-field" htmlFor="invite-email">
                  <span>Email</span>
                  <input
                    id="invite-email"
                    value={inviteEmailDraft}
                    onChange={(event) => setInviteEmailDraft(event.target.value)}
                    placeholder="student@example.com"
                    type="email"
                  />
                </label>
                <label className="file-path-field" htmlFor="invite-role">
                  <span>Role</span>
                  <select id="invite-role" value={canManageOrgMembers ? inviteRoleDraft : 'student'} onChange={(event) => setInviteRoleDraft(event.target.value as CloudOrgInvitation['role'])}>
                    <option value="student">Student</option>
                    {canManageOrgMembers && <option value="instructor">Instructor</option>}
                  </select>
                </label>
                <button type="submit"><Send size={16} /> Send invite</button>
              </form>
              <p className="helper-text">Hafa Code emails the invitation when email is configured, and keeps the link here as a backup. New students create a personal account first, then join this workspace.</p>
              {lastInviteUrl && (
                <label className="file-path-field invite-link-field" htmlFor="last-invite-url">
                  <span>Latest invite link</span>
                  <input id="last-invite-url" readOnly value={lastInviteUrl} onFocus={(event) => event.currentTarget.select()} />
                </label>
              )}
            </div>
          )}
          {classroomTab === 'invitations' && canInviteOrgMembers && orgInvitations.length > 0 && (
            <div className="pending-invite-list" aria-label="Pending invitations">
              <div className="section-row">
                <strong>Invitations</strong>
                <small>{pendingInvitations.length} pending</small>
              </div>
              {orgInvitations.slice(0, 6).map((invitation) => (
                <div key={invitation.id ?? invitation.token} className="invite-row">
                  <div>
                    <strong>{invitation.email}</strong>
                    <small>{invitation.role}{invitation.accepted_at ? ' · accepted' : ' · pending'}</small>
                  </div>
                  {!invitation.accepted_at && (
                    <div className="invite-actions">
                      <button className="secondary compact" type="button" onClick={() => copyInvitationLink(invitation)}>
                        <Copy size={14} /> Copy link
                      </button>
                      <button className="secondary compact" type="button" onClick={() => resendInvitation(invitation)}>
                        <Send size={14} /> Resend
                      </button>
                      <button className="danger compact" type="button" onClick={() => revokeInvitation(invitation)}>
                        <Trash2 size={14} /> Revoke
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {classroomTab === 'people' && (
          <div className="people-panel">
            <label className="classroom-search" htmlFor="member-search">
              <Search size={16} />
              <input
                id="member-search"
                value={memberSearchDraft}
                onChange={(event) => setMemberSearchDraft(event.target.value)}
                placeholder="Search people by name, email, or role"
              />
            </label>
            <div className="member-list" aria-label="Organization members">
            {filteredOrgMembers.length === 0 && (
              <p className="empty-project-list">{orgMembers.length === 0 ? 'No members in this organization yet.' : 'No people match that search.'}</p>
            )}
            {filteredOrgMembers.map((member) => {
              const memberProjects = library.projects.filter((candidate) => candidate.organizationId === activeOrganizationId && candidate.owner?.id === member.id)
              const isCurrentMember = member.id === user?.id
              return (
                <article key={member.id} className="member-row">
                  <div className="member-main">
                    <strong>{member.full_name}</strong>
                    <small>{member.email}</small>
                    <div className="member-badges">
                      <span>{member.organization_role}</span>
                      {isCurrentMember && <span>You</span>}
                    </div>
                  </div>
                  <span className="member-count">{memberProjects.length} project{memberProjects.length === 1 ? '' : 's'}</span>
                  {canManageOrgMembers && !isCurrentMember ? (
                    <div className="member-actions">
                      <select
                        aria-label={`Role for ${member.full_name}`}
                        className="member-role-select"
                        value={member.organization_role}
                        onChange={(event) => updateOrgMemberRole(member, event.target.value as CloudOrgMember['organization_role'])}
                      >
                        <option value="student">Student</option>
                        <option value="instructor">Instructor</option>
                        <option value="owner">Owner</option>
                      </select>
                      <button className="danger compact" type="button" onClick={() => removeOrgMember(member)}>
                        <Trash2 size={14} /> Remove
                      </button>
                    </div>
                  ) : (
                    <div className="member-actions member-actions-readonly">
                      <span>{isCurrentMember ? 'Signed in as you' : 'Managed by owner'}</span>
                    </div>
                  )}
                  <div className="member-project-list">
                    {memberProjects.slice(0, 4).map((memberProject) => (
                      <button key={memberProject.id} className="secondary compact" type="button" onClick={() => setActiveProject(memberProject.id)}>
                        {memberProject.title}
                      </button>
                    ))}
                  </div>
                </article>
              )
            })}
            </div>
          </div>
          )}
        </section>
      )}
      </>
      )}

      <section className="mobile-home-panel panel surface-grid">
        <div>
          <p className="eyebrow">Welcome</p>
          <h2>Start building in the browser</h2>
          <p className="helper-text">
            Pick up {project.title || 'your project'}, create something new, or jump straight into the runner.
          </p>
        </div>
        <div className="mobile-home-stats" aria-label="Project summary">
          <span><strong>{activeContextProjects.length}</strong> active</span>
          <span><strong>{archivedContextProjects.length}</strong> archived</span>
          <span><strong>{checkpoints.length}</strong> checkpoints</span>
        </div>
        <div className="mobile-home-create" aria-label="Create new project">
          {(['ruby', 'javascript', 'web'] as ProjectKind[]).map((kind) => (
            <button key={kind} className="secondary compact" onClick={() => addProject(kind)}>
              <Plus size={14} /> {kind === 'javascript' ? 'JS' : kind === 'web' ? 'Web' : 'Ruby'}
            </button>
          ))}
        </div>
        <div className="mobile-home-actions">
          <button type="button" onClick={() => setMobileTab('code')}><BookOpen size={16} /> Continue coding</button>
          <button className="secondary" type="button" onClick={runFromMobileCode}>
            {project.kind === 'web' ? <Globe size={16} /> : <Play size={16} />}
            {project.kind === 'web' ? 'Open preview' : 'Run project'}
          </button>
          <button className="secondary" type="button" onClick={() => setMobileTab('projects')}><Files size={16} /> Projects</button>
        </div>
      </section>

      <div className="layout-grid">
        <aside className="panel project-sidebar surface-grid">
          <div className="sidebar-header">
            <h2><Files size={18} /> Projects</h2>
            <div className="sidebar-tools">
              <span>{showArchived ? archivedContextProjects.length : activeContextProjects.length}</span>
              <button
                className="ghost icon-button desktop-only"
                type="button"
                aria-label="Collapse project sidebar"
                onClick={() => setSidebarCollapsed(true)}
              >
                <PanelLeftClose size={17} />
              </button>
            </div>
          </div>
          <button
            className="ghost collapsed-sidebar-button"
            type="button"
            aria-label="Expand project sidebar"
            onClick={() => setSidebarCollapsed(false)}
          >
            <PanelLeftOpen size={18} />
          </button>
          <details className="mobile-project-menu" open={mobileTab === 'projects' ? true : undefined}>
            <summary>
              <span>{project.title || 'Untitled Project'}</span>
              <small>{showArchived ? `${archivedContextProjects.length} archived` : `${activeContextProjects.length} active`}</small>
            </summary>
            <div className="mobile-project-content">
              <div className="project-view-toggle" aria-label="Project view">
                <button className={!showArchived ? 'active' : ''} type="button" onClick={() => setShowArchived(false)}>
                  Active <span>{activeContextProjects.length}</span>
                </button>
                <button className={showArchived ? 'active' : ''} type="button" onClick={() => setShowArchived(true)}>
                  Archived <span>{archivedContextProjects.length}</span>
                </button>
              </div>
              <div className="new-project-grid">
                {(['ruby', 'javascript', 'web'] as ProjectKind[]).map((kind) => (
                  <button key={kind} className="secondary compact" onClick={() => addProject(kind)}>
                    <Plus size={14} /> {kind === 'javascript' ? 'JS' : kind === 'web' ? 'Web' : 'Ruby'}
                  </button>
                ))}
              </div>
              <div className="project-list">
                {visibleProjects.length === 0 && (
                  <p className="empty-project-list">{showArchived ? 'No archived projects yet.' : 'No active projects yet.'}</p>
                )}
                {visibleProjects.map((candidate) => (
                  <button
                    key={candidate.id}
                    className={`project-card ${candidate.id === project.id ? 'active' : ''}`}
                    onClick={() => setActiveProject(candidate.id)}
                  >
                    <span>{candidate.title || 'Untitled Project'}</span>
                    <small>
                      {kindLabels[candidate.kind]}
                      {activeOrganizationId && projectOwnerLabel(candidate, user?.id) ? ` · ${projectOwnerLabel(candidate, user?.id)}` : ''}
                    </small>
                  </button>
                ))}
              </div>
            </div>
          </details>
          <div className="sidebar-content">
            <p className="sidebar-note">{isSignedIn ? `Signed in${user?.full_name ? ` as ${user.full_name}` : ''}. Projects sync to your account.` : 'Everything is private to this browser until you export, share, or sign in.'}</p>
            <div className="project-view-toggle" aria-label="Project view">
              <button className={!showArchived ? 'active' : ''} type="button" onClick={() => setShowArchived(false)}>
                Active <span>{activeContextProjects.length}</span>
              </button>
              <button className={showArchived ? 'active' : ''} type="button" onClick={() => setShowArchived(true)}>
                Archived <span>{archivedContextProjects.length}</span>
              </button>
            </div>
          <div className="new-project-grid">
            {(['ruby', 'javascript', 'web'] as ProjectKind[]).map((kind) => (
              <button key={kind} className="secondary compact" onClick={() => addProject(kind)}>
                <Plus size={14} /> {kind === 'javascript' ? 'JS' : kind === 'web' ? 'Web' : 'Ruby'}
              </button>
            ))}
          </div>
          <div className="project-list">
            {visibleProjects.length === 0 && (
              <p className="empty-project-list">{showArchived ? 'No archived projects yet.' : 'No active projects yet.'}</p>
            )}
            {visibleProjects.map((candidate) => (
              <button
                key={candidate.id}
                className={`project-card ${candidate.id === project.id ? 'active' : ''}`}
                onClick={() => setActiveProject(candidate.id)}
              >
                <span>{candidate.title || 'Untitled Project'}</span>
                <small>
                  {kindLabels[candidate.kind]}
                  {activeOrganizationId && projectOwnerLabel(candidate, user?.id) ? ` · ${projectOwnerLabel(candidate, user?.id)}` : ''}
                </small>
              </button>
            ))}
          </div>
          </div>
        </aside>

        <section className="main-workspace">
          <div className="project-toolbar panel surface-grid">
            <div className="title-field">
              <label htmlFor="project-title">Project name</label>
              <input id="project-title" value={project.title} onChange={(event) => renameProject(event.target.value)} disabled={!canEditProject} />
              <small>
                {isSignedIn ? 'Autosaved to cloud + local backup' : 'Autosaved locally'}
                {activeOrganizationId && currentProjectOwnerLabel ? ` · by ${currentProjectOwnerLabel}` : ''}
                {isArchived(project) ? ' · archived' : ''}
                {!canEditProject ? ' · read-only instructor view' : ''}
                {' · updated '}
                {formatUpdatedAt(project.updatedAt)}
              </small>
              <div className="visibility-section">
                <div className="visibility-row">
                  <span>Visibility</span>
                  <div className="visibility-control" aria-label="Project visibility">
                    {availableVisibilityOptions(activeOrganizationId).map((visibility) => (
                      <button
                        key={visibility}
                        className={project.visibility === visibility ? 'active' : ''}
                        type="button"
                        title={visibilityDescriptions[visibility]}
                        aria-label={`${visibilityLabels[visibility]}: ${visibilityDescriptions[visibility]}`}
                        disabled={!canEditProject}
                        onClick={() => updateProjectVisibility(visibility)}
                      >
                        {visibilityLabels[visibility]}
                      </button>
                    ))}
                  </div>
                </div>
                <small className="visibility-help">{visibilityDescriptions[project.visibility]}</small>
              </div>
            </div>
            <div className="toolbar-actions">
              <details
                ref={checkpointMenuRef}
                className="checkpoint-menu"
                open={checkpointMenuIsOpen}
                onToggle={(event) => {
                  if (mobileTab !== 'history') setCheckpointMenuOpen(event.currentTarget.open)
                }}
              >
                <summary>
                  <History size={16} />
                  <span>History</span>
                  <small>{checkpoints.length}</small>
                </summary>
                <div className="checkpoint-popover">
                  <div className="checkpoint-popover-header">
                    <strong>Checkpoints</strong>
                    <button className="secondary compact" type="button" onClick={saveCheckpoint} disabled={!canEditProject}>
                      <Save size={14} /> Save
                    </button>
                  </div>
                  <div className="checkpoint-list">
                    {checkpoints.length === 0 ? (
                      <p className="empty-project-list">No checkpoints yet.</p>
                    ) : checkpoints.slice(0, 5).map((checkpoint) => (
                      <button
                        key={checkpoint.id}
                        className="checkpoint-card secondary"
                        type="button"
                        onClick={() => {
                          setCheckpointMenuOpen(false)
                          requestRestoreCheckpoint(checkpoint)
                        }}
                        title={`Restore ${checkpoint.title}`}
                      >
                        <span>{checkpoint.title}</span>
                        <small>{formatCheckpointTime(checkpoint.createdAt)}</small>
                      </button>
                    ))}
                  </div>
                </div>
              </details>
              {isArchived(project) ? (
                <button className="secondary" onClick={restoreProject} disabled={!canEditProject}><RotateCcw size={16} /> Restore</button>
              ) : (
                <button className="secondary" onClick={requestArchiveProject} disabled={!canEditProject || activeContextProjects.length <= 1}><Archive size={16} /> Archive</button>
              )}
              <button className="secondary" onClick={cloneProject}><Copy size={16} /> Duplicate</button>
              <button className="danger" onClick={requestDeleteProject} disabled={!canEditProject}><Trash2 size={16} /> Delete</button>
            </div>
          <button className="secondary mobile-project-actions-button" onClick={() => setProjectActionsOpen(true)}>
            <MoreHorizontal size={16} /> Actions
          </button>
          </div>

          <div className="workspace">
            <section className="panel editor-panel">
              <div className="file-tabs">
                <div className="file-tab-list">
                  {project.files.map((file) => (
                    <button key={file.path} className={file.path === activeFile.path ? 'active' : ''} onClick={() => setActivePath(file.path)}>
                      {file.path}
                      {file.path === project.entryPath && <span className="entry-dot">entry</span>}
                    </button>
                  ))}
                </div>
                <button
                  className="ghost icon-button"
                  type="button"
                  aria-label="Create file"
                  title="Create file"
                  onClick={openCreateFileDialog}
                  disabled={!canEditProject}
                >
                  <FilePlus2 size={17} />
                </button>
                <button
                  className="ghost icon-button editor-focus-button"
                  type="button"
                  aria-label={editorExpanded ? 'Exit editor focus mode' : 'Expand code editor'}
                  title={editorExpanded ? 'Exit focus' : 'Focus editor'}
                  onClick={() => setEditorExpanded((current) => !current)}
                >
                  {editorExpanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
                </button>
              </div>
              <details className="file-browser" aria-label="Project files">
                <summary>
                  <span><Files size={15} /> Files</span>
                  <small>{project.files.length} files · entry {project.entryPath}</small>
                </summary>
                <div className="file-browser-actions">
                  <button className="secondary compact" type="button" onClick={openCreateFileDialog} disabled={!canEditProject}>
                    <FilePlus2 size={14} /> New file
                  </button>
                </div>
                <div className="file-browser-list">
                  {project.files.map((file) => (
                    <div key={file.path} className={`file-row ${file.path === activeFile.path ? 'active' : ''}`}>
                      <button type="button" className="file-row-main" onClick={() => setActivePath(file.path)}>
                        <span>{file.path}</span>
                        <small>{formatFileLanguage(file)}{file.path === project.entryPath ? ' · entry' : ''}</small>
                      </button>
                      <div className="file-row-actions">
                        {file.path !== project.entryPath && (
                          <button className="ghost icon-button" type="button" aria-label={`Set ${file.path} as entry`} title="Set as entry" onClick={() => setEntryPath(file)} disabled={!canEditProject}>
                            <Check size={15} />
                          </button>
                        )}
                        <button className="ghost icon-button" type="button" aria-label={`Rename ${file.path}`} title="Rename" onClick={() => openRenameFileDialog(file)} disabled={!canEditProject}>
                          <Pencil size={15} />
                        </button>
                        <button className="ghost icon-button" type="button" aria-label={`Duplicate ${file.path}`} title="Duplicate" onClick={() => openDuplicateFileDialog(file)} disabled={!canEditProject}>
                          <Copy size={15} />
                        </button>
                        <button className="ghost icon-button danger-icon" type="button" aria-label={`Delete ${file.path}`} title="Delete" onClick={() => deleteFile(file)} disabled={!canEditProject || project.files.length <= 1}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
              <div className="mobile-code-runbar">
                <button type="button" onClick={runFromMobileCode} disabled={project.kind !== 'web' && !entryFile.content.trim()}>
                  {project.kind === 'web' ? <Globe size={16} /> : <Play size={16} />}
                  {project.kind === 'web' ? 'Open preview' : `Run ${project.kind === 'ruby' ? 'Ruby' : 'JS'}`}
                </button>
              </div>
              <MonacoEditor
                height="var(--workspace-pane-height)"
                language={languageForFile(activeFile)}
                theme="vs-dark"
                value={activeFile.content}
                loading={<div className="editor-loading"><Loader2 className="spin" size={20} /> Loading editor...</div>}
                onChange={(value) => updateActiveFile(value ?? '')}
                options={{
                  readOnly: !canEditProject,
                  minimap: { enabled: false },
                  fontSize: editorFontSize,
                  tabSize: 2,
                  insertSpaces: true,
                  wordWrap: 'on',
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  padding: { top: 16, bottom: 16 },
                }}
              />
            </section>

            {project.kind === 'web'
              ? <WebPreview key={project.id} files={project.files} entryPath={project.entryPath} />
              : <RunnerPanel key={`${project.id}:${project.entryPath}`} project={project} entryFile={entryFile} />}
          </div>
        </section>
      </div>

      <nav className="mobile-bottom-nav" aria-label="Workspace sections">
        <button className={mobileTab === 'home' ? 'active' : ''} type="button" onClick={() => setMobileTab('home')}>
          <Layers3 size={18} />
          <span>Home</span>
        </button>
        <button className={mobileTab === 'projects' ? 'active' : ''} type="button" onClick={() => setMobileTab('projects')}>
          <Files size={18} />
          <span>Projects</span>
        </button>
        <button className={mobileTab === 'code' ? 'active' : ''} type="button" onClick={() => setMobileTab('code')}>
          <BookOpen size={18} />
          <span>Code</span>
        </button>
        <button className={mobileTab === 'output' ? 'active' : ''} type="button" onClick={() => setMobileTab('output')}>
          {project.kind === 'web' ? <Globe size={18} /> : <Terminal size={18} />}
          <span>{project.kind === 'web' ? 'Preview' : 'Output'}</span>
        </button>
        <button className={mobileTab === 'history' ? 'active' : ''} type="button" onClick={() => setMobileTab('history')}>
          <History size={18} />
          <span>History</span>
        </button>
      </nav>

      {fileDialog && (
        <div className="modal-backdrop" role="presentation" onClick={() => {
          setFileDialog(null)
          setFileDialogError('')
        }}>
          <section className="modal-sheet file-dialog-sheet" role="dialog" aria-modal="true" aria-labelledby="file-dialog-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Workspace file</p>
                <h2 id="file-dialog-title">
                  {fileDialog.mode === 'create' ? 'Create file' : fileDialog.mode === 'rename' ? 'Rename file' : 'Duplicate file'}
                </h2>
              </div>
              <button className="ghost icon-button" aria-label="Close file dialog" onClick={() => {
                setFileDialog(null)
                setFileDialogError('')
              }}>
                <X size={18} />
              </button>
            </div>
            <label className="file-path-field" htmlFor="file-path-input">
              <span>Path</span>
              <input
                id="file-path-input"
                value={fileDialog.path}
                autoFocus
                onChange={(event) => {
                  setFileDialog((current) => current ? { ...current, path: event.target.value } : current)
                  setFileDialogError('')
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') submitFileDialog()
                }}
                placeholder="lib/helper.rb"
              />
            </label>
            {fileDialogError && <p className="form-error" role="alert">{fileDialogError}</p>}
            <p className="helper-text">Use a simple filename like `helper.rb`, `about.html`, or `styles.css`. Add folders later with paths like `assets/logo.svg`.</p>
            <div className="confirm-actions">
              <button className="secondary" onClick={() => {
                setFileDialog(null)
                setFileDialogError('')
              }}>Cancel</button>
              <button onClick={submitFileDialog}>
                {fileDialog.mode === 'create' ? 'Create file' : fileDialog.mode === 'rename' ? 'Rename file' : 'Duplicate file'}
              </button>
            </div>
          </section>
        </div>
      )}

      {shareDialog && (
        <div className="modal-backdrop" role="presentation" onClick={() => setShareDialog(null)}>
          <section className="modal-sheet share-sheet" role="dialog" aria-modal="true" aria-labelledby="share-dialog-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Snapshot share</p>
                <h2 id="share-dialog-title">Copy project link</h2>
              </div>
              <button className="ghost icon-button" aria-label="Close share dialog" onClick={() => setShareDialog(null)}>
                <X size={18} />
              </button>
            </div>
            <p className="helper-text">
              {shareDialog.mode === 'server'
                ? 'This link imports a server snapshot of the project.'
                : 'The server share could not be created, so this offline link carries a copy in the URL.'}
            </p>
            {shareDialog.error && <p className="form-error">Server share failed: {shareDialog.error}</p>}
            <label className="file-path-field" htmlFor="share-url">
              <span>Share URL</span>
              <input id="share-url" readOnly value={shareDialog.url} onFocus={(event) => event.currentTarget.select()} />
            </label>
            <div className="confirm-actions">
              <button className="secondary" type="button" onClick={() => setShareDialog(null)}>Done</button>
              <button type="button" onClick={async () => {
                const copied = await writeClipboardText(shareDialog.url)
                setShareDialog((current) => current ? { ...current, copied } : current)
                setNotice(copied ? 'Share link copied.' : 'Clipboard blocked. Select the link to copy it.')
              }}>
                <Copy size={16} /> {shareDialog.copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
          </section>
        </div>
      )}

      {orgCreateOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setOrgCreateOpen(false)}>
          <section className="modal-sheet" role="dialog" aria-modal="true" aria-labelledby="org-dialog-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Organization</p>
                <h2 id="org-dialog-title">Create workspace</h2>
              </div>
              <button className="ghost icon-button" aria-label="Close organization dialog" onClick={() => setOrgCreateOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <label className="file-path-field" htmlFor="org-name">
              <span>Name</span>
              <input
                id="org-name"
                value={orgNameDraft}
                autoFocus
                onChange={(event) => setOrgNameDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') createOrganization()
                }}
                placeholder="Code School of Guam"
              />
            </label>
            <p className="helper-text">Platform admins and mentors create organization workspaces, then invite instructors and students.</p>
            <div className="confirm-actions">
              <button className="secondary" type="button" onClick={() => setOrgCreateOpen(false)}>Cancel</button>
              <button type="button" onClick={createOrganization}>Create workspace</button>
            </div>
          </section>
        </div>
      )}

      {projectActionsOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setProjectActionsOpen(false)}>
          <section className="modal-sheet project-actions-sheet" role="dialog" aria-modal="true" aria-labelledby="project-actions-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Project</p>
                <h2 id="project-actions-title">Actions</h2>
              </div>
              <button className="ghost icon-button" aria-label="Close project actions" onClick={() => setProjectActionsOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-action-grid">
              {isArchived(project) ? (
                <button className="secondary" onClick={() => {
                  setProjectActionsOpen(false)
                  restoreProject()
                }}><RotateCcw size={16} /> Restore</button>
              ) : (
                <button className="secondary" onClick={requestArchiveProject} disabled={activeContextProjects.length <= 1}><Archive size={16} /> Archive</button>
              )}
              <button className="secondary" onClick={cloneProject}><Copy size={16} /> Duplicate</button>
              <button className="danger" onClick={requestDeleteProject}><Trash2 size={16} /> Delete</button>
            </div>
          </section>
        </div>
      )}

      {confirmAction && (
        <div className="modal-backdrop" role="presentation" onClick={() => {
          setConfirmAction(null)
          setPendingCheckpoint(null)
        }}>
          <section className="modal-sheet confirm-sheet" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">{confirmAction === 'delete' ? 'Delete project' : confirmAction === 'checkpoint' ? 'Restore checkpoint' : 'Archive project'}</p>
                <h2 id="confirm-title">
                  {confirmAction === 'delete' ? 'Delete this project?' : confirmAction === 'checkpoint' ? 'Restore this checkpoint?' : 'Archive this project?'}
                </h2>
              </div>
              <button className="ghost icon-button" aria-label="Cancel" onClick={() => {
                setConfirmAction(null)
                setPendingCheckpoint(null)
              }}>
                <X size={18} />
              </button>
            </div>
            <p id="confirm-description" className="confirm-copy">
              {confirmAction === 'delete'
                ? `"${project.title || 'Untitled Project'}" will be removed from this browser${isSignedIn && isCloudProjectId(project.id) ? ' and your cloud account' : ''}.`
                : confirmAction === 'checkpoint'
                  ? `Your current code will be replaced with "${pendingCheckpoint?.title || 'this checkpoint'}". Save a checkpoint first if you want to keep the current version.`
                : `"${project.title || 'Untitled Project'}" will move out of your active project list. You can restore it from Archived.`}
            </p>
            <div className="confirm-actions">
              <button className="secondary" onClick={() => {
                setConfirmAction(null)
                setPendingCheckpoint(null)
              }}>Cancel</button>
              <button className={confirmAction === 'delete' ? 'danger' : ''} onClick={confirmProjectAction}>
                {confirmAction === 'delete' ? <Trash2 size={16} /> : confirmAction === 'checkpoint' ? <RotateCcw size={16} /> : <Archive size={16} />}
                {confirmAction === 'delete' ? 'Delete project' : confirmAction === 'checkpoint' ? 'Restore checkpoint' : 'Archive project'}
              </button>
            </div>
          </section>
        </div>
      )}

      <footer className="oss-footer" aria-label="Open source project">
        <span>Hafa Code is open source.</span>
        <a href="https://github.com/Shimizu-Technology/hafa-code" target="_blank" rel="noreferrer">
          View the code on GitHub
        </a>
      </footer>
    </main>
  )
}
