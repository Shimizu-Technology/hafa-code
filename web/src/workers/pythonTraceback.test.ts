import { describe, expect, it } from 'vitest'
import { cleanPythonTraceback } from './pythonTraceback'

const nameError = `Traceback (most recent call last):
  File "/lib/python314.zip/_pyodide/_base.py", line 597, in eval_code_async
    await CodeRunner(
  File "/lib/python314.zip/_pyodide/_base.py", line 411, in run_async
    coroutine = eval(self.code, globals, locals)
  File "<exec>", line 28, in <module>
  File "<frozen runpy>", line 287, in run_path
  File "<frozen runpy>", line 98, in _run_module_code
  File "<frozen runpy>", line 88, in _run_code
  File "/home/pyodide/project/main.py", line 4, in <module>
    print(totl)
          ^^^^
NameError: name 'totl' is not defined. Did you mean: 'total'?`

describe('cleanPythonTraceback', () => {
  it('keeps only project frames with relative paths and the final cause', () => {
    const cleaned = cleanPythonTraceback(nameError)
    expect(cleaned.hiddenFrames).toBe(6)
    expect(cleaned.text).toBe(`Traceback (most recent call last):
  File "main.py", line 4, in <module>
    print(totl)
          ^^^^
NameError: name 'totl' is not defined. Did you mean: 'total'?`)
  })

  it('keeps helper-module frames and syntax error locations inside the project', () => {
    const message = `Traceback (most recent call last):
  File "/lib/python314.zip/_pyodide/_base.py", line 597, in eval_code_async
    await CodeRunner(
  File "/home/pyodide/project/main.py", line 1, in <module>
    import helpers.math_tools
  File "/home/pyodide/project/helpers/math_tools.py", line 2
    def add(a, b)
                 ^
SyntaxError: expected ':'`
    const cleaned = cleanPythonTraceback(message)
    expect(cleaned.text).toContain('File "main.py", line 1, in <module>')
    expect(cleaned.text).toContain('File "helpers/math_tools.py", line 2\n    def add(a, b)\n                 ^\nSyntaxError: expected \':\'')
    expect(cleaned.text).not.toContain('_pyodide')
  })

  it('leaves tracebacks without project frames unchanged', () => {
    const message = 'Traceback (most recent call last):\n  File "<exec>", line 3, in <module>\nRuntimeError: setup failed'
    expect(cleanPythonTraceback(message)).toEqual({ text: message, hiddenFrames: 0 })
  })

  it('cleans chained exceptions and project paths inside messages', () => {
    const message = `Traceback (most recent call last):
  File "/home/pyodide/project/main.py", line 2, in <module>
    open("/home/pyodide/project/missing.txt")
FileNotFoundError: [Errno 44] No such file or directory: '/home/pyodide/project/missing.txt'

During handling of the above exception, another exception occurred:

Traceback (most recent call last):
  File "/lib/python314.zip/_pyodide/_base.py", line 597, in eval_code_async
    await CodeRunner(
  File "/home/pyodide/project/main.py", line 4, in <module>
    raise ValueError("bad")
ValueError: bad`
    const cleaned = cleanPythonTraceback(message)
    expect(cleaned.hiddenFrames).toBe(1)
    expect(cleaned.text).not.toContain('/home/pyodide/project/')
    expect(cleaned.text).toContain("No such file or directory: 'missing.txt'")
    expect(cleaned.text).toContain('During handling of the above exception, another exception occurred:')
    expect(cleaned.text.endsWith('ValueError: bad')).toBe(true)
  })
})
