---
phase: 05-pre-condiciones-migracion-infra
plan: 04
subsystem: infra
tags: [feature-flags, firestore, onSnapshot, react-context, admin-ui, sidebar, VITE_DESKTOP_MVP]

requires:
  - phase: 04-plataforma-base
    provides: AuthContext con firebaseUser.uid, helper deepCleanForFirestore, UI atoms (teal palette)
  - phase: 05-01
    provides: routing pattern en TabContentManager.tsx, admin-role gating con ProtectedRoute allowedRoles={['admin']}
provides:
  - Colección Firestore /featureFlags/modules (lazy-created al primer toggle)
  - featureFlagsService con subscribeFeatureFlags (onSnapshot), setModuleEnabled (setDoc merge), getFeatureFlagsOnce
  - FeatureFlagsContext + useFeatureFlags() hook live
  - Hook reactivo useNavigation() (combina VITE_DESKTOP_MVP + Firestore override)
  - Helpers exportados en navigation.ts DESKTOP_MVP_ALLOWED, getAllModulePaths(), isMvpDefault()
  - Página /admin/modulos con toggles por módulo (ModulosAdminPage)
affects: [phase-06-PRES, phase-07-OC, phase-08-FLOW, roadmap-v2.1 (beta rollouts)]

tech-stack:
  added: []
  patterns:
    - "Feature flag runtime via Firestore doc + onSnapshot; env flag queda como default de build, Firestore overridea por módulo"
    - "Provider pattern con null como estado inicial (loading) tras primer snapshot"
    - "Source of truth única: DESKTOP_MVP_ALLOWED exportado desde navigation.ts, consumido via helper isMvpDefault() (sin duplicación en la admin UI)"
    - "getNavigation() pure (fuera de React) coexiste con useNavigation() hook reactivo"

key-files:
  created:
    - apps/sistema-modular/src/services/featureFlagsService.ts
    - apps/sistema-modular/src/contexts/FeatureFlagsContext.tsx
    - apps/sistema-modular/src/pages/admin/ModulosAdminPage.tsx
  modified:
    - apps/sistema-modular/src/App.tsx
    - apps/sistema-modular/src/components/layout/navigation.ts
    - apps/sistema-modular/src/components/layout/SidebarNav.tsx
    - apps/sistema-modular/src/components/layout/TabContentManager.tsx
    - apps/sistema-modular/src/pages/admin/index.ts

key-decisions:
  - "Routing registrado en TabContentManager.tsx (NO App.tsx) siguiendo patrón de 05-01 — el routing real del app vive allí"
  - "FeatureFlagsProvider anidado DENTRO de ConfirmDialogProvider, en la rama autenticada de AuthGate — solo se suscribe para usuarios autenticados"
  - "updatedBy usa firebaseUser.uid (no usuario.id) — uid real de Firebase Auth, consistente con lo que Firestore rules ve"
  - "Toggle inline (70 LOC total, switch sin estado propio + label accesible aria-pressed) — no existe components/ui/Switch"
  - "Card UI atom no usado directamente en ModulosAdminPage — el Card atom siempre wrappea con padding interno; para lista de filas sin padding interno usé un div con border-shadow directo"
  - "Seed lazy: el doc /featureFlags/modules NO se crea desde el provider al mount; solo al primer setModuleEnabled (setDoc merge crea el doc si no existe)"
  - "Entry sidebar 'Módulos' NO agregada a DESKTOP_MVP_ALLOWED (es herramienta admin, no MVP); se filtra por rol admin via canAccess('admin') en SidebarNav"

patterns-established:
  - "Feature flags runtime en este codebase: Firestore doc singleton /featureFlags/modules + Context/Provider + hook útil para consumir desde componentes React"
  - "Para sets/helpers compartidos entre navigation.ts y la UI admin: export desde navigation.ts + import en la page (no duplicar); ejemplificado con DESKTOP_MVP_ALLOWED + isMvpDefault()"
  - "Seed lazy de docs singleton Firestore: setDoc con merge:true crea o actualiza — no necesitamos un 'ensure doc exists' upfront"

requirements-completed: [PREC-04]

duration: 5min
completed: 2026-04-20
---

# Phase 5 Plan 04: Feature Flags runtime + UI admin toggle de módulos Summary

**Colección Firestore `/featureFlags/modules` + `useNavigation()` hook reactivo (onSnapshot) + página `/admin/modulos` con toggles live — admin activa/desactiva módulos del sidebar sin rebuild, override por módulo gana sobre `VITE_DESKTOP_MVP`.**

