# Plan: Seguridad para habilitar el QR a clientes

> Estado: **propuesto** · Fecha: 2026-06-23 · Owner: Esteban
> Decisiones tomadas: (1) equipo público vía **Cloud Function gateway**; (2) firma remota A.3 **diferida** (no tocar reportes-ot ahora); arrancar por A.1 + A.2.

## Objetivo

Habilitar de forma segura que cada cliente consulte sus equipos, vea su historial y pida
soporte vía QR. Hoy el sistema está endurecido para uso **interno** (hardening Fase 1
desplegado 2026-06-23: ~30 colecciones a `signedIn()`), pero quedan **3 accesos públicos**
y **no hay aislamiento por cliente**. Este plan cierra ambas cosas antes del go-live.

## Estado verificado (2026-06-23)

- Reglas: `firestore.rules` raíz (único deployado). 3 superficies públicas: `leads`
  (read+create `if true`), `reportes` (read `if true` + write anónimo acotado a firma),
  `sistemas` (read `if true`).
- **Ninguna regla discrimina por `clienteId`** → sin aislamiento multi-tenant.
- Página pública **ya existe**: `apps/portal-ingeniero/src/pages/EquipoPublicPage.tsx`.
  - Anónimo: lee el doc `sistema` COMPLETO (`sistemasService.getByAgsVisibleId`) y crea un
    `lead` directo (`leadsService.create`, form de soporte).
  - IST logueado: además lee `ordenes_trabajo` (ya requiere auth, OK).
- Custom claims: ya existe infraestructura (backend MFA de reportes-ot setea `role: 'admin'`).
- App Check: **no implementado**.
- `docs/SECURITY.md`: **desactualizado** (describe "Modo Temporal sin autenticación"). Actualizar.

## Principio rector

El anónimo **no habla con Firestore directo**: habla con Cloud Functions (admin SDK) que
devuelven/aceptan solo lo seguro. Eso permite cerrar las reglas a `signedIn()`.

**Secuencia de seguridad (invariante):** primero deployar las CFs y cambiar las apps para
usarlas → *después* cerrar las reglas. Invertir el orden rompe la página pública.
Rollback de reglas = `git revert` + `firebase deploy --only firestore:rules` (NO requiere
release de sistema-modular).

---

## Fase A — Cerrar los 3 accesos públicos

### A.1 — Equipo público vía Cloud Function (AHORA)
- **Nueva CF callable** `getEquipoPublico(agsId)` en `functions/` (admin SDK). Devuelve SOLO
  campos seguros: `{ nombre, software/softwares, agsVisibleId }`. NO `clienteId`, módulos ni
  campos internos.
- App Check obligatorio en la función (ver Fase E).
- `EquipoPublicPage.tsx`: reemplazar `sistemasService.getByAgsVisibleId(agsId)` por la llamada
  a la CF. (El historial de OTs para IST logueado queda igual: ya va por `signedIn()`.)
- **Regla:** `sistemas → read: if signedIn()` (se elimina `read: if true`).
- Archivos: `functions/src/getEquipoPublico.ts` (+ export en `functions/src/index.ts`),
  `apps/portal-ingeniero/src/pages/EquipoPublicPage.tsx`,
  `apps/portal-ingeniero/src/services/firebaseService.ts`, `firestore.rules`.

### A.2 — Alta de ticket vía Cloud Function (AHORA)
- **Nueva CF callable** `submitSoporte(payload)`: valida input → asigna número
  **atómicamente con `_counters/tickets`** (server-side, igual que sistema-modular) → escribe
  el lead con admin SDK (`source: 'qr'`, `estado: 'nuevo'`, `sistemaId`, etc., como hoy).
- App Check obligatorio.
- `SoporteForm` en `EquipoPublicPage.tsx`: reemplazar `leadsService.create(...)` por la CF.
- **Regla:** `leads → read, create: if signedIn()` (se elimina `read, create: if true`).
  Mata spam anónimo y enumeración de tickets.
- Pre-check: confirmar que NINGÚN otro flujo público dependa de `leads read` anónimo.
- Archivos: `functions/src/submitSoporte.ts` (+ index), `EquipoPublicPage.tsx`,
  `firestore.rules`.

