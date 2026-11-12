# ========================================================
# RESPIRA - Stop Application Script (PowerShell Native)
# Menghentikan semua proses server Node.js pada port 3000 & 5000
# ========================================================

Write-Host "Menghentikan server RESPIRA..." -ForegroundColor Yellow

# Matikan proses yang mendengarkan di port 3000 dan 5000
$ports = @(3000, 5000)
$stoppedAny = $false

foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($connections) {
        foreach ($conn in $connections) {
            $processId = $conn.OwningProcess
            try {
                Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                Write-Host "Berhasil mematikan proses PID $processId pada port $port" -ForegroundColor Green
                $stoppedAny = $true
            } catch {
                Write-Host "Gagal mematikan proses PID $processId : $_" -ForegroundColor Red
            }
        }
    }
}

# Fallback: jika masih ada proses node terkait respira
$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "Menutup sisa proses Node.js background..." -ForegroundColor Yellow
    $nodeProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
    $stoppedAny = $true
}

if ($stoppedAny) {
    Write-Host "Semua server RESPIRA berhasil dimatikan!" -ForegroundColor Green
} else {
    Write-Host "Tidak ada server RESPIRA yang sedang aktif." -ForegroundColor Cyan
}

Start-Sleep -Seconds 1
