import sqlite3InitModule, { type Database, type Sqlite3Static } from '@sqlite.org/sqlite-wasm'
import sqliteWasmUrl from '@sqlite.org/sqlite-wasm/sqlite3.wasm?url'
import { enableSqlDefensiveMode, executeSql, initializeSqlDatabase, sqlBootstrapSignature, validateSqlProject } from './sqlRunnerCore'
import type { SqlRunnerRequest, SqlRunnerResponse } from './sqlRunnerProtocol'

;(globalThis as typeof globalThis & { sqlite3ApiConfig?: unknown }).sqlite3ApiConfig = {
  disable: {
    vfs: {
      kvvfs: true,
      opfs: true,
      'opfs-vfs': true,
      'opfs-sahpool': true,
      'opfs-wl': true,
    },
  },
}

const initializeSqlite = sqlite3InitModule as unknown as (options: { locateFile: () => string }) => Promise<Sqlite3Static>
const sqlitePromise = initializeSqlite({ locateFile: () => sqliteWasmUrl })
let sqlite: Sqlite3Static | null = null
let database: Database | null = null
let bootstrapSignature = ''

function respond(message: SqlRunnerResponse) {
  self.postMessage(message)
}

function closeDatabase() {
  database?.close()
  database = null
  bootstrapSignature = ''
}

async function resetDatabase(files: Extract<SqlRunnerRequest, { type: 'reset' | 'run' }>['files']) {
  sqlite ??= await sqlitePromise
  closeDatabase()
  const nextDatabase = new sqlite.oo1.DB(':memory:', 'c')
  try {
    enableSqlDefensiveMode(sqlite, nextDatabase)
    initializeSqlDatabase(nextDatabase, files)
  } catch (error) {
    nextDatabase.close()
    throw error
  }
  database = nextDatabase
  bootstrapSignature = sqlBootstrapSignature(files)
}

async function loadSqlite() {
  sqlite ??= await sqlitePromise
}

self.onmessage = async (event: MessageEvent<SqlRunnerRequest>) => {
  const request = event.data
  if (request.type === 'abort') {
    closeDatabase()
    return
  }

  const startedAt = performance.now()
  try {
    const validationError = validateSqlProject(request.files, request.type === 'run' ? request.entryPath : undefined)
    if (validationError) throw new Error(validationError)
    await loadSqlite()
    respond({ id: request.id, type: 'started', action: request.type })

    if (request.type === 'reset') {
      await resetDatabase(request.files)
      const tableCount = Number(database?.selectValue("SELECT count(*) FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%';") ?? 0)
      respond({ id: request.id, type: 'result', durationMs: Math.round(performance.now() - startedAt), tableCount })
      return
    }

    const nextSignature = sqlBootstrapSignature(request.files)
    const databaseReset = !database || nextSignature !== bootstrapSignature
    if (databaseReset) await resetDatabase(request.files)
    const entry = request.files.find((file) => file.path === request.entryPath && file.language === 'sql')
    const result = executeSql(database!, entry!.content, databaseReset)
    respond({ id: request.id, type: 'result', durationMs: Math.round(performance.now() - startedAt), result })
  } catch (error) {
    respond({
      id: request.id,
      type: 'result',
      durationMs: Math.round(performance.now() - startedAt),
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
