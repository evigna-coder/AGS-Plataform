# Rule: Release flow para sistema-modular

## Invariant

`sistema-modular` está instalado como `.exe` en varias PCs y se actualiza vía
auto-update (electron-updater + GitHub Releases). Cualquier cambio que toque
código de runtime y deba llegar a usuarios finales **tiene que pasar por el
flow de release**, no alcanza con commitear y pushear `main`.

## Por qué

- Los usuarios corren la app instalada. Un commit en `main` sin un tag de
  release nuevo no se distribuye.
- Sin tag, la GH Action no se dispara y no se publica nuevo `.exe` ni
  `latest.yml` para que el auto-updater detecte la versión.
- Los builds locales con `pnpm build` solo sirven para testear en la máquina
  del dev, no se distribuyen.

## Cuándo aplica

| Tipo de cambio | Necesita release | Cuándo cortarlo |
|---|---|---|
| Bug fix visible al usuario | **Sí** (`patch`) | Apenas se confirme localmente |
| Feature nueva al usuario | **Sí** (`minor`) | Cuando esté terminada |
| Breaking change | **Sí** (`major`) | Cuando esté coordinado con users |
| Refactor interno sin cambio de comportamiento | No (commiteá normal) | — |
| Cambio en docs / CLAUDE.md / scripts no-runtime | No | — |
| Cambios en `apps/reportes-ot/` o `apps/portal-ingeniero/` | No (otras apps) | — |
| Cambios en `packages/shared` consumidos por sistema-modular | **Sí** | Junto con el cambio de runtime que los consume |

## Cómo aplicar

Detalles operativos en [apps/sistema-modular/RELEASING.md](../../apps/sistema-modular/RELEASING.md). Resumen:

1. Confirmar el cambio funciona local (`pnpm build` desde `apps/sistema-modular`, instalar el `.exe` resultante, validar)
2. Working tree limpio + `main` branch
3. Bumpear:
   ```bash
   pnpm --filter @ags/sistema-modular release:patch   # bug fix
   pnpm --filter @ags/sistema-modular release:minor   # feature
   pnpm --filter @ags/sistema-modular release:major   # breaking
   ```
   Esto actualiza `package.json`, commitea y crea el tag `sistema-modular-v<x.y.z>` localmente.
4. Push:
   ```bash
   git push origin main && git push origin sistema-modular-v<x.y.z>
   ```
5. La GH Action `release-sistema-modular.yml` se dispara con el tag, builda en `windows-latest`, publica el release. Las PCs instaladas reciben el popup *"Reiniciar ahora"* en los próximos minutos.

## Antes de cortar release

Pasada mínima de validación en [apps/sistema-modular/RELEASE-CHECKLIST.md](../../apps/sistema-modular/RELEASE-CHECKLIST.md) — login, módulos críticos, PDFs, Excel. Cinco minutos que evitan bombardear a los usuarios con auto-updates rotos.

## Pitfalls conocidos

- **Working tree con cambios del usuario antes de release**: el script de release rechaza working tree no-limpio. Si hay WIP del user (typescript editor / playwright tests / lo que sea), `git stash push -u`, correr release, `git stash pop`.
- **Tag apuntando a commit viejo**: si entre el commit del bump y el push hay otros commits, el tag puede haber quedado atrás. Verificar `git log --oneline -1 sistema-modular-v<x.y.z>` antes de pushear el tag.
- **CI falla por env vars**: el bundle CI necesita `.env.local` con las VITE_FIREBASE_* / VITE_GOOGLE_*. El workflow lo escribe desde GH Secrets ([release-sistema-modular.yml](../../.github/workflows/release-sistema-modular.yml)). Si la action falla con "API key invalid" o "client is offline", revisar que los secrets estén bien.
- **CSP**: cambios que requieran nuevas directivas (wasm, eval, dominios externos) van en `electron/main.cjs` → `ourCsp`. Hoy es laxa (matchea dev = prod) para evitar sorpresas, pero cualquier nuevo dominio externo debe agregarse explícitamente.
