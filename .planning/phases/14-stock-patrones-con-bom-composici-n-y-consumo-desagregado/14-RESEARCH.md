# Phase 14: Stock — Patrones con BOM (composición y consumo desagregado) — Research

**Researched:** 2026-05-20
**Domain:** Inventory / BOM composition, transactional ledger writes, OT closing flow, frozen-surface exception in reportes-ot
**Confidence:** HIGH (all critical findings verified against repo source — Context7/web research not required; the entire phase plays inside known repo conventions and types)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Modelo de datos — `Patron.componentes`**
- Nuevo campo opcional `Patron.componentes?: ComponentePatron[]` con `ComponentePatron = { codigoComponente: string; descripcion: string; cantidadPorKit: number; unidadMedida: string; stockMinimo?: number | null }`.
- `codigoComponente` es **texto libre interno del patrón**, NO linkea a `Articulo` del catálogo. Los componentes (ampollas) no se compran sueltos — se compra el kit; viven solamente dentro del patrón.
- Caso simple y complejo unificados — un patrón con 3 ampollas iguales se modela como 1 componente con `cantidadPorKit: 3`; un patrón con 8 ampollas diferentes se modela como 8 componentes con `cantidadPorKit: 1`.
- `cantidadPorKit` es `number`, acepta enteros (caso típico).
- `unidadMedida` es `string` libre en v1 (ej. "ampolla", "vial", "frasco", "tira"). No se enum-iza en v1.
- `stockMinimo?` es opcional; default = 0 (alerta sólo al agotarse).

**Modelo de datos — `PatronLote.componentesConsumidos`**
- Nuevo campo opcional `PatronLote.componentesConsumidos?: { codigoComponente: string; cantidadConsumida: number }[]`.
- El `codigoComponente` matchea por igualdad de string con `Patron.componentes[].codigoComponente` (texto exacto).
- Fuente única de verdad de "cuántas ampollas quedan" del lote = `PatronLote.cantidad × Patron.componentes[i].cantidadPorKit - PatronLote.componentesConsumidos[i].cantidadConsumida`. El catálogo de artículos NO se entera del consumo.
- "Lote agotado" se computa: para todos los componentes del patrón, el saldo es ≤ 0. Si al menos un componente está agotado pero otros tienen saldo, el lote pasa a estado "bloqueado" (un componente bloquea el kit entero).

**Backwards-compatibility**
- Default `componentes = []` para todos los patrones cargados antes de Phase 14. Siguen funcionando como hoy.
- Cuando un patrón tiene `componentes.length > 0`, el lote pasa a ser BOM-aware.
- No hay migración batch. El user carga componentes manualmente patrón por patrón cuando lo necesite.

**UI — edición de componentes (`PatronEditorPage`)**
- Nueva sección "Componentes (BOM)" en `PatronEditorPage` con widget de tabla/cards inline editable.
- Inputs simples: `codigoComponente` (text), `descripcion` (text), `cantidadPorKit` (number), `unidadMedida` (text en v1), `stockMinimo` (number, opcional).
- Agregar/quitar componentes inline (botones "+/x"). Editorial Teal, JetBrains Mono uppercase labels.

**Flujo cierre administrativo — paso "Patrones consumidos"**
- Nueva sección en `OTCierreAdminSection` — paso "Patrones consumidos".
- Auto-prefila desde el reporte técnico: lee qué `PatronSeleccionado` (patron+lote) usó el técnico en cada protocolo y pre-popula una sugerencia de 1 ampolla por componente del kit por cada uso registrado.
- El admin puede editar cantidades antes de confirmar (cambiar lote, ajustar cantidades por componente, agregar/quitar filas).
- FIFO por vencimiento sólo cuando el reporte técnico no indica lote O el patrón tiene varios lotes vigentes.
- Reporte técnico intocable — si admin difiere del reporte, se respeta lo del admin para el descuento contable y la divergencia queda anotada en `MovimientoStock.motivo`.
- Descuento real de componentes pasa SIEMPRE por el cierre administrativo.

**Audit — extensión de `MovimientoStock`**
- NO se crea colección nueva `movimientosPatron`. Audit va en `MovimientoStock` (extensión backwards-compatible).
- Campos nuevos opcionales: `entidadTipo?: 'articulo' | 'patron'` (default 'articulo' si ausente), `patronId?: string | null`, `loteId?: string | null` (forma exacta queda para el planner), `codigoComponente?: string | null`.
- `tipo` para consumo de patrón = `'consumo'` (reusa el enum existente, no se agrega `'consumo_patron'`).
- **1 movimiento por componente consumido** (granularidad fina). Una OT que consume 2 patrones × 3 ampollas distintas cada uno genera 6 movimientos.
- Los movimientos referencian la OT (`otNumber`) y el creador (`creadoPor`).

**Servicios — separación de concerns**
- El paso "Patrones consumidos" invoca su propio servicio (`patronesService.consumirComponentes(...)` o similar) separado del flujo `CierreStockSelector`.
- Cada servicio crea sus propios movimientos. NO se bundlean en una sola `runTransaction` con repuestos.
- La mutación de un lote DEBE ser atómica vía `runTransaction`.

**Stock mínimo y alertas BOM**
- Cuando el saldo de un componente cae a o por debajo de `stockMinimo` (default 0), el lote pasa a estado "bloqueado para uso".
- Efecto del bloqueo:
  1. **PatronesList** (sistema-modular): badge rojo "agotado / reemplazar" en la fila del patrón cuyo lote tiene componente en crítico.
  2. **Ficha del patrón** (`PatronEditorPage`): alerta inline en la lista de lotes mostrando qué componente está en crítico, y badge por componente.
  3. **Selector técnico en reportes-ot** (`InstrumentoSelectorPanel.tsx` tab "Patrones"): el lote afectado aparece con badge/warning rojo y el técnico no puede seleccionarlo. *(Excepción autorizada a la regla frozen.)*
- Auto-genera un Requerimiento de patrón asignado al usuario configurable (mismo patrón de FLOW-07 / `/admin/config-flujos`).
- Forma exacta del Requerimiento de patrón la define el planner — **prefiere extender lo existente** si no rompe consumidores.

**reportes-ot — excepción frozen autorizada**
- Phase 14 puede editar `apps/reportes-ot/` ÚNICAMENTE para:
  - Agregar badge/warning visual al lote bloqueado en el tab "Patrones" del `InstrumentoSelectorPanel`.
  - Filtrar/marcar como no-seleccionable el lote bloqueado en el selector del técnico.
- NO se autoriza tocar pipeline PDF, otros componentes UI fuera del selector, lógica de firma del protocolo.
- El planner ejecuta los tasks que tocan `apps/reportes-ot/` con `CLAUDE_ALLOW_REPORTES_OT=1` (variable del hook `guard-reportes-ot.js`).

**Convenciones del repo (carry-forward Phase 13 y reglas del repo)**
- Firestore writes nunca con `undefined` — `deepCleanForFirestore` para payloads anidados.
- Writes solo por servicios; componentes nunca llaman Firestore directo.
- Timestamps en write con `Timestamp.now()`, en read a UI con `.toDate().toISOString()`.
- Componentes ≤ 250 líneas — extraer hook o subcomponente antes.
- Filtros de lista persistidos vía `useUrlFilters` — nunca `useState` para filtros.
- Design Editorial Teal — `teal-700` primario, Newsreader serif para títulos de modal, JetBrains Mono uppercase para labels.
- Precedente Phase 13 — extensión backwards-compat de tipos.

### Claude's Discretion

- Forma exacta del campo `loteId` en `MovimientoStock`: el modelo actual de `PatronLote` NO tiene id explícito — usa `lote: string` como clave dentro del array de lotes. El planner decide si se persiste por código de lote o se introduce un `lote.id`. **Recomendación de este research:** persistir `lote: string` (código natural) y NO introducir `lote.id` (ver pitfall 3 abajo).
- Forma exacta del Requerimiento de patrón (extender enum `Requerimiento.tipo` existente vs colección nueva). Preferir extensión. **Recomendación de este research:** extender el enum `OrigenRequerimiento` con un valor nuevo `'patron_minimo'` + campos opcionales `patronId/loteId/codigoComponente` en `RequerimientoCompra` (ver hallazgo 8 abajo).
- UI exacta del paso "Patrones consumidos" (tabla con filas vs cards apiladas). Reusar atoms `Button`, `Input`, `Card`, `SearchableSelect`.
- Forma del badge "tiene BOM" / "lote bloqueado" (pictograma vs pill compacto). Editorial Teal consistente.
- Si el preview de "lote agotado" se muestra en `PatronEditorPage` como sección dedicada o inline en cada lote.
- Si la vista de patrones afectados por componentes en crítico es la misma `PatronesList` con filtro nuevo "Bloqueados" o una sub-vista.
- Si el Requerimiento de patrón se dispara desde el cierre admin (al detectar saldo ≤ mínimo en la transacción del consumo) o desde una Cloud Function on-write sobre `Patron`. **Recomendación:** preferir disparo desde el cierre admin (sin Cloud Function nueva) — Phase 9 ya usa CF solo para `resumenStock`; mantener la decisión "Cloud Functions SOLO para agregación denormalizada".

