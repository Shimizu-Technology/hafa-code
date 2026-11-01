import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LAB_DESTINATIONS } from '../lib/labDestinations'
import { PROJECT_KINDS, isProjectKind } from '../lib/languageRegistry'
import { createProject } from '../lib/projectStorage'
import { LabDestinationLinks } from './LabDestinationLinks'
import { ProjectSidebar } from './ProjectSidebar'

afterEach(cleanup)

describe('experimental lab destinations', () => {
  it('keeps labs out of the project kinds, so a lab never becomes a workspace project', () => {
    expect(LAB_DESTINATIONS.map((destination) => destination.id)).toEqual(['rust'])
    for (const destination of LAB_DESTINATIONS) {
      expect(isProjectKind(destination.id)).toBe(false)
      expect(PROJECT_KINDS).not.toContain(destination.id)
      expect(destination.href).toMatch(/^\/labs\/[a-z]+\/$/)
    }
  })

  it('renders each lab as a link that says it is experimental and leaves the page', () => {
    render(<LabDestinationLinks className="compact" />)
    const link = screen.getByRole('link', { name: 'Rust Lab (experimental, opens a separate page)' })
    expect(link.getAttribute('href')).toBe('/labs/rust/')
    expect(link.className).toBe('lab-destination-link compact')
    expect(link.getAttribute('title')).toMatch(/running it needs a desktop browser/)
  })

  it('lists the Rust Lab after the language buttons in the project sidebar without adding a project', () => {
    const project = createProject('ruby', 'Warmup')
    const onAddProject = vi.fn()
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
        onSelectProject={vi.fn()}
        onShowArchivedChange={vi.fn()}
      />,
    )
    // Rendered for the desktop sidebar and the phone Projects tab, like the language buttons.
    const grids = document.querySelectorAll('.new-project-grid')
    expect(grids).toHaveLength(2)
    for (const grid of grids) {
      const items = Array.from(grid.children)
      expect(items).toHaveLength(PROJECT_KINDS.length + 1)
      expect(items.at(-1)?.tagName).toBe('A')
      expect(within(grid as HTMLElement).getByRole('link', { name: /Rust Lab/ }).getAttribute('href')).toBe('/labs/rust/')
    }
    expect(onAddProject).not.toHaveBeenCalled()
  })
})
