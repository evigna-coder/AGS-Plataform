# Phase 13: Stock — Equivalencias compra↔uso — Context

**Gathered:** 2026-05-15
**Status:** Ready for planning
**Source:** Synthesized from `memory/project_stock_v2_decisions.md` (decisiones 2026-05-15) — sin sesión de `/gsd:discuss-phase`.

<domain>
## Phase Boundary

### Qué SÍ entra

- Nuevo campo `Articulo.equivalencias[]` modelando la relación **1→1 con factor** entre código de compra (caja, kit, blíster) y código de uso (ampolla, unidad) en el mismo `Articulo`.
- Nuevo `MovimientoStock.subtipo?: 'conversion'` (extensión, no nuevo `tipo`).
- Servicio `articulosService.linkEquivalencia / unlinkEquivalencia` con validaciones 1→1 y anti-ciclo.
- Servicio `desagregarUnidades(...)` como `runTransaction` atómica (baja origen + alta destino + audit) — el "Desagregar ahora".
- UI de vinculación en la edición/ficha del artículo de compra.
- UI display dual en `ArticuloDetail` (siempre visible) + en lista de artículos / `SearchableSelect` (on-demand bajo búsqueda).
- Botón "Desagregar ahora" en la ficha de compra con modal de cantidad + ubicación.

### Qué NO entra

- **Patrones / `Patron.componentes`** — eso es Phase 14. Aquí no se toca `patronesService` ni `PatronLote`.
- **Venta de loaner espejo a stock** — eso es Phase 15. Aquí no se toca `loanersService` ni `LoanerVentaModal`.
- **Conversión automática al recibir OC**: descartado. La conversión es siempre manual y diferida via botón.
- **Equivalencias N→M** o de varios pasos (A→B→C): fuera de scope v1. Si aparece el caso, se modela aparte.
- **Tocar `apps/reportes-ot/`**: invariante de la app — esto vive sólo en `apps/sistema-modular/` (y opcionalmente en `apps/portal-ingeniero/` si tiene vistas de stock).
- **Migración masiva de artículos existentes**: el usuario carga las equivalencias manualmente a medida que las necesita; no hay backfill batch en este phase.

</domain>

<decisions>
## Implementation Decisions

### Modelo de datos — `Articulo.equivalencias`

- **Locked**: campo opcional `equivalencias?: { articuloIdDestino, articuloCodigoDestino, articuloDescripcionDestino, factor }[]`.
- **Locked**: vive en el artículo de **compra**, apunta al de **uso**. Sentido único.
- **Locked**: en v1 el array tiene **a lo sumo un elemento** (relación 1→1). La forma array deja la puerta abierta a futuro sin migración, pero la UI y validaciones rechazan más de uno.
- **Locked**: `factor` es `number` y **puede no ser entero** (`0.1`, `0.5`, etc.) — caso real: caja de 100 que representa 1/10 de una unidad de 1000.
- **Locked**: el reverso (uso→compra) se calcula en runtime como `1 / factor`, no se persiste.
- **Locked**: la denormalización del destino (`articuloCodigoDestino`, `articuloDescripcionDestino`) se persiste para evitar joins en listas; se refresca al renombrar el destino (ver "consistencia" en deferred).

### Validaciones de vinculación (1→1 estricto)

- **Locked**: rechazar `link` si el origen ya tiene `equivalencias.length > 0`.
- **Locked**: rechazar `link` si **otro artículo** ya tiene `articuloIdDestino === destinoId` (un destino no puede ser apuntado por dos orígenes).
- **Locked**: rechazar `link` si crea **ciclo**: el `destinoId` ya tiene una equivalencia que apunta directa o transitivamente al `origenId`. En 1→1 el ciclo más corto es A→B→A.
- **Locked**: rechazar `link` si `factor <= 0` o `factor` no es finito.
- **Locked**: rechazar `link` si `origenId === destinoId`.

### Conversión: manual y diferida (`desagregarUnidades`)

