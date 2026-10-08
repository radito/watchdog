import pathlib
import shlex
import shutil
import subprocess
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]


class ConfigReloadTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.config = pathlib.Path(self.temp.name) / 'config.sh'
        shutil.copy(ROOT / 'config.sh', self.config)

    def tearDown(self):
        self.temp.cleanup()

    def shell(self, code):
        source = '. ' + shlex.quote(str(ROOT / 'watchdog.sh')) + '\n'
        config_path = 'config_path=' + shlex.quote(str(self.config)) + '\n'
        return subprocess.run(['sh', '-c', source + config_path + code],
                              capture_output=True, text=True, check=True).stdout.strip()

    def test_running_timer_uses_changed_config_without_reboot(self):
        self.assertEqual(self.shell('''
            reload_config "$config_path" || exit 1
            idle_due 'Asleep|100' 0 && echo early
            printf 'INACTIVE_MINUTES=1\nCHECK_INTERVAL=5\nBOOT_GRACE_SECONDS=0\nDRY_RUN=1\n' > "$config_path"
            reload_config "$config_path" || exit 1
            echo "$INACTIVE_MINUTES $CHECK_INTERVAL $DRY_RUN"
            idle_due 'Asleep|100' 21600 && echo early
            idle_due 'Asleep|100' 21660 && echo due
        '''), '1 5 1\ndue')

    def test_unchanged_settings_preserve_countdown(self):
        self.assertEqual(self.shell('''
            reload_config "$config_path" || exit 1
            idle_due 'Asleep|100' 0 && echo early
            reload_config "$config_path" || exit 1
            echo "changed=$config_changed"
            idle_due 'Asleep|100' 21600 && echo due
        '''), 'changed=0\ndue')

    def test_incomplete_duplicate_or_executable_config_is_rejected(self):
        for text in ['INACTIVE_MINUTES=1\n',
                     (ROOT / 'config.sh').read_text() + 'DRY_RUN=1\n',
                     (ROOT / 'config.sh').read_text() + 'touch executed\n']:
            self.config.write_text(text)
            self.assertEqual(self.shell('''
                if reload_config "$config_path"; then echo accepted; else echo rejected; fi
            '''), 'rejected')
            self.assertFalse((ROOT / 'executed').exists())


if __name__ == '__main__':
    unittest.main()