### Deferred Ideas (OUT OF SCOPE)

- Migración batch de patrones existentes con componentes (manual carga del user).
- Componentes linkeados a `Articulo` del catálogo (v1: codigoComponente es texto interno).
- Conversión inversa (re-componer ampollas en kits) — N/A.
- Reporte técnico modificable desde admin — descartado.
- Descuento de ampollas por el técnico en campo — descartado.
- PDF anexo "patrones consumidos por OT" — no en scope v1.
- Dashboard `/patrones/reponer` aparte — no en v1.
- Vencimiento por componente — el vencimiento sigue siendo del lote entero.
- stockMinimo expresado como % en lugar de absoluto — descartado v1.
- Cancelación/reversa de un consumo registrado por error — no en v1.
- Doble-bookkeeping con `OT.repuestos[]` — patrones consumidos viven aparte.
- Edición de componentes después de que el lote ya tiene consumo — planner debe pensar la guarda; en v1 probablemente bloquear edición o requerir migración manual.
- Eliminación de patrón con consumo histórico — soft-delete (`activo: false`) ya disponible, decisión final en plan.
- **Phase 15 (Venta loaner espejo a stock)** — no se mezcla con Phase 14. Es otra fase, otro sub-dominio.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| (none in REQUIREMENTS.md) | Phase 14 marcada `TBD` en ROADMAP y `REQUIREMENTS.md` no contiene IDs `STKP-*BOM*` ni `BOM-*`. La fase deriva su scope completo de `14-CONTEXT.md`. | El planner debe **fabricar IDs nuevos** para esta fase (sugerencia: `BOM-01..BOM-08`) y agregarlos al `REQUIREMENTS.md` cuando arme los plans. Mapeo sugerido en sección "Sugerencia de IDs" más abajo. |

### Sugerencia de IDs para el planner (no oficiales, propuesta)

| ID propuesto | Comportamiento | Donde aterriza |
|---|---|---|
| BOM-01 | Tipos foundation: `ComponentePatron`, `Patron.componentes?`, `PatronLote.componentesConsumidos?`, `MovimientoStock.entidadTipo? + patronId? + lote? + codigoComponente?` | `packages/shared/src/types/index.ts` |
| BOM-02 | Helpers puros de saldo: `computeSaldoComponente`, `computeLoteStatus` (active/bloqueado/agotado), `computePatronStatus` | nuevo `packages/shared/src/utils/patronBom.ts` o `apps/sistema-modular/src/services/patronBomHelpers.ts` (preferir shared si se quiere reusar en reportes-ot) |
| BOM-03 | `patronesService.consumirComponentes(...)` con `runTransaction` (atómico baja N por componente + crea N MovimientoStock) | `apps/sistema-modular/src/services/patronesService.ts` |
| BOM-04 | Editor "Componentes (BOM)" en `PatronEditorPage` (sub-componente extraído por budget) | `apps/sistema-modular/src/pages/patrones/PatronEditorPage.tsx` + nuevo `PatronComponentesEditor.tsx` |
| BOM-05 | Paso "Patrones consumidos" en `OTCierreAdminSection` con auto-prefill desde `OT.patronesSeleccionados`, edición admin, descuento atómico al confirmar | nuevo `CierrePatronesConsumidosSection.tsx` + wire en `OTCierreAdminSection.tsx` |
| BOM-06 | Badge/filtro "BOM" y badge "lote bloqueado" en `PatronesList`; alerta inline en ficha de patrón | `PatronesList.tsx` + `PatronEditorPage.tsx` |
| BOM-07 | Selector reportes-ot: badge/warning + bloqueo de selección del lote bloqueado (excepción frozen) | `apps/reportes-ot/components/InstrumentoSelectorPanel.tsx` (con `CLAUDE_ALLOW_REPORTES_OT=1`) |
| BOM-08 | Auto-creación de Requerimiento de patrón cuando un componente cae bajo `stockMinimo`, asignado al usuario configurable (extiende `adminConfigService` + `/admin/config-flujos` con `usuarioRequerimientosPatronId`); origen nuevo `'patron_minimo'` en `OrigenRequerimiento` | extensión `RequerimientoCompra` + `AdminConfigFlujos` + reuso `requerimientosService` |
</phase_requirements>

## Summary

Phase 14 introduce un modelo BOM (Bill-of-Materials) sobre la entidad ya existente `Patron`, con un contador de consumo desagregado por componente al nivel de cada `PatronLote`. Todo el modelo es estrictamente backwards-compatible (campos opcionales sobre tipos vivos), no se crean colecciones nuevas, y se reusa el enum `MovimientoStock.tipo: 'consumo'` extendido con metadata para identificar la entidad patrón. Los descuentos contables se ejecutan exclusivamente desde el cierre administrativo de la OT, con `runTransaction` atómica siguiendo el precedente exacto de `desagregarUnidades` (Phase 13). El reporte técnico en `apps/reportes-ot/` queda intocable salvo por una excepción autorizada y muy acotada en `InstrumentoSelectorPanel.tsx` para bloquear visualmente la selección de lotes agotados.

La superficie de cambios es compacta y tiene precedentes 1:1 en el repo: la lógica de `runTransaction` está modelada exactamente en `equivalenciasService.desagregarUnidades` (Phase 13), la auto-creación de requerimientos está modelada en `presupuestosService._generarRequerimientos` (Phase 8 / FLOW-03), la extensión de `MovimientoStock` está modelada en STKE-01 (Phase 13: `subtipo: 'conversion'` + `articuloDestinoId`), y la configuración de responsables está modelada en FLOW-07 (`adminConfigService` + `ConfigFlujosPage.tsx`).

**Primary recommendation:** El planner puede armar la fase como 5–7 plans secuenciales calcando la estructura de Phase 13 (foundation types → service runTransaction → editor UI → list UI → selector excepción → wave de auto-requerimientos + config). No hace falta investigación externa: el modelo se resuelve enteramente con conocimiento del repo y APIs ya en uso de Firebase SDK 12.

## Standard Stack

### Core (ya en uso en el repo — no se introducen libs nuevas)

| Library | Version (lockfile) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `firebase` | ^12.11.0 | Firestore CRUD + `runTransaction` + `onSnapshot` | Stack de datos del proyecto entero |
| `react` | ^19.2.3 | UI | Stack |
| `react-router-dom` | ^7.12.0 | Routing (rutas existentes `/patrones/*` + `/admin/config-flujos`) | Stack |
| `tailwindcss` | ^3.4.14 | Styling — Editorial Teal tokens | Stack |
| `tsx` | ^4.21.0 | Runner de tests unit estilo `node:assert/strict` | Patrón Phase 12/13 (`test:cuotas-facturacion`, `test:equivalencias`) |
| `@playwright/test` | ^1.59.1 | E2E (opcional para esta fase — sólo si el planner decide cubrir flujo cierre admin con E2E) | Stack |

**Helpers ya existentes en el repo a reusar (sin reinventar):**

| Helper | Ubicación | Para qué |
|---|---|---|
| `deepCleanForFirestore` | `apps/sistema-modular/src/services/firebase.ts` | Stripping `undefined` de payloads anidados — **obligatorio** porque vamos a escribir arrays `componentesConsumidos[]` |
| `cleanFirestoreData` | mismo | Stripping plano (para `MovimientoStock` que es flat) |
| `getCreateTrace` / `getUpdateTrace` | mismo | Audit fields (`createdBy/By/At`) |
| `createBatch` / `batchAudit` | mismo | Audit log centralizado |
| `runTransaction` | `firebase/firestore` | Atomicidad — **precedente exacto en `equivalenciasService.desagregarUnidades`** |
| `Timestamp.now()` | `firebase/firestore` | Writes |
| `useUrlFilters` | `apps/sistema-modular/src/hooks/useUrlFilters.ts` | Schema-based filters persistidos en URL (obligatorio para filtro "Bloqueados" en `PatronesList`) |
| `SearchableSelect`, `Button`, `Card`, `Input`, `PageHeader` | `apps/sistema-modular/src/components/ui/` | Atoms estándar |
| `requerimientosService` | `apps/sistema-modular/src/services/importacionesService.ts` (sí, exportado desde ahí) | Crear `RequerimientoCompra` automático con `getNextNumber()` REQ-XXXX |
| `adminConfigService.getWithDefaults()` | `apps/sistema-modular/src/services/adminConfigService.ts` | Leer `usuarioRequerimientosPatronId` del settings |

