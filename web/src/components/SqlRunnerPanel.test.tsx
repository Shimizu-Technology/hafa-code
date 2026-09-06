import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SqlRunnerRequest, SqlRunnerResponse } from '../workers/sqlRunnerProtocol'
import { SqlRunnerPanel } from './SqlRunnerPanel'

class FakeSqlWorker {
  static instances: FakeSqlWorker[] = []
  messages: SqlRunnerRequest[] = []
  messageListener: ((event: MessageEvent<SqlRunnerResponse>) => void) | null = null
  errorListener: ((event: ErrorEvent) => void) | null = null
  terminated = false

  constructor() {
    FakeSqlWorker.instances.push(this)
  }

  postMessage(message: SqlRunnerRequest) {
    this.messages.push(message)
  }

  terminate() {
    this.terminated = true
  }

  addEventListener(type: string, listener: EventListener) {
    if (type === 'message') this.messageListener = listener as (event: MessageEvent<SqlRunnerResponse>) => void
    if (type === 'error') this.errorListener = listener as (event: ErrorEvent) => void
  }

  removeEventListener(type: string, listener: EventListener) {
    if (type === 'message' && this.messageListener === listener) this.messageListener = null
    if (type === 'error' && this.errorListener === listener) this.errorListener = null
  }

  respond(message: SqlRunnerResponse) {
    this.messageListener?.({ data: message } as MessageEvent<SqlRunnerResponse>)
  }
}

const project = {
  id: 'sql-project',
  title: 'SQL Data Playground',
  kind: 'sql' as const,
  visibility: 'private' as const,
  organizationId: null,
  entryPath: 'main.sql',
  files: [
    { path: 'main.sql', language: 'sql' as const, content: 'SELECT name FROM learners;' },
    { path: 'schema.sql', language: 'sql' as const, content: 'CREATE TABLE learners (name TEXT);' },
    { path: 'seed.sql', language: 'sql' as const, content: "INSERT INTO learners VALUES ('Lina');" },
  ],
  createdAt: '2026-09-06T00:00:00.000Z',
  updatedAt: '2026-09-06T00:00:00.000Z',
}

