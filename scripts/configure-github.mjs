// Run locally with a GitHub administrator login. No credentials are written to this project.
import { execFileSync, spawnSync } from 'node:child_process';

const repository = process.argv[2] || 'toreleon/bias-studio';
if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Use owner/repository.');
function api(method, path, body) {
  const result = spawnSync('gh', ['api', '--method', method, path, ...(body ? ['--input', '-'] : [])], { input: body ? JSON.stringify(body) : undefined, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${method} ${path} failed. Use your own gh administrator login and a GitHub plan that supports the requested private-repository protections.\n${result.stderr}`);
  return result.stdout.trim() ? JSON.parse(result.stdout) : {};
}
try {
  const user = api('GET', 'user');
  const actionsApp = api('GET', 'apps/github-actions');
  const repo = api('GET', `repos/${repository}`);
  if (!repo.permissions?.admin) throw new Error('Repository administration access is required.');
  api('PUT', `repos/${repository}/branches/main/protection`, {
    required_status_checks: { strict: true, checks: [{ context: 'CI gate', app_id: actionsApp.id }] },
    enforce_admins: true,
    required_pull_request_reviews: { dismiss_stale_reviews: true, required_approving_review_count: 1, require_last_push_approval: true },
    restrictions: null,
    required_linear_history: true,
    required_conversation_resolution: true,
    allow_force_pushes: false,
    allow_deletions: false,
  });
  api('PUT', `repos/${repository}/environments/release`, {
    wait_timer: 0,
    prevent_self_review: false,
    reviewers: [{ type: 'User', id: user.id }],
    deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
  });
  const { branch_policies: policies } = api('GET', `repos/${repository}/environments/release/deployment-branch-policies`);
  if (policies.some(p => p.name !== 'main' || p.type !== 'branch')) throw new Error('An existing release environment allows other branches/tags. Remove those policies in GitHub before proceeding.');
  if (!policies.length) api('POST', `repos/${repository}/environments/release/deployment-branch-policies`, { name: 'main', type: 'branch' });
  const protection = api('GET', `repos/${repository}/branches/main/protection`);
  const environment = api('GET', `repos/${repository}/environments/release`);
  if (!protection.required_status_checks.checks.some(c => c.context === 'CI gate' && c.app_id === actionsApp.id) || !protection.enforce_admins.enabled || !environment.protection_rules.some(r => r.type === 'required_reviewers' && r.reviewers.length)) throw new Error('Protection verification failed.');
  console.log(`Configured ${repository}: required CI gate, one fresh PR approval, protected main, and release approval by @${user.login}.`);
  console.log('PR authors cannot approve their own PRs; a collaborator is needed for the one-review policy. Release self-review is allowed for the initial solo-maintainer setup.');
  execFileSync('gh', ['repo', 'view', repository, '--json', 'url'], { stdio: 'inherit' });
} catch (error) { console.error(error.message); process.exitCode = 1; }
