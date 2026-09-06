import { expect, test, type Page } from '@playwright/test'

const API_URL = 'http://127.0.0.1:3014'
const CLASSROOM_ID = '92001'
const PRIVATE_PROJECT_ID = '93001'
const personaIds = {
  teacher: 91_001,
  student: 91_002,
  classmate: 91_003,
  invitee: 91_004,
  admin: 91_005,
  instructor: 91_006,
  dualStudent: 91_007,
  outsider: 91_008,
} as const

async function openPersona(page: Page, persona: keyof typeof personaIds, hash = '') {
  const session = page.waitForResponse((response) => response.url().endsWith('/api/v1/sessions') && response.request().method() === 'POST')
  await page.goto(`/?e2e_user=${persona}${hash}`)
  expect((await session).status()).toBe(200)
}

async function switchToClassroom(page: Page) {
  const workspace = page.getByLabel('Switch workspace')
  if (!await workspace.isVisible()) {
    await page.getByRole('navigation', { name: 'Workspace sections' }).getByRole('button', { name: 'Projects' }).click()
  }
  await workspace.selectOption(CLASSROOM_ID)
  await expect(page.getByRole('heading', { name: 'FDMS Web Development', exact: true })).toBeVisible()
}

function authHeaders(persona: keyof typeof personaIds) {
  return { Authorization: `Bearer test_token_${personaIds[persona]}` }
}

test.afterEach(async ({ page }) => {
  const viewport = page.viewportSize()
  expect(viewport).toBeTruthy()
  const overflow = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }))
  expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewportWidth)
})

test('teacher reviews private source, gives feedback, and duplicates into the class', async ({ page }) => {
  const browserErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })
  const privateSourceRequests: string[] = []
  const checkpointRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().endsWith(`/api/v1/projects/${PRIVATE_PROJECT_ID}`)) privateSourceRequests.push(request.url())
    if (request.url().endsWith(`/api/v1/projects/${PRIVATE_PROJECT_ID}/checkpoints`)) checkpointRequests.push(request.url())
  })

  await openPersona(page, 'teacher')
  await switchToClassroom(page)
  const summaryResponsePromise = page.waitForResponse((response) => response.url().includes(`/api/v1/organizations/${CLASSROOM_ID}/projects`))
  await page.getByRole('button', { name: 'Classroom' }).click()

  const summaryResponse = await summaryResponsePromise
  const summaryPayload = await summaryResponse.json() as { projects: Array<Record<string, unknown>> }
  expect(summaryPayload.projects.length).toBeGreaterThan(0)
  expect(summaryPayload.projects.every((project) => !('files' in project))).toBe(true)
  expect(privateSourceRequests).toHaveLength(0)

  await page.getByPlaceholder('Project or student').fill('Student Private Lab')
  await expect(page.getByText('1 of 3 projects shown')).toBeVisible()
  const sourceResponse = page.waitForResponse((response) => response.url().endsWith(`/api/v1/projects/${PRIVATE_PROJECT_ID}`) && response.status() === 200)
  await page.getByRole('button', { name: 'Open review' }).click()
  await sourceResponse

  const projectName = page.getByLabel('Project name')
  await expect(projectName).toHaveValue('Student Private Lab')
  await expect(projectName).toBeDisabled()
  await expect(page.getByText('read-only instructor view')).toBeVisible()
  await expect(page.getByText("const greeting = 'Håfa adai';")).toBeVisible()
  expect(privateSourceRequests).toHaveLength(1)
  expect(checkpointRequests).toHaveLength(0)

  await page.getByLabel('Add feedback or reply').fill('Nice start. Add one sentence about block scope.')
  await page.getByRole('button', { name: 'Post' }).click()
  const newFeedback = page.locator('.feedback-comment').filter({ hasText: 'Nice start. Add one sentence about block scope.' })
  await expect(newFeedback).toBeVisible()
  await newFeedback.getByRole('button', { name: 'Resolve' }).click()
  await expect(newFeedback.getByRole('button', { name: 'Reopen' })).toBeVisible()

  await page.getByRole('button', { name: 'Duplicate', exact: true }).click()
  const copyDialog = page.getByRole('dialog', { name: 'Where should the copy live?' })
  await expect(copyDialog.getByLabel('FDMS Web Development')).toBeChecked()
  await copyDialog.getByRole('button', { name: 'Duplicate here' }).click()
  await expect(page.getByText('Project duplicated into FDMS Web Development.')).toBeVisible()
  await expect(projectName).toHaveValue('Student Private Lab Copy')
  await expect(projectName).toBeEnabled()
  expect(browserErrors).toEqual([])
})

