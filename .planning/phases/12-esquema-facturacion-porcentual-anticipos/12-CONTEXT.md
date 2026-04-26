# Phase 12: Esquema Facturación Porcentual + Anticipos — Context

**Gathered:** 2026-04-26
**Status:** Ready for planning
**Source:** PRD Express Path (`.claude/plans/facturacion-anticipos-y-porcentajes.md`, sesión 2026-04-25)

<domain>
## Phase Boundary

Permitir que un presupuesto se facture en N cuotas porcentuales con hitos disparadores configurables (`ppto_aceptado`, `oc_recibida`, `pre_embarque`, `todas_ots_cerradas`, `manual`), incluyendo cuotas que se emiten **antes** de que exista una OT cerrada (anticipos / pre-embarque). Cada cuota dispara una `solicitudFacturacion` independiente vinculada al ppto. Soporte completo para MIXTA con porcentajes per-moneda (ARS/USD/EUR independientes). Aplica a todo presupuesto excepto `tipo='contrato'`.

**In scope**
- Modelo de datos `PresupuestoCuotaFacturacion` con `porcentajePorMoneda` y estado.
- UI editor de esquema en `EditPresupuestoModal`, validación inline Σ%=100 por moneda.
- Refactor `PresupuestoFacturacionSection` con dos sub-secciones (cuotas + OTs sueltas legacy).
- Mini-modal "Generar solicitud para cuota X" con N inputs de monto (uno por moneda activa).
- Toggle `preEmbarque` en header del ppto.
- `recomputeCuotaEstados` puro + integración en 4 puntos de sync.
- `trySyncFinalizacion` extendido para considerar el esquema.
- Tests Playwright para 30/70, 70/30 pre-embarque, 100% al cierre.

**Out of scope**
- Cobranza efectiva (módulo `facturacion` separado).
- Integración fiscal/AFIP — la solicitud sigue siendo aviso interno al contable.
- Cuotas en contratos anuales (`tipo='contrato'`) — modelo `PresupuestoCuota` propio, no se toca.
- Migración/backfill de pptos legacy — modo Tier-1 sigue funcionando con `esquemaFacturacion = null|[]`.
- Filtros/dashboards/badges en lista de presupuestos (Fase 7 del plan-of-record, opcional/diferible).

</domain>

<decisions>
## Implementation Decisions

### Conceptual model (locked)
- **"Adelantada" y "porcentual" son la misma feature.** No se modela `esAnticipo` separado. Anticipo = cuota con hito anterior a OT cerrada.
- **El esquema vive en el presupuesto.** Se define al armarlo, queda fijo (read-only) al pasar a `aceptado`.
- **Cuota ↔ Solicitud es 1:1.** `SolicitudFacturacion.cuotaId` apunta a la cuota; cuota tiene `solicitudFacturacionId`.
- **El hito no auto-genera** la solicitud — solo la "habilita". El admin sigue tirando manualmente "Generar solicitud".
- **Modo legacy intocado.** `esquemaFacturacion = null` o `[]` → flujo Tier-1 actual (1 solicitud al final, sin breaking changes).
- **Sin gate al aceptar**: pptos sin esquema caen al modo Tier-1 legacy. Esquema es opcional (incluso para `ventas`).
- **Aplica a TODO `tipo`** excepto `contrato`. `per_incident`, `ventas`, etc. todos pueden tener anticipos.

### Hitos posibles (cerrados)
Valores enum `CuotaFacturacionHito`:
- `ppto_aceptado` → ppto.estado in ('aceptado', 'en_ejecucion').
- `oc_recibida` → `ppto.ordenesCompraIds?.length > 0`.
- `pre_embarque` → `ppto.preEmbarque === true` (toggle manual del admin).
- `todas_ots_cerradas` → todas las work-unit OTs en `CIERRE_ADMINISTRATIVO` o `FINALIZADO`. **Reemplaza** al "OT cierre admin" individual del Tier-1.
- `manual` → siempre habilitada (sin precondición).

