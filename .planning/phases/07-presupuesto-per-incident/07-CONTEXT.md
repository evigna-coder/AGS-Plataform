# Phase 7: Presupuesto per_incident — Context

**Gathered:** 2026-04-20
**Status:** Ready for planning
**Source:** Auto-captured — user opted for automatic flow. Context refleja decisiones acumuladas tras el mapeo del módulo existente (ver Explore report en conversación).

<domain>
## Phase Boundary

El flow end-to-end del presupuesto tipo `'servicio'` (alias interno de "per_incident") está validado y pulido. La fase NO construye desde cero — audita y cierra un flow que ya tiene ~70% del código escrito para el tipo contrato y compartido con `'servicio'`. Dos entregables:

1. **Audit + fixes del flow `'servicio'` completo** — crear desde ticket / standalone, agregar ítems desde catálogo `ConceptoServicio` con `valorBase` como referencia editable, generar PDF estándar, enviar por mail OAuth, transicionar estados. Identificar qué rompe o no existe y arreglarlo.
2. **Token-first order en envío por mail** — validar OAuth token ANTES de `updateDoc(estado: 'enviado')` en Firestore. Si el token falla, el presupuesto NO cambia de estado.

**Fuera de scope:**
- Construir `per_incident` como tipo de enum nuevo (usamos el `'servicio'` existente — decisión de naming)
- Motor de precios por zona/contrato (Phase 6 diferido)
- Snapshot de `precioUnitarioSnapshot` / `tipoCambioSnapshot` (descartado — cláusula de validez del PDF es el contrato)
- Estado `oc_recibida` nuevo (no se agrega — carga de OC se dispara desde `aceptado` sin estado nuevo)
- Auto-ticket desde presupuesto standalone / auto-generación de OT al aceptar — son Phase 8

</domain>

<decisions>
## Implementation Decisions

### Locked (prior decisions — do not re-debate)

- **Naming: `'servicio'` ≡ per_incident.** El enum `TipoPresupuesto` en `packages/shared/src/types/index.ts:753` ya tiene `'servicio'`. No agregamos `'per_incident'` string nuevo. El roadmap usa "per_incident" como nombre funcional; el código usa `'servicio'`.
- **Precios 100% manuales** (decisión 2026-04-20 — ver `memory/project_pricing_strategy.md`). El `ConceptoServicio.valorBase` es referencia prellenada; el vendedor lo edita siempre. Flag `precioManual` queda implícito.
- **Sin snapshot, sin estado `oc_recibida`** (decisión 2026-04-20). La "oferta válida por N días" del PDF es la protección contractual. El precio vive en `precioUnitario` (campo único, editable). Se mantienen los 6 estados actuales.
- **Cargar OC dispara lógica sin cambio de estado** (cuando se implemente el flow en Phase 8): guarda número + adjunto + fecha, pero el estado sigue siendo `aceptado`.
- **Phase 8 referencias NO se implementan acá.** Auto-ticket desde presupuesto standalone, auto-generación OT al aceptar, derivación a Importaciones, FLOW-01..07 — son todos Phase 8.

### PTYP-01 — Cerrar el flow `'servicio'` end-to-end

- **Editor reutiliza `EditPresupuestoModal.tsx`** con su rama non-contrato (tabla flat `PresupuestoItemsTable.tsx`). Confirmar que al seleccionar `tipo: 'servicio'` el editor renderiza la tabla flat con selector de `ConceptoServicio`, no la tabla jerárquica.
- **Creación:** dos caminos — (a) desde `TicketDetail` con botón "Crear presupuesto" que prefilla cliente + contacto + sistema si está en el ticket; (b) desde `/presupuestos/nuevo` (`PresupuestoNew.tsx`) standalone. Ambos deben funcionar para tipo `'servicio'`.
- **Items:** cada línea usa `ConceptoServicio` como dropdown (SearchableSelect). Al seleccionar un concepto, se prellenan: `descripcion`, `precioUnitario = valorBase` (editable), `categoriaPresupuestoId`. Cantidad, unidad y descuento los completa el usuario. Flag `precioManual` no se expone en UI (implícito `true` siempre).
- **Totales:** subtotal por moneda (soporte MIXTA existente) + IVA/ganancias/IIBB desde `categoriaPresupuestoId` si corresponde. Reutilizar la lógica existente en `PresupuestoItemsTable.tsx`.
- **Condiciones comerciales:** el editor ya tiene `PresupuestoCondicionesEditor.tsx` con plantillas rich-text (Phase 3 pending). Para v2.0: campos freeform (`notasTecnicas`, `garantia`, `validezDias`, `condicionesComerciales`, `aceptacionPresupuesto`). Las plantillas rich-text quedan diferidas con Phase 3.
- **Estados:** arrancan en `borrador`. Al mandar mail → `enviado`. Al cliente aceptar → `aceptado` (disparador manual, Phase 8 agregará la lógica de auto-derivación). No se agregan estados nuevos.
- **List page:** `PresupuestosList.tsx` ya filtra por `tipo`. Confirmar que los filtros y acciones inline funcionan igual para `'servicio'` que para `'contrato'`.