test('student creates and edits class work, reloads it, and replies to feedback', async ({ page }) => {
  await openPersona(page, 'student')
  await switchToClassroom(page)
  const desktopProjects = page.locator('.sidebar-content')
  await desktopProjects.locator('.new-project-grid').getByRole('button', { name: 'JS', exact: true }).click()

  const projectName = page.getByLabel('Project name')
  await projectName.fill('Student Created Lab')
  await expect(page.getByText('Saved to cloud + local backup')).toBeVisible({ timeout: 15_000 })

  await page.reload()
  await expect(page.getByText('Classroom test session').first()).toBeVisible()
  await switchToClassroom(page)
  await desktopProjects.getByRole('button', { name: /Student Created Lab/ }).click()
  await expect(page.getByLabel('Project name')).toHaveValue('Student Created Lab')

  await desktopProjects.getByRole('button', { name: /Student Private Lab/ }).click()
  await page.getByLabel('Add feedback or reply').fill('I used const because the binding should not be reassigned.')
  await page.getByRole('button', { name: 'Post' }).click()
  await expect(page.getByText('I used const because the binding should not be reassigned.')).toBeVisible()
})

test('classmate can open class-visible work but not another student private project or feedback', async ({ page, request }) => {
  await openPersona(page, 'classmate')
  await switchToClassroom(page)

  const desktopProjects = page.locator('.sidebar-content')
  await expect(desktopProjects.getByRole('button', { name: /Class Gallery/ })).toBeVisible()
  await expect(desktopProjects.getByRole('button', { name: /Student Private Lab/ })).toHaveCount(0)
  await expect(desktopProjects.getByRole('button', { name: /Classmate Scratchpad/ })).toBeVisible()

  const sourceResponse = await request.get(`${API_URL}/api/v1/projects/${PRIVATE_PROJECT_ID}`, { headers: authHeaders('classmate') })
  expect(sourceResponse.status()).toBe(403)
  const feedbackResponse = await request.get(`${API_URL}/api/v1/projects/${PRIVATE_PROJECT_ID}/comments`, { headers: authHeaders('classmate') })
  expect(feedbackResponse.status()).toBe(403)
})

test('wrong-account and expired invitations fail without exposing the invitee email', async ({ request }) => {
  const wrongAccount = await request.post(`${API_URL}/api/v1/invitations/e2e-classroom-invite/accept`, {
    headers: authHeaders('student'),
  })
  expect(wrongAccount.status()).toBe(403)
  expect(await wrongAccount.text()).not.toContain('invitee@example.test')

  const expiredLookup = await request.get(`${API_URL}/api/v1/invitations/e2e-expired-invite`)
  expect(expiredLookup.status()).toBe(404)
  expect(await expiredLookup.text()).not.toContain('outsider@example.test')
})

test('invited student joins the correct classroom from the invitation link', async ({ page }) => {
  await openPersona(page, 'invitee', '#invite=e2e-classroom-invite')
  await expect(page.getByText('Joined FDMS Web Development.')).toBeVisible()
  await expect(page.getByLabel('Switch workspace').getByRole('option', { name: 'FDMS Web Development' })).toHaveCount(1)
  await switchToClassroom(page)
  await expect(page.getByText('student workspace')).toBeVisible()
})

test('teacher can send, resend, revoke, and export from the classroom controls', async ({ page }) => {
  await openPersona(page, 'teacher')
  await switchToClassroom(page)
  await page.getByRole('button', { name: 'Classroom' }).click()
  await page.getByRole('tab', { name: 'Invitations' }).click()

  await page.getByLabel('Student emails').fill('new.student@example.test')
  const inviteCreated = page.waitForResponse((response) => response.url().endsWith(`/api/v1/organizations/${CLASSROOM_ID}/invite`) && response.status() === 201)
  await page.getByRole('button', { name: 'Send invite' }).click()
  await inviteCreated
  const invitation = page.locator('.invite-row').filter({ hasText: 'new.student@example.test' })
  await expect(invitation).toBeVisible()

  const resent = page.waitForResponse((response) => response.url().includes('/resend') && response.status() === 200)
  await invitation.getByRole('button', { name: 'Resend' }).click()
  await resent
  const revoked = page.waitForResponse((response) => response.request().method() === 'DELETE' && response.url().includes('/invitations/'))
  page.once('dialog', (dialog) => dialog.accept())
  await invitation.getByRole('button', { name: 'Revoke' }).click()
  expect((await revoked).status()).toBe(204)
  await expect(invitation).toHaveCount(0)

  await page.getByRole('tab', { name: 'Settings' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export classroom' }).click()
  expect((await download).suggestedFilename()).toContain('fdms-web-development')
})

test('platform admin can create a classroom and receives its owner role', async ({ page, request }) => {
  await openPersona(page, 'admin')
  await page.getByRole('button', { name: 'Org', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Create workspace' })
  await dialog.getByLabel('Name').fill('E2E Created Classroom')
  const created = page.waitForResponse((response) => response.url().endsWith('/api/v1/organizations') && response.request().method() === 'POST')
  await dialog.getByRole('button', { name: 'Create workspace' }).click()
  const createdPayload = await (await created).json() as { organization: { id: number } }
  await expect(page.getByRole('heading', { name: 'E2E Created Classroom', exact: true })).toBeVisible()

  const members = await request.get(`${API_URL}/api/v1/organizations/${createdPayload.organization.id}/members`, { headers: authHeaders('admin') })
  expect(members.status()).toBe(200)
  expect((await members.json()).members).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: personaIds.admin, organization_role: 'owner' }),
  ]))
})

