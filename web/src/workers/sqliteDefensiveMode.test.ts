import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import { describe, expect, it } from 'vitest'
import { enableSqlDefensiveMode, initializeSqlDatabase } from './sqlRunnerCore'

describe('SQLite defensive mode integration', () => {
  it('keeps normal FTS5 operations working while blocking direct shadow-table writes', async () => {
    const sqlite = await sqlite3InitModule()
    const database = new sqlite.oo1.DB(':memory:', 'c')

    try {
      enableSqlDefensiveMode(sqlite, database)
      initializeSqlDatabase(database, [
        {
          path: 'schema.sql',
          language: 'sql',
          content: 'CREATE VIRTUAL TABLE lessons USING fts5(body);',
        },
        {
          path: 'seed.sql',
          language: 'sql',
          content: "INSERT INTO lessons(body) VALUES ('Hafa adai, SQLite');",
        },
      ])

      expect(Number(database.selectValue("SELECT count(*) FROM lessons WHERE lessons MATCH 'SQLite';"))).toBe(1)
      expect(() => database.exec('DELETE FROM lessons_data;')).toThrow(/may not be modified/i)
    } finally {
      database.close()
    }
  })
})
