# Plan: Analítica de Presupuestos

> Pedido de Esteban (2026-07-17, durante UAT): "algo en presupuestos para medir, personalizable, con info y gráficos".
> Semilla existente: las 4 tarjetas KPI clickeables de `PresupuestoDashboard.tsx` + filtro `kpi` en `PresupuestosList.tsx`.
> Contexto capturado: `memory/project_presupuestos_analytics.md`.

---

## 0. Hallazgos de investigación (código real, verificado 2026-07-17)

### Timestamps que EXISTEN en `Presupuesto` (packages/shared/src/types/index.ts:1414)

| Campo | Cuándo se escribe | Confiabilidad |
|---|---|---|
| `createdAt` | siempre | total |
| `fechaEnvio?` | al enviar por mail (`marcarEnviado`) o quick-change a `enviado` (setea si falta) | alta, pero **opcional** — hay históricos sin fecha |
| `fechaAceptacion?` | Phase 16, dentro del `runTransaction` de `aceptarConRequerimientos` (el `update()` con `estado:'aceptado'` delega ahí) | alta para pptos post-Phase16; **null en legacy** |
| `updatedAt` | cada update — **se pisa, no sirve para medir** | nula como timestamp de evento |

### Timestamps que FALTAN
- **No existe fecha de rechazo/anulación.** Anular solo deja `estado:'anulado'` + `motivoAnulacion` + `anuladoPorId`. Sin campo nuevo no se puede medir "rechazados por período" (solo el stock actual de anulados). → pregunta abierta #4.
- **No hace falta esquema nuevo para el resto**: cierre de OT sí es medible (ver abajo).

### "Pendiente de OC del cliente" — definición canónica HOY
`PresupuestosList.tsx` líneas 204-208 (filtro `ocPendiente`):
```
p.estado === 'aceptado' && (p.ordenesCompraIds || []).length === 0
```
El export (`utils/exports/exportOCsPendientes.ts`) reusa las filas filtradas; su `diasDesdeCarga` hoy cuenta desde `createdAt` (proxy pobre — la analítica lo mejora contando desde el cierre de OT). **Reusar esta definición como base**, ampliada por estado para la métrica 4 (ver §1.4).

### "Servicio realizado" — el join exacto
- `Presupuesto.otsListasParaFacturar` **NO alcanza**: se llena en `cerrarAdministrativamente()` pero se **vacía** al generar el aviso (`generarAvisoFacturacion`, presupuestosService.ts:1924 — `filter(ot => !otNumbers.includes(ot))`). Solo indica "cerrada Y sin aviso", no "servicio realizado".
- Fuente confiable: colección **`reportes`** (doc id = otNumber). `WorkOrder.budgets: string[]` guarda los `numero` (PRE-XXXX) de los pptos vinculados. `estadoAdmin ∈ {CIERRE_TECNICO, CIERRE_ADMINISTRATIVO, FINALIZADO}` = servicio realizado.
- Fecha del cierre: `estadoHistorial[]` (entrada con `estado:'CIERRE_TECNICO'`, campo `fecha` ISO) → fallback `cierreAdmin.fechaCierreAdmin` → `estadoAdminFecha` → `fechaCierre`.
- **Costo en lecturas**: `ordenesTrabajoService.getAll()` lee TODA la colección `reportes` (1 read/doc, estimado bajos miles de docs). Es exactamente lo que ya hace `dashboardService.load()` en cada carga del dashboard ejecutivo — precedente aceptado. Alternativa scoped: `ordenesTrabajoService.queryByBudget(numero)` (array-contains, ya existe, presupuestosService W4) = 1 query por ppto candidato; conviene solo si los candidatos son pocos (<20). **Decisión fase 1: un `getAll()` por carga de página (snapshot + botón Refrescar, como DashboardPage), cache 2 min opcional vía `serviceCache`.** Sin agregación server-side: el volumen actual (cientos de pptos, miles de OTs) se agrega client-side en <100ms.

