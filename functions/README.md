# @ags/functions

Workspace de Cloud Functions para el monorepo AGS. Región: `southamerica-east1`.

## Scripts

```bash
pnpm --filter @ags/functions build         # Compila TS → lib/
pnpm --filter @ags/functions build:watch   # Build en watch
pnpm --filter @ags/functions deploy        # Build + firebase deploy --only functions
pnpm --filter @ags/functions logs          # Tail de logs de functions
pnpm --filter @ags/functions serve         # Emulador local
```

## Funciones actuales

- `helloPing` — HTTP onRequest, sanity check. Devuelve `{ ok, ts, region }`.

Futuras funciones (Phase 9 en adelante):
- `updateResumenStock` — trigger onDocumentWritten para denormalización de stock.

## Deploy manual (primera vez)

```bash
cd <repo root>
firebase login                              # una sola vez
firebase use agssop-e7353                   # apuntar al proyecto
pnpm --filter @ags/functions build
firebase deploy --only functions:helloPing
```

URL resultante (para curl): `https://southamerica-east1-agssop-e7353.cloudfunctions.net/helloPing`
