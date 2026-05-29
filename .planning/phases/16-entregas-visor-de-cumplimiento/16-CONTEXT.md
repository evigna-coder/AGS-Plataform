# Phase 16: Entregas — Visor de cumplimiento - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning
**Source:** Direct conversation with product owner (no /gsd:discuss-phase run)

<domain>
## Phase Boundary

Esta phase entrega **visibilidad operativa de qué se debe entregar y cuándo**. Es parte del cutover v2.0 (milestone "Circuito Comercial Completo") para reemplazar el sistema viejo. Cada parte presupuestada — sea de stock, reservada, post-facturación, a importar o en tránsito — debe aparecer en una planilla de seguimiento que diga: a qué cliente va, contra qué presupuesto, qué OT abrió la coordinadora, si hay una OC/importación atrás, y cuántos días faltan vs. la ETA prometida.

**Está dentro del scope:**
- Campo `disponibilidad` + `etaDiasEstimados` por item de `PresupuestoItem`
- Edición desde el editor de presupuestos, con atajo "aplicar a todos"
- Vista `/entregas` que resuelve la cadena `PresupuestoItem → Requerimiento → ItemOC → ItemImportacion`
- Semáforo de cumplimiento (días restantes vs. hoy)
- Filtros por cliente, estado de importación, días restantes
- La fila nace al aceptarse el presupuesto

**Está fuera del scope (deferido):**
- Auto-cosecha items→OT (decisión cutover 2026-05-24 ratifica que es manual; Fase 6 original quedó diferida)
- Notificaciones push/mail por incumplimiento de ETA
- Re-planificación automática de ETAs (la coordinadora ajusta a mano)
- Reportes/dashboards de KPIs de cumplimiento (un sprint posterior)

</domain>

<decisions>
## Implementation Decisions

### Modelo de datos

- **Nuevo campo en `PresupuestoItem`:** `disponibilidad: 'stock' | 'post_facturacion' | 'a_importar' | 'en_transito'` (opcional para retro-compat con presupuestos viejos).
- **Nuevo campo en `PresupuestoItem`:** `etaDiasEstimados: number | null` — días desde la aceptación del presupuesto. La fecha objetivo se computa al aceptar: `fechaAceptacion + etaDiasEstimados`.
- **Default por disponibilidad** al agregar un item: si el item tiene stock disponible (ATP > 0) → `'stock'`; si no → `'a_importar'`. El operador siempre puede cambiarlo.
- **No crear colección nueva `entregas`** — la planilla se resuelve on-the-fly desde presupuestos aceptados + cadena req→OC→IMP. Esto evita desincronización y un sub-sistema de propagación de cambios.

### Vista `/entregas`

- **Columnas obligatorias:** Cliente, Item (descripción), Cantidad, Valor unitario (en moneda del ppto), Presupuesto#, OT# asociada (manual), OC#, Importación# + estado, ETA original (fecha), Días restantes (con semáforo).
- **Semáforo de cumplimiento:**
  - 🟢 Verde: > 5 días restantes
  - 🟡 Amarillo: 0–5 días restantes
  - 🔴 Rojo: vencido (días restantes < 0)
  - ⚪ N/A: item ya entregado (Importación.estado='recibido' o item asociado a OT con cierre administrativo)
