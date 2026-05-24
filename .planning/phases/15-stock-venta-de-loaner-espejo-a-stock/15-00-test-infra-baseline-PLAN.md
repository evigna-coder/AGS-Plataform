---
phase: 15-stock-venta-de-loaner-espejo-a-stock
plan: 00
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/sistema-modular/src/services/__tests__/ventaLoaner.test.ts
  - apps/sistema-modular/src/services/__tests__/fixtures/ventaLoaner.ts
  - apps/sistema-modular/scripts/test-venta-loaner.ts
  - apps/sistema-modular/package.json
autonomous: true
requirements:
  - VLN-04
must_haves:
  truths:
    - "Quick command `pnpm --filter @ags/sistema-modular test:venta-loaner` exists and is runnable"
    - "Suite RED baseline: 5 tests para VLN-02a..e fallan con error claro (servicio aún no existe)"
    - "Cada test sigue el patrón Phase 13/14 (__setTestFirestore DI + fixtures in-memory) — Wave 2 solo cambia las assertions de RED→GREEN al implementar el servicio"
  artifacts:
    - path: "apps/sistema-modular/src/services/__tests__/fixtures/ventaLoaner.ts"
      provides: "MockVentaLoanerState type + 3 fixtures (PRE_VINCULADO, SIN_ARTICULO, YA_VENDIDO)"
      contains: "MockVentaLoanerState"
    - path: "apps/sistema-modular/src/services/__tests__/ventaLoaner.test.ts"
      provides: "5 RED tests con node:test (VLN-02a..e)"
      contains: "happy path pre-vinculado"
    - path: "apps/sistema-modular/scripts/test-venta-loaner.ts"
      provides: "tsx runner re-exportando ventaLoaner.test.ts"
      min_lines: 1
    - path: "apps/sistema-modular/package.json"
      provides: "script test:venta-loaner registrado"
      contains: "test:venta-loaner"
  key_links:
    - from: "apps/sistema-modular/package.json"
      to: "apps/sistema-modular/scripts/test-venta-loaner.ts"
      via: "script test:venta-loaner ejecuta tsx scripts/test-venta-loaner.ts"
      pattern: "test:venta-loaner.*tsx.*test-venta-loaner"
    - from: "apps/sistema-modular/scripts/test-venta-loaner.ts"
      to: "apps/sistema-modular/src/services/__tests__/ventaLoaner.test.ts"
      via: "re-export / import side-effect runner"
      pattern: "import.*ventaLoaner.test"
---

<objective>
Crear el Wave 0 RED baseline para Phase 15: fixtures mock, 5 tests RED (VLN-02a..e), script tsx runner, y entrada en `package.json`. Este plan NO implementa el servicio — solo establece el suelo de tests que Wave 2 va a girar a GREEN al implementar `loanersService.registrarVenta` transaccional.

Purpose: precedente Phase 14 (plan 14-00) y Phase 13 — la baseline RED garantiza que Wave 2 NO puede ser declarado completo hasta que las 5 expectativas pasen. Sin esto, hay riesgo de implementar el servicio sin verificar guard de idempotencia o rollback atómico.

Output: 4 archivos nuevos/modificados que dejan disponible `pnpm --filter @ags/sistema-modular test:venta-loaner` con 5 tests fallando con error tipo "registrarVenta is not a function" o similar (RED esperado).
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/15-stock-venta-de-loaner-espejo-a-stock/15-CONTEXT.md
@.planning/phases/15-stock-venta-de-loaner-espejo-a-stock/15-RESEARCH.md
@.planning/phases/15-stock-venta-de-loaner-espejo-a-stock/15-VALIDATION.md

<!-- Precedentes 1:1 a CALCAR -->
@apps/sistema-modular/scripts/test-patron-bom.ts
@apps/sistema-modular/src/services/__tests__/equivalencias.test.ts
@apps/sistema-modular/src/services/__tests__/fixtures/equivalencias.ts

<interfaces>
<!-- Shape esperado del servicio que Wave 2 va a construir (estos tests asumen esta firma) -->
<!-- Source: 15-RESEARCH.md líneas 198-340 (RegistrarVentaParams + RegistrarVentaResult) -->

