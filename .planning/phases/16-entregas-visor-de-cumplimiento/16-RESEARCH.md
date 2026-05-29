# Phase 16: Entregas — Visor de cumplimiento - Research

**Researched:** 2026-05-29
**Domain:** Presupuestos data model + Comex chain resolution + List-page patterns (sistema-modular)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Campo `disponibilidad: 'stock' | 'post_facturacion' | 'a_importar' | 'en_transito'` en `PresupuestoItem` (opcional).
- Campo `etaDiasEstimados: number | null` en `PresupuestoItem` — días desde aceptación del presupuesto. ETA = `fechaAceptacion + etaDiasEstimados`.
- Default por disponibilidad al agregar item: ATP > 0 → `'stock'`; si no → `'a_importar'`. Siempre editable.
- No crear colección nueva `entregas/` — planilla resuelta on-the-fly desde presupuestos aceptados + cadena req→OC→IMP.
- Columnas obligatorias: Cliente, Item (descripción), Cantidad, Valor unitario (en moneda del ppto), Presupuesto#, OT# asociada (manual), OC#, Importación# + estado, ETA original (fecha), Días restantes (con semáforo).
- Semáforo: > 5 días = verde; 0–5 días = amarillo; < 0 = rojo; `recibido` o OT en cierre admin = N/A (gris).
- Filtros persistidos vía `useUrlFilters`: cliente, estado importación, semáforo, texto libre.
- Source rows: presupuestos en estado `aceptado`, `en_ejecucion`, `finalizado` (no borrador / no anulado).
- OT# editable desde la fila → escribe en `presupuestoItem.otNumeroVinculada: string | null`. NO genera ni modifica OT.
- Patrón de list-page estándar (PageHeader + filtros + tabla resizable + Sort URL).
- Sidebar: entrada nueva bajo Stock/Compras o como root nuevo "Entregas". Decidir en plan.
- Atajo "aplicar a todos" en el editor de presupuestos para bulk-set `disponibilidad` + `etaDiasEstimados`.
- Campos visibles en modal de creación Y de edición (modal-first-create parity).
- Auditoría via `auditUpdate` existente al guardar el presupuesto. Sin evento nuevo de negocio.

### Claude's Discretion
- Decidir si `presupuestoItemId` se agrega a `RequerimientoCompra` o si se matchea por (articuloId + cantidad).
- Decidir si `clienteNombre` se resuelve en el resolver via cache de clientes (ya disponible) o si se agrega al `Presupuesto` type como campo denormalizado.
- Decidir si `fechaAceptacion` se agrega explícitamente a `Presupuesto` o se usa `updatedAt` capturado en la transición.
- Sidebar placement: decidir grupo (Compras bajo Stock, o nuevo grupo "Entregas" en root).
- Si OT# usa `SearchableSelect` con `ordenesTrabajoService` o input de texto libre.
- Política de cache (TTL 2 min via `serviceCache`) para la vista.

### Deferred Ideas (OUT OF SCOPE)
- Notificaciones push/mail por incumplimiento de ETA.
- Re-cálculo automático de ETA.
- Dashboard de KPIs de cumplimiento.
- Auto-cosecha items→OT (decisión cutover 2026-05-24).
- Export a Excel.
- Vista por cliente agrupada.
- Vinculación 1:N item↔OT.
</user_constraints>

---

## Summary

Esta phase agrega visibilidad operativa de entregas comprometidas sobre la infraestructura de datos ya existente. El trabajo técnico tiene dos caras: (1) extender el modelo de datos de `PresupuestoItem` con tres campos nuevos (`disponibilidad`, `etaDiasEstimados`, `otNumeroVinculada`) y agregar `fechaAceptacion` a `Presupuesto`; (2) construir el resolver que atraviesa la cadena `presupuesto.items → requerimientos_compra → ordenes_compra → importaciones` para componer las filas de la planilla.

