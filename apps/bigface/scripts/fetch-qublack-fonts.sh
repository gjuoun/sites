#!/usr/bin/env bash
# Cut the QuBlack web fonts the business showcase (/ui/business/) serves, from a pinned release.
#
# Source: github.com/gjuoun/qublack release v1.2.0 (the variable release). Each release file is checked against that
# release's SHA256SUMS before it is used. The output is Latin only (the showcase is English), keeps the weight axis of
# the variable faces, and is written as woff2 into public/fonts/qublack/.
#
#   scripts/fetch-qublack-fonts.sh
#
# Needs curl and python3 with fonttools and brotli (uv is used when present, as in apps/qublack).
set -euo pipefail

cd "$(dirname "$0")/.."
TAG=v1.2.0
BASE="https://github.com/gjuoun/qublack/releases/download/$TAG"
OUT=public/fonts/qublack
UNI='U+0000-00FF,U+0100-017F,U+2000-206F,U+20A0-20CF,U+2122,U+2212,U+2215'

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

curl -fsSL -o "$work/SHA256SUMS" "$BASE/SHA256SUMS"

# fetch <release asset> <name in SHA256SUMS> : downloads the asset and checks its hash against the release sums
fetch() {
  curl -fsSL -o "$work/$1" "$BASE/$1"
  local want got
  want=$(awk -v n="$2" '$2 == n { print $1 }' "$work/SHA256SUMS")
  got=$(shasum -a 256 "$work/$1" | cut -d' ' -f1)
  [ -n "$want" ] && [ "$got" = "$want" ] || { echo "checksum mismatch: $1"; exit 1; }
}

fetch QuBlackSans.wght.ttf 'QuBlackSans[wght].ttf'
fetch QuBlackMono.wght.ttf 'QuBlackMono[wght].ttf'
fetch QuBlackSans-Italic.woff2 QuBlackSans-Italic.woff2

PY=(python3)
if command -v uv >/dev/null 2>&1; then PY=(uv run --quiet --with fonttools --with brotli python3); fi

mkdir -p "$OUT"
cut_latin() {
  "${PY[@]}" -m fontTools.subset "$1" --unicodes="$UNI" --layout-features='*' --flavor=woff2 --output-file="$OUT/$2"
  printf '%8s  %s\n' "$(wc -c < "$OUT/$2" | tr -d ' ')" "$OUT/$2"
}

cut_latin "$work/QuBlackSans.wght.ttf" QuBlackSans-Latin-VF.woff2
cut_latin "$work/QuBlackMono.wght.ttf" QuBlackMono-Latin-VF.woff2
cut_latin "$work/QuBlackSans-Italic.woff2" QuBlackSans-Italic-Latin.woff2
