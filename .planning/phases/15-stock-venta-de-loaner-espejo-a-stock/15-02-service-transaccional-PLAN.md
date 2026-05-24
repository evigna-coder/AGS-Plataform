---
phase: 15-stock-venta-de-loaner-espejo-a-stock
plan: 02
type: execute
wave: 3
depends_on:
  - "15-00"
  - "15-01"
files_modified:
  - apps/sistema-modular/src/services/loanersService.ts
  - apps/sistema-modular/src/services/__tests__/ventaLoaner.test.ts
autonomous: true
requirements:
  - VLN-02
must_haves:
  truths:
    - "Una sola `runTransaction` atómica escribe 3 docs (update loaner + create UnidadStock + create MovimientoStock); rollback automático si cualquiera falla"
    - "READ-FIRST guard: si `loaner.estado === 'vendido'` al leer dentro de la tx, throw `'Loaner ya vendido'` y no se escribe nada"
    - "Si el modal pasa `articuloRecienVinculado`, el update del loaner denormaliza `articuloId/Codigo/Descripcion` DENTRO de la tx (atomic con el resto)"
    - "MovimientoStock creado tiene `subtipo: 'venta_loaner'`, `referenciaLoanerId`, `referenciaLoanerCodigo`, `cantidad: 1`, `origenTipo: 'baja'`, `destinoTipo: 'cliente'`, `creadoPor` poblado explícitamente"
    - "UnidadStock creada tiene `estado: 'vendido'`, `condicion: 'bien_de_uso'`, `ubicacion.tipo: 'cliente'`, `costoUnitario` + `monedaCosto` del modal, `nroSerie` derivado de `loaner.serie`"
    - "Pre-fetch del cliente y del artículo FUERA de la tx; dentro solo `tx.get(loanerRef)` + 3 writes"
    - "IDs (unidadId, movimientoId) pre-generados con `crypto.randomUUID()` fuera de la tx"
    - "`deepCleanForFirestore` aplicado a los 3 payloads dentro de la tx"
    - "Validación pre-tx: `costoUnitario` y `monedaCosto` no-nulos → throw `'Costo requerido'` ANTES de entrar a la tx"
    - "Audit post-commit (best-effort): `logBusinessEvent('loaner.vendido', ...)` con detalles de unidad/movimiento/cliente — falla del audit NO bloquea la tx"
    - "DI hook `__setTestFirestore(state)` expuesto (mirror Phase 14 patronesService); permite que los 5 tests del Wave 0 corran sin Firestore emulator"
    - "5 tests del Wave 0 (`test:venta-loaner`) pasan GREEN"
  artifacts:
    - path: "apps/sistema-modular/src/services/loanersService.ts"
      provides: "registrarVenta transaccional + __setTestFirestore DI hook"
      contains: "runTransaction"
    - path: "apps/sistema-modular/src/services/__tests__/ventaLoaner.test.ts"
      provides: "5 tests GREEN (RED→GREEN del Wave 0)"
      contains: "rollback"
  key_links:
    - from: "apps/sistema-modular/src/services/loanersService.ts"
      to: "apps/sistema-modular/src/services/firebase.ts"
      via: "imports getCreateTrace, getUpdateTrace, deepCleanForFirestore, logBusinessEvent, getCurrentUserSnapshot"
      pattern: "from ['\"]\\./firebase['\"]"
    - from: "apps/sistema-modular/src/services/loanersService.ts"
      to: "firebase/firestore (Web Modular SDK)"
      via: "import { runTransaction, doc, Timestamp } from 'firebase/firestore' (lazy o top-level — verificar precedente Phase 14)"
      pattern: "runTransaction"
---

<objective>
Reemplazar el método `loanersService.registrarVenta` (hoy: 3 LOC, un único `update`) por una versión transaccional que escriba atómicamente a 3 colecciones (`loaners` + `unidades` + `movimientosStock`) cada vez que un loaner se vende. Calcar 1:1 la estructura de `patronesConsumirHelpers._consumirComponentesInProd` (Phase 14, GREEN en producción desde 2026-05-24).

