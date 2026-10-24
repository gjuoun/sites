#!/usr/bin/env bash
# Produce the web-font shards the site needs, from the published font release.
#
# The woff2 cut is NOT committed (564 shards, ~25 MB of CJK): it is derived from the release asset
# on every build, exactly as the source repo's deploy did. The font *design* pipeline
# (build_all.py, fonts/, reference/) stays in gjuoun/qublack — only the step that serves the site
# lives here.
#
#   scripts/fetch-fonts.sh          cut the shards and rewrite src/styles/qublack-fonts.css
#   scripts/fetch-fonts.sh --check  verify the committed css still matches a fresh cut
#
# Needs python3 + `pip install -r tools/requirements.txt` (fonttools, brotli).
set -euo pipefail

cd "$(dirname "$0")/.."
# Always the latest published release unless pinned explicitly (FONTS_TAG=v1.2.1 .../fetch-fonts.sh).
if [ -n "${FONTS_TAG:-}" ]; then
  TAG="$FONTS_TAG"
else
  # curl first: works everywhere (runners have gh installed but unauthenticated)
  TAG=$(curl -fsSL https://api.github.com/repos/gjuoun/qublack/releases/latest \
    | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p')
  [ -n "$TAG" ] || TAG=$(gh api repos/gjuoun/qublack/releases/latest --jq .tag_name 2>/dev/null) || true
fi
[ -n "$TAG" ] || { echo "cannot resolve the latest font release tag" >&2; exit 1; }
VER=${TAG#v}   # the tag carries the v, the release assets do not
BASE="https://github.com/gjuoun/qublack/releases/download/$TAG"
CHECK=""
[ "${1:-}" = "--check" ] && CHECK="--check"

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

ZIP="QuBlack-family-$VER.zip"
echo "fetching $TAG ($ZIP)"
curl -fsSL -o "$work/$ZIP" "$BASE/$ZIP"
curl -fsSL -o "$work/SHA256SUMS" "$BASE/SHA256SUMS"

# The release ships ttf + woff2 + zip; only the zip's line is ours to check.
( cd "$work" && grep 'QuBlack-family-.*\.zip$' SHA256SUMS | shasum -a 256 -c - >/dev/null )

mkdir -p "$work/fonts"
unzip -q -o "$work/$ZIP" '*.ttf' -d "$work/fonts"
ttf=$(ls "$work/fonts"/*.ttf | wc -l | tr -d ' ')
[ "$ttf" -gt 0 ] || { echo "no ttf in the release zip"; exit 1; }

mkdir -p public/fonts
# fonttools is only needed here, so it is injected rather than installed globally (the same shape
# bigface-theme uses for its brand export). CI installs tools/requirements.txt and has plain python3.
if command -v uv >/dev/null 2>&1; then
  PY=(uv run --quiet --with fonttools --with brotli python3)
else
  PY=(python3)
fi
"${PY[@]}" tools/web_fonts.py \
  --fonts "$work/fonts" \
  --out public/fonts \
  --css src/styles/qublack-fonts.css \
  --site src \
  $CHECK

shards=$(ls public/fonts/*.woff2 2>/dev/null | wc -l | tr -d ' ')
echo "fonts: $shards shard(s) from $ttf ttf"
