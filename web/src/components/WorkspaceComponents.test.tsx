import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
  afterEach(cleanup)

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

  it('offers project search once the list is long and filters by name or language', async () => {
    const user = userEvent.setup()
    const projects = Array.from({ length: 35 }, (_, index) => createProject(index % 2 ? 'python' : 'ruby', index === 7 ? 'Expense tracker' : `Lesson ${index}`))
    const sidebarProps = {
      activeOrganizationId: null,
      activeProjectCount: projects.length,
      archivedProjectCount: 0,
      currentProjectId: projects[0].id,
      currentProjectTitle: projects[0].title,
      isSignedIn: false,
      mobileProjectsOpen: false,
      showArchived: false,
      workspaceName: 'Personal projects',
      onAddProject: vi.fn(),
      onCollapse: vi.fn(),
      onExpand: vi.fn(),
      onSelectProject: vi.fn(),
      onShowArchivedChange: vi.fn(),
    }
    const { rerender } = render(<ProjectSidebar {...sidebarProps} projects={projects.slice(0, 3)} />)
    expect(screen.queryAllByRole('searchbox', { name: 'Search projects' })).toHaveLength(0)

    rerender(<ProjectSidebar {...sidebarProps} projects={projects} />)
    // The desktop sidebar and phone Projects tab each render the list; ids stay unique.
    const boxes = screen.getAllByRole('searchbox', { name: 'Search projects' })
    expect(boxes).toHaveLength(2)
    expect(new Set(boxes.map((box) => box.id)).size).toBe(2)
    const sidebar = boxes[1].closest('.sidebar-content') as HTMLElement
    const box = within(sidebar).getByRole('searchbox', { name: 'Search projects' })

    await user.type(box, 'expense')
    expect(within(sidebar).getAllByRole('button', { name: /^Expense tracker/ })).toHaveLength(1)
    expect(within(sidebar).queryByRole('button', { name: /^Lesson 1 / })).toBeNull()
    expect(within(sidebar).getByText('1 of 35 projects')).toBeDefined()

    await user.clear(box)
    await user.type(box, 'ruby lesson 1')
    expect(within(sidebar).getAllByRole('button', { name: /^Lesson 1\d? Ruby/ }).length).toBeGreaterThan(0)
    expect(within(sidebar).queryByRole('button', { name: /Python ·/ })).toBeNull()

    await user.clear(box)
    await user.type(box, 'zzz')
    expect(within(sidebar).getByText('No projects match “zzz”.')).toBeDefined()
    await user.keyboard('{Escape}')
    expect(box).toHaveProperty('value', '')
    expect(within(sidebar).getAllByRole('button', { name: /· / }).length).toBe(35)
  })

  it('shows the code read-only while the editor loads, and offers a retry if it fails', async () => {
    const user = userEvent.setup()
    const project = createProject('python', 'Receipt')
    const props = {
      activeFile: project.files[0],
      canEditProject: true,
      editorExpanded: false,
      editorFontSize: 14,
      entryFile: project.files[0],
      project,
      runnerInstanceKey: project.id,
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
    const runtime = globalThis as { __HAFA_EDITOR_RUNTIME_STATE__?: string }
    runtime.__HAFA_EDITOR_RUNTIME_STATE__ = 'loading'
    const { rerender } = render(<EditorWorkspace {...props} />)
    expect(screen.queryByLabelText('Code editor')).toBeNull()
    const placeholder = screen.getByLabelText(`${project.files[0].path}, read-only while the editor loads`)
    expect(placeholder.textContent).toContain(project.files[0].content.split('\n')[0])
    expect(screen.getByRole('status').textContent).toContain('Loading the editor')

    runtime.__HAFA_EDITOR_RUNTIME_STATE__ = 'failed'
    rerender(<EditorWorkspace {...props} />)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByRole('status').textContent).toContain('did not load')

    runtime.__HAFA_EDITOR_RUNTIME_STATE__ = 'ready'
    rerender(<EditorWorkspace {...props} />)
    expect(screen.getByLabelText('Code editor')).toBeDefined()
  })

  it('explains why Run is unavailable when the entry file is empty', () => {
    const project = createProject('python', 'Blank')
    const empty = { ...project.files[0], content: '  \n' }
    const blank = { ...project, files: [empty] }
    render(
      <EditorWorkspace
        activeFile={empty}
        canEditProject
        editorExpanded={false}
        editorFontSize={14}
        entryFile={empty}
        project={blank}
        runnerInstanceKey={project.id}
        onCreateFile={vi.fn()}
        onDeleteFile={vi.fn()}
        onDuplicateFile={vi.fn()}
        onEditorExpandedChange={vi.fn()}
        onOpenGuide={vi.fn()}
        onOpenPractice={vi.fn()}
        onRenameFile={vi.fn()}
        onRunFromMobileCode={vi.fn()}
        onSelectFile={vi.fn()}
        onSetEntryPath={vi.fn()}
        onUpdateActiveFile={vi.fn()}
      />,
    )
    const run = screen.getByRole('button', { name: 'Run Python' })
    expect(run).toHaveProperty('disabled', true)
    const hint = document.getElementById(run.getAttribute('aria-describedby')!)
    expect(hint?.textContent).toBe(`${empty.path} is empty. Type some code in it, then press Run.`)
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
