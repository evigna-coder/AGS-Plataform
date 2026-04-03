# Phase 2: Comex — Importaciones y Despachos - Research

**Researched:** 2026-04-03
**Domain:** Comercio exterior — OC→Importación link, estado tracking con campos obligatorios, gastos prorrateados, alta de stock al recibir, cierre de requerimientos
**Confidence:** HIGH

## Summary

La capa de infraestructura está completamente montada desde Phase 1: `unidadesService.create()`, `movimientosService.create()`, `requerimientosService.update()` y `importacionesService` CRUD existen y funcionan con el patrón `deepCleanForFirestore + createBatch + batchAudit`. Las páginas `ImportacionesList`, `ImportacionEditor` e `ImportacionDetail` y sus siete subcomponentes (sidebar, embarque, aduana, VEP, gastos, documentos, status transition) están creados pero son MVP incompletos: faltan la gestión de ítems por embarque, la lógica de validación de campos obligatorios por estado, el badge ETA vencida, el botón "Crear Importación" en OCDetail, y el flujo completo de ingreso de stock.

El único cambio de tipo requerido es agregar `numeroGuia?: string | null` y `items?: ItemImportacion[] | null` a `Importacion` en `packages/shared`, y diseñar el nuevo tipo `ItemImportacion`. La interface `Importacion` actualmente no tiene ningún array de ítems. El campo `OrdenCompra.importacionId` es un escalar; la relación 1-OC-muchas-Importaciones se resuelve por query (FK en `Importacion.ordenCompraId`), sin modificar el tipo `OrdenCompra`.

La fase tiene ocho tareas identificables: (1) extensión de tipos shared, (2) extensión del editor para crear con ítems, (3) integración en OCDetail, (4) migración de filtros a `useUrlFilters` + badge ETA, (5) validación de campos obligatorios en `ImportacionStatusTransition`, (6) agregar `numeroGuia` al `ImportacionAduanaSection`, (7) subcomponente `ImportacionItemsSection`, (8) flujo "Ingresar al stock" con prorrateo de gastos y cierre de requerimientos.

**Primary recommendation:** Seguir el patrón de Phase 1 exactamente — toda mutación de stock usa `deepCleanForFirestore + createBatch + batchAudit`, los filtros usan `useUrlFilters`, y el flujo de alta de stock es idéntico al de reservas (batch atómico: N `unidades.set` + N `movimientosStock.set` + M `requerimientos.update`).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**OC → Importación: origen y estructura**
- La Importación se crea desde el **detalle de la OC** cuando su tipo es `'importacion'` — botón "Crear Importación" en el OCDetail
- **1 OC puede tener múltiples Importaciones** (embarques parciales)
- Cada importación lleva sus **propios ítems** (subconjunto de los ítems de la OC) — el operador elige qué artículos y cantidades van en ese embarque al crear la importación
- Esto permite trackear recepciones parciales del mismo artículo en distintos embarques

**Tracking de estados y alertas**
- Estados (en orden): `preparacion → embarcado → en_transito → en_aduana → despachado → recibido` — flujo confirmado, no se modifica
- **Campos mínimos obligatorios por estado** (no se puede avanzar sin ellos):
  - `embarcado`: fecha de embarque + número de booking
  - `en_aduana`: fecha de arribo real
  - `despachado`: número DUA (`despachoNumero`)
  - `recibido`: fecha de recepción
  - Resto de transiciones: libres
- **Alerta de ETA vencida**: badge visual en la lista de importaciones cuando `fechaEstimadaArribo` pasó y el estado aún no es `recibido` ni `cancelado`

**DUA y gastos de importación**
- Campos del despacho: `despachoNumero` + `fechaDespacho` + `despachante` + **`numeroGuia`** (campo nuevo a agregar al tipo `Importacion`)
- Los gastos se **distribuyen en el costo unitario** de los artículos
- Método de prorrateo: **por valor proporcional** — cada ítem absorbe el % del gasto según su valor relativo respecto al total de la importación
- El costo unitario calculado (precio OC + gastos prorrateados) se almacena en la `UnidadStock` al hacer el alta

**Alta de stock al recibir**
- Flujo: importación llega a estado `recibido` → aparece botón **"Ingresar al stock"** en el ImportacionDetail
- El formulario de recepción por ítem permite ingresar:
  - Posición de depósito destino (SearchableSelect de posiciones existentes, excluyendo RESERVAS)
  - Números de serie (si el artículo los requiere) — uno por unidad
  - Cantidad real recibida (puede diferir de la cantidad pedida)