### FMT-01 — PDF tipo `'servicio'` (Editorial Teal)

- **Reutilizar `PresupuestoPDFEstandar.tsx`** (ya existe — dispatcher en `generatePresupuestoPDF.tsx:122-125` lo elige para non-contrato). Polish visual solamente; no reescribir.
- **Checklist a validar:**
  - Header con logo + razón social + CUIT cliente
  - Dirección de establecimiento si hay `establecimientoId`
  - Tabla de ítems con descripción, cantidad, unidad, precio unitario, descuento, subtotal
  - Totales por moneda (MIXTA: mostrar ambas)
  - Bloque de condiciones comerciales al final (notasTecnicas, garantía, validez, aceptación)
  - Fecha de emisión + validez vigente
  - Numeración `PRE-XXXX.NN`
- **Identidad visual:** Editorial Teal (teal-700 primary, Newsreader para títulos, JetBrains Mono para labels de métricas, Inter para body). Este es el template que los otros tipos (partes/mixto/ventas de Phase 10) van a heredar — dejarlo pulido paga interés compuesto.

### FMT-02 — Token-first order en envío por mail

- **Problema (Pitfall 5-A documentado en STATE.md):** hoy `EnviarPresupuestoModal` hace `changeEstado('enviado')` → `requestToken()` → `sendGmail()`. Si `requestToken` falla o expira, el presupuesto queda en `enviado` en Firestore pero el mail nunca salió.
- **Cambio:** invertir el orden a `requestToken()` → `sendGmail()` → `changeEstado('enviado')`. Si el token falla, no se toca Firestore.
- **UX del error:**
  - Token expirado / pop-up cancelado → toast rojo "No se pudo autorizar Gmail" + botón "Reintentar" que vuelve a abrir `requestToken()`. El estado del presupuesto NO cambia.
  - Token OK pero `sendGmail()` falla (red caída, quota, etc.) → toast rojo "Mail no se pudo enviar" + botón "Reintentar" (mantiene el token válido si es reciente). El estado NO cambia.
  - Todo OK → toast verde "Enviado" + estado pasa a `enviado` + `fechaEnvio = today`.
- **Atomicidad Firestore:** el `updateDoc` del estado + `fechaEnvio` pasa en una sola operación. No `runTransaction` (no hay lectura condicional), solo `update` con ambos campos juntos.

### Claude's Discretion

- Exactamente qué toast/snackbar usar (probablemente el existente en la app — leer la convención antes).
- Naming de callbacks internos (`handleEnviarClick`, `onEnvioExitoso`, etc.).
- Si hace falta extraer un hook `useEnviarPresupuesto` o mantener la lógica inline en `EnviarPresupuestoModal`. El criterio: si `EnviarPresupuestoModal` queda >250 líneas, extraer.
- Tests unitarios para el token-first order — si existen tests en el módulo, agregar los casos; si no hay, solo verificación manual.

</decisions>

<specifics>
## Specific Ideas

