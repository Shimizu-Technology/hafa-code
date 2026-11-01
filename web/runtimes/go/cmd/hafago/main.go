//go:build js && wasm

// Command hafago is the browser Go runner. Each run instantiates a fresh copy
// of this WebAssembly module, so a program's goroutines, globals, and
// os.Exit end with that run, as they would in a real `go run`.
//
// The worker sets globalThis.__hafaGoRequest to {files: "<JSON>"} and
// receives events through globalThis.__hafaGoReport(kind, payload):
// "diagnostics" with JSON compile errors (exit status 1), or "started" just
// before the program runs. Program output uses the process's standard
// streams, which wasm_exec.js routes through the worker's fs shim.
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"syscall/js"

	"github.com/Shimizu-Technology/hafa-code/web/runtimes/go/engine"
)

func main() {
	request := js.Global().Get("__hafaGoRequest")
	report := js.Global().Get("__hafaGoReport")
	if request.Type() != js.TypeObject || report.Type() != js.TypeFunction {
		fmt.Fprintln(os.Stderr, "The Go runner started without a project.")
		os.Exit(70)
	}

	var files []engine.File
	if err := json.Unmarshal([]byte(request.Get("files").String()), &files); err != nil {
		fmt.Fprintln(os.Stderr, "The Go runner received an unreadable project:", err)
		os.Exit(70)
	}

	if diagnostics := engine.Check(files); len(diagnostics) > 0 {
		payload, _ := json.Marshal(diagnostics)
		report.Invoke("diagnostics", string(payload))
		os.Exit(1)
	}

	report.Invoke("started", "")
	os.Exit(engine.Run(files))
}