- **Locked**: no se dispara en recepción de OC ni en ningún flujo automático. Sólo via botón "Desagregar ahora".
- **Locked**: la conversión es una transferencia interna entre dos artículos, no entre ubicaciones. Origen y destino están en la **misma ubicación**.
- **Locked**: ambos códigos coexisten en stock simultáneamente — se puede tener stock de la caja sin desagregar y stock de la ampolla ya desagregada al mismo tiempo.
- **Locked**: implementación como `runTransaction` Firestore que ejecuta tres efectos atómicos:
  1. Baja N unidades del artículo origen (compra) en la ubicación.
  2. Alta `N × factor` unidades del artículo destino (uso) en la misma ubicación.
  3. Crea un `MovimientoStock` con `tipo: 'transferencia'`, `subtipo: 'conversion'`, audit completo (origen, destino, factor, unidades ambos lados, posta de stock, usuario, timestamp).
- **Locked**: la transacción falla atómicamente si no hay stock suficiente del origen, si el artículo destino no existe, o si la ubicación origen no tiene posta.

### Enum `MovimientoStock` — backwards-compat

- **Locked**: NO se agrega un nuevo `MovimientoStock.tipo` top-level. Se agrega un campo opcional `subtipo?: 'conversion'`.
- **Why**: consumidores actuales que leen `tipo` y filtran por `'transferencia'` siguen funcionando sin tocar nada. El subtipo es una refinación adicional.
- **How to apply**: cualquier histórico/audit/filtro que quiera distinguir "transferencia entre ubicaciones" de "conversión compra→uso" lee `subtipo`. Si no lo lee, lo trata como transferencia normal.

### Display dual

- **Locked**: en `ArticuloDetail` el desglose dual va **siempre visible** porque ya estás dentro del artículo.
- **Locked**: en la lista de artículos y en `SearchableSelect`, las filas se ven **colapsadas por defecto**; las que tienen equivalencia muestran un badge/icono.
- **Locked**: el desglose dual se despliega **on-demand**, sólo al buscar específicamente uno de los códigos vinculados. No se renderiza para todas las filas con equivalencia.
- **Locked**: el formato del display dual mostrado al user (texto de referencia, la UI final puede pulir):
  ```
  5188-5367      × 5  disponibles                  ← stock real (lado de uso)
  └─ (≈ 0.5 × 5183-2209 equivalentes)               ← calculado (reverso)
  + 2 × 5183-2209  sin desagregar                   ← stock real (lado de compra)
     (= 20 × 5188-5367 potenciales)                  ← calculado (directo)
     [Desagregar ahora]                              ← CTA si stock>0 en lado compra
  ```
- **Locked**: el `SearchableSelect` debe rutear tanto el código de compra como el de uso a **la misma fila de resultados** (un par vinculado es una entidad de búsqueda unificada).

### Convenciones de la base

- **Locked**: Firestore writes nunca con `undefined` — usar `deepCleanForFirestore` para payloads anidados, `cleanFirestoreData` para flat (regla `.claude/rules/firestore.md`).
- **Locked**: todos los Firestore writes pasan por `articulosService` / `movimientosService`; componentes nunca llaman Firestore directo (regla del repo).
- **Locked**: timestamps en write con `Timestamp.now()`; en read a UI con `.toDate().toISOString()`.
- **Locked**: nuevos componentes ≤ 250 líneas; extraer hook o subcomponente antes (regla `.claude/rules/components.md`).
- **Locked**: filtros de lista persisten via `useUrlFilters`, nunca `useState` (skill `list-page-conventions` + `feedback_filter_persistence`).
- **Locked**: design Editorial Teal — teal-700 primario, Newsreader serif para títulos de modal, JetBrains Mono uppercase para labels.

### Claude's Discretion (no cubierto explícitamente por memoria — Claude decide en research/plan)

