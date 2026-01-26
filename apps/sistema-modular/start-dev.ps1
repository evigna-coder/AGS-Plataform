# Script PowerShell para iniciar Vite y Electron
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AGS Sistema Modular - Iniciando" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Cambiar al directorio del script
Set-Location $PSScriptRoot

Write-Host "[1/2] Iniciando servidor Vite..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "Esperando 8 segundos para que Vite compile..." -ForegroundColor Gray
Start-Sleep -Seconds 8

Write-Host ""
Write-Host "[2/2] Iniciando Electron..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; npm run electron:dev" -WindowStyle Normal

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Procesos iniciados:" -ForegroundColor Green
Write-Host "  - Vite: Primera ventana" -ForegroundColor Green
Write-Host "  - Electron: Segunda ventana" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Presiona cualquier tecla para cerrar..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
