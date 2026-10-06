import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTROL_COOKIE,
  createControlPreference,
  parseControlMode,
} from '../../src/client/control-preference.js';

const location = { href: 'https://example.com/togai/index.html', protocol: 'https:' };

test('control choice accepts only authored modes and writes a scoped cookie', () => {
  for (const value of [undefined, '', 'SCREEN', '<script>', '%6aoystick', 'joystick; Path=/'])
    assert.equal(parseControlMode(value), 'screen');
  const jar = {
    cookie: `togai_progress=unchanged; ${CONTROL_COOKIE}=joystick`,
  };
  const preference = createControlPreference(jar, location);
  assert.equal(preference.mode, 'joystick');
  preference.setMode('screen');
  assert.equal(preference.mode, 'screen');
  assert.match(
    jar.cookie,
    /^togai_controls=screen; Max-Age=31536000; Path=\/togai\/; SameSite=Lax; Secure$/,
  );
});

test('blocked cookies keep the choice for the visit', () => {
  const jar = {
    get cookie() {
      throw new Error('blocked');
    },
    set cookie(value) {
      throw new Error(value);
    },
  };
  const preference = createControlPreference(jar, location);
  preference.setMode('joystick');
  assert.equal(preference.mode, 'joystick');
  assert.equal(preference.saved, false);
});