```typescript
// El test importa desde loanersService (estos exports NO existen aún — RED esperado):
import { registrarVenta, __setTestFirestore } from '../loanersService';

export interface RegistrarVentaParams {
  loanerId: string;
  venta: {
    fecha: string;
    clienteId: string;
    clienteNombre: string;
    precio?: number | null;
    moneda?: 'ARS' | 'USD' | null;
    presupuestoId?: string | null;
    presupuestoNumero?: string | null;
    notas?: string | null;
    costoUnitario: number;        // NEW required en Wave 2
    monedaCosto: 'ARS' | 'USD';   // NEW required en Wave 2
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
```

```typescript
// Shape del DI hook (idéntico precedente equivalenciasService/patronesService):
export function __setTestFirestore(state: MockVentaLoanerState | null): void;
```

<!-- Convención del script package.json scripts (mirror línea 24): -->
"test:venta-loaner": "tsx src/services/__tests__/ventaLoaner.test.ts"
<!-- NOTA: 15-VALIDATION.md propuso `tsx src/services/__tests__/ventaLoaner.test.ts` directamente
     en package.json. Mirror estricto Phase 14 (que usa `tsx scripts/test-patron-bom.ts` con runner intermedio).
     Decisión: USAR script intermedio en `scripts/test-venta-loaner.ts` siguiendo Phase 14
     (consistente con precedente más reciente). El script intermedio puede ser de 2 LOC:
     `import './../src/services/__tests__/ventaLoaner.test';` (side-effect import dispara node:test). -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Crear fixtures mock + tipo MockVentaLoanerState</name>
  <files>apps/sistema-modular/src/services/__tests__/fixtures/ventaLoaner.ts</files>
  <action>
    Crear el archivo de fixtures siguiendo 1:1 la convención de `fixtures/equivalencias.ts`.

    Exports requeridos (citas del 15-RESEARCH.md líneas 625-671):

    1. `MockLoaner` interface — refleja el shape mínimo de `Loaner` necesario para los tests:
       `id: string; codigo: string; descripcion: string; articuloId: string | null; articuloCodigo?: string | null; articuloDescripcion?: string | null; serie?: string | null; estado: 'en_base' | 'en_cliente' | 'en_transito' | 'vendido' | 'baja'; activo: boolean; venta?: Record<string, unknown> | null;`

    2. `MockVentaLoanerState` interface — shape del estado in-memory para el DI hook:
       ```typescript
       export interface MockVentaLoanerState {
         collections: {
           loaners: MockLoaner[];
           unidades: any[];           // shape libre — los tests lo asertan campo por campo
           movimientosStock: any[];   // shape libre
         };
       }
       ```

    3. Helper `buildState(overrides: Partial<MockVentaLoanerState['collections']>)` para componer fixtures custom rápido en cada test sin repetir boilerplate.

    4. Tres fixtures exportadas (deep-cloning safe, devolver fresh state en cada call para evitar mutaciones cross-test):
       - `buildFixturePreVinculado()` → Loaner con `articuloId: 'art-A'`, `articuloCodigo: 'EQ-001'`, `articuloDescripcion: 'HPLC repuesto'`, `serie: 'SN-12345'`, `estado: 'en_base'`, `activo: true`. Colecciones `unidades` y `movimientosStock` vacías.
       - `buildFixtureSinArticulo()` → idéntico anterior PERO `articuloId: null`, `articuloCodigo: null`, `articuloDescripcion: null` (loaner que requiere vincular al vender).
       - `buildFixtureYaVendido()` → loaner con `estado: 'vendido'`, `activo: false`, `venta: { fecha: '2026-05-20T10:00:00.000Z', clienteId: 'cli-X', clienteNombre: 'Cliente Previo' }`. Para test del guard idempotency.

    Devolver funciones factory en lugar de constantes para garantizar fresh state (precedente: `fixtures/equivalencias.ts` usa el mismo pattern porque los tests modifican `state.collections` durante el run).

    Pitfall a evitar: NO usar `JSON.parse(JSON.stringify(constant))` para clonar — usar object literals dentro de cada factory (más performante, sin riesgos de pérdida de tipos).
  </action>
  <verify>
    <automated>pnpm --filter @ags/sistema-modular type-check</automated>
  </verify>
  <done>Archivo existe; exporta `MockLoaner`, `MockVentaLoanerState`, `buildState`, `buildFixturePreVinculado`, `buildFixtureSinArticulo`, `buildFixtureYaVendido`; type-check GREEN (el archivo no importa nada de loanersService aún, solo tipos locales).</done>