### Estados de cuota (cerrados)
Valores enum `CuotaFacturacionEstado`: `pendiente | habilitada | solicitada | facturada | cobrada`.

Reglas (función pura `recomputeCuotaEstados(ppto, ots, solicitudes)`):
- Si `cuota.solicitudFacturacionId != null` → mirror del estado de la solicitud (pendiente/enviada→solicitada, facturada→facturada, cobrada→cobrada, anulada→habilitada limpiando `solicitudFacturacionId`).
- Si no → evaluar hito y mapear a `pendiente | habilitada`.

### MIXTA con % por moneda separado (cerrado)
- `porcentajePorMoneda: Partial<Record<'ARS'|'USD'|'EUR', number>>`.
- Cada cuota declara % independiente por moneda. Una cuota puede tener `{ARS: 30}` (no factura USD), `{USD: 70}` (no factura ARS), o `{ARS: 30, USD: 50}` (mixta).
- **Validación por moneda separada**: por cada moneda activa del ppto, la suma de %s a lo largo de las cuotas debe ser exactamente 100. ARS y USD se evalúan por separado.
- Mono-moneda: la UI colapsa a un solo input `%` (la moneda activa del ppto); la lógica es la misma con un solo bucket.
- **Tipos**: `MonedaCuota = 'ARS' | 'USD' | 'EUR'`. MIXTA NO se almacena por cuota — las cuotas siempre usan monedas individuales aunque `ppto.moneda === 'MIXTA'`.

### Modelo de datos (locked)

`packages/shared/src/types/index.ts`:

```typescript
export type CuotaFacturacionHito =
  | 'ppto_aceptado' | 'oc_recibida' | 'pre_embarque' | 'todas_ots_cerradas' | 'manual';

export type CuotaFacturacionEstado =
  | 'pendiente' | 'habilitada' | 'solicitada' | 'facturada' | 'cobrada';

export type MonedaCuota = 'ARS' | 'USD' | 'EUR';

export interface PresupuestoCuotaFacturacion {
  id: string;                              // uuid stable
  numero: number;                          // 1, 2, 3...
  porcentajePorMoneda: Partial<Record<MonedaCuota, number>>;
  descripcion: string;
  hito: CuotaFacturacionHito;
  estado: CuotaFacturacionEstado;
  solicitudFacturacionId?: string | null;
  montoFacturadoPorMoneda?: Partial<Record<MonedaCuota, number>> | null;
}
```

`Presupuesto`:
- `esquemaFacturacion?: PresupuestoCuotaFacturacion[] | null` (null/[] = modo legacy Tier-1).
- `preEmbarque?: boolean` (toggle manual).

`SolicitudFacturacion`:
- `cuotaId?: string | null` (null = solicitud libre Tier-1 legacy).
- `porcentajeCoberturaPorMoneda?: Partial<Record<'ARS'|'USD'|'EUR', number>> | null` (calculado al crear como `(montoSolicitud[moneda] / totalPpto[moneda]) * 100`).

### UI: editor del esquema (locked)
- Componente nuevo `EsquemaFacturacionSection.tsx` (≤250 líneas — split si crece).
- Visible solo si `tipo !== 'contrato'`.
- Posición: dentro de `EditPresupuestoModal`, sección plegable nueva entre "Items" y "Cuotas".
- Filas: descripción + hito (dropdown) + columna `%` por cada moneda activa (1 col mono-moneda, 2-3 cols MIXTA).
- Botón "+ Agregar cuota", borrar fila vía X.
- Validación inline: badge `Σ% (ARS): 100` verde si === 100, rojo si !== 100, evaluado por moneda.
- Read-only si `ppto.estado !== 'borrador'`.
- **Quick-templates (botones)**:
  - "100% al cierre" → 1 cuota 100% en cada moneda activa, hito `todas_ots_cerradas`.
  - "30/70 anticipo+entrega" → 30% `ppto_aceptado` + 70% `todas_ots_cerradas` (mismo % en cada moneda).
  - "70/30 pre-embarque" → 70% `pre_embarque` + 30% `todas_ots_cerradas` (mismo % en cada moneda).
  - Combinaciones asimétricas MIXTA → edición manual (no template).

