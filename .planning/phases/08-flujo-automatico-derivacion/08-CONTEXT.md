# Phase 8: Estados + OC + Flujo Automático de Derivación - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

El ciclo comercial completo funciona con **derivaciones automáticas** entre áreas:
1. Presupuesto sin ticket de origen → auto-crea ticket de seguimiento al `enviado`
2. Carga de OC del cliente → notifica al coordinador OT + deriva a Importaciones si aplica
3. Cierre administrativo de OT → crea ticket interno a Administración + mail al contable
4. Errores de derivación → registrados en `pendingActions[]` + dashboard admin

Fuera de scope:
- Motor de precios por zona/contrato (Phase 6 diferido)
- Rename `leads/` → `tickets/` (no esta fase)
- Cloud Function real para aggregation (Phase 9 STKP-02)
- REV-01/02 revisiones con "mantener ambas activas" → **DIFERIDO** a post-v2.0; comportamiento actual (anular anterior) se mantiene

</domain>

<decisions>
## Implementation Decisions

### Prior decisions carrying forward

- **Presupuesto NO tiene estado `oc_recibida`** (lock de Phase 7). Los 6 estados actuales del presupuesto siguen. El **ticket** sí puede tener `oc_recibida` (más granularidad operativa).
- **`TODO(FLOW-06)` en `presupuestosService.markEnviado`** ya está esperando → esta fase lo reemplaza con el mecanismo de `pendingActions[]`.
- **Validity period del PDF es la protección contractual del precio** (no snapshot técnico — Phase 7 decisión).
- **Client-side triggers** para todo el pipeline comercial; Cloud Functions solo para `updateResumenStock` (Phase 9).
- **Reuso del type `Posta`** ya existente en `Ticket` para logging de derivaciones (de → a, estadoAnterior → estadoNuevo, aArea).

### FLOW-01 — Auto-ticket de seguimiento

- **Trigger:** al transicionar el presupuesto a `enviado` por primera vez. NO al crear `borrador`, NO al aceptado. Timing: dentro del `markEnviado` atómico (o inmediatamente después) del Phase 7.
- **Skip si ya existe:** si `presupuesto.leadId` está seteado (el presupuesto vino de un ticket existente), NO crear uno nuevo. El ticket original se usa como seguimiento.
- **Asignación:** usuario fijo configurable en `/admin/config-flujos` (ver área Config).
- **Contenido inicial del ticket:** `motivoContacto: "Presupuesto PRE-XXXX.NN enviado — pendiente OC"`, `estado: 'esperando_oc'`, `areaActual: 'comercial'`, `clienteId` / `contactos` desde el presupuesto.
- **Si `presupuesto.clienteId === null`:** NO bloquear el envío. Registrar acción `{type: 'crear_ticket_seguimiento', reason: 'clienteId null', createdAt, attempts: 0}` en `presupuesto.pendingActions[]`. Cuando el admin resuelve el clienteId desde `/admin/revision-clienteid`, se dispara un retry automático de las pendingActions de ese presupuesto.

### FLOW-02 — Carga de OC

- **Modelo N:M:** una OC del cliente puede cubrir múltiples presupuestos Y un presupuesto puede tener múltiples OCs. **Nueva colección** `ordenesCompraCliente` (separada de `ordenesCompra` que son OCs internas a proveedores — **disambiguación clara**). Shape mínimo:
  ```ts
  interface OrdenCompraCliente {
    id: string;
    numero: string;              // ingresado por el vendedor
    fecha: string;               // ISO
    clienteId: string;
    presupuestosIds: string[];   // back-ref
    adjuntos: Array<{ url: string; tipo: 'pdf' | 'jpg' | 'png'; nombre: string }>;
    createdAt: string;
    createdBy: string;
  }
  ```
  El campo existente `Presupuesto.ordenesCompraIds: string[]` se usa como back-ref (ya existe — solo se empieza a poblar).

- **Formato de adjunto:** PDF, JPG, PNG. Multi-archivo por OC permitido (cliente puede mandar foto de OC firmada + PDF del legajo).

- **UI:** modal accesible desde **list + detail** del presupuesto. Botón/acción "Cargar OC" abre modal con:
  - Select de OC existente del cliente (si ya cargó una anterior) o "+ Nueva"
  - Si nueva: campos `numero` + `fecha` + upload multi-archivo
  - Checkbox opcional "Esta OC cubre otros presupuestos pendientes de este cliente" (solo si hay otros sin OC)
  - Submit ejecuta en `runTransaction`: crea/actualiza `ordenesCompraCliente` + update `presupuesto.ordenesCompraIds` + update `ticket.estado` + crea pendiente condicional (ver abajo)

