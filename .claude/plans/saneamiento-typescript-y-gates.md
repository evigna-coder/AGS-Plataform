# Plan: Saneamiento TypeScript + gates de calidad

> Origen: análisis completo del sistema-modular (2026-07-05). `npx tsc --noEmit` reporta ~24
> errores que hoy conviven con releases porque ni Vite ni la GH Action type-checkean.
> Objetivo: dejar `tsc` en 0 errores y que no pueda volver a degradarse.

## Estado

- [x] Fase 0 — Fix del WIP (bloqueante, bug real) — 2026-07-05
- [x] Fase 1 — tsc a cero errores — 2026-07-05 (verificado: tsc 0 + tests stock-amplio 5/5, cuotas 24/24, equivalencias 9/9, patron-bom 18/18)
- [x] Fase 2 — Gates (script + CI) — 2026-07-05 (falta que un release real lo ejercite)
- [ ] Fase 3 — @types/react 19 (sesión aparte)
- [x] Fase 4 — Ruta 404 — 2026-07-05 (`NotFoundPage` + catch-all en TabContentManager; smoke manual pendiente)
- [ ] Fase 5 — Operativos (requieren deploy/decisión del user)

---

## Fase 0 — Fix del bug `atp` en el WIP de presupuestos

**Problema:** [AddItemModal.tsx:93](../../apps/sistema-modular/src/components/presupuestos/AddItemModal.tsx#L93)
hace `stock.atp ?? 0`, pero `StockAmplio` (shared types L2775) **no tiene campo `atp`** — tiene
los 4 buckets `disponible / enTransito / reservado / comprometido`. Como `undefined ?? 0` → 0,
el hint de disponibilidad **siempre** cae en `a_importar` / ETA 30 días aunque haya stock.
Bug funcional silencioso, no solo de tipos.

**Fix:**
1. En [atpHelpers.ts](../../apps/sistema-modular/src/services/atpHelpers.ts) exportar el helper:
   ```ts
   /** ATP = disponible + enTransito + reservado + comprometido (STKP-01, fórmula canónica). */
   export function atpFromStockAmplio(sa: StockAmplio): number {
     return sa.disponible + sa.enTransito + sa.reservado + sa.comprometido;
   }
   ```
   y hacer que `itemRequiresImportacion` lo use (hoy duplica la suma en línea 34).
2. En `AddItemModal.tsx` L93: `const atp = atpFromStockAmplio(stock);`

**Cuidado:** el archivo es parte del WIP sin commitear del buscador de items
(`PresupuestoItemSearch.tsx` nuevo, `ArticuloPickerPanel.tsx` borrado). No tocar nada más
del WIP; solo la línea del bug.

**Verificar:** en la UI, elegir un artículo con unidades disponibles en el modal de agregar
item → el hint debe decir stock disponible (disponibilidad `stock`, ETA 0), no `a_importar`.

---

## Fase 1 — `tsc --noEmit` a cero errores

Errores reales primero, ruido después. Ninguno cambia comportamiento salvo donde se indica.

### 1a. Errores de sustancia

| Archivo | Error | Fix |
|---|---|---|
| `services/__tests__/fixtures/cuotasFacturacion.ts:132` | `"solicitada"` no existe en `SolicitudFacturacionEstado` (valores válidos: `pendiente/enviada/facturada/cobrada/anulada`) | Revisar qué semántica quería el fixture (probablemente `pendiente` o `enviada`) y correr `pnpm test:cuotas` (o el script `test:*` que corresponda) para confirmar que el test sigue verde |
| `services/__tests__/equivalencias.test.ts:46,51,56,61` | `assert.throws/rejects` con `undefined` como 2º argumento (`AssertPredicate`) | Omitir el argumento o pasar el mensaje como 2º parámetro correctamente; correr el test después |
| `services/stockAmplioService.ts:176-178` | Parámetros `r`, `acc` con `any` implícito | Tipar con `StockAmplioBreakdownEntry` / el tipo real del row. **No** cambiar lógica: es la fuente de verdad del ATP y tiene mirror en `functions/src/computeStockAmplioAdmin.ts` (mantener sync solo si cambia lógica — acá no cambia) |

### 1b. Variables muertas (TS6133) — borrar, no suprimir

- `src/__tests__/patronBom.test.ts:55` — `otPatronesSeleccionadosDuplicados`
- `src/components/agenda/AgendaGridCell.tsx:4,59,60` — import + 4 destructures sin uso
- `src/components/patrones/MigracionPatronesModal.tsx:4` — import `MigracionPreviewItem`
- `src/components/presupuestos/PresupuestoHeaderBar.tsx:24,26` — props `presupuestoId`, `onClose`
  (ojo: si son props de la interfaz pública del componente, evaluar si el caller las pasa;
  si nadie las usa, sacarlas también de la interface)
- `src/components/ui/SearchableSelect.tsx:39` — `searchTerm` (átomo compartido: solo borrar
  la variable, no refactorizar nada más)
- `src/pages/leads/LeadsList.tsx:372` — `canModify`
- `src/services/geocodingService.ts:60` — `reject` sin uso en el executor de la Promise
- `src/utils/cuotasFacturacion.ts:41` — `newCuotaId`

### Verificación de fase

```bash
cd apps/sistema-modular && npx tsc --noEmit   # → 0 errores
pnpm test:cuotas / test:equivalencias / test:stock-amplio (los scripts test:* afectados)
```

---

## Fase 2 — Gates para que no vuelva a pasar

1. **Script en `apps/sistema-modular/package.json`:**
   ```json
   "type-check": "tsc --noEmit"
   ```
2. **Root `package.json`:** hoy `pnpm type-check` solo cubre `packages/*`. Ampliar:
   ```json
   "type-check": "pnpm --filter \"./packages/*\" --filter @ags/sistema-modular type-check"
   ```
   (portal-ingeniero y reportes-ot quedan fuera de este plan; sumarlos después si su tsc está limpio.)
3. **GH Action** [release-sistema-modular.yml](../../.github/workflows/release-sistema-modular.yml):
   agregar step entre "Install dependencies" y "Write .env.local":
   ```yaml
   - name: Type-check
     working-directory: apps/sistema-modular
     run: pnpm exec tsc --noEmit
   ```
   **Riesgo a verificar antes de commitear:** que `tsc` resuelva `@ags/shared` desde el
   workspace sin build previo (localmente funciona porque el paquete apunta a source;
   confirmar que en CI `pnpm install` deja el symlink igual). Probar con un tag de prueba
   NO es necesario: basta replicar `pnpm install --frozen-lockfile` + `tsc` en limpio.
4. **Costo:** ~1-2 min por release. Si falla, el release no sale — ese es el punto.

---

## Fase 3 — Alinear `@types/react` con React 19

- `apps/sistema-modular/package.json`: `@types/react` y `@types/react-dom` de `^18.x` → `^19`.
- `pnpm install` (¡verificar `pnpm install --frozen-lockfile` después del update del lockfile
  — pitfall Vercel: drift de lockfile en cualquier app rompe el deploy de todas!).
- Correr `tsc --noEmit`: los types 19 son más estrictos (ej. `JSX.Element` → `React.JSX.Element`,
  refs, `children` implícito eliminado hace rato). Timebox: si aparecen >30 errores nuevos,
  parar, listar, y decidir con el user si va en este ciclo o se difiere.
- Hacer esta fase DESPUÉS de la 2, así el gate ya protege el resultado.

## Fase 4 — Ruta 404

- En `components/layout/TabContentManager.tsx` (`AppRoutes`), agregar al final:
  `<Route path="*" element={<NotFoundPage />} />`.
- `NotFoundPage` mínima reutilizando `EmptyState` (patrón de `AccessDeniedPage`: render
  inline, sin redirect — coherente con el sistema de tabs con MemoryRouter).

---

## Fase 5 — Operativos (código listo o casi; falta deploy/decisión)

Estos NO son parte del ciclo de código anterior; necesitan acción del user o acceso a deploy:

1. **Deployar hardening de reglas Firestore (Fase 1)** — ya testeado en emulador 10/10.
   Antes: correr el skill `firebase-security-rules-auditor`. Gotcha Avast:
   `$env:NODE_EXTRA_CA_CERTS = ...corp-ca-bundle.pem` antes de `firebase deploy`.
2. **mailQueue consumer** — el mail de cierre admin nunca sale (`processMailQueue` vive en
   `reportes-ot-functions`, no desplegado). Decisión: portar el consumer al paquete
   `functions/` raíz (el que sí está desplegado) o desplegar el otro paquete. Diseño chico
   pero es un cambio de infra: plan aparte cuando el user lo priorice.
3. **Tickets duplicados** — correr el script de sincronización del counter + deploy del portal.

---

## Release

- Fases 0+1+4 tocan runtime → salen juntas como **`release:patch`** (o se suben al próximo
  `minor` si el WIP del buscador de presupuestos sale primero — coordinar con el user).
- Fases 2 y 3 son tooling/deps: la 2 no necesita release; la 3 sí toca runtime (types no,
  pero el lockfile/deps sí) → va con el mismo release que corresponda.
- Checklist previo: [RELEASE-CHECKLIST.md](../../apps/sistema-modular/RELEASE-CHECKLIST.md).

## Orden de ejecución sugerido

`0 → 1 → 2 → 4` en una sesión (~1-2 h), verificar con `tsc` + tests + smoke manual del modal
de presupuestos. Fase 3 en sesión aparte (riesgo de fallout desconocido). Fase 5 cuando el
user tenga ventana para deploys.
