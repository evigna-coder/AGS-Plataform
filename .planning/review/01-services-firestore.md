# Audit — Services & Firestore data access

Scope: `apps/sistema-modular/src/services/`, `apps/portal-ingeniero/src/services/`, `apps/reportes-ot/services/`. Findings only — no code changes.

---

## Direct Firestore from components / hooks

### [P0] `ImportacionDatos.tsx` issues raw Firestore writes
**File:** `apps/sistema-modular/src/pages/admin/ImportacionDatos.tsx:2,270-869`
**What:** A page-level component imports `collection/getDocs/deleteDoc/doc/updateDoc/addDoc` directly and runs migration writes against `sistemas`, `establecimientos`, `clientes` and the `modulos` subcollection without going through any service.
**Why:** Bypasses `cleanFirestoreData` / `deepCleanForFirestore`, audit logging, and cache invalidation; if anyone changes the shape of those collections in `sistemasService`/`establecimientosService` this page silently diverges. Admin can also brick data with no audit trail.
**Fix:** Move each migration block into a dedicated method in the corresponding service (`sistemasService.migrateXxx`, etc.) and have the page call them.

### [P0] `CargarOCModal.tsx` builds a Firestore doc id from `db`
**File:** `apps/sistema-modular/src/components/presupuestos/CargarOCModal.tsx:3,116`
**What:** `const ocId = ... doc(collection(db, 'ordenesCompraCliente')).id;` — component imports `db` and calls `doc/collection` directly to mint an ID.
**Why:** Same anti-pattern; if the collection name changes the modal silently refers to the old name. Already a service helper exists (`newDocRef('ordenesCompraCliente')`) in `firebase.ts`.
**Fix:** Expose `ordenesCompraClienteService.newId()` (1-line wrapper around `newDocRef`) and consume from the modal.

### [P1] Migration hooks (`useExcelMigration`, `useStockMigration`, `useRelinkearArticulos`) bypass services
**File:** `apps/sistema-modular/src/hooks/useExcelMigration.ts:2`, `useStockMigration.ts:2`, `apps/sistema-modular/src/pages/admin/useRelinkearArticulos.ts:3`
**What:** Each hook builds its own `writeBatch(db)` and writes to multiple collections (`marcas`, `articulos`, `sistemas`, etc.) without `batchAudit` / `cleanFirestoreData`.
**Why:** Migration writes never appear in `audit_log`; if these run in prod nobody can reconstruct what changed. Also a regression risk — these payloads can land `undefined` since they don't go through `deepCleanForFirestore`.
**Fix:** Either funnel through service `bulkXxx()` methods, or at minimum wrap each batch in `batchAudit` and clean payloads with `deepCleanForFirestore`.

### [P2] `useIngresarStock.ts` writes directly but uses helpers
**File:** `apps/sistema-modular/src/hooks/useIngresarStock.ts`
**What:** Hook uses `createBatch / docRef / batchAudit / deepCleanForFirestore` — avoids most of the risk above, but still lives outside `services/`.
**Fix:** Move to `stockService.ingresarImportacion(imp, recepciones)`. The hook would shrink to a thin wrapper for `loading/error` state.

---

## Cache invalidation gaps

### [P1] `marcasService` create/update/delete never invalidates `marcas:*`
**File:** `apps/sistema-modular/src/services/catalogService.ts:386-423`
**What:** `marcasService.getAll` caches under `marcas:${activoOnly}`, but `create`, `update`, `delete` do not call `invalidateCache('marcas')`. After mutating, callers see the 2-min stale list.
**Why:** Manifests as "I added a marca but the dropdown doesn't show it". Already happened on `clientesService` — fixed there, missed here.
**Fix:** Add `invalidateCache('marcas')` after each `await batch.commit()`.

### [P1] `sectoresCatalogService` create/delete never invalidates `sectores`
**File:** `apps/sistema-modular/src/services/catalogService.ts:481-488`
**What:** `getAll` caches `sectores`; `create` and `delete` skip invalidation.
**Fix:** Same pattern — `invalidateCache('sectores')` after the write.

### [P1] `proveedoresService` partial cache invalidation
**File:** `apps/sistema-modular/src/services/personalService.ts:108-176`
**What:** `getAll` caches `proveedores:*`; `create/update/delete` do NOT invalidate. Only `ingenierosService` (same file) gets it right.
**Fix:** Add `invalidateCache('proveedores')` to all three writes.