- **Efecto del disparo (FLOW-02 core):**
  - **Presupuesto:** NO cambia de estado (queda `aceptado` — Phase 7 lock).
  - **Ticket de seguimiento:** cambia a nuevo estado `oc_recibida` (hay que agregar al enum `TicketEstado`).
  - **Pendiente condicional generado:**
    - Si el presupuesto tiene ítems que requieren importación → `"pendiente_importacion"` (ticket deriva al área Importaciones vía `Posta` apuntando al responsable Comex fijo o al área sin usuario específico — depende del Claude's Discretion)
    - Si no → `"pendiente_coordinacion"` (ticket deriva al coordinador OT fijo con `aUsuarioId`)
  - **Atomicidad:** todas las escrituras en `runTransaction` (STKP-03 adelantado aquí donde aplica a ticket + presupuesto + OC).

### FLOW-03 — Derivación a Importaciones

- **Trigger:** al transicionar el presupuesto a `aceptado`. Si hay ítems que requieren importación → auto-crear requerimiento (`requerimientoImportacion`) + derivar ticket al área Importaciones.
- **Detección "requiere importación":** **automática por ATP** en el momento que se agrega el ítem al presupuesto. NO hay flag manual en el item. Se computa: `disponible + enTransito + reservado === 0` para ese `stockArticuloId` → flag interno `itemRequiereImportacion: true` en el `PresupuestoItem`. Se refresca en cada edit del ítem.
  - **ATP source en Phase 8:** suma simple de los 3 campos existentes. Cuando Phase 9 formalice `computeStockAmplio()` se refactoriza. Documentar el point of change claramente.
  - **Consumibles/servicios sin stockArticuloId:** `itemRequiereImportacion = false` (no aplica).

- **Condicionalidad del requerimiento:**
  - Requerimiento se crea con flag `condicional: true` (campo nuevo en el tipo `Requerimiento`).
  - Si el presupuesto después se `anulado` → **todos los requerimientos con `condicional: true` ligados a ese presupuesto se auto-cancelan** (`estado: 'cancelado'` + `canceladoPor: 'presupuesto_anulado'`).
  - En la lista de requerimientos, los condicionales muestran badge "Condicional" con link al presupuesto origen.

- **Posta en el ticket:** deriva a área Importaciones (sin `aUsuarioId` obligatorio — depende si hay usuario fijo configurado para "importaciones" o es gate por rol).

### FLOW-04 — Aviso a Facturación (cierre OT)

- **Trigger:** `otService.updateEstadoAdmin(otId, 'CIERRE_ADMINISTRATIVO')` → dispara:
  - Crear ticket interno al área `administracion` (estado `nuevo`, área `administracion`, descripción "Aviso facturación — OT N° XXX")
  - Enviar mail al contable con: PDF del presupuesto + PDF de la OC del cliente (o múltiples si hay varias) + lista de OTs vinculadas con sus datos clave

- **Destinatario contable:** default `mbarrios@agsanalitica.com`, **configurable** en `/admin/config-flujos`. **Un solo destinatario** (no lista). Si se requieren CC en el futuro, se amplía.

- **Template mail:** asunto `"Aviso facturación — OT {numero}"`; body con resumen: cliente, presupuesto, OC(s), OTs. Adjuntos: PDF presupuesto + imágenes/PDFs de OC(s) + PDFs de OTs si existen.

- **Atomicidad:** el trigger corre dentro del `updateEstadoAdmin` en `runTransaction` (crear ticket + update OT). El mail se envía fuera del transaction (no bloqueante). Si el mail falla → registrar en `pendingActions[]` del presupuesto con `type: 'enviar_mail_facturacion'`.

### FLOW-05 — runTransaction en transiciones críticas

- **Obligatorio en:**
  - `acceptance` (presupuesto → `aceptado`) — si genera requerimientos condicionales, la creación de requerimientos + update de estado en una sola tx
  - `carga_oc` — crear/update `ordenesCompraCliente` + `presupuesto.ordenesCompraIds` + `ticket.estado` + pendiente condicional en una sola tx
  - `cierre_administrativo` (OT) — crear ticket admin + update OT + pendingAction del mail en una sola tx

- **No `runTransaction` en:** operaciones de escritura única simple (edit de item, update de nota, etc).

### FLOW-06 — pendingActions[] + retry

- **Campo en `Presupuesto`:** `pendingActions: PendingAction[]` (array default vacío).
- **Shape de `PendingAction` (mínimo, confirmado):**
  ```ts
  interface PendingAction {
    id: string;
    type: 'crear_ticket_seguimiento' | 'derivar_comex' | 'enviar_mail_facturacion' | 'notificar_coordinador_ot';
    reason: string;        // descripción libre del error
    createdAt: string;     // ISO
    resolvedAt?: string;   // ISO si ya se resolvió
    attempts: number;      // contador de reintentos
  }
  ```
- **No retry automático con backoff schedule en v2.0.** Retry es manual via el dashboard. (Retry programático con `nextRetryAt` queda para v2.1 si se necesita.)
- **Al resolver una action:** setear `resolvedAt` + incrementar `attempts`. Si el retry tuvo éxito, dejar `resolvedAt` seteado. Si falló, incrementar `attempts` pero `resolvedAt` queda null.

### FLOW-07 + Dashboard admin

- **Config page:** `/admin/config-flujos` nueva, rol `admin` only, entrada en sidebar bajo "Admin".
  - 3 `SearchableSelect` de usuario (seguimiento, coordinador OT, contable/admin OT) filtrado por usuarios activos
  - 1 `Input[type=email]` para mail facturación (default `mbarrios@agsanalitica.com`)
  - 1 usuario por rol (no fallback list, no round-robin)
  - Validación al guardar: usuario debe existir + `activo: true`
  - Colección: `adminConfig` con doc único `flujos` → `{ usuarioSeguimientoId, usuarioCoordinadorOTId, mailFacturacion, updatedAt, updatedBy }`
  - Si al momento del disparo el usuario configurado está `activo: false` → registra error en `pendingActions[]` con `type` correspondiente y `reason: "usuario fijo {role} no activo: {userId}"`

- **Dashboard `/admin/acciones-pendientes`:**
  - Lista agregada de todas las `pendingActions` de todos los presupuestos con `resolvedAt === null`
  - Columnas: Tipo | Presupuesto (link) | Cliente | Razón | Creado | Intentos | Acciones
  - Filtros (via `useUrlFilters`): tipo, antigüedad (rangos: <1d, 1-7d, >7d), cliente
  - Botón "Reintentar" por fila → ejecuta la acción original, incrementa `attempts`, setea `resolvedAt` si OK
  - Botón "Marcar resuelta manual" → setea `resolvedAt = Date.now()` sin intentar la acción (para casos "ya lo hice a mano")
  - Contador badge en sidebar si `count > 0` (opcional — Claude's Discretion)

### Claude's Discretion

- Nombre final de la colección `ordenesCompraCliente` — evitar colisión con `ordenesCompra` (ya existe como OC internas a proveedores). Alternativa válida: `ocsClientes` o mantener `ordenesCompraCliente`.
- Nombre exacto del nuevo estado `TicketEstado`: preferencia `'oc_recibida'` pero puede ser `'oc_cargada'` o similar — depende del enum existente.
- Íconos y copy de los botones "Cargar OC" / "Reintentar" / "Marcar resuelta".
- Posición exacta del modal de carga de OC (top-right o centrado).
- Nomenclatura final de `PendingAction.type` strings — mantenerlo consistente con patterns del codebase.
- Layout del dashboard `/admin/acciones-pendientes` (tabla simple vs card grid).
- Derivación a área Importaciones: si existe un "responsable Comex" configurable en `/admin/config-flujos` (análogo al coordinador OT), usarlo como `aUsuarioId`. Si no, dejar `aArea: 'importaciones'` sin usuario específico.

</decisions>

<specifics>
## Specific Ideas

- El flow que se está construyendo es "pipeline comercial end-to-end". Cada gap en derivación automática hoy (Pitfalls documentados en PROJECT/STATE) cuesta tiempo operativo.
- "Condicional" como concepto es clave: el requerimiento de Comex no se compromete hasta que el presupuesto no se anula — protege contra falsos positivos de compras.
- El dashboard de `pendingActions` es la "válvula de escape" — cualquier cosa que el sistema no pudo hacer sola queda visible para resolución humana, no se pierde en logs.
- Mail contable `mbarrios@agsanalitica.com` es dato real del equipo AGS (ver STATE.md).

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`PresupuestoEstado`** (6 valores) en `packages/shared/src/types/index.ts:795-801` — inmutable por decisión Phase 7.
- **`TicketEstado`** enum — **extender con `'oc_recibida'`**. Ubicar en `packages/shared/src/types/index.ts` (buscar cerca del `LeadEstado` deprecated alias).
- **`Posta`** en `packages/shared/src/types/index.ts:610-623` — type existente para logging de derivaciones entre usuarios + áreas. Reusar al mover ticket entre áreas.
- **`TicketArea`** + **`ROLE_TICKET_AREAS`** — sistema existente para routing por área.
- **`AdjuntoPresupuesto.tipo = 'orden_compra'`** ya existe (line 880) — se reusa para backfill de OCs clientes en el mismo presupuesto (además del link via `ordenesCompraIds`).
- **`presupuestosService.markEnviado(id, hint)`** (Phase 7) — hook donde se llama a `createAutoTicket` si `hint.origenId` es null. Amplificar `markEnviado` o agregar `createAutoTicket` como método paralelo.
- **`leadsService.syncFromPresupuesto`** — ya existe, se usa en Phase 7. Extender para FLOW-01 si hace falta más granularidad.
- **`gmailService.sendGmail`** — pipeline de envío para FLOW-04 mail facturación. Ya usado en Phase 7 para envío de presupuestos.
- **`useGoogleOAuth`** — hook OAuth para el mail. **Pitfall crítico Phase 7 heredado:** FLOW-04 mail debe también usar token-first order (`requestToken() → sendGmail() → markCompleted()`) para consistencia.
- **`ordenesCompra`** collection (OCs internas a proveedores) — **NO confundir con `ordenesCompraCliente`**. Son disjuntas.
- **`deepCleanForFirestore`** / **`cleanFirestoreData`** — obligatorios en todos los writes nuevos (hard rule).
- **`runTransaction`** — existe en Firebase SDK, usado en 3 services actuales (`presupuestosService`, `otService`, `contratosService`). Reusar pattern.

### Established Patterns

- **Servicios Firestore por colección:** nuevo `adminConfigService.ts` + `ordenesCompraClienteService.ts`. Components NO tocan Firestore directo.
- **`useUrlFilters` obligatorio** en cualquier list page nueva (dashboard `/admin/acciones-pendientes`).
- **RBAC gating** para rutas admin (ej. `/admin/config-flujos`, `/admin/acciones-pendientes`) — seguir pattern de `/admin/revision-clienteid` y `/admin/modulos`.
- **250-line budget** en componentes React. Si `pendingActions` dashboard + config-flujos crecen, extraer subcomponents.
- **Routing:** rutas nuevas se registran en `TabContentManager.tsx` (lo aprendimos en Phase 5 y 7; el plan no debe asumir `App.tsx`).

### Integration Points

- **`presupuestosService.markEnviado`** (Phase 7) — hook para FLOW-01 auto-ticket trigger.
- **`presupuestosService.updateEstado` / `.aceptar`** — hook para FLOW-03 derivación Importaciones + generación de requerimientos condicionales.
- **`otService.updateEstadoAdmin`** — hook para FLOW-04 aviso facturación al `CIERRE_ADMINISTRATIVO`.
- **`TabContentManager.tsx`** — registrar `/admin/config-flujos` y `/admin/acciones-pendientes`.
- **Sidebar `navigation.ts`** — agregar entradas bajo "Admin" para las nuevas pantallas.
- **`RequerimientosList.tsx`** (del Phase 1) — agregar columna/badge para mostrar "Condicional" + filtro por ese flag.
- **`TicketDetail.tsx`** — mostrar el nuevo estado `oc_recibida` en el state machine visual.

</code_context>

<deferred>
## Deferred Ideas

- **REV-01/02 revisiones con opción "mantener ambas activas"** — diferido a post-v2.0. Comportamiento v1.0 (anular anterior automáticamente al revisar) se mantiene.
- **Retry automático con `nextRetryAt` + backoff schedule** — v2.1. En v2.0 los retries son manuales desde el dashboard.
- **Multiples destinatarios CC en mail facturación** — v2.1. En v2.0 un solo destinatario configurable.
- **Fallback list de usuarios fijos** — v2.1. En v2.0 un solo usuario por rol.
- **Dashboard widget en home** — Claude's Discretion, pero el dashboard principal vive en su propia página por ahora.
- **Parseo de email entrantes con OC** (out of scope milestone según PROJECT.md) — OC siempre carga manual.
- **Auto-approval sin OC** (anti-pattern, out of scope).
- **Cloud Function para FLOW-04 mail** — client-side en v2.0 per decisión. Si se mueve a Cloud Function, Phase 9 territory.
- **`computeStockAmplio()` pure function** — Phase 9 / STKP-01. Phase 8 usa suma simple.

</deferred>

---

*Phase: 08-flujo-automatico-derivacion*
*Context gathered: 2026-04-20 via /gsd:discuss-phase 8 — 3 areas seleccionadas + wrap-up question*
