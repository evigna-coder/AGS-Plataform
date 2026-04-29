---
phase: 04-presupuestos-anexo-consumibles
plan: 04
subsystem: ui
tags: [react-pdf, presupuestos, anexo-consumibles, hplc, agilent, pdf-generation]

# Dependency graph
requires:
  - phase: 04-presupuestos-anexo-consumibles
    provides: "Foundation types (ConsumibleModulo, ConsumiblesPorModulo, requiereAnexoConsumibles flag) — plan 04-01"
  - phase: 04-presupuestos-anexo-consumibles
    provides: "consumiblesPorModuloService.getByCodigoModulo() — plan 04-02"
provides:
  - AnexoConsumiblesPDF react-pdf component (Editorial Teal liviano) for single-system attachment
  - generateAnexoConsumiblesPDF(data) helper that returns Promise<Blob>
  - buildAnexosFromPresupuesto orchestrator with hybrid module matching (real modules → plantilla fallback)
  - 4-case edge handling (sin código, código no en catálogo, lista vacía intencional, terminal)
  - Warning system for caller (modal envío) to surface to vendedor
affects: [04-presupuestos-anexo-consumibles]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pre-loaded catalogs as input (modulosBySistema, plantillas) — caller does Firestore loads, builder is pure(ish)"
    - "In-function lookup cache (Map<codigo, ConsumibleModulo[] | null>) with null-sentinel for 'looked-up-not-found'"
    - "Light-variant Editorial Teal PDF tokens via local StyleSheet on top of baseStyles.page"
    - "Sub-component extraction (ModuloSection) to keep top-level component readable"

key-files:
  created:
    - apps/sistema-modular/src/components/presupuestos/pdf/AnexoConsumiblesPDF.tsx
    - apps/sistema-modular/src/components/presupuestos/pdf/buildAnexosFromPresupuesto.ts
  modified:
    - apps/sistema-modular/src/components/presupuestos/pdf/index.ts

key-decisions:
  - "Detección de 'código de módulo' en módulos reales: regex Agilent /^[A-Z][0-9]{3,5}[A-Z]?$/ sobre mod.nombre.trim() (ModuloSistema no tiene campo partNumber explícito)"
  - "Flag requiereAnexoConsumibles se respeta si CUALQUIER plantilla con mismo servicioCode lo marca (previene falsos negativos por servicioCode duplicado entre HPLC 1260 / 1260 Infinity)"
  - "Builder NO llama Firestore para módulos ni plantillas: recibe modulosBySistema + plantillas pre-cargados del caller (mismo patrón que generatePresupuestoPDF.tsx líneas 88-105)"
  - "Lookup consumibles_por_modulo SÍ se hace inline (chico, cacheado por código en memoria — null-sentinel para 'not found')"
  - "ModuloSection extraído como sub-componente colocado en mismo archivo: mantiene AnexoConsumiblesPDF a 241 líneas (≤ 250, regla components.md)"
  - "Caso (iii) lista vacía intencional → skip silencioso en el builder (NO llega al render del PDF, decisión CONTEXT.md)"
  - "AnexoConsumiblesData.fechaEmision se deriva de presupuesto.fechaEnvio || createdAt || now(). El campo es 'display' del PDF; Presupuesto type no tiene fechaEmision"

patterns-established:
  - "Edge case taxonomy en builders de adjuntos: (i) sin código, (ii) código no en catálogo, (iii) lista vacía intencional, terminal — diferenciados con warning vs skip silencioso"
  - "Filename adjunto: 'Anexo Consumibles - {numero} - {sistema}.pdf' (set en builder, no en PDF — mantiene el componente PDF agnóstico de naming)"

requirements-completed: [ANXC-05]

# Metrics
duration: 9min
completed: 2026-04-29
---

# Phase 4 Plan 4: Anexo Consumibles Builder + PDF Component Summary

**React-PDF AnexoConsumiblesPDF (Editorial Teal liviano) + buildAnexosFromPresupuesto orchestrator con matcheo híbrido módulos reales → plantilla, lookup cacheado y 4 casos edge cubiertos según CONTEXT.md**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-04-29T15:33:57Z
- **Completed:** 2026-04-29T15:42:28Z
- **Tasks:** 3
- **Files modified:** 3 (2 nuevos + 1 modificado)

## Accomplishments

- `AnexoConsumiblesPDF` (react-pdf) renderiza un anexo por sistema con header liviano (logo + título + ppto + sistema + cliente + fecha) y secciones por módulo con tabla `Código / Descripción / Cantidad`. Placeholder en italics para casos (i)/(ii).
- `buildAnexosFromPresupuesto` orquesta la generación de N anexos por presupuesto con:
  - Matcheo híbrido módulos reales → plantilla (`findPlantillaForSistema` reusado)
  - Detección flag `requiereAnexoConsumibles` cross-plantilla (si CUALQUIER plantilla lo marca para el `servicioCode`, se respeta)
  - Cache in-memory de lookups `consumibles_por_modulo` (evita N+1)
  - 4 casos edge: sin código (placeholder + warning), código no en catálogo (placeholder + warning), lista vacía intencional (skip silencioso), terminal (no se genera anexo + warning)
