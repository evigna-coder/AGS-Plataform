# Phase 13: Stock — Equivalencias compra↔uso - Research

**Researched:** 2026-05-15
**Domain:** Stock / Inventario — vinculación 1→1 entre código de compra y código de uso, conversión manual atómica (`runTransaction`), display dual on-demand.
**Confidence:** HIGH (la mayoría de las decisiones son verificadas en el codebase actual; el único punto de cuidado es la query "destino ya tomado", que requiere un campo denormalizado plano).

## Summary

Phase 13 extiende artículos y movimientos existentes — **no crea colecciones nuevas**. El trabajo central:

1. **Tipos en `@ags/shared`** — `Articulo.equivalencias?: { ... }[]` + `MovimientoStock.subtipo?: 'conversion'`. Cero breaking changes (campos opcionales).
2. **Servicio `articulosService` extendido** con `linkEquivalencia / unlinkEquivalencia / desagregarUnidades`, todo bajo el patrón ya existente (`deepCleanForFirestore`, `getCreateTrace/getUpdateTrace`, `Timestamp.now()`, audit via `batchAudit`/`logBusinessEvent`).
3. **`desagregarUnidades` como `runTransaction`** siguiendo *exactamente* el patrón de `reservasService.reservar()` (Phase 9): READ phase primero, builds, WRITE phase con `tx.update`/`tx.set`. Audit fire-and-forget post-tx.
4. **UI editorial-teal mínima** — sección "Equivalencia (código de uso)" en `EditArticuloModal` + sección dual en `ArticuloDetail` + modal "Desagregar ahora" + badge en `ArticulosList`. Ningún componente nuevo debería exceder 250 líneas.
5. **Display dual en `SearchableSelect`** — requiere extender el shape de `options` con un campo `extra?` que renderiza una sub-línea cuando matchea el código vinculado. Es el único cambio "no trivial" de UI: hay que tocar `useSearchableSelect` para que un par de códigos sea una sola entry de búsqueda.

