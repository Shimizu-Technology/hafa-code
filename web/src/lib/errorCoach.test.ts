import { describe, expect, it } from 'vitest'
import { coachRunnerError, errorHeadline } from './errorCoach'
import type { ProjectKind } from './projectTypes'

function failure(stderr: string) {
  return { status: 'error' as const, stdout: '', stderr, durationMs: 5 }
}

describe('contextual error coach', () => {
  it.each([
    ['java', 'Main.java', "Main.java:4: error: ';' expected", 'Java is expecting a semicolon', 'Main.java · line 4', 'java-output-comments'],
    ['python', 'main.py', 'File "main.py", line 3\nIndentationError: expected an indented block', 'Python’s indentation does not line up', 'main.py · line 3', 'python-conditionals'],
    ['ruby', 'main.rb', "main.rb:7:in `<main>': undefined local variable or method `total'", 'Ruby does not know that name', 'main.rb · line 7', 'ruby-variables-types'],
    ['javascript', 'main.js', "ReferenceError: 'score' is not defined\n    at main.js:2:1", 'JavaScript cannot find that name', 'main.js · line 2', 'javascript-output-variables'],
    ['web', 'index.html', 'Failed to load images/avatar.png', 'The page could not load a file', 'index.html', 'web-links-images'],
  ] satisfies Array<[ProjectKind, string, string, string, string, string]>)('explains a common %s error', (kind, path, stderr, title, location, topic) => {
    const advice = coachRunnerError(kind, path, failure(stderr))
    expect(advice).toMatchObject({ title, location, guideTopicId: topic })
    expect(advice?.steps).toHaveLength(3)
  })

  it.each(['python', 'java'] as const)('separates %s startup failure from learner loop advice', (kind) => {
    const advice = coachRunnerError(kind, kind === 'python' ? 'main.py' : 'Main.java', { status: 'timeout', failurePhase: 'startup', stdout: '', stderr: 'The browser runtime took too long to load.', durationMs: 90_000 })
    expect(advice).toMatchObject({ title: 'The browser runtime could not start', location: null })
    expect(advice?.guideTopicId).not.toContain('loop')
    expect(advice?.steps.join(' ')).not.toContain('loop')
  })

  it('turns a timeout into a loop-focused diagnostic', () => {
    const advice = coachRunnerError('java', 'Main.java', { status: 'timeout', stdout: '', stderr: 'Execution stopped after 30000ms.', durationMs: 30_250 })
    expect(advice).toMatchObject({ title: 'The program kept running too long', guideTopicId: 'java-loops' })
  })

  it('retains HTML line context for inline browser errors', () => {
    const advice = coachRunnerError('web', 'index.html', failure('ReferenceError: total is not defined\n    at index.html:12:4'))
    expect(advice?.location).toBe('index.html · line 12')
  })

  it('explains SQLite INSERT target-column errors', () => {
    const advice = coachRunnerError('sql', 'main.sql', failure('table learners has no column named nickname'))
    expect(advice).toMatchObject({ title: 'SQLite cannot find that column', guideTopicId: 'sql-select' })
  })

  it('preserves a trusted source path when no line is available', () => {
    const advice = coachRunnerError('web', 'index.html', failure('ReferenceError: helper is not defined'), { path: 'helpers.js' })
    expect(advice?.location).toBe('helpers.js')
  })

  it('stays out of the way after successful or manually stopped runs', () => {
    expect(coachRunnerError('python', 'main.py', { status: 'success', stdout: 'ok', stderr: '', durationMs: 1 })).toBeNull()
    expect(coachRunnerError('python', 'main.py', { status: 'stopped', stdout: '', stderr: 'Execution stopped.', durationMs: 1 })).toBeNull()
  })

  it('points Python errors at the last frame inside the learner project, not Pyodide internals', () => {
    const stderr = [
      'Traceback (most recent call last):',
      '  File "/lib/python314.zip/_pyodide/_base.py", line 597, in eval_code_async',
      '  File "<frozen runpy>", line 287, in run_path',
      '  File "/home/pyodide/project/main.py", line 2, in <module>',
      '  File "/home/pyodide/project/helpers.py", line 5, in total',
      '  File "/lib/python314.zip/json/decoder.py", line 345, in decode',
      "json.decoder.JSONDecodeError: Expecting value: line 1 column 1 (char 0)",
    ].join('\n')
    expect(coachRunnerError('python', 'main.py', failure(stderr))?.location).toBe('helpers.py · line 5')
    expect(coachRunnerError('python', 'main.py', failure('Traceback (most recent call last):\n  File "main.py", line 4, in <module>\nNameError: x'))?.location).toBe('main.py · line 4')
  })

  it('coaches an output flood as a loop problem', () => {
    const advice = coachRunnerError('python', 'main.py', { status: 'error', outputLimited: true, stdout: '0\n1\n', stderr: 'Output limit reached — check your loop.', durationMs: 90 })
    expect(advice).toMatchObject({ title: 'Your program printed too much', guideTopicId: 'python-loops', location: 'main.py' })
  })

  it('headlines the final Python cause, including suggestions, and the first line elsewhere', () => {
    expect(errorHeadline('python', 'Traceback (most recent call last):\n  File "main.py", line 2, in <module>\n    print(totl)\nNameError: name \'totl\' is not defined. Did you mean: \'total\'?\n'))
      .toBe("NameError: name 'totl' is not defined. Did you mean: 'total'?")
    expect(errorHeadline('java', "Main.java:4: error: ';' expected\n  int x = 1\n1 error\n")).toBe("Main.java:4: error: ';' expected")
    expect(errorHeadline('python', '  \n')).toBeNull()
  })
})