### Supporting (ninguna lib nueva)

No se incorpora ninguna dependencia nueva en esta fase. Toda la lógica se resuelve con utilidades ya presentes.

### Alternatives Considered

| Instead of | Could Use | Why we don't |
|---|---|---|
| Extender `MovimientoStock` | Colección nueva `movimientosPatron` | CONTEXT lo prohibe explícitamente; además, romper el log único de auditoría complica auditorías futuras y la página `/admin/auditoria` |
| `runTransaction` para `consumirComponentes` | Batch + write secuencial | El CONTEXT exige atomicidad del array `componentesConsumidos[]`; un batch no-tx puede dejar el patrón parcial si el batch se split-ea por límite de docs |
| Cloud Function on-write para auto-Requerimiento de patrón | Disparo inline desde el cierre admin | Phase 9 establece "Cloud Functions SOLO para agregación denormalizada" (CF de `resumenStock`); no replicar para event triggers nuevos a menos que sea necesario |
| Componente linkeado a `Articulo` | Texto libre `codigoComponente` | Decisión del usuario en CONTEXT (componentes no se compran sueltos, viven dentro del patrón) |

**Installation:** N/A — no hay packages nuevos.

## Architecture Patterns

### Estructura propuesta de archivos

```
packages/shared/src/types/index.ts                  # Extensiones tipos (BOM-01)
packages/shared/src/utils/patronBom.ts              # NUEVO — helpers puros saldo/bloqueo (BOM-02, opcional aquí)
                                                     #   alternativa: vivir en apps/sistema-modular/src/services/patronBomHelpers.ts si NO se usa desde reportes-ot

apps/sistema-modular/src/services/
  patronesService.ts                                # EXTEND — agregar consumirComponentes() + helpers de saldo
  adminConfigService.ts                             # EXTEND — agregar usuarioRequerimientosPatronId
  importacionesService.ts (requerimientosService)   # SIN CAMBIOS estructurales — sólo aceptar nuevo origen 'patron_minimo' + campos opcionales

apps/sistema-modular/src/pages/patrones/
  PatronEditorPage.tsx                              # EXTEND con sección (BOM-04) — actualmente 334 LOC (ya excede budget 250); extraer hook + subcomponentes
  PatronComponentesEditor.tsx                       # NUEVO sub-componente (BOM-04)
  PatronesList.tsx                                  # EXTEND badges/filtro (BOM-06) — actualmente 330 LOC; extraer Row antes de seguir creciendo

apps/sistema-modular/src/components/ordenes-trabajo/
  OTCierreAdminSection.tsx                          # EXTEND — invocar nueva sección antes de CierreStockSelector (BOM-05) — actualmente 244 LOC, queda muy cerca del budget; extraer hook
  CierrePatronesConsumidosSection.tsx               # NUEVO (BOM-05)

apps/sistema-modular/src/hooks/
  useCierrePatronesConsumidos.ts                    # NUEVO — pre-fill desde OT.patronesSeleccionados, FIFO por vencimiento, edición admin, commit (BOM-05)

apps/sistema-modular/src/pages/admin/
  ConfigFlujosPage.tsx                              # EXTEND — agregar input usuarioRequerimientosPatronId (BOM-08)

apps/sistema-modular/src/services/__tests__/
  patronBom.test.ts                                 # NUEVO — unit tests con node:assert/strict (estilo Phase 13)

apps/reportes-ot/components/
  InstrumentoSelectorPanel.tsx                      # EXTEND con CLAUDE_ALLOW_REPORTES_OT=1 — badge + disable lote bloqueado (BOM-07) — actualmente 619 LOC (ya muy grande, NO refactor en esta fase, solo intervención mínima)
```

### Pattern 1: `runTransaction` atómico para mutaciones de lote

**What:** Toda mutación que toca `Patron.lotes[i].componentesConsumidos[]` debe ser atómica.

**When to use:** En `patronesService.consumirComponentes(...)` y cualquier futuro reverse/undo.

**Example (calcado de `equivalenciasService.desagregarUnidades`):**

```typescript
// Source: apps/sistema-modular/src/services/equivalenciasService.ts:382-478 (Phase 13 precedent)
//
// Patrón a replicar:
//   1) Pre-fetch fuera de tx: leer Patron actual + admin config + currentUser
//   2) Pre-generar IDs deterministas para los N MovimientoStock que se crearán
//   3) tx.get del patron (READ FIRST — validar saldo bajo lock)
//   4) Recomputar componentesConsumidos[] sumando lo nuevo
//   5) tx.update(patronRef, { lotes: nuevosLotes }) — write completo del array (no mutación parcial)
//   6) tx.set(movRef, ...) por cada componente consumido (N writes)
//   7) Post-tx: best-effort logBusinessEvent + auto-Requerimiento si saldo final ≤ stockMinimo

async function consumirComponentes(params: {
  otNumber: string;
  consumos: Array<{
    patronId: string;
    lote: string;                    // código de lote (clave natural dentro del array)
    componentes: Array<{ codigoComponente: string; cantidad: number; motivo?: string }>;
  }>;
  creadoPor: string;
}): Promise<{ movimientoIds: string[]; requerimientosCreados: string[] }> {
  // 1) Pre-fetch
  const patronesUnicos = [...new Set(params.consumos.map(c => c.patronId))];
  const patronDocs = await Promise.all(patronesUnicos.map(id => fb.getDoc(fb.doc(fb.db, 'patrones', id))));

  // 2) Pre-gen IDs (N por componente consumido)
  const movIds = params.consumos.flatMap(c => c.componentes.map(() => crypto.randomUUID()));

  // 3-5) Tx (READ FIRST then WRITES)
  await fb.runTransaction(fb.db, async (tx) => {
    for (const patronId of patronesUnicos) {
      const snap = await tx.get(fb.doc(fb.db, 'patrones', patronId));
      if (!snap.exists()) throw new Error(`Patrón ${patronId} no encontrado (race?)`);
      const patron = snap.data() as Patron;
      // recomputar lotes[] aplicando todos los consumos de este patrón
      const consumosDelPatron = params.consumos.filter(c => c.patronId === patronId);
      const nuevosLotes = recomputeLotesConConsumos(patron.lotes, patron.componentes ?? [], consumosDelPatron);
      // validar saldo no negativo (throw si alguno < 0 — admin debe editar antes)
      validarSaldosNoNegativos(patron, nuevosLotes);
      tx.update(snap.ref, fb.deepCleanForFirestore({ lotes: nuevosLotes, ...fb.getUpdateTrace(), updatedAt: nowIso }));
    }
    // 6) N MovimientoStock con entidadTipo: 'patron'
    let movIdx = 0;
    for (const c of params.consumos) {
      for (const comp of c.componentes) {
        tx.set(fb.doc(fb.db, 'movimientosStock', movIds[movIdx++]), fb.deepCleanForFirestore({
          tipo: 'consumo',
          entidadTipo: 'patron',
          patronId: c.patronId,
          lote: c.lote,
          codigoComponente: comp.codigoComponente,
          cantidad: comp.cantidad,
          articuloId: null,           // no aplica para patrón
          articuloCodigo: null,
          articuloDescripcion: null,
          origenTipo: 'posicion',     // placeholder — patrones no viven en posiciones
          origenId: 'patron',
          origenNombre: 'Patrón',
          destinoTipo: 'consumo_ot',
          destinoId: params.otNumber,
          destinoNombre: `OT ${params.otNumber}`,
          otNumber: params.otNumber,
          motivo: comp.motivo ?? null,
          creadoPor: params.creadoPor,
          ...fb.getUpdateTrace(),
          createdAt: nowIso,
        }));
      }
    }
  });

  // 7) Post-tx: chequear componentes que crucen stockMinimo → auto-Requerimiento
  // (delega a helper separado — best-effort, no bloquea el commit)
  const requerimientosCreados = await autoCrearRequerimientosPatron(patronesUnicos);

  return { movimientoIds: movIds, requerimientosCreados };
}
```

