# ========================================================
# RESPIRA - Start Application Script (PowerShell Native)
# Menjalankan Backend Express (Port 5000) dan Frontend Next.js (Port 3000)
# ========================================================

$SCRIPTS_DIR = $PSScriptRoot
if (-not $SCRIPTS_DIR) {
    $SCRIPTS_DIR = (Get-Location).Path
}

$PROJECT_ROOT = Split-Path -Path $SCRIPTS_DIR -Parent
$BACKEND_DIR = Join-Path $PROJECT_ROOT "backend"
$FRONTEND_DIR = Join-Path $PROJECT_ROOT "frontend"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "          MENYALAKAN SISTEM RESPIRA               " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Menyalakan Backend Express
Write-Host "[1/2] Menyalakan Backend Express (Port 5000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$BACKEND_DIR'; npm start"

Start-Sleep -Seconds 2

# 2. Menyalakan Frontend Next.js
Write-Host "[2/2] Menyalakan Frontend Next.js (Port 3000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$FRONTEND_DIR'; npm run dev"

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "  Aplikasi RESPIRA berhasil dijalankan!           " -ForegroundColor Green
Write-Host "  - Frontend : http://localhost:3000              " -ForegroundColor Green
Write-Host "  - Backend  : http://localhost:5000              " -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host "Membuka browser ke http://localhost:3000 ..." -ForegroundColor Cyan

Start-Process "http://localhost:3000"