### [P1] `usuariosService.updateStatus / approveUser` don't invalidate `usuarios`
**File:** `apps/sistema-modular/src/services/personalService.ts:291-301`
**What:** `updateRole`, `updateRoles` invalidate; `updateStatus`, `approveUser`, `updatePermissions` do not — same cached `usuarios` key.
**Fix:** Add `invalidateCache('usuarios')` to those three.

---

## Missing audit logging

### [P1] `clientesService` contact subcollection writes have no audit
**File:** `apps/sistema-modular/src/services/clientesService.ts:241-248`
**What:** `update` and `delete` of `clientes/{id}/contactos/{id}` use raw `updateDoc`/`deleteDoc`, no `batchAudit` / `logAudit`.
**Fix:** Wrap in `createBatch + batchAudit({ collection: 'clientes_contactos', ... })`.

### [P1] `vehiculosService` subcollections (`servicios`, `historial`, `registrosKm`) have no audit
**File:** `apps/sistema-modular/src/services/vehiculosService.ts:108-170`
**What:** Top-level `vehiculos` collection uses `batchAudit`; the three subcollections fall back to raw `addDoc/updateDoc/deleteDoc`.
**Fix:** Audit them — useful for understanding why a vehicle's km changed.

### [P1] `tableCatalogService.publish/archive/clone/assignProject/bulkAddModelosToProject` skip audit
**File:** `apps/sistema-modular/src/services/catalogService.ts:62-126`
**What:** Only `save` and `delete` audit. Status changes (publish/archive) and bulk operations don't, despite being the most consequential edits.
**Fix:** Add audit entries (use `batchAudit` or `logAudit`).

### [P1] `usuariosService` role/status writes skip audit
**File:** `apps/sistema-modular/src/services/personalService.ts:281-301`
**What:** RBAC mutations (`updateRole`, `updateRoles`, `updateStatus`, `approveUser`, `updatePermissions`) never write to `audit_log`. These are exactly the changes a security reviewer needs to inspect.
**Fix:** Wrap each in batch + `batchAudit({ collection: 'usuarios', after: { role/roles/status/... } })`.

### [P1] `agendaService` creates audit but `feriadosService` and `agendaNotasService` do not
**File:** `apps/sistema-modular/src/services/agendaService.ts:197-253`
**What:** Inconsistent — agenda entries audit; feriados and notas (same file) skip it.
**Fix:** Add `logAudit(...)` to both upsert/delete.

### [P1] `notificationPrefsService.save` and `fcmTokensService.*` skip audit
**File:** `apps/sistema-modular/src/services/fcmService.ts`, mirrored in `apps/portal-ingeniero/src/services/firebaseService.ts:1008-1064`
**What:** Token rotation and notification-preference writes are silent. Important for "why did notifications stop?" diagnosis.
**Fix:** Audit at least the prefs save (token rotation is high-frequency, may be acceptable to skip).

---

## Cross-app duplication (should live in `@ags/shared` or a shared service)

### [P0] `qfDocumentosService` is duplicated 99% verbatim
**Files:** `apps/sistema-modular/src/services/qfDocumentosService.ts` (204 LOC) and `apps/portal-ingeniero/src/services/qfDocumentosService.ts` (209 LOC)
**What:** Two virtually identical files (only differ in `import { db } from './firebase'` vs `'./firebaseService'`). Every method body is the same.
**Why:** Any bug fix must be applied in two places. `incrementQFVersion` and `formatQFNumeroCompleto` already live in `@ags/shared` — the service did not follow.
**Fix:** Extract to `packages/shared/services/qfDocumentos.ts` taking `db` as a constructor param, or move to a new `@ags/firestore-services` package.

### [P0] `leadsService` (read paths + ticket-numero generator) duplicated in portal-ingeniero
**Files:** `apps/sistema-modular/src/services/leadsService.ts` and `apps/portal-ingeniero/src/services/firebaseService.ts:221-509`
**What:** `parseLead`, `hydrateContactosTicket`, `migrateMotivoLlamado`, `migrateLeadArea`, `getNextTicketNumero`, `extractTicketNumber` all reimplemented in portal-ingeniero. Both files independently maintain `MotivoLlamado` migration tables that have already drifted (sistema-modular also migrates `'capacitacion' → 'otros'` and `'insumos' → 'ventas_insumos'`; portal-ingeniero only re-maps `'otros' → 'soporte'`).
**Why:** Two parsers reading the same Firestore docs differently is a latent data bug; the next time a `motivoLlamado` value is added it will only land in one app.
**Fix:** Move parsers + migration tables to `@ags/shared`. Both apps consume them.

