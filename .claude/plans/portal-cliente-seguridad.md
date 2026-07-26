# Portal Cliente — Revisión de seguridad (login + conexión Firebase)

**Fecha:** 2026-07-25 · **Estado:** revisión previa al cableado real (hoy el portal corre con datos mock + auth stub).
**Complementa:** [.claude/plans/seguridad-qr-cliente.md](seguridad-qr-cliente.md) (fases A/B/C/D/E).

> Invariante multi-tenant: **un cliente NUNCA puede leer datos de otro cliente.** Todo lo de abajo existe para garantizar eso antes de exponer datos reales.

## Fuentes autoritativas (confirmadas)

- **Firestore:** la única regla desplegada es `firestore.rules` de la **raíz** (`firebase.json` la apunta). No hay copias en `apps/*` → sin drift.
- **Storage:** la desplegada es `apps/sistema-modular/storage.rules`. Ojo: `apps/reportes-ot/storage.rules` es `allow if true` (dev) pero **NO** está desplegada — no re-apuntar `firebase.json` a esa.
- **Provisioning de cliente:** `functions/src/setClientClaims.ts` — solo staff (`@agsanalitica.com` + email verificado) puede mintear el claim `{ role:'client', clienteId, establecimientoIds[] }`. **No existe self-registration** (correcto, mantener así).

## Riesgos (rankeados) — cerrar antes de exponer cada dato

1. **`reportes` es de lectura pública** (`read: if true`). Contiene el informe técnico completo, `clienteId` y las URLs de PDF. Es fuga pública + cross-tenant. **Cerrar antes de mostrar informes en el portal.**
2. **PDFs en Storage sin scope** (`reports/**` = `read: if request.auth != null`): cualquier usuario autenticado lee el PDF de cualquier cliente. Además, los tokens de `getDownloadURL` embebidos en la URL **bypassean** las reglas → toda URL filtrada es world-readable.
3. **`sistemas` scopeado por el campo equivocado**: la regla usa `clienteId` (que en `Sistema` está **@deprecated y nullable**), y el claim `establecimientoIds` **no se usa en ninguna regla**. Sistemas legacy con `clienteId:null` quedan invisibles para su dueño.
4. **Sin App Check ni rate-limit** en los callables públicos (`getEquipoPublico`, `submitSoporte`, `setClientClaims` con `enforceAppCheck:false`) → enumeración de `agsVisibleId`/N° de OT y spam.
5. **`fichasPropiedad` / `establecimientos` / `clientes` no tienen path de lectura cliente** (todo `esStaff()`): al cablear las lecturas reales van a fallar *closed* (permission-denied) hasta agregar los predicados. Los campos de scoping existen; el gap está solo en las reglas.

## Tabla de reglas — colección → gap → predicado a agregar

| Colección (real) | Regla hoy | Predicado cliente a agregar |
|---|---|---|
| `sistemas` (equipos) | `esStaff() \|\| miCliente(clienteId)` (campo deprecado) | `resource.data.establecimientoId in request.auth.token.establecimientoIds` (+ fallback clienteId durante migración) |
| `ordenes_trabajo` | `esStaff() \|\| miCliente(clienteId)` | ✅ ya correcto — verificar backfill: ninguna OT del cliente con `clienteId` vacío |
| `fichasPropiedad` | `esStaff()` | `esStaff() \|\| miCliente(resource.data.clienteId)` (read; write sigue staff) |
| `establecimientos` | `esStaff()` | `esStaff() \|\| request.auth.token.establecimientoIds.hasAny([establecimientoId])` (por doc id) |
| `clientes` | `esStaff()` | `esStaff() \|\| miCliente(clienteId)` (wildcard del path, read-own-doc) |
| `reportes` (pdfUrl) | **`read: if true`** | `esStaff() \|\| miCliente(resource.data.clienteId)` (dejar solo la rama anónima de firma remota si sigue viva) |
| `agendaEntries` / `agendaPrevisiones` | `esStaff()` | **No exponer** salvo necesidad; previsiones = planificación interna |

> `miCliente()` hoy solo compara `clienteId` — hay que sumarle (o crear un helper paralelo) el chequeo por `establecimientoIds` para `sistemas`/`establecimientos`.

## Autenticación recomendada

- **Email/password, invite-only.** Staff crea el usuario Firebase Auth y llama `setClientClaims`. Encaja con el modelo (el callable ya exige un `uid` conocido). El claim recién aplica tras `getIdToken(true)` / re-login.
- **Enforce `email_verified`** antes de honrar el claim `role:'client'`. Falta wirear `sendPasswordResetEmail` + `sendEmailVerification` (no existen aún).
- **Si además se ofrece Google:** usar `signInWithPopup` (NUNCA `redirect` — rompe en mobile por cookies cross-origin, gotcha ya documentado en los portales staff) y **la identidad de tenant sale SOLO del claim `clienteId`/`establecimientoIds`, jamás del dominio del mail.** No aplicar el gate `@agsanalitica.com` (ese es para staff).

## Estado: reglas cliente F1 DEPLOYADAS A PRODUCCIÓN (2026-07-25)

**Deployado** a `agssop-e7353` con `firebase deploy --only firestore:rules` ("released rules to cloud.firestore"). El CLI había perdido credenciales → el user corrió `firebase login --reauth` y luego se deployó OK.