Purpose: invariante de Phase 15 — "toda venta deja espejo en stock". El método actual lo viola (solo updatea el loaner). Sin esto, el módulo Stock pierde trazabilidad de equipos vendidos vía loaner y no aparece en histórico contable.

Output:
- `loanersService.ts` con el método `registrarVenta` reemplazado por la versión transaccional + DI hook `__setTestFirestore`.
- `ventaLoaner.test.ts` actualizado: 5 tests pasan GREEN (incluido el rollback con `_throwOnUnidadCreate` mock hook).
- Cero archivos nuevos: las helpers (factory `buildRegistrarVenta`, mock state) viven inline en `loanersService.ts` por ahora (extraer a `loanersVentaHelpers.ts` solo si supera ~250 LOC — precedente Phase 14 extrajo a `patronesConsumirHelpers.ts` por eso mismo).
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/15-stock-venta-de-loaner-espejo-a-stock/15-RESEARCH.md
@.planning/phases/15-stock-venta-de-loaner-espejo-a-stock/15-CONTEXT.md

<!-- Archivo principal a reemplazar -->
@apps/sistema-modular/src/services/loanersService.ts

<!-- Precedentes 1:1 a CALCAR -->
@apps/sistema-modular/src/services/patronesConsumirHelpers.ts
@apps/sistema-modular/src/services/patronesService.ts
@apps/sistema-modular/src/services/equivalenciasService.ts

<!-- Helpers existentes a USAR -->
@apps/sistema-modular/src/services/firebase.ts

<!-- Test file Wave 0 (a actualizar a GREEN) -->
@apps/sistema-modular/src/services/__tests__/ventaLoaner.test.ts
@apps/sistema-modular/src/services/__tests__/fixtures/ventaLoaner.ts

<interfaces>
<!-- Firma final del método (Source: 15-RESEARCH.md Pattern 1, líneas 198-340) -->

```typescript
export interface RegistrarVentaParams {
  loanerId: string;
  venta: VentaLoaner & {
    costoUnitario: number;        // Required en runtime (no opcional acá aunque el tipo VentaLoaner lo deje opcional)
    monedaCosto: 'ARS' | 'USD';   // Idem
  };
  articuloRecienVinculado?: {
    articuloId: string;
    articuloCodigo: string;
    articuloDescripcion: string;
  } | null;
}

export interface RegistrarVentaResult {
  unidadId: string;
  movimientoId: string;
}

export async function registrarVenta(params: RegistrarVentaParams): Promise<RegistrarVentaResult>;

// DI hook (mirror equivalenciasService:70-79 + patronesService:44-47)
export function __setTestFirestore(state: MockVentaLoanerState | null): void;
```

<!-- Helpers de firebase.ts que SÍ existen y se reutilizan: -->
import {
  db,
  deepCleanForFirestore,
  logBusinessEvent,
} from './firebase';
import { getCreateTrace, getUpdateTrace, getCurrentUserSnapshot } from './currentUser';
// Phase 14 patronesConsumirHelpers usa exactamente esta combinación.
// `getCurrentUserSnapshot()` retorna { uid, email, displayName } — usar `.displayName` o `.email` para `creadoPor`.

