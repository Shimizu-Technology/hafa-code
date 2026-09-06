import type { Database, Sqlite3Static, SqlValue } from '@sqlite.org/sqlite-wasm'
import type { ProjectFile } from '../lib/projectTypes'
import type { SqlCellValue, SqlQueryResult } from './sqlRunnerProtocol'

export const SQL_MAX_RESULT_ROWS = 500
export const SQL_MAX_RESULT_COLUMNS = 50
export const SQL_MAX_RESULT_BYTES = 256 * 1024
export const SQL_MAX_PROJECT_FILES = 50
export const SQL_MAX_SOURCE_BYTES = 2_000_000

const BOOTSTRAP_PATHS = ['schema.sql', 'seed.sql'] as const

function sqlFile(files: ProjectFile[], path: string) {
  return files.find((file) => file.path === path && file.language === 'sql')
}

export function sqlBootstrapSource(files: ProjectFile[]) {
  return BOOTSTRAP_PATHS.map((path) => sqlFile(files, path)?.content ?? '')
}

export function sqlBootstrapSignature(files: ProjectFile[]) {
  return JSON.stringify(sqlBootstrapSource(files))
}

export function validateSqlProject(files: ProjectFile[], entryPath?: string) {
  if (files.length > SQL_MAX_PROJECT_FILES) return `SQL projects can include at most ${SQL_MAX_PROJECT_FILES} files.`
  const encoder = new TextEncoder()
  const totalBytes = files.reduce((total, file) => total + encoder.encode(file.content).byteLength, 0)
  if (totalBytes > SQL_MAX_SOURCE_BYTES) return 'SQL projects can include at most 2 MB of source code.'
  if (entryPath) {
    const entry = sqlFile(files, entryPath)
    if (!entry || !entryPath.toLowerCase().endsWith('.sql')) return `The SQL entry file ${entryPath} was not found.`
    if (!entry.content.trim()) return `The SQL entry file ${entryPath} is empty.`
  }
  return null
}

export function initializeSqlDatabase(db: Database, files: ProjectFile[]) {
  const [schema, seed] = sqlBootstrapSource(files)
  db.exec('PRAGMA foreign_keys = ON;')
  if (schema.trim()) db.exec(schema)
  if (seed.trim()) db.exec(seed)
}

export function enableSqlDefensiveMode(sqlite: Sqlite3Static, db: Database) {
  if (db.pointer === undefined) throw new Error('SQLite defensive mode requires an open database.')
  const result = sqlite.capi.sqlite3_db_config(
    db.pointer,
    sqlite.capi.SQLITE_DBCONFIG_DEFENSIVE,
    1,
    0,
  )
  if (result !== sqlite.capi.SQLITE_OK) {
    throw new Error(`SQLite defensive mode could not be enabled (result ${result}).`)
  }
}

function transferableValue(value: SqlValue): SqlCellValue {
  if (value === null || typeof value === 'string' || typeof value === 'number') return value
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Uint8Array || value instanceof Int8Array) return `[BLOB · ${value.byteLength} bytes]`
  if (value instanceof ArrayBuffer) return `[BLOB · ${value.byteLength} bytes]`
  return String(value)
}

export function executeSql(db: Database, sql: string, databaseReset: boolean): SqlQueryResult {
  const columns: string[] = []
  const rows: SqlCellValue[][] = []
  const savedStatements: string[] = []
  const resultEncoder = new TextEncoder()
  const beforeChanges = Number(db.changes(true, true))
  let rowCount = 0
  let rowsTruncated = false
  let resultBytes = 0

  db.exec({
    sql,
    rowMode: 'array',
    columnNames: columns,
    saveSql: savedStatements,
    callback: (row) => {
      rowCount += 1
      if (columns.length > SQL_MAX_RESULT_COLUMNS) {
        throw new Error(`Query results can include at most ${SQL_MAX_RESULT_COLUMNS} columns.`)
      }
      const transferableRow = row.map(transferableValue)
      const nextBytes = resultEncoder.encode(JSON.stringify(transferableRow)).byteLength
      if (rows.length < SQL_MAX_RESULT_ROWS && resultBytes + nextBytes <= SQL_MAX_RESULT_BYTES) {
        rows.push(transferableRow)
        resultBytes += nextBytes
      } else rowsTruncated = true
    },
  })

  if (columns.length > SQL_MAX_RESULT_COLUMNS) {
    throw new Error(`Query results can include at most ${SQL_MAX_RESULT_COLUMNS} columns.`)
  }

  const afterChanges = Number(db.changes(true, true))
  return {
    columns,
    rows,
    rowCount,
    rowsTruncated,
    changeCount: Math.max(0, afterChanges - beforeChanges),
    statementCount: savedStatements.length,
    databaseReset,
  }
}