- El sistema crea las `UnidadStock` correspondientes y un `MovimientoStock` tipo `ingreso` por cada unidad
- **Cierre automático de requerimientos**: al ingresar el stock, el sistema busca requerimientos en estado `en_compra` vinculados a esa OC. Si cantidad recibida >= cantidad del req → req pasa a `completado`

### Claude's Discretion
(Ningún área marcada explícitamente; arquitectura de subcomponentes y hooks está a discreción del implementador)

### Deferred Ideas (OUT OF SCOPE)
- **Portal del proveedor** — que el proveedor confirme/actualice el estado del embarque digitalmente
- **Notificaciones activas** (email/push) por ETA vencida o cambio de estado
- **Integración con sistemas aduaneros** o plataformas de tracking de contenedores
- **Canal de selectividad / valor FOB declarado**
</user_constraints>

---

## Standard Stack

### Core (ya presente en el proyecto — HIGH confidence)

| Library / Pattern | Version / Origen | Proposito | Por que es el estandar |
|---|---|---|---|
| Firebase Firestore SDK v9 | modular | Persistence | Toda la app usa este SDK |
| `deepCleanForFirestore()` | `services/firebase.ts` | Limpiar undefined en estructuras nested | Hard rule — para nested usar esta, no `cleanFirestoreData()` |
| `createBatch() + batchAudit()` | `services/firebase.ts` | Escrituras atomicas + audit trail | Patron obligatorio para mutaciones |
| `useUrlFilters` | `hooks/useUrlFilters.ts` | Filtros persistidos en URL | Hard rule: nunca `useState` para filtros de lista |
| `SearchableSelect` | `components/ui/SearchableSelect` | Selects con busqueda | Patron establecido para posiciones, articulos |
| `Modal` | `components/ui/Modal` | Modales draggables con header teal | Todos los flujos de edicion inline |
| `Card` | `components/ui/Card` | Secciones editable-en-sitio | Todas las secciones del detail ya lo usan |

### Servicios relevantes disponibles (HIGH confidence)

| Servicio | Archivo | Firma clave |
|---|---|---|
| `importacionesService.create()` | `importacionesService.ts` | `Omit<Importacion, 'id' \| 'numero' \| 'createdAt' \| 'updatedAt'>` → `Promise<string>` |
| `importacionesService.update()` | `importacionesService.ts` | `(id, Partial<Importacion>)` — convierte dateFields a Timestamp |
| `importacionesService.getAll()` | `importacionesService.ts` | `{ estado?: string }` filter, ordena `createdAt desc` |
| `unidadesService.create()` | `stockService.ts` | `Omit<UnidadStock, 'id' \| 'createdAt' \| 'updatedAt'>` → `Promise<string>` — usa `deepCleanForFirestore` internamente |
| `movimientosService.create()` | `stockService.ts` | `Omit<MovimientoStock, 'id' \| 'createdAt'>` → inmutable, nunca update/delete |
| `requerimientosService.update()` | `importacionesService.ts` | `(id, Partial<RequerimientoCompra>)` → para setear `estado: 'completado'` |
| `posicionesStockService.getAll()` | `stockService.ts` | `activoOnly: boolean` — filtrar codigo `'RESERVAS'` en selector destino |
| `ordenesCompraService.getAll()` | via barrel `firebaseService.ts` | `{ tipo?: string }` — filtrar `tipo: 'importacion'` |

### Tipos criticos (HIGH confidence)

| Tipo | Ubicacion (linea) | Estado |
|---|---|---|
| `Importacion` | `packages/shared/src/types/index.ts:2322` | Completo — falta `numeroGuia`, `items`, `fechaRecepcion`, `stockIngresado` |
| `ItemOC` | `:827` | Completo — tiene `articuloId`, `articuloCodigo`, `descripcion`, `cantidad`, `cantidadRecibida`, `precioUnitario`, `moneda`, `requerimientoId` |
| `OrdenCompra` | `:841` | Tiene `items: ItemOC[]` y `importacionId?: string \| null` (escalar — no array) |
| `GastoImportacion` | `:2312` | Completo — `id, concepto, descripcion, monto, moneda, fecha, comprobante` |
| `UnidadStock` | `:1693` | Completo — tiene `costoUnitario`, `monedaCosto`, `ubicacion`, `nroSerie` |
| `MovimientoStock` | `:1845` | Completo — tipo `'ingreso'` existe en `TipoMovimiento` |
| `TipoMovimiento` | `:1833` | `'ingreso' \| 'egreso' \| 'transferencia' \| 'consumo' \| 'devolucion' \| 'ajuste'` |
| `TipoOrigenDestino` | `:1835` | incluye `'posicion'` y `'proveedor'` — ambos necesarios para el movimiento de entrada |
| `ItemImportacion` | — | **NO EXISTE** — debe crearse (ver diseno abajo) |