### [P0] OT→ticket sync logic duplicated in `reportes-ot`
**File:** `apps/reportes-ot/services/firebaseService.ts:101-160` (`OT_TO_TICKET_ESTADO`, `_syncTicketFromOTInline`)
**What:** Mirror of `leadsService.OT_TO_LEAD_ESTADO` + `syncFromOT` from sistema-modular, with an explicit comment "duplicación intencional porque reportes-ot escribe directo a Firestore vía setDoc". Already drifted: sistema-modular handles FLOW-05 (derivar a Materiales), the comment in reportes-ot mentions it but the code path is in a different shape.
**Why:** Estado mappings drift silently between apps; technicians may see different transitions than the back-office.
**Fix:** Move `OT_TO_LEAD_ESTADO` + state-transition helper into `@ags/shared`; both services import the table and the side-effect logic stays per-app.

### [P1] `fcmTokensService` duplicated in 3 places
**Files:** `apps/sistema-modular/src/services/fcmService.ts`, `apps/portal-ingeniero/src/services/firebaseService.ts:1008-1046`, plus `notificationPrefsService` in both files.
**What:** `getDeviceId`, `detectDevice`, `detectBrowser`, `saveToken`, `removeToken`, `removeAllTokens` reimplemented byte-for-byte.
**Fix:** Single source in `@ags/shared/services/fcm.ts`.

---

## Pattern inconsistencies

