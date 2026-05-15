# Phase 14: Stock — Patrones con BOM (composición y consumo desagregado) — Context

**Gathered:** 2026-05-15
**Status:** Ready for planning
**Source:** Sesión `/gsd:discuss-phase` 2026-05-15 sobre `memory/project_stock_v2_decisions.md` (sección "2. Patrones con BOM").

<domain>
## Phase Boundary

### Qué SÍ entra

- Modelo BOM inline en `Patron`: nuevo campo `Patron.componentes?: { codigoComponente, descripcion, cantidadPorKit, unidadMedida, stockMinimo? }[]`.
- Contador de consumo por lote: nuevo campo `PatronLote.componentesConsumidos?: { codigoComponente, cantidadConsumida }[]`.
- Lógica derivada de "componente disponible" y "lote agotado" basada en BOM + consumo desagregado.
- Edición de componentes en `PatronEditorPage` (sección nueva "Componentes (BOM)" con inputs texto + numéricos).
- Nuevo paso en cierre administrativo de OT (`OTCierreAdminSection`): "Patrones consumidos" — auto-prefill desde reporte técnico, edición admin, descuento atómico.
- Audit del consumo: extensión de `MovimientoStock` con campos opcionales para entidad patrón (`entidadTipo`, `patronId`, `loteId`, `codigoComponente`); reuso del enum `tipo: 'consumo'`.
- Alerta de "lote bloqueado" cuando algún componente cae bajo su `stockMinimo` (default 0): badge en PatronesList, alerta en ficha del patrón, badge+warning en selector de reportes-ot.
- Auto-generación de Requerimiento de patrón cuando un componente cae bajo `stockMinimo`, asignado a usuario configurable (mismo patrón que FLOW-07).
- **Excepción autorizada** a la regla `.claude/rules/reportes-ot.md`: Phase 14 puede tocar `apps/reportes-ot/` SOLO para agregar badge/warning de lote bloqueado en el selector de patrones. Sin tocar el pipeline PDF ni el resto de la app.

### Qué NO entra

- **Equivalencias compra↔uso** (Phase 13, completada). Patrones y artículos viven en sub-dominios independientes; no se mezclan.
- **Venta de loaner espejo a stock** (Phase 15). No tocar `loanersService` ni `LoanerVentaModal`.
- **Pipeline PDF de reportes-ot**: no cambia. El reporte técnico sigue mostrando el código del kit (`codigoArticulo`), no componentes desagregados. La excepción frozen es estrictamente para badge/warning en el selector de patrones, no en el render del PDF.
- **Modificar el reporte técnico ya firmado/enviado**: el reporte es source-of-truth del técnico en campo. El admin puede ajustar el consumo contable en el cierre, pero el reporte queda intocable.
- **Descuento de ampollas por el técnico en campo**: descuento del stock es 100% admin desde `sistema-modular`. El técnico solo registra qué patron+lote usó (como hoy).
- **Backfill batch de patrones existentes**: no hay script masivo. Los patrones existentes quedan con `componentes = []` y siguen funcionando como hoy. El user les carga componentes manualmente cuando aparece la necesidad.
- **Eliminación de `PatronLote.cantidad`**: sigue existiendo (cantidad de kits). El BOM agrega contadores por componente, no reemplaza el conteo de kits.
- **Nueva colección `movimientosPatron`**: descartado. El audit va embebido en `MovimientoStock` (extensión backwards-compatible).
- **Cambios automáticos en el reporte técnico desde admin**: si admin difiere del reporte, el reporte queda como lo firmó el técnico; la diferencia queda registrada solo en `MovimientoStock`.

</domain>

<decisions>
## Implementation Decisions

### Modelo de datos — `Patron.componentes`

