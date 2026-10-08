import test from 'node:test';
import assert from 'node:assert/strict';
import { createSkinPreference, SKIN_COOKIE } from '../../src/client/skin-preference.js';

const location = { href: 'https://example.com/togai/index.html', protocol: 'https:' };

test('skin cookie accepts only authored IDs and uses a host-only project-scoped cookie', () => {
  const jar = { cookie: `unrelated=keep; ${SKIN_COOKIE}=peugeot-206-cc` };
  const preference = createSkinPreference(jar, location);
  assert.equal(preference.skin.id, 'peugeot-206-cc');
  preference.select('classic');
  assert.equal(preference.skin.id, 'classic');
  assert.equal(
    jar.cookie,
    'togai_skin=classic; Max-Age=31536000; Path=/togai/; SameSite=Lax; Secure',
  );
  assert.equal(preference.saved, true);
  preference.select('peugeot-206-cc');
  assert.equal(createSkinPreference(jar, location).skin.id, 'peugeot-206-cc');
});

test('malformed and oversized IDs cannot inject markup, cookie attributes or object properties', () => {
  for (const value of [
    '',
    '<img src=x onerror=alert(1)>',
    '__proto__',
    'constructor',
    '%70eugeot-206-cc',
    'x'.repeat(10000),
  ]) {
    const preference = createSkinPreference({ cookie: `${SKIN_COOKIE}=${value}` }, location);
    assert.equal(preference.skin.id, 'classic');
    const jar = { cookie: '' };
    const selected = createSkinPreference(jar, location);
    selected.select(value);
    assert.equal(selected.skin.id, 'classic');
    assert.equal(
      jar.cookie,
      'togai_skin=classic; Max-Age=31536000; Path=/togai/; SameSite=Lax; Secure',
    );
  }
  const jar = { cookie: '' };
  const preference = createSkinPreference(jar, location);
  preference.select('peugeot-206-cc; Path=/');
  assert.equal(preference.skin.id, 'classic');
  assert.equal(
    jar.cookie,
    'togai_skin=classic; Max-Age=31536000; Path=/togai/; SameSite=Lax; Secure',
  );
});

test('blocked and silently rejected cookies preserve an in-memory selection and report failure', () => {
  for (const jar of [
    {
      get cookie() {
        throw new Error('blocked');
      },
      set cookie(_value) {
        throw new Error('blocked');
      },
    },
    {
      get cookie() {
        return '';
      },
      set cookie(_value) {},
    },
  ]) {
    const preference = createSkinPreference(jar, location);
    preference.select('peugeot-206-cc');
    assert.equal(preference.skin.id, 'peugeot-206-cc');
    assert.equal(preference.saved, false);
  }
});

test('HTTP development stores the preference without Secure', () => {
  const jar = { cookie: '' };
  createSkinPreference(jar, { href: 'http://localhost:5173/', protocol: 'http:' }).select(
    'peugeot-206-cc',
  );
  assert.equal(jar.cookie, 'togai_skin=peugeot-206-cc; Max-Age=31536000; Path=/; SameSite=Lax');
});