La cadena de IDs está **parcialmente** modelada: `RequerimientoCompra.presupuestoId` existe, pero `RequerimientoCompra.presupuestoItemId` NO existe. Esto es el hallazgo más crítico del research. La decisión entre agregar `presupuestoItemId` (cirugía mínima + robustez) vs. inferir el match por `(articuloId, cantidad)` (sin migración pero frágil) debe tomarse explícitamente en el plan.

El patrón de list-page está completamente especificado en el skill `list-page-conventions` y en `ImportacionesList.tsx` como referencia perfecta. La vista `/entregas` es una list-page estándar con un resolver personalizado en el hook — la complejidad es de dominio, no de infraestructura.

**Primary recommendation:** Agregar `presupuestoItemId` a `RequerimientoCompra` (Wave 0 de esta phase), y agregar `fechaAceptacion` a `Presupuesto`. Ambas son extensiones backward-compatible (campos opcionales). Luego construir el resolver con `Promise.all` en un hook dedicado `useEntregasResolver`.

---

## Standard Stack

### Core (existente en el proyecto — HIGH confidence)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | 19.x | UI | Stack del proyecto |
| TypeScript 5.8 | 5.8 | Tipado | Stack del proyecto |
| Firebase Firestore | SDK 11.x | Datos | Stack del proyecto |
| Tailwind CSS | 3.x | Estilos | Stack del proyecto |
| react-router-dom v7 | 7.x | Routing | Stack del proyecto |

### Hooks/Utils del proyecto (ya implementados — HIGH confidence)

| Atom | Ubicación | Propósito | Cuándo usar |
|------|-----------|-----------|-------------|
| `useUrlFilters` | `@ags/shared` (re-exported) | Filtros persistidos en URL | Obligatorio para filtros |
| `useResizableColumns` | `@ags/shared` (re-exported) | Columnas redimensionables | Toda list page |
| `serviceCache` | `apps/sistema-modular/src/services/serviceCache.ts` | TTL 2 min | Listas frecuentes |
| `PageHeader` | `components/ui/PageHeader.tsx` | Header estándar con count | Toda list page |
| `SortableHeader` | `components/ui/SortableHeader.tsx` | Columnas sorteables | Toda list page |
| `SearchableSelect` | `components/ui/SearchableSelect.tsx` | Selects con búsqueda | Filtros + edición inline |
| `deepCleanForFirestore` | `services/firebase.ts` | Strip undefined nested | Toda escritura nested |
| `getUpdateTrace` | `services/firebase.ts` | Audit trace en updates | Toda actualización |
| `batchAudit` | `services/firebase.ts` | Log de auditoría | Writes con audit |

### Servicios existentes relevantes (HIGH confidence)

| Servicio | Ubicación | Qué provee |
|----------|-----------|-----------|
| `presupuestosService.getAll()` | `services/presupuestosService.ts` | Presupuestos por estado |
| `requerimientosService.getAll({ presupuestoId })` | `services/importacionesService.ts` | Reqs por presupuesto |
| `ordenesCompraService.getAll()` / `.getById()` | `services/importacionesService.ts` | OC con items |
| `importacionesService.getAll()` | `services/importacionesService.ts` | Importaciones con items |

---

## Architecture Patterns

### Recommended Project Structure for Phase 16

```
packages/shared/src/types/index.ts
  └── PresupuestoItem extended (disponibilidad, etaDiasEstimados, otNumeroVinculada)
  └── Presupuesto extended (fechaAceptacion)
  └── RequerimientoCompra extended (presupuestoItemId — recomendado)

apps/sistema-modular/src/
├── pages/entregas/
│   ├── index.tsx                    # barrel
│   ├── EntregasList.tsx             # list page principal (<250 líneas)
│   ├── EntregasFilters.tsx          # sub-componente filtros (extraído para cumplir budget)
│   └── EntregasRow.tsx              # fila con edición inline de OT#
├── hooks/
│   └── useEntregasResolver.ts       # resolver de la cadena ppto→req→oc→imp
└── components/presupuestos/
    └── PresupuestoItemDisponibilidadFields.tsx  # nuevo: select+input para disponibilidad/eta
```

