package symbols

import (
	"errors"
	"os"
)

// Yaegi's extractor replaces these os functions with package-local versions.

// osExit ends the program like the real os.Exit. Each browser run gets its
// own WebAssembly instance, so exiting cannot affect a later run.
func osExit(code int) { os.Exit(code) }

// osFindProcess refuses process access; learner programs have no processes
// to inspect.
func osFindProcess(int) (*os.Process, error) {
	return nil, errors.New("processes are not available in Hafa Code's Go runner")
}
