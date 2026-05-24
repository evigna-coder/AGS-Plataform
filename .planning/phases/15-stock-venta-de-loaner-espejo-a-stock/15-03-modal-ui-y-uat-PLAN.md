---
phase: 15-stock-venta-de-loaner-espejo-a-stock
plan: 03
type: execute
wave: 4
depends_on:
  - "15-01"
  - "15-02"
files_modified:
  - apps/sistema-modular/src/components/loaners/LoanerVentaModal.tsx
  - apps/sistema-modular/src/pages/loaners/LoanerDetail.tsx
  - apps/sistema-modular/src/hooks/useLoaners.ts
autonomous: false
requirements:
  - VLN-03
  - VLN-04
must_haves:
  truths:
    - "Cuando `loaner.articuloId` es null al abrir el modal, aparece un SearchableSelect bloqueante 'Vincular artículo del catálogo *' como primer bloque"
    - "Cuando `loaner.articuloId` ya existe, el SearchableSelect NO se muestra (decisión planner: esconder; alternativamente Input readonly — leave a discrecion del implementador, pero documentar)"
    - "Modal tiene inputs nuevos Costo + Moneda costo separados de Precio + Moneda venta — layout 2x2 doble apilado (Precio+Moneda venta arriba, Costo+Moneda costo abajo) por separación visual revenue vs costo"
    - "Validaciones bloqueantes: botón Confirmar venta `disabled` mientras `clienteId == null || articuloIdEfectivo == null || costoUnitario == null || saving === true`"
    - "Si el service throw 'Loaner ya vendido' (guard tx), el modal captura el error y muestra un banner inline rojo (NO toast efímero), NO cierra el modal — el user puede cancelar o entender qué pasó"
    - "Después de venta exitosa, el modal cierra y `LoanerVentaSection` (parent) refresca con `loaner.venta` poblado"
    - "`LoanerDetail.handleVenta` pasa los nuevos params (`costoUnitario`, `monedaCosto`, `articuloRecienVinculado`) al servicio"
    - "`useLoaners.registrarVenta` (wrapper) actualizado para nuevo signature O eliminado (verificación grep: solo `useLoaners.ts` se importa a sí mismo — sin call sites externos del wrapper)"
    - "UAT manual 8 pasos firmado por el user (checklist 15-VALIDATION.md)"
  artifacts:
    - path: "apps/sistema-modular/src/components/loaners/LoanerVentaModal.tsx"
      provides: "Modal extendido (SearchableSelect condicional + costo inputs + banner error)"
      min_lines: 100
    - path: "apps/sistema-modular/src/pages/loaners/LoanerDetail.tsx"
      provides: "handleVenta actualizado con params nuevos"
      contains: "costoUnitario"
    - path: "apps/sistema-modular/src/hooks/useLoaners.ts"
      provides: "registrarVenta consolidado con servicio (actualizado o eliminado)"
  key_links:
    - from: "apps/sistema-modular/src/components/loaners/LoanerVentaModal.tsx"
      to: "apps/sistema-modular/src/pages/loaners/LoanerDetail.tsx"
      via: "onConfirm callback con shape { venta, articuloRecienVinculado }"
      pattern: "onConfirm.*\\("
    - from: "apps/sistema-modular/src/pages/loaners/LoanerDetail.tsx"
      to: "apps/sistema-modular/src/services/loanersService.ts"
      via: "loanersService.registrarVenta(id, venta, articuloRecienVinculado)"
      pattern: "loanersService\\.registrarVenta"
    - from: "apps/sistema-modular/src/components/loaners/LoanerVentaModal.tsx"
      to: "apps/sistema-modular/src/services/stockService.ts"
      via: "articulosService.getAll({ activoOnly: true }) para poblar SearchableSelect cuando loaner.articuloId es null"
      pattern: "articulosService\\.getAll"
---

<objective>
Extender `LoanerVentaModal` con: (a) SearchableSelect condicional para vincular Artículo cuando `loaner.articuloId` es null (bloqueante), (b) inputs Costo + Moneda costo separados de Precio + Moneda venta, (c) banner inline para capturar errores transaccionales del service (`'Loaner ya vendido'`), (d) validaciones bloqueantes extendidas. Actualizar `LoanerDetail.handleVenta` para pasar los nuevos params al servicio Wave 2. Consolidar `useLoaners.registrarVenta` (decisión: eliminar wrapper porque grep confirma 0 call sites externos a `useLoaners.ts` mismo — el hook no usa el método internamente más allá de exportarlo).