**Decisión crítica de modelo** (Claude's Discretion):
- **Persistir un campo `articuloIdDestinoEquivalencia?: string | null` plano** además del array `equivalencias[]`. Es lo único que habilita una query Firestore eficiente para "¿algún otro artículo apunta a este destino?". Firestore **no soporta** `array-contains` sobre un campo dentro de un objeto del array. El array `equivalencias[]` queda como source-of-truth para el factor + denormalizado de display; el campo plano duplica el `id` del destino sólo para la query de unicidad. Recompute trivial: cualquier `update()` que toque `equivalencias` setea/limpia ambos campos en el mismo write.

**Primary recommendation:** Reusar el patrón de Phase 9 al 100% — mismo `runTransaction` shape, mismo `MovimientoStock` shape, misma forma de audit. El único cambio "nuevo" es el modelo de equivalencia y la query plana. Todo lo demás es ensamblaje de piezas existentes.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Modelo de datos — `Articulo.equivalencias`**
- Campo opcional `equivalencias?: { articuloIdDestino, articuloCodigoDestino, articuloDescripcionDestino, factor }[]`.
- Vive en el artículo de **compra**, apunta al de **uso**. Sentido único.
- En v1 el array tiene **a lo sumo un elemento** (relación 1→1). La forma array deja la puerta abierta a futuro sin migración, pero la UI y validaciones rechazan más de uno.
- `factor` es `number` y **puede no ser entero** (`0.1`, `0.5`, etc.) — caso real: caja de 100 que representa 1/10 de una unidad de 1000.
- El reverso (uso→compra) se calcula en runtime como `1 / factor`, no se persiste.
- La denormalización del destino (`articuloCodigoDestino`, `articuloDescripcionDestino`) se persiste para evitar joins en listas; se refresca al renombrar el destino.

**Validaciones de vinculación (1→1 estricto)**
- Rechazar `link` si el origen ya tiene `equivalencias.length > 0`.
- Rechazar `link` si **otro artículo** ya tiene `articuloIdDestino === destinoId` (un destino no puede ser apuntado por dos orígenes).
- Rechazar `link` si crea **ciclo**: el `destinoId` ya tiene una equivalencia que apunta directa o transitivamente al `origenId`. En 1→1 el ciclo más corto es A→B→A.
- Rechazar `link` si `factor <= 0` o `factor` no es finito.
- Rechazar `link` si `origenId === destinoId`.

**Conversión: manual y diferida (`desagregarUnidades`)**
- No se dispara en recepción de OC ni en ningún flujo automático. Sólo via botón "Desagregar ahora".
- La conversión es una transferencia interna entre dos artículos, no entre ubicaciones. Origen y destino están en la **misma ubicación**.
- Ambos códigos coexisten en stock simultáneamente — se puede tener stock de la caja sin desagregar y stock de la ampolla ya desagregada al mismo tiempo.
- Implementación como `runTransaction` Firestore que ejecuta tres efectos atómicos:
  1. Baja N unidades del artículo origen (compra) en la ubicación.
  2. Alta `N × factor` unidades del artículo destino (uso) en la misma ubicación.
  3. Crea un `MovimientoStock` con `tipo: 'transferencia'`, `subtipo: 'conversion'`, audit completo (origen, destino, factor, unidades ambos lados, posta de stock, usuario, timestamp).
- La transacción falla atómicamente si no hay stock suficiente del origen, si el artículo destino no existe, o si la ubicación origen no tiene posta.

**Enum `MovimientoStock` — backwards-compat**
- NO se agrega un nuevo `MovimientoStock.tipo` top-level. Se agrega un campo opcional `subtipo?: 'conversion'`.
- Consumidores actuales que leen `tipo` y filtran por `'transferencia'` siguen funcionando sin tocar nada. El subtipo es una refinación adicional.

**Display dual**
- En `ArticuloDetail` el desglose dual va **siempre visible**.
- En la lista de artículos y en `SearchableSelect`, las filas se ven **colapsadas por defecto**; las que tienen equivalencia muestran un badge/icono.
- El desglose dual se despliega **on-demand**, sólo al buscar específicamente uno de los códigos vinculados.
- El `SearchableSelect` debe rutear tanto el código de compra como el de uso a **la misma fila de resultados**.

**Convenciones de la base**
- Firestore writes nunca con `undefined` — usar `deepCleanForFirestore` para payloads anidados.
- Todos los Firestore writes pasan por `articulosService` / `movimientosService`; componentes nunca llaman Firestore directo.
- Timestamps en write con `Timestamp.now()`; en read a UI con `.toDate().toISOString()`.
- Nuevos componentes ≤ 250 líneas.
- Filtros de lista persisten via `useUrlFilters`.
- Design Editorial Teal — teal-700 primario, Newsreader serif para títulos de modal, JetBrains Mono uppercase para labels.

### Claude's Discretion

- Forma exacta del campo `MovimientoStock` (qué refs guarda: `articuloOrigenId/articuloDestinoId/factor/cantidadOrigen/cantidadDestino` vs algo más compacto).
- Cómo refresca la denormalización `articuloCodigoDestino` / `articuloDescripcionDestino` cuando el destino se renombra — opciones: trigger Cloud Function, recompute on read, recompute en update de articulo. Decisión a tomar en research/plan; preferir la más simple sin Cloud Functions si alcanza.
- Forma exacta de la query "¿algún otro artículo tiene a este como destino?" sin un índice degenerado.
- Componente exacto del modal "Desagregar ahora" (reutilizar atoms `Input`, `SearchableSelect`, `Button` del `components/ui/`).
- Si el panel de equivalencia se monta dentro del modal de edición del artículo o como sección separada en `ArticuloDetail`. Preferir dentro de la edición para no fragmentar el flow.
- Forma del badge "tiene equivalente" — pictograma sutil estilo `↔` con tooltip o pill compacto. Editorial Teal.

### Deferred Ideas (OUT OF SCOPE)

- **N→M y multi-paso**: si aparece A→B y B→C de forma natural, se modela en una iteración posterior con un grafo de equivalencias. v1 es estrictamente 1→1.
- **Conversión inversa (desagregar al revés)**: tomar M unidades de uso y "recomponerlas" en N unidades de compra. No mencionado por el user; no se construye en v1.
- **Backfill batch de artículos existentes con equivalencias**: el user carga manualmente lo que va apareciendo.
- **Refresh denormalizado vía Cloud Function**: si el costo de mantener `articuloCodigoDestino` / `articuloDescripcionDestino` actualizados es alto, se puede mover a un trigger más adelante. v1 puede empezar con recompute on update del destino.
- **Patrones con BOM** (Phase 14): patrones tienen su propio modelo (`Patron.componentes` + `PatronLote.componentesConsumidos`) que NO se mezcla con artículo-equivalencia.
- **Venta de loaner espejo a stock** (Phase 15): otra fase.
- **Tocar `apps/reportes-ot/`**: invariante del proyecto — esto vive sólo en `apps/sistema-modular/`.
- **Migración masiva de artículos existentes**: el usuario carga las equivalencias manualmente a medida que las necesita; no hay backfill batch en este phase.
- **Conversión automática al recibir OC**: descartado. La conversión es siempre manual y diferida via botón.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STKE-01 | Tipos foundation: `Articulo.equivalencias?: { articuloIdDestino, articuloCodigoDestino, articuloDescripcionDestino, factor }[]` + `MovimientoStock.subtipo?: 'conversion'` | Tipos viven en `packages/shared/src/types/index.ts`. `Articulo` está en línea 2447; `MovimientoStock` en 2678. Ambos ya tienen el patrón de campos opcionales (`?:` + `null` por convención). Recomendación adicional: agregar `articuloIdDestinoEquivalencia?: string \| null` plano para la query de unicidad — ver "Don't Hand-Roll" / pitfall #2. |
| STKE-02 | `articulosService.linkEquivalencia / unlinkEquivalencia` con validación 1→1 (rechazar self, factor ≤ 0, destino ya tomado, ciclo A→B→A) | `articulosService` ya existe en `stockService.ts:153-303` con shape `getAll/getById/getByCodigo/create/update/deactivate/delete/subscribe/subscribeById`. Hay que agregar `linkEquivalencia` y `unlinkEquivalencia` siguiendo el mismo shape. La validación "destino ya tomado" requiere `where('articuloIdDestinoEquivalencia', '==', destinoId)` — sólo funciona con el campo plano denormalizado, no con el array. |
| STKE-03 | UI de vinculación con `SearchableSelect` de destino + input numérico factor (decimales) | `EditArticuloModal.tsx` (177 LOC, margen 73) — agregar sección "Equivalencia (código de uso)" entre Información general y Otros. Reusar `SearchableSelect` de `components/ui/`. El form-state probablemente vive en `useEditArticuloForm.ts` — extender ahí. Si el modal cruza 250 LOC, extraer `EquivalenciaSection.tsx` separado. |
| STKE-04 | `desagregarUnidades(...)` como `runTransaction` (baja origen + alta destino en misma ubicación + MovimientoStock subtipo=conversion) | Patrón verificado en `reservasService.reservar()` líneas 1120-1189: READ FIRST con `tx.get()`, validar precondiciones, BUILD payloads con `deepCleanForFirestore`, WRITE con `tx.update`/`tx.set`. Auditoría post-tx best-effort. La conversión necesita read N unidades + read articulo destino dentro del tx; ver "Code Examples" abajo. |
| STKE-05 | CTA "Desagregar ahora" en `ArticuloDetail` (cantidad + ubicación + preview `N × factor = M`) | `ArticuloDetail.tsx` está en 177 LOC. Agregar botón cuando `articulo.equivalencias?.length > 0`. Modal nuevo `DesagregarStockModal.tsx` — reusar atoms `Modal`, `Button`, `Input`, `SearchableSelect`. Preview es texto puro derivado de `factor` + `cantidad`. |
| STKE-06 | Display dual en `ArticuloDetail` (siempre visible para origen y destino) | El componente actual de `ArticuloDetail` agrega columnas; la sección dual va dentro del Card de Unidades como una pseudo-fila superior. La detección de "estoy del lado destino" se hace con `where('articuloIdDestinoEquivalencia', '==', currentArticulo.id)` sobre la query plana, devolviendo el artículo origen si existe. Carga adicional de dato pero suma una sola lectura. |
| STKE-07 | Display dual on-demand en lista + SearchableSelect (badge en filas, expansión sólo al buscar uno de los códigos vinculados) | `ArticulosList.tsx` ya usa `useUrlFilters` y `useResizableColumns`. El badge "↔" va en la celda código (text-[10px] teal). La fila expandida sólo se renderiza cuando `search === codigoCompra OR search === codigoUso`. Para `SearchableSelect`, requiere extender `useSearchableSelect` con un concept de `option.linkedOption?` que renderiza una sub-línea cuando matchea el código vinculado. |
</phase_requirements>

## Standard Stack

### Core (sin cambios — todo ya existe)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `firebase/firestore` | ^12.11.0 | `runTransaction`, `Timestamp`, queries | Patrón establecido en Phases 1, 8, 9, 12 |
| `@ags/shared` types | repo-local | `Articulo`, `UnidadStock`, `MovimientoStock`, `TipoMovimiento` | Source of truth de tipos cross-app |
| React 19 + Tailwind | 19.2.3 | UI | Stack del proyecto |
| `react-router-dom` v7 | ^7.12.0 | Routing (ya wired) | `useParams` en `ArticuloDetail` |

### Supporting (helpers existentes que se reusan)
| Helper | Where | Use here |
|--------|-------|----------|
| `deepCleanForFirestore` | `services/firebase.ts:34` (re-exported from `@ags/shared`) | Todo payload con `equivalencias[]` o `MovimientoStock` |
| `cleanFirestoreData` | `services/firebase.ts:24` | Updates flat (ej. limpiar `articuloIdDestinoEquivalencia` a null) |
| `getCreateTrace / getUpdateTrace` | `services/currentUser.ts:14/22` (re-exported via `firebase.ts:353`) | Audit fields en cada write |
| `batchAudit` | `services/firebase.ts:191` | Audit entry en el mismo batch del write |
| `logBusinessEvent` | `services/firebase.ts:319` | Eventos de dominio: `articulo.equivalencia_creada`, `stock.conversion_realizada` |
| `runTransaction` | `firebase/firestore` import | Pattern de Phase 9 reservasService |
| `Timestamp.now()` | `firebase/firestore` import | Único API permitido para timestamps |
| `getOrCreateReservasPosition` | `stockService.ts:133` | Patrón idempotente — referencia para crear "posición de conversión" si hace falta (probablemente NO hace falta: la conversión opera sobre la posición existente de la unidad). |

### Alternatives Considered (rechazadas)
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Campo plano `articuloIdDestinoEquivalencia` + array | Array-only consultado client-side (load all + filter in memory) | El plano permite query indexada en Firestore; el array-only requiere `getAll()` y filtrar — OK para <500 docs pero no escala y arrastra latencia. Verificable post-implementación pero el campo plano es trivial de mantener. |
| Cloud Function para denormalizar `articuloCodigoDestino` cuando cambia el destino | Recompute on update en el cliente | Cloud Function requiere bootstrap de workspace `functions/` (PREC-03 sigue PENDING). El recompute on update es trivial: cuando un artículo cambia su `codigo` o `descripcion`, buscar artículos donde `articuloIdDestinoEquivalencia === id` y actualizar la denormalización. Costo: 1 query extra en `articulosService.update()` cuando los campos cambian. |
| Conversión inversa (uso→compra "rearmar caja") | — | Deferred explícito en CONTEXT.md. v1 sólo `compra→uso`. |

**Installation:** Ninguna nueva dependencia. Todo el stack ya está en `apps/sistema-modular/package.json`.

## Architecture Patterns

### Recommended Code Layout
```
packages/shared/src/types/index.ts
  ├─ Articulo                       # +equivalencias?, +articuloIdDestinoEquivalencia?
  ├─ MovimientoStock                # +subtipo?: 'conversion'
  └─ (nuevo) ArticuloEquivalencia   # interface exportada para el item del array

apps/sistema-modular/src/services/stockService.ts
  └─ articulosService
       ├─ linkEquivalencia(origenId, destinoId, factor)
       ├─ unlinkEquivalencia(origenId)
       └─ desagregarUnidades(input)  # runTransaction

apps/sistema-modular/src/components/stock/
  ├─ EquivalenciaSection.tsx        # nueva, ~100 LOC, montada en EditArticuloModal
  ├─ DesagregarStockModal.tsx       # nueva, ~150 LOC
  └─ EquivalenciaBadge.tsx          # nueva, ~20 LOC (puro presentacional)

apps/sistema-modular/src/pages/stock/
  ├─ ArticuloDetail.tsx             # +sección dual, +CTA Desagregar (delta ~50 LOC)
  └─ ArticulosList.tsx              # +columna badge equivalencia (delta ~20 LOC)

apps/sistema-modular/src/components/ui/SearchableSelect.tsx + useSearchableSelect.ts
  └─ Extender shape de option con linkedCode?: string  # delta ~20 LOC
```

### Pattern 1: Atomic Conversion via runTransaction
**What:** Operación que muta múltiples documentos (unidades origen + unidades destino + movimiento) debe ser atómica.

**When to use:** Cuando una falla parcial dejaría el sistema en estado inconsistente (ej: bajar stock origen sin crear destino → unidades "evaporadas").

**Example (verificado en `stockService.ts:1120-1189`, patrón a replicar):**
```typescript
// Source: apps/sistema-modular/src/services/stockService.ts (reservasService.reservar)
async desagregarUnidades(params: {
  articuloOrigenId: string;
  cantidad: number;                    // unidades del origen a consumir
  ubicacion: UbicacionStock;          // misma posicion para origen y destino
  solicitadoPorNombre: string;
}): Promise<void> {
  // 1) PRE-FETCH (fuera del tx): datos estables o derivados costosos
  const articuloOrigen = await articulosService.getById(params.articuloOrigenId);
  if (!articuloOrigen?.equivalencias?.length) throw new Error('Sin equivalencia configurada');
  const eq = articuloOrigen.equivalencias[0];
  const articuloDestino = await articulosService.getById(eq.articuloIdDestino);
  if (!articuloDestino) throw new Error('Articulo destino no existe');

  // 2) Pre-fetch unidades del origen en la ubicación (lecturas ANTES de tx)
  // Tomar las primeras N disponibles — orden por createdAt para FIFO simple
  const unidadesOrigen = await unidadesService.getByUbicacion(
    params.ubicacion.tipo, params.ubicacion.referenciaId
  );
  const candidatas = unidadesOrigen
    .filter(u => u.articuloId === params.articuloOrigenId && u.estado === 'disponible')
    .slice(0, params.cantidad);
  if (candidatas.length < params.cantidad) {
    throw new Error(`Stock insuficiente: ${candidatas.length} de ${params.cantidad}`);
  }

  // 3) IDs pre-generados (la tx debe ser determinística en sus paths)
  const cantidadDestino = params.cantidad * eq.factor;
  const movId = crypto.randomUUID();
  const nuevasDestinoIds = Array.from({ length: cantidadDestino }, () => crypto.randomUUID());

  await runTransaction(db, async (tx) => {
    // READ FIRST — re-leer cada unidad para validar estado dentro del tx
    const snapshots = await Promise.all(
      candidatas.map(u => tx.get(docRef('unidades', u.id)))
    );
    for (const snap of snapshots) {
      if (!snap.exists()) throw new Error('Unidad desaparecida');
      if (snap.data().estado !== 'disponible') {
        throw new Error('Unidad ya no está disponible (carrera con otro proceso)');
      }
    }

    // BUILD payloads
    const now = Timestamp.now();
    const movPayload = deepCleanForFirestore({
      tipo: 'transferencia' as TipoMovimiento,
      subtipo: 'conversion' as const,            // <-- NUEVO en STKE-01
      unidadId: candidatas[0].id,                // representativa
      articuloId: params.articuloOrigenId,       // origen para queries de histórico
      articuloCodigo: articuloOrigen.codigo,
      articuloDescripcion: articuloOrigen.descripcion,
      cantidad: params.cantidad,
      // referencias del lado destino — siguen el patrón origen/destino del MovimientoStock existente
      origenTipo: params.ubicacion.tipo as TipoOrigenDestino,
      origenId: params.ubicacion.referenciaId,
      origenNombre: params.ubicacion.referenciaNombre,
      destinoTipo: params.ubicacion.tipo as TipoOrigenDestino,
      destinoId: params.ubicacion.referenciaId,
      destinoNombre: params.ubicacion.referenciaNombre,
      // detalles de conversión — campos extra pueden ir al motivo
      motivo: `Conversión ${articuloOrigen.codigo} × ${params.cantidad} → ${articuloDestino.codigo} × ${cantidadDestino} (factor ${eq.factor})`,
      creadoPor: params.solicitadoPorNombre,
      ...getCreateTrace(),
      createdAt: now,
    });

    // WRITE — baja origen (estado='consumido') + alta destino + movimiento
    for (const u of candidatas) {
      tx.update(docRef('unidades', u.id), deepCleanForFirestore({
        estado: 'consumido' as EstadoUnidad,
        ...getUpdateTrace(),
        updatedAt: now.toDate().toISOString(),
      }));
    }
    for (const newId of nuevasDestinoIds) {
      tx.set(docRef('unidades', newId), deepCleanForFirestore({
        articuloId: articuloDestino.id,
        articuloCodigo: articuloDestino.codigo,
        articuloDescripcion: articuloDestino.descripcion,
        condicion: 'nuevo' as CondicionUnidad,
        estado: 'disponible' as EstadoUnidad,
        ubicacion: params.ubicacion,
        activo: true,
        ...getCreateTrace(),
        createdAt: now.toDate().toISOString(),
        updatedAt: now.toDate().toISOString(),
      }));
    }
    tx.set(docRef('movimientosStock', movId), movPayload);
  });

  // Audit post-tx best-effort (mismo patrón que reservar/liberar)
  logBusinessEvent({
    eventName: 'stock.conversion_realizada',
    collection: 'movimientos_stock',
    documentId: movId,
    details: {
      articuloOrigenId: params.articuloOrigenId,
      articuloDestinoId: articuloDestino.id,
      cantidadOrigen: params.cantidad,
      cantidadDestino,
      factor: eq.factor,
    },
  });
}
```

**Punto sutil:** En el codebase actual, cada `UnidadStock` representa una **unidad física individual** (cantidad implícita = 1 por documento; ver `MovimientoStock.cantidad: 1` en `reservar()`). Para desagregar "5 unidades de origen → 50 unidades destino", se ejecutan 5 updates `estado: 'consumido'` + 50 `tx.set` de nuevas `unidades`. Confirmar este modelo con el user es prudente — pero la evidencia del código (líneas 1162-1184) es clara: una unidad = un documento.

### Pattern 2: 1→1 Validation Inside link
**What:** Tres validaciones cruzadas antes de aceptar un `link`.

**Example:**
```typescript
async linkEquivalencia(origenId: string, destinoId: string, factor: number): Promise<void> {
  if (origenId === destinoId) throw new Error('No puede vincularse consigo mismo');
  if (!isFinite(factor) || factor <= 0) throw new Error('Factor debe ser > 0');

  // 1) Origen no debe tener equivalencia previa
  const origen = await articulosService.getById(origenId);
  if (!origen) throw new Error('Artículo origen no existe');
  if ((origen.equivalencias?.length ?? 0) > 0) {
    throw new Error('Este artículo ya tiene una equivalencia configurada');
  }

  // 2) Destino no debe ser ya destino de otro origen — query plana
  const conflictos = await getDocs(query(
    collection(db, 'articulos'),
    where('articuloIdDestinoEquivalencia', '==', destinoId),
  ));
  if (!conflictos.empty) {
    throw new Error(`Destino ya vinculado por ${conflictos.docs[0].data().codigo}`);
  }

  // 3) Anti-ciclo: en 1→1 estricto, sólo falla si destino apunta a origen
  const destino = await articulosService.getById(destinoId);
  if (!destino) throw new Error('Artículo destino no existe');
  if (destino.articuloIdDestinoEquivalencia === origenId) {
    throw new Error('Ciclo detectado: el destino ya apunta al origen');
  }

  // OK — escribir ambos campos en el mismo update
  await articulosService.update(origenId, {
    equivalencias: [{
      articuloIdDestino: destino.id,
      articuloCodigoDestino: destino.codigo,
      articuloDescripcionDestino: destino.descripcion,
      factor,
    }],
    articuloIdDestinoEquivalencia: destino.id,
  });

  logBusinessEvent({
    eventName: 'articulo.equivalencia_creada',
    collection: 'articulos',
    documentId: origenId,
    details: { articuloIdDestino: destinoId, factor },
  });
}
```

### Pattern 3: Display Dual con `Articulo.articuloIdDestinoEquivalencia`
**What:** Mostrar la "fila opuesta" sin un join client-side caro.

**Example (en ArticuloDetail):**
```typescript
// Adentro del componente, después de cargar articulo
const equivalente = useMemo<EquivalenteInfo | null>(() => {
  if (articulo.equivalencias?.[0]) {
    // Estoy en compra; el destino es lado de uso
    const eq = articulo.equivalencias[0];
    return {
      lado: 'destino',
      articuloId: eq.articuloIdDestino,
      codigo: eq.articuloCodigoDestino,
      factor: eq.factor,
    };
  }
  return null;
}, [articulo]);

// Si NO tengo equivalencias pero soy destino de alguien:
useEffect(() => {
  if (!equivalente) {
    // 1 query plana — eficiente con índice
    articulosService.findOrigenDeDestino(id).then(setEquivalenteReverso);
  }
}, [equivalente, id]);
```

### Anti-Patterns to Avoid
- **Query "in-memory" sobre todos los artículos para chequear unicidad de destino**: cargar `getAll()` cada vez que se valida un link es un anti-patrón aceptable para 100 artículos pero deja deuda al crecer. El campo plano es trivial — agregarlo desde el día 1.
- **Mutar `MovimientoStock.tipo` para diferenciar conversion**: rompe el contrato existente (todas las queries `where('tipo', '==', 'transferencia')` perderían las conversiones). Usar `subtipo` opcional.
- **Modal "Desagregar" que recalcula stock disponible al abrir cada vez**: tomar el snapshot al abrir + validar dentro del `runTransaction`. La carrera entre apertura y commit se gestiona por la validación read-first del tx.
- **Crear un componente `ArticuloDetailWithEquivalencia` paralelo**: extender el existente. El delta es ~50 LOC y se mantiene bajo 250.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Race condition entre dos usuarios desagregando simultáneamente | Lock client-side / "flag" en el doc | `runTransaction` con read-first | Phase 9 ya estableció el patrón en `reservasService.reservar()`; Firestore lo garantiza atómicamente |
| Audit del movimiento | Custom audit collection | `batchAudit` + `logBusinessEvent` | Ya existen y son la convención de toda la app |
| Refresh de la denormalización al renombrar destino | Cloud Function trigger | Recompute on update en `articulosService.update()` | PREC-03 (bootstrap `functions/`) está pending; resolverlo client-side es ~10 líneas |
| Query "destino ya tomado" en array-of-maps | Custom array iteration / cargar todos los artículos | Campo plano `articuloIdDestinoEquivalencia` + `where('articuloIdDestinoEquivalencia', '==', X)` | **Firestore NO soporta `array-contains` sobre un campo dentro de un objeto del array** — verificado en docs oficiales |
| Generación de IDs de unidad | Sequence counter | `crypto.randomUUID()` | Es la convención de todo el codebase (ver `stockService.ts:209, 376, 716`) |
| Numeración del movimiento | Sequence | `crypto.randomUUID()` | `movimientosStock` no tiene número humano; sólo timestamps |
| "Posición de conversión" tipo `RESERVAS` | Crear `getOrCreateConversionPosition()` | Operar sobre la misma `ubicacion` del origen | Decisión locked: la conversión NO mueve entre ubicaciones |

**Key insight:** Todo lo que hace falta ya está construido (audit, runTransaction, deepCleanForFirestore, getCreateTrace, atoms UI). El plan es ensamblar — no inventar nuevos primitivos.

## Common Pitfalls

### Pitfall 1: Firestore no permite `array-contains` sobre campo dentro de array-of-maps
**What goes wrong:** Si se intenta `where('equivalencias.articuloIdDestino', '==', X)` sobre `Articulo.equivalencias`, la query no devuelve resultados (Firestore no soporta esa proyección; sólo `array-contains` con el objeto exacto serializado, que requiere conocer factor + denormalizaciones).
**Why it happens:** Restricción documentada de Firestore — array-contains compara objetos completos por equality, no por propiedades específicas. Issue [firebase/firebase-js-sdk#8037](https://github.com/firebase/firebase-js-sdk/issues/8037) lo confirma.
**How to avoid:** Persistir un campo plano top-level `articuloIdDestinoEquivalencia?: string | null` en el `Articulo` además del array. Mantenerlo en sync con `equivalencias[0]?.articuloIdDestino` siempre que se hace `linkEquivalencia` / `unlinkEquivalencia`. Query indexable: `where('articuloIdDestinoEquivalencia', '==', destinoId)`.
**Warning signs:** Si el plan dice "consultar el array directamente" sin un campo denormalizado plano → revisar antes de implementar. Si la validación de unicidad pasa pero en producción permite dos vínculos al mismo destino → este es el bug.

### Pitfall 2: Cantidad ≠ documento — UnidadStock es atómico
**What goes wrong:** Tratar `desagregar 5 unidades` como un update de `cantidad: 5` cuando el modelo es **1 documento por unidad física** (ver `MovimientoStock.cantidad: 1` en `reservasService.reservar()` línea 1168 y el patrón completo de `unidadesService`).
**Why it happens:** El nombre `cantidad` en `MovimientoStock` sugiere agregado, pero en el codebase actual es siempre 1 por documento; el conteo se hace agregando docs.
**How to avoid:** `desagregarUnidades(5)` = leer 5 docs de `unidades` con `estado='disponible'` + transición a `estado='consumido'`. Crear `5 × factor` documentos nuevos en `unidades` con `estado='disponible'`. **Confirmar con el user en planning** que este modelo es correcto antes de cementar el plan (el user puede preferir un modelo agregado a futuro, pero la convención actual del repo es atómico).
**Warning signs:** Si una "alta destino" en el código se hace via `tx.update(articulos/X, {cantidad: increment(N)})` → eso NO es el patrón actual.

### Pitfall 3: Read-After-Write Inside runTransaction
**What goes wrong:** Hacer reads después de un write dentro del tx — Firestore lo prohíbe y la transaction falla.
**Why it happens:** Patrón natural "leer destino → leer stock → escribir" si no se respeta el orden.
**How to avoid:** Seguir el patrón verbatim de `reservar()`: TODAS las reads primero (incluso si requieren n lecturas), luego TODOS los writes. Las reads costosas (lookup del articulo destino, validación de equivalencia) van fuera del tx (pre-fetch) si son datos estables. Sólo las reads que necesitan ser leídas atómicamente con el write van adentro.
**Warning signs:** Error "Firestore transactions require all reads to be executed before all writes" en runtime.

### Pitfall 4: Componentes que cruzan 250 LOC al agregar features
**What goes wrong:** `EditArticuloModal` está en 177 LOC; agregar la sección de equivalencia inline lo va a empujar cerca o sobre 250. Igual pasa con `ArticuloDetail` (177 LOC) cuando se le agrega la sección dual + el botón "Desagregar".
**Why it happens:** Plan natural "agregar inline" si no se prevé el extract.
**How to avoid:** Plan obligatorio: `EquivalenciaSection.tsx` (`components/stock/`) como subcomponente independiente desde el día 1. Lo mismo `DesagregarStockModal.tsx`. Hook `useEquivalencia(articulo)` si la lógica del data-fetch del destino crece (probablemente alcanza con un useEffect inline). Ver regla `.claude/rules/components.md`.
**Warning signs:** Hook `check-component-size` warn al editar; cualquier `.tsx` por encima de 230 LOC durante el plan ya debería ser candidato a split.

### Pitfall 5: `MovimientoStock` shape mismatch
**What goes wrong:** El shape actual de `MovimientoStock` tiene `unidadId` (singular). Una conversión genera N+M unidades involucradas. Forzar `unidadId` a una sola rompe el principio "log inmutable de auditoría".
**Why it happens:** Pensar que el movimiento debe registrar todas las unidades cuando históricamente registra una representativa + agregado en `cantidad`.
**How to avoid:** Para la conversión, `unidadId` puede ser la primera del origen (referencia) + `cantidad` es la del origen. El nuevo `subtipo: 'conversion'` + `motivo` con el detalle ("conversión X×5 → Y×50 (factor 10)") + `articuloDestinoId` en un campo nuevo opcional son los puntos de extensión. **Discutir con el user el shape exacto** en planning — pero la convención existente da pistas: `MovimientoStock` es log + audit, no historial 1:1 con unidades.
**Warning signs:** Si el plan dice "crear N MovimientoStock, uno por unidad" → eso multiplica la colección sin valor agregado; un movimiento por conversión alcanza.

### Pitfall 6: SearchableSelect mezcla codigo de compra y uso como dos filas
**What goes wrong:** Si la lista de opciones se genera con `articulos.map(a => ({ value: a.id, label: a.codigo }))`, el código de compra `5183-2209` y el código de uso `5188-5367` aparecen como **dos filas separadas** al buscar — el user no ve que son el mismo "par".
**How to avoid:** Pre-procesar la lista de artículos antes de pasarla al SearchableSelect: si dos artículos están vinculados, mostrar SÓLO uno (el lado más relevante, e.g. compra si tiene stock, sino uso) o mostrar uno con `linkedCode` extra. Documentar en plan que el behavior del SearchableSelect cambia: una sola entry para un par. Requiere extender `useSearchableSelect` para que matchee SI el query coincide con `option.value`, `option.label`, O `option.linkedCode`.
**Warning signs:** Buscar el código de uso devuelve dos resultados separados — bug.

## Code Examples

Verified patterns from the existing codebase:

### Service method shape (articulosService extension)
```typescript
// Source: apps/sistema-modular/src/services/stockService.ts:208 (template)
async linkEquivalencia(origenId: string, destinoId: string, factor: number): Promise<void> {
  // ... validaciones (ver Pattern 2) ...
  const destino = await articulosService.getById(destinoId);
  await articulosService.update(origenId, {
    equivalencias: [{
      articuloIdDestino: destino.id,
      articuloCodigoDestino: destino.codigo,
      articuloDescripcionDestino: destino.descripcion,
      factor,
    }],
    articuloIdDestinoEquivalencia: destino.id,
  });
  // Note: update() ya usa deepCleanForFirestore + getUpdateTrace + batchAudit
  logBusinessEvent({
    eventName: 'articulo.equivalencia_creada',
    collection: 'articulos',
    documentId: origenId,
    details: { articuloIdDestino: destinoId, factor },
  });
},

async unlinkEquivalencia(origenId: string): Promise<void> {
  await articulosService.update(origenId, {
    equivalencias: [],                          // se persiste como array vacío
    articuloIdDestinoEquivalencia: null,        // limpiar campo plano
  });
  logBusinessEvent({
    eventName: 'articulo.equivalencia_eliminada',
    collection: 'articulos',
    documentId: origenId,
  });
},
```

### Cycle detection (1→1 simplified)
```typescript
// En 1→1 estricto, el único ciclo posible es A→B→A (longitud 2).
// Para extensiones futuras (N→M, multi-paso), generalizar a DFS.
function detectaCiclo1to1(destino: Articulo, origenId: string): boolean {
  return destino.articuloIdDestinoEquivalencia === origenId;
}
```

### Find origen-de-destino (para display dual del lado uso)
```typescript
// articulosService nuevo método
async findOrigenDeDestino(destinoId: string): Promise<Articulo | null> {
  const snap = await getDocs(query(
    collection(db, 'articulos'),
    where('articuloIdDestinoEquivalencia', '==', destinoId),
    where('activo', '==', true),
  ));
  if (snap.empty) return null;
  const d = snap.docs[0];
  return {
    id: d.id,
    ...d.data(),
    createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
  } as Articulo;
},
```

### Recompute denormalización al renombrar destino
```typescript
// En articulosService.update(), antes del write:
async update(id: string, data: Partial<Omit<Articulo, 'id' | 'createdAt'>>): Promise<void> {
  // ... actual implementation ...

  // POST-WRITE: si codigo o descripcion cambiaron, recompute la denormalización
  // en los artículos que apuntan a este como destino
  const codigoChanged = data.codigo !== undefined;
  const descChanged = data.descripcion !== undefined;
  if (codigoChanged || descChanged) {
    const fresh = await this.getById(id);
    if (!fresh) return;
    const dependientesSnap = await getDocs(query(
      collection(db, 'articulos'),
      where('articuloIdDestinoEquivalencia', '==', id),
    ));
    const batch = createBatch();
    for (const d of dependientesSnap.docs) {
      const eqs = d.data().equivalencias as ArticuloEquivalencia[] | undefined;
      if (!eqs?.length) continue;
      const updated = eqs.map(e => e.articuloIdDestino === id
        ? { ...e, articuloCodigoDestino: fresh.codigo, articuloDescripcionDestino: fresh.descripcion }
        : e
      );
      batch.update(docRef('articulos', d.id), deepCleanForFirestore({
        equivalencias: updated,
        ...getUpdateTrace(),
        updatedAt: Timestamp.now(),
      }));
    }
    await batch.commit();
  }
},
```

### SearchableSelect extension (option shape)
```typescript
// Extender option shape — el plan debe documentar el delta
export interface SearchableSelectOptionExtended {
  value: string;
  label: string;
  linkedCode?: string;       // código del par vinculado (e.g., el código de uso si esto es compra)
  badgeText?: string;        // e.g., '↔ tiene equivalente'
}

// useSearchableSelect: extender el filter
const filtered = allOptions.filter(opt =>
  opt.label.toLowerCase().includes(q) ||
  opt.value.toLowerCase().includes(q) ||
  (opt.linkedCode && opt.linkedCode.toLowerCase().includes(q))
);
```

## State of the Art

| Old Approach (proyecto) | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `MovimientoStock` sólo en `cantidad: 1` por documento | Misma convención + `subtipo` opcional para refinar | Phase 13 (este) | Backwards-compat total; consumidores existentes no se enteran |
| Sin equivalencias entre artículos | Vinculación 1→1 explícita | Phase 13 (este) | Habilita conversión diferida; abre puerta a Phase 14 (patrones) |
| Stock view colapsa por artículo | Stock view por artículo + badge "tiene equivalente" + expansión on-search | Phase 13 (este) | UX no cambia para artículos sin equivalencia; los pares se descubren bajo búsqueda |

**Deprecated/outdated:**
- Ninguna feature actual es reemplazada. Phase 13 es estrictamente aditivo.

## Open Questions

1. **¿Una unidad = un documento, o agregado por artículo+ubicación?**
   - What we know: el patrón actual en `reservasService.reservar()` (línea 1168) trata cada `UnidadStock` como atómica (cantidad implícita 1, identidad por documento). Los `MovimientoStock` se crean uno por unidad cuando se mueve entre ubicaciones.
   - What's unclear: para desagregar "5 cajas → 50 ampollas", el patrón natural es generar 50 docs nuevos en `unidades`. Eso multiplica la colección. Si el user en realidad quiere agregar por artículo+ubicación, el modelo cambia drásticamente.
   - Recommendation: **planificar bajo el modelo actual (1 doc = 1 unidad)** pero abrir esto como pregunta al user en el primer plan. Si responde "agregar", refactor del modelo > scope de esta phase.

2. **¿Audit del MovimientoStock vs N movimientos individuales?**
   - What we know: un `MovimientoStock.cantidad` puede valer N > 1 (el schema lo permite). La conversión natural es **un solo `MovimientoStock` con `cantidad: cantidadOrigen` y `subtipo: 'conversion'`**.
   - What's unclear: ¿el user quiere ver "convertí 5 cajas" como un evento, o "convertí 5 cajas en 50 ampollas" desglosado en cada una de las 50 unidades? El primer enfoque (un movimiento) es el natural; el segundo crea ruido en el histórico.
   - Recommendation: **un solo `MovimientoStock`** + el `motivo` con el detalle ("X×5 → Y×50, factor 10"). Si el user quiere ver el detalle por unidad, las nuevas `unidades` ya quedan creadas con `createdAt` del momento de conversión y son consultables.

3. **¿`articuloDestinoId` debería ir como campo top-level en `MovimientoStock` para que el subtipo conversion sea queriable por destino?**
   - What we know: `MovimientoStock` actual tiene `articuloId` (origen, denormalizado de la unidad). No tiene `articuloDestinoId` porque "transferencia entre ubicaciones" no cambia el artículo.
   - What's unclear: si el user quiere filtrar histórico de movimientos del lado destino ("cuándo se generaron las ampollas"), necesitamos query por `articuloDestinoId`. Opciones: agregar campo opcional `articuloDestinoId?: string | null`, o derivar al consultar (slower).
   - Recommendation: **agregar `articuloDestinoId?: string | null` + `articuloDestinoCodigo?: string | null`** opcionales sólo cuando `subtipo === 'conversion'`. Trivial, queriable, backwards-compat.

4. **¿Mostrar el CTA "Desagregar ahora" SOLO en el lado de compra, o también en el lado de uso (con texto "Hay X cajas sin desagregar")?**
   - What we know: el formato del display dual en CONTEXT.md menciona el CTA en el bloque inferior — donde está el stock de compra.
   - What's unclear: si el user busca el código de uso y ve "+ 2 cajas sin desagregar (= 20 potenciales)", probablemente quiere clickear "desagregar" desde ahí mismo.
   - Recommendation: **el CTA siempre actúa sobre el artículo origen (lado compra)**, pero estar visible en ambos lados del display dual. Texto del botón puede ser identico ("Desagregar ahora") porque la acción es la misma.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:assert/strict` ejecutado via `tsx` (sin framework instalado — patrón establecido en Phase 9 y Phase 12) |
| Config file | none — los tests son scripts `.ts` standalone; package.json `test:*` scripts |
| Quick run command | `pnpm --filter @ags/sistema-modular test:equivalencias` (a crear en Wave 0) |
| Full suite command | `pnpm --filter @ags/sistema-modular test:equivalencias && pnpm --filter @ags/sistema-modular e2e -g equivalencias` |

**E2E framework:** Playwright (`@playwright/test ^1.59.1`) — config en `apps/sistema-modular/playwright.config.ts`. Specs en `apps/sistema-modular/e2e/`. Patrón fixme establecido en Phase 12 para Wave 0 RED baseline.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STKE-01 | Tipos compilan; `Articulo.equivalencias?` y `MovimientoStock.subtipo?` son aceptados por TypeScript en el shape contractual | unit (type-level) | `tsc --noEmit -p packages/shared` + `tsc --noEmit -p apps/sistema-modular` (manual; no `type-check` script root para sistema-modular) | ❌ Wave 0 — crear `test:equivalencias` que ejerce import + shape assertions |
| STKE-02a | `linkEquivalencia` rechaza self-link | unit (pure validation, sin Firestore) | `pnpm --filter @ags/sistema-modular test:equivalencias` | ❌ Wave 0 |
| STKE-02b | `linkEquivalencia` rechaza factor ≤ 0 / NaN / Infinity | unit | mismo | ❌ Wave 0 |
| STKE-02c | `linkEquivalencia` rechaza origen ya vinculado | unit (DI Firestore como en stockAmplio.test.ts) | mismo | ❌ Wave 0 |
| STKE-02d | `linkEquivalencia` rechaza destino ya tomado por otro | unit (DI) | mismo | ❌ Wave 0 |
| STKE-02e | `linkEquivalencia` rechaza ciclo A→B→A | unit (DI) | mismo | ❌ Wave 0 |
| STKE-02f | `unlinkEquivalencia` limpia ambos campos (`equivalencias`, `articuloIdDestinoEquivalencia`) | unit (DI) | mismo | ❌ Wave 0 |
| STKE-03 | UI: sección equivalencia en EditArticuloModal renderiza con SearchableSelect + factor input | E2E smoke (Playwright) | `pnpm --filter @ags/sistema-modular e2e -g "equivalencia.*edit"` | ❌ Wave 0 — spec `e2e/equivalencias.spec.ts` con `test.fixme` baseline |
| STKE-04a | `desagregarUnidades(5)` baja 5 unidades del origen y crea 5×factor en destino, en una sola tx | unit (DI Firestore + tx mock) | `pnpm --filter @ags/sistema-modular test:equivalencias` | ❌ Wave 0 |
| STKE-04b | `desagregarUnidades` falla atómicamente si no hay stock suficiente (no escribe nada) | unit (DI) | mismo | ❌ Wave 0 |
| STKE-04c | `desagregarUnidades` crea exactamente UN `MovimientoStock` con `subtipo: 'conversion'` | unit (DI) | mismo | ❌ Wave 0 |
| STKE-05 | Modal "Desagregar ahora" valida cantidad ≤ stock disponible | E2E smoke | `pnpm --filter @ags/sistema-modular e2e -g "desagregar"` | ❌ Wave 0 |
| STKE-06 | ArticuloDetail muestra display dual visible siempre (lado origen Y lado destino) | E2E smoke + manual visual (DETAIL_SCREENSHOT_CHECKPOINT) | mismo | ❌ Wave 0 |
| STKE-07 | ArticulosList muestra badge ↔ en filas vinculadas; expansión sólo al matchear código | E2E smoke (Playwright snapshot + interaction) | `pnpm --filter @ags/sistema-modular e2e -g "lista.*equivalencia"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @ags/sistema-modular test:equivalencias` (unit, < 5s)
- **Per wave merge:** `test:equivalencias && e2e -g equivalencias` (~30s)
- **Phase gate:** Full suite green + manual UAT del display dual (visual checkpoint con user, mismo patrón de Phase 12 plan 12-06)

### Wave 0 Gaps
- [ ] `apps/sistema-modular/src/services/__tests__/equivalencias.test.ts` — unit tests STKE-02 + STKE-04 con DI Firestore (patrón de `stockAmplio.test.ts`)
- [ ] `apps/sistema-modular/src/services/__tests__/fixtures/equivalencias.ts` — fixtures para los casos (happy, self-link, destino-tomado, ciclo, stock-insuficiente)
- [ ] `apps/sistema-modular/e2e/equivalencias.spec.ts` — E2E specs con `test.fixme` baseline (RED until Wave 1-3)
- [ ] Script en `package.json`: `"test:equivalencias": "tsx src/services/__tests__/equivalencias.test.ts"`
- [ ] (Opcional) Helper `apps/sistema-modular/e2e/helpers/equivalencias.ts` para crear pares vinculados via Firestore Admin en setup

*(El framework existe ya; no hay nada que instalar.)*

## Sources

### Primary (HIGH confidence)
- `apps/sistema-modular/src/services/stockService.ts` líneas 153-303 (articulosService shape), 563-691 (movimientosService), 1113-1262 (reservasService runTransaction patron)
- `apps/sistema-modular/src/services/firebase.ts` líneas 24-34 (cleanFirestoreData/deepCleanForFirestore), 134-153 (logAudit), 191-197 (batchAudit), 319-350 (logBusinessEvent)
- `apps/sistema-modular/src/services/currentUser.ts` (getCreateTrace/getUpdateTrace shape)
- `packages/shared/src/types/index.ts` líneas 2447-2702 (Articulo, UnidadStock, MovimientoStock current shape)
- `apps/sistema-modular/src/pages/stock/ArticuloDetail.tsx` (177 LOC actuales)
- `apps/sistema-modular/src/pages/stock/ArticulosList.tsx` (401 LOC — sobre presupuesto pero ya existe; no agregar más sin extract)
- `apps/sistema-modular/src/components/stock/EditArticuloModal.tsx` (177 LOC — margen para extender)
- `apps/sistema-modular/src/components/ui/SearchableSelect.tsx` + `useSearchableSelect.ts` (shape de option, filter logic)
- `apps/sistema-modular/src/services/__tests__/stockAmplio.test.ts` (patrón DI test sin framework)
- `.planning/phases/13-stock-equivalencias-compra-uso/13-CONTEXT.md` (decisiones locked del user)
- `.claude/rules/firestore.md`, `.claude/rules/components.md`, `.claude/rules/reportes-ot.md` (project invariants)
- `.claude/skills/list-page-conventions/SKILL.md` (convención de lista — aplica a ArticulosList)

### Secondary (MEDIUM confidence)
- `apps/sistema-modular/e2e/stock-reserva-concurrent.spec.ts` (patrón E2E de Phase 9 — referencia, no leído en detalle pero confirma stack)
- `apps/sistema-modular/package.json` (scripts test:*, dependencias)

### Tertiary (LOW confidence — needs validation in plan)
- [Firestore array-contains limitation con array-of-maps](https://github.com/firebase/firebase-js-sdk/issues/8037) — confirma la necesidad del campo plano denormalizado para query. Verificado via WebSearch.
- [Firestore queries documentation](https://firebase.google.com/docs/firestore/query-data/queries) — confirma operadores soportados.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — todas las piezas ya están en el codebase; cero dependencias nuevas
- Architecture: HIGH — patrones replicados verbatim de Phase 9 (`reservasService.reservar()`)
- Pitfalls: HIGH — los 6 pitfalls documentados están verificados en código o en docs oficiales de Firestore
- Validation: HIGH — el framework de test ya existe (Node assert + tsx + Playwright), el patrón Wave 0 RED está establecido en Phases 9 y 12

**Open questions confidence:** los 4 puntos en "Open Questions" requieren confirmación del user al inicio del primer plan; preferí el modelo que matchea el codebase actual y dejarlo explícito para evitar refactor mid-plan.

**Research date:** 2026-05-15
**Valid until:** 30 días (stack estable Firebase + React; sólo invalidaría si el user redefine el modelo de `UnidadStock`)
