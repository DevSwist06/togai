import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const paths = [];
  for (const e of entries) {
    const path = join(dir, e.name);
    if (e.isDirectory()) paths.push(...(await files(path)));
    else paths.push(path);
  }
  return paths;
}
test('source excludes common secret signatures and runtime code execution sinks', async () => {
  const roots = ['src', 'public', 'scripts'];
  for (const root of roots)
    for (const file of await files(root)) {
      const source = await readFile(file, 'utf8');
      assert(
        !/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u.test(source),
        `${file}: private key`,
      );
      assert(
        !/\b(?:AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{36,}|sk-(?:proj-)?[A-Za-z0-9_-]{40,})\b/u.test(
          source,
        ),
        `${file}: credential signature`,
      );
      if (root === 'src' || root === 'public')
        assert(
          !/\b(?:eval\s*\(|new\s+Function\s*\()/u.test(source),
          `${file}: dynamic code execution`,
        );
    }
});
test('HTML contains no inline script or event handlers', async () => {
  const html = await readFile('public/index.html', 'utf8');
  assert(!/\son\w+\s*=/iu.test(html));
  assert(!/<script(?![^>]*\bsrc=)[^>]*>/iu.test(html));
});
test('no focused or skipped tests are committed', async () => {
  for (const file of await files('tests')) {
    const source = await readFile(file, 'utf8');
    assert(
      !/\b(?:test|it|describe)\.(?:only|skip|todo)\s*\(/u.test(source),
      `${file}: disabled or focused test`,
    );
  }
});
