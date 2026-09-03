import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createProject } from '../lib/projectStorage'
import { EditorWorkspace } from './EditorWorkspace'
import { MobileWorkspaceNav } from './MobileWorkspaceNav'
import { ProjectSidebar } from './ProjectSidebar'
import { ProjectToolbar } from './ProjectToolbar'
import { WorkspaceDialogs } from './WorkspaceDialogs'

vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }: { value?: string; onChange?: (value: string) => void }) => (
    <textarea aria-label="Code editor" value={value ?? ''} onChange={(event) => onChange?.(event.target.value)} />
  ),
}))

vi.mock('./RunnerPanel', () => ({ RunnerPanel: () => <section aria-label="Runner panel" /> }))
vi.mock('./WebPreview', () => ({ WebPreview: () => <section aria-label="Web preview" /> }))

describe('workspace presentation components', () => {
  it('routes project navigation actions through the project sidebar', async () => {
    const user = userEvent.setup()
    const project = createProject('ruby', 'Warmup')
    const onAddProject = vi.fn()
    const onSelectProject = vi.fn()

    render(
      <ProjectSidebar
        activeOrganizationId={null}
        activeProjectCount={1}
        archivedProjectCount={0}
        currentProjectId={project.id}
        currentProjectTitle={project.title}
        isSignedIn={false}
        mobileProjectsOpen={false}
        projects={[project]}
        showArchived={false}
        onAddProject={onAddProject}
        onCollapse={vi.fn()}
        onExpand={vi.fn()}
        onSelectProject={onSelectProject}
        onShowArchivedChange={vi.fn()}
      />,
    )

    await user.click(screen.getAllByRole('button', { name: /python/i })[0])
    await user.click(screen.getAllByRole('button', { name: 'Warmup Ruby' })[0])

    expect(onAddProject).toHaveBeenCalledWith('python')
    expect(onSelectProject).toHaveBeenCalledWith(project.id)
  })

  it('keeps editor actions controlled by the workspace owner', async () => {
    const user = userEvent.setup()
    const project = createProject('javascript', 'Events')
    const onOpenGuide = vi.fn()
    const onUpdateActiveFile = vi.fn()

    render(
      <EditorWorkspace
        activeFile={project.files[0]}
        canEditProject
        editorExpanded={false}
        editorFontSize={15}
        entryFile={project.files[0]}
        project={project}
        onCreateFile={vi.fn()}
        onDeleteFile={vi.fn()}
        onDuplicateFile={vi.fn()}
        onEditorExpandedChange={vi.fn()}
        onOpenGuide={onOpenGuide}
        onRenameFile={vi.fn()}
        onRunFromMobileCode={vi.fn()}
        onSelectFile={vi.fn()}
        onSetEntryPath={vi.fn()}
        onUpdateActiveFile={onUpdateActiveFile}
      />,
    )

    await user.click(screen.getByRole('button', { name: /open javascript language guide/i }))
    fireEvent.change(screen.getByLabelText('Code editor'), { target: { value: 'console.log("changed")' } })

    expect(onOpenGuide).toHaveBeenCalledOnce()
    expect(onUpdateActiveFile).toHaveBeenCalledWith('console.log("changed")')
    expect(screen.getByRole('region', { name: 'Runner panel' })).toBeDefined()
  })

  it('keeps project metadata and mobile destinations accessible', async () => {
    const user = userEvent.setup()
    const project = createProject('web', 'Portfolio')
    const onRename = vi.fn()
    const onMobileChange = vi.fn()

    const { rerender } = render(
      <ProjectToolbar
        activeOrganizationId={null}
        canEditProject
        checkpointMenuIsOpen={false}
        checkpointMenuRef={createRef<HTMLDetailsElement>()}
        checkpoints={[]}
        cloudSaveLabel="Autosaved locally"
        currentProjectOwnerLabel=""
        mobileHistoryOpen={false}
        project={project}
        projectCount={1}
        onArchive={vi.fn()}
        onCheckpointMenuChange={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        onOpenGuide={vi.fn()}
        onOpenProjectActions={vi.fn()}
        onRename={onRename}
        onRestore={vi.fn()}
        onRestoreCheckpoint={vi.fn()}
        onSaveCheckpoint={vi.fn()}
        onVisibilityChange={vi.fn()}
      />,
    )

    await user.clear(screen.getByLabelText('Project name'))
    await user.type(screen.getByLabelText('Project name'), 'Site')
    expect(onRename).toHaveBeenCalled()

    rerender(<MobileWorkspaceNav activeTab="code" projectKind="web" onChange={onMobileChange} />)
    await user.click(screen.getByRole('button', { name: /preview/i }))
    expect(onMobileChange).toHaveBeenCalledWith('output')
  })

  it('preserves keyboard submission in extracted file dialogs', () => {
    const project = createProject('python', 'Files')
    const onSubmitFileDialog = vi.fn()

    render(
      <WorkspaceDialogs
        activeProjectCount={1}
        confirmAction={null}
        confirmDialogRef={createRef<HTMLElement>()}
        fileDialog={{ mode: 'create', path: 'helper.py' }}
        fileDialogError=""
        fileDialogRef={createRef<HTMLElement>()}
        isSignedIn={false}
        orgCreateOpen={false}
        orgDialogRef={createRef<HTMLElement>()}
        orgNameDraft=""
        pendingCheckpoint={null}
        project={project}
        projectActionsDialogRef={createRef<HTMLElement>()}
        projectActionsOpen={false}
        shareDialog={null}
        shareDialogRef={createRef<HTMLElement>()}
        onArchiveProject={vi.fn()}
        onCloseConfirm={vi.fn()}
        onCloseFileDialog={vi.fn()}
        onCloseOrganizationDialog={vi.fn()}
        onCloseProjectActions={vi.fn()}
        onCloseShareDialog={vi.fn()}
        onConfirmProjectAction={vi.fn()}
        onCopyShareLink={vi.fn()}
        onCreateOrganization={vi.fn()}
        onDuplicateProject={vi.fn()}
        onFilePathChange={vi.fn()}
        onOrganizationNameChange={vi.fn()}
        onRequestDeleteProject={vi.fn()}
        onRestoreProject={vi.fn()}
        onSubmitFileDialog={onSubmitFileDialog}
      />,
    )

    fireEvent.keyDown(screen.getByLabelText('Path'), { key: 'Enter' })
    expect(onSubmitFileDialog).toHaveBeenCalledOnce()
  })
})
