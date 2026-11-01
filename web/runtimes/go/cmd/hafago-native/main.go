// Command hafago-native runs a Go project directory through the same checker
// and interpreter as the browser runner. Content verification compares its
// output with the real Go toolchain.
//
//	hafago-native <project-directory>
package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/Shimizu-Technology/hafa-code/web/runtimes/go/engine"
)

func main() {
	if len(os.Args) != 2 {
		fmt.Fprintln(os.Stderr, "usage: hafago-native <project-directory>")
		os.Exit(2)
	}
	entries, err := os.ReadDir(os.Args[1])
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	var files []engine.File
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		content, err := os.ReadFile(filepath.Join(os.Args[1], entry.Name()))
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(2)
		}
		files = append(files, engine.File{Path: entry.Name(), Content: string(content)})
	}

	if diagnostics := engine.Check(files); len(diagnostics) > 0 {
		for _, diagnostic := range diagnostics {
			fmt.Fprintln(os.Stderr, diagnostic)
		}
		os.Exit(1)
	}
	os.Exit(engine.Run(files))
}
