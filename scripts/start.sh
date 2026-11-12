#!/bin/bash

# ========================================================
# RESPIRA - Start Application Script (Bash)
# ========================================================

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPTS_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

echo "=================================================="
echo "          MENYALAKAN SISTEM RESPIRA               "
echo "=================================================="

cleanup() {
    echo ""
    echo "Menghentikan semua server RESPIRA..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

echo "[1/2] Menyalakan Backend Express (Port 5000)..."
cd "$BACKEND_DIR" || exit 1
npm start &
BACKEND_PID=$!

sleep 2

echo "[2/2] Menyalakan Frontend Next.js (Port 3000)..."
cd "$FRONTEND_DIR" || exit 1
npm run dev &
FRONTEND_PID=$!

echo ""
echo "=================================================="
echo "  Aplikasi RESPIRA berhasil dijalankan!           "
echo "  - Frontend : http://localhost:3000              "
echo "  - Backend  : http://localhost:5000              "
echo "=================================================="
echo "Tekan Ctrl+C untuk mematikan semua server."
echo ""

wait
