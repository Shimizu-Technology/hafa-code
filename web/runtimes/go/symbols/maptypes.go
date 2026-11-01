package symbols

import (
	"fmt"
	"reflect"
)

// MapTypes tells Yaegi which interfaces an interpreted value must expose when
// it is passed to these compiled functions, so fmt calls a learner type's
// String, Error, or Format method. Adapted from Yaegi's stdlib/maptypes.go
// (Apache-2.0) for the packages in allowlist.Packages.
var MapTypes = map[reflect.Value][]reflect.Type{}

func init() {
	printers := []reflect.Type{
		reflect.TypeOf((*fmt.Formatter)(nil)).Elem(),
		reflect.TypeOf((*fmt.Stringer)(nil)).Elem(),
	}
	for _, function := range []any{
		fmt.Append, fmt.Appendf, fmt.Appendln,
		fmt.Errorf,
		fmt.Fprint, fmt.Fprintf, fmt.Fprintln,
		fmt.Print, fmt.Printf, fmt.Println,
		fmt.Sprint, fmt.Sprintf, fmt.Sprintln,
	} {
		MapTypes[reflect.ValueOf(function)] = printers
	}

	scanners := []reflect.Type{reflect.TypeOf((*fmt.Scanner)(nil)).Elem()}
	for _, function := range []any{fmt.Scan, fmt.Scanf, fmt.Scanln, fmt.Fscan, fmt.Fscanf, fmt.Fscanln, fmt.Sscan, fmt.Sscanf, fmt.Sscanln} {
		MapTypes[reflect.ValueOf(function)] = scanners
	}

	Symbols["."] = map[string]reflect.Value{"MapTypes": reflect.ValueOf(MapTypes)}
}
