# Phase 8 Research — Flujo Automático de Derivación

**Researched:** 2026-04-20
**Domain:** Comercial pipeline orchestration (estados + derivaciones + OC + mail a facturación)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Nueva colección `ordenesCompraCliente` (separada de `ordenesCompra` — OCs internas a proveedores).
- Nuevo estado `'oc_recibida'` en `TicketEstado`.
- Relación N:M entre presupuestos y OCs cliente con back-refs en ambos lados (`ordenesCompraCliente.presupuestosIds[]` + `Presupuesto.ordenesCompraIds[]`, este último ya existe en el tipo).
- **FLOW-01 trigger:** al `markEnviado`; skip si `presupuesto.leadId` ya existe; si `clienteId === null`, registrar `pendingAction` y reintentar cuando se resuelva desde `/admin/revision-clienteid`.
- **FLOW-02 trigger:** carga de OC (modal desde list + detail) — cambia ticket a `oc_recibida`, NO cambia estado del presupuesto (estado inmutable Phase 7).
- **FLOW-03 trigger:** al `aceptado` — genera `Requerimiento` con `condicional: true` si algún item tiene `itemRequiereImportacion`; al anular el presupuesto se cancelan los condicionales ligados.
- **ATP source (Phase 8):** suma simple `disponible + enTransito + reservado` (NO `computeStockAmplio()` — Phase 9).
- **FLOW-04 trigger:** `otService.updateEstadoAdmin(…, 'CIERRE_ADMINISTRATIVO')` → ticket admin + mail facturación (destinatario configurable, default `mbarrios@agsanalitica.com`).
- **FLOW-05 runTransaction obligatorio** en: acceptance con requerimientos, carga OC, cierre administrativo OT.
- **FLOW-06 `pendingActions[]`** en `Presupuesto` — shape `{id, type, reason, createdAt, resolvedAt?, attempts}`. Retry manual desde dashboard.
- **FLOW-07** `/admin/config-flujos` + `/admin/acciones-pendientes`. Rutas registradas en `TabContentManager.tsx` (NO `App.tsx`). Sidebar bajo "Admin". Colección `adminConfig/flujos`.
- **Token-first order** para mail FLOW-04 (Pitfall 5-A heredado de Phase 7).
- **Retry manual** — no backoff automático en v2.0.

### Claude's Discretion
- Nombre exacto del nuevo estado (`'oc_recibida'` preferido).
- Layout del dashboard `/admin/acciones-pendientes` (tabla simple vs card grid).
- Íconos y copy de botones ("Cargar OC", "Reintentar", "Marcar resuelta").
- Posición del modal de carga OC (centrado).
- Responsable Comex: si se configura usuario fijo, usarlo como `aUsuarioId`; si no, `aArea: 'materiales_comex'` sin usuario específico.
- Badge de contador en sidebar.

### Deferred Ideas (OUT OF SCOPE)
- REV-01/02 revisiones con "mantener ambas activas" — diferido post-v2.0; comportamiento v1.0 (anular anterior) se mantiene.
- Retry automático con `nextRetryAt` + backoff — v2.1.
- Múltiples destinatarios CC en mail facturación — v2.1.
- Fallback list de usuarios fijos — v2.1.
- Parseo de email entrantes con OC — out of scope milestone.
- Cloud Function para FLOW-04 mail — client-side en v2.0 via `mailQueue` existente.
- `computeStockAmplio()` — Phase 9 / STKP-01.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FLOW-01 | Auto-ticket de seguimiento al `enviado` si no viene de ticket existente | Hook en `presupuestosService.markEnviado` (l. 401-443, ya existe `TODO(FLOW-06)` en l. 435); reuso `leadsService.create` + `syncFromPresupuesto`. Pitfall: manejar `clienteId === null` via `pendingActions[]` + retry desde `/admin/revision-clienteid`. |
| FLOW-02 | Carga OC del cliente → ticket a `oc_recibida` + deriva | Nueva colección `ordenesCompraCliente`; nuevo servicio `ordenesCompraClienteService`; Modal UI con upload multi-archivo; transacción única que toca `ordenesCompraCliente` + `presupuesto.ordenesCompraIds` + `lead.estado`. |
| FLOW-03 | Derivación auto a Importaciones al `aceptado` + requerimientos condicionales | Hook en `presupuestosService.update(…, {estado: 'aceptado'})` (l. 316-385 ya tiene block de `_generarRequerimientosAutomaticos`); agregar `condicional: boolean` a `RequerimientoCompra`; on `anulado` cancelar condicionales. |
| FLOW-04 | OT `CIERRE_ADMINISTRATIVO` → ticket admin + mail facturación | Hook en `otService.update` (l. 263 — bloque `data.estadoAdmin` ya existe); reusar `mailQueue` pattern (ya usado en `enviarAvisoCierreAdmin` l. 341); destinatario desde `adminConfig/flujos`. |
| FLOW-05 | `runTransaction` en transiciones críticas | Pattern ya usado en `otService.getNextOtNumber` + `contratosService.incrementVisitas`. Firestore limit: 500 writes/tx, todas las reads DEBEN suceder ANTES de las writes. |
| FLOW-06 | `pendingActions[]` + retry manual | Nuevo campo `PendingAction[]` en `Presupuesto`; dashboard `/admin/acciones-pendientes`. Reemplaza el `TODO(FLOW-06)` literal en `presupuestosService.ts:435`. |
| FLOW-07 | UI config `/admin/config-flujos` | Nuevo servicio `adminConfigService` (doc único `adminConfig/flujos`); patrón pre-existente: `RevisionClienteIdPage.tsx` + `ModulosAdminPage.tsx`. Ruta en `TabContentManager.tsx` l. 169-173. Sidebar en `navigation.ts` l. 61-68 bajo "Admin". |
</phase_requirements>

