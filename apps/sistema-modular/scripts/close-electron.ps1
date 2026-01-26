# Script para cerrar todos los procesos de Electron
Write-Host "🔴 Cerrando procesos de Electron..." -ForegroundColor Yellow

$processes = Get-Process -Name "electron" -ErrorAction SilentlyContinue

if ($processes) {
    foreach ($proc in $processes) {
        Write-Host "   Cerrando proceso PID: $($proc.Id)" -ForegroundColor Gray
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "✅ Procesos de Electron cerrados" -ForegroundColor Green
    Start-Sleep -Seconds 2
} else {
    Write-Host "ℹ️  No hay procesos de Electron corriendo" -ForegroundColor Cyan
}