<!-- Estado actual del método a reemplazar (línea 174 de loanersService.ts): -->
async registrarVenta(id: string, venta: VentaLoaner): Promise<void> {
  await this.update(id, { estado: 'vendido', activo: false, venta });
}
<!-- NOTA: hoy es método de instancia del objeto exportado `loanersService`.
     Phase 15 lo mantiene como método del mismo objeto (no break la API pública),
     PERO la signature cambia: el segundo argumento ahora es `RegistrarVentaParams['venta']` con
     `costoUnitario`/`monedaCosto` requeridos en runtime, y se agrega un tercer argumento opcional
     `articuloRecienVinculado`. El return cambia de `Promise<void>` a `Promise<RegistrarVentaResult>`. -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Implementar registrarVenta transaccional + DI hook en loanersService.ts</name>
  <files>apps/sistema-modular/src/services/loanersService.ts</files>
  <behavior>
    - Happy path pre-vinculado (test VLN-02a): el método ejecuta 1 tx que update loaner + create unidad + create movimiento → todos atómicos.
    - Happy path sin vínculo (test VLN-02b): cuando `articuloRecienVinculado` viene, el update del loaner denormaliza `articuloId/Codigo/Descripcion` DENTRO de la tx.
    - Guard idempotency (test VLN-02c): segunda llamada sobre loaner ya `vendido` → throw `'Loaner ya vendido'`.
    - Rollback atómico (test VLN-02d): en path de test, `state._throwOnUnidadCreate === true` causa que el `setUnidad` mock throw → tx revierte; loaner SIN cambios, 0 unidades, 0 movimientos.
    - Validación pre-tx (test VLN-02e): si `costoUnitario` o `monedaCosto` faltan/null/undefined, throw `'Costo requerido'` antes de entrar a la tx.
    - DI hook funciona: `__setTestFirestore(state)` redirige todas las operaciones Firestore a los Map in-memory; producción nunca llama esto.
  </behavior>
  <action>
    Paso A — Reemplazar el método `registrarVenta` del objeto `loanersService` exportado en `apps/sistema-modular/src/services/loanersService.ts`.

    Estructura objetivo (calcada 1:1 de `patronesConsumirHelpers.ts:198-318` Y `patronesService.ts:44-47, 237-247`):

    1. Top-level (módulo scope) agregar:
       ```typescript
       // DI hook for tests (precedente Phase 14 patronesService:44-47)
       let _testState: MockVentaLoanerState | null = null;
       export function __setTestFirestore(state: MockVentaLoanerState | null): void {
         _testState = state;
       }
       ```

    2. Definir `MockVentaLoanerState` y `MockLoaner` en `loanersService.ts` (re-exportarlos desde acá para que el test los importe — o importarlos desde `__tests__/fixtures/ventaLoaner.ts` con import condicional / `import type`). Decisión: importar el tipo desde `__tests__/fixtures/ventaLoaner.ts` con `import type` (zero runtime impact, mantiene tests aislados). Verificar que el bundler (Vite) no incluye el archivo de tests en el build de prod (tree-shaking debería garantizarlo + `__tests__` no se importa en runtime).
       Alternativa: si import type cross-folder genera warnings, declarar el tipo `MockVentaLoanerState` inline en loanersService.ts y el fixture importa DESDE acá. Decisión final del implementador, ambas son OK.

    3. Definir el método público que dispatch:
       ```typescript
       export const loanersService = {
         // ... métodos existentes intactos (list, getById, create, update, delete, registrarPrestamo, registrarDevolucion, registrarExtraccion) ...

         async registrarVenta(
           id: string,
           venta: VentaLoaner & { costoUnitario: number; monedaCosto: 'ARS' | 'USD' },
           articuloRecienVinculado?: { articuloId: string; articuloCodigo: string; articuloDescripcion: string } | null,
         ): Promise<{ unidadId: string; movimientoId: string }> {
           const params: RegistrarVentaParams = { loanerId: id, venta, articuloRecienVinculado: articuloRecienVinculado ?? null };

           // STEP 0: Validación pre-tx (test VLN-02e)
           if (params.venta.costoUnitario == null || params.venta.monedaCosto == null) {
             throw new Error('Costo requerido');
           }

           // STEP 1: dispatch a test vs prod path
           if (_testState) {
             return _registrarVentaInTest(params, _testState);
           }
           return _registrarVentaInProd(params);
         },
       };
       ```

    4. Implementar `_registrarVentaInProd(params)`. Calcar paso a paso `_consumirComponentesInProd` (líneas 200-302 de `patronesConsumirHelpers.ts`):

       a. **Pre-gen UUIDs fuera de la tx:** `const unidadId = crypto.randomUUID(); const movimientoId = crypto.randomUUID(); const nowTs = Timestamp.now();`

       b. **Pre-fetch fuera de la tx (Pitfall 3):** NO se hace `tx.get` del cliente ni del artículo. El cliente ya viene en `venta.clienteId/clienteNombre` (modal lo pasó). El artículo: si `articuloRecienVinculado` viene, ya tiene codigo+descripcion; si no, vienen del loaner. NINGÚN pre-fetch de cliente desde Firestore en este service (el modal ya tiene los datos).

       c. **Obtener `creadoPor` (Pitfall 2):** `const userSnap = await getCurrentUserSnapshot(); const creadoPorNombre = userSnap.displayName ?? userSnap.email ?? 'desconocido';` Hacer este `await` ANTES de la tx (no dentro — minimizar reads en tx).

       d. **runTransaction:**
       ```typescript
       await runTransaction(db, async (tx) => {
         const loanerRef = doc(db, 'loaners', params.loanerId);
         const snap = await tx.get(loanerRef);
         if (!snap.exists()) throw new Error('Loaner no encontrado');
         const loaner = { id: snap.id, ...(snap.data() as any) } as Loaner;

         // GUARD (test VLN-02c)
         if (loaner.estado === 'vendido') {
           throw new Error('Loaner ya vendido');
         }

         // Resolve articuloId final
         const articuloId = params.articuloRecienVinculado?.articuloId ?? loaner.articuloId;
         if (!articuloId) throw new Error('Loaner sin artículo vinculado — no se puede crear espejo en stock');
         const articuloCodigo = params.articuloRecienVinculado?.articuloCodigo ?? (loaner as any).articuloCodigo ?? '';
         const articuloDescripcion = params.articuloRecienVinculado?.articuloDescripcion ?? (loaner as any).articuloDescripcion ?? '';

         // WRITE 1: update loaner (Pitfall 1: getUpdateTrace porque es update existente)
         tx.update(loanerRef, deepCleanForFirestore({
           estado: 'vendido',
           activo: false,
           venta: params.venta,
           ...(params.articuloRecienVinculado ? {
             articuloId: params.articuloRecienVinculado.articuloId,
             articuloCodigo: params.articuloRecienVinculado.articuloCodigo,
             articuloDescripcion: params.articuloRecienVinculado.articuloDescripcion,
           } : {}),
           ...getUpdateTrace(),
           updatedAt: nowTs,
         }));

         // WRITE 2: create UnidadStock (Pitfall 1: getCreateTrace porque es doc nuevo)
         tx.set(doc(db, 'unidades', unidadId), deepCleanForFirestore({
           articuloId,
           articuloCodigo,
           articuloDescripcion,
           nroSerie: (loaner as any).serie ?? null,
           nroLote: null,
           condicion: 'bien_de_uso',
           estado: 'vendido',
           ubicacion: {
             tipo: 'cliente',
             referenciaId: params.venta.clienteId,
             referenciaNombre: params.venta.clienteNombre,
           },
           costoUnitario: params.venta.costoUnitario,
           monedaCosto: params.venta.monedaCosto,
           observaciones: params.venta.notas ?? null,
           reservadoParaPresupuestoId: null,
           reservadoParaPresupuestoNumero: null,
           reservadoParaClienteId: null,
           reservadoParaClienteNombre: null,
           activo: true,
           ...getCreateTrace(),
           createdAt: nowTs,
           updatedAt: nowTs,
         }));

         // WRITE 3: create MovimientoStock (Pitfall 1: getCreateTrace + Pitfall 2: creadoPor explícito)
         tx.set(doc(db, 'movimientosStock', movimientoId), deepCleanForFirestore({
           tipo: 'egreso',
           subtipo: 'venta_loaner',
           unidadId,
           articuloId,
           articuloCodigo,
           articuloDescripcion,
           cantidad: 1,
           origenTipo: 'baja',
           origenId: loaner.id,
           origenNombre: loaner.codigo,
           destinoTipo: 'cliente',
           destinoId: params.venta.clienteId,
           destinoNombre: params.venta.clienteNombre,
           referenciaLoanerId: loaner.id,
           referenciaLoanerCodigo: loaner.codigo,
           motivo: params.venta.presupuestoNumero ? `Venta vinculada a presupuesto ${params.venta.presupuestoNumero}` : null,
           otNumber: null,
           remitoId: null,
           creadoPor: creadoPorNombre,   // Pitfall 2: REQUIRED en MovimientoStock
           ...getCreateTrace(),
           createdAt: nowTs,
         }));
       });

       // STEP C: POST-commit audit (best-effort)
       try {
         logBusinessEvent({
           eventName: 'loaner.vendido',
           collection: 'loaners',
           documentId: params.loanerId,
           details: {
             unidadId, movimientoId,
             clienteId: params.venta.clienteId, clienteNombre: params.venta.clienteNombre,
             precio: params.venta.precio ?? null, moneda: params.venta.moneda ?? null,
             costoUnitario: params.venta.costoUnitario, monedaCosto: params.venta.monedaCosto,
           },
         });
       } catch (err) {
         console.error('[registrarVenta] audit post-commit falló (best-effort):', err);
       }

       return { unidadId, movimientoId };
       ```

    5. Implementar `_registrarVentaInTest(params, state)` — versión in-memory para los tests:
       - Replicar la misma lógica pero leyendo/escribiendo a `state.collections.loaners`, `state.collections.unidades`, `state.collections.movimientosStock` (arrays).
       - READ: `const loaner = state.collections.loaners.find(l => l.id === params.loanerId)`. Si no existe → throw 'Loaner no encontrado'.
       - GUARD: si `loaner.estado === 'vendido'` → throw 'Loaner ya vendido'. NO modificar el loaner ni crear nada.
       - HOOK rollback (test VLN-02d): antes del `state.collections.unidades.push(unidad)`, chequear `if ((state as any)._throwOnUnidadCreate) throw new Error('mock: unidad create failed')`. La tx debe revertir las mutaciones que ya hizo — pero como en test es JS plain, hay que diseñar el hook para que falle ANTES de la primera mutación, o snapshotear-restaurar el state. La forma más simple: aplicar todas las mutaciones al final, después de chequear el hook. Pseudo-código:
         ```typescript
         // Construir todos los writes primero (sin mutar)
         const updatedLoaner = { ...loaner, estado: 'vendido', activo: false, venta: params.venta, ... };
         const newUnidad = { id: unidadId, ... };
         const newMovimiento = { id: movimientoId, ... };

         // Chequear hook ANTES de mutar
         if ((state as any)._throwOnUnidadCreate) throw new Error('mock: unidad create failed');

         // Aplicar mutaciones de una sola vez (atomicidad simulada)
         Object.assign(loaner, updatedLoaner);  // mutate in-place el item dentro del array
         state.collections.unidades.push(newUnidad);
         state.collections.movimientosStock.push(newMovimiento);
         ```
       - Return: `{ unidadId, movimientoId }`.

    6. Pitfall 6 (no acción acá pero anotar): cuando el modal del Wave 3 fetch artículos para SearchableSelect, usar `articulosService.getAll({ activoOnly: true })` explícito (no implícito).

    7. Pitfall 7 (no acción acá): si `loanersService.ts` supera 250 LOC con esta implementación, extraer las funciones `_registrarVentaInProd`/`_registrarVentaInTest` a `loanersVentaHelpers.ts` (precedente: `patronesConsumirHelpers.ts`). Verificar al final con `wc -l`.

    8. Mantener intactos: imports existentes, métodos existentes (`list`, `getById`, `create`, `update`, `delete`, `registrarPrestamo`, `registrarDevolucion`, `registrarExtraccion`). Solo se reemplaza `registrarVenta` y se agregan `__setTestFirestore`, los tipos `RegistrarVentaParams`/`RegistrarVentaResult` exportados, y los helpers privados.
  </action>
  <verify>
    <automated>cd "apps/sistema-modular" && pnpm type-check && pnpm test:venta-loaner</automated>
  </verify>
  <done>
    - `loanersService.ts` exporta `registrarVenta` con la nueva signature transaccional.
    - `loanersService.ts` exporta `__setTestFirestore` para los tests.
    - Type-check GREEN en sistema-modular.
    - `pnpm test:venta-loaner` GREEN — los 5 tests pasan (incluido el rollback con `_throwOnUnidadCreate`).
    - Verificación manual de pitfalls:
      - Pitfall 1: el `tx.update` del loaner usa `getUpdateTrace()`, los 2 `tx.set` (unidad + movimiento) usan `getCreateTrace()` — search "getCreateTrace\|getUpdateTrace" en el bloque nuevo, count = 1 update + 2 create.
      - Pitfall 2: `creadoPor: creadoPorNombre` aparece explícito en el payload del MovimientoStock — search "creadoPor:" en el bloque write 3.
      - Pitfall 3: NO hay `tx.get` distinto al del loaner — search "tx.get" en el bloque tx, count = 1.
      - Pitfall 4: `nroSerie: (loaner as any).serie ?? null` con coerción de undefined a null.
      - Pitfall 5: documentado en SUMMARY (no es código).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Actualizar test "rollback atómico" con hook `_throwOnUnidadCreate` para GREEN</name>
  <files>apps/sistema-modular/src/services/__tests__/ventaLoaner.test.ts</files>
  <behavior>
    - El test "rollback atómico" deja de ser `assert.fail('RED: ...')` y se convierte en assert real.
    - El test setea `state._throwOnUnidadCreate = true`, invoca registrarVenta, espera throw, y luego verifica que:
      - `state.collections.loaners[0].estado === 'en_base'` (NO cambió a 'vendido')
      - `state.collections.loaners[0].venta` sigue siendo undefined/null (NO se asignó)
      - `state.collections.unidades.length === 0` (no se creó nada)
      - `state.collections.movimientosStock.length === 0` (no se creó nada)
    - Los otros 4 tests del Wave 0 NO se modifican (siguen como estaban — solo cambia su estado RED→GREEN porque ahora el servicio existe).
  </behavior>
  <action>
    1. Localizar el test "rollback atómico: si write falla mid-tx, ningún doc se crea ni modifica" en `ventaLoaner.test.ts` (creado en plan 15-00).

    2. Reemplazar el `assert.fail('RED: requires Wave 2 mock support for _throwOnUnidadCreate')` por:
       ```typescript
       const state = buildFixturePreVinculado();
       (state as any)._throwOnUnidadCreate = true;
       __setTestFirestore(state);

       await assert.rejects(
         () => registrarVenta('lnr-1', {
           fecha: new Date().toISOString(),
           clienteId: 'cli-1',
           clienteNombre: 'Cliente Test',
           costoUnitario: 700,
           monedaCosto: 'USD',
         }),
         /mock: unidad create failed/,
       );

       // Loaner NO cambió
       const loaner = state.collections.loaners[0];
       assert.equal(loaner.estado, 'en_base', 'loaner.estado debe permanecer en_base tras rollback');
       assert.equal(loaner.activo, true, 'loaner.activo debe permanecer true tras rollback');
       assert.ok(!loaner.venta, 'loaner.venta no debe asignarse tras rollback');

       // Nada se creó
       assert.equal(state.collections.unidades.length, 0, 'no se crea UnidadStock tras rollback');
       assert.equal(state.collections.movimientosStock.length, 0, 'no se crea MovimientoStock tras rollback');
       ```

    3. NO modificar los otros 4 tests (happy path pre-vinculado, happy path sin vinculo, guard ya vendido, costo requerido). Solo verificar que sus assertions matchan la implementación del servicio (si alguna assertion necesita ajuste de shape — ej. nombre exacto de un campo del MovimientoStock — corregir el test, no el servicio). El criterio: el servicio implementa lo que dice 15-RESEARCH.md líneas 250-315; los tests assertean ese shape.

    4. Si algún test pre-vinculado falla por mismatch de shape (ej. el test espera `unidad.ubicacion.tipo === 'cliente'` pero el servicio escribió otro nombre), ajustar el TEST (la implementación es la fuente de verdad — sigue 15-RESEARCH.md exacto).
  </action>
  <verify>
    <automated>cd "apps/sistema-modular" && pnpm test:venta-loaner</automated>
  </verify>
  <done>
    - Los 5 tests pasan GREEN (exit code 0).
    - El test "rollback atómico" verifica las 5 condiciones (loaner.estado, loaner.activo, loaner.venta, unidades.length, movimientosStock.length) — todas pasan.
    - El output del test runner muestra "5 pass, 0 fail".
  </done>