### Gráficos — patrón existente
`OTFunnelChart.tsx` y `TicketAreaBars.tsx` usan **recharts** (`BarChart`, `ResponsiveContainer`, `Tooltip`, `Cell`) — ya es dependencia. Colores hex planos, teal `#0D6E6E` para lo principal. **No agregar ninguna lib nueva.**

### Página / filtros — patrón existente
- Rutas en `TabContentManager.tsx` (líneas 103-110), `ProtectedRoute allowedRoles={['admin','admin_soporte','administracion']}` para todo lo de presupuestos.
- `useUrlFilters` (re-export de `@ags/shared`) soporta **solo `string` y `boolean`** — rangos de fecha van como strings ISO, presets de tarjetas NO caben ahí (ver §2 personalización → localStorage).
- Drill-down KPI→lista ya implementado: `?kpi=enviados|aceptados|fact_pendientes|pend_cobro|pendiente_aviso` + `?ocPendiente=1` + `?estado=`, `?cliente=`, `?responsable=`, `?fechaDesde/Hasta`.
- `facturacionService.subscribe/getAll` da las `SolicitudFacturacion` (estados `pendiente/enviada/facturada/cobrada/anulada`, con `fechaFactura`, `fechaCobro`, `createdAt`).
- Moneda por moneda: precedente en `PresupuestoDashboard.pipeline` (mapa `Record<moneda, monto>`) y en `computeTotalsByCurrency()` (`utils/cuotasFacturacion.ts:144`, testeada) que desglosa items MIXTA por moneda.

---

## 1. Métricas fase 1 — definiciones exactas

**Regla de montos (invariante):** todo monto se reporta **por moneda, siempre** (`Record<'ARS'|'USD'|'EUR', number>`). Nunca sumar monedas entre sí. Pptos `moneda === 'MIXTA'` se desglosan con `computeTotalsByCurrency(p.items, p.moneda)`; el resto aporta `p.total` a su moneda. Formato de display: el de `PresupuestoDashboard.fmtPipeline` (`US$ X · $ Y`).

**Regla de revisiones:** cada revisión es un doc independiente (`PRE-0001.02`). Un ppto anulado **por revisión** (`anuladoPorId != null`) se excluye de aging y de OC adeudada (lo reemplazó otro doc vivo); sí cuenta como "enviado" en el período en que se envió (fue actividad comercial real).

**Regla de anulados:** `estado === 'anulado'` queda fuera de todo aging y de OC adeudada. Cuenta en "enviados del período" si tiene `fechaEnvio` en rango.

### 1.1 Enviados en el período
- **Definición:** pptos con `fechaEnvio` dentro del rango `[desde, hasta]` seleccionado. Independiente del estado actual (un enviado-luego-aceptado sigue contando como enviado ese mes).
- **Salida:** count + monto por moneda + serie mensual (para el gráfico).
- **Edge — sin `fechaEnvio`:** pptos con estado ∈ pipeline activo pero `fechaEnvio` vacía quedan FUERA del conteo por período; se muestran como badge de higiene "N sin fecha de envío" (clickeable → lista) para que se corrijan a mano.

