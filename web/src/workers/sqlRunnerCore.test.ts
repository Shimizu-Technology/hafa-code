import type { Database, SqlValue } from '@sqlite.org/sqlite-wasm'
import { describe, expect, it, vi } from 'vitest'
import type { ProjectFile } from '../lib/projectTypes'
import {
  executeSql,
  initializeSqlDatabase,
  SQL_MAX_RESULT_ROWS,
  SQL_MAX_PROJECT_FILES,
  SQL_MAX_SOURCE_BYTES,
  sqlBootstrapSignature,
  sqlBootstrapSource,
  validateSqlProject,
} from './sqlRunnerCore'

const files: ProjectFile[] = [
  { path: 'main.sql', language: 'sql', content: 'SELECT * FROM learners;' },
  { path: 'schema.sql', language: 'sql', content: 'CREATE TABLE learners (name TEXT);' },
  { path: 'seed.sql', language: 'sql', content: "INSERT INTO learners VALUES ('Lina');" },
]

describe('SQL runner core', () => {
  it('validates the entry and keeps schema and seed inputs explicit', () => {
    expect(validateSqlProject(files, 'main.sql')).toBeNull()
    expect(validateSqlProject(files, 'missing.sql')).toContain('was not found')
    expect(validateSqlProject([{ ...files[0], content: '  ' }], 'main.sql')).toContain('is empty')
    expect(validateSqlProject(Array.from({ length: SQL_MAX_PROJECT_FILES + 1 }, (_, index) => ({ ...files[0], path: `file-${index}.sql` })))).toContain('at most 50 files')
    expect(validateSqlProject([{ ...files[0], content: 'å'.repeat((SQL_MAX_SOURCE_BYTES / 2) + 1) }])).toContain('at most 2 MB')
    expect(sqlBootstrapSource(files)).toEqual([files[1].content, files[2].content])
    expect(sqlBootstrapSignature(files)).not.toBe(sqlBootstrapSignature(files.map((file) => file.path === 'seed.sql' ? { ...file, content: '' } : file)))
  })

  it('initializes foreign keys, schema, and seed data in order', () => {
    const exec = vi.fn()
    initializeSqlDatabase({ exec } as unknown as Database, files)

    expect(exec.mock.calls.map(([sql]) => sql)).toEqual([
      'PRAGMA foreign_keys = ON;',
      files[1].content,
      files[2].content,
    ])
  })

  it('returns accessible tabular values, change counts, and a bounded row preview', () => {
    const changes = vi.fn().mockReturnValueOnce(10n).mockReturnValueOnce(12n)
    const exec = vi.fn((options: {
      columnNames: string[]
      saveSql: string[]
      callback: (row: SqlValue[]) => void
    }) => {
      options.columnNames.push('name', 'payload')
      options.saveSql.push('SELECT name, payload FROM learners')
      Array.from({ length: SQL_MAX_RESULT_ROWS + 2 }, (_, index) => [index === 0 ? 'Lina' : `Learner ${index}`, new Uint8Array(index)] as SqlValue[])
        .forEach(options.callback)
    })
    const result = executeSql({ exec, changes } as unknown as Database, 'SELECT name, payload FROM learners;', true)

    expect(result.columns).toEqual(['name', 'payload'])
    expect(result.rows).toHaveLength(SQL_MAX_RESULT_ROWS)
    expect(result.rows[0]).toEqual(['Lina', '[BLOB · 0 bytes]'])
    expect(result.rowCount).toBe(SQL_MAX_RESULT_ROWS + 2)
    expect(result.rowsTruncated).toBe(true)
    expect(result.changeCount).toBe(2)
    expect(result.statementCount).toBe(1)
    expect(result.databaseReset).toBe(true)
  })
})