### Pattern 2: Pure helpers de saldo (testeable sin Firestore)

**What:** Funciones puras que dado un `Patron + PatronLote + (componentesConsumidos)` devuelven `saldo` por componente y `status` por lote/patrón.

**When to use:** UI (badges, alertas), pre-fill de la sección de cierre admin, validación admin antes de commit, selector reportes-ot.

**Sugerencia de ubicación:** `packages/shared/src/utils/patronBom.ts` (compartible entre sistema-modular y reportes-ot — la app del técnico necesita la misma lógica para mostrar "AGOTADO").

```typescript
// Pure — sin Firestore, sin async
export function computeSaldoComponente(
  patron: Patron,
  lote: PatronLote,
  codigoComponente: string,
): number {
  const comp = (patron.componentes ?? []).find(c => c.codigoComponente === codigoComponente);
  if (!comp) return Infinity; // si no hay BOM, no hay límite (modo legacy)
  const stockTotal = (lote.cantidad ?? 0) * comp.cantidadPorKit;
  const consumido = (lote.componentesConsumidos ?? []).find(c => c.codigoComponente === codigoComponente)?.cantidadConsumida ?? 0;
  return stockTotal - consumido;
}

export function computeLoteStatus(patron: Patron, lote: PatronLote): 'active' | 'bloqueado' | 'agotado' {
  const componentes = patron.componentes ?? [];
  if (componentes.length === 0) return 'active'; // legacy, sin BOM
  let allAgotado = true;
  let algunoBloqueado = false;
  for (const comp of componentes) {
    const saldo = computeSaldoComponente(patron, lote, comp.codigoComponente);
    const minimo = comp.stockMinimo ?? 0;
    if (saldo > minimo) {
      allAgotado = false;
    } else {
      algunoBloqueado = true; // saldo <= stockMinimo → bloquea el kit
    }
  }
  if (allAgotado) return 'agotado';
  if (algunoBloqueado) return 'bloqueado';
  return 'active';
}

export function computePatronStatus(patron: Patron): 'active' | 'bloqueado' | 'agotado' {
  const statuses = patron.lotes.map(l => computeLoteStatus(patron, l));
  if (statuses.every(s => s === 'agotado')) return 'agotado';
  if (statuses.some(s => s === 'bloqueado' || s === 'agotado')) return 'bloqueado';
  return 'active';
}
```

### Pattern 3: `OTCierreAdminSection` como pipeline de secciones inline

`OTCierreAdminSection.tsx` (apps/sistema-modular/src/components/ordenes-trabajo/) hoy renderiza una secuencia inline:

1. Horas (lab + viaje, ajustables)
2. Materiales / Repuestos (tabla read-only)
3. Notas de cierre
4. `<CierreStockSelector />` (asigna origen — posición o ingeniero — para `articulos[]`)
5. `<CierrePDFPreview />`
6. `<CierreFacturacionWizard />`
7. Aviso a administración (badge si ya se envió)
8. Botón "Confirmar cierre y avisar a administración"

**Donde inserta la nueva sección "Patrones consumidos":** entre el bloque (3) Notas y (4) `<CierreStockSelector />` — antes que repuestos físicos para que el cierre lea de arriba a abajo en orden lógico (horas → notas → patrones consumibles → repuestos físicos → PDF → facturación). Esto es preferencia editorial; el CONTEXT permite la decisión al planner.

**Estado relevante:** el componente recibe `cierreAdmin` y un `onChange(field, value)` para mutar individualmente cada campo de `CierreAdministrativo`. La nueva sección **no agrega campo nuevo** al tipo `CierreAdministrativo` (los consumos se persisten en `MovimientoStock`, NO en la OT), pero **sí** necesita acceso a `OT.patronesSeleccionados` (que vive en el root del doc `reportes/{otNumber}`, no en `cierreAdmin`).

**Props nuevas que necesita el contenedor:**

- `otNumber: string` (ya disponible)
- `patronesSeleccionados: PatronSeleccionado[]` (hay que pasarlo desde `EditOTModal`)
- `onPatronesConsumidosConfirmados?: () => void` (hook para refresh post-confirm)

**Flag de "ya descontado":** la sección debe verificar (en montaje) si ya hay `MovimientoStock` con `otNumber === X && entidadTipo === 'patron'` para no duplicar el descuento. Si los hay, la sección entra en modo read-only mostrando lo que ya se contabilizó.

### Pattern 4: Auto-Requerimiento desde el cierre admin (no Cloud Function)

**Precedente exacto:** `apps/sistema-modular/src/services/presupuestosService.ts:939-985` — al aceptar un presupuesto con ítems que requieren importación, dentro del flujo se llama a `getNextNumber()` para `REQ-XXXX` y se hace `batch.set(doc(collection(db, 'requerimientos_compra')), payload)` con `deepCleanForFirestore`.

**Replicación para patrón:**

```typescript
// Source: apps/sistema-modular/src/services/presupuestosService.ts:939-985 (FLOW-03 precedent)
async function autoCrearRequerimientosPatron(patronIds: string[]): Promise<string[]> {
  const config = await adminConfigService.getWithDefaults();
  const asignadoA = config.usuarioRequerimientosPatronId; // NUEVO campo opcional
  if (!asignadoA) return [];   // sin responsable configurado, skip silencioso
  const creados: string[] = [];
  for (const patronId of patronIds) {
    const patron = await patronesService.getById(patronId);
    if (!patron) continue;
    for (const lote of patron.lotes) {
      for (const comp of patron.componentes ?? []) {
        const saldo = computeSaldoComponente(patron, lote, comp.codigoComponente);
        const minimo = comp.stockMinimo ?? 0;
        if (saldo > minimo) continue;
        // verificar idempotencia: no crear si ya existe REQ abierto para el mismo trio (patronId, lote, codigoComponente)
        const existente = await requerimientosService.getAll({ origen: 'patron_minimo' });
        const yaHay = existente.some(r =>
          r.estado !== 'comprado' && r.estado !== 'cancelado' &&
          (r as any).patronId === patronId && (r as any).loteId === lote.lote && (r as any).codigoComponente === comp.codigoComponente,
        );
        if (yaHay) continue;
        const reqId = await requerimientosService.create({
          articuloId: null,                    // no aplica
          articuloCodigo: patron.codigoArticulo,
          articuloDescripcion: `${comp.descripcion} (componente de ${patron.descripcion}) — lote ${lote.lote}`,
          cantidad: 1,                          // se reemplaza el lote entero típicamente
          unidadMedida: comp.unidadMedida,
          motivo: `Componente ${comp.codigoComponente} bajo mínimo (${saldo}/${minimo}) — lote ${lote.lote}`,
          origen: 'patron_minimo' as OrigenRequerimiento, // NUEVO valor del enum
          origenRef: patronId,
          estado: 'pendiente',
          solicitadoPor: asignadoA,            // o el actor del cierre admin
          fechaSolicitud: new Date().toISOString(),
          urgencia: 'media',
          // CAMPOS NUEVOS OPCIONALES (extensión del tipo)
          patronId,
          loteId: lote.lote,                   // lote: string, no id (ver pitfall 3)
          codigoComponente: comp.codigoComponente,
        } as any);
        creados.push(reqId);
      }
    }
  }
  return creados;
}
```

### Anti-Patterns to Avoid

