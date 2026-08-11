<#
  backup-pull.ps1 — Baja los backups de la nube (Google) al disco E: (Crucial X6).
  Lo dispara el Programador de tareas. rclone usa su propio token (rclone.conf).

  -Mode daily   : baja los dumps de Firestore (la base, chico).
  -Mode weekly  : baja la base + descarga los archivos DIRECTAMENTE RENOMBRADOS
                  (una sola copia, sin carpeta cruda). Ver backup-renamed.mjs.

  Endurecido: si rclone o el paso de archivos falla, la tarea termina con codigo
  de salida != 0 (el Programador la marca en ROJO, no mas falso verde) y deja el
  detalle en E:\backups-ags\ULTIMO-ERROR.txt. En exito, borra ese archivo y
  actualiza E:\backups-ags\ULTIMO-OK.txt (latido para saber de un vistazo que anda).
#>
param([ValidateSet('daily','weekly')][string]$Mode='daily')

$rclone = 'C:\rclone\rclone.exe'
$bucket = 'gcs:agssop-e7353.firebasestorage.app'
$dest   = 'E:\backups-ags'
$here   = Split-Path -Parent $MyInvocation.MyCommand.Path
$logDir = Join-Path $dest 'logs'

$errFile = Join-Path $dest 'ULTIMO-ERROR.txt'
$okFile  = Join-Path $dest 'ULTIMO-OK.txt'

function Fail([string]$msg) {
  $full = "[{0}] modo={1}`r`n{2}`r`n`r`nVer log: {3}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Mode, $msg, $log
  Set-Content -Path $errFile -Value $full -Encoding UTF8
  Write-Host "BACKUP FALLO: $msg" -ForegroundColor Red
  exit 1
}

# Si el disco no esta montado, no tiene sentido seguir (E: es el Crucial X6 externo).
# No podemos escribir el errFile en E: si E: no existe; avisamos por consola y salimos != 0.
if (-not (Test-Path $dest)) {
  Write-Host "BACKUP FALLO: el destino $dest no esta disponible (disco desconectado?)." -ForegroundColor Red
  exit 1
}

New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir ("backup_{0}_{1}.log" -f (Get-Date -Format 'yyyy-MM-dd_HHmmss'), $Mode)

# Siempre: la base (NDJSON) — chico, additive.
& $rclone copy "$bucket/backups/firestore" "$dest\firestore" --log-file $log --log-level INFO
if ($LASTEXITCODE -ne 0) {
  Fail "rclone fallo al bajar los dumps de Firestore (exit=$LASTEXITCODE). Causa tipica: token vencido -> corre 'C:\rclone\rclone.exe config reconnect gcs:'."
}

if ($Mode -eq 'weekly') {
  # Archivos de Storage, bajados directamente con nombres legibles (una sola copia).
  $env:NODE_OPTIONS = '--use-system-ca'
  & node (Join-Path $here 'backup-renamed.mjs') "--base=$dest" 2>&1 | Tee-Object -FilePath $log -Append
  if ($LASTEXITCODE -ne 0) {
    Fail "El paso de archivos (backup-renamed.mjs) fallo (exit=$LASTEXITCODE)."
  }

  # Regeneración de PDFs de presupuestos (los PDF se generan al vuelo en la app,
  # no viven en Storage). Reusa los componentes @react-pdf via ops/backup/pdf-regen.
  # BEST-EFFORT: si falla, avisa en ULTIMO-PDF-WARN.txt pero NO rompe el backup
  # (base + archivos ya se completaron y son la copia crítica).
  $regenDir = Join-Path $here 'pdf-regen'
  if (-not (Test-Path (Join-Path $regenDir 'regen.mjs'))) {
    $regenDir = 'C:\Users\Evigna\Desktop\Ags plataform\ops\backup\pdf-regen'
  }
  $warnFile = Join-Path $dest 'ULTIMO-PDF-WARN.txt'
  if (Test-Path (Join-Path $regenDir 'regen.mjs')) {
    & node (Join-Path $regenDir 'build.mjs') 2>&1 | Tee-Object -FilePath $log -Append
    if ($LASTEXITCODE -eq 0) {
      & node (Join-Path $regenDir 'regen.mjs') "--base=$dest" 2>&1 | Tee-Object -FilePath $log -Append
    }
    if ($LASTEXITCODE -ne 0) {
      $w = "[{0}] Regeneracion de PDFs de presupuestos fallo (exit=$LASTEXITCODE). El backup de base + archivos SI se completo. Ver log: {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $log
      Set-Content -Path $warnFile -Value $w -Encoding UTF8
      Write-Host $w -ForegroundColor Yellow
    } elseif (Test-Path $warnFile) {
      Remove-Item $warnFile -Force
    }
  } else {
    Write-Host "Aviso: no se encontro pdf-regen; se omite la regeneracion de PDFs." -ForegroundColor Yellow
  }
}

# Exito: limpiar la marca de error y dejar latido.
if (Test-Path $errFile) { Remove-Item $errFile -Force }
$okMsg = "[{0}] modo={1} OK. Log: {2}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Mode, $log
Set-Content -Path $okFile -Value $okMsg -Encoding UTF8
Write-Host $okMsg -ForegroundColor Green