- Forma exacta del campo `MovimientoStock` (qué refs guarda: `articuloOrigenId/articuloDestinoId/factor/cantidadOrigen/cantidadDestino` vs algo más compacto).
- Cómo refresca la denormalización `articuloCodigoDestino` / `articuloDescripcionDestino` cuando el destino se renombra — opciones: trigger Cloud Function, recompute on read, recompute en update de articulo. Decisión a tomar en research/plan; preferir la más simple sin Cloud Functions si alcanza.
- Forma exacta de la query "¿algún otro artículo tiene a este como destino?" sin un índice degenerado (probablemente filter `where('equivalencias.articuloIdDestino', '==', X)` con el formato array-of-maps de Firestore — research debe confirmar el patrón de query soportado).
- Componente exacto del modal "Desagregar ahora" (reutilizar atoms `Input`, `SearchableSelect`, `Button` del `components/ui/`).
- Si el panel de equivalencia se monta dentro del modal de edición del artículo o como sección separada en `ArticuloDetail`. Preferir dentro de la edición para no fragmentar el flow.
- Forma del badge "tiene equivalente" — pictograma sutil estilo `↔` con tooltip o pill compacto. Editorial Teal.

</decisions>

<specifics>
## Specific Ideas

### Casos de uso reales mencionados por el user (decisiones 2026-05-15)

- **Caso 1**: código de compra `5183-2209` (caja) ↔ código de uso `5188-5367` (ampolla), factor `10` (1 caja = 10 ampollas). En la práctica al ingresar la caja se transfiere mentalmente como `×10` al minikit.
- **Caso 2 (factor decimal)**: caja de 100 que representa 1/10 de una unidad de 1000 → `factor: 0.1`.
- **Estado de búsqueda esperado**: buscar `5188-5367` debe mostrar la fila con ambas existencias (5 ampollas reales + 2 cajas sin desagregar = potencial 20 ampollas adicionales).

### CTA "Desagregar ahora"

- Localizado en la vista detallada del artículo de compra cuando hay stock disponible en alguna ubicación.
- Modal pide: cantidad de cajas a desagregar (con max = stock disponible), ubicación donde hacer la conversión (selector con stock visible por ubicación), preview del resultado (`N × factor = M`).
- Confirmar dispara `desagregarUnidades(...)` — éxito muestra toast con link al MovimientoStock creado; falla muestra error sin romper el state del modal.

### Match con el flujo existente

- `MovimientoStock` colección y servicio ya existen (de Phase 1 — Reservas/Movimientos). El subtipo se enchufa ahí.
- `articulosService` ya existe. Se extiende con `linkEquivalencia / unlinkEquivalencia / desagregarUnidades`.
- `UnidadStock` y su modelo de posta/ubicación ya existen. La conversión opera sobre ellos; no cambia su schema.
- El `SearchableSelect` ya tiene patrón `useDeferredValue` para no perder keystrokes (memoria). La feature dual-row se monta encima.

</specifics>

<deferred>
## Deferred Ideas

- **N→M y multi-paso**: si aparece A→B y B→C de forma natural, se modela en una iteración posterior con un grafo de equivalencias. v1 es estrictamente 1→1.
- **Conversión inversa (desagregar al revés)**: tomar M unidades de uso y "recomponerlas" en N unidades de compra. No mencionado por el user; no se construye en v1.
- **Backfill batch de artículos existentes con equivalencias**: el user carga manualmente lo que va apareciendo. Si aparece la necesidad después, se hace un script one-shot en una fase posterior.
- **Refresh denormalizado vía Cloud Function**: si el costo de mantener `articuloCodigoDestino` / `articuloDescripcionDestino` actualizados es alto, se puede mover a un trigger más adelante. v1 puede empezar con recompute on update del destino.
- **Patrones con BOM** (Phase 14): patrones tienen su propio modelo (`Patron.componentes` + `PatronLote.componentesConsumidos`) que NO se mezcla con artículo-equivalencia. Son dos sub-dominios independientes.
- **Venta de loaner espejo a stock** (Phase 15): otra fase. No tocar `loanersService` aquí.

</deferred>

---

*Phase: 13-stock-equivalencias-compra-uso*
*Context gathered: 2026-05-15 synthesized from project_stock_v2_decisions.md*