- **Locked**: nuevo campo opcional `Patron.componentes?: ComponentePatron[]` con `ComponentePatron = { codigoComponente: string; descripcion: string; cantidadPorKit: number; unidadMedida: string; stockMinimo?: number | null }`.
- **Locked**: `codigoComponente` es **texto libre interno del patrón**, NO linkea a `Articulo` del catálogo. Los componentes (ampollas) no se compran sueltos — se compra el kit; viven solamente dentro del patrón.
- **Locked**: caso simple y complejo unificados — un patrón con 3 ampollas iguales se modela como 1 componente con `cantidadPorKit: 3`; un patrón con 8 ampollas diferentes se modela como 8 componentes con `cantidadPorKit: 1`.
- **Locked**: `cantidadPorKit` es `number`, acepta enteros (caso típico).
- **Locked**: `unidadMedida` es `string` libre en v1 (ej. "ampolla", "vial", "frasco", "tira"). No se enum-iza en v1.
- **Locked**: `stockMinimo?` es opcional; default = 0 (alerta sólo al agotarse).

### Modelo de datos — `PatronLote.componentesConsumidos`

- **Locked**: nuevo campo opcional `PatronLote.componentesConsumidos?: { codigoComponente: string; cantidadConsumida: number }[]`.
- **Locked**: el `codigoComponente` matchea por igualdad de string con `Patron.componentes[].codigoComponente` (texto exacto).
- **Locked**: fuente única de verdad de "cuántas ampollas quedan" del lote = `PatronLote.cantidad × Patron.componentes[i].cantidadPorKit - PatronLote.componentesConsumidos[i].cantidadConsumida`. El catálogo de artículos NO se entera del consumo.
- **Locked**: "Lote agotado" se computa: para todos los componentes del patrón, el saldo es ≤ 0. Si al menos un componente está agotado pero otros tienen saldo, el lote pasa a estado "bloqueado" (un componente bloquea el kit entero — no se puede usar para el protocolo).

### Backwards-compatibility (patrones existentes)

- **Locked**: default `componentes = []` para todos los patrones cargados antes de Phase 14. Siguen funcionando como hoy: `PatronLote.cantidad` se interpreta como "kits enteros" sin desagregación.
- **Locked**: cuando un patrón tiene `componentes.length > 0`, el lote pasa a ser BOM-aware (display por componente, cierre admin descuenta por componente, alertas activas).
- **Locked**: no hay migración batch. El user carga componentes manualmente patrón por patrón cuando lo necesite.

### UI — edición de componentes (`PatronEditorPage`)

- **Locked**: nueva sección "Componentes (BOM)" en `PatronEditorPage` con widget de tabla/cards inline editable.
- **Locked**: por componente, inputs simples: `codigoComponente` (text), `descripcion` (text), `cantidadPorKit` (number), `unidadMedida` (text en v1), `stockMinimo` (number, opcional).
- **Locked**: agregar/quitar componentes inline (botones "+/x"). Editorial Teal, JetBrains Mono uppercase labels (consistente con resto del sistema).
- **Discretion** (Claude decide en research/plan): forma exacta del componente — tabla inline tipo `ServiciosEditor` o cards apiladas — preferir el patrón ya en uso en el repo.

### Flujo cierre administrativo — paso "Patrones consumidos"

- **Locked**: nueva sección en `OTCierreAdminSection` (componente en `apps/sistema-modular/src/components/ordenes-trabajo/`) — paso "Patrones consumidos".
- **Locked**: el paso **auto-prefila** desde el reporte técnico: lee qué `PatronSeleccionado` (patron+lote) usó el técnico en cada protocolo y pre-popula una sugerencia de 1 ampolla por componente del kit por cada uso registrado.
- **Locked**: el admin puede **editar cantidades antes de confirmar** (cambiar lote, ajustar cantidades por componente, agregar/quitar filas).
- **Locked**: cuando el reporte técnico no indica lote específico O el patrón tiene varios lotes vigentes, el sistema **sugiere FIFO por vencimiento** (lote con vencimiento más próximo y capacidad disponible). El admin puede cambiar la selección manual si conoce el caso.
- **Locked**: el reporte técnico es intocable — si admin difiere del reporte, **se respeta lo del admin para el descuento contable** y la divergencia queda anotada en el `MovimientoStock` (`motivo` o campo equivalente). El reporte técnico no se modifica.
- **Locked**: el descuento real de componentes pasa **siempre por el cierre administrativo**. El técnico en campo solo selecciona patron+lote (como hoy). No se modifica nada de la lógica de selección del técnico en `reportes-ot`.