- Plan 04-05 puede importar todo desde `'../pdf'` sin imports profundos.

## Task Commits

Each task was committed atomically:

1. **Task 1: AnexoConsumiblesPDF.tsx (componente PDF + generator helper)** — `e61f112` (feat)
2. **Task 2: buildAnexosFromPresupuesto.ts (matcheo híbrido + warnings)** — `24cbb9a` (feat)
3. **Task 3: Re-export en pdf/index.ts** — `ede9c60` (feat)

**Plan metadata:** _(pending — final commit step)_

## Files Created/Modified

### Created

- `apps/sistema-modular/src/components/presupuestos/pdf/AnexoConsumiblesPDF.tsx` (241 líneas)
  - Componente react-pdf `AnexoConsumiblesPDF` (export default-style: named export)
  - Helper `generateAnexoConsumiblesPDF(data: AnexoConsumiblesData): Promise<Blob>`
  - Sub-component `ModuloSection` (colocado en mismo archivo)
  - StyleSheet local `A` con tokens Editorial Teal liviano (no modifica `pdfStyles.ts`)
  - Tipo `AnexoConsumiblesData` definido en **línea 32**, `AnexoModuloEntry` en **línea 24**

- `apps/sistema-modular/src/components/presupuestos/pdf/buildAnexosFromPresupuesto.ts` (239 líneas)
  - Función `buildAnexosFromPresupuesto(input): Promise<{ anexos, warnings }>`
  - Helpers internos: `itemRequiereAnexo`, `resolveFuenteModulos`, `lookup` (closure)
  - Tipo `AnexoBuildWarning` en **línea 19**, `AnexoBuildResult` en **línea 26**, `BuildAnexosInput` en **línea 35**

### Modified

- `apps/sistema-modular/src/components/presupuestos/pdf/index.ts` (+18 líneas)
  - Re-exporta los 3 símbolos de runtime + 5 tipos para que el modal de envío (plan 04-05) importe desde `'../pdf'`.

## Decisions Made

### Detección de "código de módulo" en módulos reales (importante para 04-05)

`ModuloSistema` no tiene un campo explícito `codigo`/`partNumber`. Los datos históricos (importados de Excel + creados manualmente) guardan el código en distintos lugares — más comúnmente en `nombre`. Decisión: heurística regex Agilent `/^[A-Z][0-9]{3,5}[A-Z]?$/` aplicada sobre `mod.nombre.trim()`. Matchea part numbers tipo `G7129A`, `G1322A`, `1260A`. Si no matchea → `placeholder=true` (caso (i) — el anexo muestra el módulo pero sin tabla de consumibles).

**Implicancia para plan 04-05:** El warning `modulo_sin_codigo` puede surgir incluso para sistemas con módulos cargados en Firestore — el banner amarillo en `EnviarPresupuestoModal` debe explicitarlo claramente ("X módulos del sistema Y no tienen código identificable"). Si el operador quiere arreglarlo, debe ir al detalle del sistema y editar `nombre` para que matchee el part number, o (futuro) agregar un campo `partNumber` explícito al `ModuloSistema`.

### Flag duplicado entre plantillas (servicioCode compartido)

Un mismo `servicioCode` puede aparecer en varias plantillas (HPLC 1260 + HPLC 1260 Infinity). La función `itemRequiereAnexo()` itera **todas las plantillas** y respeta el flag si **cualquiera** lo tiene tildado. Esto previene falsos negativos por configuración inconsistente y refleja la regla operativa: "si el servicio MPCC está marcado en alguna plantilla equivalente, el anexo va".

### Pre-loaded catalogs (no Firestore in builder)

El builder recibe `modulosBySistema: Record<string, ModuloSistema[]>` y `plantillas: TipoEquipoPlantilla[]` como argumentos. NO los carga internamente. Razón: el caller (modal de envío en 04-05) ya carga ambos para el PDF principal (ver `generatePresupuestoPDF.tsx` líneas 88-105 — pattern existente). Reusar la misma carga evita N+1 y hace `buildAnexosFromPresupuesto` testeable con datos in-memory.

El único acceso Firestore desde el builder es el lookup `consumiblesPorModuloService.getByCodigoModulo(codigo)` por código, **cacheado en memoria** (Map) con null-sentinel para "buscado, no encontrado".

### Casos edge cubiertos

| Caso | Trigger | Comportamiento builder | Comportamiento PDF |
|------|---------|------------------------|---------------------|
| (i) Módulo sin código | `regex` no matchea `mod.nombre` (módulos reales) | `placeholder=true` + warning `modulo_sin_codigo` | Header del módulo + texto italics "Consumibles no especificados" |
| (ii) Código no en catálogo | `getByCodigoModulo()` devuelve null o `activo=false` | `placeholder=true` + warning `codigo_no_en_catalogo` | Mismo italics |
| (iii) Lista vacía intencional | Doc existe, `consumibles=[]` | **SKIP silencioso** (módulo no entra en `modulos[]`) | No se renderiza |
| Terminal | Sistema sin módulos reales NI plantilla matcheable | **NO se genera anexo** + warning `sistema_sin_modulos_ni_plantilla` | — |

