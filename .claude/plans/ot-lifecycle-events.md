# Plan: OT Lifecycle Events — Durable Audit Log

**Status**: Design — not implemented.
**Owner**: Esteban
**Created**: 2026-04-18

## Intent

A durable, append-only log of state-changing events for the OT entity (and later: Tickets, Presupuestos). Purpose: **auditability and timeline UI**, not automation. Not a message queue, not an AI signal layer.

Reframe of the "brain events" pattern from the [claude-code-framework](https://github.com/ketzal88/claude-code-framework) repo. That framework uses a `brain_events` collection as a fire-and-forget signal bus consumed by crons / morning briefings. Our stack has no crons and no consumers. The same collection shape becomes a perfect fit for **audit trail**, which we *do* need (RBAC requires it, contratos require it, finanzas requires it).

## Why now

- OT flows through 3 fases (creación → reporte técnico → cierre administrativo) and multiple hand-offs (admin, técnico, cliente). Hoy la única huella es el `estadoAdmin` actual del doc — se pierde el "quién, cuándo, a qué estado venía".
- El sync cross-module (OT → lead via `leadsService.syncFromOT`, OT → presupuesto when FINALIZADO) hoy se hace inline en `otService.update`. Cuando un sync falla silencioso, no hay manera de reconstruir qué pasó. El log lo fija.
- Contratos + facturación necesitan saber "este servicio de esta OT se facturó el X día en cuota Y". El campo `otsVinculadasNumbers[]` no basta; necesitamos el evento que lo relacionó.
- RBAC: cuando existan los roles `cliente` y `proveedor`, necesitan ver una timeline filtrada. Tiene que existir una fuente de verdad.

## Schema (propuesta)

Colección: `lifecycleEvents` (genérica desde el día 0, para no migrar después).

```ts
// packages/shared/src/lifecycleEvents.ts
export type LifecycleEntityType = 'ot' | 'ticket' | 'presupuesto';

export type LifecycleEventKind =
  | 'created'
  | 'stateChanged'
  | 'assigned'           // asignación a técnico
  | 'reportSubmitted'    // técnico cerró reporte en reportes-ot
  | 'closed'             // cierre administrativo
  | 'invoiced'           // vinculado a facturación
  | 'cancelled'
  | 'noteAdded';

export interface LifecycleEvent {
  id: string;                        // Firestore doc id
  entityType: LifecycleEntityType;
  entityId: string;                  // ot.id, ticket.id, etc.
  entityNumber?: string | number;    // ot.number — humano-legible, opcional
  kind: LifecycleEventKind;
  at: Timestamp;                     // Timestamp.now() al emitir
  actorId: string;                   // uid del usuario o 'system'
  actorRole?: string;                // role snapshot al momento
  dedupeKey?: string;                // idempotencia (retry-safe)
  payload?: {
    from?: unknown;                  // estado anterior (solo para stateChanged)
    to?: unknown;                    // estado nuevo
    note?: string;
    [k: string]: unknown;
  };
}
```

**Invariantes**:
- Colección append-only. Nunca se edita ni borra un evento. Un evento "corregido" = un evento nuevo con `kind: 'noteAdded'` que apunta al anterior.
- `at`: `Timestamp.now()` al escribir. Nunca permitir que el cliente lo setee.
- `actorId`: siempre del `currentUser` del servidor/session, nunca del form.
- `dedupeKey`: compuesto `${entityType}:${entityId}:${kind}:${hashOfPayload}` para garantizar idempotencia en retry (p.ej. si el sync de OT→lead reintenta, no duplica el evento).
- Sin `undefined` (regla general del proyecto — usar `deepCleanForFirestore`).

**Índices Firestore** (necesarios, declarar en `firestore.indexes.json`):
- `entityType ASC, entityId ASC, at ASC` — timeline por entidad
- `entityType ASC, kind ASC, at DESC` — analytics ("últimos 100 cierres")
- `actorId ASC, at DESC` — actividad por usuario

## Fases de implementación

### Fase 1 — Plumbing (sin UI)
Objetivo: poder emitir y leer eventos. Nada visible al usuario aún.

1. `packages/shared/src/lifecycleEvents.ts` — types + `eventDedupeKey()` helper puro.
2. `apps/sistema-modular/src/services/lifecycleEventsService.ts`:
   - `emit(event: Omit<LifecycleEvent, 'id'|'at'>): Promise<string>` — escribe con `deepCleanForFirestore`.
   - `listForEntity(entityType, entityId): Promise<LifecycleEvent[]>` — ordenado ascendente.
   - Wrap todo con try/catch: un fallo al emitir **nunca** debe romper la operación padre (el log es secundario al acto).
3. Firestore rules: solo sistema escribe (Cloud Function o admin SDK en server-side jobs); front-end en Fase 1 escribe directo con uid del currentUser como `actorId`. Cuando tengamos CF, restringir. *Decisión para Fase 1*: escritura desde cliente con rules que exigen `actorId == request.auth.uid`.
4. Índices + deploy.
5. Tests unitarios del helper de dedupeKey + un test de humo de emit/read.

**Criterio de hecho**: puedo llamar a `lifecycleEventsService.emit(...)` desde un componente de desarrollo y verlo en la colección; `listForEntity` devuelve en orden.

### Fase 2 — Instrumentar OT
Engancha el log a los 4-5 puntos clave del ciclo actual, sin cambiar la UX.

1. `otService.create()` → emite `created` con `payload.to = estadoInicial`.
2. `otService.update()` cuando `data.estadoAdmin` cambia → emite `stateChanged` con `from/to`.
3. `otService.update()` cuando el sync a lead/presupuesto ocurre → emite `invoiced` o equivalente (el nombre exacto se decide cuando se mapee con finanzas).
4. Hook de asignación a técnico (`asignacionesService`) → `assigned`.
5. Emisión desde `reportes-ot` al finalizar el reporte → `reportSubmitted`. Esto requiere dar acceso a la colección desde esa app (hoy sí tiene Firebase). **Check**: respetar la regla de reportes-ot frozen — esta emisión es una línea añadida junto al write que ya existe, no un refactor de UX. Es caso legítimo de `CLAUDE_ALLOW_REPORTES_OT=1`.

**Criterio de hecho**: crear una OT, asignarla, cerrar reporte, cerrarla admin → la timeline muestra 4-5 eventos con los actores correctos.

### Fase 3 — Timeline UI
Componente `<LifecycleTimeline entityType="ot" entityId={ot.id} />` en la página de detalle de OT.

- Lista vertical, newest-first.
- Cada item: ícono por `kind`, "Estado: CREADA → ASIGNADA", actor, timestamp relativo.
- Expandible: payload completo (JSON formateado).
- Vive en `components/ordenes-trabajo/LifecycleTimeline.tsx`.
- Consume `lifecycleEventsService.listForEntity()`, cachea con `serviceCache` (TTL 30s).

**Criterio de hecho**: abro una OT, veo la historia completa; se actualiza al volver a entrar.

### Fase 4 — Extensiones (fuera de scope inicial)
- Instrumentar Tickets (ex-Leads) y Presupuestos. Esquema ya soporta.
- Vista "actividad reciente" global en dashboard.
- Export a CSV para auditoría.
- Integración con RBAC: cliente ve timeline filtrada (solo eventos visibles para su rol).

## Preguntas abiertas — decidir antes de Fase 1

1. **Alcance inicial**: ¿solo OT en Fase 2, o desde el día 0 también Tickets y Presupuestos? Mi recomendación: solo OT. Extender tras validar el patrón con una entidad.
2. **Granularidad de `stateChanged`**: ¿un evento por cada transición de `estadoAdmin` (granular) o uno por fase completa (agrupado)? Mi recomendación: granular. La agregación se hace en lectura, no en escritura.
3. **Retención**: ¿eventos forever o TTL? Docs son chicos (~200 B cada uno). 10k OT × 10 eventos = 20 MB ≈ $0.05/mes. **Forever hasta que pase 1 GB** (fácilmente años).
4. **Emisión desde `reportes-ot`**: ¿el técnico emite directo, o la Cloud Function que recibe el reporte? Fase 1: directo (simple). Si aparece drift o abuso, mover a CF en Fase 4.
5. **Dedupe key**: ¿hasheamos el payload con qué? `stableStringify + SHA-1` es suficiente — no es clave criptográfica, es idempotencia.

## No-goals explícitos

- **No es un event bus.** No hay consumidores suscribiéndose a eventos. Es un log de solo-lectura para humanos y para queries.
- **No reemplaza `estadoAdmin`.** El estado vigente sigue en el doc de la OT; el log cuenta la historia.
- **No migra el pasado.** Eventos nacen desde el deploy. OTs viejas muestran "historial desconocido antes del 2026-XX-XX".
- **No es async ni con retries automáticos.** Si falla, el padre no rompe (try/catch silencioso con log a console). Recovery manual si hace falta.

## Próximo paso

Confirmar las 5 preguntas abiertas → arrancar Fase 1 como phase de GSD (`/gsd:plan-phase`).
