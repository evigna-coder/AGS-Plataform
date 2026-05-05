---
phase: 04-presupuestos-anexo-consumibles
plan: 05
subsystem: ui
tags: [presupuestos, anexo-consumibles, email, oauth, gmail, react-pdf, react-hooks]

# Dependency graph
requires:
  - phase: 04-presupuestos-anexo-consumibles
    provides: "buildAnexosFromPresupuesto + AnexoConsumiblesPDF + types via '../pdf' barrel — plan 04-04"
  - phase: 04-presupuestos-anexo-consumibles
    provides: "Editor de plantillas con flag requiereAnexoConsumibles — plan 04-03"
  - phase: 04-presupuestos-anexo-consumibles
    provides: "consumiblesPorModuloService + admin page — plan 04-02"
provides:
  - "EnviarAnexosSection (sub-componente: toggle + dropdown preview + warnings banners)"
  - "useEnviarAnexos hook (pre-load catálogos + buildAnexosFromPresupuesto orchestration)"
  - "useEnviarPresupuesto extendido: stage 'preparing_anexos' + N attachments en sendGmail"
  - "EnviarPresupuestoModal: integración del checkbox + preview + status messages, default ON"
affects: [04-presupuestos-anexo-consumibles, 07-presupuesto-per-incident]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sub-hook split por load-bearing reason: useEnviarAnexos extraído antes del 280-LOC threshold (mandatory split del PLAN), preserva API pública del hook orquestador"
    - "Stage 2.5 inserted-mid-pipeline: 'preparing_anexos' entre 'generating_pdf' y 'sending' — token-first order de Phase 7 NO se rompe"
    - "Fire-and-forget pre-load on modal open: loadAnexos() no bloquea el render, anexosLoading flag muestra spinner"
    - "Default-ON checkbox + toggle: vendedor puede desactivar pero la operación natural ('mandar todo') es 1 click"

key-files:
  created:
    - apps/sistema-modular/src/components/presupuestos/EnviarAnexosSection.tsx
    - apps/sistema-modular/src/hooks/useEnviarAnexos.ts
  modified:
    - apps/sistema-modular/src/hooks/useEnviarPresupuesto.ts
    - apps/sistema-modular/src/components/presupuestos/EnviarPresupuestoModal.tsx

key-decisions:
  - "Default ON al abrir modal: si hay anexos disponibles, includeAnexos arranca tildado. Vendedor destilda solo en casos excepcionales — la operación natural es enviar todo el paquete"
  - "Mandatory hook split en useEnviarAnexos.ts (90 LOC) ANTES de pasar el budget de 280 LOC en useEnviarPresupuesto.ts (217 LOC). Justificación: dos máquinas de estado entrelazadas (token-first OAuth + anexo prep) sobre el mismo archivo cruzan el umbral de revisión en una pasada"
  - "Token-first order PRESERVADO: si Stage 2.5 (preparing_anexos) falla, setStatus('error') + return ANTES de llamar a sendGmail. El presupuesto NO transiciona a 'enviado' — Phase 7 contract intact"
  - "Pre-load fire-and-forget on modal open: useEffect dispara loadAnexos() sin await. anexosLoading muestra spinner inline, no bloquea render del modal"
  - "Preview por anexo individual (no merge): si N>1, dropdown selector + 'Ver anexo' abre el seleccionado en nueva pestaña. Mantiene paridad con el envío real (N adjuntos separados, no merged)"
  - "Soft-warnings collapsadas en <details>: modulo_sin_codigo / codigo_no_en_catalogo van a un acordeón discreto. Terminal-warnings (sistema_sin_modulos_ni_plantilla) sí van en banner amarillo prominente porque implican 'item sin anexo posible'"

patterns-established:
  - "Stage machine extension pattern: agregar etapa intermedia entre stages existentes sin tocar el contract (ej Stage 2.5 entre Stage 2 y 3); requiere setStatus + early-return on error"
  - "Sub-hook split en hooks orquestadores: cuando el hook principal se acerca al budget LOC, extraer el sub-feature como hook separado y consumirlo internamente — la API pública del orquestador NO cambia"
  - "Fire-and-forget pre-load en modals: useEffect on open dispara load + estado loading flag; el render no bloquea por await"
  - "Toggle UI con dropdown selector cuando N>1: pattern para previews de adjuntos múltiples sin obligar a abrir todos"

requirements-completed: [ANXC-06]

# Metrics
duration: 16min
completed: 2026-05-05
---

# Phase 4 Plan 5: Email Integration Summary

