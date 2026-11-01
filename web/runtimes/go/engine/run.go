package engine

import (
	"fmt"
	"io"
	"os"
	"reflect"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"testing/fstest"

	"github.com/Shimizu-Technology/hafa-code/web/runtimes/go/symbols"
	"github.com/traefik/yaegi/interp"
)

// projectDirectory is where learner files live in the interpreter's source
// filesystem. Positions are reported relative to it.
const projectDirectory = "project"

// Yaegi prints one line per unwound frame while a panic propagates, e.g.
// "project/main.go:7:13: panic: main.main(...)".
var panicFramePattern = regexp.MustCompile(`^(?:\./)?` + projectDirectory + `/([^:\s]+\.go):(\d+):(\d+): panic: (.+)\(\.\.\.\)$`)

type panicFrame struct {
	function string
	location string
}

// interpreterOutput receives the interpreter's own diagnostics (panic frames
// and the println builtin). Frames are kept for the crash report; anything
// else is ordinary stderr.
type interpreterOutput struct {
	mu      sync.Mutex
	pending string
	frames  []panicFrame
	stderr  io.Writer
}

func (o *interpreterOutput) Write(data []byte) (int, error) {
	o.mu.Lock()
	defer o.mu.Unlock()
	o.pending += string(data)
	for {
		line, rest, found := strings.Cut(o.pending, "\n")
		if !found {
			break
		}
		o.pending = rest
		if match := panicFramePattern.FindStringSubmatch(line); match != nil {
			function := strings.Replace(match[4], "./"+projectDirectory+".", "main.", 1)
			o.frames = append(o.frames, panicFrame{function: function, location: fmt.Sprintf("%s:%s:%s", match[1], match[2], match[3])})
			continue
		}
		fmt.Fprintln(o.stderr, line)
	}
	// Hold back only a partial line that may still become a frame line.
	if o.pending != "" && !strings.HasPrefix(o.pending, projectDirectory+"/") && !strings.HasPrefix(projectDirectory+"/", o.pending) {
		fmt.Fprint(o.stderr, o.pending)
		o.pending = ""
	}
	return len(data), nil
}

// takeFrames returns the frames of the panic that is unwinding now, innermost
// first. Yaegi also prints frames for panics the program later recovers, so
// the fatal panic is the trailing run of frames in which each caller's line
// calls the function below it.
func (o *interpreterOutput) takeFrames(sources map[string][]string) []panicFrame {
	o.mu.Lock()
	defer o.mu.Unlock()
	frames := o.frames
	o.frames = nil
	if len(frames) == 0 {
		return nil
	}
	start := len(frames) - 1
	for start > 0 && frameCalls(sources, frames[start], frames[start-1]) {
		start--
	}
	return frames[start:]
}

func frameCalls(sources map[string][]string, caller, callee panicFrame) bool {
	name := callee.function[strings.LastIndex(callee.function, ".")+1:]
	if name == "func" || !strings.Contains(callee.function, ".") {
		// Closures and methods do not carry a callable name in Yaegi's frames.
		return true
	}
	path, position, _ := strings.Cut(caller.location, ":")
	lineText, _, _ := strings.Cut(position, ":")
	var line int
	fmt.Sscan(lineText, &line)
	lines := sources[path]
	if line < 1 || line > len(lines) {
		return false
	}
	return strings.Contains(lines[line-1], name+"(")
}

// Run interprets a program that already passed Check, using the process's
// standard streams, and returns its exit status. A panic that reaches main is
// reported like the Go runtime does and exits with status 2.
func Run(files []File) (exitCode int) {
	sources := SourceFiles(files)
	filesystem := fstest.MapFS{}
	lines := map[string][]string{}
	for _, source := range sources {
		filesystem[projectDirectory+"/"+source.Path] = &fstest.MapFile{Data: []byte(source.Content), Mode: 0o644}
		lines[source.Path] = strings.Split(source.Content, "\n")
	}

	output := &interpreterOutput{stderr: os.Stderr}
	interpreter := interp.New(interp.Options{
		Stdin:                os.Stdin,
		Stdout:               os.Stdout,
		Stderr:               output,
		Args:                 []string{"main"},
		SourcecodeFilesystem: filesystem,
	})
	if err := interpreter.Use(symbols.Symbols); err != nil {
		fmt.Fprintln(os.Stderr, "The Go runner could not load its standard library:", err)
		return 1
	}

	interp.GoroutinePanic = func(value any) {
		fmt.Fprint(os.Stderr, FormatPanic(value, output.takeFrames(lines)))
		os.Exit(2)
	}
	defer func() {
		if recovered := recover(); recovered != nil {
			fmt.Fprint(os.Stderr, FormatPanic(recovered, output.takeFrames(lines)))
			exitCode = 2
		}
	}()

	if _, err := interpreter.EvalPath("./" + projectDirectory); err != nil {
		fmt.Fprintln(os.Stderr, strings.ReplaceAll(err.Error(), projectDirectory+"/", ""))
		return 1
	}
	return 0
}

// FormatPanic renders a recovered panic the way the Go runtime prints an
// unrecovered one, with the learner's frames in place of interpreter frames.
func FormatPanic(value any, frames []panicFrame) string {
	var report strings.Builder
	report.WriteString("panic: ")
	report.WriteString(panicValue(value))
	report.WriteString("\n\n")
	report.WriteString(currentGoroutine())
	report.WriteString(":\n")
	for _, frame := range frames {
		report.WriteString(frame.function)
		report.WriteString("()\n\t")
		report.WriteString(frame.location)
		report.WriteString("\n")
	}
	return report.String()
}

// currentGoroutine returns the runtime's header for the calling goroutine,
// such as "goroutine 1 [running]".
func currentGoroutine() string {
	buffer := make([]byte, 64)
	header, _, _ := strings.Cut(string(buffer[:runtime.Stack(buffer, false)]), ":")
	return header
}

func panicValue(value any) string {
	switch typed := value.(type) {
	case error:
		return typed.Error()
	case fmt.Stringer:
		return typed.String()
	case string:
		return typed
	}
	reflected := reflect.ValueOf(value)
	switch reflected.Kind() {
	case reflect.Bool, reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr,
		reflect.Float32, reflect.Float64, reflect.Complex64, reflect.Complex128:
		return fmt.Sprint(value)
	}
	return fmt.Sprintf("%v", value)
}
