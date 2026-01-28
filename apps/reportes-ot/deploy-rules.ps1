# Script para desplegar reglas de Firestore
# Ejecutar desde: apps/reportes-ot/

Write-Host "🔥 Desplegando reglas de Firestore..." -ForegroundColor Yellow

# Verificar que Firebase CLI está instalado
$firebaseInstalled = Get-Command firebase -ErrorAction SilentlyContinue
if (-not $firebaseInstalled) {
    Write-Host "❌ Firebase CLI no está instalado." -ForegroundColor Red
    Write-Host "Instalando Firebase CLI..." -ForegroundColor Yellow
    npm install -g firebase-tools
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error instalando Firebase CLI. Instálalo manualmente: npm install -g firebase-tools" -ForegroundColor Red
        exit 1
    }
}

# Verificar que estás logueado
Write-Host "Verificando login de Firebase..." -ForegroundColor Yellow
firebase projects:list 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  No estás logueado en Firebase o las credenciales expiraron." -ForegroundColor Yellow
    Write-Host "Ejecutando login con reautenticación..." -ForegroundColor Yellow
    firebase login --reauth
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error en el login. Por favor, ejecuta manualmente: firebase login --reauth" -ForegroundColor Red
        exit 1
    }
}

# Desplegar reglas
Write-Host "📤 Desplegando reglas de Firestore..." -ForegroundColor Green
firebase deploy --only firestore:rules

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Reglas desplegadas exitosamente!" -ForegroundColor Green
    Write-Host "Las reglas deberían estar activas ahora. Recarga la aplicación." -ForegroundColor Cyan
} else {
    Write-Host "❌ Error al desplegar reglas. Verifica los errores arriba." -ForegroundColor Red
    exit 1
}