describe('SqlRunnerPanel', () => {
  beforeEach(() => {
    FakeSqlWorker.instances = []
    vi.stubGlobal('Worker', FakeSqlWorker)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('renders query rows as an accessible table and reuses the project worker for reset', async () => {
    const user = userEvent.setup()
    const onRunComplete = vi.fn()
    const view = render(<SqlRunnerPanel project={project} entryFile={project.files[0]} onRunComplete={onRunComplete} />)

    await user.click(screen.getByRole('button', { name: 'Run SQL' }))
    const worker = FakeSqlWorker.instances[0]
    const run = worker.messages[0]
    expect(run.type).toBe('run')
    act(() => {
      worker.respond({ id: run.id, type: 'started', action: 'run' })
      worker.respond({
        id: run.id,
        type: 'result',
        durationMs: 18,
        result: { columns: ['name'], rows: [['Lina']], rowCount: 1, rowsTruncated: false, changeCount: 0, statementCount: 1, databaseReset: true },
      })
    })

    expect(screen.getByRole('region', { name: 'Query result, 1 row' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'name' })).toBeTruthy()
    expect(screen.getByRole('cell', { name: 'Lina' })).toBeTruthy()
    expect(onRunComplete).toHaveBeenCalledWith({ status: 'success', stdout: 'name\nLina', stderr: '', durationMs: 18 })

    await user.click(screen.getByRole('button', { name: 'Reset database' }))
    const reset = worker.messages.at(-1)!
    expect(reset.type).toBe('reset')
    act(() => {
      worker.respond({ id: reset.id, type: 'started', action: 'reset' })
      worker.respond({ id: reset.id, type: 'result', durationMs: 8, tableCount: 1 })
    })
    expect(screen.getByText('Database reset from schema.sql and seed.sql · 1 table ready')).toBeTruthy()
    expect(FakeSqlWorker.instances).toHaveLength(1)

    view.unmount()
    expect(worker.terminated).toBe(true)
    expect(worker.messageListener).toBeNull()
    expect(worker.errorListener).toBeNull()
  })

  it('shows a SQL-specific error and sends it to Coach', async () => {
    const user = userEvent.setup()
    const onRunComplete = vi.fn()
    const onErrorAdviceChange = vi.fn()
    render(<SqlRunnerPanel project={project} entryFile={project.files[0]} onRunComplete={onRunComplete} onErrorAdviceChange={onErrorAdviceChange} />)

    await user.click(screen.getByRole('button', { name: 'Run SQL' }))
    const worker = FakeSqlWorker.instances[0]
    const run = worker.messages[0]
    act(() => {
      worker.respond({ id: run.id, type: 'started', action: 'run' })
      worker.respond({ id: run.id, type: 'result', durationMs: 9, error: 'no such table: missing_table' })
    })

    expect(screen.getByRole('alert').textContent).toContain('no such table: missing_table')
    expect(onRunComplete).toHaveBeenCalledWith({ status: 'error', stdout: '', stderr: 'no such table: missing_table', durationMs: 9 })
    expect(onErrorAdviceChange).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'sql', advice: expect.objectContaining({ title: 'SQLite cannot find that table' }) }))
  })

  it('terminates the database worker when a learner stops a query', async () => {
    const user = userEvent.setup()
    const onRunCancel = vi.fn()
    const onRunComplete = vi.fn()
    render(<SqlRunnerPanel project={project} entryFile={project.files[0]} onRunCancel={onRunCancel} onRunComplete={onRunComplete} />)

    await user.click(screen.getByRole('button', { name: 'Run SQL' }))
    const worker = FakeSqlWorker.instances[0]
    const run = worker.messages[0]
    act(() => worker.respond({ id: run.id, type: 'started', action: 'run' }))
    await user.click(screen.getByRole('button', { name: 'Stop' }))

    expect(worker.messages).toContainEqual({ id: run.id, type: 'abort' })
    expect(worker.terminated).toBe(true)
    expect(onRunCancel).toHaveBeenCalledOnce()
    expect(onRunComplete).toHaveBeenCalledWith(expect.objectContaining({ status: 'stopped', stderr: 'SQL execution stopped.' }))
    expect(screen.getByRole('alert').textContent).toContain('SQL execution stopped.')
  })

  it('recovers when the browser cannot create a SQLite worker', async () => {
    const user = userEvent.setup()
    const onRunComplete = vi.fn()
    vi.stubGlobal('Worker', class {
      constructor() {
        throw new Error('Worker creation blocked')
      }
    })
    render(<SqlRunnerPanel project={project} entryFile={project.files[0]} onRunComplete={onRunComplete} />)

    await user.click(screen.getByRole('button', { name: 'Run SQL' }))

    expect(screen.getByRole('alert').textContent).toContain('Worker creation blocked')
    expect(onRunComplete).toHaveBeenCalledWith(expect.objectContaining({ status: 'error', stderr: 'Worker creation blocked' }))
    expect(screen.getByRole('button', { name: 'Run SQL' })).toBeTruthy()
  })

  it('recovers when the browser rejects the first worker message', async () => {
    const user = userEvent.setup()
    const onRunComplete = vi.fn()
    class RejectingSqlWorker extends FakeSqlWorker {
      postMessage() {
        throw new Error('Worker messaging blocked')
      }
    }
    vi.stubGlobal('Worker', RejectingSqlWorker)
    render(<SqlRunnerPanel project={project} entryFile={project.files[0]} onRunComplete={onRunComplete} />)

    await user.click(screen.getByRole('button', { name: 'Run SQL' }))

    expect(screen.getByRole('alert').textContent).toContain('Worker messaging blocked')
    expect(onRunComplete).toHaveBeenCalledWith(expect.objectContaining({ status: 'error', stderr: 'Worker messaging blocked' }))
    expect(FakeSqlWorker.instances[0].terminated).toBe(true)
    expect(screen.getByRole('button', { name: 'Run SQL' })).toBeTruthy()
  })
})
