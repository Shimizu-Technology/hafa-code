import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SignInButton, SignUpButton } from '@clerk/clerk-react'
import {
  BookOpen,
  Cloud,
  Copy,
  Download,
  Dumbbell,
  Files,
  Globe,
  Import,
  Layers3,
  Loader2,
  Play,
  Plus,
  Rocket,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  UserPlus,
} from 'lucide-react'
import './App.css'
import {
  PROJECT_KINDS,
  defaultEntryPath,
  inferFileLanguage,
  projectKindDefinition,
  type ProjectFile,
  type ProjectCheckpoint,
  type ProjectKind,
  type ProjectVisibility,
  type SavedProject,
} from './lib/codeRunner'
import {
  createLocalCheckpoint,
  createConflictCopy,
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
import { api, type CloudAuditEvent, type CloudOrgInvitation, type CloudOrgMember } from './lib/api'
import { hasClerkPublishableKey } from './lib/clerk'
import { AuthControls } from './components/AuthControls'
import { ProjectFeedback } from './components/ProjectFeedback'
import { LanguageGuide } from './components/LanguageGuide'
import { PracticeLab } from './components/PracticeLab'
import { PracticeSessionPanel } from './components/PracticeSessionPanel'
import { EditorWorkspace } from './components/EditorWorkspace'
import { MobileWorkspaceNav } from './components/MobileWorkspaceNav'
import { ProjectSidebar } from './components/ProjectSidebar'
import { ProjectToolbar } from './components/ProjectToolbar'
import { WorkspaceDialogs, type ShareDialogState } from './components/WorkspaceDialogs'
import type { LanguageGuideTopic } from './lib/languageGuides'
import { evaluatePracticeChallenge, practiceChallengeById, type PracticeChallenge, type PracticeCheckResult } from './lib/practiceLab'
import {
  completePracticeChallenge,
  completedPracticeChallengeIds,
  linkPracticeProject,
  practiceChallengeIdForProject,
  preservePracticeConflictLinks,
  remapPendingPracticeCheck,
  replacePracticeProjectId,
  type PendingPracticeCheck,
} from './lib/practiceProgress'
import type { RunnerOutcome } from './lib/runnerOutcome'
import {
  clearProjectPendingCloudSync,
  markProjectPendingCloudSync,
  pendingCloudProjectIds,
  replacePendingCloudProjectId,
} from './lib/cloudSyncStorage'
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
import { useModalFocus } from './hooks/useModalFocus'
import {
  PROJECT_FILE_LIMIT,
  canViewProjectFeedback,
  canAddWorkspaceFile,
  clearHashParam,
  formatCheckpointTime,
  formatUpdatedAt,
  invitationUrl,
  isArchived,
  isCloudProjectId,
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
  visibilityLabels,
  writeClipboardText,
  type ClassroomTab,
  type ConfirmAction,
  type FileDialogState,
  type MobileTab,
} from './lib/workspace'

type CloudSaveStatus = 'pending' | 'saving' | 'saved' | 'offline' | 'failed' | 'conflict'

const CLOUD_SAVE_RETRY_DELAYS = [1_500, 3_000, 6_000]

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
  const [auditEvents, setAuditEvents] = useState<CloudAuditEvent[]>([])
  const [inviteEmailDraft, setInviteEmailDraft] = useState('')
  const [inviteRoleDraft, setInviteRoleDraft] = useState<CloudOrgInvitation['role']>('student')
  const [schoolYearDraft, setSchoolYearDraft] = useState('')
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
  const [languageGuideOpen, setLanguageGuideOpen] = useState(false)
  const [practiceLabOpen, setPracticeLabOpen] = useState(false)
  const [practiceResult, setPracticeResult] = useState<PracticeCheckResult | null>(null)
  const [practiceChecking, setPracticeChecking] = useState(false)
  const [completedPracticeIds, setCompletedPracticeIds] = useState(() => completedPracticeChallengeIds())
  const [hasImportedServerShare, setHasImportedServerShare] = useState(() => !new URLSearchParams(window.location.hash.replace(/^#/, '')).has('share'))
  const [hasLoadedCloudProjects, setHasLoadedCloudProjects] = useState(false)
  const [cloudSaveStatuses, setCloudSaveStatuses] = useState<Record<string, CloudSaveStatus>>({})
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const checkpointMenuRef = useRef<HTMLDetailsElement | null>(null)
  const syncTimersRef = useRef<Map<string, number>>(new Map())
  const syncingProjectIdsRef = useRef<Set<string>>(new Set())
  const syncRetryCountsRef = useRef<Map<string, number>>(new Map())
  const syncedProjectVersionsRef = useRef<Map<string, string>>(new Map())
  const syncCloudProjectRef = useRef<(projectId: string) => Promise<void>>(async () => {})
  const replacingCloudIdRef = useRef(false)
  const acceptingInvitationTokenRef = useRef<string | null>(null)
  const libraryRef = useRef(library)
  const checkpointRequestIdRef = useRef(0)
  const pendingPracticeCheckRef = useRef<PendingPracticeCheck | null>(null)
  const { isSignedIn, isLoading: authLoading, user, organizations, syncSession } = useAuthContext()
  const cloudEnabled = hasClerkPublishableKey(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)
  const editorFontSize = useResponsiveEditorFontSize()
  const systemDark = useSystemDarkMode()
  const clearPendingPracticeCheck = useCallback(() => {
    pendingPracticeCheckRef.current = null
    setPracticeChecking(false)
    setPracticeResult(null)
  }, [])
  const fileDialogRef = useModalFocus<HTMLElement>(Boolean(fileDialog), () => {
    setFileDialog(null)
    setFileDialogError('')
  })
  const shareDialogRef = useModalFocus<HTMLElement>(Boolean(shareDialog), () => setShareDialog(null))
  const orgDialogRef = useModalFocus<HTMLElement>(orgCreateOpen, () => setOrgCreateOpen(false))
  const projectActionsDialogRef = useModalFocus<HTMLElement>(projectActionsOpen, () => setProjectActionsOpen(false))
  const confirmDialogRef = useModalFocus<HTMLElement>(Boolean(confirmAction), () => {
    setConfirmAction(null)
    setPendingCheckpoint(null)
  })

  const project = library.projects.find((candidate) => candidate.id === library.activeProjectId) ?? library.projects[0]
  const currentPracticeChallenge = useMemo(
    () => practiceChallengeById(practiceChallengeIdForProject(project.id)),
    [project.id],
  )
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
        school_year: null,
        archived_at: null,
      }
    : null
  const activeOrganization = organizations.find((organization) => String(organization.id) === activeOrganizationId) ?? optimisticInvitationOrganization
  const workspaceIsSettling = cloudEnabled && authLoading
  const canUseInstructorPanel = activeOrganization?.role === 'instructor' || activeOrganization?.role === 'owner' || user?.role === 'admin'
  const canInviteOrgMembers = activeOrganization?.role === 'instructor' || activeOrganization?.role === 'owner' || user?.role === 'admin'
  const canManageOrgMembers = activeOrganization?.role === 'owner' || user?.role === 'admin'
  const canCreateOrganization = user?.role === 'admin' || user?.role === 'mentor'
  const workspaceArchived = Boolean(activeOrganization?.archived_at)
  const ownsProject = !project.owner || project.owner.id === user?.id
  const canEditProject = (!isSignedIn || ownsProject) && !workspaceArchived
  const currentProjectOwnerLabel = projectOwnerLabel(project, user?.id)
  const pendingInvitations = orgInvitations.filter((invitation) => !invitation.accepted_at)
  const memberSearch = memberSearchDraft.trim().toLowerCase()
  const filteredOrgMembers = orgMembers.filter((member) => {
    if (!memberSearch) return true
    return [member.full_name, member.email, member.organization_role]
      .some((value) => value.toLowerCase().includes(memberSearch))
  })
  const inviteRequiresAuth = Boolean(pendingInvitationToken && pendingInvitation && !isSignedIn)
  const currentCloudSaveStatus = cloudSaveStatuses[project.id]
  const cloudSaveLabel = currentCloudSaveStatus === 'saving'
    ? 'Saving to cloud'
    : currentCloudSaveStatus === 'pending'
      ? 'Waiting to save'
      : currentCloudSaveStatus === 'offline'
        ? 'Offline · local copy safe'
      : currentCloudSaveStatus === 'failed'
        ? 'Cloud save failed · local copy safe'
        : currentCloudSaveStatus === 'conflict'
          ? 'Save conflict · local copy safe'
          : 'Saved to cloud + local backup'
  const canAccessProjectFeedback = canViewProjectFeedback(project, isSignedIn, user?.id, canUseInstructorPanel)
  const resolvedTheme = themePreference === 'system'
    ? (systemDark ? 'dark' : 'light')
    : themePreference

  const updateCloudSaveStatus = useCallback((projectId: string, status: CloudSaveStatus) => {
    setCloudSaveStatuses((current) => current[projectId] === status ? current : { ...current, [projectId]: status })
  }, [])

  const scheduleCloudSave = useCallback((projectId: string, delay = 900) => {
    const existingTimer = syncTimersRef.current.get(projectId)
    if (existingTimer) window.clearTimeout(existingTimer)

    const timer = window.setTimeout(() => {
      syncTimersRef.current.delete(projectId)
      void syncCloudProjectRef.current(projectId)
    }, delay)
    syncTimersRef.current.set(projectId, timer)
  }, [])

  const syncCloudProject = useCallback(async (projectId: string) => {
    if (!isSignedIn || !hasLoadedCloudProjects) return
    if (!navigator.onLine) {
      updateCloudSaveStatus(projectId, 'offline')
      return
    }
    if (syncingProjectIdsRef.current.has(projectId)) {
      scheduleCloudSave(projectId, 150)
      return
    }

    const projectToSave = libraryRef.current.projects.find((candidate) => candidate.id === projectId)
    if (!projectToSave || (projectToSave.owner && projectToSave.owner.id !== user?.id)) return

    syncingProjectIdsRef.current.add(projectId)
    updateCloudSaveStatus(projectId, 'saving')

    const res = isCloudProjectId(projectId)
      ? await api.updateProject(projectToSave)
      : await api.createProject(projectToSave)

    syncingProjectIdsRef.current.delete(projectId)

    if (res.error || !res.data) {
      if (res.code === 'project_conflict') {
        syncRetryCountsRef.current.delete(projectId)
        const serverProject = res.conflictProject
        if (serverProject) {
          const conflictCopy = createConflictCopy(projectToSave)
          const currentLibrary = libraryRef.current
          preservePracticeConflictLinks(projectId, conflictCopy.id, serverProject.id)
          if (currentLibrary.activeProjectId === projectId) clearPendingPracticeCheck()
          const nextLibrary = {
            activeProjectId: currentLibrary.activeProjectId === projectId ? conflictCopy.id : currentLibrary.activeProjectId,
            projects: [
              conflictCopy,
              ...currentLibrary.projects.map((candidate) => candidate.id === projectId ? serverProject : candidate),
            ],
          }
          libraryRef.current = nextLibrary
          setLibrary(nextLibrary)
          if (currentLibrary.activeProjectId === projectId) setActivePath(conflictCopy.files[0].path)
          clearProjectPendingCloudSync(projectId)
          syncedProjectVersionsRef.current.set(serverProject.id, serverProject.updatedAt)
          markProjectPendingCloudSync(conflictCopy.id, conflictCopy.updatedAt)
          setCloudSaveStatuses((current) => {
            const next = { ...current }
            delete next[projectId]
            next[serverProject.id] = 'saved'
            next[conflictCopy.id] = 'pending'
            return next
          })
          scheduleCloudSave(conflictCopy.id, 0)
          setNotice('Another tab saved first. Your version is safe in a new private Conflict Copy, and the latest server version was restored.')
        } else {
          updateCloudSaveStatus(projectId, 'conflict')
          setNotice('Cloud save conflict: your local copy is safe. Export it before reloading.')
        }
        return
      }

      const retryCount = syncRetryCountsRef.current.get(projectId) ?? 0
      const retryDelay = CLOUD_SAVE_RETRY_DELAYS[retryCount]
      if (retryDelay) {
        syncRetryCountsRef.current.set(projectId, retryCount + 1)
        updateCloudSaveStatus(projectId, 'pending')
        scheduleCloudSave(projectId, retryDelay)
        setNotice(`Cloud save failed: ${res.error || 'unknown error'}. Your local copy is safe; retry ${retryCount + 1} of ${CLOUD_SAVE_RETRY_DELAYS.length} is scheduled.`)
      } else {
        updateCloudSaveStatus(projectId, 'failed')
        setNotice(`Cloud save failed after ${CLOUD_SAVE_RETRY_DELAYS.length} retries: ${res.error || 'unknown error'}. Your local copy is safe; edit again or reconnect to retry.`)
      }
      return
    }

    syncRetryCountsRef.current.delete(projectId)
    const savedProject = res.data
    const latestProject = libraryRef.current.projects.find((candidate) => candidate.id === projectId)
    const changedWhileSaving = Boolean(latestProject && latestProject.updatedAt !== projectToSave.updatedAt)
    const projectNeedingAnotherSave: SavedProject | null = latestProject && changedWhileSaving
      ? {
          ...latestProject,
          id: savedProject.id,
          owner: savedProject.owner,
          organization: savedProject.organization,
          organizationId: savedProject.organizationId,
          lockVersion: savedProject.lockVersion,
        }
      : null
    const nextProject = projectNeedingAnotherSave ?? savedProject
    const currentLibrary = libraryRef.current
    const nextLibrary = {
      activeProjectId: currentLibrary.activeProjectId === projectId ? nextProject.id : currentLibrary.activeProjectId,
      projects: currentLibrary.projects.map((candidate) => candidate.id === projectId ? nextProject : candidate),
    }
    libraryRef.current = nextLibrary
    setLibrary(nextLibrary)

    syncedProjectVersionsRef.current.set(savedProject.id, savedProject.updatedAt)
    if (savedProject.id !== projectId) {
      replacePracticeProjectId(projectId, savedProject.id)
      pendingPracticeCheckRef.current = remapPendingPracticeCheck(pendingPracticeCheckRef.current, projectId, savedProject.id)
      clearProjectPendingCloudSync(projectId)
      if (changedWhileSaving || projectNeedingAnotherSave) {
        replacePendingCloudProjectId(projectId, savedProject.id, (projectNeedingAnotherSave ?? latestProject ?? savedProject).updatedAt)
      }
      setCloudSaveStatuses((current) => {
        const next = { ...current }
        delete next[projectId]
        next[savedProject.id] = projectNeedingAnotherSave ? 'pending' : 'saved'
        return next
      })
    }

    if (projectNeedingAnotherSave) {
      markProjectPendingCloudSync(projectNeedingAnotherSave.id, projectNeedingAnotherSave.updatedAt)
      updateCloudSaveStatus(projectNeedingAnotherSave.id, 'pending')
      scheduleCloudSave(projectNeedingAnotherSave.id, 0)
    } else {
      clearProjectPendingCloudSync(savedProject.id)
      updateCloudSaveStatus(savedProject.id, 'saved')
    }
  }, [clearPendingPracticeCheck, hasLoadedCloudProjects, isSignedIn, scheduleCloudSave, updateCloudSaveStatus, user?.id])
  useEffect(() => {
    syncCloudProjectRef.current = syncCloudProject
  }, [syncCloudProject])

  const activateProject = (nextProject: SavedProject) => {
    clearPendingPracticeCheck()
    setLibrary((current) => ({ ...current, activeProjectId: nextProject.id }))
    setActivePath(nextProject.files[0].path)
    setCheckpointMenuOpen(false)
  }

  const activateFallbackProject = (projects: SavedProject[], archivedView = showArchived) => {
    clearPendingPracticeCheck()
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
        clearPendingPracticeCheck()
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
  }, [clearPendingPracticeCheck, hasImportedServerShare])

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
        const pendingIds = pendingCloudProjectIds()
        res.data.forEach((cloudProject) => {
          if (!pendingIds.has(cloudProject.id)) {
            syncedProjectVersionsRef.current.set(cloudProject.id, cloudProject.updatedAt)
          }
        })
        const merged = mergeCloudAndLocalProjects(res.data, libraryRef.current, activeOrganizationId)
        const nextProject = merged.projects.find((candidate) => candidate.id === merged.activeProjectId) ?? merged.projects[0]
        if (libraryRef.current.activeProjectId !== merged.activeProjectId) clearPendingPracticeCheck()
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
            clearPendingPracticeCheck()
            setLibrary((current) => ({ activeProjectId: orgProject.id, projects: [orgProject, ...current.projects] }))
            setActivePath(orgProject.files[0].path)
          }
        } else {
          setNotice('Signed in. Local projects will sync to your account as you edit.')
        }
      }
      setHasLoadedCloudProjects(true)
    })
  }, [activeOrganization, activeOrganizationId, clearPendingPracticeCheck, hasLoadedCloudProjects, isSignedIn])

  useEffect(() => {
    if (!isSignedIn || !hasLoadedCloudProjects || replacingCloudIdRef.current || !canEditProject) return
    if (syncedProjectVersionsRef.current.get(project.id) === project.updatedAt) {
      updateCloudSaveStatus(project.id, 'saved')
      return
    }

    markProjectPendingCloudSync(project.id, project.updatedAt)
    syncRetryCountsRef.current.delete(project.id)
    updateCloudSaveStatus(project.id, 'pending')
    scheduleCloudSave(project.id)
  }, [canEditProject, hasLoadedCloudProjects, isSignedIn, project, scheduleCloudSave, updateCloudSaveStatus])

  useEffect(() => {
    const syncTimers = syncTimersRef.current
    const flushPendingProjects = () => {
      pendingCloudProjectIds().forEach((projectId) => {
        if (libraryRef.current.projects.some((candidate) => candidate.id === projectId)) {
          void syncCloudProject(projectId)
        }
      })
    }
    const retryPendingProjects = () => {
      syncRetryCountsRef.current.clear()
      flushPendingProjects()
    }

    window.addEventListener('pagehide', flushPendingProjects)
    window.addEventListener('online', retryPendingProjects)
    return () => {
      window.removeEventListener('pagehide', flushPendingProjects)
      window.removeEventListener('online', retryPendingProjects)
      syncTimers.forEach((timer) => window.clearTimeout(timer))
      syncTimers.clear()
    }
  }, [syncCloudProject])

  const setActiveProject = (projectId: string) => {
    const nextProject = library.projects.find((candidate) => candidate.id === projectId)
    if (!nextProject) return
    activateProject(nextProject)
    setMobileTab('code')
  }

  const addProject = (kind: ProjectKind) => {
    if (workspaceArchived) {
      setNotice('This classroom is archived and read-only.')
      return
    }
    const starter = createProject(kind)
    const next = {
      ...starter,
      organizationId: activeOrganizationId,
      organization: activeOrganization,
      visibility: 'private' as ProjectVisibility,
    }
    clearPendingPracticeCheck()
    setLibrary((current) => ({ activeProjectId: next.id, projects: [next, ...current.projects] }))
    setActivePath(next.files[0].path)
    setShowArchived(false)
    setMobileTab('code')
    setNotice(`${next.title} created.`)
  }

  const tryGuideExample = (topic: LanguageGuideTopic) => {
    if (workspaceArchived) {
      setNotice('Restore this classroom before creating a practice project.')
      return
    }

    const starter = createProject(project.kind, topic.practiceProject.title)
    const practiceProject: SavedProject = {
      ...starter,
      organizationId: activeOrganizationId,
      organization: activeOrganization,
      visibility: 'private',
      entryPath: topic.practiceProject.entryPath,
      files: topic.practiceProject.files.map((file) => ({ ...file })),
    }
    clearPendingPracticeCheck()
    setLibrary((current) => ({ activeProjectId: practiceProject.id, projects: [practiceProject, ...current.projects] }))
    setActivePath(practiceProject.entryPath)
    setShowArchived(false)
    setMobileTab('code')
    setLanguageGuideOpen(false)
    setNotice(`${topic.title} opened in a new practice project. Your previous project is unchanged.`)
  }

  const startPracticeChallenge = (challenge: PracticeChallenge) => {
    if (workspaceArchived) {
      setNotice('Restore this classroom before creating a practice project.')
      return
    }

    const starter = createProject(challenge.kind, challenge.project.title)
    const practiceProject: SavedProject = {
      ...starter,
      organizationId: activeOrganizationId,
      organization: activeOrganization,
      visibility: 'private',
      entryPath: challenge.project.entryPath,
      files: challenge.project.files.map((file) => ({ ...file })),
    }
    const progressSaved = linkPracticeProject(practiceProject.id, challenge.id)
    clearPendingPracticeCheck()
    setLibrary((current) => ({ activeProjectId: practiceProject.id, projects: [practiceProject, ...current.projects] }))
    setActivePath(practiceProject.entryPath)
    setShowArchived(false)
    setMobileTab('code')
    setPracticeLabOpen(false)
    setLanguageGuideOpen(false)
    setNotice(progressSaved
      ? `${challenge.title} is ready. Your previous project is unchanged.`
      : `${challenge.title} is ready and your previous project is unchanged. This browser could not save challenge progress.`)
  }

  const recordPracticeResult = (challenge: PracticeChallenge, result: PracticeCheckResult) => {
    setPracticeChecking(false)
    setPracticeResult(result)
    if (result.passed) {
      const progressSaved = completePracticeChallenge(challenge.id)
      setCompletedPracticeIds(completedPracticeChallengeIds())
      setNotice(progressSaved
        ? `${challenge.title} complete. Nice work — you can keep experimenting or choose another challenge.`
        : `${challenge.title} complete. This browser could not save the completion, but you can keep practicing.`)
    }
  }

  const checkPracticeWork = () => {
    if (!currentPracticeChallenge || practiceChecking) return
    setPracticeResult(null)

    if (currentPracticeChallenge.kind === 'web') {
      recordPracticeResult(currentPracticeChallenge, evaluatePracticeChallenge(currentPracticeChallenge, project.files))
      return
    }

    pendingPracticeCheckRef.current = {
      projectId: project.id,
      challengeId: currentPracticeChallenge.id,
      files: project.files.map((file) => ({ ...file })),
    }
    setPracticeChecking(true)
    setMobileTab('output')
    window.dispatchEvent(new Event('hafa-code-run-active-project'))
  }

  const handlePracticeRunComplete = (outcome: RunnerOutcome) => {
    const pending = pendingPracticeCheckRef.current
    if (!pending) return
    pendingPracticeCheckRef.current = null
    if (libraryRef.current.activeProjectId !== pending.projectId) {
      setPracticeChecking(false)
      return
    }
    if (outcome.status === 'stopped') {
      setPracticeChecking(false)
      setPracticeResult(null)
      return
    }
    const challenge = practiceChallengeById(pending.challengeId)
    if (!challenge) {
      setPracticeChecking(false)
      return
    }
    recordPracticeResult(challenge, evaluatePracticeChallenge(challenge, pending.files, outcome))
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

  const saveOrganizationSettings = async () => {
    if (!activeOrganizationId || !activeOrganization) return
    const res = await api.updateOrganization(activeOrganizationId, { school_year: schoolYearDraft.trim() })
    if (res.error) {
      setNotice(`Could not update classroom settings: ${res.error}`)
      return
    }
    await syncSession()
    setNotice('Classroom settings updated.')
  }

  const toggleOrganizationArchive = async () => {
    if (!activeOrganizationId || !activeOrganization) return
    const action = activeOrganization.archived_at ? 'restore' : 'archive'
    if (!window.confirm(`${action === 'archive' ? 'Archive' : 'Restore'} ${activeOrganization.name}? ${action === 'archive' ? 'Students can still view work, but source changes and new invitations will be disabled.' : 'Source editing and invitations will be enabled again.'}`)) return

    const res = activeOrganization.archived_at
      ? await api.unarchiveOrganization(activeOrganizationId)
      : await api.archiveOrganization(activeOrganizationId)
    if (res.error) {
      setNotice(`Could not ${action} classroom: ${res.error}`)
      return
    }
    await syncSession()
    setNotice(`${activeOrganization.name} ${action === 'archive' ? 'archived' : 'restored'}.`)
  }

  const exportOrganization = async () => {
    if (!activeOrganizationId || !activeOrganization) return
    const res = await api.exportOrganization(activeOrganizationId)
    if (res.error || !res.data) {
      setNotice(`Could not export classroom: ${res.error || 'unknown error'}`)
      return
    }

    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${activeOrganization.slug}-${activeOrganization.school_year || 'classroom'}-export.json`
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setNotice('Classroom export downloaded.')
  }

  const inviteOrgMember = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeOrganizationId) return

    const emails = inviteEmailDraft.split(/[\s,;]+/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
      .filter((email, index, values) => values.indexOf(email) === index)
    if (emails.length === 0) {
      setNotice('Enter at least one email address to invite.')
      return
    }

    const role = canManageOrgMembers ? inviteRoleDraft : 'student'
    const res = emails.length === 1
      ? await api.createOrgInvitation(activeOrganizationId, emails[0], role).then((single) => ({
          data: single.data ? { invitations: [single.data], errors: [] } : null,
          error: single.error,
        }))
      : await api.createOrgInvitations(activeOrganizationId, emails, role)
    if (res.error || !res.data || res.data.invitations.length === 0) {
      setNotice(`Could not create invitation${emails.length === 1 ? '' : 's'}: ${res.error || res.data?.errors.map((error) => `${error.email}: ${error.errors.join(', ')}`).join('; ') || 'unknown error'}`)
      return
    }

    const createdInvitations = res.data.invitations
    const latestInvitation = createdInvitations[0]
    const url = latestInvitation.invitation_url || invitationUrl(latestInvitation.token)
    setOrgInvitations((current) => [
      ...createdInvitations,
      ...current.filter((candidate) => !createdInvitations.some((created) => created.id === candidate.id)),
    ])
    setInviteEmailDraft('')
    setInviteRoleDraft('student')
    setLastInviteUrl(url)
    const copied = await writeClipboardText(url)
    const failedCount = res.data.errors.length
    const queuedCount = createdInvitations.filter((invitation) => invitation.email_queued).length
    if (createdInvitations.length > 1) {
      setNotice(`${createdInvitations.length} invitation${createdInvitations.length === 1 ? '' : 's'} created${queuedCount ? `; ${queuedCount} email${queuedCount === 1 ? '' : 's'} queued` : ''}${failedCount ? `; ${failedCount} failed` : ''}.`)
    } else if (latestInvitation.email_queued) {
      setNotice(copied ? 'Invitation email queued. Backup link copied.' : 'Invitation email queued. Backup link is in the classroom panel.')
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
    setNotice(res.data.email_queued ? 'Invitation email queued to resend.' : 'Invitation link renewed, but email is not configured yet.')
  }

  const revokeInvitation = async (invitation: CloudOrgInvitation) => {
    if (!activeOrganizationId || !invitation.id) return
    if (!window.confirm(`Revoke the invitation for ${invitation.email || 'this account'}? The current link will stop working.`)) return

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
    if (!window.confirm(`Remove ${member.full_name} from ${activeOrganization?.name || 'this organization'}? Their class projects will move to their private Personal workspace so their work is not stranded.`)) return

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

    const pendingTimer = syncTimersRef.current.get(projectToFlush.id)
    if (pendingTimer) {
      window.clearTimeout(pendingTimer)
      syncTimersRef.current.delete(projectToFlush.id)
    }

    const res = await api.updateProject(projectToFlush)
    if (res.error || !res.data) {
      updateCloudSaveStatus(projectToFlush.id, res.code === 'project_conflict' ? 'conflict' : 'failed')
      setNotice(res.code === 'project_conflict'
        ? 'Cloud save conflict: this project changed in another tab. Export your local copy before reloading.'
        : `Cloud save failed: ${res.error || 'unknown error'}. Your local copy is still safe.`)
      return null
    }

    clearProjectPendingCloudSync(projectToFlush.id)
    syncedProjectVersionsRef.current.set(res.data.id, res.data.updatedAt)
    updateCloudSaveStatus(res.data.id, 'saved')
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

      clearPendingPracticeCheck()
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
    clearPendingPracticeCheck()
    setLibrary({ activeProjectId: projectToRestore.id, projects })
    setActivePath(projectToRestore.files[0].path)
    setShowArchived(false)
    setNotice(`${projectToRestore.title || 'Project'} restored.`)
  }

  const cloneProject = () => {
    if (workspaceArchived) {
      setNotice('Restore this classroom before duplicating projects into it.')
      return
    }
    setProjectActionsOpen(false)
    const copy = duplicateProject(project)
    clearPendingPracticeCheck()
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
        clearPendingPracticeCheck()
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
    clearPendingPracticeCheck()
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
    if (project.organizationId) {
      setNotice('External snapshot sharing is disabled for classroom projects. Use Teacher only or Class visibility instead.')
      return
    }

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
      clearPendingPracticeCheck()
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
          <p className="lede">A tiny Replit alternative for CSG and FD students: Ruby, JavaScript, Python, Java, and HTML/CSS/JS in the browser.</p>
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
          <button
            onClick={copyShareLink}
            disabled={Boolean(project.organizationId)}
            title={project.organizationId ? 'External snapshot sharing is disabled for classroom projects' : undefined}
          >
            <Copy size={16} /> Share
          </button>
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
            <button
              onClick={copyShareLink}
              disabled={Boolean(project.organizationId)}
              title={project.organizationId ? 'External snapshot sharing is disabled for classroom projects' : undefined}
            >
              <Copy size={16} /> Share
            </button>
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
              ? `${activeOrganization.role} workspace${activeOrganization.school_year ? ` · ${activeOrganization.school_year}` : ''}${workspaceArchived ? ' · archived and read-only' : ''}. Teacher-only projects are visible to instructors.`
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
                    {organization.name}{organization.archived_at ? ' (Archived)' : ''}
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
            {canManageOrgMembers && (
              <button
                className={classroomTab === 'settings' ? 'active' : 'secondary'}
                type="button"
                role="tab"
                aria-selected={classroomTab === 'settings'}
                onClick={() => {
                  setSchoolYearDraft(activeOrganization.school_year || '')
                  setClassroomTab('settings')
                  api.getOrganizationAuditEvents(String(activeOrganization.id)).then((res) => {
                    if (res.data) setAuditEvents(res.data)
                    if (res.error) setNotice(`Could not load classroom activity: ${res.error}`)
                  })
                }}
              >
                Settings
              </button>
            )}
          </div>
          {workspaceArchived && (
            <p className="helper-text" role="status">
              This classroom is archived. Projects, roster changes, invitations, and settings are read-only until an owner restores it.
            </p>
          )}
          {classroomTab === 'settings' && canManageOrgMembers && (
            <div className="classroom-settings">
              <label className="file-path-field" htmlFor="school-year">
                <span>School year or term</span>
                <input
                  id="school-year"
                  value={schoolYearDraft}
                  onChange={(event) => setSchoolYearDraft(event.target.value)}
                  placeholder="2026–2027"
                  maxLength={40}
                  disabled={workspaceArchived}
                />
              </label>
              <div className="classroom-settings-actions">
                <button type="button" onClick={saveOrganizationSettings} disabled={workspaceArchived}>Save settings</button>
                <button className="secondary" type="button" onClick={exportOrganization}>
                  <Download size={15} /> Export classroom
                </button>
                <button className={workspaceArchived ? 'secondary' : 'danger'} type="button" onClick={toggleOrganizationArchive}>
                  {workspaceArchived ? 'Restore classroom' : 'Archive classroom'}
                </button>
              </div>
              <p className="helper-text">Exports include the roster, source files, and feedback. Archived classrooms stay available for review and export, but project source and invitations become read-only.</p>
              <div className="audit-event-list" aria-label="Recent classroom activity">
                <div className="section-row">
                  <strong>Recent activity</strong>
                  <small>{auditEvents.length} event{auditEvents.length === 1 ? '' : 's'}</small>
                </div>
                {auditEvents.slice(0, 12).map((event) => (
                  <div className="audit-event-row" key={event.id}>
                    <span>{event.action.replaceAll('.', ' ')}</span>
                    <small>{event.actor?.full_name || 'System'} · {formatUpdatedAt(event.created_at)}</small>
                  </div>
                ))}
                {auditEvents.length === 0 && <p className="helper-text">No classroom activity has been recorded yet.</p>}
              </div>
            </div>
          )}
          {classroomTab === 'invitations' && canInviteOrgMembers && (
            <div className="invite-workflow">
              <form className="invite-form" onSubmit={inviteOrgMember}>
                <label className="file-path-field" htmlFor="invite-email">
                  <span>Student emails</span>
                  <textarea
                    id="invite-email"
                    value={inviteEmailDraft}
                    onChange={(event) => setInviteEmailDraft(event.target.value)}
                    placeholder={'student1@example.com\nstudent2@example.com'}
                    rows={4}
                    disabled={workspaceArchived}
                  />
                </label>
                <label className="file-path-field" htmlFor="invite-role">
                  <span>Role</span>
                  <select
                    id="invite-role"
                    value={canManageOrgMembers ? inviteRoleDraft : 'student'}
                    onChange={(event) => setInviteRoleDraft(event.target.value as CloudOrgInvitation['role'])}
                    disabled={workspaceArchived}
                  >
                    <option value="student">Student</option>
                    {canManageOrgMembers && <option value="instructor">Instructor</option>}
                  </select>
                </label>
                <button type="submit" disabled={workspaceArchived}><Send size={16} /> Send invite{inviteEmailDraft.split(/[\s,;]+/).filter(Boolean).length > 1 ? 's' : ''}</button>
              </form>
              <p className="helper-text">Paste one email or a whole roster separated by lines, commas, or spaces. Hafa Code emails invitations when delivery is configured and keeps each link here as a backup.</p>
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
                    <strong>{invitation.email || 'Invitation'}</strong>
                    <small>
                      {invitation.role}
                      {invitation.accepted_at ? ' · accepted' : ` · ${invitation.delivery_status || 'pending'}`}
                    </small>
                    {invitation.delivery_error && <small className="invite-delivery-error">{invitation.delivery_error}</small>}
                  </div>
                  {!invitation.accepted_at && (
                    <div className="invite-actions">
                      <button className="secondary compact" type="button" disabled={workspaceArchived} onClick={() => copyInvitationLink(invitation)}>
                        <Copy size={14} /> Copy link
                      </button>
                      <button className="secondary compact" type="button" disabled={workspaceArchived} onClick={() => resendInvitation(invitation)}>
                        <Send size={14} /> Resend
                      </button>
                      <button className="danger compact" type="button" disabled={workspaceArchived} onClick={() => revokeInvitation(invitation)}>
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
                        disabled={workspaceArchived}
                      >
                        <option value="student">Student</option>
                        <option value="instructor">Instructor</option>
                        <option value="owner">Owner</option>
                      </select>
                      <button className="danger compact" type="button" disabled={workspaceArchived} onClick={() => removeOrgMember(member)}>
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
          {PROJECT_KINDS.map((kind) => (
            <button key={kind} className="secondary compact" onClick={() => addProject(kind)}>
              <Plus size={14} /> {projectKindDefinition(kind).shortLabel}
            </button>
          ))}
        </div>
        <div className="mobile-home-actions">
          <button type="button" onClick={() => setMobileTab('code')}><BookOpen size={16} /> Continue coding</button>
          <button className="secondary" type="button" onClick={() => setPracticeLabOpen(true)}><Dumbbell size={16} /> Practice lab</button>
          <button className="secondary" type="button" onClick={() => setLanguageGuideOpen(true)}><BookOpen size={16} /> {projectKindDefinition(project.kind).shortLabel} guide</button>
          <button className="secondary" type="button" onClick={runFromMobileCode}>
            {project.kind === 'web' ? <Globe size={16} /> : <Play size={16} />}
            {project.kind === 'web' ? 'Open preview' : 'Run project'}
          </button>
          <button className="secondary" type="button" onClick={() => setMobileTab('projects')}><Files size={16} /> Projects</button>
        </div>
      </section>

      <div className="layout-grid">
        <ProjectSidebar
          activeOrganizationId={activeOrganizationId}
          activeProjectCount={activeContextProjects.length}
          archivedProjectCount={archivedContextProjects.length}
          currentProjectId={project.id}
          currentProjectTitle={project.title}
          isSignedIn={isSignedIn}
          mobileProjectsOpen={mobileTab === 'projects'}
          projects={visibleProjects}
          showArchived={showArchived}
          userId={user?.id}
          userName={user?.full_name}
          onAddProject={addProject}
          onCollapse={() => setSidebarCollapsed(true)}
          onExpand={() => setSidebarCollapsed(false)}
          onSelectProject={setActiveProject}
          onShowArchivedChange={setShowArchived}
        />

        <section className="main-workspace">
          <ProjectToolbar
            activeOrganizationId={activeOrganizationId}
            canEditProject={canEditProject}
            checkpointMenuIsOpen={checkpointMenuIsOpen}
            checkpointMenuRef={checkpointMenuRef}
            checkpoints={checkpoints}
            cloudSaveLabel={isSignedIn ? cloudSaveLabel : 'Autosaved locally'}
            currentProjectOwnerLabel={currentProjectOwnerLabel}
            mobileHistoryOpen={mobileTab === 'history'}
            project={project}
            projectCount={activeContextProjects.length}
            onArchive={requestArchiveProject}
            onCheckpointMenuChange={setCheckpointMenuOpen}
            onDelete={requestDeleteProject}
            onDuplicate={cloneProject}
            onOpenGuide={() => setLanguageGuideOpen(true)}
            onOpenPractice={() => setPracticeLabOpen(true)}
            onOpenProjectActions={() => setProjectActionsOpen(true)}
            onRename={renameProject}
            onRestore={restoreProject}
            onRestoreCheckpoint={(checkpoint) => {
              setCheckpointMenuOpen(false)
              requestRestoreCheckpoint(checkpoint)
            }}
            onSaveCheckpoint={saveCheckpoint}
            onVisibilityChange={updateProjectVisibility}
          />

          {canAccessProjectFeedback && (
            <ProjectFeedback projectId={project.id} files={project.files} currentUserId={user?.id} />
          )}

          {currentPracticeChallenge && (
            <PracticeSessionPanel
              key={`${project.id}:${currentPracticeChallenge.id}`}
              challenge={currentPracticeChallenge}
              checking={practiceChecking}
              completed={completedPracticeIds.includes(currentPracticeChallenge.id)}
              result={practiceResult}
              onCheck={checkPracticeWork}
              onOpenLab={() => setPracticeLabOpen(true)}
            />
          )}

          <EditorWorkspace
            activeFile={activeFile}
            canEditProject={canEditProject}
            editorExpanded={editorExpanded}
            editorFontSize={editorFontSize}
            entryFile={entryFile}
            project={project}
            onCreateFile={openCreateFileDialog}
            onDeleteFile={deleteFile}
            onDuplicateFile={openDuplicateFileDialog}
            onEditorExpandedChange={setEditorExpanded}
            onOpenGuide={() => setLanguageGuideOpen(true)}
            onOpenPractice={() => setPracticeLabOpen(true)}
            onRenameFile={openRenameFileDialog}
            onRunnerComplete={handlePracticeRunComplete}
            onRunFromMobileCode={runFromMobileCode}
            onSelectFile={setActivePath}
            onSetEntryPath={setEntryPath}
            onUpdateActiveFile={updateActiveFile}
          />
        </section>
      </div>

      <MobileWorkspaceNav activeTab={mobileTab} projectKind={project.kind} onChange={setMobileTab} />

      <LanguageGuide
        key={project.kind}
        kind={project.kind}
        open={languageGuideOpen}
        onClose={() => setLanguageGuideOpen(false)}
        onOpenPractice={() => {
          setLanguageGuideOpen(false)
          setPracticeLabOpen(true)
        }}
        onTryExample={tryGuideExample}
      />

      <PracticeLab
        key={`practice-${project.kind}`}
        completedChallengeIds={completedPracticeIds}
        initialKind={project.kind}
        open={practiceLabOpen}
        onClose={() => setPracticeLabOpen(false)}
        onStartChallenge={startPracticeChallenge}
      />

      <WorkspaceDialogs
        activeProjectCount={activeContextProjects.length}
        confirmAction={confirmAction}
        confirmDialogRef={confirmDialogRef}
        fileDialog={fileDialog}
        fileDialogError={fileDialogError}
        fileDialogRef={fileDialogRef}
        isSignedIn={isSignedIn}
        orgCreateOpen={orgCreateOpen}
        orgDialogRef={orgDialogRef}
        orgNameDraft={orgNameDraft}
        pendingCheckpoint={pendingCheckpoint}
        project={project}
        projectActionsDialogRef={projectActionsDialogRef}
        projectActionsOpen={projectActionsOpen}
        shareDialog={shareDialog}
        shareDialogRef={shareDialogRef}
        onArchiveProject={requestArchiveProject}
        onCloseConfirm={() => {
          setConfirmAction(null)
          setPendingCheckpoint(null)
        }}
        onCloseFileDialog={() => {
          setFileDialog(null)
          setFileDialogError("")
        }}
        onCloseOrganizationDialog={() => setOrgCreateOpen(false)}
        onCloseProjectActions={() => setProjectActionsOpen(false)}
        onCloseShareDialog={() => setShareDialog(null)}
        onConfirmProjectAction={confirmProjectAction}
        onCopyShareLink={async () => {
          if (!shareDialog) return
          const copied = await writeClipboardText(shareDialog.url)
          setShareDialog((current) => current ? { ...current, copied } : current)
          setNotice(copied ? "Share link copied." : "Clipboard blocked. Select the link to copy it.")
        }}
        onCreateOrganization={createOrganization}
        onDuplicateProject={cloneProject}
        onFilePathChange={(path) => {
          setFileDialog((current) => current ? { ...current, path } : current)
          setFileDialogError("")
        }}
        onOrganizationNameChange={setOrgNameDraft}
        onRequestDeleteProject={requestDeleteProject}
        onRestoreProject={() => {
          setProjectActionsOpen(false)
          void restoreProject()
        }}
        onSubmitFileDialog={submitFileDialog}
      />

      <footer className="oss-footer" aria-label="Open source project">
        <span>Hafa Code is open source.</span>
        <a href="https://github.com/Shimizu-Technology/hafa-code" target="_blank" rel="noreferrer">
          View the code on GitHub
        </a>
        <span aria-hidden="true">·</span>
        <a href="https://cheerpj.com/" target="_blank" rel="noreferrer">
          Java powered by CheerpJ
        </a>
      </footer>
    </main>
  )
}