## Executive summary

Phase 8 cierra el pipeline comercial conectando 5 hooks existentes en servicios ya-probados (`presupuestosService.markEnviado/update`, `otService.update`, `leadsService.syncFromPresupuesto/syncFromOT`) con 2 colecciones nuevas (`ordenesCompraCliente`, `adminConfig`) y 1 campo nuevo en `Presupuesto` (`pendingActions[]`). La infra crítica ya existe: `runTransaction` pattern (2 usos actuales), `mailQueue` pattern para envíos async (1 uso), `useEnviarPresupuesto` para token-first OAuth (Phase 7), `useUrlFilters` para list pages admin, y el enum `TicketEstado` con 15 valores donde sumar `oc_recibida`.

**Riesgos puntuales:**
1. **Transaction scope creep** — FLOW-02 toca 3 colecciones (`ordenesCompraCliente`, `presupuestos`, `leads`). Hay que mantener todos los `transaction.get()` al inicio antes de cualquier `transaction.update/set()` (Firestore SDK constraint).
2. **Side-effects fuera de tx** — envío de mail (FLOW-04) NO puede ir dentro de `runTransaction` (I/O red); debe ejecutarse after-commit. Si falla, se registra en `pendingActions[]`. `mailQueue` mitiga esto delegando al Cloud Function de Phase 5.
3. **Retry retroactivo de `pendingActions`** para FLOW-01 cuando se resuelve un `clienteId` pendiente — el hook `leadsService.resolverClienteIdPendiente` (l. 505) no sabe hoy de `pendingActions`. Requiere integración explícita.
4. **Naming collision** `ordenesCompra` vs `ordenesCompraCliente`: collection paths son distintas pero muchos imports viven juntos en `presupuestosService.ts`. Separar en servicio propio.
5. **`TODO(FLOW-06)` literal ya existe** en `presupuestosService.ts:435` — plan debe reemplazarlo, no agregar al lado.

**Primary recommendation:** implementar en 3 waves — (a) infra base (tipos + `adminConfig` + `ordenesCompraCliente` + extender `TicketEstado`), (b) servicios + hooks en orden FLOW-05/06/01/02/03/04, (c) UIs admin + modal OC + badges. Verificar cada wave con Playwright E2E existente (suite 11-full-business-cycle).

## Integration challenges

### 1. `runTransaction` patterns in this codebase

**Survey — solo 2 archivos lo usan hoy:**

| Archivo | Uso actual | Qué demuestra |
|---------|-----------|---------------|
| `otService.ts:15, 52` | `getNextOtNumber` / `getNextItemNumber` — counter doc `_counters/otNumber` con scan-on-init | Single-doc tx read → update ✓ |
| `contratosService.ts:25, 112` | `getNextContratoNumber` (counter) + `incrementVisitas` (get + update del mismo doc) | Single-doc tx ✓ |

**NO hay aún un uso multi-collection multi-doc en el codebase.** Phase 8 es el primero. Firestore permite hasta 500 writes por tx y 500 reads, **pero todas las reads deben ir ANTES de cualquier write**.

**Pattern para Phase 8 FLOW-02 (carga OC) — 3 colecciones:**

```ts
await runTransaction(db, async (tx) => {
  // ── READS PRIMERO (todas) ─────────────────────
  const presSnap  = await tx.get(doc(db, 'presupuestos', presupuestoId));
  const leadSnap  = await tx.get(doc(db, 'leads', leadId));
  const ocRef     = ocId ? doc(db, 'ordenesCompraCliente', ocId) : newDocRef('ordenesCompraCliente');
  const ocSnap    = ocId ? await tx.get(ocRef) : null;

  // ── VALIDACIONES ──────────────────────────────
  if (!presSnap.exists()) throw new Error('Presupuesto no encontrado');
  const pres = presSnap.data() as Presupuesto;
  const lead = leadSnap.exists() ? leadSnap.data() as Lead : null;

  // ── WRITES DESPUÉS (todas) ────────────────────
  if (ocSnap && ocSnap.exists()) {
    tx.update(ocRef, deepCleanForFirestore({
      presupuestosIds: arrayUnion(presupuestoId),  // no — arrayUnion no funciona en tx.update
      // workaround: leer array + merge manual
      updatedAt: Timestamp.now(),
    }));
  } else {
    tx.set(ocRef, deepCleanForFirestore({ ...payload, createdAt: Timestamp.now() }));
  }
  tx.update(presSnap.ref, {
    ordenesCompraIds: [...(pres.ordenesCompraIds || []), ocRef.id],  // merge manual, no arrayUnion
    updatedAt: Timestamp.now(),
  });
  tx.update(leadSnap.ref, {
    estado: 'oc_recibida' as TicketEstado,
    postas: [...(lead?.postas || []), nuevaPosta],  // merge manual
    updatedAt: Timestamp.now(),
  });
});
```