### UI: refactor sección facturación (locked)
- `PresupuestoFacturacionSection.tsx` se reemplaza por dos sub-secciones:
  - **A. "Cuotas del esquema"** (visible si `esquemaFacturacion?.length > 0`): card por cuota con `% — descripción — hito — estado — monto calculado`. Botón contextual según estado:
    - `pendiente` → badge "Esperando hito" + botón gris disabled.
    - `habilitada` → botón teal "Generar solicitud".
    - `solicitada | facturada | cobrada` → link a la solicitud + estado coloreado.
  - **B. "OTs sin asociar a cuota"** (visible si `otsListasParaFacturar.length > 0` Y todas las cuotas ya facturadas, O si `esquemaFacturacion` es null/[]): tabla de OTs con monto + observaciones + "Generar aviso" (Tier-1 actual con `cuotaId: null`).
- Mini-modal "Generar solicitud para cuota X":
  - N inputs de monto (uno por cada moneda con `porcentajePorMoneda[m] > 0`).
  - Default por input: `(porcentajePorMoneda[m] / 100) * totalPpto[m]`.
  - Cada input editable (override permitido, warning amarillo si !== %*total — no bloquea).
  - Observaciones libres.
  - Selector opcional de OTs en `otsListasParaFacturar` (referencia para concepto).
  - Confirmar → llama `generarAvisoFacturacion(presId, otNumbers, { montoPorMoneda, observaciones, cuotaId })`.

### Toggle preEmbarque (locked)
- Checkbox en header de `EditPresupuestoModal`: "Mercadería en pre-embarque".
- Visible solo si esquema tiene cuota con hito `pre_embarque`.
- Al togglear → `ppto.preEmbarque = true`, recompute, cuota correspondiente pasa a `habilitada`.
- Audit trace en `PostaPresupuesto`.

### Lógica pura recomputeCuotaEstados (locked)
- Helper en `apps/sistema-modular/src/utils/cuotasFacturacion.ts`.
- Tests unitarios obligatorios — casos: vacío, 1 cuota 100%, 2 cuotas con distintos hitos, anulada y regeneración, override de monto, MIXTA combinaciones (cuota solo-USD, cuota mixta, cuota solo-ARS).
- Llamar en 4 puntos de sync:
  1. `presupuestosService.update()` post-write (auto-recompute).
  2. `presupuestosService.generarAvisoFacturacion()` post-tx.
  3. `otService.cerrarAdministrativamente()` post-tx (sync presupuestos vinculados).
  4. `facturacionService.marcarFacturada()` / `marcarCobrada()` post-write.
- Siempre dentro del mismo `update` del ppto, no en triggers separados (evita race conditions).

### trySyncFinalizacion (locked)
- Modo legacy (sin esquema) → reglas actuales sin cambio.
- Modo nuevo (con esquema) → ppto pasa a `finalizado` solo si:
  - **Todas las cuotas en `cobrada`** + (todas las work-unit OTs en `FINALIZADO`).
  - Si setting `presupuesto.finalizarConSoloFacturado: boolean` (default `true`), permitir `facturada` como terminal.