### Pattern 1: Resolver de cadena (cliente-side con Promise.all)

**What:** El hook `useEntregasResolver` carga en paralelo todos los recursos necesarios y construye una lista plana de filas (`EntregaRow`).

**When to use:** Cuando la data viene de múltiples colecciones no relacionables en una query Firestore.

**Flow:**
```
1. presupuestosService.getAll({ estados: ['aceptado','en_ejecucion','finalizado'] })
2. Para cada presupuesto:
   a. Iterar ppto.items → una fila base por item (sin req/oc/imp)
   b. requerimientosService.getAll({ presupuestoId: ppto.id })
      → matchear req con item via presupuestoItemId (si existe) o fallback articuloId
3. Para cada req con ordenCompraId:
   a. ordenesCompraService.getById(req.ordenCompraId)
      → buscar ItemOC.requerimientoId === req.id → obtener OC#
4. Para cada req con requerimientoId en importaciones:
   a. importacionesService.getAll() (cacheado)
      → buscar ItemImportacion.requerimientoId === req.id → obtener IMP# + estado
5. Computar ETA: ppto.fechaAceptacion + item.etaDiasEstimados
6. Computar días restantes: eta - new Date() → semáforo
```

**Performance note:** Con 100-500 rows, los getAll en paralelo con `Promise.all` son aceptables en cliente. Si hay > 500 presupuestos aceptados, considerar paginación o query acotada. Documentar como TODO para post-corte.

**Example structure:**
```typescript
// Source: patterns existentes en apps/sistema-modular/src/hooks/useImportaciones.ts
export interface EntregaRow {
  presupuestoId: string;
  presupuestoNumero: string;
  itemId: string;
  clienteId: string;
  clienteNombre: string;           // denormalizado en load time via clientesMap
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  moneda: string;
  disponibilidad: string | null;
  etaDiasEstimados: number | null;
  fechaAceptacion: string | null;  // Presupuesto.fechaAceptacion
  etaFecha: string | null;         // computado: fechaAceptacion + etaDiasEstimados
  diasRestantes: number | null;    // computado: etaFecha - now
  semaforo: 'verde' | 'amarillo' | 'rojo' | 'entregado' | 'sin_eta';
  otNumeroVinculada: string | null;
  requerimientoId: string | null;
  ocNumero: string | null;
  importacionId: string | null;
  importacionNumero: string | null;
  importacionEstado: string | null;
}
```

### Pattern 2: FILTER_SCHEMA con useUrlFilters

```typescript
// Source: ImportacionesList.tsx + RequerimientosList.tsx — misma forma
const FILTER_SCHEMA = {
  clienteId:   { type: 'string' as const, default: '' },
  estImp:      { type: 'string' as const, default: '' },
  semaforo:    { type: 'string' as const, default: '' },
  search:      { type: 'string' as const, default: '' },
  sortField:   { type: 'string' as const, default: 'diasRestantes' },
  sortDir:     { type: 'string' as const, default: 'asc' },
};
const [filters, setFilter] = useUrlFilters(FILTER_SCHEMA);
```

### Pattern 3: Edición inline de OT# en fila

La columna OT# usa un input de texto inline con debounce de guardado. Al confirmar (blur / Enter), llama a `presupuestosService.update(ppto.id, { items: [...items con otNumeroVinculada actualizado] })`. No usa SearchableSelect de OTs porque la OT# es un string de 5 dígitos conocido (la coordinadora lo sabe de memoria), y el servicio de OTs no está en scope de carga. Input de texto libre con placeholder `"Ej: 25660"` es suficiente.

