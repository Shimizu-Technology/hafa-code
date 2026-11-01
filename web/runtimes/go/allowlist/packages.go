package allowlist

import "strings"

// Packages lists the standard-library packages a learner program may import.
//
// The same list drives both halves of the runner: hafagen extracts Yaegi
// symbols and gc export data for exactly these packages, so a program that
// passes the type check can also be interpreted. Keep it small and
// beginner-focused; anything that reaches the network, the host filesystem,
// processes, unsafe memory, or JavaScript stays out.
//
// slices, maps, and cmp are deliberately absent: Yaegi v0.16.1 ships only part
// of their go1.22 source (no slices.Sort, slices.Max, ...), so the checker
// would accept calls the interpreter cannot run.
var Packages = []string{
	"bufio",
	"bytes",
	"errors",
	"fmt",
	"io",
	"math",
	"math/rand",
	"os",
	"sort",
	"strconv",
	"strings",
	"sync",
	"time",
	"unicode",
	"unicode/utf8",
}

// Allowed reports whether a learner program may import path.
func Allowed(path string) bool {
	for _, allowed := range Packages {
		if allowed == path {
			return true
		}
	}
	return false
}

// ExportFileName is the file that holds the embedded gc export data for an
// import path.
func ExportFileName(importPath string) string {
	return strings.ReplaceAll(importPath, "/", "_") + ".a"
}
