// Runs real programs through the built Go WebAssembly module and the same host
// code as the worker (scripts/build-go-runtime.mjs builds it before tests).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import '../../runtimes/go/dist/wasm_exec.js'
import { runGoModule, type GoProcessConstructor, type GoRunOutcome } from './goRunnerCore'

let module: WebAssembly.Module

beforeAll(async () => {
  module = await WebAssembly.compile(readFileSync(join(process.cwd(), 'runtimes/go/dist/hafago.wasm')))
}, 60_000)

async function run(source: string | Record<string, string>, input: string[] = []) {
  const files = typeof source === 'string' ? { 'main.go': source } : source
  const output = { stdout: '', stderr: '' }
  let started = false
  let inputRequests = 0
  const outcome: GoRunOutcome = await runGoModule({
    module,
    Go: (globalThis as unknown as { Go: GoProcessConstructor }).Go,
    globals: globalThis as Parameters<typeof runGoModule>[0]['globals'],
    files: Object.entries(files).map(([path, content]) => ({ path, content })),
    write: (stream, text) => { output[stream] += text },
    readLine: async () => {
      inputRequests += 1
      return input.shift() ?? null
    },
    onStarted: () => { started = true },
  })
  return { outcome, started, inputRequests, ...output }
}

describe('Go WebAssembly runtime', () => {
  it('runs a multi-file main package with goroutines, channels, and WaitGroup', async () => {
    const result = await run({
      'main.go': 'package main\n\nimport (\n\t"fmt"\n\t"sync"\n)\n\nfunc main() {\n\tfmt.Println(greet("Lina"))\n\tvar wg sync.WaitGroup\n\tsquares := make(chan int, 3)\n\tfor i := 1; i <= 3; i++ {\n\t\twg.Add(1)\n\t\tgo func() {\n\t\t\tdefer wg.Done()\n\t\t\tsquares <- i * i\n\t\t}()\n\t}\n\twg.Wait()\n\tclose(squares)\n\ttotal := 0\n\tfor square := range squares {\n\t\ttotal += square\n\t}\n\tfmt.Println("total:", total)\n}\n',
      'greet.go': 'package main\n\nfunc greet(name string) string {\n\treturn "Hafa adai, " + name + "!"\n}\n',
    })
    expect(result.outcome).toEqual({ kind: 'exited', exitCode: 0 })
    expect(result.started).toBe(true)
    expect(result.stdout).toBe('Hafa adai, Lina!\ntotal: 14\n')
    expect(result.stderr).toBe('')
  })

  it('reports go build diagnostics without starting the program', async () => {
    const result = await run('package main\n\nimport (\n\t"fmt"\n\t"strings"\n)\n\nfunc main() {\n\tx := 5\n\tfmt.Println("hi")\n}\n')
    expect(result.started).toBe(false)
    expect(result.outcome).toEqual({
      kind: 'diagnostics',
      diagnostics: [
        { path: 'main.go', line: 5, column: 2, message: '"strings" imported and not used' },
        { path: 'main.go', line: 9, column: 2, message: 'declared and not used: x' },
      ],
    })
  })

  it('rejects packages outside the browser allowlist', async () => {
    const result = await run('package main\n\nimport "net/http"\n\nfunc main() { _ = http.Get }\n')
    expect(result.outcome.kind).toBe('diagnostics')
    expect(JSON.stringify(result.outcome)).toContain('package \\"net/http\\" is not available')
  })

  it('reads stdin through bufio and fmt.Scan', async () => {
    const result = await run('package main\n\nimport (\n\t"bufio"\n\t"fmt"\n\t"os"\n\t"strings"\n)\n\nfunc main() {\n\treader := bufio.NewReader(os.Stdin)\n\tfmt.Print("Name: ")\n\tname, _ := reader.ReadString(\'\\n\')\n\tvar age int\n\tfmt.Print("Age: ")\n\tfmt.Fscan(reader, &age)\n\tfmt.Printf("%s is %d\\n", strings.TrimSpace(name), age)\n}\n', ['Lina', '17'])
    expect(result.outcome).toEqual({ kind: 'exited', exitCode: 0 })
    expect(result.stdout).toBe('Name: Age: Lina is 17\n')
    expect(result.inputRequests).toBe(2)
  })

  it('reports a runtime panic with learner frames and exit status 2', async () => {
    const result = await run('package main\n\nimport "fmt"\n\nfunc pick(items []int, i int) int {\n\treturn items[i]\n}\n\nfunc main() {\n\tfmt.Println("before")\n\tfmt.Println(pick([]int{1}, 3))\n}\n')
    expect(result.outcome).toEqual({ kind: 'exited', exitCode: 2 })
    expect(result.stdout).toBe('before\n')
    expect(result.stderr).toBe('panic: reflect: slice index out of range\n\ngoroutine 1 [running]:\nmain.pick()\n\tmain.go:6:9\nmain.main()\n\tmain.go:11:14\n')
  })

  it('reports assignment to a nil map at the assignment', async () => {
    const result = await run('package main\n\nfunc main() {\n\tvar counts map[string]int\n\tcounts["a"] = 1\n}\n')
    expect(result.outcome).toEqual({ kind: 'exited', exitCode: 2 })
    expect(result.stderr).toMatch(/^panic: assignment to entry in nil map\n[\s\S]*main\.go:5:2/)
  })

  it('reports a panic inside a goroutine without interpreter frames', async () => {
    const result = await run('package main\n\nimport "time"\n\nfunc worker(items []int) {\n\t_ = items[5]\n}\n\nfunc main() {\n\tgo worker([]int{1})\n\ttime.Sleep(time.Second)\n}\n')
    expect(result.outcome).toEqual({ kind: 'exited', exitCode: 2 })
    expect(result.stderr).toMatch(/^panic: reflect: slice index out of range\n\ngoroutine \d+ \[running\]:\nmain\.worker\(\)\n\tmain\.go:6:6\n$/)
  })

  it('detects a deadlock instead of waiting forever', async () => {
    const result = await run('package main\n\nimport "fmt"\n\nfunc main() {\n\tch := make(chan int)\n\tfmt.Println("waiting")\n\t<-ch\n}\n')
    expect(result.outcome).toEqual({ kind: 'deadlock' })
    expect(result.stdout).toBe('waiting\n')
  })

  it('keeps sleeping goroutines and select timeouts alive', async () => {
    const result = await run('package main\n\nimport (\n\t"fmt"\n\t"time"\n)\n\nfunc main() {\n\tdone := make(chan string)\n\tgo func() {\n\t\ttime.Sleep(20 * time.Millisecond)\n\t\tdone <- "ready"\n\t}()\n\tselect {\n\tcase message := <-done:\n\t\tfmt.Println(message)\n\tcase <-time.After(time.Second):\n\t\tfmt.Println("timeout")\n\t}\n}\n')
    expect(result.outcome).toEqual({ kind: 'exited', exitCode: 0 })
    expect(result.stdout).toBe('ready\n')
  })

  it('honors os.Exit and keeps program state out of the next run', async () => {
    const first = await run('package main\n\nimport (\n\t"fmt"\n\t"os"\n)\n\nvar runs int\n\nfunc main() {\n\truns++\n\tfmt.Println("runs:", runs)\n\tos.Exit(3)\n}\n')
    expect(first.outcome).toEqual({ kind: 'exited', exitCode: 3 })
    const second = await run('package main\n\nimport "fmt"\n\nvar runs int\n\nfunc main() {\n\truns++\n\tfmt.Println("runs:", runs)\n}\n')
    expect(second.stdout).toBe('runs: 1\n')
  })

  it('gives file operations no host filesystem', async () => {
    const result = await run('package main\n\nimport (\n\t"fmt"\n\t"os"\n)\n\nfunc main() {\n\t_, err := os.ReadFile("/etc/passwd")\n\tfmt.Println(err != nil)\n}\n')
    expect(result.stdout).toBe('true\n')
  })

  it('reports newer built-ins the interpreter cannot run as compile errors', async () => {
    const result = await run('package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println(min(2, 1))\n}\n')
    expect(result.outcome.kind).toBe('diagnostics')
    expect(JSON.stringify(result.outcome)).toContain('min is a newer Go built-in')
  })
})