Si tras procesar todos los módulos el resultado es `modulosOut.length === 0` (caso especial: todos saltearon por (iii)), también se skip-ea el anexo entero — coherencia: "el item lleva flag pero el catálogo dice que ninguno de sus módulos lleva consumibles" → no hay nada que mostrar.

### `AnexoConsumiblesData.fechaEmision` mapping

`Presupuesto` tiene `fechaEnvio` (envío del email) pero NO un campo `fechaEmision`. El builder deriva con prioridad: `fechaEnvio || createdAt || new Date().toISOString()`. La idea: si el ppto se está enviando por primera vez, `fechaEnvio` es null y caemos a `createdAt`; si ya se envió, `fechaEnvio` da el snapshot del último envío. La doc string en el código aclara la intención.

## Deviations from Plan

None — plan executed exactly as written.

Nota: el plan menciona en un `<interfaces>` que la dependencia de `consumiblesPorModuloService` podía ser problemática si plan 04-02 aún no había commitado. Verificación al inicio de ejecución mostró que 04-02 ya estaba committed (commits `bbde394` + `b8147a1`), por lo que no se requirió crear stub. Se procedió con los 3 tasks tal como están escritos.

## Issues Encountered

- **Type-check workflow:** sistema-modular no tiene script `pnpm type-check` (regla histórica de Phase 8). Se usó `npx tsc --noEmit -p tsconfig.json` directo. Hay errores TS pre-existentes (~25) en otros archivos del proyecto, pero ninguno toca los nuevos `AnexoConsumiblesPDF.tsx` / `buildAnexosFromPresupuesto.ts` / `pdf/index.ts`. Verificación: `grep -E "AnexoConsumiblesPDF|buildAnexosFromPresupuesto|consumiblesPorModuloService"` sobre la salida de tsc devuelve cero líneas.
- **Tamaño file Task 2:** primer pase quedó en 258 líneas (excedía el budget de 250). Se trimmeó docstrings y se compactó `resolveFuenteModulos` a un `.map()` arrow → 239 líneas final. Sin pérdida de claridad.

## User Setup Required

None — no external service configuration required for this plan. (Plan 04-02 ya configuró la colección Firestore `consumibles_por_modulo`; este plan solo consume.)

## Next Phase Readiness

**Ready for plan 04-05** (email integration con `EnviarPresupuestoModal`). El modal puede:

```typescript
import {
  buildAnexosFromPresupuesto,
  generateAnexoConsumiblesPDF,
  type AnexoBuildResult,
  type AnexoBuildWarning,
} from '../pdf';

// 1. Pre-cargar catálogos (igual que generatePresupuestoPDF)
const sistemaIds = [...new Set(presupuesto.items.map(i => i.sistemaId).filter(Boolean))] as string[];
const modulosBySistema = Object.fromEntries(
  await Promise.all(sistemaIds.map(async (sid) => [sid, await modulosService.getBySistema(sid)] as const))
);
const plantillas = await tiposEquipoService.getAll();
const sistemas = await Promise.all(sistemaIds.map(sid => sistemasService.getById(sid)));
const sistemasMap = Object.fromEntries(sistemaIds.map((sid, i) => [sid, sistemas[i]]));

// 2. Build anexos
const { anexos, warnings } = await buildAnexosFromPresupuesto({
  presupuesto, cliente, sistemas: sistemasMap, modulosBySistema, plantillas,
});

// 3. Render Blobs y adjuntar al email
const attachments = await Promise.all(
  anexos.map(async (a) => ({
    filename: a.filename,
    mimeType: 'application/pdf',
    base64Data: btoa(String.fromCharCode(...new Uint8Array(await (await generateAnexoConsumiblesPDF(a.data)).arrayBuffer()))),
  })),
);

// 4. Mostrar warnings.filter(w => w.tipo === 'sistema_sin_modulos_ni_plantilla') en banner amarillo
```

**No blockers.**

## Self-Check: PASSED

Verified:
- `apps/sistema-modular/src/components/presupuestos/pdf/AnexoConsumiblesPDF.tsx` exists (241 líneas, ≤ 250)
- `apps/sistema-modular/src/components/presupuestos/pdf/buildAnexosFromPresupuesto.ts` exists (239 líneas, ≤ 250)
- `apps/sistema-modular/src/components/presupuestos/pdf/index.ts` re-exports los 3 runtime + 5 type symbols
- Commits found in `git log`: `e61f112`, `24cbb9a`, `ede9c60`
- `npx tsc --noEmit` no reporta errores nuevos atribuibles a estos archivos

---
*Phase: 04-presupuestos-anexo-consumibles*
*Completed: 2026-04-29*