### 1.2 Aprobados en el período + tiempo de aprobación
- **Definición aprobados:** pptos con `fechaAceptacion` dentro del rango. NO filtrar por estado actual (puede estar ya en `en_ejecucion`/`pendiente_facturacion`/`finalizado`). NO usar `updatedAt` como fallback (se pisa).
- **Tiempo de aprobación:** `fechaAceptacion − fechaEnvio` en días, solo cuando ambas existen y `fechaAceptacion >= fechaEnvio` (descartar negativos: datos sucios). Reportar **mediana y promedio** + distribución en buckets (0-7 / 8-15 / 16-30 / 31-60 / +60 días).
- **Tasa de conversión del período:** aceptados-con-fecha-en-rango ÷ enviados-en-rango (mismo cálculo que `conversion90d` del dashboard ejecutivo pero con rango libre y usando `fechaAceptacion` en vez de `updatedAt`, que es un bug conocido de esa métrica).
- **Edge — legacy sin `fechaAceptacion`:** badge "N aceptados sin fecha" (fuera del cálculo). Si son muchos, script one-off de backfill (pregunta #2).

### 1.3 Aging de no aprobados (enviados abiertos)
- **Definición:** snapshot HOY (no depende del rango): pptos con `estado === 'enviado'`, no anulados, con `fechaEnvio` presente. Días abiertos = `getDaysSinceEnvio(p.fechaEnvio)` (helper existente en `utils/presupuestoHelpers.ts`).
- **Salida:** tabla ordenada por días desc (número, cliente, responsable, monto/moneda, días, vencido s/validez con `getDaysUntilExpiry`) + buckets 0-7 / 8-15 / 16-30 / 31-60 / +60 con count y monto por moneda.
- **Drill-down:** fila → abrir el ppto (floating/`navigateInActiveTab('/presupuestos/:id')`); header del bloque → `/presupuestos?kpi=enviados&sortField=fechaEnvio&sortDir=asc`.

### 1.4 OC adeudada con servicio ya realizado
- **Definición (join):**
  1. Candidatos: pptos con `(p.ordenesCompraIds || []).length === 0`, no anulados, `estado ∈ {aceptado, en_ejecucion, pendiente_facturacion}` — superset del filtro `ocPendiente` de la lista (que solo mira `aceptado`), porque el caso real "servicio hecho antes de la OC" vive justamente en `pendiente_facturacion`. Confirmar con Esteban (pregunta #3).
  2. Servicio realizado: existe al menos una OT en `reportes` con `budgets` conteniendo `p.numero` (o `otNumber ∈ p.otsVinculadasNumbers` como red de rescate para OTs con `budgets` mal cargado) y `estadoAdmin ∈ {CIERRE_TECNICO, CIERRE_ADMINISTRATIVO, FINALIZADO}`.
  3. Días de deuda = hoy − **la fecha de cierre técnico más antigua** entre sus OTs cerradas (de `estadoHistorial`, con la cadena de fallbacks de §0). Desde ese día AGS ya trabajó y el cliente todavía no mandó la OC.
- **Salida:** tabla (número, cliente, OTs cerradas, fecha del primer cierre, días de deuda, monto/moneda, responsable) + KPI count/monto. Buckets iguales a 1.3.
- **Drill-down:** header → `/presupuestos?ocPendiente=1`; fila → abrir ppto.
- **Contratos multi-OT:** el ppto entra apenas UNA OT cierra sin OC cargada. Correcto para el reclamo (ya se le debe la OC de ese servicio); la tabla lista qué OTs están cerradas para dar contexto.

---

## 2. Diseño de UI

### Ruta y acceso
- **Ruta nueva:** `/presupuestos/analitica`, registrada en `TabContentManager.tsx` con los mismos roles que el resto del módulo (`admin`, `admin_soporte`, `administracion` — confirmar, pregunta #5).
- **Acceso:** botón "Analítica" en el `PageHeader` de `PresupuestosList` (al lado de Exportar), via `navigateInActiveTab`.

### Layout (top → bottom)
1. **`PageHeader`** título "Analítica de presupuestos" + botón Refrescar (patrón `DashboardPage`) + menú "Métricas visibles" (personalización).
2. **Barra de filtros** (persistidos con `useUrlFilters`, todos string):
   - Rango de fechas: presets rápidos (Este mes / Mes pasado / Últimos 90d / Este año) + `fechaDesde`/`fechaHasta` custom. El rango afecta métricas 1.1 y 1.2; las tablas de aging (1.3, 1.4) son snapshot y lo ignoran (rotulado explícito en cada bloque).
   - `cliente`, `tipo`, `responsable` (SearchableSelect, mismas opciones que la lista). Afectan TODO (KPIs, gráficos y tablas).
3. **Fila de KPI cards** (reusa `KpiCard` de `pages/dashboard/components/`): Enviados (count + monto/moneda), Aprobados (count + monto/moneda), Conversión %, Tiempo de aprobación (mediana, hint con promedio), OC adeudadas (count + monto, tone `danger` si >0). Cada card clickeable → scroll al bloque o drill-down a la lista.
4. **Gráficos (recharts, mismos props/estilo que OTFunnelChart):**
   - **Enviados vs. aceptados por mes** — BarChart agrupado, últimos N meses del rango. Responde "¿este mes cuántos salieron y cuántos entraron?" de un vistazo.
   - **Distribución del tiempo de aprobación** — BarChart de buckets (0-7/8-15/16-30/31-60/+60).
   - (Etapa 2) **Aging de OC adeudadas** por bucket.
5. **Tabla "Enviados sin aprobar (aging)"** — §1.3.
6. **Tabla "OC del cliente adeudadas con servicio realizado"** — §1.4, visualmente destacada (es EL dolor del pedido).

### "Personalizable" (alcance acotado — NO report builder)
- Menú "Métricas visibles" con checkbox por bloque (5 KPIs, 2 gráficos, 2 tablas).
- Persistencia en **localStorage** (key `presupuestos-analitica-visible`), patrón `useResizableColumns`. No va en URL: es preferencia del usuario, no estado compartible, y `useUrlFilters` no soporta listas.
- Default: todo visible.

---

## 3. Arquitectura

### Dónde vive el cálculo
- **`utils/analitica/presupuestosMetrics.ts`** — funciones PURAS de agregación (sin IO): reciben `{presupuestos, ots, solicitudes, rango, filtros}` y devuelven la estructura de métricas. Testeables con vitest (fixtures chicos: MIXTA, sin fechaEnvio, multi-OT, anulado por revisión).
- **`hooks/useAnaliticaPresupuestos.ts`** — hook de datos: `Promise.all([presupuestosService.getAll(), ordenesTrabajoService.getAll(), facturacionService.getAll()])` una vez al montar + `refetch()` manual (botón Refrescar). `useMemo` aplica las funciones puras al cambiar filtros (los filtros NO re-fetchean — todo en memoria). Sin `subscribe`: analítica no necesita real-time y ahorra listeners.
- **Volumen estimado:** presupuestos (cientos) + reportes (bajos miles) + solicitudes (cientos) ≈ el mismo costo que UNA carga del dashboard ejecutivo actual. Client-side alcanza de sobra en fase 1; si la colección `reportes` escala (>20k docs), la salida es una agregación en Cloud Function con doc snapshot diario — NO diseñarla ahora.

### Componentes nuevos (todos ≤250 líneas — regla components.md)

| Archivo | Rol |
|---|---|
| `pages/presupuestos/AnaliticaPresupuestos.tsx` | página: layout + hook + wiring (export en el barrel `index.tsx`) |
| `components/presupuestos/analitica/AnaliticaFiltros.tsx` | rango con presets + cliente/tipo/responsable |
| `components/presupuestos/analitica/AnaliticaKpiRow.tsx` | fila de KpiCards (reusa `KpiCard`) |
| `components/presupuestos/analitica/EnviadosAceptadosChart.tsx` | BarChart mensual (recharts) |
| `components/presupuestos/analitica/TiempoAprobacionChart.tsx` | BarChart de buckets (recharts) |
| `components/presupuestos/analitica/AgingTable.tsx` | tabla genérica de aging (props: filas, columnas extra, onRowClick) — sirve para 1.3 y 1.4 |

### Qué se reusa (no recrear)
`KpiCard`, `PageHeader`, `Card`, `Button`, `SearchableSelect`, `SortableHeader`, recharts, `useUrlFilters`, `presupuestoHelpers` (`getDaysSinceEnvio`, `getDaysUntilExpiry`, `isAnulado`, `formatMoney`), `computeTotalsByCurrency` (utils/cuotasFacturacion), labels/colores de `@ags/shared`, `exportToExcel`/`exportToPDF` (etapa 2).

### Qué NO se toca
- `PresupuestoDashboard` y el filtro `kpi` de la lista quedan como están (son la vista operativa diaria; la analítica es la vista gerencial). Solo se agrega el botón de navegación.
- Nada de `apps/reportes-ot/`. Nada de escrituras Firestore (módulo 100% read-only) → sin riesgo de la regla firestore-undefined.

---

## 4. Plan por etapas

### Etapa 1 — mínima entregable (~1 a 1.5 días)
Todo lo de §1-§3 salvo personalización y exports:
1. `utils/analitica/presupuestosMetrics.ts` + tests vitest (medio día — acá vive la lógica delicada del join y las fechas).
2. `useAnaliticaPresupuestos.ts`.
3. Página + filtros + KPI row + tabla OC adeudadas + tabla aging enviados + gráfico enviados/aceptados por mes.
4. Ruta en `TabContentManager.tsx` + botón "Analítica" en `PresupuestosList` (+1 import en el barrel).

**Archivos a crear:** los 6 componentes de §3 + utils + hook + test (9 archivos).
**Archivos a tocar:** `TabContentManager.tsx`, `pages/presupuestos/index.tsx`, `PresupuestosList.tsx` (solo el botón).

### Etapa 2 — pulido (~0.5 a 1 día)
1. Menú "Métricas visibles" + localStorage.
2. Gráfico distribución tiempo de aprobación.
3. Export Excel/PDF de las dos tablas de aging (reusar `exportToExcel`/`exportToPDF`; la de OC adeudadas reemplaza en la práctica al export `ocs-pendientes` actual con datos mejores — no borrar el viejo).
4. Si se aprueba pregunta #4: campo `fechaAnulacion` en el write de anulación + métrica "rechazados del período".

### Definición de terminado / release
`pnpm type-check` + tests nuevos verdes + `pnpm build:modular`. Feature visible al usuario → **`release:minor`** (regla release-flow), coordinado con el cierre de la ronda UAT actual para no pisar el debug en vivo de buscadores.

---

## 5. Preguntas abiertas para Esteban

1. **"Aprobados del mes"** = pptos cuya *aceptación* cayó en el mes, aunque se hayan enviado meses antes. ¿Confirmás ese criterio? (la alternativa —cohorte de enviados del mes— cambia todo el cálculo).
2. Los aceptados viejos no tienen `fechaAceptacion` (el campo existe desde Phase 16). ¿Los dejamos como "N sin fecha" fuera de las métricas, o hacemos una pasada manual de backfill con las fechas reales una sola vez?
3. **OC adeudada**: ¿incluimos también pptos ya `en_ejecucion` / `pendiente_facturacion` sin OC (recomendado — ahí vive el caso "servicio hecho, OC no llegó"), o solo `aceptado` como el filtro actual de la lista?
4. Hoy no queda registrada la fecha en que un ppto se anula/rechaza, así que "cuántos se rechazaron este mes" no se puede medir hacia atrás. ¿Agregamos `fechaAnulacion` de acá en adelante? (cambio mínimo, habilita tasa de rechazo por período a futuro).
5. ¿Quién ve la analítica: los mismos roles que la lista (`admin`, `admin_soporte`, `administracion`) o la restringimos a dirección (`admin`)?

---

## Decisiones de Esteban (2026-07-17, durante UAT)

1. **Aprobados por fecha de aceptación: SÍ.** Además: no solo vista mensual — rango de fechas personalizable e histórico completo (ver todos los pendientes acumulados, no solo los del período).
2. (Legacy sin fechaAceptacion — pendiente de re-explicar, no entendió la pregunta.)
3. **OC adeudada incluye también en_ejecucion/pendiente_facturacion sin OC: SÍ.**
4. **Agregar `fechaAnulacion` de acá en más: SÍ** — sumar al scope de etapa 1: setearla en todos los caminos que anulan un presupuesto (update a estado anulado, anulación con motivo). Métrica de rechazos por período queda habilitada hacia adelante.
5. **Visibilidad: todos los roles por ahora**; limitar a dirección más adelante (dejar el gate fácil de agregar).
2. **RESUELTA — no aplica**: el circuito comercial todavía no corre en producción (se usa el sistema viejo; los pptos existentes son solo de prueba). No hay legacy real sin `fechaAceptacion`: las métricas nacen completas desde el go-live. Los "sin fecha" de prueba desaparecen con la purga pre-go-live.
