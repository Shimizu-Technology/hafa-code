import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createProject } from '../lib/projectStorage'
import { EditorWorkspace } from './EditorWorkspace'
import { MobileWorkspaceNav } from './MobileWorkspaceNav'
import { ProjectSidebar } from './ProjectSidebar'
import { AppBar } from './AppBar'
import { CheckpointMenu } from './CheckpointMenu'
import { ProjectMenu } from './ProjectMenu'
import { WorkspaceDialogs } from './WorkspaceDialogs'

const monacoHarness = vi.hoisted(() => ({ props: null as null | { theme?: string; options?: { tabSize?: number; fontSize?: number; fontFamily?: string } } }))

vi.mock('@monaco-editor/react', () => ({
  default: (props: { value?: string; onChange?: (value: string) => void; theme?: string; options?: { tabSize?: number } }) => {
    monacoHarness.props = props
    return <textarea aria-label="Code editor" value={props.value ?? ''} onChange={(event) => props.onChange?.(event.target.value)} />
  },
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
        workspaceName="Personal projects"
        onAddProject={onAddProject}
        onCollapse={vi.fn()}
        onExpand={vi.fn()}
        onSelectProject={onSelectProject}
        onShowArchivedChange={vi.fn()}
      />,
    )

    await user.click(screen.getAllByRole('button', { name: /python/i })[0])
    await user.click(screen.getAllByRole('button', { name: /^Warmup Ruby ·/ })[0])

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
        runnerInstanceKey={project.id}
        onCreateFile={vi.fn()}
        onDeleteFile={vi.fn()}
        onDuplicateFile={vi.fn()}
        onEditorExpandedChange={vi.fn()}
        onOpenGuide={onOpenGuide}
        onOpenPractice={vi.fn()}
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

  it('indents Python with four spaces and other languages with two, on the warm Hafa theme', () => {
    const python = createProject('python', 'Expenses')
    const props = {
      canEditProject: true,
      editorExpanded: false,
      editorFontSize: 14,
      onCreateFile: vi.fn(),
      onDeleteFile: vi.fn(),
      onDuplicateFile: vi.fn(),
      onEditorExpandedChange: vi.fn(),
      onOpenGuide: vi.fn(),
      onOpenPractice: vi.fn(),
      onRenameFile: vi.fn(),
      onRunFromMobileCode: vi.fn(),
      onSelectFile: vi.fn(),
      onSetEntryPath: vi.fn(),
      onUpdateActiveFile: vi.fn(),
    }
    const { rerender } = render(<EditorWorkspace {...props} activeFile={python.files[0]} entryFile={python.files[0]} project={python} runnerInstanceKey={python.id} editorTheme="hafa-dark" />)
    expect(monacoHarness.props?.options?.tabSize).toBe(4)
    expect(monacoHarness.props?.theme).toBe('hafa-dark')
    expect(monacoHarness.props?.options?.fontFamily).toContain('JetBrains Mono')

    const ruby = createProject('ruby', 'Loops')
    rerender(<EditorWorkspace {...props} activeFile={ruby.files[0]} entryFile={ruby.files[0]} project={ruby} runnerInstanceKey={ruby.id} />)
    expect(monacoHarness.props?.options?.tabSize).toBe(2)
    expect(monacoHarness.props?.theme).toBe('hafa-light')
  })

  it('keeps project metadata and mobile destinations accessible', async () => {
    const user = userEvent.setup()
    const project = createProject('web', 'Portfolio')
    const onRename = vi.fn()
    const onMobileChange = vi.fn()
    const onCheckpointMenuChange = vi.fn()

    const { rerender } = render(
      <AppBar
        canEditProject
        guideLabel="Web guide"
        projectTitle={project.title}
        saveLabel="Autosaved locally"
        shareDisabled={false}
        account={null}
        history={(
          <CheckpointMenu
            canEditProject
            checkpointMenuIsOpen
            checkpointMenuRef={createRef<HTMLDetailsElement>()}
            checkpoints={[]}
            onCheckpointMenuChange={onCheckpointMenuChange}
            onRestoreCheckpoint={vi.fn()}
            onSaveCheckpoint={vi.fn()}
          />
        )}
        settings={null}
        menu={(
          <ProjectMenu
            activeOrganizationId={null}
            canEditProject
            exportLabel="Export project (.json)"
            exportTitle="Export"
            project={project}
            projectCount={1}
            onArchive={vi.fn()}
            onDelete={vi.fn()}
            onDownload={vi.fn()}
            onDuplicate={vi.fn()}
            onImport={vi.fn()}
            onOpenWorkspaceBackup={vi.fn()}
            onRestore={vi.fn()}
            onVisibilityChange={vi.fn()}
          />
        )}
        onOpenGuide={vi.fn()}
        onOpenPractice={vi.fn()}
        onRename={onRename}
        onShare={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Site' } })
    expect(onRename).toHaveBeenLastCalledWith('Site')
    await user.click(screen.getByRole('button', { name: 'More project actions' }))
    const menu = screen.getByRole('group', { name: 'Project actions' })
    expect(within(menu).getByRole('meter', { name: /project source uses/i }).getAttribute('max')).toBe('2000000')
    expect(within(menu).getByText(/of 2.00 MB/)).toBeDefined()
    // The last active project cannot be archived; Delete lives in the menu, not the toolbar.
    expect(within(menu).getByRole('button', { name: 'Archive' })).toHaveProperty('disabled', true)
    expect(within(menu).getByRole('button', { name: 'Delete' })).toBeDefined()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('group', { name: 'Project actions' })).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'More project actions' }))
    const historySummary = screen.getByText('History').closest('summary')!
    historySummary.focus()
    fireEvent.keyDown(historySummary, { key: 'Escape' })
    expect(onCheckpointMenuChange).toHaveBeenLastCalledWith(false)
    expect(historySummary.parentElement?.hasAttribute('open')).toBe(false)
    expect(document.activeElement).toBe(historySummary)

    rerender(<MobileWorkspaceNav activeTab="code" projectKind="web" onChange={onMobileChange} />)
    expect(screen.getByRole('button', { name: 'Code' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('button', { name: /preview/i }).getAttribute('aria-current')).toBeNull()
    await user.click(screen.getByRole('button', { name: /preview/i }))
    expect(onMobileChange).toHaveBeenCalledWith('output')
  })

  it('preserves keyboard submission in extracted file dialogs', () => {
    const project = createProject('python', 'Files')
    const onSubmitFileDialog = vi.fn()

    render(
      <WorkspaceDialogs
        activeProjectCount={1}
        canEditProject
        confirmAction={null}
        confirmDialogRef={createRef<HTMLElement>()}
        copyDestinationId={null}
        copyDestinations={[{ id: null, label: 'Personal projects', description: 'Only you can access this copy.' }]}
        copyDialogOpen={false}
        copyDialogRef={createRef<HTMLElement>()}
        copySubmitting={false}
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
        onCloseProjectCopy={vi.fn()}
        onCloseShareDialog={vi.fn()}
        onConfirmProjectAction={vi.fn()}
        onConfirmProjectCopy={vi.fn()}
        onConfirmShare={vi.fn()}
        onCreateOfflineShare={vi.fn()}
        onCopyShareLink={vi.fn()}
        onCreateOrganization={vi.fn()}
        onDuplicateProject={vi.fn()}
        onProjectCopyDestinationChange={vi.fn()}
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

  it('makes personal and cross-class copy destinations explicit', async () => {
    const user = userEvent.setup()
    const project = createProject('ruby', 'Class starter')
    const onCloseProjectCopy = vi.fn()
    const onConfirmProjectCopy = vi.fn()
    const onProjectCopyDestinationChange = vi.fn()

    render(
      <WorkspaceDialogs
        activeProjectCount={1}
        canEditProject
        confirmAction={null}
        confirmDialogRef={createRef<HTMLElement>()}
        copyDestinationId="10"
        copyDestinations={[
          { id: null, label: 'Personal projects', description: 'Only you can access this copy.' },
          { id: '10', label: 'Computer Science', description: 'Private to you and this classroom’s instructors.' },
          { id: '20', label: 'Robotics', description: 'Private to you and this classroom’s instructors.' },
        ]}
        copyDialogOpen
        copyDialogRef={createRef<HTMLElement>()}
        copySubmitting={false}
        fileDialog={null}
        fileDialogError=""
        fileDialogRef={createRef<HTMLElement>()}
        isSignedIn
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
        onCloseProjectCopy={onCloseProjectCopy}
        onCloseShareDialog={vi.fn()}
        onConfirmProjectAction={vi.fn()}
        onConfirmProjectCopy={onConfirmProjectCopy}
        onConfirmShare={vi.fn()}
        onCreateOfflineShare={vi.fn()}
        onCopyShareLink={vi.fn()}
        onCreateOrganization={vi.fn()}
        onDuplicateProject={vi.fn()}
        onProjectCopyDestinationChange={onProjectCopyDestinationChange}
        onFilePathChange={vi.fn()}
        onOrganizationNameChange={vi.fn()}
        onRequestDeleteProject={vi.fn()}
        onRestoreProject={vi.fn()}
        onSubmitFileDialog={vi.fn()}
      />,
    )

    const dialog = screen.getByRole('dialog', { name: 'Where should the copy live?' })
    expect(within(dialog).getByRole('radio', { name: /Computer Science/ })).toHaveProperty('checked', true)
    await user.click(within(dialog).getByRole('radio', { name: /Robotics/ }))
    expect(onProjectCopyDestinationChange).toHaveBeenCalledWith('20')
    await user.click(within(dialog).getByRole('button', { name: 'Duplicate here' }))
    expect(onConfirmProjectCopy).toHaveBeenCalledOnce()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(onCloseProjectCopy).toHaveBeenCalledOnce()
  })
})
