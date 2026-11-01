// Package stdexport embeds gc export data for the allowlisted standard-library
// packages so go/types can check imports without a GOROOT. cmd/hafagen writes
// the data directory from the pinned toolchain; it is not committed.
package stdexport

import (
	"embed"
	"io"

	"github.com/Shimizu-Technology/hafa-code/web/runtimes/go/allowlist"
)

//go:embed data
var data embed.FS

// Lookup opens the export data for an import path, for importer.ForCompiler.
func Lookup(importPath string) (io.ReadCloser, error) {
	return data.Open("data/" + allowlist.ExportFileName(importPath))
}
