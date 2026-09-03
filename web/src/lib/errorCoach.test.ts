import { describe, expect, it } from 'vitest'
import { coachRunnerError } from './errorCoach'
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

  it('turns a timeout into a loop-focused diagnostic', () => {
    const advice = coachRunnerError('java', 'Main.java', { status: 'timeout', stdout: '', stderr: 'Execution stopped after 30000ms.', durationMs: 30_250 })
    expect(advice).toMatchObject({ title: 'The program kept running too long', guideTopicId: 'java-loops' })
  })

  it('retains HTML line context for inline browser errors', () => {
    const advice = coachRunnerError('web', 'index.html', failure('ReferenceError: total is not defined\n    at index.html:12:4'))
    expect(advice?.location).toBe('index.html · line 12')
  })

  it('stays out of the way after successful or manually stopped runs', () => {
    expect(coachRunnerError('python', 'main.py', { status: 'success', stdout: 'ok', stderr: '', durationMs: 1 })).toBeNull()
    expect(coachRunnerError('python', 'main.py', { status: 'stopped', stdout: '', stderr: 'Execution stopped.', durationMs: 1 })).toBeNull()
  })
})