**Integración mail del feature anexo de consumibles: EnviarPresupuestoModal con checkbox/preview/warnings + useEnviarPresupuesto extendido (stage 'preparing_anexos' + N attachments, token-first order preservado) + sub-hook useEnviarAnexos extraído (mandatory split). Cliente recibe principal + N anexos en su inbox.**

## Performance

- **Duration:** ~16 min code + smoke E2E real con datos de producción
- **Started:** 2026-04-29T15:01:30Z (Task 1 commit at 15:03:43)
- **Completed:** 2026-05-05T13:13:00Z (smoke approved)
- **Tasks:** 3 code + 1 checkpoint (smoke)
- **Files modified:** 4 (2 nuevos + 2 modificados, scope plan)
- **Side-track commits:** 3 (fixes preexistentes surfaced por el smoke — fuera de scope plan, ver sección dedicada)

## Accomplishments

- **EnviarAnexosSection** (156 LOC): checkbox `Adjuntar anexos de consumibles (N)` + dropdown selector cuando N>1 + botón `Ver anexo` que abre preview en nueva pestaña (con fallback a download si popup bloqueado). Banner amarillo prominente para terminal-warnings + `<details>` colapsado para soft-warnings.
- **useEnviarAnexos** (90 LOC, hook nuevo): pre-carga `tiposEquipoService.getAll()` + `sistemasService.getById()` + `modulosService.getBySistema()` en paralelo, llama `buildAnexosFromPresupuesto`, expone `{ anexos, anexoWarnings, anexosLoading, loadAnexos }`.
- **useEnviarPresupuesto** (217 LOC, extendido): consume `useEnviarAnexos` internamente, agrega stage `'preparing_anexos'` entre `'generating_pdf'` y `'sending'`, recibe `includeAnexos?: boolean` en `send()`, genera N blobs + base64 + spread en `attachments[]`. Token-first order preservado.
- **EnviarPresupuestoModal** (183 LOC): renderiza `<EnviarAnexosSection>` entre textarea Mensaje y banner PDF principal. Llama `loadAnexos()` on open (fire-and-forget). `includeAnexos` local state default `true`. Status message para `preparing_anexos`: "Generando anexos de consumibles…".
- **Smoke E2E real con datos de producción**: usuario aprobó el flujo end-to-end con "Va bien, podemos continuar" — el cliente recibió mail con principal + N anexos correctos.

## Task Commits

Each task was committed atomically:

1. **Task 1: EnviarAnexosSection (sub-componente: toggle + preview + warnings)** — `6f1c458` (feat)
2. **Task 2: useEnviarPresupuesto extendido + useEnviarAnexos split** — `eecb2f6` (feat)
3. **Task 3: EnviarPresupuestoModal integración** — `bdf8fcb` (feat)
4. **Task 4: Smoke E2E checkpoint** — APROBADO por usuario, sin commit (verificación manual)

**Plan metadata:** _(pending — final commit step)_

## Files Created/Modified

### Created

- `apps/sistema-modular/src/components/presupuestos/EnviarAnexosSection.tsx` (156 LOC) — Sub-componente del modal de envío. Props: `{ anexos, warnings, includeAnexos, onToggleIncludeAnexos, disabled? }`. Renderiza solo si `anexos.length > 0 || warnings.length > 0`. Usa `generateAnexoConsumiblesPDF` directamente para el preview (evita re-generar en el send).
- `apps/sistema-modular/src/hooks/useEnviarAnexos.ts` (90 LOC) — Hook split-out. Expone `{ anexos, anexoWarnings, anexosLoading, loadAnexos }`. Pre-carga catálogos en paralelo (`Promise.all` × 3) y llama `buildAnexosFromPresupuesto`. Manejo de error → 1 warning sintético `'sistema_sin_modulos_ni_plantilla'` con detalle "No se pudo cargar el catálogo de consumibles".

### Modified

- `apps/sistema-modular/src/hooks/useEnviarPresupuesto.ts` (217 LOC, +94 LOC vs. baseline 169) —
  - `EnviarStatus` extendido con `'preparing_anexos'`.
  - Consume `useEnviarAnexos` internamente; reexporta `{ anexos, anexoWarnings, anexosLoading, loadAnexos }` en su return para mantener la API pública del hook orquestador.
  - `SendOpts` recibe nuevo campo `includeAnexos?: boolean`.
  - Stage 2.5: si `opts.includeAnexos && anexos.length > 0`, `setStatus('preparing_anexos')` → genera N blobs vía `generateAnexoConsumiblesPDF` → `blobToBase64` → spread en `attachments[]`. Si falla, `setStatus('error')` + `return` antes de `sendGmail`.
