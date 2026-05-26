#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="${ROOT_DIR}/electron/runtime"

if [[ ! -f "${ROOT_DIR}/.next/standalone/server.js" ]]; then
  echo "Missing .next/standalone/server.js"
  echo "Run: npm run build"
  exit 1
fi

rm -rf "${RUNTIME_DIR}"
mkdir -p "${RUNTIME_DIR}"

cp -R "${ROOT_DIR}/.next/standalone/." "${RUNTIME_DIR}/"
mkdir -p "${RUNTIME_DIR}/.next"
cp -R "${ROOT_DIR}/.next/static" "${RUNTIME_DIR}/.next/static"

if [[ -d "${ROOT_DIR}/public" ]]; then
  cp -R "${ROOT_DIR}/public" "${RUNTIME_DIR}/public"
fi

echo "Prepared Electron runtime bundle at: ${RUNTIME_DIR}"
