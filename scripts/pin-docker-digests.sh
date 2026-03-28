#!/usr/bin/env bash
# pin-docker-digests.sh — Resolve and pin Docker image tags to SHA256 digests.
# Usage: ./scripts/pin-docker-digests.sh
#
# This script reads all FROM lines in Dockerfiles, resolves each tag to its
# current amd64/linux SHA256 digest, and outputs the pinned FROM lines.
# Review and apply the changes manually or pipe to patch.

set -euo pipefail

IMAGES=(
    "golang:1.21-alpine"
    "alpine:3.21"
    "node:20.11-alpine"
    "nginx:1.27-alpine"
)

for image in "${IMAGES[@]}"; do
    name="${image%%:*}"
    tag="${image##*:}"

    echo "Resolving ${image}..."

    # Get auth token
    token=$(curl -sf "https://auth.docker.io/token?service=registry.docker.io&scope=repository:library/${name}:pull" \
        | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

    if [ -z "$token" ]; then
        echo "  ERROR: Failed to get token for ${name}"
        continue
    fi

    # Get manifest list and extract amd64/linux digest
    digest=$(curl -sf \
        -H "Authorization: Bearer ${token}" \
        -H "Accept: application/vnd.docker.distribution.manifest.list.v2+json" \
        "https://registry-1.docker.io/v2/library/${name}/manifests/${tag}" \
        | python3 -c "
import sys, json
m = json.load(sys.stdin)
for item in m.get('manifests', []):
    p = item.get('platform', {})
    if p.get('architecture') == 'amd64' and p.get('os') == 'linux':
        print(item['digest'])
        break
")

    if [ -n "$digest" ]; then
        echo "  ${image} -> @${digest}"
        echo "  Replace: FROM ${image}"
        echo "  With:    FROM ${image}@${digest}"
    else
        echo "  WARNING: Could not resolve digest for ${image}"
    fi
    echo ""
done

echo "To apply: update Dockerfiles with the pinned digests above."
echo "Re-run this script periodically to update digests."
