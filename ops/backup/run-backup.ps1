<#
  run-backup.ps1 — Wrapper para Task Scheduler.
  Setea el cert corporativo (Node usa el almacén de Windows) y llama a backup-ags.mjs.

  Uso:
    powershell -ExecutionPolicy Bypass -File run-backup.ps1 -Mode all
    powershell -ExecutionPolicy Bypass -File run-backup.ps1 -Mode firestore
    powershell -ExecutionPolicy Bypass -File run-backup.ps1 -Mode storage

  Editar la sección CONFIG con tu disco y tu service account key.
#>
param(
  [ValidateSet('all', 'firestore', 'storage')]
  [string]$Mode = 'all'
)

# ─────────────── CONFIG (completar) ───────────────
$DEST = 'D:\backups-ags'                 # ← ruta del disco (USB hoy / servidor mañana)
$KEY  = 'C:\ags-backup\sa-key.json'      # ← service account key (Firebase Console)
# ──────────────────────────────────────────────────

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$env:NODE_OPTIONS = '--use-system-ca'    # Node usa el cert store de Windows (Avast OK)

$logDir = Join-Path $DEST 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir ("backup_{0}.log" -f (Get-Date -Format 'yyyy-MM-dd_HHmmss'))

Write-Output "== run-backup $Mode @ $(Get-Date) =="
& node (Join-Path $here 'backup-ags.mjs') "--mode=$Mode" "--dest=$DEST" "--key=$KEY" 2>&1 |
  Tee-Object -FilePath $logFile
exit $LASTEXITCODE