</task>

<task type="auto">
  <name>Task 2: Crear 5 tests RED + script runner + package.json script</name>
  <files>apps/sistema-modular/src/services/__tests__/ventaLoaner.test.ts, apps/sistema-modular/scripts/test-venta-loaner.ts, apps/sistema-modular/package.json</files>
  <action>
    Paso A — Crear `src/services/__tests__/ventaLoaner.test.ts`:

    Usar `node:test` (`test`, `describe`, `beforeEach`) + `node:assert/strict` (idéntico precedente `equivalencias.test.ts`).

    Importar de loanersService:
    ```typescript
    import { registrarVenta, __setTestFirestore } from '../loanersService';
    import { buildFixturePreVinculado, buildFixtureSinArticulo, buildFixtureYaVendido } from './fixtures/ventaLoaner';
    ```
    (Los imports `registrarVenta` y `__setTestFirestore` NO existen aún en `loanersService.ts` — Wave 2 los va a agregar. Este es el RED esperado. Si Node throw "registrarVenta is not exported", es OK — significa que la baseline RED funciona.)

    `describe('registrarVenta — Phase 15 venta loaner espejo a stock', () => { ... })` con `beforeEach(() => __setTestFirestore(null))` para resetear.

    Los 5 tests (cada uno con name pattern matcheable por VALIDATION.md):

    1. `test('happy path pre-vinculado: crea unidad+movimiento y marca loaner vendido', async () => { ... })`
       - Set fixture PRE_VINCULADO
       - Invoke `registrarVenta({ loanerId: 'lnr-1', venta: { fecha, clienteId: 'cli-1', clienteNombre: 'Cliente Test', costoUnitario: 700, monedaCosto: 'USD', precio: 1000, moneda: 'USD' } })`
       - Assert: loaner.estado === 'vendido', activo === false, venta poblada
       - Assert: collections.unidades.length === 1, unidad tiene articuloId === 'art-A', estado === 'vendido', condicion === 'bien_de_uso', ubicacion.tipo === 'cliente', costoUnitario === 700
       - Assert: collections.movimientosStock.length === 1, movimiento tiene tipo === 'egreso', subtipo === 'venta_loaner', referenciaLoanerId === 'lnr-1', cantidad === 1, destinoTipo === 'cliente', origenTipo === 'baja'
       - Assert: return value `{ unidadId, movimientoId }` no-null y matchea ids de los docs creados

    2. `test('happy path sin vinculo: denormaliza articuloId/Codigo/Descripcion en loaner', async () => { ... })`
       - Set fixture SIN_ARTICULO
       - Invoke con `articuloRecienVinculado: { articuloId: 'art-B', articuloCodigo: 'EQ-NEW', articuloDescripcion: 'HPLC nuevo vinculado' }`
       - Assert: loaner ahora tiene `articuloId === 'art-B'` + codigo + descripcion denormalizados
       - Assert: unidad creada hereda `articuloId: 'art-B'` + `articuloCodigo: 'EQ-NEW'`
       - Assert: movimiento creado hereda `articuloId: 'art-B'`

    3. `test('guard ya vendido: throw "Loaner ya vendido" y no crea docs nuevos', async () => { ... })`
       - Set fixture YA_VENDIDO
       - `await assert.rejects(() => registrarVenta(...), /Loaner ya vendido/)`
       - Assert: collections.unidades.length === 0 (no se creó nada)
       - Assert: collections.movimientosStock.length === 0
       - Assert: loaner.estado sigue siendo 'vendido' SIN modificar la venta original (no machaca el `venta` previo)

    4. `test('rollback atómico: si write falla mid-tx, ningún doc se crea ni modifica', async () => { ... })`
       - Set fixture PRE_VINCULADO con un hook custom: `state._throwOnUnidadCreate = true` (Wave 2 va a implementar este hook en el path de tests). Por ahora dejar este test con un TODO comment + assert.fail() para que falle RED.
       - Documentar en comment dentro del test: "Wave 2: agregar soporte `_throwOnUnidadCreate` en `_registrarVentaInTest` que throw después del update loaner pero antes del set unidad — verifica que el resultado sea: loaner SIN cambios + 0 unidades + 0 movimientos".
       - Por ahora: `assert.fail('RED: requires Wave 2 mock support for _throwOnUnidadCreate')`.

    5. `test('costo requerido: throw "Costo requerido" antes de la tx si falta costoUnitario o monedaCosto', async () => { ... })`
       - Set fixture PRE_VINCULADO
       - Invoke SIN `costoUnitario` (omit del payload) → `await assert.rejects(() => registrarVenta(...), /Costo requerido/i)`
       - Assert: collections.unidades.length === 0 + movimientosStock.length === 0 (no entró a la tx)
       - Repetir con `monedaCosto: undefined`

    Paso B — Crear `scripts/test-venta-loaner.ts` (mirror `scripts/test-patron-bom.ts`):
    ```typescript
    // Side-effect import dispara node:test runner automáticamente
    import '../src/services/__tests__/ventaLoaner.test';
    ```

    Paso C — Modificar `package.json` para agregar el script al objeto `scripts` (después de la línea 24 `test:patron-bom`):
    ```json
    "test:venta-loaner": "tsx scripts/test-venta-loaner.ts",
    ```
    Mantener el orden alfabético-ish del bloque test:* y validar que el JSON sigue siendo válido (sin coma colgante final).
  </action>
  <verify>
    <automated>cd "apps/sistema-modular" && pnpm test:venta-loaner; echo "EXIT=$?"</automated>
  </verify>
  <done>
    - `ventaLoaner.test.ts` existe con 5 tests bajo `describe('registrarVenta...')`.
    - `scripts/test-venta-loaner.ts` existe y hace side-effect import al test file.
    - `package.json` tiene el script `test:venta-loaner` que ejecuta tsx sobre el runner.
    - Comando `pnpm test:venta-loaner` corre y FALLA con error tipo `SyntaxError: The requested module '../loanersService' does not provide an export named 'registrarVenta'` (o similar) — RED esperado. EXIT != 0. No errores de parsing/sintaxis del test file.
    - El test "rollback atómico" falla con el mensaje "RED: requires Wave 2 mock support for _throwOnUnidadCreate" (intencional).
    - `pnpm --filter @ags/sistema-modular type-check` también puede fallar por imports inexistentes — eso es Wave 2 GREEN, no este task.
  </done>