**Justification:** `SearchableSelect` requiere cargar toda la colección `ordenes_trabajo` (posiblemente grande). El campo es un número que la coordinadora escribe directo. El valor se guarda en `presupuestoItem.otNumeroVinculada` sin FK validation — consistency trade-off explícito por simplicidad.

### Anti-Patterns to Avoid

- **useState para filtros:** Usar `useUrlFilters` siempre. Ver `feedback_filter_persistence.md`.
- **Componentes > 250 líneas:** `EntregasList.tsx` debe extraer `EntregasFilters.tsx` y `EntregasRow.tsx`.
- **Colección `entregas/`:** Definida como anti-pattern explícito en CONTEXT.md.
- **undefined en writes:** Al actualizar `items[]` del presupuesto, usar `deepCleanForFirestore`.
- **Reads directos de firebase/firestore:** Usar siempre desde `'./firebase'` (convención del repo — bug Electron conocido con buscadores post-write).

---

## Critical Finding: Cadena de IDs

### Estado actual (HIGH confidence — verificado en código)

```
Presupuesto.items[].id         → solo existe en memoria del doc
   ↓ aceptarConRequerimientos()
RequerimientoCompra.presupuestoId   ✅ existe
RequerimientoCompra.presupuestoItemId  ❌ NO EXISTE
   ↓ via req.id
ItemOC.requerimientoId         ✅ existe
   ↓ via req.id
ItemImportacion.requerimientoId ✅ existe
```

### Decisión recomendada (MEDIUM confidence — evaluación de tradeoffs)

**Opción A (recomendada): Agregar `presupuestoItemId?: string | null` a `RequerimientoCompra`**

- Cirugía mínima en el tipo (campo opcional — retrocompat).
- Actualizar `aceptarConRequerimientos()` para escribir `presupuestoItemId: item.id` al crear el req.
- El resolver puede hacer un join O(1) por ID.
- Presupuestos existentes: `presupuestoItemId = null` → resolver cae al fallback articuloId.
- Costo: una línea extra en el payload del tx (trivial).

**Opción B (alternativa): Match por (articuloId, cantidad)**

- Sin migración de código en `aceptarConRequerimientos`.
- Frágil: si hay dos items con el mismo artículo en cantidades distintas, el match puede ser ambiguo.
- Para presupuestos de contrato con servicios sin `stockArticuloId`, el req no existe (correcto: solo items `itemRequiereImportacion=true` generan req).
- Legado: funciona para presupuestos históricos igualmente bien/mal.

**Decisión en el plan:** Usar Opción A. Costo mínimo, robustez máxima. El plan Wave 0 debe incluir la extensión del tipo y el patch de `aceptarConRequerimientos`.

### Estado de `Presupuesto.fechaAceptacion` (HIGH confidence — verificado en código)

`Presupuesto` NO tiene un campo `fechaAceptacion`. La transición a `aceptado` setea `updatedAt: Timestamp.now()` pero ese campo se pisa en cada update posterior.

**Decisión recomendada:** Agregar `fechaAceptacion?: string | null` a `Presupuesto` en `@ags/shared`. Escribirlo en `aceptarConRequerimientos()` como parte del update del presupuesto (dentro de la runTransaction). Para presupuestos históricos ya en estado `aceptado`: `fechaAceptacion = null` → resolver muestra "Sin ETA" (badge gris, documentado en CONTEXT.md como aceptable).

### Estado de `clienteNombre` en `Presupuesto` (HIGH confidence — verificado en código)

`Presupuesto` NO tiene `clienteNombre` denormalizado. Solo tiene `clienteId`. El resolver necesita construir un mapa `clienteId → razonSocial` cargando `clientesService.getAll()` (o usando `serviceCache`). El serviceCache tiene TTL 2 min — válido para esta lectura.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Filtros en URL | useState + useEffect | `useUrlFilters` de `@ags/shared` | Regla del repo + feedback memory |
| Columnas redimensionables | resize handlers custom | `useResizableColumns` de `@ags/shared` | Ya probado + API lista |
| Tabla con sort | custom sort state | `SortableHeader` + `sortByField` de `@ags/shared` | Patrón estándar |
| Header de page | div custom | `PageHeader` de `components/ui/` | Consistencia visual |
| Limpieza de undefined | `Object.fromEntries(...)` manual | `deepCleanForFirestore` | Nested objects + arrays |
| Audit trace | campos manuales | `getUpdateTrace()` + `batchAudit()` | Audit chain completo |
| Writes Firestore | `from 'firebase/firestore'` directo | desde `'./firebase'` (wrapper) | Fix bug Electron keyboard router |

