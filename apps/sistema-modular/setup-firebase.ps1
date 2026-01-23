# Script de ayuda para configurar Firebase

Write-Host "Configuracion de Firebase para Sistema Modular" -ForegroundColor Cyan
Write-Host ""

# Verificar si ya existe .env.local
if (Test-Path ".env.local") {
    Write-Host "Ya existe un archivo .env.local" -ForegroundColor Yellow
    $overwrite = Read-Host "Deseas sobrescribirlo? (s/n)"
    if ($overwrite -ne "s") {
        Write-Host "Operacion cancelada." -ForegroundColor Yellow
        exit
    }
}

Write-Host "Necesitaras las siguientes credenciales de Firebase:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Ve a: https://console.firebase.google.com/" -ForegroundColor White
Write-Host "2. Selecciona tu proyecto" -ForegroundColor White
Write-Host "3. Ve a: Configuracion del proyecto -> Tus aplicaciones" -ForegroundColor White
Write-Host "4. Selecciona tu app web o crea una nueva" -ForegroundColor White
Write-Host "5. Copia las credenciales del objeto firebaseConfig" -ForegroundColor White
Write-Host ""

$apiKey = Read-Host "VITE_FIREBASE_API_KEY"
$authDomain = Read-Host "VITE_FIREBASE_AUTH_DOMAIN"
$projectId = Read-Host "VITE_FIREBASE_PROJECT_ID"
$storageBucket = Read-Host "VITE_FIREBASE_STORAGE_BUCKET"
$messagingSenderId = Read-Host "VITE_FIREBASE_MESSAGING_SENDER_ID"
$appId = Read-Host "VITE_FIREBASE_APP_ID"
$measurementId = Read-Host "VITE_FIREBASE_MEASUREMENT_ID (opcional, presiona Enter para omitir)"

# Crear contenido del archivo
$envContent = @"
# Configuracion de Firebase para Sistema Modular
# Generado automaticamente

VITE_FIREBASE_API_KEY=$apiKey
VITE_FIREBASE_AUTH_DOMAIN=$authDomain
VITE_FIREBASE_PROJECT_ID=$projectId
VITE_FIREBASE_STORAGE_BUCKET=$storageBucket
VITE_FIREBASE_MESSAGING_SENDER_ID=$messagingSenderId
VITE_FIREBASE_APP_ID=$appId
"@

if ($measurementId) {
    $envContent += "`nVITE_FIREBASE_MEASUREMENT_ID=$measurementId"
}

# Escribir archivo
$envContent | Out-File -FilePath ".env.local" -Encoding utf8 -NoNewline

Write-Host ""
Write-Host "Archivo .env.local creado exitosamente!" -ForegroundColor Green
Write-Host ""
Write-Host "Proximos pasos:" -ForegroundColor Cyan
Write-Host "1. Reinicia el servidor de desarrollo" -ForegroundColor White
Write-Host "2. Verifica en la consola que Firebase se inicialice correctamente" -ForegroundColor White
Write-Host "3. Prueba crear un lead en la aplicacion" -ForegroundColor White
Write-Host ""