**Gotcha CRÍTICO:** `arrayUnion` / `arrayRemove` / `serverTimestamp` son "sentinel values" que **NO se comportan transaccionalmente** dentro de `runTransaction` — debés leer el array, hacer merge manual, y escribir el array completo. Esto implica que FLOW-02 no puede usar `arrayUnion` como el resto del codebase (p. ej. `leadsService.agregarComentario` l. 334).

**Firestore limits aplicables a Phase 8:**
- 500 writes por tx (no es un problema — Phase 8 hace 3-5 writes max por transición).
- Timeout implícito (~15s); en práctica las tx de Phase 8 tardan <500ms.
- **Nested runTransaction prohibido** — un service method dentro de runTransaction NO puede llamar a otro service que también llame a runTransaction. Los services existentes (`presupuestosService.update`, `leadsService.update`) hacen su propio `batch.commit()` → no compatibles con la tx. Solución: escribir las transiciones críticas **inline** en un nuevo método, no reusar los `.update()` existentes.

**Recomendación concreta:** crear métodos explícitamente transaccionales cuando se requiere atomicidad:
- `presupuestosService.aceptarConRequerimientos(id, requerimientosCondicionales[])` (FLOW-03 + FLOW-05)
- `ordenesCompraClienteService.cargarOC(payload, { presupuestoIds, ticketId })` (FLOW-02 + FLOW-05)
- `otService.cerrarAdministrativamente(otNumber, cierreData)` (FLOW-04 + FLOW-05)

El resto de operaciones (create/update simples) siguen con `batch.commit()` como hoy.

**Confidence:** HIGH — Firestore transaction semantics verificados via `firebase` v12.11 (versión actual en `package.json`); pattern ya existe en el codebase.

---

### 2. `ordenesCompraCliente` collection design

**Disambiguación del naming — crítico:**

| Concepto | Colección Firestore | Tipo TS | Servicio | Propósito |
|----------|---------------------|---------|----------|-----------|
| OC del cliente hacia AGS | `ordenesCompraCliente` (nueva) | `OrdenCompraCliente` (nuevo) | `ordenesCompraClienteService` (nuevo) | Cliente envía OC para oficializar compra de un presupuesto (FLOW-02) |
| OC de AGS hacia proveedor | `ordenes_compra` (existe, snake_case) | `OrdenCompra` (existe) | `ordenesCompraService` (existe en `presupuestosService.ts:572`) | AGS compra a proveedor (restock, insumos) |

**Naming dominante del codebase:** camelCase para colecciones nuevas (ej. `tableCatalog`, `tiposEquipoPlantillas`, `adminConfig`, `featureFlags`). Las snake_case son legacy (`ordenes_compra`, `conceptos_servicio`, `condiciones_pago`, `categorias_presupuesto`). **Usar camelCase `ordenesCompraCliente` en v2.0.**

**File layout recomendado:**

```
apps/sistema-modular/src/services/
├── ordenesCompraClienteService.ts   ← NUEVO (separado)
├── presupuestosService.ts           ← existe; contiene tb. `ordenesCompraService` (OCs internas)
└── adminConfigService.ts            ← NUEVO
```

**No mezclar** `ordenesCompraCliente` en `presupuestosService.ts`. Razón: ya tiene 871 líneas y contiene `ordenesCompraService` (OCs internas) — agregar un tercer service al archivo hace crash-worthy el `guardar archivo` mental. Archivo propio.

**Shape propuesto (agregado a `packages/shared/src/types/index.ts` cerca de `AdjuntoPresupuesto` l. 888):**

```ts
export interface OrdenCompraCliente {
  id: string;
  numero: string;              // ingresado por el vendedor, p.ej. "O-000100445302"
  fecha: string;               // ISO
  clienteId: string;           // no nullable — la OC siempre es de un cliente identificado
  presupuestosIds: string[];   // back-ref N:M
  adjuntos: Array<{
    id: string;
    url: string;
    tipo: 'pdf' | 'jpg' | 'png';
    nombre: string;
    fechaCarga: string;
  }>;
  notas?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  updatedBy?: string | null;
  updatedByName?: string | null;
}
```

**Service shape (basarse en `contratosService.ts` — es el más simple y reciente):**

```ts
export const ordenesCompraClienteService = {
  async getAll(filters?: { clienteId?: string; presupuestoId?: string }): Promise<OrdenCompraCliente[]>;
  async getById(id: string): Promise<OrdenCompraCliente | null>;
  async getByPresupuesto(presupuestoId: string): Promise<OrdenCompraCliente[]>;
  async getByCliente(clienteId: string): Promise<OrdenCompraCliente[]>;
  subscribe(filters, callback, onError): () => void;
  /** Operación transaccional FLOW-02 — NO usar update() simple */
  async cargarOC(
    payload: Omit<OrdenCompraCliente, 'id' | 'createdAt' | 'updatedAt'>,
    context: { leadId?: string | null; presupuestosIds: string[] }
  ): Promise<{ id: string; numero: string }>;
  async update(id: string, data: Partial<OrdenCompraCliente>): Promise<void>;
  async delete(id: string): Promise<void>;
};
```

**Upload de adjuntos:** usar el mismo pattern que `leadsService.uploadAdjuntos` (l. 366) — Firebase Storage bajo `ordenesCompraCliente/{id}/adjuntos/{ts}_{name}`.

**Confidence:** HIGH.

---

### 3. `TicketEstado 'oc_recibida'`

**Ubicación del enum:** `packages/shared/src/types/index.ts:515-530` (15 valores actuales).