</task>

</tasks>

<verification>
- `pnpm --filter @ags/sistema-modular test:venta-loaner` se ejecuta (script registrado en package.json).
- Los 5 tests fallan con mensajes claros que indican qué falta (servicio no implementado).
- Estado RED documentado en SUMMARY: lista de tests + razón del red (espera Wave 2).
- type-check puede fallar transientemente por imports del test apuntando a exports inexistentes; eso es esperado y se resuelve en Wave 2.
</verification>

<success_criteria>
- Wave 0 deja el suelo listo para que Wave 2 conviértalo RED→GREEN al implementar el servicio.
- 5 tests con name patterns que VALIDATION.md `Per-Task Verification Map` puede invocar via `--test-name-pattern` filter (citados en VLN-02a..e).
- Cero código de producción tocado en este plan (solo fixtures + tests + script + 1 línea en package.json).
- Cero archivos en `apps/reportes-ot/` o `apps/portal-ingeniero/` tocados.
</success_criteria>

<output>
After completion, create `.planning/phases/15-stock-venta-de-loaner-espejo-a-stock/15-00-SUMMARY.md` con:
- Lista de los 5 tests RED + razón del fallo de cada uno
- Comando `pnpm --filter @ags/sistema-modular test:venta-loaner` y su output (head + tail)
- Confirmación de que VALIDATION.md "Per-Task Verification Map" tiene los `--test-name-pattern` valid (matcheable contra los `test('...')` names creados)
- Próximo plan: 15-01 (extensión de tipos).
</output>
