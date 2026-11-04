"""Exercise real package bins without a shell, browser launch or network access."""
import json
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / 'tools/design-runtime'


class LauncherChecks(unittest.TestCase):
    def test_pinned_bins_forward_arguments_from_another_directory(self):
        manifest = json.loads((RUNTIME / 'package.json').read_text())
        for provider, package in [('playwright', '@playwright/mcp'),
                                  ('devtools', 'chrome-devtools-mcp')]:
            with self.subTest(provider=provider):
                if not (RUNTIME / 'node_modules' / package / 'package.json').exists():
                    self.skipTest('Install tools/design-runtime with --ignore-scripts first')
                result = subprocess.run(
                    ['node', str(ROOT / 'scripts/design/mcp-launcher.mjs'), provider, '--version'],
                    cwd=ROOT.parent, text=True, capture_output=True, timeout=30,
                )
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn(manifest['dependencies'][package], result.stdout)


if __name__ == '__main__':
    unittest.main()