- El flow `'contrato'` ya ejerce el mismo pipeline (PDF + mail OAuth). Si algo ahí funciona, copiar el approach; si algo rompe, no replicar.
- `EnviarPresupuestoModal` es el único punto de envío — lo usan todos los tipos. Hacer el cambio de token-first ahí beneficia a `'contrato'` también (de yapa).
- La tabla `PresupuestoItemsTable.tsx` es la "flat" — la misma que van a reusar `'partes'`, `'mixto'`, `'ventas'` en Phase 10. Cualquier fix que hagamos acá se amortiza.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`EditPresupuestoModal.tsx`** — editor principal con rama condicional `tipo === 'contrato'` → jerárquico, sino → flat. No reescribir; solo validar el branch non-contrato.
- **`PresupuestoItemsTable.tsx`** — tabla flat con selector de `ConceptoServicio`, soporte MIXTA, categorías tributarias. Pulir si falla.
- **`CreatePresupuestoModal.tsx`** + **`PresupuestoNew.tsx`** — wizards de creación. Validar que el flow de "desde ticket" y "standalone" funcionan para `'servicio'`.
- **`generatePresupuestoPDF.tsx`** (line 122-125 dispatcher) + **`PresupuestoPDFEstandar.tsx`** — PDF pipeline completo con react-pdf. Polish only.
- **`EnviarPresupuestoModal.tsx`** — modal de envío con OAuth. Reordenar las operaciones para token-first.
- **`gmailService.ts`** + **`useGoogleOAuth()` hook** — OAuth Gmail infra ya implementada para contrato.
- **`presupuestosService.ts`** — CRUD completo con subscribe en tiempo real, migración de estados, auto-OT en contrato. No tocar la lógica contrato; solo agregar/ajustar lo que falte para `'servicio'`.
- **Editorial Teal tokens** — ya definidos en `tailwind.config` + `design_system.md` (memoria). Fuentes, colores, tipografía.
- **`ConceptoServicio`** CRUD — ya hay UI (`/presupuestos/conceptos-servicio`) y servicio. El campo `valorBase` se reinterpreta como "tarifa referencial" (sin cambio técnico).

### Established Patterns

- **Servicios Firestore por colección:** `presupuestosService.ts`, `conceptosServicioService.ts` (o donde esté el CRUD de conceptos). Components NO tocan Firestore directo.
- **OAuth Gmail:** `useGoogleOAuth()` ya maneja el token lifecycle. Solo cambia el ORDEN de llamadas.
- **React-PDF** para todos los PDFs de presupuesto. No mezclar con html2pdf (que lo usa `reportes-ot` y es frozen surface).
- **250-line budget:** `EnviarPresupuestoModal` hoy mide ~196 LOC según el Explore report; después del cambio debería quedar cerca pero bajo el budget. Si sube, extraer un hook.
- **MIXTA (multi-moneda):** la tabla y PDF ya soportan. No tocar la lógica.

### Integration Points

- **`TicketDetail.tsx` (o equivalente `LeadDetail`)** — botón "Crear presupuesto" que prefilla cliente + contacto + sistema. Validar que funciona para tipo `'servicio'` (default del dropdown) y que setea el `leadId` en el presupuesto para trazabilidad.
- **`PresupuestosList.tsx`** — filtros por tipo y estado ya andan via `useUrlFilters`. Sin cambios.
- **`EditPresupuestoModal.tsx`** — rama `tipo === 'contrato'` renderiza la tabla jerárquica + wizard de sistemas; rama else renderiza la flat. Si al crear `tipo: 'servicio'` renderiza algo raro, revisar la condicional.
- **State machine:** transiciones `borrador → enviado` (al mandar mail) y `enviado → aceptado` (manual) están en `presupuestosService.updateEstado`. Sin cambios de estados.
- **`PresupuestoCondicionesEditor.tsx`** — editor de notas rich-text. Los campos freeform básicos funcionan; las plantillas rich-text son Phase 3 y quedan deferidas. No bloquea v2.0.

</code_context>

<deferred>
## Deferred Ideas

- **Snapshot de precio / TC al `oc_recibida`** — descartado 2026-04-20 (validity clause es el contrato).
- **Estado `oc_recibida`** — NO se agrega; carga de OC dispara lógica desde `aceptado`.
- **Plantillas rich-text para condiciones comerciales** — Phase 3 diferida con v1.0.
- **Auto-ticket desde presupuesto standalone** — Phase 8 (FLOW-01).
- **Auto-creación de OT al aceptar `'servicio'`** — Phase 8 (FLOW-02). Hoy solo `'contrato'` auto-genera OT; el resto requiere acción manual.
- **Derivación a Importaciones desde items que requieren comex** — Phase 8 (FLOW-03).
- **Motor de precios por zona/contrato** — Phase 6 diferida a post-v2.0.
- **Rename tipo `'servicio'` → `'per_incident'`** — no se hace; mantener nombre actual.
- **Excel export** — Phase 10 (FMT-04..06).

</deferred>

---

*Phase: 07-presupuesto-per-incident*
*Context gathered: 2026-04-20 via automatic flow (no interactive discussion — decisiones acumuladas tras Explore report del módulo Presupuestos + user intent clarified in conversation)*