**Instalacion:** no requiere dependencias nuevas.

---

## Architecture Patterns

### Estructura de archivos relevante

```
packages/shared/src/types/index.ts
  # agregar: ItemImportacion, + campos en Importacion (numeroGuia, items, fechaRecepcion, stockIngresado)

apps/sistema-modular/src/
├── pages/stock/
│   ├── ImportacionesList.tsx          # migrar useState → useUrlFilters + badge ETA vencida
│   ├── ImportacionEditor.tsx          # extender: recibir OC por location.state + selector de items
│   ├── ImportacionDetail.tsx          # agregar boton "Ingresar al stock" (estado=recibido && !stockIngresado)
│   └── OCDetail.tsx                   # agregar seccion importaciones vinculadas + boton crear
├── components/stock/
│   ├── ImportacionAduanaSection.tsx   # agregar campo numeroGuia (edicion + display)
│   ├── ImportacionStatusTransition.tsx # agregar validacion campos obligatorios por estado
│   ├── ImportacionItemsSection.tsx    # NUEVO — tabla de items del embarque
│   └── ImportacionIngresarStockModal.tsx # NUEVO — formulario recepcion + prorrateo
└── hooks/
    └── useIngresarStock.ts            # NUEVO — logica de prorrateo + batch alta de stock
```

### Pattern 1: Crear Importacion desde OCDetail con location.state.prefill

**Que:** El boton "Crear Importacion" en OCDetail navega al editor pasando el contexto de la OC en `location.state`. Patron identico al de `01-06-PLAN.md` (OCEditor acepta `location.state.prefill`).

```typescript
// En OCDetail.tsx — boton visible solo cuando oc.tipo === 'importacion'
<Button size="sm" onClick={() =>
  navigate('/stock/importaciones/nuevo', {
    state: {
      fromOC: {
        ordenCompraId: oc.id,
        ordenCompraNumero: oc.numero,
        proveedorId: oc.proveedorId,
        proveedorNombre: oc.proveedorNombre,
        moneda: oc.moneda,
        items: oc.items,   // ItemOC[] para el selector de items del embarque
      }
    }
  })
}>
  + Crear Importacion
</Button>

// En ImportacionEditor.tsx — consumir location.state
const location = useLocation();
const fromOC = (location.state as any)?.fromOC ?? null;
// Si fromOC presente: precompletar OC fields, ocultar select de OC, mostrar ItemEmbarqueSelector
// Si no: flujo manual actual (select OC + sin items)
```

### Pattern 2: Diseno del tipo ItemImportacion (nuevo)

**Que:** Subconjunto de items de la OC para este embarque, con cantidades y costo calculado.

```typescript
// packages/shared/src/types/index.ts — agregar antes de interface Importacion
export interface ItemImportacion {
  id: string;                              // uuid local, no FK a otra coleccion
  itemOCId: string;                        // ItemOC.id de origen
  articuloId?: string | null;              // desnormalizado de ItemOC.articuloId
  articuloCodigo?: string | null;          // desnormalizado de ItemOC.articuloCodigo
  descripcion: string;                     // ItemOC.descripcion
  cantidadPedida: number;                  // cantidad solicitada en este embarque
  cantidadRecibida?: number | null;        // se completa al ingresar al stock
  unidadMedida: string;
  precioUnitario?: number | null;          // ItemOC.precioUnitario
  moneda?: 'ARS' | 'USD' | 'EUR' | null;  // ItemOC.moneda
  costoUnitarioConGastos?: number | null;  // calculado al ingresar: precioUnitario + prorrateo
  requerimientoId?: string | null;         // ItemOC.requerimientoId — para cierre automatico
}

// Campos a agregar en interface Importacion:
// items?: ItemImportacion[] | null;
// numeroGuia?: string | null;
// fechaRecepcion?: string | null;  -- obligatoria para transicion a 'recibido'
// stockIngresado?: boolean | null; -- flag post-ingreso para ocultar boton
```

### Pattern 3: Validacion de campos obligatorios en ImportacionStatusTransition

**Que:** Antes de confirmar la transicion a ciertos estados, validar la presencia de campos en `imp`. El componente actual cambia estado sin validar.