- **Filtros (persistidos vía `useUrlFilters`, NO useState):** cliente, estado importación, semáforo (verde/amarillo/rojo/entregado), texto de búsqueda libre (matchea item, presupuesto#, OT#, OC#).
- **Source rows:** items de presupuestos en estado `aceptado` o downstream (no borrador / no rechazado).
- **OT# es una columna editable desde la fila** (input inline o modal) → escribe en un campo del item del presupuesto (`otNumeroVinculada: string | null` o equivalente). NO genera/modifica OT alguna.

### Convenciones de UI (Editorial Teal — del skill `list-page-conventions`)

- Patrón estándar de list-page: PageHeader + filtros + tabla resizable + Sort por columnas + URL filters.
- Sidebar: la entrada nueva va bajo el grupo Stock/Comex o como root nuevo "Entregas". A decidir en el plan según UX.
- Labels uppercase monospace, ETA con tipografía mono para alineación de fechas.

### Editor de presupuestos

- Por cada fila de item: select `disponibilidad` + input numérico `etaDiasEstimados` (placeholder con el default según disponibilidad — ej. stock=0, a_importar=30, en_transito=15).
- Atajo "aplicar a todos los items" arriba de la tabla (bulk set de los dos campos en todas las filas con confirm).
- Campos visibles tanto en el modal de creación como en el de edición (decisión `feedback_modal_first_create_parity`).

### Auditoría

- Cambios en `disponibilidad` y `etaDiasEstimados` quedan registrados por `auditUpdate` ya existente al guardar el presupuesto (no se requiere evento de negocio nuevo).
- No se agrega evento `entrega.semaforo_rojo` ni similares (deferido).

### Reusos del codebase

- **Cadena de IDs ya existe en types**: `PresupuestoItem` no la tiene, pero al aceptar el ppto se crea `RequerimientoCompra.presupuestoId` + `presupuestoItemId` (verificar). `RequerimientoCompra → ItemOC.requerimientoId → ItemImportacion.requerimientoId`. La resolución corre por ese hilo.
- **Servicios**: `presupuestosService`, `requerimientosService` (en `importacionesService.ts`), `ordenesCompraService`, `importacionesService`.
- **Caché**: si la vista es pesada para resolver, usar `serviceCache.ts` (TTL 2 min). Definir en research si conviene.
- **Atoms UI**: `Card`, `PageHeader`, `SortableHeader`, `SearchableSelect`, `useUrlFilters`, `useResizableColumns`.

</decisions>

<specifics>
## Specific Ideas

### Patrón ya establecido

La cadena de datos está modelada en `packages/shared/src/types/index.ts`:

```
PresupuestoItem  (sin disponibilidad/eta — agregar)
   ↓ presupuestosService.aceptarConRequerimientos (Phase 8 FLOW-03)
RequerimientoCompra { presupuestoId, condicional, articuloId, cantidad }
   ↓ generación de OC desde RequerimientosList
OrdenCompra → ItemOC { requerimientoId }
   ↓ ImportacionEditor desde OCDetail
Importacion → ItemImportacion { itemOCId, requerimientoId, cantidadRecibida }
```

### Datos clave para la fila

- `cliente`: `presupuesto.clienteNombre` (denormalizado en el ppto)
- `item descripción`: `presupuestoItem.descripcion`
- `cantidad`: `presupuestoItem.cantidad`
- `valor unitario`: `presupuestoItem.precioUnitario` + `presupuestoItem.moneda`
- `presupuesto#`: `presupuesto.numero`
- `OT#`: campo nuevo manual en `presupuestoItem.otNumeroVinculada` (o equivalente)
- `OC#`: vía `requerimientoCompra.ordenCompraNumero` (ya está denormalizado)
- `Importación# + estado`: query `Importacion` cuyo `ItemImportacion.requerimientoId === requerimiento.id`
- `ETA original`: `presupuesto.fechaAceptacion + presupuestoItem.etaDiasEstimados` (computado)
- `Días restantes`: `eta - now`, semáforo según rangos

### Datos legacy

Presupuestos viejos sin `disponibilidad` / `etaDiasEstimados`: aparecen en la planilla con badge "Sin ETA" en gris. No bloquea. Migración no es bloqueante (decisión cutover).

### Performance

Lista podría tener 100–500 rows iniciales (varios meses de presupuestos aceptados). No es problema de perf hoy, pero documentar que el resolver de la cadena se hace en cliente (no Cloud Function) y leer Requerimiento + OC + IMP por presupuestoId en paralelo con `Promise.all`.

### Para evitar (anti-patterns del proyecto)

- ❌ Crear colección `entregas/` separada (desincronización)
- ❌ Usar `useState` para filtros (regla `feedback_filter_persistence`)
- ❌ Hacer file > 250 líneas (regla `components.md`)
- ❌ Mocked queries en tests (regla testing — usar Firestore real)
- ❌ `undefined` en writes a Firestore (regla `firestore.md`)

</specifics>

<deferred>
## Deferred Ideas

- **Notificaciones de incumplimiento de ETA** (push al ingeniero / mail al comercial) — deferido. Por ahora visibilidad operativa = abrir la vista y mirarla.
- **Re-cálculo automático de ETA** cuando cambia el estado de la importación (ej. embarque retrasado) — deferido. La coordinadora ajusta `etaDiasEstimados` a mano si el caso lo amerita.
- **Dashboard de KPIs** (% de entregas cumplidas por mes, ETAs promedio, etc.) — deferido a milestone post-cutover.
- **Auto-cosecha items→OT** — explícitamente diferido por decisión 2026-05-24. NO TOCAR en esta phase.
- **Export a Excel del visor** — útil pero no bloqueador; se puede sumar en un plan de gap closure si surge.
- **Vista por cliente** (mismo visor, agrupado/filtrado por cliente para mandar como reporte) — deferido salvo que aparezca pedido específico.
- **Vinculación 1:N item↔OT** (un mismo item de ppto repartido entre varias OTs) — deferido. Por ahora 1:1 entre item y OT vinculada.

</deferred>

---

*Phase: 16-entregas-visor-de-cumplimiento*
*Context gathered: 2026-05-29 via direct conversation*
