#!/bin/bash
# Proves components/ui is shadcn's own output: runs `shadcn add` for every component (ui-registry-probe.sh, network)
# into a temp dir and byte-compares each file. Usage: scripts/ui-drift.sh
#   -> ui-drift ok files=63
#   -> ui-drift FAIL <n>: <file> ... (exit 1)
set -euo pipefail
PKG="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT
bash "$PKG/scripts/ui-registry-probe.sh" "$OUT" > /dev/null
bad=()
n=0
for f in "$PKG"/src/components/ui/*.tsx; do
  n=$((n + 1))
  name="$(basename "$f")"
  cmp -s "$f" "$OUT/$name" || bad+=("$name")
done
if [ ${#bad[@]} -gt 0 ]; then
  echo "ui-drift FAIL ${#bad[@]}: ${bad[*]}"
  exit 1
fi
echo "ui-drift ok files=$n"