```typescript
// ImportacionStatusTransition.tsx — agregar map de validaciones
const REQUIRED_FIELDS_FOR_STATE: Partial<Record<EstadoImportacion, (imp: Importacion) => string | null>> = {
  embarcado: (imp) => {
    if (!imp.fechaEmbarque) return 'Ingresa la fecha de embarque en la seccion Embarque';
    if (!imp.booking) return 'Ingresa el numero de booking en la seccion Embarque';
    return null;
  },
  en_aduana: (imp) => {
    if (!imp.fechaArriboReal) return 'Ingresa la fecha de arribo real en la seccion Embarque';
    return null;
  },
  despachado: (imp) => {
    if (!imp.despachoNumero) return 'Ingresa el numero DUA en la seccion Aduana';
    return null;
  },
  recibido: (imp) => {
    if (!imp.fechaRecepcion) return 'Ingresa la fecha de recepcion';
    return null;
  },
};

const validationError = selected ? (REQUIRED_FIELDS_FOR_STATE[selected]?.(imp) ?? null) : null;
// Mostrar <p className="text-xs text-red-500 mt-2">{validationError}</p>
// Deshabilitar boton Confirmar si validationError !== null
```

**Nota:** Para `recibido`, el modal debe mostrar ademas un input `fechaRecepcion` tipo date para que el operador lo ingrese directamente.

### Pattern 4: Algoritmo de prorrateo de gastos

**Que:** Distribucion proporcional al valor de cada item sobre el total de la importacion.

```typescript
// utils/calcularProrrateo.ts — funcion pura (testeable sin mocks)
export function calcularCostoConGastos(params: {
  precioUnitario: number;
  cantidadRecibida: number;
  valorTotalImportacion: number; // suma de (precioUnitario * cantidadRecibida) de todos los items
  totalGastosEnMonedaOC: number; // gastos de la misma moneda que los items sumados
}): number {
  const { precioUnitario, cantidadRecibida, valorTotalImportacion, totalGastosEnMonedaOC } = params;
  const valorItem = precioUnitario * cantidadRecibida;
  const proporcion = valorTotalImportacion > 0 ? valorItem / valorTotalImportacion : 0;
  const gastosItem = totalGastosEnMonedaOC * proporcion;
  return cantidadRecibida > 0
    ? precioUnitario + gastosItem / cantidadRecibida
    : precioUnitario;
}
```

**Sobre monedas mixtas en gastos:** prorratear solo los gastos en la misma moneda que `OrdenCompra.moneda`. Gastos en otras monedas mostrar como referencia informativa sin incluir en el calculo de costo. Documentar como limitacion.

### Pattern 5: Batch atomico de alta de stock (useIngresarStock)

**Que:** Escritura atomica de N unidades + N movimientos + M actualizaciones de requerimientos en un unico `batch.commit()`.

```typescript
// hooks/useIngresarStock.ts
export function useIngresarStock() {
  const ingresarStock = async (imp: Importacion, recepciones: RecepcionItem[]) => {
    // RecepcionItem: { item: ItemImportacion; posicionId: string; posicionNombre: string; nrosSerie: string[]; cantidadReal: number }

    const totalValorImp = recepciones.reduce((sum, r) =>
      sum + (r.item.precioUnitario ?? 0) * r.cantidadReal, 0);
    const totalGastosUSD = (imp.gastos || [])
      .filter(g => g.moneda === imp.items?.[0]?.moneda ?? 'USD')
      .reduce((sum, g) => sum + g.monto, 0);

    const batch = createBatch();

    for (const rec of recepciones) {
      const costoUnitario = calcularCostoConGastos({
        precioUnitario: rec.item.precioUnitario ?? 0,
        cantidadRecibida: rec.cantidadReal,
        valorTotalImportacion: totalValorImp,
        totalGastosEnMonedaOC: totalGastosUSD,
      });

      const seriesONull = rec.nrosSerie.length > 0 ? rec.nrosSerie : [null];
      for (const nroSerie of seriesONull) {
        const unidadId = crypto.randomUUID();
        // batch.set unidad + batch.set movimiento (ver ejemplo completo abajo)
      }

      // Cierre de req si aplica
      if (rec.item.requerimientoId && rec.cantidadReal >= rec.item.cantidadPedida) {
        batch.update(docRef('requerimientos_compra', rec.item.requerimientoId), {
          estado: 'completado',
          ...getUpdateTrace(),
          updatedAt: Timestamp.now(),
        });
      }
    }

    // Marcar importacion como ingresada
    batch.update(docRef('importaciones', imp.id), deepCleanForFirestore({
      stockIngresado: true,
      items: recepciones.map(r => ({ ...r.item, cantidadRecibida: r.cantidadReal })),
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    }));

    batchAudit(batch, { action: 'update', collection: 'importaciones', documentId: imp.id, after: {} as any });
    await batch.commit();
  };

  return { ingresarStock };
}
```