---

## Common Pitfalls

### Pitfall 1: ETA computation con `fechaAceptacion = null`

**What goes wrong:** `null + etaDiasEstimados` produce `NaN` o excepción.
**Why it happens:** Presupuestos históricos sin `fechaAceptacion`. También items sin `etaDiasEstimados` (campo nuevo, ppto viejo).
**How to avoid:** El resolver siempre checkea `if (!ppto.fechaAceptacion || item.etaDiasEstimados == null)` → `etaFecha = null`, `semaforo = 'sin_eta'`. Badge gris "Sin ETA" en la columna Días restantes.
**Warning signs:** Columnas de días restantes mostrando "NaN días" o "-Infinity".

### Pitfall 2: N+1 queries en el resolver

**What goes wrong:** Para cada presupuesto se hace un `getById` de OC y otra de importación — con 50 presupuestos = 100+ queries.
**Why it happens:** Resolver ingenuo que no agrupa.
**How to avoid:** Pre-cargar `importacionesService.getAll()` en paralelo (una sola query), construir un índice `Map<requerimientoId, ItemImportacion>`. Para OCs: `ordenesCompraService.getAll()` también en paralelo. El resolver luego hace lookups O(1).
**Warning signs:** Loading spinner > 5 segundos para < 100 rows.

### Pitfall 3: `presupuestoItem.id` como key

**What goes wrong:** `id` del item en `Presupuesto.items[]` es un campo local que puede ser `undefined` en items legacy.
**Why it happens:** Items agregados antes de que se formalizara el campo `id` en `PresupuestoItem`.
**How to avoid:** El resolver usa `item.id ?? item.codigoProducto ?? item.descripcion` como key de fallback. En los renders, siempre `key={item.id || index}`.
**Warning signs:** React warn "each child in a list should have a unique key prop".

### Pitfall 4: Update de items[] con item editado

**What goes wrong:** Al guardar `otNumeroVinculada`, se hace `presupuestosService.update(id, { items: newItems })` que pisa toda la lista. Si dos usuarios editan el mismo presupuesto simultáneamente, uno pisa al otro.
**Why it happens:** Firestore no soporta update de subdocumento de array por index.
**How to avoid:** Esto es un trade-off conocido en el proyecto (mismo patrón que edición de items en el editor). Documentar la limitación en code comment. Para mitigar: el botón de guardar OT# en la fila debe ser optimista (actualiza UI local inmediatamente) y la UI debe mostrar "Guardado" brevemente.
**Warning signs:** Dos coordinadoras editando simultáneamente → una pierde su cambio silenciosamente.

### Pitfall 5: Semáforo con timezone

**What goes wrong:** `new Date()` devuelve hora local del browser; si el servidor guardó fechas en UTC, `diasRestantes` puede estar off by 1 en el cambio de día.
**Why it happens:** Mixing de ISO strings y Date objects.
**How to avoid:** Comparar siempre a nivel de "día completo": `differenceInCalendarDays(parseISO(etaFecha), startOfDay(new Date()))`. Si no se usa date-fns (no está en el proyecto), usar `Math.ceil((new Date(etaFecha).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000)`.
**Warning signs:** Items que deberían ser verdes aparecen amarillos el día de la ETA.

### Pitfall 6: `disponibilidad` vacío en items de contrato

