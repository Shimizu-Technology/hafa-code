// Command hafagen generates the build inputs that must match the pinned Go
// toolchain and Yaegi module: Yaegi symbol bindings and gc export data for
// every package in allowlist.Packages, plus a patched copy of the Yaegi
// interpreter (see yaegiPatches). Run it with GOOS=js GOARCH=wasm so
// the bindings and export data describe the browser target.
package main

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/Shimizu-Technology/hafa-code/web/runtimes/go/allowlist"
	"github.com/traefik/yaegi/extract"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "hafagen:", err)
		os.Exit(1)
	}
}

func run() error {
	if err := writeSymbols("symbols"); err != nil {
		return err
	}
	if err := writeExportData(filepath.Join("stdexport", "data")); err != nil {
		return err
	}
	return writePatchedModule(".build")
}

func writeSymbols(dir string) error {
	stale, err := filepath.Glob(filepath.Join(dir, "zz_*.go"))
	if err != nil {
		return err
	}
	for _, path := range stale {
		if err := os.Remove(path); err != nil {
			return err
		}
	}

	extractor := extract.Extractor{Dest: "symbols"}
	replacer := strings.NewReplacer("/", "_", ".", "_")
	for _, importPath := range allowlist.Packages {
		var buf bytes.Buffer
		if _, err := extractor.Extract(importPath, "symbols", &buf); err != nil {
			return fmt.Errorf("extract %s: %w", importPath, err)
		}
		path := filepath.Join(dir, "zz_"+replacer.Replace(importPath)+".go")
		if err := os.WriteFile(path, buf.Bytes(), 0o644); err != nil {
			return err
		}
	}
	return nil
}

func writeExportData(dir string) error {
	if err := os.RemoveAll(dir); err != nil {
		return err
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}

	args := append([]string{"list", "-export", "-f", "{{.ImportPath}}\t{{.Export}}"}, allowlist.Packages...)
	command := exec.Command("go", args...)
	command.Stderr = os.Stderr
	listing, err := command.Output()
	if err != nil {
		return fmt.Errorf("go list -export: %w", err)
	}

	for _, line := range strings.Split(strings.TrimSpace(string(listing)), "\n") {
		importPath, exportPath, ok := strings.Cut(line, "\t")
		if !ok || exportPath == "" {
			return fmt.Errorf("no export data for %q", line)
		}
		if err := copyPackageDefinition(exportPath, filepath.Join(dir, allowlist.ExportFileName(importPath))); err != nil {
			return fmt.Errorf("%s: %w", importPath, err)
		}
	}
	return nil
}

// copyPackageDefinition writes a one-member archive holding only the
// __.PKGDEF export data from a compiled package archive. The object code that
// follows it is irrelevant to type checking and would multiply the embed size.
func copyPackageDefinition(from, to string) error {
	archive, err := os.ReadFile(from)
	if err != nil {
		return err
	}
	const magic = "!<arch>\n"
	if !bytes.HasPrefix(archive, []byte(magic)) {
		return fmt.Errorf("%s is not a Go package archive", from)
	}
	offset := len(magic)
	for offset+60 <= len(archive) {
		header := archive[offset : offset+60]
		name := strings.TrimSpace(string(header[0:16]))
		size, err := strconv.Atoi(strings.TrimSpace(string(header[48:58])))
		if err != nil {
			return fmt.Errorf("malformed archive header in %s", from)
		}
		end := offset + 60 + size
		if end > len(archive) {
			return fmt.Errorf("truncated archive member in %s", from)
		}
		if name == "__.PKGDEF" {
			member := archive[offset:end]
			output := append([]byte(magic), member...)
			if size%2 == 1 {
				output = append(output, '\n')
			}
			return os.WriteFile(to, output, 0o644)
		}
		offset = end + size%2
	}
	return fmt.Errorf("no __.PKGDEF member in %s", from)
}

// yaegiPatches adjust Yaegi's interp/run.go for a learner-facing runner:
//
//   - Panic frames report the statement that was executing. Yaegi's fast path
//     shadows the exec variable its deferred panic reporter reads, so every
//     frame pointed at the first line of its function. The patch tracks the
//     current CFG node by closure identity instead.
//   - A panic that escapes an interpreted goroutine goes to GoroutinePanic,
//     so the runner can report learner frames instead of an interpreter-internal
//     Go traceback.
var yaegiPatches = []struct{ old, new string }{
	{
		old: "\t\"strings\"\n)\n\n// bltn type",
		new: "\t\"strings\"\n\t\"unsafe\"\n)\n\n// bltn type",
	},
	{
		old: "\tvar exec bltn\n\tdefer func() {",
		new: "\tvar exec bltn\n\tvar current *node\n\tdefer func() {",
	},
	{
		old: "\t\t\toNode := originalExecNode(n, exec)\n\t\t\tif oNode == nil {",
		new: "\t\t\toNode := current\n\t\t\tif oNode == nil {\n\t\t\t\toNode = originalExecNode(n, exec)\n\t\t\t}\n\t\t\tif oNode == nil {",
	},
	{
		old: "\t\tfor exec := n.exec; exec != nil && f.runid() == n.interp.runid(); {\n\t\t\texec = exec(f)\n\t\t}",
		new: "\t\tcurrent = n\n\t\tfor exec = n.exec; exec != nil && f.runid() == n.interp.runid(); {\n\t\t\texec = exec(f)\n\t\t\tcurrent = nextExecNode(current, exec)\n\t\t}",
	},
	{
		old: "\t\t\tgo runCfg(def.child[3].start, nf, def, n)\n",
		new: "\t\t\tgo runGoroutine(def.child[3].start, nf, def, n)\n",
	},
}