### Pattern 6: Migrar ImportacionesList a useUrlFilters + badge ETA

```typescript
// Reemplazar:
const [estadoFilter, setEstadoFilter] = useState<string>('');
// useEffect con [estadoFilter] → loadImportaciones(...)

// Por:
const [filters, setFilter] = useUrlFilters({
  estado: { type: 'string', default: '' },
});
// Leer: filters.estado
// Escribir: setFilter('estado', value)
// El componente debe reaccionar con useMemo o useEffect en [filters.estado]

// Badge ETA vencida dentro del <tr>:
const etaVencida =
  imp.fechaEstimadaArribo &&
  new Date(imp.fechaEstimadaArribo) < new Date() &&
  imp.estado !== 'recibido' &&
  imp.estado !== 'cancelado';
```

### Pattern 7: Lista de importaciones en OCDetail (relacion 1-OC-muchas-IMP)

**Que:** Mostrar importaciones vinculadas a la OC por query (no por embed en `OrdenCompra`).

```typescript
// En OCDetail.tsx
const [importacionesOC, setImportacionesOC] = useState<Importacion[]>([]);
useEffect(() => {
  if (oc?.tipo === 'importacion') {
    importacionesService.getAll()
      .then(all => setImportacionesOC(all.filter(i => i.ordenCompraId === oc.id)));
  }
}, [oc]);
// Renderizar lista compacta: numero, estado, ETA, boton Link a detail
```

**Nota:** `OrdenCompra.importacionId` es escalar (un solo ID). NO modificar `OrdenCompra` para agregar un array. La FK correcta ya existe en `Importacion.ordenCompraId` y el filtro en memoria es suficiente.

### Anti-Patterns a Evitar

- **`useState` para filtro de estado** en ImportacionesList — viola hard rule, usar `useUrlFilters`.
- **Escribir `undefined`** al crear `ItemImportacion` con campos opcionales vacíos — siempre usar `null`.
- **Commits separados** para unidades + movimientos + requerimientos — todo en un unico `batch.commit()`.
- **Calcular prorrateo en el componente UI** — extraer a `utils/calcularProrrateo.ts` + `useIngresarStock` para mantener componentes < 250 lineas.
- **Modificar un `MovimientoStock`** despues de crearlo — es inmutable por hard rule.
- **`cleanFirestoreData()` en lugar de `deepCleanForFirestore()`** al crear unidades con `ubicacion` nested.

---

## Don't Hand-Roll

| Problema | No construir | Usar en cambio | Por que |
|---|---|---|---|
| Filtros URL-persistidos | `useState` + manual serialization | `useUrlFilters` hook | Hard rule + ya implementado con tipos |
| Limpiar undefined nested | JSON.parse/JSON.stringify manual | `deepCleanForFirestore()` | Ya disponible, evita bugs silenciosos en Firestore |
| Escrituras atomicas | `setDoc` individual en loop | `createBatch() + batchAudit()` | Consistencia + audit trail, patron obligatorio |
| Modal draggable | `<div>` posicionado manualmente | `Modal` de `components/ui/Modal` | Ya implementado con auto-focus y diseno teal |
| Select con busqueda para posiciones | `<select>` nativo | `SearchableSelect` | Ya implementado, maneja grandes listas |
| Navegacion con contexto previo | `localStorage` / `sessionStorage` | `location.state` de react-router-dom | Patron ya usado en `01-06-PLAN.md` (OCEditor prefill) |

---

## Common Pitfalls

### Pitfall 1: `fechaRecepcion` no en el array `dateFields` del service

**Que sale mal:** El campo `fechaRecepcion` (nuevo) se escribe como string ISO en Firestore en lugar de Timestamp.

**Por que ocurre:** El array `dateFields` en `importacionesService.create/update` es estatico y no incluye campos nuevos.

**Como evitar:** Al agregar `fechaRecepcion` al tipo, agregarlo al array `dateFields` en ambas funciones:
```typescript
const dateFields = [
  'fechaEmbarque', 'fechaEstimadaArribo', 'fechaArriboReal',
  'fechaDespacho', 'vepFechaPago', 'fechaRecepcion'  // agregar este
] as const;
```

**Señales de alerta:** `.toDate()` throwing al leer el campo, o fecha que aparece como string crudo.

### Pitfall 2: `Importacion.items` inicializado como `undefined` en create

**Que sale mal:** Si una Importacion se crea sin pasar `items` (flujo manual), el campo queda `undefined` en Firestore.

**Como evitar:** En `importacionesService.create()`, inicializar `items: data.items || []` igual que `gastos` y `documentos`.