## Performance

- **Duration:** 5m
- **Started:** 2026-04-20T12:33:08Z
- **Completed:** 2026-04-20T12:37:58Z
- **Tasks:** 3 de 4 completadas (Task 4 es checkpoint human-verify — pendiente de run manual del usuario)
- **Files modified:** 8 (3 creados, 5 modificados)

## Accomplishments

- `featureFlagsService` con 3 operaciones: `subscribeFeatureFlags` (onSnapshot con normalización de Timestamps → ISO), `getFeatureFlagsOnce` (one-shot read), `setModuleEnabled` (setDoc merge, crea el doc lazy al primer toggle). Todos los writes pasan por `deepCleanForFirestore`.
- `FeatureFlagsProvider` + `useFeatureFlags()` hook: `null` inicial (loading) → `{ modules: {...} }` después del primer snapshot. Suscripción activa solo en la rama autenticada del `AuthGate`.
- `useNavigation()` hook reactivo en `navigation.ts`: precedencia Firestore override > env flag > default visible. `getNavigation()` pure retained para callers fuera de React (0 consumidores actuales según grep — solo el propio archivo lo usaba internamente antes).
- `DESKTOP_MVP_ALLOWED` promovido de `const` privado a `export const` + helper `isMvpDefault(path)` — la UI admin consume ambos sin duplicar el set (A1 check clean).
- `SidebarNav.tsx` swap literal: `getNavigation() → useNavigation()` (2 líneas cambiadas). Filtro por rol (`canAccess(item.modulo)`) preservado.
- `/admin/modulos` (`ModulosAdminPage`, 128 líneas): lista de todos los módulos con toggle por fila, label "· OVERRIDE" cuando el módulo tiene entry en Firestore, mensaje que explica el estado current de `VITE_DESKTOP_MVP`. Accesible desde sidebar entry 🧩 **Módulos**, ruta gate por `ProtectedRoute allowedRoles={['admin']}`.
- Type-check limpio; web build (`pnpm --filter sistema-modular build:web`) pasa en ~15s sin errores nuevos.

## Task Commits

Each task was committed atomically:

1. **Task 1: featureFlagsService + FeatureFlagsContext + wired en App.tsx** — `19e779c` (feat)
2. **Task 2: useNavigation() hook reactivo + DESKTOP_MVP_ALLOWED exportado** — `bbe0174` (feat)
3. **Task 3: ModulosAdminPage + route /admin/modulos + sidebar entry** — `392688b` (feat)

**Plan metadata:** pending — applied at end of plan execution.

## Files Created/Modified

- `apps/sistema-modular/src/services/featureFlagsService.ts` — 100 líneas, service singleton para `/featureFlags/modules`.
- `apps/sistema-modular/src/contexts/FeatureFlagsContext.tsx` — 39 líneas, provider + hook con null como loading state.
- `apps/sistema-modular/src/pages/admin/ModulosAdminPage.tsx` — 128 líneas (bajo budget 250), UI toggles.
- `apps/sistema-modular/src/App.tsx` — import + `<FeatureFlagsProvider>` anidado dentro de `<ConfirmDialogProvider>`.
- `apps/sistema-modular/src/components/layout/navigation.ts` — export `DESKTOP_MVP_ALLOWED`, nuevos `useNavigation()`, `getAllModulePaths()`, `isMvpDefault()`, entrada sidebar "Módulos".
- `apps/sistema-modular/src/components/layout/SidebarNav.tsx` — swap `getNavigation()` → `useNavigation()` (líneas 4 y 28).
- `apps/sistema-modular/src/components/layout/TabContentManager.tsx` — import `ModulosAdminPage` + ruta `/admin/modulos` protected.
- `apps/sistema-modular/src/pages/admin/index.ts` — barrel export default `ModulosAdminPage`.

## Decisions Made

