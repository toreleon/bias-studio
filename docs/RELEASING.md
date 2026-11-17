# CI and release gates

The repository builds and tests both native platforms before a candidate is eligible for release. This is a test-candidate pipeline; it does not publish apps to stores or claim that a simulator build is installable on an iPhone.

## Pull requests and main

`CI` runs on every pull request, main push, merge-queue event, or manual request. There are no path filters that silently skip required checks.

| Job                   | Gate                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Quality               | Lockfile installation, workflow syntax/security audits, lint with zero warnings, TypeScript, domain tests, release-policy tests |
| Browser and web build | Chromium end-to-end scenarios, no flaky-test passes, production web export                                                      |
| Android native build  | Generate the native project, compile the ARM64 release variant, run Android release lint, verify APK signing                    |
| iOS native build      | Generate the native project, install CocoaPods, compile an unsigned Release app for Simulator on macOS                          |
| CI gate               | Fails if any required job failed, was cancelled, or was skipped                                                                 |

Native builds are intentional gates rather than JavaScript-export substitutes. The CI Android artifact is explicitly a **test APK signed with the template debug key**. The iOS artifact is explicitly an **unsigned Simulator app**. Production signing remains separate.

Third-party actions are pinned to reviewed commit SHAs. Workflow permissions default to read-only, checkout does not persist credentials, PR jobs receive no signing secrets, superseded CI runs are cancelled, and native build caches are only written from main. Dependabot proposes action and package updates without merging them automatically. Expo dependency upgrades must stay compatible with the Expo SDK; a passing package update alone is not an SDK migration plan.

## Activate GitHub protections

Repository files cannot activate branch protection or environment approval rules on their own. Run the following in a local checkout with your own administrator GitHub login:

```sh
gh auth login --web
npm run github:protect -- toreleon/bias-studio
```

The setup command applies and verifies this policy:

- Main requires the `CI gate` check from GitHub Actions, with the branch up to date.
- Main requires one fresh pull-request approval, resolves conversations, and uses a linear history. Administrators are included; force pushes and branch deletion are disabled.
- The `release` environment requires approval by the account running setup and accepts only the main branch.

One PR approval requires another collaborator; authors cannot approve their own PRs. Release self-review is allowed in the initial single-maintainer setup. To require separation of duties for releases, add another trusted reviewer and enable GitHub's prevent-self-review option.

The connected app used during setup has contents/actions/workflows permissions but no repository administration permission, so it cannot apply these settings itself. GitHub must also support branch protection and required environment reviewers for your repository's visibility and plan. If GitHub rejects these settings, the release policy remains blocked; it never treats a missing environment or an unprotected branch as an approval. See [protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) and [deployment environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).

## Prepare a candidate

1. Merge the desired code to main through the required checks/review. Wait for all four jobs and `CI gate` to pass for that exact commit.
2. Complete the physical-device checklist in [VERIFICATION.md](VERIFICATION.md) on both Android and iPhone. The dispatcher must confirm cutout quality and WhatsApp pack import; simulator compilation does not establish either.
3. Dispatch the workflow from main, using a new candidate number. The tag's version must match both `package.json` and `app.json`.

```sh
gh workflow run release.yml --ref main \
  -f tag=v1.1.0-rc.1 \
  -f device_smoke_passed=true
```

Use the confirmation only after performing those tests. The workflow also refuses stable tags such as `v1.1.0`, existing tags, a stale commit, failed/pending CI, expired/missing artifacts, unprotected main, or missing release reviewers.

After eligibility passes, approve the pending `release` environment deployment in GitHub. The job downloads the original successful CI artifacts, verifies every file's source SHA, run ID, app version, size and SHA-256 against its build manifest, then rechecks main and protection settings after approval. It creates a new tag at that exact source SHA and a **draft prerelease**, with the APK, Simulator zip, browser-preview zip, checksum file, and build evidence. It never overwrites an existing tag or release, rebuilds a different artifact after approval, or uploads to an app store.

Artifact names and manifests include the CI run attempt, so retries cannot overwrite or silently mix earlier artifacts. Rerun all jobs, rather than only failed jobs, when preparing a release candidate. A CI rerun during approval invalidates that approval cycle. Artifacts expire after 14 days. Rerun CI for the current main commit if necessary. A newer failed/pending CI run blocks eligibility even if an older run passed.

## Production remains closed

A store release needs final identifiers, your production signing credentials, physical-device acceptance, and appropriate store/privacy details. The current candidate workflow intentionally cannot present the template debug key as production signing or a Simulator zip as an IPA. Store submission and production publishing require a separate reviewed pipeline once those prerequisites exist.

## Verify changes locally

```sh
npm run check
npm run test:release
npx playwright install chromium
CI=1 npm run test:e2e
```

The release-policy tests exercise wrong refs/versions, stale commits, missing protection/approvals, wrong or failed CI proof, expired/duplicate artifacts, and altered source/run/checksum evidence. They do not replace GitHub's environment enforcement or native device tests.
