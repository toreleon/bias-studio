import { appendFileSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function validateContext({
  ref,
  sha,
  mainSha,
  mainProtected,
  tag,
  appVersion,
  packageVersion,
  smokePassed,
}) {
  if (ref !== "refs/heads/main")
    throw new Error("Releases must run from main.");
  if (!/^[a-f0-9]{40}$/.test(sha || "") || sha !== mainSha)
    throw new Error("Release commit must equal the current main commit.");
  if (mainProtected !== true)
    throw new Error(
      "main must be protected before a release. Run scripts/configure-github.mjs with an administrator login.",
    );
  const match = /^v(\d+\.\d+\.\d+)-rc\.([1-9]\d*)$/.exec(tag || "");
  if (!match || match[1] !== appVersion || match[1] !== packageVersion)
    throw new Error(
      "Use v<app/package version>-rc.<positive number>. Stable production releases are not enabled.",
    );
  if (smokePassed !== "true")
    throw new Error(
      "Confirm real Android and iPhone cutout and WhatsApp smoke tests first.",
    );
}

export function selectCiRun(runs, sha) {
  const candidates = runs
    .filter(
      (run) =>
        run.head_sha === sha &&
        run.head_branch === "main" &&
        run.event === "push" &&
        run.path === ".github/workflows/ci.yml",
    )
    .sort((a, b) => b.id - a.id);
  const run = candidates[0];
  if (!run || run.status !== "completed" || run.conclusion !== "success")
    throw new Error(
      "The latest CI run for this exact main commit must have completed successfully.",
    );
  return run;
}

export function validateApproval(environment) {
  const rule = environment.protection_rules?.find(
    (item) => item.type === "required_reviewers",
  );
  if (!rule?.reviewers?.length)
    throw new Error(
      "Configure required reviewers for the release environment before releasing. Run scripts/configure-github.mjs with an administrator login.",
    );
  if (environment.deployment_branch_policy?.custom_branch_policies !== true)
    throw new Error(
      "The release environment must restrict deployments to main.",
    );
}

export function validateDeploymentBranches(policies) {
  if (
    policies.length !== 1 ||
    policies[0].name !== "main" ||
    policies[0].type !== "branch"
  )
    throw new Error(
      "Only the main branch may deploy to the release environment.",
    );
}

export function validateArtifactList(artifacts, attempt) {
  if (!Number.isSafeInteger(attempt) || attempt < 1)
    throw new Error("A valid CI run attempt is required.");
  for (const base of ["android-test", "ios-simulator", "web-preview"]) {
    const name = `${base}-${attempt}`;
    const matches = artifacts.filter((a) => a.name === name);
    if (
      matches.length !== 1 ||
      matches[0].expired ||
      matches[0].size_in_bytes <= 0
    )
      throw new Error(
        `A single unexpired ${name} artifact is required. Rerun CI if artifacts expired.`,
      );
  }
}

async function main() {
  const repository = process.env.GITHUB_REPOSITORY || process.env.GH_REPO;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || ""))
    throw new Error("A GitHub repository is required.");
  const api = async (path) => {
    const response = await fetch(
      `https://api.github.com/repos/${repository}/${path}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.GH_TOKEN}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );
    if (!response.ok)
      throw new Error(
        `GitHub ${path.split("?")[0]} returned ${response.status}. Verify repository/environment access and protection settings.`,
      );
    return response.json();
  };
  const sha = process.env.SOURCE_SHA || process.env.GITHUB_SHA;
  const tag = process.env.RELEASE_TAG;
  const appVersion = JSON.parse(readFileSync("app.json", "utf8")).expo.version;
  const packageVersion = JSON.parse(
    readFileSync("package.json", "utf8"),
  ).version;
  const branch = await api("branches/main");
  validateContext({
    ref: process.env.GITHUB_REF,
    sha,
    mainSha: branch.commit.sha,
    mainProtected: branch.protected,
    tag,
    appVersion,
    packageVersion,
    smokePassed: process.env.DEVICE_SMOKE_PASSED,
  });
  const response = await api(
    `actions/workflows/ci.yml/runs?branch=main&event=push&head_sha=${sha}&per_page=100`,
  );
  const run = selectCiRun(response.workflow_runs, sha);
  if (
    (process.env.CI_RUN_ID && String(run.id) !== process.env.CI_RUN_ID) ||
    (process.env.CI_RUN_ATTEMPT &&
      String(run.run_attempt) !== process.env.CI_RUN_ATTEMPT)
  )
    throw new Error(
      "The selected CI run or attempt changed during approval. Start a new release review.",
    );
  const { artifacts } = await api(
    `actions/runs/${run.id}/artifacts?per_page=100`,
  );
  validateArtifactList(artifacts, run.run_attempt);
  validateApproval(await api("environments/release"));
  validateDeploymentBranches(
    (await api("environments/release/deployment-branch-policies"))
      .branch_policies,
  );
  const existingTag = await fetch(
    `https://api.github.com/repos/${repository}/git/ref/tags/${tag}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.GH_TOKEN}`,
        Accept: "application/vnd.github+json",
      },
    },
  );
  if (existingTag.status !== 404)
    throw new Error(
      "Tag must not already exist; existing tags/releases are never overwritten.",
    );
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `sha=${sha}\ntag=${tag}\nci_run_id=${run.id}\nci_run_attempt=${run.run_attempt}\n`,
    );
  console.log(
    `Release policy passed for ${tag}, commit ${sha}, CI run ${run.id}.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
