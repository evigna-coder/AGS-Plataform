<#
  backup-pull.ps1 — Baja los backups de la nube (Google) al disco E: (Crucial X6).
  Lo dispara el Programador de tareas. rclone usa su propio token (rclone.conf).

  -Mode daily   : baja los dumps de Firestore (la base, chico).
  -Mode weekly  : baja la base + descarga los archivos DIRECTAMENTE RENOMBRADOS
                  (una sola copia, sin carpeta cruda). Ver backup-renamed.mjs.
#>
param([ValidateSet('daily','weekly')][string]$Mode='daily')

$rclone = 'C:\rclone\rclone.exe'
$bucket = 'gcs:agssop-e7353.firebasestorage.app'
$dest   = 'E:\backups-ags'
$here   = Split-Path -Parent $MyInvocation.MyCommand.Path
$logDir = Join-Path $dest 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir ("backup_{0}_{1}.log" -f (Get-Date -Format 'yyyy-MM-dd_HHmmss'), $Mode)

# Siempre: la base (NDJSON) — chico, additive.
& $rclone copy "$bucket/backups/firestore" "$dest\firestore" --log-file $log --log-level INFO

if ($Mode -eq 'weekly') {
  # Archivos de Storage, bajados directamente con nombres legibles (una sola copia).
  $env:NODE_OPTIONS = '--use-system-ca'
  & node (Join-Path $here 'backup-renamed.mjs') "--base=$dest" 2>&1 | Tee-Object -FilePath $log -Append
}