### Audit — extensión de `MovimientoStock`

- **Locked**: NO se crea colección nueva `movimientosPatron`. El audit va en `MovimientoStock` (extensión backwards-compatible).
- **Locked**: campos nuevos opcionales en `MovimientoStock`: `entidadTipo?: 'articulo' | 'patron'` (default tratado como 'articulo' si ausente), `patronId?: string | null`, `loteId?: string | null` (o `lote: string` — la forma exacta queda para el planner), `codigoComponente?: string | null`.
- **Locked**: el `tipo` para consumo de patrón = `'consumo'` (reusa el enum existente, no se agrega `'consumo_patron'`).
- **Locked**: **1 movimiento por componente consumido** (granularidad fina). Una OT que consume 2 patrones × 3 ampollas distintas cada uno genera 6 movimientos. Permite filtrar "cuántas ampollas de cafeína se consumieron este mes".
- **Locked**: los movimientos referencian la OT (`otNumber`) y el creador (`creadoPor`) como los movimientos existentes.

### Servicios — separación de concerns

- **Locked**: el paso "Patrones consumidos" del cierre admin invoca su propio servicio (ej. `patronesService.consumirComponentes(...)` o similar) **separado** del flujo existente del `CierreStockSelector` que crea movimientos de repuestos físicos.
- **Locked**: cada servicio crea sus propios movimientos. NO se bundlean en una sola `runTransaction` con repuestos. Más simple, menos acoplamiento.
- **Locked**: la mutación de un lote (baja de N ampollas en M componentes) DEBE ser atómica vía `runTransaction` para no dejar el `componentesConsumidos[]` parcialmente actualizado.
- **Discretion**: nombre exacto del método/servicio (consumirComponentes / registrarConsumoPatron / etc.) — el planner decide.

### Stock mínimo y alertas BOM

- **Locked**: cuando el saldo de un componente (`cantidad × cantidadPorKit - consumido`) cae **a o por debajo de `stockMinimo`** (default 0), el lote pasa a estado "bloqueado para uso".
- **Locked**: efecto del bloqueo:
  1. **PatronesList** (sistema-modular): badge rojo "agotado / reemplazar" en la fila del patrón cuyo lote tiene componente en crítico.
  2. **Ficha del patrón** (`PatronEditorPage`): alerta inline en la lista de lotes mostrando qué componente está en crítico, y badge por componente.
  3. **Selector técnico en reportes-ot** (`InstrumentoSelectorPanel.tsx` o equivalente — tab "Patrones"): el lote afectado **aparece con badge/warning rojo** y el técnico no puede seleccionarlo. *(Excepción autorizada a la regla frozen — ver `<domain>`.)*
- **Locked**: además de la alerta visual + bloqueo, se **auto-genera un Requerimiento de patrón** asignado al usuario configurable (mismo patrón de configuración que FLOW-07 / `/admin/config-flujos`).
- **Locked**: el Requerimiento de patrón es una **nueva forma** de Requerimiento o extensión del tipo existente que referencia `patronId + loteId + codigoComponente`. La forma exacta (nueva entrada en un enum existente vs colección nueva) la define el planner — prefiere extender lo existente si no rompe consumidores.
- **Discretion**: el dashboard donde el responsable ve los requerimientos de patrón puede ser la misma vista existente de requerimientos (con filtro por tipo) o una vista nueva — research/plan decide la opción más simple.

### reportes-ot — excepción frozen autorizada

- **Locked**: Phase 14 está autorizado a editar `apps/reportes-ot/` ÚNICAMENTE para:
  - Agregar badge/warning visual al lote bloqueado en el tab "Patrones" del `InstrumentoSelectorPanel`.
  - Filtrar/marcar como no-seleccionable el lote bloqueado en el selector del técnico.
- **Locked**: NO se autoriza tocar:
  - Pipeline PDF (`ProtocolSection`, hojas, html2canvas, html2pdf, pdf-lib merge).
  - Otros componentes UI fuera del selector de patrones.
  - Lógica de firma del protocolo.
