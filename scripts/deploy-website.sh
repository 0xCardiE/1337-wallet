#!/usr/bin/env bash
# Build the marketing site and rsync website/out to 1337wallet.io
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
host="${WEBSITE_DEPLOY_HOST:-root@95.216.6.96}"
dest="${WEBSITE_DEPLOY_DEST:-/var/www/1337-wallet/website/out/}"

cd "$root"
npm run website:build
rsync -az --delete -e "ssh -o BatchMode=yes" website/out/ "$host:$dest"
echo "deployed to $host:$dest"