test('instructor boundaries and dual-class switching stay visible in the UI', async ({ page }) => {
  await openPersona(page, 'instructor')
  await switchToClassroom(page)
  await page.getByRole('button', { name: 'Classroom' }).click()
  await expect(page.getByRole('tab', { name: 'Review work' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Invitations' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Settings' })).toHaveCount(0)

  await page.goto('/?e2e_user=dualStudent')
  await expect(page.getByText('Classroom test session').first()).toBeVisible()
  const workspace = page.getByLabel('Switch workspace')
  await expect(workspace.getByRole('option', { name: 'FDMS Web Development' })).toHaveCount(1)
  await expect(workspace.getByRole('option', { name: 'FDMS Programming Foundations' })).toHaveCount(1)
  await workspace.selectOption('92002')
  await expect(page.getByRole('heading', { name: 'FDMS Programming Foundations', exact: true })).toBeVisible()
})

test('mobile project actions are keyboard dismissible without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openPersona(page, 'student')
  await switchToClassroom(page)
  await page.getByRole('button', { name: 'Code', exact: true }).click()
  await page.getByRole('button', { name: 'Actions' }).click()
  await expect(page.getByRole('dialog', { name: 'Actions' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Actions' })).toHaveCount(0)
})

test('student can checkpoint, restore, archive, restore, and delete a class project', async ({ page }) => {
  await openPersona(page, 'student')
  await switchToClassroom(page)
  await page.locator('.sidebar-content').getByRole('button', { name: /Class Gallery/ }).click()

  await page.locator('.checkpoint-menu').getByText('History').click()
  await page.locator('.checkpoint-popover').getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Checkpoint saved to cloud.')).toBeVisible()

  await page.getByLabel('Project name').fill('Class Gallery changed')
  await expect(page.getByText('Saved to cloud + local backup')).toBeVisible({ timeout: 15_000 })
  const checkpoint = page.locator('.checkpoint-card').first()
  await expect(checkpoint).toBeVisible()
  await checkpoint.click()
  await page.getByRole('alertdialog', { name: 'Restore this checkpoint?' }).getByRole('button', { name: 'Restore checkpoint' }).click()
  await expect(page.getByLabel('Project name')).toHaveValue('Class Gallery')

  await page.locator('.toolbar-actions').getByRole('button', { name: 'Archive' }).click()
  await page.getByRole('alertdialog', { name: 'Archive this project?' }).getByRole('button', { name: 'Archive project' }).click()
  await expect(page.getByText('Class Gallery archived.')).toBeVisible()
  await page.locator('.sidebar-content').getByRole('button', { name: /Archived/ }).click()
  await page.locator('.sidebar-content').getByRole('button', { name: /Class Gallery/ }).click()
  await expect(page.locator('.toolbar-actions').getByRole('button', { name: 'Restore' })).toBeVisible()
  await page.locator('.toolbar-actions').getByRole('button', { name: 'Restore' }).click()
  await expect(page.getByText('Class Gallery restored.')).toBeVisible()

  await page.locator('.toolbar-actions').getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('alertdialog', { name: 'Delete this project?' }).getByRole('button', { name: 'Delete project' }).click()
  await expect(page.locator('.sidebar-content').getByRole('button', { name: /Class Gallery/ })).toHaveCount(0)
})

test('removing a student moves their class project into their private personal workspace', async ({ page, request }) => {
  await openPersona(page, 'teacher')
  await switchToClassroom(page)
  await page.getByRole('button', { name: 'Classroom' }).click()
  await page.getByRole('tab', { name: 'People' }).click()
  const classmate = page.locator('.member-row').filter({ hasText: 'Kiko Classmate' })
  const removed = page.waitForResponse((response) => response.request().method() === 'DELETE' && response.url().includes('/members/'))
  page.once('dialog', (dialog) => dialog.accept())
  await classmate.getByRole('button', { name: 'Remove' }).click()
  expect((await removed).status()).toBe(204)
  await expect(classmate).toHaveCount(0)

  const session = await request.post(`${API_URL}/api/v1/sessions`, { headers: authHeaders('classmate') })
  expect((await session.json()).organizations).toEqual([])
  const movedProject = await request.get(`${API_URL}/api/v1/projects/93003`, { headers: authHeaders('classmate') })
  expect(movedProject.status()).toBe(200)
  expect((await movedProject.json()).project).toMatchObject({ organization_id: null, visibility: 'private' })
})