Purpose: completar el invariante "venta = espejo siempre" — sin la UI extendida, el flujo del user no puede capturar el costo del activo ni vincular un artículo a un loaner que vino sin uno. Sin el banner inline, los errores transaccionales (race entre tabs) son invisibles para el user.

Output:
- `LoanerVentaModal.tsx` con SearchableSelect + 4 inputs precio/costo + banner error + validaciones.
- `LoanerDetail.handleVenta` actualizado.
- `useLoaners.ts` consolidado (eliminar wrapper o actualizar signature — verificar grep + decidir).
- UAT manual checklist (8 pasos del 15-VALIDATION.md) ejecutado y firmado por el user.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/15-stock-venta-de-loaner-espejo-a-stock/15-RESEARCH.md
@.planning/phases/15-stock-venta-de-loaner-espejo-a-stock/15-CONTEXT.md
@.planning/phases/15-stock-venta-de-loaner-espejo-a-stock/15-VALIDATION.md

<!-- Archivos a modificar -->
@apps/sistema-modular/src/components/loaners/LoanerVentaModal.tsx
@apps/sistema-modular/src/pages/loaners/LoanerDetail.tsx
@apps/sistema-modular/src/hooks/useLoaners.ts

<!-- Atoms a usar (no modificar) -->
@apps/sistema-modular/src/components/ui/SearchableSelect.tsx
@apps/sistema-modular/src/components/ui/Modal.tsx
@apps/sistema-modular/src/components/ui/Input.tsx
@apps/sistema-modular/src/components/ui/Button.tsx

<!-- Precedente UX (Editorial Teal + SearchableSelect + banner error inline) -->
@apps/sistema-modular/src/components/stock/DesagregarStockModal.tsx

<interfaces>
<!-- Signature del servicio (de plan 15-02) -->
loanersService.registrarVenta(
  id: string,
  venta: VentaLoaner & { costoUnitario: number; monedaCosto: 'ARS' | 'USD' },
  articuloRecienVinculado?: { articuloId: string; articuloCodigo: string; articuloDescripcion: string } | null,
): Promise<{ unidadId: string; movimientoId: string }>;

<!-- Props del Modal (mantener compat con caller actual + agregar) -->
<!-- Hoy LoanerVentaModal Props:
  open: boolean;
  onClose: () => void;
  loaner: Loaner;
  onConfirm: (venta: VentaLoaner) => Promise<void>;
-->
<!-- Phase 15 Props (extended): -->
interface Props {
  open: boolean;
  onClose: () => void;
  loaner: Loaner;
  onConfirm: (payload: {
    venta: VentaLoaner & { costoUnitario: number; monedaCosto: 'ARS' | 'USD' };
    articuloRecienVinculado: { articuloId: string; articuloCodigo: string; articuloDescripcion: string } | null;
  }) => Promise<void>;
}

<!-- Convención Editorial Teal labels (mirror existente en LoanerVentaModal + DesagregarStockModal) -->
const lbl = 'block text-[10px] font-mono font-medium text-slate-500 mb-0.5 uppercase tracking-wide';

