# Plan: Implementación del Backup (3-2-1 + dossier por cliente)

> Estado: **propuesto** · 2026-06-24 · Owner: Esteban
> Contexto y decisiones previas en memory/project_backup_strategy.md.
> Proyecto Firebase: `agssop-e7353` · Storage bucket: `agssop-e7353.firebasestorage.app`

## Qué respaldar (recordatorio)
- **Firestore** (datos): ~1-5 GB. Cubre TODO lo "generado" (presupuestos/OCs se regeneran del dato).
- **Storage** (archivos): ~300 GB. Informes OT (`reports/`), fotos/adjuntos (`adjuntos/`,`leads/`,`fotosFichas/`), certificados (`certificados/`), adjuntos del cliente al presupuesto (`presupuestos/`).
- Código/reglas/índices: ya en git.

---

## Capa 1 — Red de seguridad en GCP (inmediata, sin código)
Activar HOY. Cubre el 90% de los casos reales (borrado accidental). Costo: centavos.

1. **Firestore Scheduled Backups**
   ```bash
   gcloud firestore backups schedules create --database='(default)' --recurrence=daily  --retention=7d
   gcloud firestore backups schedules create --database='(default)' --recurrence=weekly --day-of-week=SUN --retention=14w
   ```
2. **Storage Object Versioning** + lifecycle para no acumular:
   ```bash
   gcloud storage buckets update gs://agssop-e7353.firebasestorage.app --versioning
   # + regla de ciclo de vida: borrar versiones noncurrent > 90 días
   ```
> Limitación: estos backups viven DENTRO de GCP, no se bajan a disco. Por eso existen las Capas 2 y 3.

---

## Capa 2 — Backup local a disco USB (script + Task Scheduler)
Bucket de export dedicado (crear una vez): `gs://agssop-e7353-backups`.

**Script semanal/diario** (PC siempre encendida + gcloud autenticado):
1. **Firestore (diario)** — export a bucket, bajar, comprimir, rotar:
   ```bash
   FECHA=$(date +%F)
   gcloud firestore export gs://agssop-e7353-backups/firestore/$FECHA
   gsutil -m rsync -r gs://agssop-e7353-backups/firestore/$FECHA  D:/backups/firestore/$FECHA
   tar -czf D:/backups/firestore/$FECHA.tar.gz -C D:/backups/firestore $FECHA && rm -rf D:/backups/firestore/$FECHA
   # rotación: conservar últimos 14 .tar.gz
   ```
2. **Storage / PDFs (semanal, INCREMENTAL)** — solo lo nuevo:
   ```bash
   gsutil -m rsync -r gs://agssop-e7353.firebasestorage.app  D:/backups/storage
   ```
> El rsync es lo que materializa "que no siempre se guarde lo mismo": la 1ª vez baja 300 GB (~US$36 de egress), después solo el delta semanal (pocos GB).

**Esquema escalonado (retención por nivel):**
| Nivel | Qué | Frecuencia | Retención |
|---|---|---|---|
| Diario | Firestore export (.tar.gz) | diario | 14 días |
| Semanal | Storage rsync incremental | semanal | mirror vivo + 12 snapshots |
| Mensual | Verificación íntegra + snapshot consolidado | mensual | 12 meses |

---

## Capa 3 — Offsite (fuera de Google)
Subir el mirror local (o directo desde GCS) con `rclone`. Proveedor a definir:
- **Backblaze B2** (~US$1,8/mes, recuperación rápida) — recomendado si se quiere restaurar fácil.
- **AWS S3 Glacier Deep Archive** (~US$0,30/mes, recuperación lenta) — seguro de catástrofe.
- **GCS Coldline** (~US$1,2/mes) — simple pero sigue en Google.

---

## Job de dossier PDF por cliente (FEATURE APARTE — app-side)
Archivo navegable: una carpeta por cliente con todo (presupuestos, OTs, adjuntos del cliente).
- **Regenerar** presupuestos/OCs con `@react-pdf/renderer` (pure Node, reusa `PresupuestoPDFEstandar`/`PresupuestoPDFContrato`).
- **Copiar** lo que ya es archivo en Storage (informes `reports/`, adjuntos del cliente `presupuestos/`, fotos).
- Árbol: `archivo/{cliente}/presupuestos/`, `/ordenes-trabajo/`, `/adjuntos-cliente/`.
- Trabajo real: ensamblar datos relacionados + resolver qué pertenece a qué cliente + incremental. ~1-2 días.
- **Falta confirmar**: que el PDF de OC a proveedor use también @react-pdf (si es html2canvas, más caro).

---

## Recuperación (runbook)
1. **Firestore**: `gcloud firestore import gs://.../firestore/<fecha>` a una **base de recuperación** → validar → promover/selectivo.
2. **Storage**: `gsutil rsync` inverso desde el mirror, o repuntar a la copia.
3. **Auth**: `firebase auth:export/import`.
4. Simulacro de restore trimestral (un backup no probado no es un backup).

---

## Orden de ejecución
1. **Capa 1** (hoy, Esteban): scheduled backups + versioning. Inmediato.
2. Crear bucket `agssop-e7353-backups` + service account/gcloud en la PC de backup.
3. **Capa 2**: script + Task Scheduler. Primera bajada completa (~300 GB).
4. **Capa 3**: rclone al offsite elegido.
5. Runbook + primer simulacro.
6. **Dossier PDF** (feature aparte, cuando se priorice).

## Decisiones abiertas
- Proveedor offsite (B2 / Glacier / Coldline).
- Quién construye el script de Capa 2 y el job de dossier (Claude / Esteban / mixto).
- Letra de unidad / ruta del disco USB destino.
