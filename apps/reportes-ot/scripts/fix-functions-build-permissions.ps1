# Asigna los roles necesarios para que el build de Cloud Functions pueda ejecutarse.
# Ejecutar desde la raíz del repo o desde apps/reportes-ot.
# Uso: .\scripts\fix-functions-build-permissions.ps1
# Requiere: gcloud instalado y autenticado (gcloud auth login).

$ErrorActionPreference = "Stop"
$PROJECT_ID = "agssop-e7353"

# Obtener project number
$PROJECT_NUMBER = gcloud projects describe $PROJECT_ID --format="value(projectNumber)" 2>$null
if (-not $PROJECT_NUMBER) {
    Write-Error "No se pudo obtener project number. ¿Estás autenticado? gcloud auth login"
}

Write-Host "Proyecto: $PROJECT_ID (number: $PROJECT_NUMBER)"
Write-Host "Asignando roles a las dos cuentas candidatas para el build..."
Write-Host ""

$roles = @(
    "roles/cloudbuild.builds.builder",
    "roles/logging.logWriter",
    "roles/artifactregistry.writer",
    "roles/storage.objectViewer"
)

# 1) Cuenta por defecto de Compute (proyectos nuevos)
$computeSa = "${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
Write-Host "Cuenta Compute: $computeSa"
foreach ($role in $roles) {
    gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$computeSa" --role=$role --quiet 2>$null
    if ($LASTEXITCODE -eq 0) { Write-Host "  OK $role" } else { Write-Host "  Skip/Error $role" }
}

# 2) Cuenta legacy de Cloud Build
$legacySa = "${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
Write-Host ""
Write-Host "Cuenta Cloud Build legacy: $legacySa"
foreach ($role in $roles) {
    gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$legacySa" --role=$role --quiet 2>$null
    if ($LASTEXITCODE -eq 0) { Write-Host "  OK $role" } else { Write-Host "  Skip/Error $role" }
}

Write-Host ""
Write-Host "Hecho. Vuelve a desplegar: cd apps/reportes-ot; firebase deploy --only functions"
Write-Host "Si sigue fallando, revisa el log de Cloud Build y la guía: docs/TROUBLESHOOTING_DEPLOY_FUNCTIONS.md"
