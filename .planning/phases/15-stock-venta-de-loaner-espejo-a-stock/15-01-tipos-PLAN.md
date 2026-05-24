---
phase: 15-stock-venta-de-loaner-espejo-a-stock
plan: 01
type: execute
wave: 2
depends_on:
  - "15-00"
files_modified:
  - packages/shared/src/types/index.ts
autonomous: true
requirements:
  - VLN-01
must_haves:
  truths:
    - "`MovimientoStock.subtipo` acepta el literal `'venta_loaner'` (además del existente `'conversion'`)"
    - "`MovimientoStock.referenciaLoanerId?: string | null` está declarado y es opcional/nullable"
    - "`MovimientoStock.referenciaLoanerCodigo?: string | null` está declarado y es opcional/nullable"
    - "`VentaLoaner.costoUnitario?: number | null` está declarado y es opcional/nullable (el 'required en modal' es UX, no de tipo)"
    - "`VentaLoaner.monedaCosto?: 'ARS' | 'USD' | null` está declarado y es opcional/nullable"
    - "`pnpm --filter @ags/sistema-modular type-check` GREEN — ningún consumidor existente se rompe (backwards-compat por opcionalidad)"
  artifacts:
    - path: "packages/shared/src/types/index.ts"
      provides: "5 type extensions (1 union widening + 4 nuevos campos opcionales)"
      contains: "venta_loaner"
  key_links:
    - from: "packages/shared/src/types/index.ts"
      to: "apps/sistema-modular/src/services/loanersService.ts"
      via: "import { Loaner, VentaLoaner, MovimientoStock } from '@ags/shared'"
      pattern: "venta_loaner"
---

<objective>
Extender los tipos `MovimientoStock` y `VentaLoaner` en `@ags/shared` con los 5 campos nuevos de Phase 15 — todos backwards-compat (opcionales/nullable, union widening puro). Sin esto, Wave 2 (service) no compila.

Purpose: precedente Phase 13 STKE-01 + Phase 14 BOM-01 — los tipos foundation se mergean ANTES del service para evitar back-and-forth de TS errors durante la implementación del servicio transaccional.

Output: 1 archivo modificado (`packages/shared/src/types/index.ts`) con 5 cambios diff-able. `type-check` GREEN para los 3 apps (modular + reportes + portal).
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/15-stock-venta-de-loaner-espejo-a-stock/15-CONTEXT.md
@.planning/phases/15-stock-venta-de-loaner-espejo-a-stock/15-RESEARCH.md

<!-- Archivo a modificar — leer el bloque actual antes de tocar -->
@packages/shared/src/types/index.ts

<interfaces>
<!-- Líneas exactas del file a modificar (Source: 15-RESEARCH.md líneas 553-589) -->

<!-- A. EXISTENTE en index.ts ~líneas 2779-2826 (MovimientoStock interface) -->
<!-- Buscar el bloque actual: `subtipo?: 'conversion';` (Phase 13 STKE-01) -->
<!-- MODIFICAR a: `subtipo?: 'conversion' | 'venta_loaner';` -->

<!-- B. AGREGAR después del subtipo (mismo bloque MovimientoStock): -->
/**
 * Phase 15 — id del Loaner cuando subtipo='venta_loaner'.
 * Permite query "movimientos de venta de tal loaner". Null/omitido en movimientos no-venta-loaner.
 */
referenciaLoanerId?: string | null;
/**
 * Phase 15 — código del Loaner (LNR-NNNN) denormalizado en el momento del write.
 * Sigue patrón `articuloCodigo` ya denormalizado en MovimientoStock — evita join al renderizar listas históricas.
 */
referenciaLoanerCodigo?: string | null;