**Dónde NO va:** `TicketEstadoSimplificado` (l. 581) — solo 3 valores, `oc_recibida` cae en `'en_proceso'` via `getSimplifiedEstado` (l. 596) — verificar que NO cae en `'finalizado'` ni `'nuevo'` (el mapping actual cubre esto por default).

**Consumidores que HAY QUE ACTUALIZAR** (búsqueda exhaustiva via Grep):

| Ubicación | Tipo de update |
|-----------|----------------|
| `packages/shared/src/types/index.ts:515` | Agregar `'oc_recibida'` al union type |
| `packages/shared/src/types/index.ts:532` (TICKET_ESTADO_LABELS) | Agregar `oc_recibida: 'OC recibida'` |
| `packages/shared/src/types/index.ts:550` (TICKET_ESTADO_COLORS) | Agregar badge color — sugerencia: `'bg-amber-100 text-amber-800'` (entre `esperando_oc` y `en_coordinacion`) |
| `packages/shared/src/types/index.ts:569` (TICKET_ESTADO_ORDER) | Insertar después de `'esperando_oc'` |
| `apps/sistema-modular/src/services/leadsService.ts:17` (PRESUPUESTO_TO_LEAD_ESTADO) | **NO agregar** — la OC NO cambia estado del presupuesto (lock Phase 7); el mapping presupuesto→lead no aplica a `oc_recibida` |
| Filtros de list pages en `LeadsList.tsx` | Verificar que usan `TICKET_ESTADO_ORDER` (filtro dinámico) y no un array hardcodeado |
| `TicketDetail.tsx` / state machine visual | Mostrar el nuevo estado en el timeline |

**Donde el nuevo estado se ESCRIBE:**
- `ordenesCompraClienteService.cargarOC` → dentro de `runTransaction`, `lead.estado = 'oc_recibida'` + append `Posta` con `estadoAnterior: 'presupuesto_enviado' | 'esperando_oc'`.
- `_extractPostaForOCCarga()` helper para generar el `Posta` consistente.

**Idempotencia:** si se carga una segunda OC para el mismo presupuesto y el ticket ya está en `oc_recibida`, la tx es no-op para `lead.estado` pero sí agrega nueva OC al array + nueva Posta.

**Confidence:** HIGH.

---

### 4. OT `CIERRE_ADMINISTRATIVO` hook

**Método exacto:** **NO hay un `updateEstadoAdmin` dedicado**. La transición a `CIERRE_ADMINISTRATIVO` se hace via `ordenesTrabajoService.update(otNumber, { estadoAdmin: 'CIERRE_ADMINISTRATIVO', ... })` (`otService.ts:263-310`). El branching existente ya detecta el cambio de `estadoAdmin` (l. 276-291) y hace:

```ts
if (data.estadoAdmin) {
  try {
    const ot = await this.getByOtNumber(otNumber);
    if (ot?.leadId) {
      await leadsService.syncFromOT(ot.leadId, otNumber, data.estadoAdmin as OTEstadoAdmin);
    }
    if (ot && data.estadoAdmin === 'FINALIZADO') {
      await this._syncPresupuestoOnFinalize(ot).catch(...);
    }
  } catch (err) { ... }
}
```

**Precedente ya-implementado:** `otService.enviarAvisoCierreAdmin` (l. 341-373) que **encola en `mailQueue`** un doc con `type: 'cierre_admin_ot'` — es decir, el mail ya NO se envía desde el browser client-side, se delega a un Cloud Function que consume la cola. **Reusar ESTE pattern** para FLOW-04.

**Caller actual de `enviarAvisoCierreAdmin`:** `useOTDetail.ts:141` — disparado manualmente desde el UI de OTDetail cuando se confirma el cierre. **No** se dispara automáticamente desde `otService.update`.

**Integration point para FLOW-04:**

Opción A (recomendada) — **extender el branching existente en `otService.update`**:

```ts
// l. 276 aprox, dentro del `if (data.estadoAdmin)` block
if (data.estadoAdmin === 'CIERRE_ADMINISTRATIVO') {
  try {
    await this._dispararAvisoFacturacion(otNumber, ot);
  } catch (err) {
    // register pendingAction on linked presupuesto
    await this._registrarPendingAction(ot, 'enviar_mail_facturacion', String(err));
  }
}
```

Opción B — **nuevo método `otService.cerrarAdministrativamente(otNumber, cierreData)`** que envuelve en `runTransaction` el create del ticket admin + update de la OT + encolado del mail. Caller: `useOTDetail.ts` en lugar del flujo actual. Compatible con existing call site (`enviarAvisoCierreAdmin` se puede deprecar o internalizar).

**Recomendación:** Opción B para respetar FLOW-05 (runTransaction atómico para la transición). Opción A deja el ticket admin + mail fuera de tx.

**Campos clave:**
- `WorkOrder.budgets: string[]` — lista de presupuestos ligados; usar para resolver `presupuestoId`(s) y sus `ordenesCompraIds[]` para adjuntar al mail.
- `WorkOrder.leadId` — para generar posta en el ticket original (ya lo hace `syncFromOT`).

**Confidence:** HIGH.

---

### 5. FLOW-04 mail pipeline — reutilización vs nueva

**Reuse decision:**

