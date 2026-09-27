#!/bin/bash
# E & B Hair — Hostinger Node.js Web App build helper
#
# Hostinger runs the Express server, which serves both the Vite build and
# /api routes. This script intentionally only installs and builds; it does not
# upload files, create PHP health checks, or run database migrations.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "============================================"
echo " E and B — Hostinger Node.js Build"
echo "============================================"
echo ""

echo "[1/2] Installing locked dependencies..."
npm ci

echo ""
echo "[2/2] Building the React frontend (Vite)..."
npm run build

echo ""
echo "============================================"
echo " BUILD COMPLETE — configure the Node.js app"
echo "============================================"
echo ""
echo "HOSTINGER NODE.JS WEB APP:"
echo "  Application root: repository root"
echo "  Build command:    npm ci && npm run build"
echo "  Start command:    npm start"
echo "  Server entry:     server/index.js"
echo "  Bind address:     0.0.0.0"
echo "  Port:             Hostinger-provided PORT"
echo ""
echo "No database or secrets are needed. Services and prices come from WubSync."
echo ""
echo "AFTER DEPLOY — VERIFY:"
echo "  - https://eandbhair.co.uk/api/health    → JSON {status:ok}"
echo "  - https://eandbhair.co.uk/api/catalogue → 18+ services, stale:false"
echo "  - https://eandbhair.co.uk/services      → prices and Book Now links"
echo ""
