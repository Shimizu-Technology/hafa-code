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

  it.each([
    ['main.go:9:2: declared and not used: x', 'Go found a variable you never use', 'main.go · line 9', 'go-variables-types'],
    ['main.go:5:2: "strings" imported and not used', 'This import is not used', 'main.go · line 5', 'go-output-comments'],
    ['helper.go:3:9: undefined: total', 'Go cannot find that name', 'helper.go · line 3', 'go-variables-types'],
    ['main.go:6:14: cannot use "five" (untyped string constant) as int value in variable declaration', 'These Go types do not match', 'main.go · line 6', 'go-variables-types'],
    ['main.go:7:1: missing return', 'A function can finish without returning a value', 'main.go · line 7', 'go-functions-errors'],
    ['main.go:4:8: package "net/http" is not available in Hafa Code\'s browser Go runner (available: fmt)', 'That package is not available here', 'main.go · line 4', 'go-output-comments'],
    ['main.go:8:6: kai.Nme undefined (type Learner has no field or method Nme)', 'That field or method does not exist', 'main.go · line 8', 'go-structs-methods'],
    ['main.go:6:18: min is a newer Go built-in that Hafa Code\'s browser interpreter does not support yet; compare the values with an if statement', 'This built-in is not available in Hafa Code yet', 'main.go · line 6', 'go-slices-maps'],
    ["main.go:5:2: syntax error: unexpected keyword else, expected expression", 'Go could not read this syntax', 'main.go · line 5', 'go-conditionals'],
    ['panic: reflect: slice index out of range\n\ngoroutine 1 [running]:\nmain.pick()\n\tmain.go:6:9\nmain.main()\n\tmain.go:11:14\nexit status 2', 'The index is outside the slice', 'main.go · line 6', 'go-slices-maps'],
    ['panic: runtime error: index out of range [3] with length 1', 'The index is outside the slice', 'main.go', 'go-slices-maps'],
    ['panic: assignment to entry in nil map\n\ngoroutine 1 [running]:\nmain.main()\n\tmain.go:5:2\nexit status 2', 'This map was never created', 'main.go · line 5', 'go-slices-maps'],
    ['panic: reflect: call of reflect.Value.Field on zero Value\n\ngoroutine 1 [running]:\nmain.main()\n\tmain.go:17:14', 'Go followed a nil pointer', 'main.go · line 17', 'go-structs-methods'],
    ['fatal error: all goroutines are asleep - deadlock!\nexit status 2', 'Every goroutine is waiting', 'main.go', 'go-goroutines-channels'],
  ])('explains the Go message %s', (stderr, title, location, topic) => {
    const advice = coachRunnerError('go', 'main.go', failure(stderr))
    expect(advice).toMatchObject({ title, location, guideTopicId: topic })
    expect(advice?.steps).toHaveLength(3)
  })

  it('falls back to general Go guidance for an unrecognized message', () => {
    const advice = coachRunnerError('go', 'main.go', failure('panic: something unusual happened\nexit status 2'))
    expect(advice).toMatchObject({ title: 'Let’s decode this go error', guideTopicId: 'go-output-comments', location: 'main.go' })
  })

  it('leads Go failures with the panic or first compiler message', () => {
    expect(errorHeadline('go', 'panic: assignment to entry in nil map\n\ngoroutine 1 [running]:\nmain.main()\n\tmain.go:5:2\nexit status 2\n')).toBe('panic: assignment to entry in nil map')
    expect(errorHeadline('go', 'main.go:9:2: declared and not used: x\nmain.go:10:2: declared and not used: y\n')).toBe('main.go:9:2: declared and not used: x')
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