| Componente | Reuse? | Razón |
|------------|--------|-------|
| `useEnviarPresupuesto` hook | **NO** | Es user-triggered (modal) y asume que hay un componente React con `pdfParams`. FLOW-04 es sistema-triggered desde un service. |
| `sendGmail` de `gmailService.ts` | NO (en v2.0) | Requiere `accessToken` OAuth del usuario logueado en el momento — el cierre admin puede ocurrir mientras el usuario no está logueado o no tiene Gmail scope. |
| **`mailQueue` collection pattern** | **SÍ** | Ya usado por `otService.enviarAvisoCierreAdmin` (l. 354) — encola doc con `{type, status: 'pending', data, createdAt}` y un Cloud Function lo procesa server-side con credenciales de servicio (o SendGrid/Nodemailer). Robusto ante usuario-no-logueado, reintentos, fallos transitorios. |
| `useGoogleOAuth` | NO | Misma razón — sistema-triggered. |

**Implicación Phase 5:** el bootstrap de `functions/` (PREC-03) ya está en el repo. FLOW-04 en v2.0 encola el mail y **depende de que haya un Cloud Function consumer** (que puede implementarse en Phase 9 o ser parte entregable de Phase 8, depende del planner).

**Pragmatismo v2.0:** si el Cloud Function consumer NO está listo, el mail queda en `mailQueue` con `status: 'pending'` → la `pendingAction` `enviar_mail_facturacion` en el presupuesto queda activa → admin ve en `/admin/acciones-pendientes`, manualmente reenvía desde el dashboard (botón "Reintentar" dispara un re-send directo desde el browser con OAuth del admin — requiere UI de compose asistida).

**Recomendación planner:** separar FLOW-04 en dos tareas:
1. `enqueueAvisoFacturacion` en `otService.cerrarAdministrativamente` (encola en `mailQueue`, marca pendingAction).
2. Retry manual desde `/admin/acciones-pendientes` → abre `EnviarPresupuestoModal`-like componente que SÍ usa `useEnviarPresupuesto` con OAuth del admin; si se completa OK, cierra la `pendingAction`.

La implementación del Cloud Function consumer es **Phase 9 territory** per CONTEXT.md deferred ("Cloud Function para FLOW-04 mail — client-side en v2.0 per decisión").

**Re-lectura de CONTEXT.md:** "El mail se envía fuera del transaction (no bloqueante). Si el mail falla → registrar en `pendingActions[]` del presupuesto con `type: 'enviar_mail_facturacion'`." — esto es exactamente el flujo de `mailQueue` + pending action.

**Confidence:** HIGH (pattern existente) / MEDIUM (asunción sobre existencia del consumer — verificar con user si Cloud Function de Phase 5/9 ya procesa `mailQueue` o queda inerte).

## Risk surface

| Riesgo | Gravedad | Mitigación |
|--------|----------|------------|
| **A. `arrayUnion` en runTransaction** — no funciona, degrada silenciosamente a last-write-wins | Alta | Merge manual: `const updated = [...existing, nuevo]; tx.update(ref, { field: updated })`. Documentar como pattern. |
| **B. Nested runTransaction** — llamar `leadsService.update(...)` dentro de `runTransaction(...)` rompe atomicidad | Alta | Los nuevos métodos transaccionales (`cargarOC`, `aceptarConRequerimientos`, `cerrarAdministrativamente`) **deben inline-ar todas las writes**, NO reusar métodos `.update()` existentes. Code review explícito en cada PR. |
| **C. Retry retroactivo `clienteId === null`** — si se crea presupuesto sin clienteId, `pendingAction` queda registrada; cuando admin resuelve desde `/admin/revision-clienteid`, el retry de auto-ticket DEBE disparar antes de que el admin salga de la página | Media | Integrar en `leadsService.resolverClienteIdPendiente` (l. 505) un callback que: (1) busque presupuestos con `pendingActions.some(a => a.type === 'crear_ticket_seguimiento' && !a.resolvedAt)` para ese clienteId, (2) re-ejecute la acción, (3) marque `resolvedAt`. |
| **D. `mailQueue` sin consumer** — si el Cloud Function no procesa la cola, las OTs cerradas administrativamente quedan "silenciosamente rotas" | Media | Dashboard `/admin/acciones-pendientes` muestra `enviar_mail_facturacion` con antigüedad — alarm visual si >7d. Botón reintentar con mail client-side. |
| **E. Carga OC concurrente** — dos vendedores cargando OCs para el mismo presupuesto simultáneamente | Baja | `runTransaction` previene data loss en el array `ordenesCompraIds` (merge manual tras read dentro de tx). |
| **F. `ordenesCompraIds` desincronizado** — si se borra una `ordenesCompraCliente`, el array en el presupuesto queda con IDs zombie | Baja | `delete` en el servicio hace limpieza transaccional (tx.get cada presupuesto listado en `presupuestosIds`, remover el ID, update). Alternativa: scheduled cleanup (Phase 9+). |
| **G. `condicional: true` retroactive cleanup** — al anular presupuesto aceptado, los requerimientos condicionales deben cancelarse. Si el admin modifica manualmente un requerimiento primero (ej. lo marca `comprado`), el cancel debe respetar | Media | En el hook `anulado`: `estado === 'comprado' | 'en_compra'` → **NO cancelar** (ya es gasto comprometido); solo cancelar los `'pendiente' | 'aprobado'`. Documentar en el tipo + validation. |
| **H. `runTransaction` timeout por many reads** — si un presupuesto tiene 100 items y cada uno dispara un `tx.get(articulo)`, puede timeout | Baja en Phase 8 | ATP suma simple no requiere leer articulos dentro de tx — `itemRequiereImportacion` ya está precomputado en el item al momento del edit. Solo leer lo necesario dentro de tx. |
| **I. Pitfall 5-A heredado en FLOW-04** — si se usa la retry client-side (no `mailQueue`), token-first order obligatorio | Alta si se implementa retry client-side | Reusar exactamente `useEnviarPresupuesto` flow stages 1-4 (ver `useEnviarPresupuesto.ts:48`). |
| **J. Badge de contador en sidebar** — si se suscribe a `pendingActions` globalmente causa N reads | Baja | Subscribirse via `onSnapshot` con `where('pendingActions', '!=', [])` o collection group query. Alternativa: count cached cada 60s. |