- **Routing en `TabContentManager.tsx`, no `App.tsx`:** El plan decía "edit App.tsx"; obedezco la orchestrator decision y sigo el patrón que 05-01 estableció. `App.tsx` solo monta `<AuthGate>` → `<Layout>`; las `<Route>` reales viven en `components/layout/TabContentManager.tsx` dentro del `<AppRoutes />` que cada tab usa en su `MemoryRouter`. Sin esta decisión la ruta no habría resuelto.
- **Shape de `useAuth()`:** Verificado en `apps/sistema-modular/src/contexts/AuthContext.tsx` (PASO 0 del plan). Retorno: `{ firebaseUser, usuario, loading, authError, isAuthenticated, isPending, isDisabled, hasRole, canAccess }`. El uid real (Firebase Auth) está en `firebaseUser.uid`; `usuario` es el doc Firestore `UsuarioAGS` con `.id` = uid también, pero usé `firebaseUser.uid` por ser la fuente canónica y porque `usuario` puede ser null en transiciones. El plan ejemplificaba `user?.uid`; adapté al shape real sin incidentes.
- **`FeatureFlagsProvider` en la rama autenticada:** El plan decía "inmediatamente dentro de AuthProvider". Revisé `App.tsx`: `AuthProvider` envuelve `AuthGate`, y solo en la rama autenticada del `AuthGate` se montan los demás providers (`BackgroundTasksProvider`, etc.). Colocar `FeatureFlagsProvider` a nivel de `AuthProvider` habría iniciado la suscripción antes del login. Lo anidé dentro de `ConfirmDialogProvider` en la rama autenticada — consistente con el resto de providers y asegura que solo usuarios autenticados consumen la suscripción.
- **`components/ui/Switch` no existe:** Grepped — solo `Button`, `Card`, `Input`, `SearchableSelect` en `components/ui/`. Inline `Toggle` implementado en `ModulosAdminPage.tsx` (19 líneas incluyendo accesibilidad con `aria-pressed` y `aria-label`). Si futuros plans necesitan `Switch`, extraer este a `components/ui/Switch.tsx`.
- **Card atom no usado en ModulosAdminPage:** El atom `Card` (`components/ui/Card.tsx`) siempre wrappea children en `p-4` o `p-6`, lo cual pisaría la separación row-to-row. Para una tabla de filas sin padding interno usé un `<div>` con `bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden` directo, manteniendo el look consistente con el Card atom.
- **Seed lazy del doc:** No creo el doc `/featureFlags/modules` en el provider mount (read-only). El doc nace del primer `setModuleEnabled` (setDoc con `merge: true`). Los callers que no tienen override ven `{ modules: {} }` y caen al default del env. Esto evita write-on-mount y reduce complejidad.
- **Entrada sidebar fuera de MVP:** "Módulos" (`/admin/modulos`) NO se agregó a `DESKTOP_MVP_ALLOWED`. Es herramienta admin, no MVP. El gate por rol ocurre naturalmente vía `canAccess('admin')` en `SidebarNav`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Ruta admin registrada en `TabContentManager.tsx` en lugar de `App.tsx`**
- **Found during:** Task 3 (registrar la ruta)
- **Issue:** El plan decía "`apps/sistema-modular/src/App.tsx`" para la `<Route>` nueva, pero el routing real vive en `components/layout/TabContentManager.tsx` (ver 05-01-SUMMARY). Editar `App.tsx` habría dejado la ruta sin efecto (al igual que pasó en 05-01).
- **Fix:** Agregué import de `ModulosAdminPage` y `<Route path="/admin/modulos" element={<ProtectedRoute allowedRoles={['admin']}>...} />` en `TabContentManager.tsx`, siguiendo literalmente el patrón de `/admin/revision-clienteid` que 05-01 dejó.
- **Files modified:** apps/sistema-modular/src/components/layout/TabContentManager.tsx
- **Verification:** `pnpm --filter sistema-modular build:web` pasa; la ruta aparece en el bundle.
- **Committed in:** `392688b` (Task 3 commit)

**2. [Rule 3 - Blocking] `Card` atom no acepta prop `padding="none"`**
- **Found during:** Task 3 (primer draft del JSX)
- **Issue:** El skeleton del plan usaba `<Card className="p-0">` y mi draft inicial usó `<Card padding="none">`. El atom `Card` NO tiene esa prop — siempre aplica `p-4` (compact) o `p-6` internamente, y el `className` solo se aplica al wrapper exterior. El resultado habría sido doble-padding en las filas.
- **Fix:** Reemplacé `<Card>` por un `<div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">` directo. Misma apariencia visual sin el padding interno.
- **Files modified:** apps/sistema-modular/src/pages/admin/ModulosAdminPage.tsx
- **Verification:** Build pasa; revisión visual de la estructura de DOM confirma separación neta row-to-row.
- **Committed in:** `392688b` (Task 3 commit)