**What goes wrong:** Items de presupuestos de tipo `contrato` son servicios (sin `stockArticuloId`) — `disponibilidad` queda `undefined`/`null` aunque sean items reales.
**Why it happens:** El campo es nuevo y el default de ATP solo aplica a items con `stockArticuloId`.
**How to avoid:** Para items de contrato (servicios), `disponibilidad` default = `'post_facturacion'` si no está seteado. El resolver muestra estos items con disponibilidad "post_facturacion" aunque no tengan req/OC/IMP — son servicios, se "entregan" cuando la OT está cerrada.
**Warning signs:** Items de contrato sin disponibilidad mostrando badge vacío.

---

## Code Examples

Verified patterns from project sources:

### FILTER_SCHEMA + useUrlFilters
```typescript
// Source: apps/sistema-modular/src/pages/stock/ImportacionesList.tsx (lines 17-21)
const FILTER_SCHEMA = {
  estado:    { type: 'string' as const, default: '' },
  sortField: { type: 'string' as const, default: 'fechaEstimadaArribo' },
  sortDir:   { type: 'string' as const, default: 'desc' },
};
const [filters, setFilter] = useUrlFilters(FILTER_SCHEMA);
```

### useResizableColumns
```typescript
// Source: apps/sistema-modular/src/pages/stock/ImportacionesList.tsx (line 35)
const { tableRef, colWidths, colAligns, onResizeStart, onAutoFit, cycleAlign, getAlignClass } =
  useResizableColumns('entregas-list'); // clave de localStorage única
```

### SortableHeader + sortByField
```typescript
// Source: apps/sistema-modular/src/pages/stock/ImportacionesList.tsx (lines 37-41, 43-46)
const handleSort = (f: string) => {
  const s = toggleSort(f, filters.sortField, filters.sortDir as SortDir);
  setFilter('sortField', s.field);
  setFilter('sortDir', s.dir);
};
const sorted = useMemo(
  () => sortByField(rows, filters.sortField, filters.sortDir as SortDir),
  [rows, filters.sortField, filters.sortDir],
);
```

### deepCleanForFirestore en update de items[]
```typescript
// Source: apps/sistema-modular/src/services/presupuestosService.ts (líneas ~370-390 pattern)
await presupuestosService.update(presupuestoId, deepCleanForFirestore({
  items: newItems,  // array puede contener undefined en campos opcionales nuevos
  updatedAt: Timestamp.now(),
}));
```

### Semáforo de días restantes
```typescript
// Source: apps/sistema-modular/src/pages/stock/ImportacionesList.tsx (lines 23-27 — ETA pattern)
const computeSemaforo = (diasRestantes: number | null): 'verde' | 'amarillo' | 'rojo' | 'entregado' | 'sin_eta' => {
  if (diasRestantes === null) return 'sin_eta';
  if (diasRestantes > 5) return 'verde';
  if (diasRestantes >= 0) return 'amarillo';
  return 'rojo';
};

const SEMAFORO_COLORS = {
  verde:     'text-emerald-600',
  amarillo:  'text-amber-500',
  rojo:      'text-red-600',
  entregado: 'text-slate-400',
  sin_eta:   'text-slate-300',
};
```

### Resolver paralelo (Promise.all pattern)
```typescript
// Patron basado en Phase 14-02 y aceptarConRequerimientos
const [presupuestos, reqs, ocs, imps, clientesArr] = await Promise.all([
  presupuestosService.getAll({ /* estados aceptado+ */ }),
  requerimientosService.getAll({ origen: 'presupuesto' }),
  ordenesCompraService.getAll(),
  importacionesService.getAll(),
  clientesService.getAll(),
]);
// Construir indices para joins O(1)
const reqsByPresupuestoItemId = new Map<string, RequerimientoCompra>();
const ocByReqId = new Map<string, { ocNumero: string; ocId: string }>();
const impByReqId = new Map<string, { impNumero: string; impId: string; impEstado: string }>();
const clienteNombreById = new Map<string, string>(clientesArr.map(c => [c.id, c.razonSocial]));
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useState` para filtros | `useUrlFilters` (URL persistido) | Feedback post-Phase 1 | Filtros sobreviven navegación |
| Escribir desde `'firebase/firestore'` directo | Desde `'./firebase'` wrapper | Commit bfd0e7d (Phase 15) | Fix bug Electron keyboard router |
| Colección extra para vistas derivadas | Resolver on-the-fly | Decisión CONTEXT | Evita desincronización |