## Validation Architecture (Nyquist Dimension 8)

`config.json` NO setea `workflow.nyquist_validation: false` → sección **requerida**.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright 1.59.1 (E2E only — no unit test runner configurado en sistema-modular) |
| Config file | `apps/sistema-modular/playwright.config.ts` |
| Quick run command | `pnpm --filter @ags/sistema-modular e2e -- 11-full-business-cycle` (circuito completo — ~3-5min) |
| Full suite command | `pnpm --filter @ags/sistema-modular e2e` |
| Workers | 1 (serial — requerido por test-base con login compartido) |

**Gap crítico:** NO hay test runner unitario (vitest/jest) en sistema-modular. Servicios puros (runTransaction logic, retry loops, mapping functions) no pueden testearse aislados hoy. Phase 8 introduce lógica delicada que se beneficiaría mucho de unit tests.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| FLOW-01 | Crear presupuesto sin ticket → markEnviado → ticket auto-creado | E2E | `pnpm e2e -- 11-full-business-cycle` (extender circuito) | ❌ Wave 0: extender `11-full-business-cycle.spec.ts` step 5-6 |
| FLOW-01 (edge) | `clienteId === null` → registra pendingAction → admin resuelve → retry → ticket creado | E2E | Nuevo spec: `12-pending-actions-retry.spec.ts` | ❌ Wave 0 |
| FLOW-02 | Cargar OC desde list → ticket pasa a `oc_recibida` | E2E | Nuevo spec: `13-oc-cliente-flow.spec.ts` | ❌ Wave 0 |
| FLOW-02 (multi) | Una OC cubre 2 presupuestos → back-refs correctos en ambos lados | E2E | `13-oc-cliente-flow.spec.ts` step 3-4 | ❌ Wave 0 |
| FLOW-03 | Presupuesto con item importación → aceptar → req `condicional: true` creado; anular → req cancelado | E2E | Extender `03-presupuestos.spec.ts` + verificar en `05-stock.spec.ts` (RequerimientosList) | ⚠️ Parcial |
| FLOW-04 | OT `CIERRE_ADMINISTRATIVO` → doc en `mailQueue` + ticket admin creado | E2E | Extender `11-full-business-cycle.spec.ts` step 13-14 (ya existe el flujo hasta cierre admin) | ⚠️ Parcial |
| FLOW-04 (mail content) | Mail contiene adjuntos correctos | Manual | N/A | Manual-only (requiere inbox real) |
| FLOW-05 | `runTransaction` previene race condition multi-user | Manual + E2E smoke | Smoke: `pnpm e2e -- 13-oc-cliente-flow` (doble submit rápido) | ⚠️ Stress test manual |
| FLOW-06 | `pendingAction` persiste + retry manual funciona | E2E | `12-pending-actions-retry.spec.ts` | ❌ Wave 0 |
| FLOW-07 | Config page `/admin/config-flujos` guarda + valida usuario activo | E2E smoke | `pnpm e2e -- 10-smoke-all-pages` (extender para nuevas rutas) | ⚠️ Parcial |

### Sampling Rate
- **Per task commit:** `pnpm --filter @ags/sistema-modular type-check` (rápido, <10s) + smoke E2E del spec afectado (~30-60s c/u).
- **Per wave merge:** `pnpm e2e -- 11-full-business-cycle 12-pending-actions-retry 13-oc-cliente-flow` (~5-8min).
- **Phase gate:** `pnpm e2e` completo (~15-25min) antes de `/gsd:verify-work` para Phase 8.

### Wave 0 Gaps
- [ ] `apps/sistema-modular/e2e/circuits/12-pending-actions-retry.spec.ts` — cubre FLOW-01 edge + FLOW-06 dashboard
- [ ] `apps/sistema-modular/e2e/circuits/13-oc-cliente-flow.spec.ts` — cubre FLOW-02 (carga OC + N:M)
- [ ] Extender `11-full-business-cycle.spec.ts` — añadir assertion sobre `mailQueue` doc al llegar a `CIERRE_ADMINISTRATIVO` (FLOW-04)
- [ ] Extender `10-smoke-all-pages.spec.ts` — agregar `/admin/config-flujos` y `/admin/acciones-pendientes`
- [ ] Helper `e2e/helpers/firestore-assert.ts` — leer docs de Firestore via Admin SDK para validar `pendingActions[]`, `mailQueue` state (si no existe aún)
- [ ] **NO instalar vitest en esta phase** — scope creep. Documentar como deuda técnica para Phase 11 (TEST-01).

