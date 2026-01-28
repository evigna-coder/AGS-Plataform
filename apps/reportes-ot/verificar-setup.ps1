# Script de Verificación de Setup - Reportes OT
# Este script verifica que todo esté listo para ejecutar el proyecto

Write-Host "🔍 Verificando configuración del proyecto..." -ForegroundColor Cyan
Write-Host ""

# 1. Verificar Node.js
Write-Host "1. Verificando Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "   ✅ Node.js instalado: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Node.js no está instalado o no está en PATH" -ForegroundColor Red
    Write-Host "   Por favor, instala Node.js desde https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# 2. Verificar npm
Write-Host "2. Verificando npm..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version
    Write-Host "   ✅ npm instalado: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "   ❌ npm no está disponible" -ForegroundColor Red
    exit 1
}

# 3. Verificar directorio
Write-Host "3. Verificando directorio del proyecto..." -ForegroundColor Yellow
if (Test-Path "package.json") {
    Write-Host "   ✅ Estás en el directorio correcto" -ForegroundColor Green
} else {
    Write-Host "   ❌ No se encontró package.json" -ForegroundColor Red
    Write-Host "   Por favor, ejecuta este script desde apps/reportes-ot/" -ForegroundColor Red
    exit 1
}

# 4. Verificar dependencias
Write-Host "4. Verificando dependencias..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "   ✅ node_modules existe" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  node_modules no existe" -ForegroundColor Yellow
    Write-Host "   Ejecutando npm install..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Dependencias instaladas correctamente" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Error al instalar dependencias" -ForegroundColor Red
        exit 1
    }
}

# 5. Verificar archivo .env.local
Write-Host "5. Verificando variables de entorno..." -ForegroundColor Yellow
if (Test-Path ".env.local") {
    Write-Host "   ✅ Archivo .env.local existe" -ForegroundColor Green
    
    # Leer y verificar variables requeridas
    $envContent = Get-Content ".env.local" -Raw
    $requiredVars = @(
        "VITE_FIREBASE_API_KEY",
        "VITE_FIREBASE_AUTH_DOMAIN",
        "VITE_FIREBASE_PROJECT_ID",
        "VITE_FIREBASE_STORAGE_BUCKET",
        "VITE_FIREBASE_MESSAGING_SENDER_ID",
        "VITE_FIREBASE_APP_ID"
    )
    
    $missingVars = @()
    foreach ($var in $requiredVars) {
        if ($envContent -notmatch "$var=") {
            $missingVars += $var
        }
    }
    
    if ($missingVars.Count -eq 0) {
        Write-Host "   ✅ Todas las variables de Firebase están configuradas" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Variables faltantes:" -ForegroundColor Yellow
        foreach ($var in $missingVars) {
            Write-Host "      - $var" -ForegroundColor Yellow
        }
        Write-Host "   Por favor, agrega estas variables a .env.local" -ForegroundColor Yellow
    }
    
    # Verificar Gemini (opcional)
    if ($envContent -match "GEMINI_API_KEY=") {
        Write-Host "   ✅ GEMINI_API_KEY configurada (opcional)" -ForegroundColor Green
    } else {
        Write-Host "   ℹ️  GEMINI_API_KEY no configurada (opcional, solo para optimización de reportes)" -ForegroundColor Gray
    }
} else {
    Write-Host "   ❌ Archivo .env.local no existe" -ForegroundColor Red
    Write-Host "   Por favor, crea el archivo .env.local con las variables de Firebase" -ForegroundColor Red
    Write-Host ""
    Write-Host "   Ejemplo de .env.local:" -ForegroundColor Yellow
    Write-Host "   VITE_FIREBASE_API_KEY=tu_api_key" -ForegroundColor Gray
    Write-Host "   VITE_FIREBASE_AUTH_DOMAIN=tu_auth_domain" -ForegroundColor Gray
    Write-Host "   VITE_FIREBASE_PROJECT_ID=tu_project_id" -ForegroundColor Gray
    Write-Host "   VITE_FIREBASE_STORAGE_BUCKET=tu_storage_bucket" -ForegroundColor Gray
    Write-Host "   VITE_FIREBASE_MESSAGING_SENDER_ID=tu_messaging_sender_id" -ForegroundColor Gray
    Write-Host "   VITE_FIREBASE_APP_ID=tu_app_id" -ForegroundColor Gray
    exit 1
}

# 6. Verificar archivos críticos
Write-Host "6. Verificando archivos del proyecto..." -ForegroundColor Yellow
$criticalFiles = @(
    "App.tsx",
    "index.tsx",
    "index.html",
    "vite.config.ts",
    "tsconfig.json"
)

$allFilesExist = $true
foreach ($file in $criticalFiles) {
    if (Test-Path $file) {
        Write-Host "   ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $file no encontrado" -ForegroundColor Red
        $allFilesExist = $false
    }
}

if (-not $allFilesExist) {
    Write-Host "   ⚠️  Algunos archivos críticos faltan" -ForegroundColor Yellow
}

# 7. Verificar puerto 3000
Write-Host "7. Verificando puerto 3000..." -ForegroundColor Yellow
$portInUse = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "   ⚠️  El puerto 3000 está en uso" -ForegroundColor Yellow
    Write-Host "   Puede que el servidor ya esté corriendo" -ForegroundColor Yellow
} else {
    Write-Host "   ✅ El puerto 3000 está disponible" -ForegroundColor Green
}

# Resumen
Write-Host ""
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "📋 RESUMEN" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

if ($missingVars.Count -eq 0 -and $allFilesExist) {
    Write-Host "✅ Todo está listo para ejecutar el proyecto!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Para iniciar el servidor, ejecuta:" -ForegroundColor Yellow
    Write-Host "   npm run dev" -ForegroundColor White
    Write-Host ""
    Write-Host "Luego abre en tu navegador:" -ForegroundColor Yellow
    Write-Host "   http://localhost:3000" -ForegroundColor White
} else {
    Write-Host "⚠️  Hay algunos problemas que resolver antes de continuar" -ForegroundColor Yellow
    Write-Host "Revisa los mensajes anteriores para más detalles" -ForegroundColor Yellow
}

Write-Host ""