### Pitfall 3: Prorrateo con monedas mixtas en gastos

**Que sale mal:** Los gastos pueden estar en ARS, USD, EUR. Sumar montos en distintas monedas produce costos incorrectos.

**Como evitar:** Prorratear solo los gastos en la misma moneda que `OrdenCompra.moneda`. Para gastos en otras monedas, mostrarlos como referencia informativa en el formulario pero no incluirlos en el calculo. Documentar como limitacion conocida.

### Pitfall 4: `ImportacionEditor` supera 250 lineas al agregar item selector

**Que sale mal:** El editor actual tiene 185 lineas; la tabla de seleccion de items con checkboxes y cantidades lo llevan facilmente a 300+.

**Como evitar:** Extraer `ItemEmbarqueSelector` como subcomponente separado que recibe `items: ItemOC[]` y emite `ItemImportacion[]` via callback `onChange`.

### Pitfall 5: Filtro `ordenCompraId` no existe en `requerimientosService.getAll()`

**Que sale mal:** Para cerrar requerimientos se necesita buscarlos por OC. El service actual solo filtra por `estado`, `origen`, `presupuestoId`, `articuloId`.

**Como evitar:** Dentro de `useIngresarStock`, traer todos los reqs `en_compra` y filtrar en memoria por `ordenCompraId` (cantidad pequeña en el contexto AGS). Documentar como deuda tecnica si la coleccion crece.

### Pitfall 6: `OCStatusTransition` y `Registrar recepcion` en conflicto con el flujo de importacion

**Que sale mal:** `OCDetail` ya tiene un boton "Registrar recepcion" que usa `OCStatusTransition`. Para OCs tipo `importacion`, el ingreso de stock debe hacerse desde el `ImportacionDetail`, no desde la OC.

**Como evitar:** Ocultar el boton "Registrar recepcion" cuando `oc.tipo === 'importacion'` (o cambiar su label a "Ver importaciones"). Agregar nota en el codigo.

---

## Code Examples

### Ejemplo 1: `unidadesService.create()` — firma completa

```typescript
// stockService.ts, linea 369 — Fuente: codebase (HIGH confidence)
await unidadesService.create({
  articuloId: 'art-123',
  articuloCodigo: 'GC-001',
  articuloDescripcion: 'Cromatografo de gases',
  nroSerie: 'SN-456',       // null si no aplica
  nroLote: null,
  condicion: 'nuevo',
  estado: 'disponible',
  ubicacion: {
    tipo: 'posicion',
    referenciaId: 'pos-789',
    referenciaNombre: 'Deposito A / Estante 2',
  },
  costoUnitario: 1250.50,
  monedaCosto: 'USD',
  observaciones: null,
  reservadoParaPresupuestoId: null,
  reservadoParaPresupuestoNumero: null,
  reservadoParaClienteId: null,
  reservadoParaClienteNombre: null,
  activo: true,
  // NO pasar id, createdAt, updatedAt — el service los genera
});
```

### Ejemplo 2: `movimientosService.create()` para tipo ingreso

```typescript
// stockService.ts, linea 697 — Fuente: codebase (HIGH confidence)
await movimientosService.create({
  tipo: 'ingreso',
  unidadId: unidadId,
  articuloId: 'art-123',
  articuloCodigo: 'GC-001',
  articuloDescripcion: 'Cromatografo de gases',
  cantidad: 1,
  origenTipo: 'proveedor',
  origenId: imp.proveedorId,
  origenNombre: imp.proveedorNombre,
  destinoTipo: 'posicion',
  destinoId: posicionId,
  destinoNombre: posicionNombre,
  motivo: `Alta por importacion ${imp.numero}`,
  creadoPor: currentUserName,
  // NO pasar id, createdAt — el service los genera
});
```

### Ejemplo 3: `requerimientosService.update()` para cierre

```typescript
// importacionesService.ts, linea 252 — Fuente: codebase (HIGH confidence)
await requerimientosService.update(requerimientoId, {
  estado: 'completado',
  // El service agrega updatedAt + getUpdateTrace() internamente
});
```

### Ejemplo 4: `useUrlFilters` con schema para ImportacionesList

```typescript
// Fuente: hooks/useUrlFilters.ts (HIGH confidence)
const [filters, setFilter] = useUrlFilters({
  estado: { type: 'string', default: '' },
});
// Leer: filters.estado
// Escribir: setFilter('estado', 'embarcado')
// URL resultante: ?estado=embarcado (se limpia al volver al default '')
```

### Ejemplo 5: Posiciones excluyendo RESERVAS para el selector destino