- **Locked**: el planner ejecuta los tasks que tocan `apps/reportes-ot/` con `CLAUDE_ALLOW_REPORTES_OT=1` (variable del hook `guard-reportes-ot.js`).

### Convenciones del repo (carry-forward Phase 13 y reglas del repo)

- **Locked**: Firestore writes nunca con `undefined` — `deepCleanForFirestore` para payloads anidados (regla `.claude/rules/firestore.md`).
- **Locked**: writes pasan solo por servicios (`patronesService`, `movimientosService`, eventual `requerimientosService`); componentes nunca llaman Firestore directo.
- **Locked**: timestamps en write con `Timestamp.now()`, en read a UI con `.toDate().toISOString()`.
- **Locked**: componentes ≤ 250 líneas — extraer hook o subcomponente antes (regla `.claude/rules/components.md`).
- **Locked**: filtros de lista persistidos vía `useUrlFilters` — nunca `useState` para filtros.
- **Locked**: design Editorial Teal — `teal-700` primario, Newsreader serif para títulos de modal, JetBrains Mono uppercase para labels.
- **Locked**: precedente Phase 13 — extensión backwards-compat de tipos (campos opcionales adicionados a interfaces existentes, consumidores existentes ignoran los campos nuevos).

### Claude's Discretion (no decidido explícitamente — planner/researcher resuelve)

- Forma exacta del campo `loteId` en `MovimientoStock` (el modelo actual de `PatronLote` no tiene id explícito — usa `lote: string` como clave dentro del array de lotes; el planner decide si se persiste por código de lote o se introduce un `lote.id`).
- Forma exacta del Requerimiento de patrón (extender enum `Requerimiento.tipo` existente vs colección nueva). Preferir extensión.
- UI exacta del paso "Patrones consumidos" (tabla con filas vs cards apiladas). Reusar atoms `Button`, `Input`, `Card`, `SearchableSelect`.
- Forma del badge "tiene BOM" / "lote bloqueado" (pictograma vs pill compacto). Editorial Teal consistente.
- Si el preview de "lote agotado" se muestra en `PatronEditorPage` como sección dedicada o inline en cada lote.
- Si la vista de patrones afectados por componentes en crítico es la misma `PatronesList` con filtro nuevo "Bloqueados" o una sub-vista.
- Si el Requerimiento de patrón se dispara desde el cierre admin (al detectar saldo ≤ mínimo en la transacción del consumo) o desde una Cloud Function on-write sobre `Patron`. Preferir lo más simple sin Cloud Function nueva.

</decisions>

<specifics>
## Specific Ideas

### Casos de uso reales mencionados por el user (decisiones 2026-05-15)

- **Caso simple (3 ampollas iguales)**: patrón `5182-6917` con 3 ampollas iguales — modelo: 1 componente con `cantidadPorKit: 3`.
- **Caso complejo (8 ampollas diferentes)**: `UV KIT 5062-6503` con 8 ampollas distintas — modelo: 8 componentes con `cantidadPorKit: 1` cada uno.
- **Caso de bloqueo**: en el UV KIT, una ampolla (ej. cafeína) se gasta antes que las demás. Aunque las otras 7 estén llenas, el kit YA NO se puede usar — el lote queda bloqueado, el técnico no lo ve en el selector, y se dispara requerimiento auto para reemplazo.

### Auto-prefill desde reporte técnico

- El reporte técnico existente registra `PatronSeleccionado { patronId, lote, ... }` por protocolo (campo en `OT.protocolos[].patrones[]` o equivalente — la forma exacta la investiga el researcher).
- El paso admin lee esos `PatronSeleccionado`, expande cada uno a "1 unidad por componente del kit" como sugerencia inicial, y muestra una tabla editable con: patrón, lote, componente, cantidad sugerida, cantidad final (editable), motivo si difiere.
- FIFO por vencimiento sólo aplica cuando el reporte técnico no especifica lote OR el patrón tiene múltiples lotes vigentes y el técnico no los desambiguó.

### Match con flujo existente del cierre admin