`firestore.rules` raíz — cambios **aditivos** para el rol `client` (no tocan staff):
- Helper `clienteEnEstablecimiento(estId)` = `esCliente() && estId in token.get('establecimientoIds', [])`.
- `sistemas`.read += `miCliente(clienteId) || clienteEnEstablecimiento(establecimientoId)` (cubre legacy `clienteId:null`).
- `fichasPropiedad`.read += `miCliente(clienteId)` (split read/write; write sigue staff).
- `establecimientos`.read += `clienteEnEstablecimiento(establecimientoId)` (por doc id).
- `clientes`.read += `miCliente(clienteId)` (propio doc).
- Write = `esStaff()` en todas. **Verificado: `pnpm test:rules` 24/24 verde** (tests nuevos en `tests/firestore-rules/rules.test.ts`). **Auditor de seguridad: 5/5**, sin hallazgos críticos.
- **FALTA**: deployar (lo hace el user; correr checklist/emulador primero). Pendiente: `reportes` (público, toca reportes-ot congelado), Storage scope, rol/claims de PROVEEDOR (no existe `setProviderClaims` ni `proveedorId` en OCs/requerimientos), App Check.

## Estado: reglas + provisioning PROVEEDOR F1 — DEPLOYADO A PRODUCCIÓN (2026-07-26)

Reglas deployadas (`firebase deploy --only firestore:rules`). Función `setProviderClaims`
deployada — el deploy de firebase NO pudo setear el invoker IAM (permiso/policy) y quedó en
"require auth"; se corrigió a mano en la consola (Cloud Run → setproviderclaims → Seguridad →
"Permitir el acceso público"). Verificado con un POST crudo: responde IDÉNTICO a `setClientClaims`
(403 · application/json · body vacío) → invocable. Gotcha: `gcloud` local NO funciona (SSL/Avast:
"Basic Constraints not marked critical"); usar la consola para IAM de Cloud Run.


Espejo del modelo cliente, adaptado a que el proveedor scopea solo por `proveedorId`:
- **`functions/src/setProviderClaims.ts`** (nuevo, exportado en `index.ts`): onCall staff-only
  (mismo gate `@agsanalitica.com`), setea claim `{ role:'provider', proveedorId }`, verifica
  `proveedores/{proveedorId}` existe, audita en `usuarios/{uid}.providerAccess`. **Compila** (`tsc` verde).
- **`firestore.rules`**: helpers `esProveedor()` / `miProveedor(pid)`; lectura scopeada:
  - `ordenes_compra`.read += `miProveedor(resource.data.proveedorId)` — campo **requerido y confiable**
    (enforced en `useOrdenCompraForm.ts:121`, sin backfill).
  - `proveedores/{id}`.read += `miProveedor(proveedorId)` (propio doc). Write = staff en ambas.
- **`requerimientos_compra` NO scopeado** (queda staff-only): el modelo solo tiene
  `proveedorSugeridoId?` (opcional/advisory), no una asignación firme. **Pendiente: denormalizar un
  `proveedorId` firme** (o un mirror top-level `derivaciones_proveedor/{id}` desde `FichaPropiedad.
  items[].derivaciones[].proveedorId`) antes de exponer requerimientos al portal.
- **Writes del proveedor = read-only en reglas**: cotización e "informar entrega" van por **Cloud
  Functions** (admin SDK, re-derivan `proveedorId` del token, patrón `submitSoporte`). **Pendientes de
  implementar**: `submitCotizacion`, `informarEntrega` (+ campo nuevo en `OrdenCompra`, ej.
  `fechaEntregaProveedor` + `entregaInformadaAt/Por` — hoy no existe).
- **Verificado**: `pnpm test:rules` **29/29 verde** (5 tests nuevos de aislamiento de proveedor).
- **Pendiente**: deploy de `firestore:rules` (aditivo, inerte hasta que exista un proveedor con claim)
  + deploy de `functions:setProviderClaims` (deploy de functions, aparte).

## Plan por fases (cablear Firebase real sobre esta base)

- **F0 · Auth real** — reemplazar los stubs de `AuthContext.login/loginWithGoogle` por Firebase Auth; enforce `email_verified`; password reset. Derivar `ClientePortal` del token (claims).
- **F1 · Rules multi-tenant** — agregar los predicados de la tabla (empezar por `sistemas` vía `establecimientoIds`, `fichasPropiedad`, `establecimientos`, `clientes`). Backfill de `sistemas` legacy con `clienteId/establecimientoId`.
- **F2 · Reportes + Storage** — cerrar `reportes` (`read:if true` → scoped); scope de `reports/{ot}` por OT del cliente **o** servir PDFs vía Cloud Function con token corto (evita el bypass de `getDownloadURL`). Backfill `clienteId` en OT/reportes.
- **F3 · App Check + abuse** — App Check (reCAPTCHA Enterprise) en callables públicos; rate-limit; pen-test de enumeración antes de go-live.
- **F4 · Data layer** — servicios Firestore scopeados reemplazando el mock (query `sistemas` por `establecimientoId in claim`, joins con fichas/OTs/agenda).

**Regla operativa:** todo cambio en `firestore.rules` → `pnpm test:rules` (emulador) + correr el skill `firebase-security-rules-auditor` **antes** de deploy. Los tests actuales siembran `sistemas` con `clienteId` poblado → **no** ejercitan el path por `establecimientoId` ni los legacy null: agregar casos.
