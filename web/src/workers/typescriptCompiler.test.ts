import { describe, expect, it } from 'vitest'
import typeScriptLibraries from 'virtual:hafa-typescript-libraries'
import type { ProjectFile } from '../lib/projectTypes'
import { compileTypeScriptProject, TYPESCRIPT_MAX_FILES, TYPESCRIPT_MAX_SOURCE_BYTES } from './typescriptCompiler'

function file(path: string, content: string): ProjectFile {
  return { path, language: 'typescript', content }
}

describe('TypeScript compiler', () => {
  it('type-checks and emits a multi-file project', () => {
    const result = compileTypeScriptProject([
      file('main.ts', 'import { greet } from "./lib/greet"\nconsole.log(greet("Guam"))'),
      file('lib/greet.ts', 'export function greet(name: string): string { return `Hafa adai, ${name}!` }'),
    ], 'main.ts', typeScriptLibraries)

    expect(result.diagnostics).toEqual([])
    expect(result.entryModule).toBe('main.js')
    expect(Object.keys(result.modules).sort()).toEqual(['lib/greet.js', 'main.js'])
    expect(result.modules['main.js']).toContain('require("./lib/greet")')
  })

  it('returns actionable file, line, column, and diagnostic codes for type errors', () => {
    const result = compileTypeScriptProject([
      file('main.ts', 'const lessons: number = "three"\nconsole.log(lessons)'),
    ], 'main.ts', typeScriptLibraries)

    expect(result.modules).toEqual({})
    expect(result.entryModule).toBeNull()
    expect(result.diagnostics).toEqual([
      expect.stringMatching(/^main\.ts:1:\d+ - error TS2322: Type 'string' is not assignable to type 'number'\.$/),
    ])
  })

  it('does not expose DOM, Node, or package declarations', () => {
    const result = compileTypeScriptProject([
      file('main.ts', 'document.title = "No"\nprocess.exit(1)\nimport React from "react"\nconsole.log(React)'),
    ], 'main.ts', typeScriptLibraries)

    expect(result.diagnostics.join('\n')).toContain("Cannot find name 'document'")
    expect(result.diagnostics.join('\n')).toContain("Cannot find name 'process'")
    expect(result.diagnostics.join('\n')).toContain("Cannot find module 'react'")
  })

  it('supports local declaration files without emitting them', () => {
    const result = compileTypeScriptProject([
      file('main.ts', 'const learner: Learner = { name: "Mia" }\nconsole.log(learner.name)'),
      file('learner.d.ts', 'interface Learner { name: string }'),
    ], 'main.ts', typeScriptLibraries)

    expect(result.diagnostics).toEqual([])
    expect(Object.keys(result.modules)).toEqual(['main.js'])
  })

  it('rejects unsafe, missing, declaration, oversized, and over-count entry states', () => {
    expect(compileTypeScriptProject([file('../main.ts', '')], '../main.ts', typeScriptLibraries).diagnostics[0]).toContain('Choose a .ts')
    expect(compileTypeScriptProject([file('other.ts', '')], 'main.ts', typeScriptLibraries).diagnostics[0]).toContain('was not found')
    expect(compileTypeScriptProject([file('types.d.ts', '')], 'types.d.ts', typeScriptLibraries).diagnostics[0]).toContain('Choose a .ts')
    expect(compileTypeScriptProject(
      Array.from({ length: TYPESCRIPT_MAX_FILES + 1 }, (_, index) => file(`file-${index}.ts`, '')),
      'file-0.ts',
      typeScriptLibraries,
    ).diagnostics[0]).toContain('at most 50 files')
    expect(compileTypeScriptProject(
      [file('main.ts', 'å'.repeat((TYPESCRIPT_MAX_SOURCE_BYTES / 2) + 1))],
      'main.ts',
      typeScriptLibraries,
    ).diagnostics[0]).toContain('at most 2 MB')
  })
})
