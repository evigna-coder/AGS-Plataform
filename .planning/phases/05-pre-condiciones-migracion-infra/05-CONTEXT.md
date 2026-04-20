# Phase 5: Pre-condiciones — Migración + Infra - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning
**Source:** Auto-captured — user opted for automatic flow. Decisions below mix locked prior decisions (STATE.md / PROJECT.md), codebase patterns already in use, and sensible defaults flagged as Claude's Discretion.

<domain>
## Phase Boundary

Dejar los datos legacy saneados y la infra base lista para que los flujos automáticos del circuito comercial (Phases 6–10) funcionen sin errores silenciosos. Cuatro deliverables discretos y heterogéneos:

1. **PREC-01** — Migración batch de tickets con `clienteId: null` + UI admin de revisión manual para los no resueltos.
2. **PREC-02** — Migración batch de tickets con `contacto/email/telefono` planos → `contactos[]` estructurado con principal marcado (persistencia de lo que hoy es hidratación en-memory).
3. **PREC-03** — Bootstrap del workspace `functions/` en el monorepo con una Cloud Function de ejemplo desplegable (base para `updateResumenStock` de Phase 9).
4. **PREC-04** — Colección `featureFlags` en Firestore + UI admin para togglear módulos del sidebar sin rebuild; extiende/reemplaza `VITE_DESKTOP_MVP`.

Fuera de scope: tocar las derivaciones automáticas en sí (Phases 7-10), implementar `updateResumenStock` real (Phase 9), rename de archivos `leads/` → `tickets/`.

</domain>

<decisions>
## Implementation Decisions

### Locked (prior decisions — do not re-debate)

