"""Exercise the real shell logic with simulated Android state and monotonic time."""
import pathlib
import shlex
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]


def shell(script, stdin=None):
    source = '. ' + shlex.quote(str(ROOT / 'watchdog.sh')) + '\n'
    return subprocess.run(
        ['sh', '-c', source + script], input=stdin, text=True,
        capture_output=True, check=True,
    ).stdout.strip()


class WatchdogTests(unittest.TestCase):
    def test_legacy_and_current_android_dump(self):
        for value in ['12345', '12345 (67890 ms ago)']:
            with self.subTest(value=value):
                dump = f'Power Manager State:\n  mWakefulness=Asleep\n  mLastWakeTime={value}\n'
                self.assertEqual(shell('parse_power', dump), 'Asleep|12345')

    def test_unsupported_or_incomplete_dump(self):
        for dump in ['Permission denied', 'mWakefulness=Asleep\n',
                     'mWakefulness=Asleep\nmLastWakeTime=unknown\n']:
            self.assertEqual(shell('parse_power', dump), '')

    def test_six_hour_threshold_including_suspend(self):
        self.assertEqual(shell('''
            INACTIVE_MINUTES=360
            reset_idle
            idle_due 'Asleep|100' 300 && echo early
            idle_due 'Dozing|100' 21899 && echo early
            idle_due 'Asleep|100' 21900 && echo due
        '''), 'due')

    def test_wake_between_polls_resets_countdown(self):
        self.assertEqual(shell('''
            INACTIVE_MINUTES=1
            reset_idle
            idle_due 'Asleep|100' 0 && echo early
            idle_due 'Asleep|150' 60 && echo early
            idle_due 'Asleep|150' 119 && echo early
            idle_due 'Asleep|150' 120 && echo due
        '''), 'due')

    def test_active_unknown_and_malformed_states_reset(self):
        for sample in ['Awake|100', 'Dreaming|100', '', 'garbage', 'Asleep|bad']:
            with self.subTest(sample=sample):
                self.assertEqual(shell(f'''
                    INACTIVE_MINUTES=1
                    reset_idle
                    idle_due 'Asleep|100' 0 && echo early
                    idle_due {shlex.quote(sample)} 59 && echo early
                    idle_due 'Asleep|100' 60 && echo early
                    idle_due 'Asleep|100' 120 && echo due
                '''), 'due')

    def test_final_recheck_cancels_reboot_on_wake(self):
        self.assertEqual(shell('''
            INACTIVE_MINUTES=1
            reset_idle
            idle_due 'Asleep|100' 0 && echo early
            idle_due 'Asleep|100' 60 && echo candidate
            idle_due 'Awake|150' 60 && echo reboot
            [ -z "$idle_since" ] && echo cancelled
        '''), 'candidate\ncancelled')

    def test_timer_restarts_after_dry_run_or_new_boot(self):
        self.assertEqual(shell('''
            INACTIVE_MINUTES=1
            reset_idle
            idle_due 'Asleep|100' 100 && echo early
            idle_due 'Asleep|100' 160 && echo due
            reset_idle
            idle_due 'Asleep|100' 161 && echo early
            idle_due 'Asleep|100' 221 && echo due
        '''), 'due\ndue')

    def test_clock_going_backwards_is_conservative(self):
        self.assertEqual(shell('''
            INACTIVE_MINUTES=1
            reset_idle
            idle_due 'Asleep|100' 100 && echo early
            idle_due 'Asleep|100' 50 && echo early
            idle_due 'Asleep|100' 109 && echo early
            idle_due 'Asleep|100' 110 && echo due
        '''), 'due')

    def test_shipped_config_is_valid(self):
        self.assertEqual(shell('. ' + shlex.quote(str(ROOT / 'config.sh')) +
                               '\nvalidate_config && echo valid'), 'valid')

    def test_invalid_settings_are_rejected(self):
        for key, value in [('INACTIVE_MINUTES', '0'), ('INACTIVE_MINUTES', '43201'),
                           ('CHECK_INTERVAL', '4'), ('CHECK_INTERVAL', 'abc'),
                           ('CHECK_INTERVAL', '08'), ('BOOT_GRACE_SECONDS', '-1'),
                           ('DRY_RUN', '2'), ('INACTIVE_MINUTES', '9999999999999')]:
            with self.subTest(key=key, value=value):
                self.assertEqual(shell(f'''
                    INACTIVE_MINUTES=360 CHECK_INTERVAL=60 BOOT_GRACE_SECONDS=300 DRY_RUN=0
                    {key}={shlex.quote(value)}
                    if validate_config; then echo accepted; else echo rejected; fi
                '''), 'rejected')


if __name__ == '__main__':
    unittest.main()
