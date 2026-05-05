---
phase: 04-presupuestos-anexo-consumibles
verified: 2026-05-05T13:20:28Z
status: passed
score: 7/7 must-haves verified
re_verification: null
---

# Phase 4: Presupuestos — Anexo Consumibles por Módulo Verification Report

**Phase Goal:** Generar automáticamente un PDF anexo con el listado de consumibles requeridos por módulo cuando un presupuesto incluye servicios marcados con flag `requiereAnexoConsumibles` (operacionalmente: MPCC), matcheando los módulos del sistema seleccionado contra el catálogo `consumibles_por_modulo` por `codigoModulo` exacto (con fallback híbrido módulos reales → plantilla de tipo de equipo), y adjuntando N PDFs separados al email de envío del presupuesto.

**Verified:** 2026-05-05T13:20:28Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                                              | Status     | Evidence                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Un servicio de plantilla puede declarar `requiereAnexoConsumibles=true` (UI + persistencia funciona)                                                               | VERIFIED   | `packages/shared/src/types/index.ts:1393` declara flag opcional. Editor `TipoEquipoNestedEditors.tsx:118` checkbox controlado. Servicio `tiposEquipoService.ts` normaliza (`hydrate`/`create`/`update`). |
| 2   | Existe catálogo Firestore `consumibles_por_modulo` administrable desde UI                                                                                          | VERIFIED   | `consumiblesPorModuloService.ts:5` `COLLECTION='consumibles_por_modulo'`. Página admin en `pages/consumibles-por-modulo/`. Ruta `/presupuestos/consumibles-por-modulo` registrada en `TabContentManager.tsx:95`. Toolbar entry en `PresupuestosList.tsx:281`. Firestore rule presente. |
| 3   | El builder `buildAnexosFromPresupuesto` resuelve módulos vía matcheo híbrido (reales → plantilla) y maneja los 4 casos edge                                        | VERIFIED   | `buildAnexosFromPresupuesto.ts:82` `resolveFuenteModulos` implementa 1) módulos reales con regex Agilent 2) `findPlantillaForSistema` fallback. Casos (i)/(ii)/(iii)/terminal cubiertos en líneas 184-219.    |
| 4   | El componente `AnexoConsumiblesPDF` genera UN PDF por sistema con tokens Editorial Teal liviano                                                                    | VERIFIED   | `AnexoConsumiblesPDF.tsx:202` Document/Page con header (logo + título + ppto + sistema + cliente + fecha) y secciones por módulo. Helper `generateAnexoConsumiblesPDF(data): Promise<Blob>` exportado en línea 239. |
| 5   | Se generan N PDFs separados (uno por item con flag) — NO mergeados                                                                                                  | VERIFIED   | `buildAnexosFromPresupuesto.ts:152-236` itera `presupuesto.items`, crea un `AnexoBuildResult` por item con flag. Filename `Anexo Consumibles - {numero} - {sistema}.pdf` distingue cada uno (línea 223). |
| 6   | El email envía principal + N anexos al inbox del cliente preservando token-first order                                                                              | VERIFIED   | `useEnviarPresupuesto.ts:114-155` Stage 2.5 prepara N blobs entre Stages 2 y 3. Spread `[principal, ...anexoAttachments]` en línea 147. Falla en 2.5 → `setStatus('error')` + return ANTES de `sendGmail` (línea 132). markEnviado solo en línea 165 si `sendGmail` exitoso. |
| 7   | Smoke E2E real con datos de producción aprobado por el usuario                                                                                                      | VERIFIED   | 04-05-SUMMARY.md frontmatter `completed: 2026-05-05`. User aprobó: "Va bien, podemos continuar". Cliente real recibió principal + N anexos en inbox.                                                |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact                                                                                                | Expected                                                  | Status     | Details                                                                                                  |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/types/index.ts`                                                                    | Flag + 2 interfaces                                       | VERIFIED   | `requiereAnexoConsumibles?` línea 1393, `interface ConsumibleModulo` línea 1426, `interface ConsumiblesPorModulo` línea 1441. |
| `apps/sistema-modular/src/services/consumiblesPorModuloService.ts`                                      | CRUD + `getByCodigoModulo` (deepCleanForFirestore)        | VERIFIED   | 113 LOC. `getByCodigoModulo` (línea 66), `deepCleanForFirestore` en create (línea 82) y update (línea 100). Sin cache. NO usa `cleanFirestoreData` shallow. |
| `apps/sistema-modular/src/pages/consumibles-por-modulo/ConsumiblesPorModuloList.tsx`                    | Lista admin con search + CRUD inline                      | VERIFIED   | 180 LOC (≤250 budget). `useUrlFilters({ q })`. Search case-insensitive contra `codigoModulo` + `descripcion`.                          |
| `apps/sistema-modular/src/pages/consumibles-por-modulo/ConsumibleModuloForm.tsx`                        | Form CRUD con tabla editable                              | VERIFIED   | 249 LOC (al borde del budget, ≤250 OK). Validación dup pre-create vía `getByCodigoModulo`. Upgraded en commit `9f0124b` para auto-poblar desde catálogos. |
| `apps/sistema-modular/src/pages/tipos-equipo/TipoEquipoNestedEditors.tsx`                               | Columna "Anexo" en ServiciosEditor                        | VERIFIED   | Checkbox controlado en línea 118 (`s.requiereAnexoConsumibles ?? false`).                                |
| `apps/sistema-modular/src/services/tiposEquipoService.ts`                                               | hydrate defaults flag + create/update normalizan           | VERIFIED   | 6 referencias a `requiereAnexoConsumibles`: hydrate (línea 28), create (línea 62), update (línea 89).                |
| `apps/sistema-modular/src/components/presupuestos/pdf/AnexoConsumiblesPDF.tsx`                          | React-PDF component + helper Blob                          | VERIFIED   | 241 LOC (≤250). Document/Page con header, ModuloSection sub-component, helper `generateAnexoConsumiblesPDF` línea 239. |
| `apps/sistema-modular/src/components/presupuestos/pdf/buildAnexosFromPresupuesto.ts`                    | Builder con matcheo híbrido + casos edge                   | VERIFIED   | 239 LOC (≤250). 4 casos edge cubiertos. Cache lookup por código. No llama Firestore para módulos/plantillas (pre-loaded). |
| `apps/sistema-modular/src/components/presupuestos/EnviarAnexosSection.tsx`                              | Sub-componente checkbox + preview + warnings              | VERIFIED   | 156 LOC. Preview con dropdown selector cuando N>1. Banner amarillo prominente para terminal-warnings. `<details>` colapsado para soft-warnings. |
| `apps/sistema-modular/src/hooks/useEnviarAnexos.ts`                                                     | Sub-hook split (pre-load catálogos)                       | VERIFIED   | 90 LOC (mandatory split ejecutado bajo el threshold de 280 LOC del plan). Pre-carga `tiposEquipoService.getAll` + `sistemasService.getById` + `modulosService.getBySistema` en paralelo. |
| `apps/sistema-modular/src/hooks/useEnviarPresupuesto.ts`                                                | Stage `preparing_anexos` + N attachments + token-first    | VERIFIED   | 217 LOC (≤280). Consume `useEnviarAnexos`, expone `anexos`/`anexoWarnings`/`anexosLoading`/`loadAnexos` (líneas 199-202). Token-first preservado: error en Stage 2.5 → return antes de `sendGmail` (línea 132-135). |
| `apps/sistema-modular/src/components/presupuestos/EnviarPresupuestoModal.tsx`                           | Integra EnviarAnexosSection + statusMessages              | VERIFIED   | 183 LOC (≤250). `loadAnexos()` en useEffect on open (línea 75). `<EnviarAnexosSection>` renderizado en línea 143. `statusMessages.preparing_anexos` mapeado.    |

### Key Link Verification

| From                                                              | To                                                              | Via                                                                            | Status   | Details                                                                                                                                |
| ----------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `TipoEquipoServicio.requiereAnexoConsumibles`                     | `tiposEquipoService` writes (hydrate + create + update)          | `?? false` defaults at all three boundaries                                    | WIRED    | hydrate línea 28, create línea 62, update línea 89.                                                                                   |
| `ConsumiblesPorModulo` interface                                  | `consumiblesPorModuloService` CRUD + `getByCodigoModulo`         | Type imported, COLLECTION snake_case                                           | WIRED    | Imports en línea 2, COLLECTION línea 5.                                                                                                |
| `PresupuestosList` toolbar                                        | `/presupuestos/consumibles-por-modulo`                            | Button onClick `navigateInActiveTab`                                            | WIRED    | `PresupuestosList.tsx:281` botón con label "Consumibles por módulo".                                                                  |
| `TabContentManager`                                               | `ConsumiblesPorModuloList`                                       | `<Route path>` gated by ProtectedRoute                                          | WIRED    | Import línea 30, Route línea 95 con allowedRoles `['admin','admin_soporte','administracion']`.                                         |
| `ServiciosEditor` checkbox                                        | `TipoEquipoServicio.requiereAnexoConsumibles`                    | `update(s.id, 'requiereAnexoConsumibles', e.target.checked)`                   | WIRED    | `TipoEquipoNestedEditors.tsx:118-119`.                                                                                                 |
| `buildAnexosFromPresupuesto`                                      | `consumiblesPorModuloService.getByCodigoModulo`                  | Cached lookup en cierre `lookup`                                               | WIRED    | Import línea 6, llamado en línea 140 dentro del cache.                                                                                 |
| `buildAnexosFromPresupuesto`                                      | `findPlantillaForSistema` (fallback de plantilla)                | `resolveFuenteModulos` línea 97                                                | WIRED    | Import línea 5, uso en línea 97.                                                                                                       |
| `AnexoConsumiblesPDF`                                             | `pdfStyles.ts COLORS` / `pdfFonts.ts Inter`                      | StyleSheet local + import `'./pdfFonts'`                                       | WIRED    | Imports línea 7-8.                                                                                                                     |
| `useEnviarAnexos`                                                 | `buildAnexosFromPresupuesto` + `tiposEquipoService.getAll`        | Pre-loaded catalogs en Promise.all                                             | WIRED    | `useEnviarAnexos.ts:42-69`.                                                                                                            |
| `useEnviarPresupuesto`                                            | `useEnviarAnexos` (sub-hook split)                                | Consumed internally, re-exposes `{ anexos, anexoWarnings, anexosLoading, loadAnexos }` | WIRED | `useEnviarPresupuesto.ts:66-71` consumes; lines 199-202 re-export. API pública preservada. |
| `useEnviarPresupuesto.send` Stage 2.5                             | `generateAnexoConsumiblesPDF` (N blobs)                          | `anexos.map → blobToBase64` then spread into `attachments[]`                   | WIRED    | Lines 121-128 generate + base64; line 147-154 spread into sendGmail attachments.                                                       |
| `EnviarPresupuestoModal`                                          | `EnviarAnexosSection`                                            | Render gated by `anexos.length > 0 \|\| warnings.length > 0`                    | WIRED    | Modal renderiza siempre el componente; el componente devuelve `null` cuando no hay nada (EnviarAnexosSection.tsx:74).                   |
| `sendGmail attachments[]`                                         | `[principal, ...anexoAttachments]`                                | spread N anexos en el array                                                     | WIRED    | `useEnviarPresupuesto.ts:147-154`. `gmailService.ts:34` itera `params.attachments \|\| []`.                                            |

**All 13 key links verified WIRED.**

### Requirements Coverage

| Requirement | Source Plan | Description                                                                                                                                                                | Status      | Evidence                                                                                                                                  |
| ----------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| ANXC-01     | 04-01       | Foundation types: `requiereAnexoConsumibles?` + `ConsumibleModulo` + `ConsumiblesPorModulo`                                                                                | SATISFIED   | `packages/shared/src/types/index.ts:1393, 1426, 1441`. REQUIREMENTS.md marca [x] Complete.                                                |
| ANXC-02     | 04-02       | `consumiblesPorModuloService.ts` CRUD + audit nullables + unicidad                                                                                                          | SATISFIED   | Service 113 LOC; `deepCleanForFirestore`; `getByCodigoModulo` con `where()` + `limit(1)`; ConsumibleModuloForm valida duplicado pre-create. |
| ANXC-03     | 04-02       | Página admin `/presupuestos/consumibles-por-modulo` + entry point en toolbar                                                                                              | SATISFIED   | Route registrada (TabContentManager:95) + button (PresupuestosList:281) + 3 page files. Soft-delete via `activo: data.activo !== false`. |
| ANXC-04     | 04-03       | Editor de plantillas: columna "Anexo" + persistencia                                                                                                                       | SATISFIED   | TipoEquipoNestedEditors:118 checkbox; tiposEquipoService normaliza en hydrate/create/update.                                              |
| ANXC-05     | 04-04       | `AnexoConsumiblesPDF` (Editorial Teal liviano) + `buildAnexosFromPresupuesto` (matcheo híbrido + warnings)                                                                  | SATISFIED   | AnexoConsumiblesPDF.tsx 241 LOC; buildAnexosFromPresupuesto.ts 239 LOC con 4 casos edge; cache lookups; pre-loaded catalogs.              |
| ANXC-06     | 04-05       | Integración mail: `useEnviarPresupuesto` + `EnviarAnexosSection` + smoke E2E checkpoint                                                                                    | SATISFIED   | Sub-hook `useEnviarAnexos` split executed. Stage `preparing_anexos`. Smoke E2E aprobado por usuario 2026-05-05 ("Va bien, podemos continuar"). |

**6/6 requirements SATISFIED.** No orphaned requirements (REQUIREMENTS.md table maps all 6 ANXC-XX to Phase 4 with Complete status).

### Anti-Patterns Found

| File                                                              | Line | Pattern                          | Severity | Impact                                                                                                |
| ----------------------------------------------------------------- | ---- | -------------------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `pages/consumibles-por-modulo/ConsumibleModuloForm.tsx`            | n/a  | 249 LOC — al borde del budget    | Info     | Bajo el límite de 250 LOC. Refactor preventivo recomendable si suma feature, pero no es violation actual. Originalmente 199 LOC; commit `9f0124b` (side-track UX improvement) lo elevó al integrar pre-llenado desde catálogos `categoriasModulo`/`articulos`. |

**No blockers.** Soft-warning solo. No `TODO`/`FIXME`/`HACK`/placeholder en código nuevo. No `: undefined` cerca de Firestore writes (deepCleanForFirestore en uso). Componentes ≤250 LOC budget respetado en todos los archivos. Token-first order de Phase 7 preservado (FMT-02). React 19 + react-pdf compatibility OK.

### Side-track Commits (Documented, NOT penalized)

Per the user's verification brief, three side-track commits were made during plan 04-05 to fix preexisting bugs and add UX/infra improvements that surfaced during the smoke. They are documented in 04-05-SUMMARY.md and explicitly excluded from plan 04-05's task commits:

| Commit    | Type                | Scope                          | Description                                                                                                                                                          |
| --------- | ------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `f7aeb1f` | fix(presupuestos)   | UX preexistente (Phase 7)      | `useCreatePresupuestoForm`: persistir `sistemaId` en items + responsable desde creator. Bug preexistente en flujo create.                                            |
| `3c8eb22` | feat(04-02)         | Touch-up plan 04-02            | Agrega Firestore rule para `consumibles_por_modulo`. Plan 04-02 había omitido esta rule; smoke surfaceó `permission-denied`.                                       |
| `9f0124b` | feat(consumibles)   | UX improvement plan 04-02      | ConsumibleModuloForm pre-completa código + descripción desde catálogos `categoriasModulo` + `articulos` (stock).                                                    |

These commits **improved the result** without being in the original phase scope. The brief instructs not to penalize the phase for them — verifier complies. ConsumibleModuloForm growing to 249 LOC is the only side effect, still within budget.

### Human Verification Required

None. The user already executed and approved the smoke E2E test on 2026-05-05 with the response "Va bien, podemos continuar" (documented in 04-05-SUMMARY.md). The brief explicitly states: "The user already approved a smoke test; treat that as evidence for the human-verification slice. Do not request another smoke."

The smoke covered:
1. Tildar `requiereAnexoConsumibles` en plantilla
2. Editor / persistencia funcional
3. Modal abre + carga anexos
4. Checkbox "Adjuntar anexos" default ON
5. Botón "Ver anexo" abre preview
6. Visual del PDF anexo (header + secciones por módulo)
7. Status flow visible (`Autorizando` → `Generando PDF` → `Generando anexos de consumibles` → `Enviando` → `Email enviado`)
8. Inbox: principal + N anexos llegan
9. Estado del ppto transiciona solo si el envío fue exitoso

### Gaps Summary

**No gaps.** All 7 truths VERIFIED, all 12 artifacts VERIFIED, all 13 key links WIRED, all 6 requirements SATISFIED, no anti-pattern blockers, smoke E2E user-approved.

The phase delivers the full goal end-to-end:
- **Trigger**: flag `requiereAnexoConsumibles` declarable per servicio (UI editor) and persisted (service normalize).
- **Catalog**: `consumibles_por_modulo` Firestore collection with admin CRUD UI + Firestore rule.
- **Matcheo**: `buildAnexosFromPresupuesto` resuelve módulos vía hybrid (módulos reales > plantilla) y casos edge (i/ii/iii/terminal).
- **Render**: `AnexoConsumiblesPDF` Editorial Teal liviano, N PDFs separados (filename diferenciado por sistema).
- **Email**: `useEnviarPresupuesto` Stage 2.5 (`preparing_anexos`) entre PDF principal y `sendGmail`. Token-first order preservado. UI con checkbox default ON, preview por anexo, banners separados terminal vs soft-warnings.
- **Validación humana**: Smoke E2E real con datos de producción APROBADO por usuario 2026-05-05.

Phase 4 is complete and ready to proceed.

---

_Verified: 2026-05-05T13:20:28Z_
_Verifier: Claude (gsd-verifier)_