<!-- SearchableSelect option shape (atom) -->
{ value: string; label: string; linkedCode?: string; subLabel?: string }
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extender LoanerVentaModal con SearchableSelect condicional + costo inputs + banner error</name>
  <files>apps/sistema-modular/src/components/loaners/LoanerVentaModal.tsx</files>
  <action>
    Modificar `LoanerVentaModal.tsx` (hoy 86 LOC; proyectado a ~180 LOC). Cambios:

    1. **Imports nuevos:**
       ```typescript
       import { useState, useEffect, useMemo } from 'react';
       import { SearchableSelect } from '../ui/SearchableSelect';
       import { articulosService } from '../../services/stockService';
       import type { Articulo } from '@ags/shared';
       ```

    2. **Props type updated** (ver `<interfaces>` arriba) — `onConfirm` ahora recibe `{ venta, articuloRecienVinculado }`.

    3. **State adicional:**
       ```typescript
       const [articulos, setArticulos] = useState<Articulo[]>([]);
       const [articuloIdSeleccionado, setArticuloIdSeleccionado] = useState<string>('');
       const [costoUnitario, setCostoUnitario] = useState('');
       const [monedaCosto, setMonedaCosto] = useState<'ARS' | 'USD'>('USD');
       const [error, setError] = useState<string | null>(null);
       ```

    4. **Pre-fetch artículos cuando `loaner.articuloId` es null** (Pitfall 6: usar `{ activoOnly: true }` explícito):
       ```typescript
       useEffect(() => {
         if (!open) return;
         if (loaner.articuloId) return;  // ya vinculado, no necesita picker
         articulosService.getAll({ activoOnly: true })
           .then((arts) => setArticulos(arts))
           .catch((err) => {
             console.error('[LoanerVentaModal] cargando artículos', err);
             setError('No se pudieron cargar los artículos. Reintentá o cancelá.');
           });
       }, [open, loaner.articuloId]);
       ```

    5. **Reset state cuando se abre/cierra el modal** (precedente: behavior existente del modal hoy resetea precio/cliente cuando se cierra):
       ```typescript
       useEffect(() => {
         if (open) {
           setError(null);
           setArticuloIdSeleccionado('');
           setCostoUnitario('');
           setMonedaCosto('USD');
           // mantener reset de los campos pre-existentes (precio, cliente, notas) como ya estaba
         }
       }, [open]);
       ```

    6. **Bloque 1 — SearchableSelect condicional** (insertar como primer bloque dentro del body del Modal, ANTES del bloque cliente):
       ```tsx
       {!loaner.articuloId && (
         <div>
           <label className={lbl}>Vincular artículo del catálogo *</label>
           <SearchableSelect
             value={articuloIdSeleccionado}
             onChange={setArticuloIdSeleccionado}
             options={articulos.map(a => ({
               value: a.id,
               label: a.descripcion ?? a.codigo ?? a.id,
               linkedCode: a.codigo,
             }))}
             placeholder="Buscar artículo..."
             required
           />
         </div>
       )}
       ```
       Decisión visual (CONTEXT.md "Claude's Discretion"): cuando `loaner.articuloId` YA existe, el bloque se ESCONDE completamente (no mostrar Input readonly — info redundante; el header del modal/page ya muestra el artículo asociado al loaner). Documentar en comment dentro del JSX.

    7. **Bloque 3 EXTENDIDO — Precio + Moneda venta + Costo + Moneda costo (grid 2x2 doble apilado)** — reemplazar el bloque actual de precio+moneda con:
       ```tsx
       <div className="grid grid-cols-2 gap-3">
         <Input
           label="Precio de venta"
           type="number"
           value={precio}
           onChange={(e) => setPrecio(e.target.value)}
           placeholder="0.00"
         />
         <div>
           <label className={lbl}>Moneda venta</label>
           <select
             className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
             value={moneda}
             onChange={(e) => setMoneda(e.target.value as 'ARS' | 'USD')}
           >
             <option value="USD">USD</option>
             <option value="ARS">ARS</option>
           </select>
         </div>
       </div>
       <div className="grid grid-cols-2 gap-3 mt-2">
         <Input
           label="Costo del activo *"
           type="number"
           value={costoUnitario}
           onChange={(e) => setCostoUnitario(e.target.value)}
           placeholder="0.00"
           required
         />
         <div>
           <label className={lbl}>Moneda costo *</label>
           <select
             className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
             value={monedaCosto}
             onChange={(e) => setMonedaCosto(e.target.value as 'ARS' | 'USD')}
           >
             <option value="USD">USD</option>
             <option value="ARS">ARS</option>
           </select>
         </div>
       </div>
       ```
       Layout: 2x2 doble apilado para separar visualmente revenue (arriba) de costo (abajo). Editorial Teal consistente. Mantener el grid de cliente y el textarea de notas como están.

    8. **Banner error inline** (insertar como PRIMER elemento del body del Modal, antes de todos los bloques):
       ```tsx
       {error && (
         <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900 mb-3">
           {error}
         </div>
       )}
       ```

    9. **handleConfirm actualizado**:
       ```typescript
       const articuloIdEfectivo = loaner.articuloId || articuloIdSeleccionado || null;
       const articuloRecienVinculado = !loaner.articuloId && articuloIdSeleccionado
         ? (() => {
             const art = articulos.find(a => a.id === articuloIdSeleccionado);
             if (!art) return null;
             return {
               articuloId: art.id,
               articuloCodigo: art.codigo ?? '',
               articuloDescripcion: art.descripcion ?? '',
             };
           })()
         : null;

       const handleConfirm = async () => {
         setError(null);
         setSaving(true);
         try {
           const ventaPayload = {
             fecha: new Date().toISOString(),
             clienteId,
             clienteNombre: clientes.find(c => c.id === clienteId)?.razonSocial ?? '',
             precio: precio ? parseFloat(precio) : null,
             moneda: precio ? moneda : null,
             notas: notas || null,
             costoUnitario: parseFloat(costoUnitario),
             monedaCosto,
           };
           await onConfirm({ venta: ventaPayload, articuloRecienVinculado });
           onClose();
         } catch (e: any) {
           setError(e?.message ?? 'Error al registrar la venta');
         } finally {
           setSaving(false);
         }
       };

       const canConfirm = !!clienteId
         && !!articuloIdEfectivo
         && !!costoUnitario
         && !saving;
       ```

    10. **Botón "Confirmar venta" disabled** según `canConfirm` (la lógica ya existe en el modal actual con `clienteId && precio` — reemplazar por `canConfirm`).

    11. **Verificar al final**: `wc -l LoanerVentaModal.tsx`. Si supera 200 LOC, extraer `LoanerArticuloPicker.tsx` (el bloque condicional del SearchableSelect, ~30 LOC) — precedente Phase 14 que extrajo PatronComponentesEditor cuando el padre llegó cerca de budget. Si supera 250 LOC, OBLIGATORIO extraer (rule `components.md`).

    Pitfalls a evitar:
    - Pitfall 5 (race UI vs tx guard): documentado en SUMMARY — el setSaving + disabled cubre doble click; el banner cubre concurrencia entre tabs.
    - Pitfall 7 (LOC budget): verificar al final.
    - NO inferir `costoUnitario` del precio de venta — son inputs separados con semántica distinta (revenue vs costo del activo).
  </action>
  <verify>
    <automated>pnpm --filter @ags/sistema-modular type-check && pnpm --filter @ags/sistema-modular build</automated>
  </verify>
  <done>
    - LoanerVentaModal.tsx tiene los 3 cambios visuales (SearchableSelect condicional, 4 inputs precio+costo en 2x2 doble apilado, banner error).
    - Validación `canConfirm` correcta: `clienteId && articuloIdEfectivo && costoUnitario && !saving`.
    - `onConfirm` recibe `{ venta, articuloRecienVinculado }`.
    - Type-check + build GREEN.
    - LOC ≤ 200 (idealmente), ≤ 250 (obligatorio); si superó 200, extracción de sub-componente documentada en SUMMARY.
  </done>