```typescript
// stockService.ts — Fuente: codebase (HIGH confidence)
const todas = await posicionesStockService.getAll(true); // activoOnly=true
const posicionesDestino = todas.filter(p => p.codigo !== 'RESERVAS');
// Convertir a opciones de SearchableSelect: { value: p.id, label: p.nombre }
```

### Ejemplo 6: Obtener importaciones de una OC por query en memoria

```typescript
// importacionesService.ts — getAll no tiene filtro ordenCompraId
// Workaround validado: cantidad de importaciones por OC es pequeña (< 10)
const todas = await importacionesService.getAll();
const deEstaOC = todas.filter(i => i.ordenCompraId === oc.id);
```

---

## State of the Art

| Situacion anterior | Situacion Phase 2 entrada | Cambio requerido |
|---|---|---|
| `ImportacionesList` usa `useState` para filtro | Debe usar `useUrlFilters` | Migrar — hard rule |
| `ImportacionEditor` crea sin items | Debe crear con subconjunto de items OC | Extender formulario + nuevo tipo |
| `ImportacionStatusTransition` cambia estado sin validar | Debe validar campos obligatorios por estado | Agregar map de validaciones |
| `ImportacionAduanaSection` sin `numeroGuia` | Agregar campo | +1 Input + 1 campo en tipo |
| `ImportacionDetail` sin boton ingreso stock | Boton cuando `estado=recibido && !stockIngresado` | Nuevo modal subcomponente |
| `OrdenCompra.importacionId` escalar | Multiple importaciones por OC via query | No modificar OrdenCompra — FK vive en Importacion |
| `Importacion` sin array de items | Nuevo campo `items: ItemImportacion[]` | Nuevo tipo + campo en Importacion |

**Obsoleto — a no usar:**
- `useState` para filtros de lista — reemplazar por `useUrlFilters`
- `cleanFirestoreData()` para datos con nested objects — usar `deepCleanForFirestore()`

---

## Open Questions

1. **Tipo de cambio para gastos en monedas distintas a la OC**
   - Lo que sabemos: gastos pueden ser ARS, USD, EUR; items tipicamente en USD
   - Lo que es ambiguo: si se prorratean gastos ARS sobre items USD, a que TC?
   - Recomendacion: prorratear solo gastos en la misma moneda que `OrdenCompra.moneda`; mostrar gastos de otras monedas como referencia sin incluir en el costo. Dejar para revision futura.

2. **`requerimientosService.getAll()` sin filtro `ordenCompraId`**
   - Lo que sabemos: el service filtra por `estado`, `origen`, `presupuestoId`, `articuloId` — no por `ordenCompraId`
   - Recomendacion: filtrar en memoria en `useIngresarStock`. No modificar el service para Phase 2.

3. **`fechaRecepcion` en `ImportacionStatusTransition` vs campo separado en sidebar**
   - Lo que sabemos: la transicion a `recibido` requiere `fechaRecepcion`
   - Recomendacion: agregar el input de fecha directamente en el modal de transicion cuando se selecciona `recibido`, igual que podria hacerse para `booking` en `embarcado`. Esto evita que el operador tenga que salir del modal para llenar el campo.

4. **Ocultamiento del boton "Registrar recepcion" en OCDetail para OCs tipo importacion**
   - Lo que sabemos: `OCDetail` muestra "Registrar recepcion" para estado `confirmada` o `en_transito`
   - Recomendacion: agregar condicion `oc.tipo !== 'importacion'` al guard `canReceive`. El ingreso de stock para importaciones se hace desde `ImportacionDetail`.

---

## Validation Architecture

> `nyquist_validation` key absent from `.planning/config.json` — section included.

### Test Framework

| Property | Value |
|---|---|
| Framework | No detectado en `apps/sistema-modular` |
| Config file | Ninguno — Wave 0 gap |
| Quick run command | N/A hasta Wave 0 |
| Full suite command | N/A |

No se encontraron archivos `.test.ts`, `vitest.config.*`, `jest.config.*` ni scripts `"test"` en `apps/sistema-modular/package.json`.

### Phase Requirements → Test Map

