// Package engine type-checks and interprets a learner's Go program. The same
// code runs natively (for content verification against real `go run`) and in
// the browser WebAssembly module.
package engine

import (
	"errors"
	"fmt"
	"go/ast"
	"go/importer"
	"go/parser"
	"go/scanner"
	"go/token"
	"go/types"
	"sort"
	"strconv"
	"strings"

	"github.com/Shimizu-Technology/hafa-code/web/runtimes/go/allowlist"
	syntax "github.com/Shimizu-Technology/hafa-code/web/runtimes/go/gcsyntax"
	"github.com/Shimizu-Technology/hafa-code/web/runtimes/go/stdexport"
)

// File is one project source file.
type File struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

// Diagnostic is a compile error at a learner file position.
type Diagnostic struct {
	Path    string `json:"path"`
	Line    int    `json:"line"`
	Column  int    `json:"column"`
	Message string `json:"message"`
}

func (d Diagnostic) String() string {
	if d.Line == 0 {
		return fmt.Sprintf("%s: %s", d.Path, d.Message)
	}
	return fmt.Sprintf("%s:%d:%d: %s", d.Path, d.Line, d.Column, d.Message)
}

// maxDiagnostics matches the Go compiler, which stops after ten errors.
const maxDiagnostics = 10

// SourceFiles returns the files the Go toolchain would build with `go run .`:
// top-level .go files, excluding tests.
func SourceFiles(files []File) []File {
	var sources []File
	for _, file := range files {
		if strings.HasSuffix(file.Path, ".go") && !strings.HasSuffix(file.Path, "_test.go") && !strings.Contains(file.Path, "/") {
			sources = append(sources, file)
		}
	}
	sort.Slice(sources, func(i, j int) bool { return sources[i].Path < sources[j].Path })
	return sources
}

// Check parses and type-checks a main package the way `go build` would and
// returns the compiler errors, or nil when the program may run.
func Check(files []File) []Diagnostic {
	sources := SourceFiles(files)
	if len(sources) == 0 {
		return []Diagnostic{{Path: ".", Message: "no Go files in this project; add main.go"}}
	}

	fset := token.NewFileSet()
	var diagnostics []Diagnostic
	add := func(position token.Position, message string) {
		diagnostics = append(diagnostics, Diagnostic{Path: position.Filename, Line: position.Line, Column: position.Column, Message: message})
	}

	// The compiler's own parser gives syntax errors the exact `go build`
	// wording; go/parser below only builds the tree for go/types.
	// Like the compiler, keep only the first syntax error on each line.
	for _, source := range sources {
		lastLine := 0
		syntax.Parse(syntax.NewFileBase(source.Path), strings.NewReader(source.Content), func(err error) {
			var syntaxError syntax.Error
			if !errors.As(err, &syntaxError) || int(syntaxError.Pos.Line()) == lastLine {
				return
			}
			lastLine = int(syntaxError.Pos.Line())
			add(token.Position{Filename: source.Path, Line: lastLine, Column: int(syntaxError.Pos.Col())}, syntaxError.Msg)
		}, nil, 0)
	}
	if len(diagnostics) > 0 {
		return finish(diagnostics)
	}

	var parsed []*ast.File
	for _, source := range sources {
		file, err := parser.ParseFile(fset, source.Path, source.Content, parser.AllErrors|parser.SkipObjectResolution)
		var list scanner.ErrorList
		if errors.As(err, &list) {
			for _, item := range list {
				add(item.Pos, item.Msg)
			}
		} else if err != nil {
			add(token.Position{Filename: source.Path}, err.Error())
		}
		if file != nil {
			parsed = append(parsed, file)
		}
	}
	if len(diagnostics) > 0 {
		return finish(diagnostics)
	}

	for _, file := range parsed {
		if file.Name.Name != "main" {
			add(fset.Position(file.Name.Pos()), fmt.Sprintf("package %s; Hafa Code runs Go programs in package main, so every .go file must start with package main", file.Name.Name))
		}
		for _, spec := range file.Imports {
			path, err := strconv.Unquote(spec.Path.Value)
			if err != nil || allowlist.Allowed(path) {
				continue
			}
			add(fset.Position(spec.Path.Pos()), fmt.Sprintf("package %s is not available in Hafa Code's browser Go runner (available: %s)", spec.Path.Value, strings.Join(allowlist.Packages, ", ")))
		}
	}
	if len(diagnostics) > 0 {
		return finish(diagnostics)
	}

	config := types.Config{
		GoVersion: GoVersion,
		Importer:  importer.ForCompiler(fset, "gc", stdexport.Lookup),
		Sizes:     types.SizesFor("gc", "wasm"),
		Error: func(err error) {
			var typeError types.Error
			if errors.As(err, &typeError) {
				add(typeError.Fset.Position(typeError.Pos), typeError.Msg)
				return
			}
			add(token.Position{Filename: sources[0].Path}, err.Error())
		},
	}
	info := &types.Info{Uses: map[*ast.Ident]types.Object{}}
	pkg, _ := config.Check("main", fset, parsed, info)
	if len(diagnostics) > 0 || pkg == nil {
		return finish(diagnostics)
	}
	if _, ok := pkg.Scope().Lookup("main").(*types.Func); !ok {
		add(token.Position{Filename: sources[0].Path}, "function main is undeclared in the main package")
	}
	for ident, object := range info.Uses {
		if builtin, ok := object.(*types.Builtin); ok {
			if advice, unsupported := unsupportedBuiltins[builtin.Name()]; unsupported {
				add(fset.Position(ident.Pos()), fmt.Sprintf("%s is a newer Go built-in that Hafa Code's browser interpreter does not support yet; %s", builtin.Name(), advice))
			}
		}
	}
	return finish(diagnostics)
}

// GoVersion is the language version the checker enforces. Yaegi v0.16.1
// implements Go 1.22 semantics, so newer syntax such as range-over-func is
// reported as a compile error instead of failing inside the interpreter.
const GoVersion = "go1.22"

// unsupportedBuiltins are valid Go that the interpreter cannot run. Reporting
// them here keeps "it compiled" meaning "it can run".
var unsupportedBuiltins = map[string]string{
	"clear": "delete map keys in a loop or assign a new empty map or slice",
	"max":   "compare the values with an if statement",
	"min":   "compare the values with an if statement",
}

func finish(diagnostics []Diagnostic) []Diagnostic {
	sort.SliceStable(diagnostics, func(i, j int) bool {
		a, b := diagnostics[i], diagnostics[j]
		if a.Path != b.Path {
			return a.Path < b.Path
		}
		if a.Line != b.Line {
			return a.Line < b.Line
		}
		return a.Column < b.Column
	})
	if len(diagnostics) > maxDiagnostics {
		diagnostics = append(diagnostics[:maxDiagnostics:maxDiagnostics], Diagnostic{Path: diagnostics[maxDiagnostics].Path, Line: diagnostics[maxDiagnostics].Line, Column: diagnostics[maxDiagnostics].Column, Message: "too many errors"})
	}
	return diagnostics
}