### Validaciones (locked)
| Validación | Cuándo | Acción |
|---|---|---|
| Σ% === 100 por moneda | Al guardar ppto en `borrador` | Bloquea save: "Cuotas en {ARS} suman X%, deben sumar 100%" |
| Esquema lockeado | Al pasar a `aceptado` | Inputs read-only en UI |
| No editar cuota facturada | Al borrar cuota con `estado in ('solicitada','facturada','cobrada')` | Bloquea con mensaje |
| No solicitar cuota deshabilitada | Click "Generar solicitud" si `estado !== 'habilitada'` | Botón disabled UI + check server-side en `generarAvisoFacturacion` |
| Monto override coherente | Generar solicitud con monto !== %*total | Warning amarillo, no bloquea (admin ajusta por redondeo/IVA) |

### Service API extension (locked)
`presupuestosService.generarAvisoFacturacion(presId, otNumbers, opts)`:
- Nuevo parámetro `opts.cuotaId?: string`.
- Nuevo parámetro `opts.montoPorMoneda?: Partial<Record<MonedaCuota, number>>` (reemplaza/extiende `opts.monto` para soportar MIXTA).
- Si `cuotaId` presente → validar que la cuota está `habilitada`, persistir `solicitud.cuotaId` + actualizar `cuota.solicitudFacturacionId` + `cuota.montoFacturadoPorMoneda` en la misma tx.
- Si `cuotaId` ausente y ppto sin esquema → comportamiento Tier-1 actual.
- Línea 1310-1312 actual (bloqueo "OTs deben estar en `otsListasParaFacturar`") **se relaja** para cuotas con hito anterior a OT cerrada — la validación queda solo para sub-sección B (legacy).

### Persistencia / Firestore (locked)
- Escritura via `cleanFirestoreData` / `deepCleanForFirestore` (helpers existentes en [apps/sistema-modular/src/services/firebase.ts](apps/sistema-modular/src/services/firebase.ts)). Nunca `undefined` en writes — ver [.claude/rules/firestore.md](.claude/rules/firestore.md).
- Esquema vacío persiste como `[]` (no `undefined`).
- Lectura defensiva en service: `?? []`.

### Claude's Discretion
- Wiring específico del Vite/React component tree (cómo se importa `EsquemaFacturacionSection` desde `EditPresupuestoModal` — sigue patrón existente del proyecto).
- Naming exacto de botones internos no listados (mientras respete la familia de copy: "Generar solicitud", "Esperando hito", etc.).
- Ubicación exacta del setting `presupuesto.finalizarConSoloFacturado` (config global vs feature flag vs columna por ppto) — elegir lo más simple, default `true`.
- Implementación interna del helper `recomputeCuotaEstados` (functional vs reduce vs etc.) mientras sea pura y tenga tests.
- Patrón de mini-modal: reusar `Modal` atom existente o crear uno colocado.
- UUID generation para `cuota.id` (crypto.randomUUID en cliente vs nano-id) — preferir `crypto.randomUUID` si está disponible.

</decisions>

<specifics>
## Specific Ideas

### Casos de prueba E2E (cerrados)
1. **30/70 anticipo + cierre**:
   - Armar ppto con esquema 30/70.
   - Aceptar → cuota 1 habilitada.
   - Generar solicitud cuota 1 → marcar facturada → cuota 1 = facturada.
   - Crear OT, ejecutar, cierre admin.
   - Verificar cuota 2 pasó a habilitada (`todas_ots_cerradas`).
   - Generar solicitud cuota 2 → facturar → cobrar.
   - `trySyncFinalizacion` debe pasar el ppto a `finalizado`.
2. **70/30 pre-embarque + cierre**: similar, con toggle `preEmbarque` entre paso 2 y 3.
3. **100% al cierre**: 1 cuota con hito `todas_ots_cerradas` — equivalencia funcional al modo Tier-1 actual.

### Tests Playwright
- Extender `e2e/circuits/11-full-business-cycle.spec.ts` con sub-suites:
  - `11.51 — Esquema 30/70 (anticipo + cierre)`
  - `11.52 — Esquema 70/30 (pre-embarque + cierre)`