### Manual-only justification
- **Mail delivery contenido** (FLOW-04): requiere inbox real y validación humana del PDF adjunto + OC. No automatizable sin mock server + fixture comparison.
- **OAuth popup** (FLOW-04 retry client-side): popup bloqueado en headless Playwright; mock via `page.route('**/oauth2/**')` si se quiere asertar lógica, pero el flujo real queda manual.
- **Race condition real** (FLOW-05): stress test con 2 browsers paralelos — no reproducible determinísticamente en Playwright serial. Manual stress test.

## Reusable helpers & patterns

**NO hand-roll — usar lo que existe:**

| Problema | NO construir | USAR |
|----------|--------------|------|
| Cleanup undefined pre-Firestore | - | `deepCleanForFirestore` / `cleanFirestoreData` (firebase.ts) — hard rule |
| Traza de create/update | - | `getCreateTrace()` / `getUpdateTrace()` (firebase.ts) |
| Batch writes | - | `createBatch()` + `batchAudit()` (firebase.ts) |
| Envío de mail sistema-triggered | Client-side `sendGmail` directo | `mailQueue` collection pattern (`otService.enviarAvisoCierreAdmin`) + Cloud Function consumer |
| Mail user-triggered con OAuth | Re-armar token-first flow | `useEnviarPresupuesto` hook (l. 48) — stages 1-4 + 10s timeout |
| Upload de adjuntos | - | `leadsService.uploadAdjuntos` pattern (l. 366) — Firebase Storage `collection/{id}/adjuntos/{ts}_{name}` |
| Counter atómico | Scan en memoria (slow) | `runTransaction` sobre `_counters/{name}` (ver `otService.getNextOtNumber` l. 15) |
| Filtros URL-persistidos | `useState` para filtros | `useUrlFilters(SCHEMA)` — schema-based tuple `[filters, setFilter, setFilters, resetFilters]` |
| List page admin | - | Patrón `RevisionClienteIdPage.tsx` (simple + útil) o `ModulosAdminPage.tsx` |
| Routing admin nuevo | Editar `App.tsx` | `TabContentManager.tsx:169-173` (bajo `/* Admin */`) + `navigation.ts:61-68` (children bajo "Importar Datos" o nuevo root "Admin") |
| Protección por rol | Hand-roll | `<ProtectedRoute allowedRoles={['admin']}>` |
| State machine de mail | Hand-roll estados en componente | `EnviarStatus` type + hook pattern de Phase 7 |
| Sync ticket estado post-evento | Update manual desde service | `leadsService.syncFromPresupuesto` / `syncFromOT` — hook existente |
| RBAC en transiciones | - | `canUserModifyTicket(ticket, user)` (types/index.ts:501) |

**Patterns específicos Phase 8:**

```ts
// Pattern: pendingAction append inside transaction
function appendPendingAction(
  existing: PendingAction[],
  type: PendingAction['type'],
  reason: string
): PendingAction[] {
  return [
    ...existing,
    {
      id: crypto.randomUUID(),
      type,
      reason,
      createdAt: new Date().toISOString(),
      attempts: 0,
    },
  ];
}

// Pattern: retry mark — resolvedAt on success, attempts++ either way
function markRetried(
  pending: PendingAction,
  success: boolean
): PendingAction {
  return {
    ...pending,
    attempts: pending.attempts + 1,
    ...(success ? { resolvedAt: new Date().toISOString() } : {}),
  };
}

// Pattern: ATP check Phase 8 (pre-Phase 9 refactor point)
// TODO(STKP-01): replace with computeStockAmplio() in Phase 9
function itemRequiresImportacion(articulo: Articulo | null): boolean {
  if (!articulo) return false;
  const disponible = articulo.resumenStock?.disponible || 0;
  const enTransito = articulo.resumenStock?.enTransito || 0;
  const reservado  = articulo.resumenStock?.reservado  || 0;
  return disponible + enTransito + reservado === 0;
}
```

## References

**Services (file_path:line):**
- `apps/sistema-modular/src/services/presupuestosService.ts:401-443` — `markEnviado` + el `TODO(FLOW-06)` literal en l. 435
- `apps/sistema-modular/src/services/presupuestosService.ts:316-385` — bloque `data.estado === 'aceptado'` donde se insertan FLOW-03 hooks
- `apps/sistema-modular/src/services/presupuestosService.ts:227-290` — `_generarRequerimientosAutomaticos` (precedente para requerimientos-condicionales)
- `apps/sistema-modular/src/services/otService.ts:263-310` — `update()` con branching `data.estadoAdmin` (FLOW-04 hook)
- `apps/sistema-modular/src/services/otService.ts:341-373` — `enviarAvisoCierreAdmin` (pattern `mailQueue`)
- `apps/sistema-modular/src/services/otService.ts:15, 52` — `runTransaction` con counter doc pattern
- `apps/sistema-modular/src/services/contratosService.ts:25, 112` — `runTransaction` simple (segundo precedente)
- `apps/sistema-modular/src/services/leadsService.ts:401-439` — `syncFromPresupuesto`
- `apps/sistema-modular/src/services/leadsService.ts:445-479` — `syncFromOT`
- `apps/sistema-modular/src/services/leadsService.ts:505-518` — `resolverClienteIdPendiente` (integration point para retry FLOW-01)
- `apps/sistema-modular/src/services/gmailService.ts:53` — `sendGmail` (no usar directamente en FLOW-04)