const yaegiPatchHelpers = `
// nextExecNode follows the CFG edge whose closure is exec. (Hafa Code patch.)
func nextExecNode(current *node, exec bltn) *node {
	if current == nil || exec == nil {
		return nil
	}
	if current.tnext != nil && sameBltn(current.tnext.exec, exec) {
		return current.tnext
	}
	if current.fnext != nil && sameBltn(current.fnext.exec, exec) {
		return current.fnext
	}
	return nil
}

// GoroutinePanic, when set, receives a panic that escapes an interpreted
// goroutine. (Hafa Code patch.)
var GoroutinePanic func(value any)

func runGoroutine(n *node, f *frame, funcNode, callNode *node) {
	if handler := GoroutinePanic; handler != nil {
		defer func() {
			if value := recover(); value != nil {
				handler(value)
			}
		}()
	}
	runCfg(n, f, funcNode, callNode)
}

// sameBltn compares closure identity, not just the shared code pointer.
func sameBltn(a, b bltn) bool {
	if a == nil || b == nil {
		return false
	}
	return *(*unsafe.Pointer)(unsafe.Pointer(&a)) == *(*unsafe.Pointer)(unsafe.Pointer(&b))
}
`

// yaegiPackages are the Yaegi module directories the runner compiles.
var yaegiPackages = []string{"interp", "internal/unsafe2", "stdlib/generic"}

// writePatchedModule copies the pinned Yaegi packages into dir/yaegi, applies
// yaegiPatches, and writes dir/go.mod, a module file that replaces Yaegi with
// that copy (paths resolve from the module root). Build with `go build -modfile=.build/go.mod`.
func writePatchedModule(dir string) error {
	command := exec.Command("go", "list", "-m", "-f", "{{.Dir}}", "github.com/traefik/yaegi")
	command.Stderr = os.Stderr
	listing, err := command.Output()
	if err != nil {
		return fmt.Errorf("locate yaegi: %w", err)
	}
	moduleDir := strings.TrimSpace(string(listing))
	target := filepath.Join(dir, "yaegi")
	if err := os.RemoveAll(target); err != nil {
		return err
	}
	for _, name := range []string{"go.mod", "LICENSE"} {
		if err := copyFile(filepath.Join(moduleDir, name), filepath.Join(target, name)); err != nil {
			return err
		}
	}
	for _, pkg := range yaegiPackages {
		entries, err := os.ReadDir(filepath.Join(moduleDir, pkg))
		if err != nil {
			return err
		}
		for _, entry := range entries {
			name := entry.Name()
			if entry.IsDir() || strings.HasSuffix(name, "_test.go") {
				continue
			}
			if err := copyFile(filepath.Join(moduleDir, pkg, name), filepath.Join(target, pkg, name)); err != nil {
				return err
			}
		}
	}

	runPath := filepath.Join(target, "interp", "run.go")
	source, err := os.ReadFile(runPath)
	if err != nil {
		return err
	}
	patched := string(source)
	for _, patch := range yaegiPatches {
		if strings.Count(patched, patch.old) != 1 {
			return fmt.Errorf("yaegi patch no longer applies to interp/run.go:\n%s", patch.old)
		}
		patched = strings.Replace(patched, patch.old, patch.new, 1)
	}
	if err := os.WriteFile(runPath, []byte(patched+yaegiPatchHelpers), 0o644); err != nil {
		return err
	}

	moduleFile, err := os.ReadFile("go.mod")
	if err != nil {
		return err
	}
	replaced := string(moduleFile) + "\nreplace github.com/traefik/yaegi => ./.build/yaegi\n"
	if err := os.WriteFile(filepath.Join(dir, "go.mod"), []byte(replaced), 0o644); err != nil {
		return err
	}
	return copyFile("go.sum", filepath.Join(dir, "go.sum"))
}

func copyFile(from, to string) error {
	data, err := os.ReadFile(from)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(to), 0o755); err != nil {
		return err
	}
	return os.WriteFile(to, data, 0o644)
}