- Reusar helpers existentes (`getSolicitudesFacturacion`, etc.).
- Agregar `getPresupuestoEsquema` en `helpers/firestore-assert.ts`.
- Asserts: sin warnings consola, sin huérfanos en `solicitudesFacturacion`, ppto finaliza correctamente.

### Component size budget
- `EsquemaFacturacionSection.tsx` ≤250 líneas — extraer hook (`useEsquemaFacturacion`) o subcomponentes (`EsquemaCuotaRow`, `QuickTemplateButtons`) si excede.
- Aplica también a la refactorización de `PresupuestoFacturacionSection.tsx` — si crece >250, split en `CuotasDelEsquemaSection` + `OtsSinAsociarSection`.
- Ver [.claude/rules/components.md](.claude/rules/components.md).

### Riesgos a mitigar (testear explícitamente)
- **Override de monto vs %**: usar `montoFacturadoPorMoneda` real para sumas; `porcentaje` solo para display.
- **Cuota anulada → regeneración**: anular solicitud debe llevar la cuota a `habilitada` con `solicitudFacturacionId = null`. Test específico.
- **Race condition hitos automáticos**: `recomputeCuotaEstados` siempre dentro del mismo `update` del ppto, no en triggers separados.
- **MIXTA edge cases**: cuota solo-USD, cuota solo-ARS, cuota mixta, override divergente por moneda.

### Files of interest (current state)
- [apps/sistema-modular/src/components/presupuestos/PresupuestoFacturacionSection.tsx](apps/sistema-modular/src/components/presupuestos/PresupuestoFacturacionSection.tsx) — sección actual a refactorizar.
- [apps/sistema-modular/src/services/presupuestosService.ts](apps/sistema-modular/src/services/presupuestosService.ts) — `generarAvisoFacturacion` (~línea 1310 bloqueo a relajar) y `trySyncFinalizacion`.
- [apps/sistema-modular/src/services/otService.ts](apps/sistema-modular/src/services/otService.ts) — `cerrarAdministrativamente` punto de sync.
- [apps/sistema-modular/src/services/facturacionService.ts](apps/sistema-modular/src/services/facturacionService.ts) — `marcarFacturada` / `marcarCobrada` puntos de sync.
- [packages/shared/src/types/index.ts](packages/shared/src/types/index.ts) — agregar tipos nuevos.
- [apps/sistema-modular/src/components/presupuestos/EditPresupuestoModal.tsx](apps/sistema-modular/src/components/presupuestos/EditPresupuestoModal.tsx) — wire `EsquemaFacturacionSection` + toggle `preEmbarque`.
- [apps/sistema-modular/e2e/circuits/11-full-business-cycle.spec.ts](apps/sistema-modular/e2e/circuits/11-full-business-cycle.spec.ts) — extender con sub-suites.

</specifics>

<deferred>
## Deferred Ideas

- **Fase 7 (UX polish, opcional)** del plan-of-record:
  - Badge "Facturado X% / Pendiente Y%" en lista de presupuestos.
  - Filtro nuevo en `PresupuestosList`: "con cuotas pendientes".
  - Sección en `ClienteDetail`: deuda total estimada por ppto pendiente.
- **F3 (open question)**: campo opcional `montoOverridePorPorcentaje` en `SolicitudFacturacion` para auditoría del override — probable yes, decidir al llegar a fase de override.
- **F7 (open question)**: dashboards/reportes admin contable — priorizar después de E2E.
- Cuotas en contratos anuales (`tipo='contrato'`) — modelo `PresupuestoCuota` propio, fuera de alcance.
- Migración/backfill de pptos legacy — no se hace, modo Tier-1 sigue funcionando.
- Integración fiscal/AFIP — fuera de alcance.
- Cobranza efectiva — módulo `facturacion` separado.

</deferred>

---

*Phase: 12-esquema-facturacion-porcentual-anticipos*
*Context gathered: 2026-04-26 via PRD Express Path (`.claude/plans/facturacion-anticipos-y-porcentajes.md`)*