- **Anti-pattern A:** Crear `movimientosPatron` como colección nueva. Rompe la auditoría única, y `AuditoriaPage.tsx` no la mostraría. CONTEXT lo prohibe explícitamente.
- **Anti-pattern B:** Bundlear el descuento de patrones con el descuento de repuestos físicos en una sola `runTransaction`. CONTEXT lo prohibe — son sub-dominios independientes con servicios separados.
- **Anti-pattern C:** Modificar `OT.patronesSeleccionados` (el reporte técnico) cuando el admin difiere en el cierre. CONTEXT exige que el reporte quede intocable; la divergencia va sólo en `MovimientoStock.motivo`.
- **Anti-pattern D:** Persistir el array `componentesConsumidos[]` con `setDoc` directo desde un componente. Hay que pasar por el servicio para garantizar el `runTransaction` + `deepCleanForFirestore`.
- **Anti-pattern E:** Asumir que `PatronLote` tiene un `id` estable. NO lo tiene — la clave natural es `lote: string` (código del fabricante). Persistir movimientos por `lote: string` y matchear por igualdad. **Crítico** — ver pitfall 3.
- **Anti-pattern F:** Hacer que el descuento del patrón dispare desde reportes-ot al firmar. CONTEXT exige que el descuento sea 100% admin.
- **Anti-pattern G:** Renderizar el badge "lote bloqueado" en el render del PDF del protocolo. La excepción frozen autorizada es **sólo** para el selector visual de la app del técnico, no para el PDF.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic write de array `componentesConsumidos[]` + N MovimientoStock | Promesas seriales con manual rollback | `runTransaction` (calcado de `equivalenciasService.desagregarUnidades`) | Sin tx, un fallo a media-escritura deja el patrón con `componentesConsumidos` inconsistente y movimientos huérfanos. El precedente Phase 13 ya resolvió este patrón en producción. |
| Limpiar `undefined` de payloads anidados (array `componentesConsumidos`) | Iterar manualmente | `deepCleanForFirestore` | Regla `.claude/rules/firestore.md`; el AST rule `no-firestore-undefined` audita la falta. |
| Numeración correlativa `REQ-XXXX` para Requerimiento auto-generado | Contar docs y sumar | `requerimientosService.getNextNumber()` | Existente, scan-based como FLOW-03; pre-genera fuera de tx (ver nota del precedente — `getNextNumber` no es safe en runTransaction) |
| Leer config de usuario responsable | Hardcoded ID | `adminConfigService.getWithDefaults()` con campo nuevo `usuarioRequerimientosPatronId` | FLOW-07 ya gestiona usuarios por flow; reusar el mismo doc `adminConfig/flujos` para no fragmentar la UI admin. |
| Filtros persistidos en URL para "Bloqueados" en `PatronesList` | `useState` + sync manual a search params | `useUrlFilters(FILTER_SCHEMA)` con `bloqueados: { type: 'boolean', default: false }` | Convención `list-page-conventions`; `PatronesList` ya usa el hook |
| Lógica de "lote bloqueado" en 3 lugares (lista, ficha, selector reportes-ot) | Duplicar lógica en cada componente | Helper puro en `packages/shared/src/utils/patronBom.ts` consumido por sistema-modular y reportes-ot | Source of truth única; tests unitarios cubren una sola función. |
| FIFO por vencimiento para sugerir lote cuando hay ambigüedad | Comparator ad-hoc | Sort por `fechaVencimiento` ascendente + filtro `cantidad > 0` y `status !== 'agotado' && status !== 'bloqueado'` | Lógica simple pero típica fuente de bugs — encapsular en helper testeable. |

**Key insight:** El BOM en sí es trivial (sumas y comparaciones), pero **la atomicidad multi-write y la auto-generación de requerimientos idempotente** son los puntos donde proyectos similares se rompen. Phase 13 ya pavimentó ambos patrones; copiar fielmente esos servicios.

## Common Pitfalls

### Pitfall 1: Renombrar `codigoComponente` después de que un lote tiene consumo registrado

**What goes wrong:** Si el user edita el `codigoComponente` (texto libre) de un componente del patrón después de que algún `PatronLote.componentesConsumidos` lo referencia, el match por string-exact se rompe — el saldo calculado salta a `Infinity` (porque `componentes.find(...) === undefined`) y el lote aparece como "sin BOM", aunque sí tenga consumos contables en movimientos históricos.

**Why it happens:** El BOM matchea por `codigoComponente: string` exacto (decisión locked en CONTEXT — no se introduce `componente.id`).

**How to avoid:** Guarda en el editor — si `componentes[].codigoComponente` se intenta cambiar y existen consumos previos (`lotes.some(l => (l.componentesConsumidos ?? []).some(cc => cc.codigoComponente === oldCode))`), bloquear el rename con mensaje claro: "Este componente ya tiene consumos registrados; cambiar el código requiere borrar y recrear el patrón." En v1, **bloqueo duro** es preferible a migración silenciosa.

**Warning signs:** Saldos que de pronto cambian sin causa visible; PatronesList que deja de mostrar el badge "bloqueado" cuando antes sí lo mostraba.

### Pitfall 2: Re-descontar al re-abrir un cierre admin

**What goes wrong:** El cierre admin se puede reabrir (botón "Reabrir OT (volver a Cierre Administrativo)" ya existe en `OTCierreAdminSection.tsx:236`). Si al reabrir y volver a confirmar, el servicio crea otra tanda de `MovimientoStock` por patrón, el stock baja doble.

**Why it happens:** No hay sentinela; la sección no sabe que ya descontó.

**How to avoid:** Antes de mostrar la sección como editable, hacer una query `movimientosService.getAll({ otNumber, tipo: 'consumo' })` filtrada por `entidadTipo === 'patron'`. Si hay resultados, la sección renderiza en read-only con un banner "Ya descontado el dd/mm/yyyy por X" y opción "Reverso" diferida (descartado en v1 — ver `<deferred>`).

**Warning signs:** Lote con `componentesConsumidos` superando `cantidad × cantidadPorKit` (saldo negativo) sin razón evidente.

### Pitfall 3: `PatronLote` no tiene `id` — usar `lote: string` como clave

**What goes wrong:** Si se persiste `MovimientoStock.loteId` apuntando al índice del array (`'0'`, `'1'`), un reorder del array deja el movimiento apuntando a otro lote. Si se introduce `lote.id = crypto.randomUUID()` retroactivamente, hay que migrar los docs existentes (no contemplado).

**Why it happens:** `PatronLote` se modeló como inline array sin id (ver `packages/shared/src/types/index.ts:2208-2228`), el `lote: string` (código del fabricante) ya funciona como clave natural y es lo que persiste `PatronSeleccionado.lote` desde reportes-ot.

**How to avoid:** Persistir `MovimientoStock.lote: string` (no `loteId: string`) — el nombre del campo debe ser **`lote`**, no `loteId`, para evitar confusión. Match con `PatronLote.lote` exacto. Los lotes son únicos por patrón (validar en el editor que no se permite duplicar `lote` dentro del mismo patrón — guarda nueva).

**Warning signs:** MovimientoStock que muestra "lote 0" o "lote uuid" en `AuditoriaPage`; reportes-ot que filtra incorrectamente.

### Pitfall 4: Múltiples protocolos en la misma OT usando el mismo patrón+lote — la sugerencia de pre-fill

**What goes wrong:** Si dos protocolos del mismo `reportes/{otNumber}` ambos seleccionan el mismo `patron+lote`, el auto-prefill de "Patrones consumidos" puede sugerir 1 ampolla (deduplicando) o 2 (contando por uso). El CONTEXT dice "1 ampolla por componente del kit por cada uso registrado" — interpretación: 1 ampolla por componente, una vez por par (patron, lote) distinto **dentro de toda la OT**, no por cada protocolo. Eso es lo que el negocio normalmente quiere (un kit se abre una vez por jornada). Pero confirmar con el user.

**Why it happens:** `OT.patronesSeleccionados: PatronSeleccionado[]` es un array plano a nivel OT — NO está anidado por protocolo. Confirmado leyendo `apps/reportes-ot/hooks/useReportForm.ts:239-272` (el array es un único `useState` al nivel de la app, no por protocolo).

**How to avoid:** Deduplicar `patronesSeleccionados` por la clave `${patronId}::${lote}` antes de generar la sugerencia inicial. Si dos entradas coinciden, contar como 1 (1 ampolla por componente). El admin siempre puede aumentar manualmente.

**Warning signs:** La sugerencia inicial muestra 2× lo esperado cuando hay 2 protocolos en la misma OT con el mismo patrón.

### Pitfall 5: `cantidad` opcional en `PatronLote` — `(cantidad ?? 0)` para saldo

**What goes wrong:** `PatronLote.cantidad?: number | null` puede ser `null` o `undefined` (lotes legacy sin cantidad cargada). Si se computa `lote.cantidad * comp.cantidadPorKit` sin defaulting, se obtiene `NaN` y todo el saldo aguas abajo es `NaN`.

**Why it happens:** Field opcional desde 2025; muchos lotes existentes no lo tienen.

**How to avoid:** `(lote.cantidad ?? 0)` siempre en helpers de saldo. Adicionalmente, considerar mostrar warning en el editor cuando un lote BOM-aware no tiene `cantidad` definida (sin esto, está "vacío" desde día uno).

**Warning signs:** Saldos `NaN` en UI; lotes que aparecen como "agotado" sin razón.

### Pitfall 6: Hook `guard-reportes-ot.js` bloquea edits — recordar `CLAUDE_ALLOW_REPORTES_OT=1`