---

## Open Questions

1. **Match item↔requerimiento sin `presupuestoItemId`**
   - What we know: `RequerimientoCompra.presupuestoId` existe; `presupuestoItemId` no existe.
   - What's unclear: ¿Qué tan frecuente es tener múltiples items del mismo artículo en un presupuesto (caso donde match por articuloId es ambiguo)?
   - Recommendation: Agregar `presupuestoItemId` (Opción A arriba). Es una línea de código en `aceptarConRequerimientos` y resuelve el problema para siempre.

2. **Presupuestos históricos sin `fechaAceptacion`**
   - What we know: `Presupuesto` no tiene el campo; se necesita para computar ETA.
   - What's unclear: ¿Cuántos presupuestos aceptados históricos hay? (Probablemente < 50 en producción).
   - Recommendation: Agregar `fechaAceptacion?: string | null`. Históricos → badge "Sin ETA". NO hace falta script de migración (el campo es opcional y el resolver lo maneja).

3. **Sidebar placement para `/entregas`**
   - What we know: La estructura actual tiene Stock > Compras > {Requerimientos, Planificación, OC, Importaciones}. La ruta `/entregas` encajaría temáticamente allí.
   - What's unclear: ¿Quiere el usuario ver Entregas bajo Stock (flujo de compras) o como item root (flujo comercial)?
   - Recommendation: Agregar bajo Stock > Compras como `{ name: 'Entregas', path: '/entregas' }`. Misma audiencia que Importaciones. Si el dueño prefiere root, es un cambio de 1 línea.

4. **OT# como texto libre vs. SearchableSelect**
   - What we know: OTs son una colección grande. La coordinadora conoce el número de OT que asignó.
   - What's unclear: ¿Hay riesgo de typos o errores de referencia que justifiquen la validación?
   - Recommendation: Input de texto libre (string). Agregar `SearchableSelect` de OTs implicaría cargar toda la colección `ordenes_trabajo` en la vista de entregas — sobrecarga injustificada para este scope. El campo `otNumeroVinculada` es referencia informativa, no FK enforced.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | TypeScript + Node `--experimental-strip-types` (patrón Phase 14-15) |
| Config file | `apps/sistema-modular/package.json` → scripts `"test:entregas"` (Wave 0 gap) |
| Quick run command | `pnpm --filter @ags/sistema-modular test:entregas` |
| Full suite command | `pnpm --filter @ags/sistema-modular test:entregas && pnpm --filter @ags/sistema-modular test:patron-bom && pnpm --filter @ags/sistema-modular test:venta-loaner` |

### Phase Requirements → Test Map