</task>

<task type="auto">
  <name>Task 2: Actualizar LoanerDetail.handleVenta + consolidar useLoaners.registrarVenta</name>
  <files>apps/sistema-modular/src/pages/loaners/LoanerDetail.tsx, apps/sistema-modular/src/hooks/useLoaners.ts</files>
  <action>
    Paso A — `LoanerDetail.tsx` (línea 87 según research):

    1. Localizar `handleVenta` actual:
       ```typescript
       const handleVenta = async (data: Omit<VentaLoaner, 'fecha'>) => {
         await loanersService.registrarVenta(loaner.id, { fecha: new Date().toISOString(), ...data });
         // refresh
       };
       ```

    2. Reemplazar por (nueva shape del callback que recibe del modal):
       ```typescript
       const handleVenta = async (payload: {
         venta: VentaLoaner & { costoUnitario: number; monedaCosto: 'ARS' | 'USD' };
         articuloRecienVinculado: { articuloId: string; articuloCodigo: string; articuloDescripcion: string } | null;
       }) => {
         await loanersService.registrarVenta(loaner.id, payload.venta, payload.articuloRecienVinculado);
         // refresh loaner state (loader ya existente — invocar reload)
       };
       ```

    3. Verificar que el JSX que renderiza `<LoanerVentaModal ... onConfirm={handleVenta} />` matchea el nuevo shape del callback (TS guidance debería forzarlo, pero confirmar visualmente).

    4. NO eliminar el reload del loaner post-venta (si ya existía un `refresh()` o equivalente, mantenerlo).

    Paso B — `useLoaners.ts` (línea 101 según research):

    1. Verificar con grep (ya hecho en planning, confirmar localmente):
       ```bash
       grep -rn "useLoaners()" apps/sistema-modular/src --include="*.tsx" --include="*.ts"
       ```
       Resultado esperado: solo el propio `useLoaners.ts` se referencia (auto-import del declarador). NINGÚN componente externo usa `.registrarVenta` del hook.

    2. **Decisión** (CONTEXT.md "Claude's Discretion"): eliminar el wrapper `registrarVenta` del hook (consolidación). El componente que necesita registrar venta llama directo a `loanersService.registrarVenta` (es lo que ya hacían `LoanerDetail.handleVenta` y otros).

       Acción concreta:
       - Eliminar el bloque `const registrarVenta = useCallback(async (id, venta) => { ... }, []);` del hook (líneas 101-108).
       - Eliminar `registrarVenta` del return object (línea 113).
       - Si TS dispara errors en otros componentes que destructuren `registrarVenta` del hook, ese caso significa que el grep no captó algo — revisar y actualizar esos consumidores para que llamen a `loanersService.registrarVenta` directamente.

       Si por alguna razón el grep encuentra un caller activo del wrapper (ej. en una rama de feature flag no obvia), actualizar la signature del wrapper a la nueva (acepta venta + articuloRecienVinculado opcional) en lugar de eliminar.

    3. Documentar la decisión en SUMMARY: "Wrapper eliminado/actualizado; grep confirmó X call sites" + path de los call sites si hubo alguno.
  </action>
  <verify>
    <automated>pnpm --filter @ags/sistema-modular type-check && pnpm --filter @ags/sistema-modular build && pnpm --filter @ags/sistema-modular test:venta-loaner</automated>
  </verify>
  <done>
    - LoanerDetail.handleVenta llama `loanersService.registrarVenta(id, venta, articuloRecienVinculado)` con la nueva signature.
    - useLoaners.ts NO contiene el wrapper `registrarVenta` (o si lo contiene, su signature está actualizada y los call sites lo usan correctamente).
    - Type-check + build + test:venta-loaner GREEN — confirma que el cambio de wiring no rompió nada.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: UAT manual 8 pasos (checklist 15-VALIDATION.md)</name>
  <files>N/A — verificación manual de comportamiento (no modifica archivos)</files>
  <what-built>
    - Modal `LoanerVentaModal` extendido: SearchableSelect condicional cuando loaner.articuloId es null, inputs Precio+Moneda venta y Costo+Moneda costo separados, banner error inline para errores transaccionales del service.
    - Service `loanersService.registrarVenta` transaccional: 1 `runTransaction` con guard idempotency + writes a 3 colecciones + audit post-commit.
    - Wiring actualizado: LoanerDetail.handleVenta + useLoaners consolidado.
  </what-built>
  <action>
    Ejecutar UAT manual de 8 pasos contra la app en dev (`pnpm dev:modular`) o el build (`pnpm build:modular`). Ver `<how-to-verify>` para los pasos exactos. Registrar PASS/FAIL de cada paso en el SUMMARY del plan.
  </action>
  <how-to-verify>
    Ejecutar `pnpm dev:modular` (o el .exe si está actualizado) y completar los 8 pasos del UAT checklist documentado en `.planning/phases/15-stock-venta-de-loaner-espejo-a-stock/15-VALIDATION.md` (sección "UAT manual checklist (8 pasos)"):

    1. Abrir `/loaners`, crear un Loaner test con `articuloId: null` (campo opcional en LoanerEditor).
    2. Abrir `/loaners/<id>` → click "Vender" → modal abre con SearchableSelect "Vincular artículo del catálogo *" visible.
    3. Buscar y seleccionar un Artículo (ej. cualquier HPLC). Cargar Cliente, Precio venta=$1000 USD, Costo=$700 USD, notas="Test Phase 15".
    4. Click "Confirmar venta" → modal cierra → loaner aparece con badge "Vendido"; `LoanerVentaSection` muestra cliente + precio + notas.
    5. Verificar en Firestore Console: `loaners/<id>` tiene `articuloId` poblado + `venta.costoUnitario: 700` + `venta.monedaCosto: 'USD'` + `estado: 'vendido'` + `activo: false`.
    6. Verificar en Firestore Console: nuevo doc en `unidadesStock` (colección `unidades`) con `articuloId` matching + `estado: 'vendido'` + `condicion: 'bien_de_uso'` + `ubicacion.tipo: 'cliente'` + `costoUnitario: 700` + `monedaCosto: 'USD'`.
    7. Verificar en Firestore Console: nuevo doc en `movimientosStock` con `subtipo: 'venta_loaner'` + `referenciaLoanerId: <loaner.id>` + `referenciaLoanerCodigo: <loaner.codigo>` + `cantidad: 1` + `destinoTipo: 'cliente'` + `origenTipo: 'baja'` + `creadoPor` poblado.
    8. Doble-click test (concurrencia): abrir 2 tabs del mismo loaner sin vender, en ambas abrir modal de venta. En tab A confirmar (success). En tab B confirmar → banner inline "Loaner ya vendido", modal NO cierra. Verificar en Firestore que NO se creó una segunda UnidadStock/MovimientoStock.

    Para cada paso, registrar PASS/FAIL en el SUMMARY del plan. Cualquier FAIL implica gap closure plan (16+) post-fase, no se cierra Phase 15.

    Adicional (verificación opcional rápida): cuando `loaner.articuloId` YA existe (segundo loaner test, o el de paso 4 después de vendido — pero ese ya está vendido), abrir el modal y confirmar que el SearchableSelect NO se muestra (queda escondido según decisión visual del planner).
  </how-to-verify>
  <verify>
    <manual>UAT 8 pasos del 15-VALIDATION.md ejecutado en sistema-modular dev/build. Cada paso registrado con PASS/FAIL en el SUMMARY.</manual>
  </verify>
  <done>
    8/8 pasos del UAT registrados como PASS por el user; si algún paso FAIL, escalar a gap closure plan post-fase (no se cierra Phase 15 con UAT incompleto).
  </done>
  <resume-signal>Type "approved" si los 8 pasos del UAT pasaron, "fail: <paso N>" con descripción si alguno falla, o "decision: <ajuste>" si querés cambiar algo del modal antes de cerrar.</resume-signal>
