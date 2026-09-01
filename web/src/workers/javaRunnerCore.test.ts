import { describe, expect, it, vi } from 'vitest'
import {
  JAVA_MAX_OUTPUT_BYTES,
  JAVA_MAX_PROJECT_BYTES,
  JAVA_MAX_PROJECT_FILES,
  appendJavaOutput,
  safeJavaProjectPath,
  validateJavaProject,
  type JavaOutputState,
} from './javaRunnerCore'

const mainFile = { path: 'Main.java', language: 'java', content: 'public class Main {}' }

describe('Java runner core', () => {
  it.each(['../Main.java', '/Main.java', './Main.java', '.hidden/Main.java', 'src//Main.java'])(
    'rejects unsafe project path %s',
    (path) => expect(() => safeJavaProjectPath(path)).toThrow(/unsupported Java file path/i),
  )

  it('enforces the file-count boundary', () => {
    const files = Array.from({ length: JAVA_MAX_PROJECT_FILES }, (_, index) => ({
      path: index === 0 ? 'Main.java' : `Helper${index}.java`,
      language: 'java',
      content: index === 0 ? mainFile.content : `class Helper${index} {}`,
    }))
    expect(validateJavaProject({ entryPath: 'Main.java', code: mainFile.content, files }).javaFiles).toHaveLength(JAVA_MAX_PROJECT_FILES)
    expect(() => validateJavaProject({
      entryPath: 'Main.java',
      code: mainFile.content,
      files: [...files, { path: 'TooMany.java', language: 'java', content: 'class TooMany {}' }],
    })).toThrow(`up to ${JAVA_MAX_PROJECT_FILES} files`)
  })

  it('enforces the effective-source byte boundary', () => {
    const exactSource = 'a'.repeat(JAVA_MAX_PROJECT_BYTES)
    expect(() => validateJavaProject({ entryPath: 'Main.java', code: exactSource, files: [{ ...mainFile, content: '' }] })).not.toThrow()
    expect(() => validateJavaProject({ entryPath: 'Main.java', code: `${exactSource}a`, files: [{ ...mainFile, content: '' }] })).toThrow(/2,000,000 bytes/)
  })

  it('rejects packages in the edited entry source and duplicate Java basenames', () => {
    expect(() => validateJavaProject({
      entryPath: 'Main.java',
      code: 'package bank; public class Main {}',
      files: [mainFile],
    })).toThrow(/packages are not supported/i)
    expect(() => validateJavaProject({
      entryPath: 'src/Main.java',
      code: mainFile.content,
      files: [
        { ...mainFile, path: 'src/Main.java' },
        { path: 'examples/Main.java', language: 'java', content: 'class Main {}' },
      ],
    })).toThrow(/unique filenames/i)
  })

  it('latches output truncation after one limit message', () => {
    const state: JavaOutputState = { stdout: [], stderr: [], outputBytes: 0, outputTruncated: false }
    const emit = vi.fn()
    appendJavaOutput(state, 'stdout', 'a'.repeat(JAVA_MAX_OUTPUT_BYTES), emit)
    appendJavaOutput(state, 'stdout', 'overflow', emit)
    appendJavaOutput(state, 'stdout', 'small later chunk', emit)

    expect(state.stdout).toEqual(['a'.repeat(JAVA_MAX_OUTPUT_BYTES)])
    expect(state.stderr).toEqual(['\nOutput stopped after 256 KB.\n'])
    expect(emit).toHaveBeenCalledTimes(2)
  })
})