| ID | Behavior | Test Type | Automated Command | File Exists? |
|----|----------|-----------|-------------------|-------------|
| ENT-01 | `computeSemaforo()` devuelve verde/amarillo/rojo/sin_eta según diasRestantes | unit | `pnpm --filter @ags/sistema-modular test:entregas` | ❌ Wave 0 |
| ENT-02 | `computeEtaFecha()` calcula fecha correcta para `fechaAceptacion + etaDiasEstimados` | unit | `pnpm --filter @ags/sistema-modular test:entregas` | ❌ Wave 0 |
| ENT-03 | `buildEntregaRows()` resuelve cadena correctamente con `presupuestoItemId` | unit (mock data) | `pnpm --filter @ags/sistema-modular test:entregas` | ❌ Wave 0 |
| ENT-04 | Items sin `etaDiasEstimados` → semaforo `'sin_eta'` (no crash) | unit | `pnpm --filter @ags/sistema-modular test:entregas` | ❌ Wave 0 |
| ENT-05 | Items con `importacionEstado='recibido'` → semaforo `'entregado'` | unit | `pnpm --filter @ags/sistema-modular test:entregas` | ❌ Wave 0 |
| ENT-06 | `disponibilidad` default correcto: ATP>0 → `'stock'`, ATP=0 → `'a_importar'` | unit | `pnpm --filter @ags/sistema-modular test:entregas` | ❌ Wave 0 |
| UI-01 | Edición inline de OT# guarda en `presupuestoItem.otNumeroVinculada` | manual-only | N/A — Playwright UAT | N/A |
| UI-02 | Filtros persisten en URL al navegar hacia atrás | manual-only | N/A — Playwright UAT | N/A |

### Sampling Rate
- **Per task commit:** `pnpm --filter @ags/sistema-modular test:entregas`
- **Per wave merge:** Full suite (todas las suites de unit tests del proyecto)
- **Phase gate:** Full suite green antes de `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/sistema-modular/scripts/test-entregas.ts` — cubre ENT-01..ENT-06
- [ ] `apps/sistema-modular/src/utils/entregasResolver.ts` — pure functions (`computeSemaforo`, `computeEtaFecha`, `buildEntregaRows`) testeables sin Firestore
- [ ] `package.json` script: `"test:entregas": "node --experimental-strip-types scripts/test-entregas.ts"`

*(Patrón idéntico a `scripts/test-patron-bom.ts` y `scripts/test-venta-loaner.ts` ya en el proyecto)*

---

## Sources

### Primary (HIGH confidence)
- `packages/shared/src/types/index.ts` — `PresupuestoItem`, `Presupuesto`, `RequerimientoCompra`, `ItemOC`, `ItemImportacion`, `Importacion` — verificados en código fuente.
- `apps/sistema-modular/src/services/presupuestosService.ts` — `aceptarConRequerimientos` payload verificado (líneas 963-1015): NO escribe `presupuestoItemId`.
- `apps/sistema-modular/src/services/importacionesService.ts` — `requerimientosService.getAll({ presupuestoId })` confirmado funcional.
- `apps/sistema-modular/src/pages/stock/ImportacionesList.tsx` — referencia perfecta de list-page con `useUrlFilters` + `useResizableColumns` + `PageHeader` + `SortableHeader`.
- `apps/sistema-modular/src/components/layout/navigation.ts` — estructura del sidebar confirmada; propuesta de placement en Stock > Compras.
- `apps/sistema-modular/src/components/presupuestos/AddItemModal.tsx` — estructura del modal de items; nuevo fields deben agregarse aquí.
- `.planning/phases/16-entregas-visor-de-cumplimiento/16-CONTEXT.md` — decisiones del product owner.

### Secondary (MEDIUM confidence)
- `CLAUDE.md` + `.claude/rules/` — reglas de proyecto (firestore, components, release-flow) — todos respetan el invariante de esta phase.
- `.claude/skills/list-page-conventions/SKILL.md` — patrón de list-page confirmado contra `ImportacionesList.tsx` (concordan).

### Tertiary (LOW confidence)
- Ninguna.

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — todo reutiliza infraestructura existente del proyecto, verificada en código.
- Architecture (resolver): HIGH — pattern de Promise.all + Map indices es el patrón establecido en Phases 9 y 14.
- Data model gaps: HIGH — ausencia de `presupuestoItemId` y `fechaAceptacion` verificada directamente en el código fuente.
- Pitfalls: MEDIUM-HIGH — basados en patterns recurrentes del proyecto (ETA timezone, N+1 queries) más análisis del código.

**Research date:** 2026-05-29
**Valid until:** 2026-07-01 (stack estable; si hay cambios en `@ags/shared` antes, re-verificar)