**Types (file_path:line):**
- `packages/shared/src/types/index.ts:515-530` — `TicketEstado` union (agregar `oc_recibida`)
- `packages/shared/src/types/index.ts:532-575` — labels/colors/order arrays
- `packages/shared/src/types/index.ts:610-623` — `Posta` interface
- `packages/shared/src/types/index.ts:795-836` — `PresupuestoEstado` + migration
- `packages/shared/src/types/index.ts:880-895` — `AdjuntoPresupuesto` (patrón para adjuntos OC)
- `packages/shared/src/types/index.ts:1061-1130` — `Presupuesto` interface (agregar `pendingActions?`)
- `packages/shared/src/types/index.ts:2642-2671` — `RequerimientoCompra` (agregar `condicional?: boolean` + `canceladoPor?`)

**Hooks (file_path:line):**
- `apps/sistema-modular/src/hooks/useEnviarPresupuesto.ts:48-156` — token-first flow (reference pattern)
- `apps/sistema-modular/src/hooks/useOTDetail.ts:141` — caller actual de `enviarAvisoCierreAdmin`

**Layout & routing:**
- `apps/sistema-modular/src/components/layout/TabContentManager.tsx:169-173` — `/* Admin */` routes section
- `apps/sistema-modular/src/components/layout/navigation.ts:61-68` — sidebar admin entry

**UI precedents (admin pages):**
- `apps/sistema-modular/src/pages/admin/RevisionClienteIdPage.tsx` — patrón list+filter admin
- `apps/sistema-modular/src/pages/admin/ModulosAdminPage.tsx` — patrón config-form admin

**E2E tests:**
- `apps/sistema-modular/e2e/circuits/11-full-business-cycle.spec.ts` — suite a extender para FLOW-01/04
- `apps/sistema-modular/playwright.config.ts` — config verified

**Docs:**
- `.planning/research/PITFALLS.md:134` (2-D), `.planning/research/PITFALLS.md:298` (5-A), `.planning/research/PITFALLS.md:413` (7-A)
- `.planning/STATE.md:60` — decisión `runTransaction` obligatorio

## Metadata

**Confidence breakdown:**
- `runTransaction` patterns: HIGH — 2 usos verificados in-code; Firestore SDK docs confirman limits
- `ordenesCompraCliente` design: HIGH — shape drafteada en CONTEXT + pattern servicio basado en `contratosService`
- `TicketEstado 'oc_recibida'`: HIGH — enum location verified, consumers enumerados por Grep
- OT cierre hook: HIGH — branching existente identificado en l. 263-310 + `mailQueue` pattern en l. 341
- FLOW-04 mail pipeline: MEDIUM — depende de si el Cloud Function consumer está listo; plan safe asume "encolar + retry manual"
- Validation Architecture: HIGH — Playwright config verified; gap de unit tests documentado

**Research date:** 2026-04-20
**Valid until:** 2026-05-20 (30d — patterns estables en este codebase)

## RESEARCH COMPLETE

**Phase:** 8 - Flujo Automático de Derivación
**Confidence:** HIGH

### Key findings
- Solo 2 archivos del codebase usan `runTransaction` hoy (`otService`, `contratosService`), ambos con single-doc pattern; Phase 8 es el primer uso multi-doc multi-collection — documentar "no arrayUnion inside tx" y "reads before writes" como hard rules.
- `mailQueue` pattern ya existe (`otService.enviarAvisoCierreAdmin`) — reusar para FLOW-04 en lugar de llamar a `sendGmail` client-side; retry desde `/admin/acciones-pendientes` sí puede usar `useEnviarPresupuesto` (user-triggered OAuth).
- `TODO(FLOW-06)` literal en `presupuestosService.ts:435` ya está esperando el replacement — plan debe eliminarlo, no agregar código junto.
- Nuevos métodos transaccionales (`cargarOC`, `aceptarConRequerimientos`, `cerrarAdministrativamente`) deben inline-ar TODAS las writes — no reusar `.update()` existentes (nested runTransaction no permitido).
- E2E Playwright disponible; no hay test runner unitario — lógica delicada (retry loops, tx merge manual) queda sólo E2E-coverage. Documentar como deuda para Phase 11 TEST-01.

### Confidence assessment
| Area | Level | Reason |
|------|-------|--------|
| runTransaction integration | HIGH | SDK semantics + in-codebase precedentes verificados |
| ordenesCompraCliente design | HIGH | Shape cerrada en CONTEXT, naming disambiguation resuelto |
| TicketEstado extension | HIGH | 4 puntos de edición en types/index.ts enumerados |
| OT cierre hook | HIGH | Branching existente encontrado + mailQueue pattern disponible |
| FLOW-04 mail pipeline | MEDIUM | Depende de Cloud Function consumer status — asunción segura: "encolar + retry manual" |

### Open questions
1. **Cloud Function consumer de `mailQueue`** — ¿está implementado el consumer en Phase 5 functions bootstrap o solo queda la cola inerte? — recomendar al planner que FLOW-04 marque como "deliverable completo" solo cuando se confirme, sino queda en estado "encolado + retry manual OK".
2. **Nueva sección sidebar "Admin"** vs reusar children de "Importar Datos" — CONTEXT dice "bajo Admin" pero hoy no hay root llamado así. Decisión de UX para el planner: crear root `Admin` con `/admin/importar`, `/admin/revision-clienteid`, `/admin/modulos`, `/admin/config-flujos`, `/admin/acciones-pendientes` como children.

### Ready for planning
Research complete. Planner puede producir PLANs granulares para cada FLOW-NN con file-path accuracy.