**3. [Rule 3 - Blocking] Shape real de `useAuth()`: `firebaseUser.uid` no `user.uid`**
- **Found during:** Task 3 (PASO 0 del plan — leer shape real de useAuth)
- **Issue:** Plan ejemplificaba `const { user } = useAuth()` + `user?.uid`. La API real expone `{ firebaseUser, usuario, ... }`; el uid vive en `firebaseUser.uid`.
- **Fix:** Adapté a `const { firebaseUser } = useAuth()` + `firebaseUser?.uid`.
- **Files modified:** apps/sistema-modular/src/pages/admin/ModulosAdminPage.tsx
- **Verification:** Type-check pasa; el handler `handleToggle` short-circuits cuando `uid` es undefined (loading/logout transitorio).
- **Committed in:** `392688b` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (todos Rule 3 - Blocking en Task 3)
**Impact on plan:** Las 3 desviaciones eran necesarias para que el código compile y las rutas resuelvan correctamente. La intención del plan se preserva íntegramente. El PASO 0 del Task 3 estaba diseñado específicamente para capturar estas divergencias (useAuth shape), lo cual funcionó exactamente como se esperaba — y el review de 05-01-SUMMARY capturó las otras dos antes de que se convirtieran en bugs.

## Issues Encountered

- **Pre-existing TypeScript errors en sistema-modular** (observados al correr `pnpm --filter sistema-modular exec tsc --noEmit`): errores en `personalService.ts`, `presupuestosService.ts`, `stockService.ts`, `vehiculosService.ts`, `serviceCache.ts`. Ninguno en archivos de este plan. Son los mismos errores documentados por 05-01 en `deferred-items.md`. `pnpm type-check` (el que el plan invoca — solo corre `packages/*`) pasa limpio. Web build (`build:web`) también pasa (Vite ignora los errores de archivos no tocados).
- **Archivo `apps/reportes-ot/components/CatalogCoverView.tsx` quedó modificado en working tree** sin que ningún task de 05-04 lo haya tocado (aparece como `M` en `git status` pero no forma parte del commit de ninguno de los 3 tasks). Es anterior a esta ejecución y pertenece al surface frozen — NO lo toqué por el guard hook (`guard-reportes-ot`). Queda como unstaged drift para que el usuario decida si lo commitea en otro turno.

## User Setup Required

**Firestore Security Rules (recomendado antes de producción):** La colección `/featureFlags/modules` queda lazily creada; no hay rules específicas todavía. Agregar en `firestore.rules` (cuando exista el archivo o en el proyecto Firebase console):

```
match /featureFlags/{docId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null
    && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
}
```

Mientras tanto, el gate por rol está garantizado en el lado del cliente (`ProtectedRoute allowedRoles={['admin']}`) y el UI solo permite escritura desde `/admin/modulos`. Esto es suficiente para el MVP; reforzar con rules antes del rollout externo.

**No hace falta ninguna otra config externa** — el resto del flujo es pure client-side con Firestore.

## Next Phase Readiness

- **PREC-04 desbloqueado:** Admin puede activar/desactivar módulos del sidebar sin rebuild/redeploy. Establece patrón de feature flags runtime para futuros casos (beta testing por rol, rollouts graduales — v2.1).
- **No bloquea phases posteriores:** Phase 6+ puede consumir `useFeatureFlags()` para crear flags adicionales (p.ej. feature flag `contratos.mixta_enabled`) sin refactor previo.
- **Pending human-verify:** Usuario ejecuta `pnpm dev:modular`, abre `/admin/modulos` como admin, togglea un módulo (p.ej. Agenda), confirma que el sidebar re-renderiza live sin recarga. Ver checklist completo en el plan (Task 4). Hasta que esa verificación pase, el plan queda en estado "ejecutado pero no verificado" — similar a 05-01 que todavía espera run manual de scripts.

## Self-Check

All 8 expected files exist on disk:
- Created: `featureFlagsService.ts`, `FeatureFlagsContext.tsx`, `ModulosAdminPage.tsx` (all 3 confirmed present via Write tool).
- Modified: `App.tsx`, `navigation.ts`, `SidebarNav.tsx`, `TabContentManager.tsx`, `pages/admin/index.ts` (all 5 confirmed via Edit tool).

All 3 task commits exist in git log: `19e779c`, `bbe0174`, `392688b`. Verification via `git rev-parse --short HEAD` immediately after each commit.

No missing items.

## Self-Check: PASSED

---
*Phase: 05-pre-condiciones-migracion-infra*
*Completed: 2026-04-20*
