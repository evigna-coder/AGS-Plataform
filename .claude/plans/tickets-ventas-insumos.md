# Plan: Tickets con motivo "Ventas de Insumos"

**Status**: MVP (reporte PDF + Excel) — por implementar. Flujo completo **diferido** hasta que módulo Presupuestos auto-popule datos.
**Created**: 2026-04-18

## Contexto del negocio

La empresa vende insumos por múltiples canales (vendedor directo, detección por ingeniera de campo, inbound). El ticket captura la oportunidad. Avanza por pipeline: presupuesto → OC → importación → entrega → cierre (resuelto / sin resolver).

Hoy la mayoría de esos datos (presupuesto#, OC#, fechas) se van a auto-completar cuando el módulo Presupuestos esté productivo end-to-end. Hasta entonces, el usuario no quiere cargar nada a mano en el ticket — prefiere **exportar a Excel y completar columnas manuales ahí**.

## Lo que ya existe y no hay que tocar

- `motivoLlamado: 'ventas_insumos'` en `Ticket` (tipado).
- 15 estados granulares en `TicketEstado` ([packages/shared/src/types/index.ts:504-519](packages/shared/src/types/index.ts#L504-L519)) cubriendo todo el pipeline: `presupuesto_pendiente` → `presupuesto_enviado` → `esperando_oc` → `espera_importacion` → `pendiente_entrega` → `finalizado` / `no_concretado`.
- UI actual colapsa a 3 estados simplificados (`TicketEstadoSimplificado`) — el comentario del código dice "cuando vuelvan los módulos".
- `valorEstimado`, `presupuestosIds[]`, `otIds[]`, `postas[]`, `finalizadoAt`, `createdBy`, `asignadoA` — todo presente.

## MVP — Reporte exportable (implementar ahora)

### Alcance

Una **página de reporte** que lista tickets con `motivoLlamado = 'ventas_insumos'` filtrados por rango de fechas, exportable a **PDF** y **Excel**. El Excel trae columnas vacías para que el usuario complete datos de presupuesto a mano.

### Criterio de query (clave — no simplificar)

```
motivoLlamado = 'ventas_insumos'
AND (
  createdAt IN rango
  OR updatedAt IN rango
  OR estado NOT IN ('finalizado', 'no_concretado')
)
```

Esto captura el escenario que el usuario remarcó: "no se concretó el mes pasado pero sí este". Los tickets abiertos aparecen en cada reporte hasta cerrar.

### Filtros UI

- Rango de fechas con presets:
  - **Esta semana** (lunes → domingo de la semana actual)
  - **Este mes** (día 1 → último día del mes actual)
  - **Mes anterior**
  - **Custom** (date range picker)
- Vendedor (opcional): filtra por `asignadoA`.
- Estado (opcional): multi-select.

### Columnas del reporte

Datos que ya existen → se auto-completan:

| Columna | Fuente |
|---|---|
| Ticket # | `id` / número |
| Fecha creación | `createdAt` |
| Razón social | `razonSocial` |
| Contacto | principal de `contactos[]` |
| Vendedor | `asignadoNombre` (fallback: `createdBy`) |
| Estado actual | `TICKET_ESTADO_LABELS[estado]` |
| Último movimiento | `updatedAt` |
| Valor estimado | `valorEstimado` |
| Descripción | `motivoContacto` / primeras postas |
| Resultado | `finalizado` → "Resuelto" / `no_concretado` → "Sin resolver" / otros → "En curso" |

Columnas **vacías** en el Excel para llenar a mano (no aparecen en el PDF para no contaminar el visual):

| Columna | Para qué |
|---|---|
| N° Presupuesto | Hasta que Presupuestos integre |
| Monto final | Cuando se confirma venta |
| N° OC | Cuando llega |
| Fecha entrega | Cuando se concreta |
| Observaciones | Comentarios del vendedor |

### Export

- **PDF**: `@react-pdf/renderer` (ya instalado). Layout horizontal, branding Editorial Teal, header con rango + fecha de generación, footer con paginación. Compacto para archivo.
- **Excel**: `xlsx` (ya instalado). Una hoja. Headers con color teal. Columnas vacías pre-pintadas (amarillo claro) para indicar "completar a mano".

### Ubicación en la UI

Opción A (preferida): botón **"Reporte Ventas Insumos"** en la página de Tickets (`/tickets` o `/leads`), arriba de la tabla, al lado de los filtros. Abre un modal con los filtros del reporte y dos botones: **Exportar PDF** / **Exportar Excel**.

Opción B: página dedicada `/ventas-insumos/reportes`. Más pesada, justifica si a futuro el reporte crece.

**Decisión MVP**: Opción A (modal desde la lista). Si crece, migramos.

### Archivos propuestos

- `apps/sistema-modular/src/components/leads/ReporteVentasInsumosModal.tsx` — modal con filtros + botones de export (~200 líneas, respetando budget).
- `apps/sistema-modular/src/components/leads/pdf/ReporteVentasInsumosPDF.tsx` — documento `@react-pdf/renderer`.
- `apps/sistema-modular/src/utils/exportVentasInsumosExcel.ts` — builder del workbook xlsx.
- `apps/sistema-modular/src/services/leadsService.ts` — método nuevo `queryForVentasInsumosReport(rango, filtros)`.

### Fuera de alcance del MVP

- No se agregan campos nuevos al tipo `Ticket`.
- No se cambia el selector de estado (sigue mostrando los 3 simplificados).
- No hay panel especial en el detalle del ticket.
- No hay alertas / forecasts / dashboards.

## Diferido — Implementar cuando Presupuestos esté productivo

Cuando el módulo Presupuestos auto-popule número + monto en los tickets linkeados, y OC / importación / entrega tengan su lugar propio, tiene sentido agregar:

### 1. Destrabar estados granulares (solo para este motivo)

Si `motivoLlamado === 'ventas_insumos'`, el selector de estado muestra los 15 estados en lugar de los 3 simplificados. El comentario del código ya anticipa este momento.

### 2. Un solo campo nuevo: `canalVenta`

```ts
canalVenta?: 'vendedor_directo' | 'ingeniera_campo' | 'inbound' | 'otro';
```

Opcional, se elige al crear. **No se puede derivar después** — si no lo capturás ahora, nunca vas a poder medir qué canal rinde más.

### 3. Panel "Pipeline de venta" en el detalle

Visible solo cuando motivo = ventas_insumos. Campos derivados (read-only) de los módulos linkeados:
- Presupuesto # + monto (desde `presupuestosIds[0]`)
- OC # + fecha (desde módulo OC cuando exista)
- Importación (desde módulo correspondiente)
- Entrega

Todos read-only — el usuario no carga nada acá, solo ve el estado consolidado.

### 4. Alerta de oportunidad stale

Ticket en `presupuesto_enviado` hace >14 días sin movimiento (sin postas, sin cambio de estado) → aparece marcado en la lista. Ventas perdidas por falta de seguimiento es el pecado capital del pipeline.

### 5. Reporte enriquecido

La misma página de reporte suma columnas que ahora son automáticas: presupuesto#, monto, OC#, fechas, canal. El PDF y Excel se vuelven más completos.

### 6. Sinergia con lifecycle events

El reporte lee `lifecycleEvents` (ver [ot-lifecycle-events.md](ot-lifecycle-events.md)) para mostrar el timeline completo por ticket. "Último movimiento" pasa de ser `updatedAt` a ser el último evento significativo con su actor.

## No-goals permanentes (ni ahora ni después)

- **No es un módulo de Ventas separado**. Es ticket con motivo — resistir forkear.
- **No se duplican datos que ya viven en Presupuestos / OC**. Siempre se linkea, no se copia.
- **No hay workflows automáticos de recordatorio**. Alertas visuales sí; envío de mail no, al menos no hasta que la demanda lo justifique.
- **No hay ML / forecasting dinámico**. Tabla exportable + totalizadores es suficiente.

## Próximo paso

Implementar el MVP del reporte (Fase actual). Cuando Presupuestos esté productivo, reabrir este plan en la sección "Diferido".