### A.3 — Firma remota con token (DIFERIDA — toca app congelada)
- **No se implementa en este sprint.** Modifica `apps/reportes-ot/` (superficie congelada,
  requiere `CLAUDE_ALLOW_REPORTES_OT=1` + OK explícito) y es la pieza más delicada (técnicos
  firmando en campo).
- Diseño previsto para cuando se retome: link con **token aleatorio + vencimiento**
  (`firmaTokens/{token}` → `{ otNumber, expiresAt }`); firma escrita vía CF (reusar
  `onClientSignature`, ya admin SDK); cerrar `reportes → read, write: if signedIn()`.
- Mientras A.3 esté pendiente, `reportes` sigue con la regla pública actual (acotada a firma).
  **Aceptable** porque el QR a clientes NO expone reportes hasta Fase C.

---

## Fase B — Identidad de cliente (custom claims)
- **Nueva CF** `setClientClaims(uid, clienteId, establecimientoIds[])` (admin SDK), disparada
  por AGS al **invitar** a un usuario cliente (no autorregistro — decidido en roadmap QR).
  Setea `{ role: 'client', clienteId, establecimientoIds }`. Reusa patrón del backend MFA.
- UI de invitación en sistema-modular (o portal) para que AGS asigne cliente↔usuario.
- Al loguear, el cliente trae su `clienteId` en el token → base del aislamiento.

## Fase C — Reglas de aislamiento multi-cliente
- Helpers en reglas: `esCliente()` (`request.auth.token.role == 'client'`) y
  `miCliente(rid)` (`request.auth.token.clienteId == rid`).
- Un `client` solo **lee** `sistemas` / `ordenes_trabajo` / `reportes` donde
  `resource.data.clienteId == request.auth.token.clienteId`. Nunca escribe.
- IST (@agsanalitica.com) y roles internos siguen con acceso por `signedIn()` (sin cambios).
- **Tests de emulador** en el harness existente (`pnpm test:rules`): cliente NO ve datos de
  otro cliente, SÍ ve los suyos. Bloqueante para el go-live.

## Fase D — Superficie pública definida
- Anónimo: `nombre` + modelo + "Solicitar soporte". Nada más.
- Cliente autenticado: sus equipos, su historial, sus PDFs.
- IST: todo (ya funciona).

## Fase E — Hardening operativo
- **App Check** (reCAPTCHA Enterprise) sobre `getEquipoPublico` y `submitSoporte`.
- **Storage**: regla para que un `client` baje solo los PDFs de sus OTs (`reports/{ot}/...`).
- Monitoreo Sentry de `permission-denied` (detecta intentos de acceso cruzado).
- Pen-test ligero de enumeración (agsVisibleId / nº OT) antes del go-live.
- Actualizar `docs/SECURITY.md` (hoy describe estado "temporal sin auth", falso).

---

## Orden de ejecución recomendado
1. **A.1 + A.2** (este sprint): cierran 2/3 agujeros, no tocan app congelada, no requieren
   release de sistema-modular (Functions + portal-ingeniero + reglas). Testeables.
2. **B + C**: identidad cliente + aislamiento, con tests de emulador. Bloqueante para clientes.
3. **D + E**: definición de superficie + App Check + Storage + monitoreo.
4. **A.3** (firma token): ventana dedicada, con `CLAUDE_ALLOW_REPORTES_OT=1` y prueba en campo.

**Go/no-go para abrir a clientes:** Fases A.1, A.2, B, C completas y con tests verdes.

## Riesgos / notas
- Cambios de reglas son independientes del release de sistema-modular (es Firebase, no runtime
  de la app instalada). Deploy en ventana de bajo uso + smoke test (login 3 apps, página
  pública de equipo, alta ticket, firma `?modo=firma`).
- App Check mal configurado puede bloquear el form legítimo → activar primero en modo
  monitoreo, luego enforce.
- `_counters/tickets` ya es la fuente atómica; `submitSoporte` debe usar ese mismo counter
  para no reabrir el bug de números duplicados (TKT-00164, 2026-06-18).
