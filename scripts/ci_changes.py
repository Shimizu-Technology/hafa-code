#!/usr/bin/env python3
"""Skip expensive jobs only when the complete diff is documentation-only."""
import os
import subprocess
from pathlib import PurePosixPath


def docs_only(paths):
    return bool(paths) and all(
        path.startswith('docs/') or PurePosixPath(path).suffix == '.md'
        or path in ('LICENSE', 'LICENSE.txt')
        for path in paths
    )


def main():
    base = os.environ.get('BASE_SHA', '')
    try:
        # Missing history, an initial push, or a diff error must run the full gate.
        if not base or set(base) == {'0'}:
            raise ValueError('No comparison commit')
        paths = subprocess.check_output(
            ['git', 'diff', '--name-only', '--no-renames', '-z', base, 'HEAD'],
        ).decode().rstrip('\0').split('\0')
        skip = docs_only(paths)
    except (ValueError, subprocess.CalledProcessError):
        skip = False
    print(f"code={str(not skip).lower()}")


if __name__ == '__main__':
    main()
