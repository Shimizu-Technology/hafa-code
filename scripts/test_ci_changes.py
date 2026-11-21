import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from ci_changes import docs_only


class DocumentationFilterTest(unittest.TestCase):
    def test_docs_only(self):
        self.assertTrue(docs_only(['README.md', 'docs/ARCHITECTURE.md', 'LICENSE']))

    def test_mixed_change_runs_gate(self):
        self.assertFalse(docs_only(['docs/CI.md', 'web/playwright.config.ts']))
        self.assertFalse(docs_only(['.github/workflows/ci.yml']))
        self.assertFalse(docs_only(['web/package-lock.json']))

    def test_empty_diff_runs_gate(self):
        self.assertFalse(docs_only([]))


class GitComparisonTest(unittest.TestCase):
    def test_committed_docs_code_rename_and_missing_base(self):
        script = Path(__file__).with_name('ci_changes.py').resolve()
        with tempfile.TemporaryDirectory() as directory:
            def git(*args):
                return subprocess.check_output(['git', *args], cwd=directory, stderr=subprocess.DEVNULL).decode().strip()

            def check(base, expected):
                result = subprocess.check_output(
                    [sys.executable, str(script)], cwd=directory,
                    env={**os.environ, 'BASE_SHA': base}, stderr=subprocess.DEVNULL,
                ).decode().strip()
                self.assertEqual(result, expected)

            git('init')
            git('config', 'user.name', 'CI filter test')
            git('config', 'user.email', 'ci@example.test')
            Path(directory, 'source.ts').write_text('export const value = 1\n')
            git('add', '.')
            git('commit', '-m', 'baseline')
            base = git('rev-parse', 'HEAD')
            Path(directory, 'README.md').write_text('Documentation\n')
            git('add', '.')
            git('commit', '-m', 'docs only')
            check(base, 'code=false')
            base = git('rev-parse', 'HEAD')
            git('mv', 'source.ts', 'source.md')
            git('commit', '-m', 'rename source into docs')
            check(base, 'code=true')
            check('missing-commit', 'code=true')
            check('0' * 40, 'code=true')


if __name__ == '__main__':
    unittest.main()
