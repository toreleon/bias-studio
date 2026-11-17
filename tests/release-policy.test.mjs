import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { validateContext, selectCiRun, validateApproval, validateDeploymentBranches, validateArtifactList } from '../scripts/release-policy.mjs';

const sha = 'a'.repeat(40);
const valid = { ref: 'refs/heads/main', sha, mainSha: sha, mainProtected: true, tag: 'v1.0.0-rc.1', appVersion: '1.0.0', packageVersion: '1.0.0', smokePassed: 'true' };
const run = { id: 10, head_sha: sha, head_branch: 'main', event: 'push', path: '.github/workflows/ci.yml', status: 'completed', conclusion: 'success' };
test('valid main candidate is eligible', () => assert.doesNotThrow(() => validateContext(valid)));
test('release rejects wrong branches, stale commits, unprotected main, and missing device signoff', () => {
  for (const change of [{ ref: 'refs/heads/feature' }, { mainSha: 'b'.repeat(40) }, { mainProtected: false }, { smokePassed: 'false' }]) assert.throws(() => validateContext({ ...valid, ...change }));
});
test('production tags, shell payloads, and version mismatches cannot become test candidates', () => {
  for (const tag of ['v1.0.0', 'v1.0.0-rc.0', 'v1.0.0-rc.01', 'v2.0.0-rc.1', 'v1.0.0-rc.1; echo unsafe']) assert.throws(() => validateContext({ ...valid, tag }));
  assert.throws(() => validateContext({ ...valid, packageVersion: '0.9.0' }));
});
test('newer failed or pending CI cannot fall back to an older successful run', () => {
  assert.equal(selectCiRun([run], sha).id, run.id);
  assert.throws(() => selectCiRun([run, { ...run, id: 11, conclusion: 'failure' }], sha));
  assert.throws(() => selectCiRun([run, { ...run, id: 11, status: 'in_progress', conclusion: null }], sha));
});
test('CI proof must come from the right workflow, commit, branch and event', () => {
  for (const change of [{ head_sha: 'b'.repeat(40) }, { head_branch: 'feature' }, { event: 'pull_request' }, { path: '.github/workflows/other.yml' }]) assert.throws(() => selectCiRun([{ ...run, ...change }], sha));
});
test('approval and deployment policy are mandatory, not an implicitly created environment', () => {
  const environment = { protection_rules: [{ type: 'required_reviewers', reviewers: [{ id: 1 }] }], deployment_branch_policy: { custom_branch_policies: true } };
  assert.doesNotThrow(() => validateApproval(environment));
  assert.throws(() => validateApproval({}));
  assert.throws(() => validateApproval({ ...environment, deployment_branch_policy: null }));
  assert.doesNotThrow(() => validateDeploymentBranches([{ name: 'main', type: 'branch' }]));
  assert.throws(() => validateDeploymentBranches([{ name: '*', type: 'branch' }]));
  assert.throws(() => validateDeploymentBranches([{ name: 'main', type: 'tag' }]));
});
test('expired, duplicate, missing and empty CI artifacts block release', () => {
  const artifacts = ['android-test', 'ios-simulator', 'web-preview'].map(name => ({ name, expired: false, size_in_bytes: 10 }));
  assert.doesNotThrow(() => validateArtifactList(artifacts));
  assert.throws(() => validateArtifactList(artifacts.slice(1)));
  assert.throws(() => validateArtifactList([...artifacts, artifacts[0]]));
  assert.throws(() => validateArtifactList(artifacts.map((a, i) => i === 0 ? { ...a, expired: true } : a)));
  assert.throws(() => validateArtifactList(artifacts.map((a, i) => i === 0 ? { ...a, size_in_bytes: 0 } : a)));
});
test('downloaded bytes, source SHA and run ID must match the build evidence', () => {
  const directory = mkdtempSync(join(tmpdir(), 'bias-release-'));
  const fixtures = [['android', 'android-test', 'bias-studio-arm64-test.apk'], ['ios', 'ios-simulator', 'bias-studio-ios-simulator.zip'], ['web', 'web', 'bias-studio-web-preview.zip']];
  const script = resolve('scripts/verify-release-artifacts.mjs');
  try {
    writeFileSync(join(directory, 'app.json'), JSON.stringify({ expo: { version: '1.0.0' } }));
    for (const [folder, kind, filename] of fixtures) {
      const target = join(directory, 'incoming', folder); mkdirSync(target, { recursive: true });
      const bytes = Buffer.from(`test fixture ${kind}`); writeFileSync(join(target, filename), bytes);
      writeFileSync(join(target, 'build-info.json'), JSON.stringify({ schema: 1, kind, sha, runId: '123', version: '1.0.0', artifact: filename, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }));
    }
    const verify = overrides => spawnSync(process.execPath, [script], { cwd: directory, env: { ...process.env, SOURCE_SHA: sha, CI_RUN_ID: '123', ...overrides }, encoding: 'utf8' });
    assert.equal(verify().status, 0);
    assert.equal(JSON.parse(readFileSync(join(directory, 'release', 'build-evidence.json'))).length, 3);
    assert.notEqual(verify({ SOURCE_SHA: 'b'.repeat(40) }).status, 0);
    assert.notEqual(verify({ CI_RUN_ID: '124' }).status, 0);
    writeFileSync(join(directory, 'incoming/android/bias-studio-arm64-test.apk'), 'tampered bytes');
    assert.notEqual(verify().status, 0);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