</task>

</tasks>

<verification>
- Type-check GREEN.
- Build GREEN (`pnpm --filter @ags/sistema-modular build`).
- Full unit suite GREEN (5 suites + type-check, comando completo del 15-VALIDATION.md "Full suite command").
- AST lint: `pnpm lint:ast` sin findings nuevos (regla `no-firestore-undefined` cubre los payloads del nuevo método).
- UAT manual: 8/8 pasos firmados por el user en el SUMMARY.
- Conteo final de LOC: LoanerVentaModal.tsx ≤ 250 (Pitfall 7 mitigado).
- Cero archivos en `apps/reportes-ot/` o `apps/portal-ingeniero/` tocados (verificar con `git diff --name-only`).
</verification>

<success_criteria>
- VLN-03 cubierto: UI extendida con picker condicional + costo inputs + banner error + validaciones bloqueantes.
- VLN-04 cubierto: UAT manual checklist firmado.
- Phase 15 invariante cumplido: toda venta del loaner deja espejo en stock (3 docs atómicos), trazable por `subtipo='venta_loaner'` y `referenciaLoanerId`.
- Phase 15 cerrada: usuario puede ejecutar `pnpm --filter @ags/sistema-modular release:minor` (rule `release-flow.md`) — NO incluido en este plan, es responsabilidad del user post `/gsd:verify-work`.
</success_criteria>

<output>
After completion, create `.planning/phases/15-stock-venta-de-loaner-espejo-a-stock/15-03-SUMMARY.md` con:
- Diff resumen de los 3 archivos modificados.
- LOC final de LoanerVentaModal.tsx (antes 86 / después X).
- Decisión sobre useLoaners.registrarVenta: ELIMINADO o ACTUALIZADO + razón (grep result).
- UAT checklist con 8 PASS/FAIL firmados.
- Comando exacto para release surface al user: `pnpm --filter @ags/sistema-modular release:minor && git push origin main && git push origin sistema-modular-v<x.y.z>` (versión bump recomendada: MINOR porque Phase 15 ships feature user-visible — nuevo flujo de venta de loaner con espejo en stock).
- Phase 15 status: COMPLETE.
</output>