- **PREC-01 es bloqueante de derivaciones:** La migración debe completarse antes de habilitar auto-tickets/auto-derivaciones (Pitfall 7-A, STATE.md). Sin esto las derivaciones de Phases 7-10 fallan silenciosamente.
- **Cloud Functions scope acotado:** El único trigger real planificado es `updateResumenStock` (Phase 9 / STKP-02). Todo el resto del pipeline comercial corre client-side. PREC-03 bootstrapea la infra; la función de ejemplo es *placeholder*, no debe cargar lógica de negocio.
- **Blaze plan ya activo** (confirmado 2026-04-19) — no hay blocker de billing para desplegar functions.
- **Naming archivos `leads/`:** No renombrar a `tickets/` en esta fase. El rename está diferido y fuera de scope.
- **Sidebar render actual:** `getNavigation()` en [navigation.ts:85-89](apps/sistema-modular/src/components/layout/navigation.ts#L85-L89) lee `VITE_DESKTOP_MVP` build-time. PREC-04 debe coexistir con el env flag: env como default, Firestore como override runtime (permite togglear sin rebuild).

### PREC-01 — Migración clienteId null

- **Matching strategy:** Probar en orden: (1) `cuit` normalizado si el ticket lo tiene, (2) `razonSocial` exacta trim+lowercase+sin-acentos. No fuzzy matching en v1 — si no matchea exacto queda para revisión manual.
- **Modo de ejecución:** Seguir el pattern existente en [scripts/migrate-establecimientos.js](apps/sistema-modular/scripts/migrate-establecimientos.js): script Node + firebase-admin, flags `--dry-run` (default) y `--run`, genera `mapping.json` con matched / unmatched / ambiguous. Script vive en `apps/sistema-modular/scripts/migrate-tickets-clienteid.mjs`.
- **Auto-commit vs propuesta:** Los matches únicos (1 candidato) se auto-escriben en `--run`. Los ambiguos (>1 candidato) se marcan `pendienteClienteId: true` y requieren resolución manual en la UI. Los sin candidato también `pendienteClienteId: true` con `candidatosPropuestos: []`.
- **UI de revisión:** Sub-tab dentro de `/admin/importar` (o nueva ruta `/admin/migraciones` si el componente excede 250 líneas) — lista filtrada de tickets con `pendienteClienteId: true`, con selector de cliente + "Marcar sin cliente" + "Ignorar ticket" (soft flag `revisionDescartada: true`).
- **Trazabilidad:** Al resolver, escribir `clienteIdMigradoAt: Timestamp.now()` y `clienteIdMigradoPor: uid` para auditoría.
- **No borrar data:** Los campos planos viejos (`cliente`, `razonSocial`) se mantienen; solo se completa `clienteId`.

### PREC-02 — Migración contactos planos → contactos[]

- **Reutilizar lógica existente:** La función `hydrateContactos()` en [leadsService.ts:89-103](apps/sistema-modular/src/services/leadsService.ts#L89-L103) ya hace la conversión en-memory. La migración persiste el resultado de `hydrateContactos()` para cada ticket con `contactos[]` vacío o inexistente.
- **Idempotencia:** Skip tickets que ya tienen `contactos.length > 0`. Correrlo dos veces no debe cambiar nada.
- **Principal:** Siempre uno solo con `esPrincipal: true`. El legacy-principal ya usa esta forma.
- **Preservar campos planos:** No borrar `contacto/email/telefono` — el patrón `syncFlatFromContactos` los mantiene sincronizados con el principal para búsquedas/listas existentes.
- **Ejecución:** Script standalone Node + firebase-admin, `--dry-run`/`--run`, batches de 400 docs con commit cada batch. Vive en `apps/sistema-modular/scripts/migrate-tickets-contactos.mjs`.
- **Sin UI de revisión:** Es pura reestructuración determinista; no requiere revisión manual.

### PREC-03 — Bootstrap functions/ workspace

- **Lenguaje:** TypeScript (consistente con el monorepo).
- **Estructura:** Workspace nuevo `functions/` al root del repo (sibling de `apps/` y `packages/`), registrado en `pnpm-workspace.yaml`.
- **Package:** `@ags/functions` con `firebase-functions` + `firebase-admin` + typecheck via `tsc`; `build` script y `deploy` script documentados.
- **Región:** `southamerica-east1` (São Paulo) — coherente con ubicación de usuarios (Argentina); evita latencia de `us-central1`.
- **Sample function:** `helloPing` HTTP `onRequest` que responde `{ ok: true, ts }`. No tocar Firestore, no negocio. Prueba que el pipeline de deploy/runtime funciona y nada más.
- **firebase.json:** Agregar sección `functions` apuntando al workspace. Mantener `firestore.rules` y `firestore.indexes.json` (crear si faltan).
- **Deploy:** Manual esta fase, con comando documentado en el README del workspace (`pnpm --filter @ags/functions deploy` o `firebase deploy --only functions`). CI queda fuera de scope (se verá en Phase 11 con Playwright).
- **Validación del bootstrap:** Criterio de éxito = `firebase deploy --only functions:helloPing` sin errores + `curl` a la URL devuelve 200.

### PREC-04 — featureFlags en Firestore + UI admin

- **Colección:** `/featureFlags/modules` (documento único, no un doc por módulo — atomic updates más simples) con shape:
  ```ts
  {
    modules: { [moduloId: string]: { enabled: boolean, updatedAt: Timestamp, updatedBy: string } },
    updatedAt: Timestamp
  }
  ```
- **Coexistencia con `VITE_DESKTOP_MVP`:** El env flag sigue siendo el default de build. Firestore override por módulo tiene prioridad: si el doc de Firestore tiene `modules.{moduloId}.enabled = true`, el módulo aparece en sidebar aunque `VITE_DESKTOP_MVP` lo ocultaría; si `= false`, se oculta aunque el build lo incluya. Esto evita romper builds que no hayan migrado y permite toggle live.
- **Reactividad:** `onSnapshot` del doc desde un context provider (`FeatureFlagsProvider`) que expone `useFeatureFlags()`. `getNavigation()` se vuelve hook (`useNavigation()`) que combina build flag + context.
- **Granularidad:** Solo global (no por-rol ni por-usuario en v1). Scope por-rol queda deferred — el RBAC actual ya filtra por módulo.
- **UI admin:** Nueva ruta `/admin/modulos` con lista de módulos + toggle por cada uno. Solo visible a rol `admin`. Cambios se escriben con `updateDoc` + optimistic UI. Lista de módulos disponibles se deriva de `navigation.ts` (source of truth del catálogo de módulos sigue siendo el array estático).
- **Seed inicial:** Al detectar que el doc `/featureFlags/modules` no existe, la UI admin lo crea vacío en primer acceso (no hay script de seed dedicado).

### Claude's Discretion

- Naming exacto de campos auxiliares (`pendienteClienteId` vs `clienteIdPendienteRevision`), ubicación exacta de sub-tabs vs rutas nuevas, estilo visual de badges/listas (seguir skill `list-page-conventions` + Editorial Teal).
- Nombre exacto del paquete functions (`@ags/functions` vs `@ags/cloud-functions`) y estructura interna (`src/index.ts` vs módulos separados).
- Batch size de las migraciones (default 400, ajustable si hay límites).
- Snapshot debouncing / memoization en `useFeatureFlags()`.
- Mostrar o no un badge visual de "override activo" cuando el flag de Firestore difiere del env default.

</decisions>

<specifics>
## Specific Ideas

- Los scripts de migración deben imprimir un resumen final tipo el existente en [migrate-establecimientos.js](apps/sistema-modular/scripts/migrate-establecimientos.js): "Matcheados: N, ambiguos: N, sin candidato: N, skipped: N".
- El UI de revisión de `clienteId` se inspira en el patrón de `ImportacionDatos.tsx` — tablas compactas con badges de estado (`bg-amber-50` para pendiente, `bg-red-50` para sin candidato).
- Toggle de módulos visualmente similar a los switches que ya usamos en config de usuarios — monospace label uppercase tracking-wide `text-[10px]` para el moduloId, switch a la derecha.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets

- **[scripts/migrate-establecimientos.js](apps/sistema-modular/scripts/migrate-establecimientos.js)** — template exacto de script de migración firebase-admin con `--dry-run`/`--run` y output de `mapping.json`. Copiar estructura para PREC-01 y PREC-02.
- **[hydrateContactos() en leadsService.ts:89-103](apps/sistema-modular/src/services/leadsService.ts#L89-L103)** — lógica de conversión flat→array ya implementada y probada en lectura. PREC-02 persiste su output.
- **[syncFlatFromContactos() en leadsService.ts:145-153](apps/sistema-modular/src/services/leadsService.ts#L145-L153)** — mantiene compat flat↔array en writes; no hay que recrearla.
- **[ContactoTicket + getContactoPrincipal de @ags/shared](packages/shared/)** — tipos y helper ya exportados.
- **[ImportacionDatos.tsx](apps/sistema-modular/src/pages/admin/ImportacionDatos.tsx)** — pattern de admin page con tabs de modo, tabla de issues con colors red/amber, progress log. Reusable para revisión de `clienteId`.
- **[deepCleanForFirestore / cleanFirestoreData en firebase.ts](apps/sistema-modular/src/services/firebase.ts)** — obligatorios en los writes de migración (hard rule de la plataforma).
- **UI atoms:** `Button`, `Card`, `Input`, `SearchableSelect` en `components/ui/` — usar para selector de cliente en revisión.

### Established Patterns

- **Servicios Firestore por colección:** Un archivo en `apps/sistema-modular/src/services/`. Para PREC-04 creá `featureFlagsService.ts` con CRUD y subscripción `onSnapshot`.
- **Sidebar filtering:** `navigation.ts` + `getNavigation()` filter → `SidebarNav` lo consume. PREC-04 convierte esta función pura en hook reactivo sin alterar el array estático.
- **Admin gating:** El rol `admin` ya gatea rutas en la app; reusar el gate para `/admin/modulos` y la revisión de migración.
- **`useUrlFilters`:** Obligatorio para cualquier list page — se aplica si la revisión de migración tiene filtros.
- **250-line rule:** Componentes React ≤250 líneas. Si la UI de revisión + el toggle de módulos + el admin landing crecen, partir en hooks/subcomponents antes de cruzar el límite.

### Integration Points

- **`VITE_DESKTOP_MVP` + `DESKTOP_MVP_ALLOWED`** en [navigation.ts:75-89](apps/sistema-modular/src/components/layout/navigation.ts#L75-L89) — punto de extensión para PREC-04. Convertir `getNavigation()` a hook que combine env flag + featureFlags context.
- **`SidebarNav`** (consumer de `getNavigation()`) — debe re-renderizar al cambiar los flags vía context/onSnapshot.
- **`/admin/importar` (ruta existente)** — candidato a host de la nueva sección "Migración tickets" o sibling en `/admin/`.
- **`firebase.json` (no existe al root)** — necesita crearse para declarar el workspace functions y sus configs.
- **`pnpm-workspace.yaml`** — agregar `'functions'` a `packages`.
- **`.firebaserc`** — single project `agssop-e7353`, no hay staging. Si se quisiera emulador local para PREC-03 sin afectar prod, setup queda en Phase 11 (TEST-01).
- **Ticket type en `@ags/shared`** — agregar `pendienteClienteId`, `candidatosPropuestos`, `clienteIdMigradoAt`, `clienteIdMigradoPor`, `revisionDescartada` al type `Lead` (o `Ticket` si lo llamás así en el shared — respetar naming actual).

</code_context>

<deferred>
## Deferred Ideas

- **Rename `leads/` → `tickets/`:** No entra en esta fase. Seguir como estaba.
- **Fuzzy matching en PREC-01:** Si después de la migración batch quedan muchos no resueltos, se puede agregar un matching "similar razón social" como feature separado. No v2.0.
- **Feature flags por rol / por usuario:** Scope granular queda para cuando lo pida un caso real. El RBAC ya hace gating por módulo.
- **Cloud Function real (resumenStock):** Es Phase 9 / STKP-02. PREC-03 solo bootstrapea la infra.
- **CI para functions deploy:** Playwright + CI integration pipeline es Phase 11. El deploy manual alcanza para v2.0.
- **Emulador Firestore para dev de functions:** Parte del setup de tests E2E en Phase 11 (TEST-01).
- **electron-updater + remote feature flags desktop:** PROJECT.md lo marca fuera de scope milestone actual.
- **Seed script dedicado para featureFlags:** El doc se crea lazy desde la UI admin; script dedicado no aporta valor suficiente.

</deferred>

---

*Phase: 05-pre-condiciones-migracion-infra*
*Context gathered: 2026-04-19 via automatic flow (no interactive discussion — decisions derived from prior decisions in STATE.md + codebase scout)*