<!-- C. EXISTENTE en index.ts ~líneas 3209-3218 (VentaLoaner interface) -->
<!-- Bloque actual aproximado:
export interface VentaLoaner {
  fecha: string;
  clienteId: string;
  clienteNombre: string;
  precio?: number | null;
  moneda?: 'ARS' | 'USD' | null;
  presupuestoId?: string | null;
  presupuestoNumero?: string | null;
  notas?: string | null;
}
-->
<!-- AGREGAR al final del bloque (antes del `}` de cierre): -->
/**
 * Phase 15 — costo del activo (lo que valió el equipo).
 * Separado de `precio` que es revenue. Se carga manual en LoanerVentaModal y se denormaliza
 * en UnidadStock.costoUnitario del espejo. Required en el modal de Phase 15 (validación UI),
 * opcional en el tipo para no romper VentaLoaner pre-existentes.
 */
costoUnitario?: number | null;
/** Phase 15 — moneda del costoUnitario. Required en el modal de Phase 15. */
monedaCosto?: 'ARS' | 'USD' | null;
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extender MovimientoStock.subtipo + agregar referenciaLoanerId/Codigo</name>
  <files>packages/shared/src/types/index.ts</files>
  <behavior>
    - `MovimientoStock.subtipo` debe aceptar tanto `'conversion'` (existente) como `'venta_loaner'` (nuevo) sin TS error.
    - `MovimientoStock.referenciaLoanerId` y `referenciaLoanerCodigo` son opcionales y aceptan `null`.
    - Consumidores existentes que solo leen `subtipo === 'conversion'` no rompen (union widening = backwards-compat).
    - Test pasa: type-check del package shared + del app sistema-modular.
  </behavior>
  <action>
    1. Leer el archivo completo (es grande, ~3500 LOC). Localizar el bloque `export interface MovimientoStock` (alrededor de línea 2779 según 15-RESEARCH.md "Sources").

    2. Localizar la línea `subtipo?: 'conversion';` (Phase 13 STKE-01) — verificar texto exacto (puede tener un comentario JSDoc encima).

    3. Modificar el tipo del campo a la union widened:
       ```typescript
       subtipo?: 'conversion' | 'venta_loaner';
       ```
       Mantener el comentario JSDoc existente y AGREGAR una línea adicional al doc explicando que `'venta_loaner'` se usa con `tipo: 'egreso'` en el espejo del Loaner vendido (Phase 15).

    4. Inmediatamente después del campo `subtipo`, agregar los dos campos nuevos con sus JSDoc (el bloque exacto está en `<interfaces>` arriba). Mantener el estilo de comentarios y la indentación del archivo (verificar 2 vs 4 espacios mirando líneas vecinas).

    5. NO tocar otros campos de MovimientoStock — el resto del struct queda intacto.

    Pitfall a evitar (15-RESEARCH.md Pitfall 8): hacer un grep antes de mergear para confirmar que ningún consumidor tiene exhaustive switch sobre `subtipo`. Comando: `grep -rn "subtipo === 'conversion'" apps/ packages/` — verificación ya hecha en planning (0 matches), pero confirmar localmente.

    Pitfall 2 (carry-forward para Wave 2, no acción aquí pero anotar): el campo `creadoPor` de MovimientoStock es REQUIRED (no opcional) — el servicio de Wave 2 debe poblarlo explícitamente.
  </action>
  <verify>
    <automated>pnpm --filter @ags/shared type-check && pnpm --filter @ags/sistema-modular type-check</automated>
  </verify>
  <done>
    - `index.ts` tiene `subtipo?: 'conversion' | 'venta_loaner';` con JSDoc actualizado.
    - `referenciaLoanerId?: string | null` y `referenciaLoanerCodigo?: string | null` están declarados después de subtipo con JSDoc.
    - `pnpm --filter @ags/shared type-check` GREEN.
    - `pnpm --filter @ags/sistema-modular type-check` GREEN (la app no rompe por el union widening).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Extender VentaLoaner con costoUnitario + monedaCosto</name>
  <files>packages/shared/src/types/index.ts</files>
  <behavior>
    - `VentaLoaner.costoUnitario?` acepta `number | null` y es opcional.
    - `VentaLoaner.monedaCosto?` acepta `'ARS' | 'USD' | null` y es opcional.
    - Consumidores que crean `VentaLoaner` sin estos campos no rompen (opcional).
    - Test pasa: type-check + el test:venta-loaner avanza un poco (ahora el tipo del payload incluye los campos, aunque sigue RED porque el servicio sigue sin existir).
  </behavior>
  <action>
    1. Localizar el bloque `export interface VentaLoaner` (alrededor de línea 3209 según 15-RESEARCH.md).

    2. Después del último campo existente (`notas?: string | null;`) y antes del `}` de cierre, agregar:
       ```typescript
       /**
        * Phase 15 — costo del activo (lo que valió el equipo).
        * Separado de `precio` que es revenue. Se carga manual en LoanerVentaModal y se denormaliza
        * en UnidadStock.costoUnitario del espejo. Required en el modal de Phase 15 (validación UI),
        * opcional en el tipo para no romper VentaLoaner pre-existentes.
        */
       costoUnitario?: number | null;
       /** Phase 15 — moneda del costoUnitario. Required en el modal de Phase 15. */
       monedaCosto?: 'ARS' | 'USD' | null;
       ```

    3. NO tocar otros campos de VentaLoaner. NO tocar el tipo `Loaner` (NO se agrega `Loaner.costoUnitario?` — el costo vive en VentaLoaner por decisión locked del CONTEXT.md).

    4. NO tocar `EstadoLoaner`, `ESTADO_LOANER_LABELS`, `ESTADO_LOANER_COLORS` (no se agregan estados nuevos en Phase 15).
  </action>
  <verify>
    <automated>pnpm --filter @ags/shared type-check && pnpm --filter @ags/sistema-modular type-check && pnpm --filter @ags/reportes-ot type-check && pnpm --filter @ags/portal-ingeniero type-check</automated>
  </verify>
  <done>
    - `VentaLoaner` tiene los 2 campos nuevos con JSDoc.
    - Los 4 type-checks GREEN (shared + 3 apps).
    - `pnpm --filter @ags/sistema-modular test:venta-loaner` sigue RED pero el ERROR cambió: ahora es "registrarVenta is not exported" (no es type-error de los fixtures por shape mismatch).
  </done>
