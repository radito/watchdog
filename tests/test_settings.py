import pathlib
import shutil
import subprocess
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]


class SettingsBridgeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='watchdog settings ')
        self.module = pathlib.Path(self.temp.name)
        for filename in ['settings.sh', 'watchdog.sh', 'config.sh']:
            shutil.copy(ROOT / filename, self.module / filename)

    def tearDown(self):
        self.temp.cleanup()

    def call(self, *args):
        return subprocess.run(['sh', str(self.module / 'settings.sh'), *args],
                              capture_output=True, text=True)

    def test_read_returns_installed_config(self):
        result = self.call('read')
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, (self.module / 'config.sh').read_text())

    def test_save_writes_valid_config_with_private_permissions(self):
        result = self.call('save', '120', '30', '0', '1')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.module / 'config.sh').read_text(),
                         'INACTIVE_MINUTES=120\nCHECK_INTERVAL=30\nBOOT_GRACE_SECONDS=0\nDRY_RUN=1\n')
        self.assertEqual((self.module / 'config.sh').stat().st_mode & 0o777, 0o600)
        self.assertEqual(list(self.module.glob('.config.*')), [])

    def test_invalid_save_preserves_existing_config(self):
        original = (self.module / 'config.sh').read_bytes()
        for idle in ['0', '43201', '08', '1; touch hacked', '$(touch hacked)']:
            result = self.call('save', idle, '60', '300', '0')
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual((self.module / 'config.sh').read_bytes(), original)
        self.assertFalse((self.module / 'hacked').exists())


if __name__ == '__main__':
    unittest.main()
