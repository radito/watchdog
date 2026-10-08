import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSettings, validateSettings, simulate, formatDuration } from '../web/settings.js';

const defaults = parseSettings(readFileSync(new URL('../config.sh', import.meta.url), 'utf8'));

test('preview reaches the threshold and resets when the screen wakes', () => {
  const config = { ...defaults, INACTIVE_MINUTES: 2 };
  assert.equal(simulate(config, 119, 'idle').due, false);
  assert.equal(simulate(config, 120, 'idle').due, true);
  assert.equal(simulate(config, 120, 'awake').remaining, 120);
  assert.equal(simulate(config, 120, 'awake').progress, 0);
});

test('settings reject shell fragments, missing fields, fractions and out-of-range values', () => {
  for (const value of ['1; reboot', '$(reboot)', '08', '0', '43201', '1.5', '', undefined]) {
    assert.throws(() => validateSettings({ ...defaults, INACTIVE_MINUTES: value }));
  }
  assert.throws(() => parseSettings('INACTIVE_MINUTES=10\n'));
});

test('duration formatting handles long and zero thresholds', () => {
  assert.equal(formatDuration(21600), '06:00:00');
  assert.equal(formatDuration(0), '00:00:00');
  assert.equal(formatDuration(108000), '30:00:00');
});
