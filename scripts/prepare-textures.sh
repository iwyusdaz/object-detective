#!/usr/bin/env bash
# prepare-textures.sh — download CC0 ambientCG PBR sets into data/raw/ (gitignored),
# extract colour / normal (GL) / roughness maps, resize, re-encode as JPEG and copy
# them into public/assets/textures/ with content-hashed names. Writes
# content/textures.json (logical name -> hashed path).
# Requires: curl, unzip, ImageMagick (magick). Usage: bash scripts/prepare-textures.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RAW="$ROOT/data/raw/ambientcg"
OUT="$ROOT/public/assets/textures"
mkdir -p "$RAW" "$OUT"
rm -f "$OUT"/*.jpg

# id:size  (size = output pixel edge)
SETS="WoodFloor043:1024 Plaster001:512 Fabric026:512"
MAPS="Color NormalGL Roughness"
JSON="{"
for entry in $SETS; do
  id="${entry%%:*}"; size="${entry##*:}"
  zip="$RAW/${id}_1K-JPG.zip"
  if [ ! -f "$zip" ]; then
    curl -sSL -A "Mozilla/5.0" -o "$zip" "https://ambientcg.com/get?file=${id}_1K-JPG.zip"
  fi
  mkdir -p "$RAW/$id"
  unzip -oq "$zip" -d "$RAW/$id"
  for m in $MAPS; do
    src="$RAW/$id/${id}_1K-JPG_${m}.jpg"
    [ -f "$src" ] || { echo "missing $src"; exit 1; }
    tmp="$RAW/$id/${id}-${m}-${size}.jpg"
    magick "$src" -resize "${size}x${size}" -strip -quality 82 "$tmp"
    hash=$(shasum -a 256 "$tmp" | cut -c1-10)
    name="${id}-${m}-${hash}.jpg"
    cp "$tmp" "$OUT/$name"
    JSON="$JSON\"${id}_${m}\": \"assets/textures/${name}\","
  done
done
JSON="${JSON%,}}"
printf '%s\n' "$JSON" | python3 -m json.tool > "$ROOT/content/textures.json"
echo "textures written:"; ls -la "$OUT"
