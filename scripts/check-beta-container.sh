#!/usr/bin/env bash
set -euo pipefail
image_tag="bias-studio-beta:ci"
container_name="bias-beta-check-${RANDOM}-$$"
build_options=()
if [[ -n "${NODE_EXTRA_CA_CERTS:-}" && -f "$NODE_EXTRA_CA_CERTS" ]]; then
  build_options+=(--secret "id=npm_ca,src=$NODE_EXTRA_CA_CERTS")
fi
docker build "${build_options[@]}" -f server/Dockerfile -t "$image_tag" .
trap 'docker rm -f "$container_name" >/dev/null 2>&1 || true' EXIT
# No provider keys, host ports, public network or persistent customer database.
docker run --detach --name "$container_name" --network none --read-only \
  --tmpfs /data:uid=1000,gid=1000,mode=0700,size=32m \
  --cap-drop ALL --security-opt no-new-privileges "$image_tag" >/dev/null
for attempt in {1..30}; do
  if docker exec "$container_name" node -e '
    const r = await fetch("http://127.0.0.1:8788/v1/config");
    const c = await r.json();
    if (!r.ok || c.generation || c.telegram || !c.publicPages) process.exit(1);
  ' >/dev/null 2>&1; then
    echo "Private beta container starts without credentials; unconfigured integrations stay disabled."
    exit 0
  fi
  sleep 1
done
docker logs "$container_name"
exit 1