- `OTCierreAdminSection.tsx` ya tiene varias secciones inline: hours, repuestos, `CierreStockSelector`, `CierrePDFPreview`, `CierreFacturacionWizard`.
- La sección "Patrones consumidos" se inserta en este flujo (ubicación exacta — antes/después de `CierreStockSelector` — el planner decide; sugerir antes para que repuestos físicos y patrones queden agrupados).
- El cierre admin existente ya invoca varios servicios secuencialmente; la nueva sección agrega una invocación más.

### Excepción reportes-ot

- Cambio aprobado en `InstrumentoSelectorPanel.tsx` (tab "Patrones") y/o la fuente de datos que alimenta esa lista.
- El badge "lote bloqueado" debe ser visualmente claro (rojo + ícono o texto "AGOTADO").
- El técnico debe poder ver el patrón pero no seleccionar el lote bloqueado (UX: la fila del lote bloqueado se muestra deshabilitada).
- NO se toca: render del PDF, firma del protocolo, ningún hook `guard-*` del proyecto.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`Patron` / `PatronLote` tipos** (`packages/shared/src/types/index.ts:2236-2255`): se extienden con campos opcionales `componentes?` y `componentesConsumidos?`. No se rompen consumidores existentes.
- **`PatronSeleccionado` tipo** (`packages/shared/src/types/index.ts`): el reporte técnico ya guarda `patronId + lote`; el cierre admin lo lee para auto-prefill.
- **`MovimientoStock` tipo + `TipoMovimiento` enum** (`packages/shared/src/types/index.ts:2712-2751`): se extiende con `entidadTipo?`, `patronId?`, `loteId?`, `codigoComponente?`. El enum `tipo` NO se modifica.
- **`patronesService.ts`** (`apps/sistema-modular/src/services/`): ya tiene CRUD básico (`getAll`, `getById`, `create`, `update`, `delete`, `subscribe`, certificados). Se extiende con `consumirComponentes(...)` y helpers de saldo.
- **`OTCierreAdminSection.tsx`** (`apps/sistema-modular/src/components/ordenes-trabajo/`): contenedor del flujo de cierre admin existente. Se le agrega una sección inline más.
- **`PatronEditorPage.tsx`** (`apps/sistema-modular/src/pages/patrones/`): ya gestiona patrón + lotes + certificados. Se le agrega sección de componentes.
- **`PatronesList.tsx`** (`apps/sistema-modular/src/pages/patrones/`): ya tiene sort/filter/export. Se agrega columna/badge "BOM" + "lote bloqueado".
- **`SearchableSelect`** (`apps/sistema-modular/src/components/ui/`): atom existente. Posible uso si se decide picker de lote en el paso admin.
- **`useUrlFilters` hook** (existente): listas con filtros persistidos en URL. Aplicar al filtro nuevo "Bloqueados" si se introduce.
- **`runTransaction` pattern**: precedente Phase 13 con `desagregarUnidades`. Mismo enfoque para `consumirComponentes`.
- **`deepCleanForFirestore` / `cleanFirestoreData`** (`apps/sistema-modular/src/services/firebase.ts`): writes que toquen el array `componentesConsumidos` deben pasar por estos helpers (regla `.claude/rules/firestore.md`).

### Established Patterns

- **Extensión backwards-compat de interfaces** (Phase 13 con `subtipo`): pattern repetido aquí con `entidadTipo`. Consumidores que no leen el nuevo campo siguen funcionando.
- **Cierre administrativo como pipeline de secciones inline**: cada paso (hours, repuestos, stock, PDF, facturación) es una sección dentro del mismo componente padre `OTCierreAdminSection`. El paso "Patrones consumidos" sigue este patrón.
- **Audit centralizado en `MovimientoStock`**: ya hay 6 valores de `tipo` y `TipoOrigenDestino`. Extender es preferible a crear colección nueva.
- **Requerimientos auto-generados** (Phase 1 — STKE-... usaron este patrón para artículos al recibir presupuesto): replicar la idea para patrones cuando un componente cae bajo mínimo.
- **Configuración admin de responsables** (FLOW-07 / `/admin/config-flujos`): el usuario asignado a Requerimientos de patrón se setea ahí.
- **Hook `guard-reportes-ot.js`**: para editar `apps/reportes-ot/` el planner expone `CLAUDE_ALLOW_REPORTES_OT=1` en los tasks autorizados.