### [P1] portal-ingeniero re-defines `db` and `cleanFirestoreData`/`deepCleanForFirestore`
**File:** `apps/portal-ingeniero/src/services/firebaseService.ts:27-42`
**What:** `export const db = getFirestore(app)` (no persistent local cache like sistema-modular's `initializeFirestore` config), and `deepCleanForFirestore` is a local JSON round-trip rather than the `@ags/shared` re-export sistema-modular uses.
**Why:** portal-ingeniero misses the persistent IndexedDB cache so subscriptions are slower on reload. The local `deepCleanForFirestore` will drift from any improvement to the shared one (e.g. handling of `Timestamp` or `Date`).
**Fix:** Use `@ags/shared`'s helper and align Firestore initialization with sistema-modular's `firebase.ts` (extract a `createFirestore(app)` factory).

### [P1] portal-ingeniero `leadsService` writes raw — no audit, no batch
**File:** `apps/portal-ingeniero/src/services/firebaseService.ts:323-508`
**What:** All `leads` mutations (`create`, `update`, `derivar`, `completarAccion`, `finalizar`, `agregarComentario`, `delete`, `uploadAdjuntos`, `removeAdjunto`) use raw `addDoc/updateDoc/deleteDoc`, no `batchAudit`. The mirror in sistema-modular wraps every single mutation in `createBatch + batchAudit`.
**Why:** Tickets edited from the engineer portal disappear from the audit log. Compliance / "who closed this ticket" questions cannot be answered.
**Fix:** Same pattern as sistema-modular — `createBatch + batchAudit`. Or share the service module per the duplication finding above.

### [P1] `viaticosService.agregarGasto/editarGasto/eliminarGasto` read-modify-write outside transaction
**File:** `apps/portal-ingeniero/src/services/firebaseService.ts:918-950`
**What:** Each mutation does `getDoc → mutate gastos array → updateDoc`. Two engineers editing the same period concurrently lose each other's writes (last-write-wins on the whole array).
**Why:** Engineer apps run on tablets often, and there's no UI lock; concurrent writes are realistic.
**Fix:** Wrap in `runTransaction`, OR use `arrayUnion`/`arrayRemove` for `agregarGasto`/`eliminarGasto` and keep totals out of the doc (compute on read).

### [P1] Mixed write style: ~66 raw `await update/set/addDoc/deleteDoc` vs ~159 `batchAudit/logAudit`
**Files:** counts via `Grep`; primary offenders: `agendaService` (raw, but uses `logAudit`), `qfDocumentosService` (raw, no audit), `vehiculosService` subcollections (raw, no audit), `presupuestosService.linkOT/linkPresupuesto`-style raw updates.
**Why:** Inconsistency makes the audit trail incomplete and unpredictable; reviewers can't tell at a glance which mutations log.
**Fix:** Establish "all collection mutations route through `createBatch+batchAudit`" as a rule (the AST rule can be extended). Migrate the outliers above.

---

## Sequential writes / error handling

### [P1] `presupuestosService.update` auto-reserva loop is sequential and per-item silent
**File:** `apps/sistema-modular/src/services/presupuestosService.ts:413-477`
**What:** When a presupuesto goes to `aceptado`, the code iterates items, then for each item iterates `unidadesAReservar` and does `await reservasService.reservar(...)` one at a time. Each `reservar` is a `runTransaction` (~150–300ms RTT). For a 10-item × 3-unit ppto that's ~30 round-trips (~5–10 s). Each failure is `console.error`'d and swallowed.
**Why:** Slow + opaque. UI returns success even if half the reservations failed.
**Fix:** Run reservations in parallel per item with `Promise.allSettled` and aggregate failures, surface a structured `{ reserved: N, failed: [{unidadId, reason}] }` result to the caller.

### [P1] `presupuestosService._generarRequerimientosAutomaticos` runs `await requerimientosService.create()` sequentially in a `for` loop
**File:** `apps/sistema-modular/src/services/presupuestosService.ts:248-291`
**What:** Same shape — n items, n sequential creates, each its own batch commit.
**Fix:** Build a single `createBatch()`, push every requerimiento as `batch.set(newDocRef('requerimientos_compra'), payload)` + `batchAudit`, commit once.

### [P1] `otService.update` sync chain swallows errors but logs many lines
**File:** `apps/sistema-modular/src/services/otService.ts:362-440`
**What:** Up to 4 nested try/catches around lead-sync, presupuesto-sync, agenda-sync. Each swallows. Caller (UI) sees "OT updated" even if every downstream sync failed.
**Fix:** Aggregate failures into a returned `{ syncWarnings: string[] }` so the modal can surface a banner.

### [P1] `tableProjectsService.delete` does N parallel `updateDoc` then `batch.delete` for the project
**File:** `apps/sistema-modular/src/services/catalogService.ts:189-200`
**What:** `Promise.all(tablesInProject.map(updateDoc))` then a separate `batch.commit` to delete the project. If the parallel updates partially fail, the project still gets deleted leaving orphan tables with stale `projectId`.
**Fix:** Move all writes into a single `writeBatch` (Firestore allows up to 500 ops); keep atomicity.

---

## Dead / underused exports

### [P2] `ordenesTrabajoService.enviarAvisoCierreAdmin` is deprecated and unreferenced
**File:** `apps/sistema-modular/src/services/otService.ts:668-700`
**What:** Already commented `@deprecated`. Grepping the repo: 0 callers outside the file itself. Doc references it but the active code path is `cerrarAdministrativamente`.
**Fix:** Remove (saves ~35 lines and removes a confusing alternate path).

### [P2] `leadsService.backfillTicketNumeros` and `backfillClienteIds` only used by admin pages
**File:** `apps/sistema-modular/src/services/leadsService.ts:651-741`
**What:** ~90 LOC of one-off backfill scripts living in the runtime service. Used only by `BackfillTicketNumerosPage.tsx` and `BackfillClienteIdsPage.tsx`.
**Fix:** Move both into `apps/sistema-modular/scripts/` or a dedicated `leadsBackfillService.ts`. Keeps `leadsService` focused on the operational API.

### [P2] `inTransition` no-op left in `firebase.ts`
**File:** `apps/sistema-modular/src/services/firebase.ts:177-179`
**What:** No-op kept for "leftover imports". Grep confirms no callers.
**Fix:** Delete.

---

## Type unsafety

### [P1] 130 `as any | as unknown as` casts in sistema-modular services
**Hotspots:** `presupuestosService.ts` (31), `importacionesService.ts` (14), `stockService.ts` (14), `equiposService.ts` (9), `leadsService.ts` (9), `catalogService.ts` (7), `otService.ts` (7).
**Pattern:** Most are `batchAudit({ ..., after: payload as any })` — `batchAudit` expects `Record<string, unknown>` but `payload` typed as `Partial<T>`. Easy fix.
**Fix:** Tighten `batchAudit`'s `after` to accept `Partial<Record<string, unknown>>` (or the actual `WithFieldValue<DocumentData>` from Firestore) and drop the casts.

---

## TOP 5 to fix first

1. **portal-ingeniero `leadsService` mutations skip audit** (P1, lots of writes invisible to compliance) — `apps/portal-ingeniero/src/services/firebaseService.ts:323-508`.
2. **`marcasService` / `sectoresCatalogService` / `proveedoresService` / `usuariosService.updateStatus` cache-invalidation gaps** (P1, user-visible "stale dropdown" bugs).
3. **Extract `qfDocumentosService` + `fcmTokensService` + lead parsers to `@ags/shared`** (P0/P1, three sources of drift).
4. **`viaticosService` read-modify-write race on `gastos[]`** (P1, two-tablet concurrency dataloss).
5. **`ImportacionDatos.tsx` and migration hooks bypass services** (P0/P1, untraceable schema-shape writes from a UI page).