</task>

</tasks>

<verification>
- `git diff packages/shared/src/types/index.ts` muestra exactamente 2 hunks: uno en MovimientoStock (subtipo widening + 2 campos nuevos) y uno en VentaLoaner (2 campos nuevos).
- Cero cambios en otros archivos.
- Type-check full suite GREEN: `pnpm type-check` (root) corre todas las apps.
- Confirmación: `grep -n "venta_loaner" packages/shared/src/types/index.ts` retorna >= 1 línea (debe matchear el union widened).
</verification>

<success_criteria>
- Wave 2 (15-02 service) puede importar `VentaLoaner` con `costoUnitario`/`monedaCosto` typed correctamente.
- Wave 2 (15-02 service) puede setear `subtipo: 'venta_loaner'` en el MovimientoStock sin TS error.
- Wave 3 (15-03 UI) puede validar los nuevos campos en el modal con TS guidance.
- Cero archivos en `apps/reportes-ot/` o `apps/portal-ingeniero/` tocados.
- Phase 15 invariante "backwards-compat" preservado (campos opcionales, union widening puro).
</success_criteria>

<output>
After completion, create `.planning/phases/15-stock-venta-de-loaner-espejo-a-stock/15-01-SUMMARY.md` con:
- Diff exacto aplicado (citas de líneas modificadas + agregadas)
- Confirmación de type-check GREEN en las 3 apps + shared
- Estado actualizado del Wave 0 test: ahora falla por `registrarVenta is not exported` (no por shape mismatch del payload) — confirma que los tipos están listos para Wave 2.
- Próximo plan: 15-02 (service transaccional + tests GREEN).
</output>
