# Opción A: Permitir invocación pública (allUsers). Si tu org lo bloquea, usa Opción B.
# Opción B: Dar invoker a una cuenta de servicio para el proxy de Vercel:
#   .\allow-webauthn-public-invoke.ps1 -ServiceAccount "webauthn-proxy@agssop-e7353.iam.gserviceaccount.com"
# Ver docs/WEBAUTHN_PROXY_SERVICE_ACCOUNT.md para crear la SA y WEBAUTHN_PROXY_SA_KEY en Vercel.

param(
  [string]$ServiceAccount = ""
)

$ErrorActionPreference = "Stop"
$ProjectId = "agssop-e7353"
$Region = "us-central1"
$FunctionName = "webauthn"

if ($ServiceAccount) {
  Write-Host "Agregando invoker policy a la cuenta de servicio $ServiceAccount..." -ForegroundColor Cyan
  gcloud functions add-invoker-policy-binding $FunctionName --member="serviceAccount:$ServiceAccount" --region=$Region --project=$ProjectId
  Write-Host "Listo. Configura WEBAUTHN_PROXY_SA_KEY en Vercel con la clave JSON de esta cuenta. Ver docs/WEBAUTHN_PROXY_SERVICE_ACCOUNT.md" -ForegroundColor Green
} else {
  Write-Host "Agregando invoker policy (allUsers) a la función $FunctionName..." -ForegroundColor Cyan
  try {
    gcloud functions add-invoker-policy-binding $FunctionName --member=allUsers --region=$Region --project=$ProjectId
    Write-Host "Listo. La función puede recibir peticiones HTTP públicas." -ForegroundColor Green
  } catch {
    Write-Host "Si tu org no permite allUsers, usa una cuenta de servicio: .\allow-webauthn-public-invoke.ps1 -ServiceAccount 'webauthn-proxy@agssop-e7353.iam.gserviceaccount.com'" -ForegroundColor Yellow
    Write-Host "Ver docs/WEBAUTHN_PROXY_SERVICE_ACCOUNT.md" -ForegroundColor Yellow
    throw
  }
}
