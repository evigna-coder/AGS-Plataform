# Script para desplegar reglas de Firebase
# Ejecutar desde PowerShell: .\deploy-rules.ps1

Write-Host "🚀 Iniciando despliegue de reglas de Firebase..." -ForegroundColor Cyan

# Verificar si Firebase CLI está instalado
try {
    $firebaseVersion = firebase --version
    Write-Host "✅ Firebase CLI instalado: $firebaseVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Firebase CLI no está instalado. Instalando..." -ForegroundColor Yellow
    npm install -g firebase-tools
}

# Verificar autenticación
Write-Host "`n🔐 Verificando autenticación..." -ForegroundColor Cyan
try {
    firebase projects:list | Out-Null
    Write-Host "✅ Autenticado correctamente" -ForegroundColor Green
} catch {
    Write-Host "❌ No estás autenticado. Por favor ejecuta manualmente:" -ForegroundColor Red
    Write-Host "   firebase login" -ForegroundColor Yellow
    Write-Host "`nLuego ejecuta este script nuevamente." -ForegroundColor Yellow
    exit 1
}

# Verificar si el proyecto está configurado
if (-not (Test-Path ".firebaserc")) {
    Write-Host "`n⚙️  Proyecto no configurado." -ForegroundColor Yellow
    Write-Host "Por favor ejecuta manualmente:" -ForegroundColor Yellow
    Write-Host "   firebase use --add" -ForegroundColor Cyan
    Write-Host "Ingresa tu Project ID cuando se solicite (puedes encontrarlo en .env.local como VITE_FIREBASE_PROJECT_ID)" -ForegroundColor Yellow
    exit 1
}

# Verificar que los archivos de reglas existen
if (-not (Test-Path "firestore.rules")) {
    Write-Host "❌ Error: firestore.rules no encontrado" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "storage.rules")) {
    Write-Host "❌ Error: storage.rules no encontrado" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "firebase.json")) {
    Write-Host "❌ Error: firebase.json no encontrado" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ Archivos de reglas encontrados" -ForegroundColor Green

# Desplegar reglas
Write-Host "`n📤 Desplegando reglas de Firestore y Storage..." -ForegroundColor Cyan
try {
    firebase deploy --only firestore:rules,storage:rules
    Write-Host "`n✅ ¡Reglas desplegadas exitosamente!" -ForegroundColor Green
} catch {
    Write-Host "`n❌ Error al desplegar reglas:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host "`n✨ Proceso completado" -ForegroundColor Green