**What goes wrong:** El plan que toca `InstrumentoSelectorPanel.tsx` falla en el hook si no se exporta la variable. Plan no puede ejecutar tasks.

**Why it happens:** Hook `.claude/hooks/guard-reportes-ot.js` bloquea cualquier edit en `apps/reportes-ot/` salvo con la variable.

**How to avoid:** El planner debe documentar en el plan correspondiente (BOM-07) que la ejecución del task requiere `CLAUDE_ALLOW_REPORTES_OT=1`. Marcar el plan como "NOT autonomous: requires manual env var" si el orquestador no lo gestiona.

**Warning signs:** Mensaje del hook "Edición bloqueada por regla reportes-ot" en stderr; plan que parece atascado en un task que toca reportes-ot.

### Pitfall 7: `OTCierreAdminSection.tsx` muy cerca del budget de 250 líneas

**What goes wrong:** Agregar la sección "Patrones consumidos" inline empuja el componente sobre el budget. Hook `check-component-size.js` da warning soft, y el componente entra en el patrón de "componente dumping ground" que la regla `.claude/rules/components.md` prohíbe.

**Why it happens:** El archivo actual ya tiene 244 LOC (medido — ver hallazgo abajo).

**How to avoid:** El planner debe crear `CierrePatronesConsumidosSection.tsx` como subcomponente desde el primer commit (no inline). Mismo razonamiento aplica para `PatronEditorPage.tsx` (334 LOC ya pasado) y `PatronesList.tsx` (330 LOC ya pasado): extraer `PatronComponentesEditor.tsx`, `PatronRow.tsx`, `PatronComponentesAlertBanner.tsx` antes de seguir agregando.

**Warning signs:** Hook `check-component-size` warning persistente; código repetido entre componentes.

### Pitfall 8: Auto-Requerimiento se crea N veces (sin idempotencia)

**What goes wrong:** Si cada cierre admin recalcula el saldo y crea un Requerimiento al detectar saldo ≤ mínimo, una OT que se reabre y se vuelve a cerrar produce 2 requerimientos REQ-XXXX y REQ-XXXY para el mismo (patrónId, lote, codigoComponente). El responsable recibe duplicados.

**Why it happens:** Sin chequeo previo, el create es ciego.

**How to avoid:** Antes de crear, verificar si ya hay un `RequerimientoCompra` con `origen: 'patron_minimo'` + mismos `patronId/loteId/codigoComponente` + estado abierto (`'pendiente' | 'aprobado' | 'en_compra'`). Si lo hay, **skip silencioso**. Patrón ya en uso en `_cancelarRequerimientosCondicionales` (Phase 8 — Regla G).

**Warning signs:** Lista de requerimientos saturada con duplicados por el mismo componente.

## Code Examples

### Pattern: extensión backwards-compatible de tipos (Phase 13 precedent)

```typescript
// Source: packages/shared/src/types/index.ts:2456-2497 (Phase 13 STKE-01 precedent)
// Pattern: add optional fields to existing interfaces; consumers that ignore them keep working

// === BOM-01: Patron extension ===
export interface ComponentePatron {
  codigoComponente: string;        // texto libre interno (NO FK a Articulo)
  descripcion: string;
  cantidadPorKit: number;          // entero típico; acepta decimales
  unidadMedida: string;            // "ampolla", "vial", "frasco", "tira"
  stockMinimo?: number | null;     // default 0 (sólo alerta al agotarse)
}

export interface PatronComponenteConsumido {
  codigoComponente: string;        // match exacto con ComponentePatron.codigoComponente
  cantidadConsumida: number;       // acumulado de todos los consumos históricos
}

export interface PatronLote {
  // ... campos existentes (lote, fechaVencimiento, cantidad, certificadoUrl, etc.)
  /** Phase 14 BOM-01 — acumulado de consumo por componente */
  componentesConsumidos?: PatronComponenteConsumido[];
}

export interface Patron {
  // ... campos existentes
  /** Phase 14 BOM-01 — BOM declarativo. Vacío/omitido = patrón legacy sin desagregación. */
  componentes?: ComponentePatron[];
}

// === BOM-01: MovimientoStock extension ===
export interface MovimientoStock {
  // ... campos existentes
  /** Phase 14 BOM-01 — tipo de entidad del movimiento. Default 'articulo' si ausente. */
  entidadTipo?: 'articulo' | 'patron';
  /** Phase 14 — id del patrón cuando entidadTipo='patron'. */
  patronId?: string | null;
  /** Phase 14 — código del lote (string natural, NO id). */
  lote?: string | null;
  /** Phase 14 — código del componente consumido (match con Patron.componentes[].codigoComponente). */
  codigoComponente?: string | null;
}

// === BOM-08: AdminConfigFlujos extension ===
export interface AdminConfigFlujos {
  // ... campos existentes (usuarioSeguimientoId, usuarioCoordinadorOTId, etc.)
  /** Phase 14 BOM-08 — usuario asignado a Requerimientos auto-generados de patrón. */
  usuarioRequerimientosPatronId?: string | null;
}

// === BOM-08: Requerimiento extension ===
export type OrigenRequerimiento = 'manual' | 'presupuesto' | 'stock_minimo' | 'ingeniero' | 'patron_minimo'; // EXTEND

export interface RequerimientoCompra {
  // ... campos existentes
  /** Phase 14 BOM-08 — sólo cuando origen='patron_minimo'. */
  patronId?: string | null;
  loteId?: string | null;            // string del lote (natural key)
  codigoComponente?: string | null;
}
```

### Pattern: persistencia de `PatronSeleccionado` en la OT (confirmado en source)

```typescript
// Source: apps/reportes-ot/hooks/useReportForm.ts:239-336
//
// El reporte técnico persiste a nivel de doc Firestore reportes/{otNumber}:
//   {
//     ...resto del OT...
//     patronesSeleccionados: PatronSeleccionado[],
//     instrumentosSeleccionados: InstrumentoPatronOption[],
//     columnasSeleccionadas: ColumnaSeleccionada[],
//     protocolSelections: [...]
//   }
//
// PatronSeleccionado.lote (string del lote) ya es persistido — el cierre admin lo lee tal cual.

// Source: apps/reportes-ot/components/InstrumentoSelectorPanel.tsx:472-489
// El selector reportes-ot construye PatronSeleccionado desde Patron + PatronLote:
const patrones: PatronSeleccionado[] = [];
for (const key of checkedPatronesKeys) {
  const [patronId, idxStr] = key.split('__');
  const p = availablePatrones.find(x => x.id === patronId);
  const lote = p.lotes[parseInt(idxStr, 10)];
  patrones.push({
    patronId: p.id,
    codigoArticulo: p.codigoArticulo,
    descripcion: p.descripcion,
    marca: p.marca,
    categorias: p.categorias,
    lote: lote.lote,                          // ← string, no id
    fechaVencimiento: lote.fechaVencimiento,
    certificadoEmisor: lote.certificadoEmisor ?? null,
    certificadoUrl: lote.certificadoUrl ?? null,
  });
}
```

### Pattern: auto-Requerimiento desde service flow (FLOW-03 precedent)

```typescript
// Source: apps/sistema-modular/src/services/presupuestosService.ts:939-985
// Pattern: pre-generar numero REQ-XXXX fuera de tx, escribir docs con batch + audit
const qReq = query(collection(db, 'requerimientos_compra'), orderBy('numero', 'desc'));
const snapReq = await getDocs(qReq);
let maxNum = 0;
snapReq.docs.forEach(d => { /* parse REQ-XXXX */ });

const reqRef = doc(collection(db, 'requerimientos_compra'));
const payload = deepCleanForFirestore({
  numero: `REQ-${String(maxNum + 1).padStart(4, '0')}`,
  // ... fields
});
batch.set(reqRef, payload);
batchAudit(batch, { action: 'create', collection: 'requerimientos_compra', documentId: reqRef.id, after: payload });
```

### Pattern: configuración admin de responsables (FLOW-07 precedent)

