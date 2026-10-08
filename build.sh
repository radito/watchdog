#!/bin/sh
set -eu
cd "$(dirname "$0")"
mkdir -p dist
npm run build
version=$(sed -n 's/^version=//p' module.prop)
archive="dist/watchdog-$version.zip"
rm -f "$archive"
zip -qr "$archive" module.prop customize.sh config.sh service.sh watchdog.sh settings.sh README.md webroot
printf 'Built %s\n' "$archive"