### Integration Points

- `packages/shared/src/types/index.ts` — extensión tipos `Patron`, `PatronLote`, `MovimientoStock`.
- `apps/sistema-modular/src/services/patronesService.ts` — nuevo método `consumirComponentes` + helpers de saldo + lógica de bloqueo.
- `apps/sistema-modular/src/services/movimientosService.ts` — escritura de movimientos con `entidadTipo: 'patron'`.
- `apps/sistema-modular/src/services/requerimientosService.ts` (existente) — extensión para Requerimiento de patrón.
- `apps/sistema-modular/src/components/ordenes-trabajo/OTCierreAdminSection.tsx` — agregar sección "Patrones consumidos".
- `apps/sistema-modular/src/pages/patrones/PatronEditorPage.tsx` — agregar sección "Componentes (BOM)".
- `apps/sistema-modular/src/pages/patrones/PatronesList.tsx` — agregar badge "BOM" y badge "lote bloqueado", posible filtro nuevo.
- `apps/reportes-ot/components/InstrumentoSelectorPanel.tsx` (tab "Patrones") — agregar badge/warning + bloqueo de selección. **Cambio limitado y autorizado.**
- `/admin/config-flujos` — agregar setting de "usuario para Requerimientos de patrón" (si se decide reusar el patrón FLOW-07).

</code_context>

<deferred>
## Deferred Ideas

- **Migración batch de patrones existentes con componentes**: el user los carga manualmente. Si después aparece necesidad, script one-shot en una fase posterior.
- **Componentes linkeados a `Articulo` del catálogo**: descartado en v1 (codigoComponente es texto interno). Si en el futuro se quiere unificar stock de ampollas con catálogo de artículos, se modela aparte.
- **Conversión inversa (re-componer ampollas en kits)**: no aplica en patrones (los componentes no se vuelven a empaquetar). N/A.
- **Reporte técnico modificable desde admin**: descartado. El reporte queda intocable; diferencias quedan en MovimientoStock con motivo.
- **Descuento de ampollas por el técnico en campo**: descartado. Mantenemos `reportes-ot` con cambio acotado (solo selector); descuento real es 100% admin.
- **PDF anexo "patrones consumidos por OT"**: no en scope v1. Si se necesita, se agrega después (similar a `AnexoConsumiblesPDF` de Phase 4).
- **Dashboard `/patrones/reponer` aparte**: no en v1. Triple visibilidad (lista + ficha + selector técnico) alcanza. Si se necesita centralizar, se hace después.
- **Vencimiento por componente**: hoy el vencimiento es del lote entero (`PatronLote.fechaVencimiento`). No se desagrega por componente.
- **stockMinimo expresado como % en lugar de absoluto**: descartado v1. Es número absoluto en ampollas. Si aparece el caso, se modela aparte.
- **Cancelación/reversa de un consumo registrado por error**: no en v1. Si se necesita, se modela aparte (compensating MovimientoStock).
- **Doble-bookkeeping con `OT.repuestos[]`**: el cierre admin actual maneja repuestos físicos en una sección. Patrones consumidos viven aparte; no se integran con `OT.repuestos[]`. Si en el futuro se quiere vista unificada, se hace después.
- **Edición de componentes después de que el lote ya tiene consumo**: tema sutil (¿qué pasa con `componentesConsumidos[]` si renombro un componente?). El planner debe pensar la guarda; en v1 probablemente bloquear edición o requerir migración manual.
- **Eliminación de patrón con consumo histórico**: el patron ya tiene `delete` que limpia certificados. Patrones con consumo histórico en `MovimientoStock` podrían querer soft-delete (`activo: false`) para no romper hist. Decisión final en plan detallado.
- **Phase 15 (Venta loaner espejo a stock)**: no se mezcla con Phase 14. Es otra fase, otro sub-dominio.

</deferred>

---

*Phase: 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado*
*Context gathered: 2026-05-15 via `/gsd:discuss-phase 14`*