```typescript
// Source: apps/sistema-modular/src/pages/admin/ConfigFlujosPage.tsx
// Pattern: AdminConfigFlujos lives en /adminConfig/flujos (single doc)
// UI: SearchableSelect con buildUserOptions(includeEmpty) sobre usuarios.filter(u => u.status === 'activo')

// BOM-08 — agregar al form de ConfigFlujosPage:
<div>
  <label className={fieldLabel}>Requerimientos de patrón (BOM-08)</label>
  <SearchableSelect
    value={form.usuarioRequerimientosPatronId || ''}
    onChange={v => setForm({ ...form, usuarioRequerimientosPatronId: v })}
    options={buildUserOptions(true, '(Sin responsable — los requerimientos quedan sin asignar)')}
    placeholder="Seleccionar usuario…"
    emptyMessage="No hay usuarios activos"
  />
  <p className="mt-1 text-[11px] text-slate-500">
    Recibe el Requerimiento auto-generado cuando un componente de un patrón cae bajo su stock mínimo.
  </p>
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Stock de patrones contado por kit entero (lote.cantidad) | BOM con consumo desagregado por componente | Phase 14 (esta fase) | Los 2 casos reales (5182-6917 / UV KIT 5062-6503) tienen modelo coherente; lote bloqueado por agotamiento de un componente es visible end-to-end |
| Sin alerta cuando ampolla individual se agota | Badge + Requerimiento auto-generado al cruzar stockMinimo | Phase 14 | Reposición proactiva — el responsable ve el REQ antes de que el técnico se entere en campo |
| Reportes-ot mostraba TODOS los lotes vigentes al técnico | Filtra/marca como no-seleccionable los lotes bloqueados | Phase 14 (excepción frozen) | Técnico no inicia un protocolo con un kit incompleto |

**Deprecated/outdated:** ninguno — toda la lógica BOM es aditiva.

## Open Questions

1. **¿La sugerencia auto-prefill es "1 por par (patrón, lote)" o "1 por uso registrado"?**
   - What we know: CONTEXT dice "1 ampolla por componente del kit por cada uso registrado".
   - What's unclear: `OT.patronesSeleccionados` es un array plano por OT (sin sub-anidamiento por protocolo). Si el técnico marcó el mismo patron+lote 2 veces (no debería, pero puede), ¿sugerir 1 o 2?
   - Recommendation: deduplicar por `${patronId}::${lote}` y sugerir 1 por componente. Admin sube si fue al revés. Documentar en el plan correspondiente.

2. **¿`computeSaldoComponente` vive en `packages/shared` o en `apps/sistema-modular/src/services`?**
   - What we know: reportes-ot necesita la misma lógica (badge "lote bloqueado").
   - What's unclear: el patrón actual del repo es duplicar tipos liviano (`apps/reportes-ot/types/instrumentos.ts` espeja parcialmente shared). ¿Importar desde `@ags/shared` o duplicar la función?
   - Recommendation: ponerlo en `packages/shared/src/utils/patronBom.ts` y consumir desde ambas apps. Es función pura sin side effects ni imports pesados.

3. **¿El cierre admin debe permitir descontar para una OT no-`CIERRE_ADMINISTRATIVO`?**
   - What we know: la sección sólo se renderiza dentro de `OTCierreAdminSection`, que sólo aparece en ese estado.
   - What's unclear: ¿qué pasa si el responsable de Materiales abre la OT, descarga patrones, pero luego el responsable de Facturación reabre y desbloquea?
   - Recommendation: ya está protegido por el flag `partesConfirmadas + stockDeducido` y el chequeo de movimientos existentes (Pitfall 2). El planner sólo debe ser explícito sobre el flag a checkear (probablemente reuse `cierreAdmin.stockDeducido` o agregue uno nuevo `cierreAdmin.patronesConsumidosDeducidos`).

4. **¿Phase 15 toca patrones? (no debería, pero confirmar)**
   - What we know: Phase 15 es "Venta loaner espejo a stock".
   - What's unclear: ¿el venta-loaner consume patrones? No por diseño (loaner es equipo prestado).
   - Recommendation: no preocuparse. Phase 14 cierra el sub-dominio patrones; Phase 15 vive en loaner.

## Validation Architecture

> Aplicable: `workflow.nyquist_validation` no está seteado en `.planning/config.json` (ausente → enabled).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `tsx` + `node:assert/strict` (no jest/vitest instalado) |
| Config file | none — cada test file se ejecuta directo con `tsx`; convención en `apps/sistema-modular/src/services/__tests__/*.test.ts` |
| Quick run command | `pnpm --filter @ags/sistema-modular test:patron-bom` (a agregar a `package.json`) |
| Full suite command | `pnpm --filter @ags/sistema-modular test:stock-amplio && pnpm --filter @ags/sistema-modular test:cuotas-facturacion && pnpm --filter @ags/sistema-modular test:equivalencias && pnpm --filter @ags/sistema-modular test:patron-bom` |
| E2E framework | `@playwright/test` ya instalado; suite vive en `apps/sistema-modular/e2e/`; **opcional** para Phase 14 (CONTEXT no lo exige, recomendación: smoke manual + unit tests suficiente para el riesgo) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BOM-01 | tipos compilan; consumidores existentes siguen funcionando | typecheck | `pnpm type-check` (root) | ✅ infra existe |
| BOM-02 | `computeSaldoComponente` para patrón sin BOM devuelve Infinity (modo legacy) | unit | `pnpm --filter @ags/sistema-modular test:patron-bom` | ❌ Wave 0: crear `patronBom.test.ts` |
| BOM-02 | `computeLoteStatus` devuelve `'bloqueado'` cuando un componente está agotado y otros no | unit | mismo | ❌ Wave 0 |
| BOM-02 | `computeLoteStatus` devuelve `'agotado'` cuando todos los componentes están en 0 | unit | mismo | ❌ Wave 0 |
| BOM-02 | `computeSaldoComponente` con `lote.cantidad = null` no devuelve NaN (defaulting) | unit | mismo | ❌ Wave 0 |
| BOM-03 | `consumirComponentes` baja correctamente N componentes en un lote BOM-aware (no race) | unit con mock Firestore (estilo `equivalenciasService.__setTestFirestore`) | mismo | ❌ Wave 0: extender `patronesService` con DI hook test |
| BOM-03 | `consumirComponentes` falla atómicamente si algún componente queda en saldo negativo | unit | mismo | ❌ Wave 0 |
| BOM-03 | `consumirComponentes` crea **1 MovimientoStock por componente** (granularidad fina) | unit | mismo | ❌ Wave 0 |
| BOM-03 | `consumirComponentes` con patrón sin BOM (legacy, `componentes = []`) hace no-op silencioso o falla loud (decisión planner) | unit | mismo | ❌ Wave 0 |
| BOM-05 | Pre-fill auto-prefila 1 ampolla por componente del kit por cada `PatronSeleccionado` único | unit (helper `buildPatronesConsumidosSugerencia(otPatronesSel, patrones)`) | mismo | ❌ Wave 0 |
| BOM-05 | Pre-fill dedupea por (patronId, lote) | unit | mismo | ❌ Wave 0 |
| BOM-05 | Cuando reporte técnico no especifica lote (lote vacío), helper FIFO por vencimiento sugiere el lote con vencimiento más próximo y capacidad disponible | unit | mismo | ❌ Wave 0 |
| BOM-05 | Sección admin renderiza read-only si ya hay movimientos previos para la OT (idempotencia) | manual UAT | smoke en `EditOTModal` con OT real | manual-only |
| BOM-06 | Badge "BOM" aparece en filas de `PatronesList` cuando patrón tiene `componentes.length > 0` | manual UAT (visual) | smoke en `/patrones` | manual-only (visual) |
| BOM-06 | Filtro "Bloqueados" persiste en URL (uso correcto de `useUrlFilters`) | manual UAT | smoke en `/patrones?bloqueados=true` | manual-only |
| BOM-07 | Selector reportes-ot deshabilita lote bloqueado (no se puede check-ear) | manual UAT | smoke en app del técnico | manual-only (frozen surface) |
| BOM-07 | PDF del reporte técnico **NO** cambia (regresión cero) | manual UAT | comparar PDF generado antes/después | manual-only (frozen surface) |
| BOM-08 | Auto-Requerimiento se crea con `origen: 'patron_minimo'` cuando saldo final cruza `stockMinimo` | unit | mismo `test:patron-bom` con mock | ❌ Wave 0 |
| BOM-08 | Auto-Requerimiento NO duplica (idempotencia) si ya hay REQ abierto para el mismo (patronId, lote, codigoComponente) | unit | mismo | ❌ Wave 0 |
| BOM-08 | `usuarioRequerimientosPatronId` configurable desde `/admin/config-flujos` y persiste correctamente | manual UAT | smoke en página admin | manual-only |

### Sampling Rate

- **Per task commit:** `pnpm --filter @ags/sistema-modular test:patron-bom` (< 5s — runner tsx puro, sin emulador)
- **Per wave merge:** correr toda la batería:
  ```bash
  pnpm type-check && \
  pnpm --filter @ags/sistema-modular test:stock-amplio && \
  pnpm --filter @ags/sistema-modular test:cuotas-facturacion && \
  pnpm --filter @ags/sistema-modular test:equivalencias && \
  pnpm --filter @ags/sistema-modular test:patron-bom
  ```
- **Phase gate:** Antes de `/gsd:verify-work`, ejecutar full suite + checkpoint manual UAT en `EditOTModal` (cierre admin con `consumirComponentes` real contra Firestore dev) + smoke visual de la app reportes-ot para confirmar PDF no regresionó.

### Wave 0 Gaps

- [ ] `apps/sistema-modular/src/services/__tests__/patronBom.test.ts` — cubre BOM-02, BOM-03, BOM-05 (pure-fn parts), BOM-08 con mock DI
- [ ] `apps/sistema-modular/src/services/__tests__/fixtures/patronBom.ts` — fixtures: patrón sin BOM, patrón con BOM saludable, patrón con un componente bloqueado, patrón con todos los componentes agotados, OT con `patronesSeleccionados` duplicados, etc.
- [ ] `apps/sistema-modular/package.json` — agregar script `"test:patron-bom": "tsx src/services/__tests__/patronBom.test.ts"` (espejo exacto de los Phase 12/13)
- [ ] `apps/sistema-modular/src/services/patronesService.ts` — agregar DI hook `__setTestFirestore` (espejo exacto de `equivalenciasService.ts:38-78`) y separar `consumirComponentes` en `_runInProd` / `_runInTest` (mismo split que Phase 13)
- [ ] **No** se necesita config nueva de framework — `tsx` ya está instalado, `node:assert/strict` es nativo
- [ ] Documentar en SUMMARY del primer plan que el smoke UAT del frozen-surface (reportes-ot selector) es **manual obligatorio antes de cerrar la fase**

## Sources

### Primary (HIGH confidence) — source files in repo

- `packages/shared/src/types/index.ts:2204-2255` — `PatronLote` + `Patron` actuales (sin BOM)
- `packages/shared/src/types/index.ts:2700-2751` — `MovimientoStock` + `TipoMovimiento` actuales (con extensión STKE-01 ya in-place)
- `packages/shared/src/types/index.ts:4060-4083` — `PatronSeleccionado` (el shape que aterriza en `OT.patronesSeleccionados`)
- `packages/shared/src/types/index.ts:1001-1019` — `AdminConfigFlujos` (a extender con `usuarioRequerimientosPatronId`)
- `packages/shared/src/types/index.ts:3185-3252` — `RequerimientoCompra` + `OrigenRequerimiento` + `EstadoRequerimiento`
- `packages/shared/src/types/index.ts:148-160` — `CierreAdministrativo` (no se modifica; la fase no agrega campos a este tipo)
- `apps/sistema-modular/src/services/patronesService.ts` — service actual (CRUD + storage de certificados); se extiende con `consumirComponentes`
- `apps/sistema-modular/src/services/stockService.ts:580-708` — `movimientosService` (escribe `MovimientoStock` con `cleanFirestoreData` + audit + logBusinessEvent)
- `apps/sistema-modular/src/services/importacionesService.ts:189-280` — `requerimientosService` (CRUD + `getNextNumber()` REQ-XXXX)
- `apps/sistema-modular/src/services/adminConfigService.ts` — patrón de single-doc config en `/adminConfig/flujos`
- `apps/sistema-modular/src/services/equivalenciasService.ts:245-478` — **PRECEDENTE EXACTO** para `runTransaction` (`desagregarUnidades`) y test DI hook
- `apps/sistema-modular/src/services/presupuestosService.ts:939-985` — **PRECEDENTE EXACTO** para auto-creación de `RequerimientoCompra` con batch + audit
- `apps/sistema-modular/src/services/presupuestosService.ts:1700-1755` — `_cancelarRequerimientosCondicionales` (patrón de idempotencia / "Regla G")
- `apps/sistema-modular/src/components/ordenes-trabajo/OTCierreAdminSection.tsx` (244 LOC) — pipeline inline de secciones; insertion point ~línea 165 (antes de `<CierreStockSelector>`)
- `apps/sistema-modular/src/components/ordenes-trabajo/CierreStockSelector.tsx` (96 LOC) — patrón de table-based selector reusable
- `apps/sistema-modular/src/hooks/useEditOTForm.ts:157-229` — `handleCierreChange` + `handleConfirmarCierre` (el container)
- `apps/sistema-modular/src/pages/patrones/PatronEditorPage.tsx` (334 LOC) — editor actual; insertion point ~después de "Lotes" card
- `apps/sistema-modular/src/pages/patrones/PatronesList.tsx` (330 LOC) — list actual; `useUrlFilters(FILTER_SCHEMA)` ya en uso
- `apps/sistema-modular/src/hooks/usePatrones.ts` (97 LOC) — wrapper sobre service; se extiende mínimo
- `apps/sistema-modular/src/pages/admin/ConfigFlujosPage.tsx` (257 LOC) — patrón para agregar nuevo input de usuario
- `apps/reportes-ot/components/InstrumentoSelectorPanel.tsx:144-249` — `PatronesTab` (tab "Patrones" — donde aterriza el badge + disable de Phase 14 BOM-07); 619 LOC total
- `apps/reportes-ot/hooks/useReportForm.ts:239-336` — confirmación de que `patronesSeleccionados` vive en `reportes/{otNumber}.patronesSeleccionados` (root del doc OT)
- `apps/reportes-ot/services/firebaseService.ts:223-271` — `saveReporte`/`listenReporte` (read-side para auto-prefill)
- `firestore.rules` — todas las colecciones relevantes (`patrones`, `movimientosStock`, `requerimientos_compra`, `adminConfig`, `reportes`) tienen `allow read, write: if true;` — **NO se requieren cambios en rules**
- `apps/sistema-modular/package.json` — confirma stack de tests (`tsx`, sin jest/vitest); convención `test:<dominio>`
- `.claude/rules/firestore.md` — `deepCleanForFirestore` obligatorio para writes anidados
- `.claude/rules/components.md` — budget 250 LOC, extraer hooks/subcomponentes antes
- `.claude/rules/reportes-ot.md` — frozen surface + `CLAUDE_ALLOW_REPORTES_OT=1` gate
- `.claude/rules/release-flow.md` — Phase 14 toca runtime sistema-modular → tendrá que ir por `pnpm --filter @ags/sistema-modular release:minor` (es una feature nueva visible al user)
- `.claude/skills/list-page-conventions/SKILL.md` — patrón para extender `PatronesList`
- `memory/MEMORY.md` (sección `## Stock Evolution` + `project_stock_v2_decisions.md`) — driver y design completo

### Secondary (MEDIUM confidence) — convenciones documentadas

- Phase 13 STATE entries (líneas 399-418 de STATE.md) — todas las decisiones recientes que aplican aquí 1:1 (DI hook, lazy imports para romper ciclos, `displayName` no `nombre`, etc.)
- Phase 8 STATE entries (líneas 324-337) — patrón FLOW-03 / auto-Requerimiento desde service flow
- Phase 9 STATE entries — política "Cloud Functions SOLO para denormalización"

### Tertiary (LOW confidence)

(ninguno — toda la fase se resuelve con conocimiento interno del repo, no requiere fuentes externas)

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — todas las libs y helpers están instalados y verificados en uso actual; no se introducen dependencias nuevas
- Architecture: HIGH — precedentes exactos en Phase 13 (`equivalenciasService`) y Phase 8 (`presupuestosService.aceptarConRequerimientos`) cubren cada patrón sensible
- Pitfalls: HIGH (1-7) / MEDIUM (8) — los pitfalls 1-7 están confirmados en código y memoria; el 8 (idempotencia auto-Requerimiento) es por analogía con Phase 8 Regla G
- Tipos a extender: HIGH — todas las interfaces leídas directamente del source
- Persistencia de `PatronSeleccionado`: HIGH — confirmada al leer `useReportForm.ts` y `InstrumentoSelectorPanel.tsx`
- Firestore rules: HIGH — leídas directo de `firestore.rules` (root); ninguna requiere cambio
- Frozen-surface exception scope: HIGH — `InstrumentoSelectorPanel.tsx` identificado como el único archivo de reportes-ot a tocar

**Research date:** 2026-05-20
**Valid until:** 2026-06-19 (30 días — stack estable, sin libs externas con churn)
