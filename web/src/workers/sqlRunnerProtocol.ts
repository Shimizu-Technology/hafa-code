import type { ProjectFile } from '../lib/projectTypes'

export type SqlCellValue = string | number | null

export interface SqlQueryResult {
  columns: string[]
  rows: SqlCellValue[][]
  rowCount: number
  rowsTruncated: boolean
  changeCount: number
  statementCount: number
  databaseReset: boolean
}

export interface SqlRunRequest {
  id: string
  type: 'run'
  entryPath: string
  files: ProjectFile[]
}

export interface SqlResetRequest {
  id: string
  type: 'reset'
  files: ProjectFile[]
}

export interface SqlAbortRequest {
  id: string
  type: 'abort'
}

export type SqlRunnerRequest = SqlRunRequest | SqlResetRequest | SqlAbortRequest

export type SqlRunnerResponse =
  | { id: string; type: 'started'; action: 'run' | 'reset' }
  | { id: string; type: 'result'; durationMs: number; error?: string; result?: SqlQueryResult; tableCount?: number }
