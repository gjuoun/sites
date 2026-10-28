#!/bin/bash
# Writes the shadcn registry output for every components/ui file to <out>/<name>.tsx.
# One `shadcn add <name> --overwrite` per file, in a scratch project that carries this package's components.json,
# tsconfig and styles, because the CLI's own output (use-client prologue, icon placeholders) depends on the add being
# a single direct target. Needs the network. Usage: scripts/ui-registry-probe.sh <out-dir>
set -euo pipefail
OUT="${1:?usage: ui-registry-probe.sh <out-dir>}"
PKG="$(cd "$(dirname "$0")/.." && pwd)"
SCRATCH="$(mktemp -d)"
trap 'rm -rf "$SCRATCH"' EXIT
mkdir -p "$OUT" "$SCRATCH/src/lib" "$SCRATCH/src/styles"
cp "$PKG/components.json" "$PKG/tsconfig.json" "$SCRATCH/"
cp "$PKG/src/styles/styles.css" "$SCRATCH/src/styles/"
cp "$PKG/src/lib/utils.ts" "$SCRATCH/src/lib/"
echo '{"name":"ui-registry-probe","private":true,"type":"module"}' > "$SCRATCH/package.json"
cd "$SCRATCH"
for f in "$PKG"/src/components/ui/*.tsx; do
  n="$(basename "$f" .tsx)"
  rm -rf src/components/ui src/hooks
  bunx --bun shadcn@4.22.1 add "$n" -y -o -s > /dev/null 2>&1
  cp "src/components/ui/$n.tsx" "$OUT/$n.tsx"
done
echo "registry: $(ls "$OUT" | wc -l | tr -d ' ') files in $OUT"
