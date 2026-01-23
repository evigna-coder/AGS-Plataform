# Script PowerShell para iniciar Electron paso a paso

Write-Host "🚀 Iniciando AGS Sistema Modular..." -ForegroundColor Cyan

# Verificar si Vite está corriendo
Write-Host "`n📡 Verificando servidor Vite en puerto 3001..." -ForegroundColor Yellow
$viteRunning = Test-NetConnection -ComputerName localhost -Port 3001 -InformationLevel Quiet -WarningAction SilentlyContinue

if (-not $viteRunning) {
    Write-Host "⚠️  Servidor Vite no está corriendo. Iniciando..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; pnpm dev"
    Write-Host "⏳ Esperando 5 segundos para que Vite inicie..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
} else {
    Write-Host "✅ Servidor Vite está corriendo" -ForegroundColor Green
}

# Iniciar Electron
Write-Host "`n🖥️  Iniciando Electron..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; pnpm electron:dev"

Write-Host "`n✅ Proceso completado" -ForegroundColor Green
Write-Host "`n💡 Si la ventana está en blanco:" -ForegroundColor Yellow
Write-Host "   1. Presiona F12 para abrir DevTools" -ForegroundColor Gray
Write-Host "   2. Revisa la consola por errores" -ForegroundColor Gray
Write-Host "   3. Verifica que http://localhost:3001 funcione en el navegador" -ForegroundColor Gray