</task>

</tasks>

<verification>
- `pnpm --filter @ags/sistema-modular type-check` GREEN.
- `pnpm --filter @ags/sistema-modular test:venta-loaner` GREEN (5/5 tests).
- Full unit suite GREEN: `pnpm --filter @ags/sistema-modular type-check && pnpm --filter @ags/sistema-modular test:venta-loaner && pnpm --filter @ags/sistema-modular test:patron-bom && pnpm --filter @ags/sistema-modular test:equivalencias && pnpm --filter @ags/sistema-modular test:cuotas-facturacion && pnpm --filter @ags/sistema-modular test:stock-amplio` — confirma que el cambio del tipo subtipo no rompió ninguna otra suite.
- `loanersService.ts` ≤ 250 LOC; si supera, extraer a `loanersVentaHelpers.ts` antes de cerrar el plan (precedente Phase 14).
- Pitfalls verificados manualmente: el SUMMARY debe listar los 6 pitfalls con su mitigación aplicada (referenciando líneas del código nuevo).
</verification>

<success_criteria>
- VLN-02 cubierto: una sola `runTransaction` atómica con guard idempotencia, audit post-commit, DI hook para tests.
- 5 tests RED del Wave 0 ahora GREEN.
- Wave 3 (UI) puede llamar `loanersService.registrarVenta(id, { ...payload, costoUnitario, monedaCosto }, articuloRecienVinculado)` y recibir `{ unidadId, movimientoId }`.
- Cero archivos en `apps/reportes-ot/` o `apps/portal-ingeniero/` tocados.
- `useLoaners.registrarVenta` (wrapper) NO se toca en este plan — se decide en Wave 3 si se mantiene o elimina (verificación con grep ya hizo: solo el propio `useLoaners.ts` se importa a sí mismo en el módulo).
</success_criteria>

<output>
After completion, create `.planning/phases/15-stock-venta-de-loaner-espejo-a-stock/15-02-SUMMARY.md` con:
- Commit hashes (W2 RED→GREEN: cuántos commits, qué cambió en cada uno).
- Conteo final de LOC de `loanersService.ts` (antes vs después) — confirmar ≤ 250 o explicar extracción a `loanersVentaHelpers.ts`.
- Output completo de `pnpm test:venta-loaner` (5/5 GREEN).
- Validación de los 6 pitfalls aplicados (grep counts de getCreateTrace/getUpdateTrace/tx.get/creadoPor en el código nuevo).
- Próximo plan: 15-03 (UI extension + UAT manual).
</output>