| Req ID | Comportamiento | Tipo | Comando automatizable | Archivo existe |
|---|---|---|---|---|
| COMEX-01 | OC tipo `'importacion'` muestra boton "Crear Importacion" | unit (render) | `vitest run` (Wave 0) | ❌ Wave 0 |
| COMEX-02 | `ImportacionEditor` precompleta desde `location.state.fromOC` | unit | `vitest run` (Wave 0) | ❌ Wave 0 |
| COMEX-03 | `ImportacionStatusTransition` bloquea `embarcado` sin `fechaEmbarque` + `booking` | unit | `vitest run` (Wave 0) | ❌ Wave 0 |
| COMEX-04 | Badge ETA vencida cuando `fechaEstimadaArribo < hoy && estado != recibido` | unit | `vitest run` (Wave 0) | ❌ Wave 0 |
| COMEX-05 | Prorrateo distribuye gastos proporcionalmente al valor de los items | unit puro | `vitest run` (Wave 0) | ❌ Wave 0 |
| COMEX-06 | `useIngresarStock` genera 1 UnidadStock + 1 MovimientoStock por unidad | integration (mock Firestore) | `vitest run` (Wave 0) | ❌ Wave 0 |
| COMEX-07 | Requerimiento `en_compra` pasa a `completado` cuando recibido >= pedido | integration (mock Firestore) | `vitest run` (Wave 0) | ❌ Wave 0 |
| COMEX-08 | Filtros de `ImportacionesList` persisten en URL | unit (router) | `vitest run` (Wave 0) | ❌ Wave 0 |

**COMEX-05** es alta prioridad para Wave 0: es logica pura sin dependencias de Firebase, altamente testeable.

### Sampling Rate

- **Per task commit:** TypeScript build clean (`pnpm tsc --noEmit`)
- **Per wave merge:** si vitest instalado — `pnpm vitest run`; si no — revision manual en dev server
- **Phase gate:** render manual en dev server con datos de prueba + build TypeScript sin errores

### Wave 0 Gaps

- [ ] `apps/sistema-modular/vitest.config.ts` + dependencias `vitest @testing-library/react` — si se decide agregar tests
- [ ] `apps/sistema-modular/src/utils/calcularProrrateo.test.ts` — cubre COMEX-05 (funcion pura, sin mocks)
- [ ] `apps/sistema-modular/src/components/stock/ImportacionStatusTransition.test.tsx` — cubre COMEX-03

*Si no se instala vitest en Phase 2: validacion manual en dev server es suficiente dado el ritmo del proyecto. El algoritmo de prorrateo (COMEX-05) es el unico candidato solido para test unitario puro.*

---

## Sources

### Primary (HIGH confidence)
- Codebase `apps/sistema-modular/src/services/importacionesService.ts` — CRUD completo, dateFields, getNextNumber
- Codebase `apps/sistema-modular/src/services/stockService.ts` — `unidadesService.create()` linea 369, `movimientosService.create()` linea 697, `reservasService` patron batch linea 914
- Codebase `packages/shared/src/types/index.ts` — `Importacion` linea 2322, `ItemOC` linea 827, `OrdenCompra` linea 841, `UnidadStock` linea 1693, `MovimientoStock` linea 1845, `GastoImportacion` linea 2312
- Codebase `apps/sistema-modular/src/pages/stock/ImportacionesList.tsx` — estado actual con `useState` (119 lineas)
- Codebase `apps/sistema-modular/src/pages/stock/ImportacionEditor.tsx` — editor sin items (185 lineas)
- Codebase `apps/sistema-modular/src/pages/stock/ImportacionDetail.tsx` — detail con 7 subcomponentes (84 lineas)
- Codebase `apps/sistema-modular/src/pages/stock/OCDetail.tsx` — sin seccion de importaciones (98 lineas)
- Codebase `apps/sistema-modular/src/hooks/useUrlFilters.ts` — firma y comportamiento del hook
- Codebase `apps/sistema-modular/src/hooks/useImportaciones.ts` — hook sin logica de stock
- Codebase `apps/sistema-modular/src/components/stock/ImportacionStatusTransition.tsx` — sin validacion de campos
- Codebase `apps/sistema-modular/src/components/stock/ImportacionAduanaSection.tsx` — sin `numeroGuia`
- Codebase `apps/sistema-modular/src/components/stock/ImportacionGastosSection.tsx` — patron edicion inline
- Codebase `.planning/phases/02-comex-importaciones-y-despachos/02-CONTEXT.md` — decisiones del usuario

### Secondary (MEDIUM confidence)
- Ninguna fuente secundaria utilizada; toda la informacion proviene del codebase directamente.

### Tertiary (LOW confidence)
- Ninguna.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — leido directamente del codigo fuente
- Architecture: HIGH — todos los patrones son extensiones directas de Phase 1 ya implementado
- Pitfalls: HIGH — identificados del codigo existente (dateFields hardcoded, `importacionId` escalar, 250 lineas limit)
- Validation: MEDIUM — no hay infraestructura de tests; recomendaciones de Wave 0 son opcionales

**Research date:** 2026-04-03
**Valid until:** 2026-07-03 (estable — no depende de librerias externas en movimiento rapido)