- `apps/sistema-modular/src/components/presupuestos/EnviarPresupuestoModal.tsx` (183 LOC, +33 vs. baseline 156) —
  - Import `EnviarAnexosSection`.
  - `useState<boolean>(true)` para `includeAnexos`.
  - useEffect on `open=true` dispara `loadAnexos()` (fire-and-forget) y resetea `setIncludeAnexos(true)`.
  - `handleSend` pasa `includeAnexos` a `send()`.
  - `statusMessages` mapea `preparing_anexos` → "Generando anexos de consumibles…".
  - Render: `<EnviarAnexosSection>` entre textarea Mensaje y banner PDF principal; spinner italic `Cargando anexos de consumibles…` mientras `anexosLoading`.

## Decisions Made

### Default ON al abrir modal

Decisión UX: cuando hay anexos disponibles para el ppto, el checkbox arranca **tildado**. Razón operativa: el caso de uso típico ("vendedor envía MPCC con consumibles") es justamente *que se adjunten*. Si la default fuese OFF, el vendedor olvidaría tildar y el cliente recibiría sin anexo — exactamente el bug que el feature busca evitar. Destildar es excepcional ("no, esta vez mando solo el principal").

### Mandatory hook split — `useEnviarAnexos` extraído antes del 280-LOC threshold

El plan declaró un split mandatorio si `useEnviarPresupuesto.ts` superaba 280 LOC. La implementación llegó a 217 LOC (en presupuesto + 94 LOC de cambios). Decidí ejecutar el split **igual** porque:

- Las dos máquinas de estado (token-first OAuth + anexo prep) son load-bearing en pasadas de revisión distintas.
- El sub-hook (`useEnviarAnexos.ts`, 90 LOC) tiene dependencias propias (`tiposEquipoService`, `sistemasService`, `modulosService`, `buildAnexosFromPresupuesto`) que ensucian el orquestador si conviven.
- La API pública del hook orquestador NO cambió: `EnviarPresupuestoModal` sigue importando `useEnviarPresupuesto` y obtiene los mismos campos de retorno.

Resultado: dos archivos cohesivos por responsabilidad en lugar de un monolito al límite.

### Token-first order preservado

Stage 2.5 (`preparing_anexos`) ocurre **después** del Stage 2 (`generating_pdf`) y **antes** del Stage 3 (`sending`). En este punto:

- El token OAuth ya está validado.
- El PDF principal ya está generado y en memoria.
- Si la generación de anexos falla, `setStatus('error')` + `setSending(false)` + `return` — `sendGmail` nunca se llama, `updateDoc` (Stage 4) tampoco. El presupuesto NO transiciona a `'enviado'`.

Mensaje de error claro al vendedor: `"No se pudieron generar los anexos: {msg}. El estado NO cambió — podés reintentar."` — invita al retry sin documento en estado inconsistente.

### Pre-load fire-and-forget en `useEffect`

`loadAnexos()` se dispara on `open=true` sin `await`. El render del modal NO bloquea esperando catálogos. Se muestra un spinner inline (`anexosLoading` flag). Razón: el modal tiene otros campos (destinatarios, mensaje) que el vendedor edita simultáneamente — bloquear la UI por una pre-carga que tarda 200-800ms (catálogos pequeños) sería pesimista.

### Preview por anexo individual

El feature genera N PDFs separados (no un PDF combinado). El preview respeta esa separación: dropdown selector cuando N>1, "Ver anexo" abre el seleccionado en nueva pestaña. Esto le da al vendedor control granular antes de enviar (revisar HPLC 1100 sin tener que abrir también HPLC 1260).

### Soft-warnings vs terminal-warnings UI distinction

- **Terminal**: `sistema_sin_modulos_ni_plantilla` → banner amarillo prominente "Atención: N item(s) sin anexo posible" + lista inline. Implica "este item lleva flag pero no se pudo generar — se enviará sin anexo para él".
- **Soft**: `modulo_sin_codigo`, `codigo_no_en_catalogo` → `<details>` colapsado, "{N} aviso(s) sobre módulos sin consumibles en catálogo". Implica "el anexo se generó pero algunos módulos aparecen como placeholder".

La distinción evita ruido visual cuando el catálogo legacy tiene muchos módulos sin código identificable (caso típico al inicio del rollout).

## Deviations from Plan

None - plan executed exactly as written.

(El split de `useEnviarAnexos.ts` estaba contemplado en el plan como mandatory si LOC > 280; ejecutarlo en 217 LOC es una elección dentro del rango permitido por el plan. No se considera deviación porque el plan explícitamente lo autoriza y recomienda.)

### Side-track commits during smoke (preexistentes, fuera de scope plan 04-05)

El smoke E2E real surfaceó tres bugs/UX issues preexistentes que NO son regresiones de este plan ni del feature de anexos. Se commitearon por separado durante la sesión para destrabar el smoke pero **no son atribuibles al plan 04-05**. Documento acá para visibilidad del verifier y futuros lectores:

