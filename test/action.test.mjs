import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const action = readFileSync(new URL('../action.yml', import.meta.url), 'utf8');
const body = action.split('      run: |\n')[1].split('\n').map((line) => line.startsWith('        ') ? line.slice(8) : line).join('\n');
assert.ok(body.includes('PIPESTATUS'), 'The test must execute the composite action script.');

function run(t, overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'vallkey-action-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, 'bin'));
  writeFileSync(join(dir, 'bin/npx'), '#!/bin/sh\nprintf "%s\\0" "$@" > "$ARGUMENTS_FILE"\nprintf "%s\\n" "$SCAN_STDOUT"\nexit "$SCAN_EXIT"\n', { mode: 0o755 });
  writeFileSync(join(dir, 'bin/git'), '#!/bin/sh\nprintf "%s\\n" "$SHALLOW"\n', { mode: 0o755 });
  if (overrides.TEE_EXIT) writeFileSync(join(dir, 'bin/tee'), '#!/bin/sh\n/usr/bin/tee "$@"\nexit "$TEE_EXIT"\n', { mode: 0o755 });
  const result = spawnSync('bash', ['-c', body], {
    cwd: dir, encoding: 'utf8',
    env: { PATH: `${dir}/bin:/usr/bin:/bin`, RUNNER_TEMP: dir, GITHUB_OUTPUT: join(dir, 'output'), ARGUMENTS_FILE: join(dir, 'args'),
      VALLKEY_PATH: '.', VALLKEY_HISTORY: 'false', VALLKEY_FAIL: 'true', VALLKEY_ALLOWLIST: '', VALLKEY_VERSION: '0.8.1',
      SCAN_STDOUT: '', SCAN_EXIT: '0', SHALLOW: 'false', ...overrides },
  });
  return { ...result, dir, output: existsSync(join(dir, 'output')) ? readFileSync(join(dir, 'output'), 'utf8') : '',
    args: existsSync(join(dir, 'args')) ? readFileSync(join(dir, 'args'), 'utf8').split('\0').filter(Boolean) : [] };
}

const finding = '::error file=example.js,line=1,title=API key::Synthetic masked finding';
test('a clean scan succeeds and emits found=0', (t) => {
  const result = run(t);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.output, 'found=0\n');
});
test('findings fail by default and remain reportable in report-only mode', (t) => {
  assert.equal(run(t, { SCAN_STDOUT: finding, SCAN_EXIT: '1' }).status, 1);
  const result = run(t, { SCAN_STDOUT: finding, SCAN_EXIT: '1', VALLKEY_FAIL: 'false' });
  assert.equal(result.status, 0);
  assert.equal(result.output, 'found=1\n');
});
test('operational errors fail even when findings exist and fail=false', (t) => {
  assert.equal(run(t, { SCAN_STDOUT: finding, SCAN_EXIT: '2', VALLKEY_FAIL: 'false' }).status, 2);
  assert.equal(run(t, { SCAN_EXIT: '1', VALLKEY_FAIL: 'false' }).status, 1);
});
test('paths and allowlist names are literal arguments', (t) => {
  const path = 'folder with spaces; touch PWNED';
  const allowlist = 'exceptions $(touch PWNED).json';
  const result = run(t, { VALLKEY_PATH: path, VALLKEY_ALLOWLIST: allowlist, VALLKEY_HISTORY: 'true' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.args, ['--yes', 'vallkey@0.8.1', 'scan', '--history', '--allowlist', allowlist, '--', path]);
  assert.equal(existsSync(join(result.dir, 'PWNED')), false);
});
test('invalid version and boolean inputs fail before the scanner runs', (t) => {
  for (const overrides of [{ VALLKEY_VERSION: 'latest' }, { VALLKEY_VERSION: '0.8.1; touch PWNED' }, { VALLKEY_FAIL: 'FALSE' }, { VALLKEY_HISTORY: 'yes' }]) {
    const result = run(t, overrides);
    assert.equal(result.status, 2);
    assert.deepEqual(result.args, []);
  }
});
test('shallow history is reported explicitly', (t) => {
  assert.match(run(t, { VALLKEY_HISTORY: 'true', SHALLOW: 'true' }).stdout, /checkout is shallow/);
});

test('report output failures cannot produce a successful job', (t) => {
  assert.equal(run(t, { TEE_EXIT: '9' }).status, 9);
  assert.equal(run(t, { GITHUB_OUTPUT: '/nonexistent-vallkey-test-directory/output' }).status, 2);
});
