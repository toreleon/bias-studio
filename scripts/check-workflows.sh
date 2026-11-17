#!/usr/bin/env bash
set -euo pipefail

ci_tools_dir="$(mktemp -d)"
trap 'rm -rf "$ci_tools_dir"' EXIT
archive="$ci_tools_dir/actionlint.tar.gz"
curl --fail --silent --show-error --location --retry 3 \
  'https://github.com/rhysd/actionlint/releases/download/v1.7.12/actionlint_1.7.12_linux_amd64.tar.gz' \
  --output "$archive"
printf '%s  %s\n' '8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8' "$archive" | sha256sum --check --status
tar -xzf "$archive" -C "$ci_tools_dir" actionlint
# Keep validation consistent across machines; standalone shell scripts use bash -n below.
"$ci_tools_dir/actionlint" -shellcheck= -pyflakes=
bash -n scripts/check-workflows.sh
python3 -m venv "$ci_tools_dir/audit"
"$ci_tools_dir/audit/bin/pip" install --disable-pip-version-check --quiet 'zizmor==1.32.0'
"$ci_tools_dir/audit/bin/zizmor" --offline .github/workflows