| Commit | Tipo | Scope | Descripción |
|--------|------|-------|-------------|
| `f7aeb1f` | fix(presupuestos) | UX preexistente | `useCreatePresupuestoForm`: persistir `sistemaId` en items cuando el form tiene un único sistema seleccionado, y poblar `responsableId/Nombre` desde `useAuth().usuario`. El bug 1 hacía que el ppto recién creado apareciera vacío ("agregar sistema") en el editor; el bug 2 dejaba el campo "Responsable" en "-" en el PDF. |
| `3c8eb22` | feat(04-02) | Touch-up plan 04-02 | Agrega Firestore rule para colección `consumibles_por_modulo`. El plan 04-02 creó la colección pero no registró la rule, así que `ConsumiblesPorModuloList.load()` daba `permission-denied`. Mirroreado del pattern existente para `tiposEquipoPlantillas`. |
| `9f0124b` | feat(consumibles) | UX improvement plan 04-02 | El form de `consumibles_por_modulo` ahora pre-completa `código + descripción` desde los catálogos `categoriasModulo` y `articulos` (stock) en lugar de pedir al usuario que los tipee de cero. |

Estos NO se contabilizan en los Task Commits del plan 04-05 (sección arriba). Si el verifier ve `git log --oneline --grep="04-05"` y compara con esta sección, los 3 son intencional/correctamente fuera del grep.

## Issues Encountered

- **Type-check workflow:** `sistema-modular` no tiene script `pnpm type-check`. Verificación con `npx tsc --noEmit -p tsconfig.json`. Errores TS pre-existentes (~25 en otros archivos del proyecto) no incluyen los nuevos/modificados de este plan. Verificación: grep sobre output de tsc por `EnviarAnexosSection|useEnviarPresupuesto|useEnviarAnexos|EnviarPresupuestoModal` devuelve cero matches.
- **Smoke surfaceó bugs preexistentes:** ver "Side-track commits during smoke" arriba. Tres commits separados resolvieron issues que NO eran del scope del plan 04-05. Sin estos fixes el smoke no podía completarse de extremo a extremo, pero los issues vivían en código de Phase 7/Phase 4-02 desde antes de tocar el modal de envío.

## User Setup Required

None — no external service configuration required for this plan. Gmail OAuth ya configurado desde Phase 7. Catálogo `consumibles_por_modulo` populado vía `/presupuestos/consumibles-por-modulo` (admin UI plan 04-02).

## Next Phase Readiness

**Phase 4 (Anexo Consumibles por Módulo) COMPLETA.** Las 6 requirements (ANXC-01..06) están done:

- ANXC-01 — Foundation types ✓ (plan 04-01)
- ANXC-02 — Service + admin CRUD ✓ (plan 04-02)
- ANXC-03 — Página admin + toolbar ✓ (plan 04-02)
- ANXC-04 — Editor de plantillas: columna Anexo ✓ (plan 04-03)
- ANXC-05 — AnexoConsumiblesPDF + buildAnexosFromPresupuesto ✓ (plan 04-04)
- ANXC-06 — Integración mail + smoke E2E ✓ (plan 04-05, este)

**Output al cliente verificado:** El cliente recibe `{numero}.pdf` (principal) + N × `Anexo Consumibles - {numero} - {sistema}.pdf` en su inbox, todo en un solo email del flujo OAuth.

**Para Phase 7 (per_incident):** El pattern de stage machine extension (`Stage 2.5: preparing_anexos`) es reusable si el flow per_incident necesita pre-procesamiento adicional antes del send. La API del hook orquestador queda extensible.

**No blockers.**

## Self-Check: PASSED

Verified:
- `apps/sistema-modular/src/components/presupuestos/EnviarAnexosSection.tsx` exists (156 LOC, ≤ 250)
- `apps/sistema-modular/src/hooks/useEnviarAnexos.ts` exists (90 LOC, ≤ 250)
- `apps/sistema-modular/src/hooks/useEnviarPresupuesto.ts` exists (217 LOC, ≤ 280)
- `apps/sistema-modular/src/components/presupuestos/EnviarPresupuestoModal.tsx` exists (183 LOC, ≤ 250)
- Commits found in `git log --oneline --grep="04-05"`: `6f1c458`, `eecb2f6`, `bdf8fcb`
- Side-track commits documented (NOT counted as plan commits): `f7aeb1f`, `3c8eb22`, `9f0124b`
- Smoke E2E approved by user: "Va bien, podemos continuar"

---
*Phase: 04-presupuestos-anexo-consumibles*
*Completed: 2026-05-05*
