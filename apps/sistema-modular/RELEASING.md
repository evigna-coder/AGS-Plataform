# Releasing sistema-modular

Pipeline para publicar una nueva versión del instalable Windows.

## Setup inicial (una sola vez)

### 1. Crear PAT de GitHub

Necesitamos un fine-grained Personal Access Token para que la GH Action publique releases y para que los clientes instalados puedan descargar updates desde el repo privado.

1. Ir a https://github.com/settings/personal-access-tokens
2. **Generate new token** → fine-grained
3. Configurar:
   - **Resource owner**: `evigna-coder` (o la cuenta dueña del repo)
   - **Repository access**: Only select repositories → `AGS-Plataform`
   - **Permissions**:
     - `Contents`: Read and write (para crear releases)
     - `Metadata`: Read (auto)
   - **Expiration**: 90 días o más
4. Copiar el token (empieza con `github_pat_...`)

### 2. Guardar como secret del repo

1. Ir al repo en GitHub: https://github.com/evigna-coder/AGS-Plataform
2. Settings → Secrets and variables → Actions → New repository secret
3. Name: `RELEASES_TOKEN`
4. Value: el token creado en el paso anterior

> ⚠️ Este mismo token se embebe en el `.exe` (en `app-update.yml`) para que la app instalada pueda consultar releases del repo privado. Si el token se filtra, alguien con el `.exe` podría leer y publicar releases. Aceptamos este trade-off porque los usuarios del instalable son internos.

## Cortar una nueva versión

Desde la raíz del monorepo, en `main`, con el working tree limpio:

```bash
# Bug fixes
pnpm --filter @ags/sistema-modular release:patch

# Features nuevas
pnpm --filter @ags/sistema-modular release:minor

# Breaking changes
pnpm --filter @ags/sistema-modular release:major
```

El script:
1. Bumpea `apps/sistema-modular/package.json` (ej: 1.0.0 → 1.0.1)
2. Crea commit `release(sistema-modular): v1.0.1`
3. Crea tag `sistema-modular-v1.0.1`
4. **No pushea** — querés revisar primero

Cuando estés listo:
```bash
git push --follow-tags origin main
```

El push del tag dispara la GH Action `release-sistema-modular.yml` que:
1. Buildea en `windows-latest`
2. Genera `AGS-Sistema-Modular-Setup-X.Y.Z.exe`
3. Crea el GitHub Release y sube el `.exe` + `latest.yml`

A los pocos minutos, los clientes instalados detectan el update vía `electron-updater`, lo bajan en background y muestran el popup *"Reiniciar ahora"*.

## Build local sin publicar

Para probar el instalable sin tocar releases:

```bash
cd apps/sistema-modular
pnpm build
# Output: release/AGS-Sistema-Modular-Setup-X.Y.Z.exe
```

## Regenerar el ícono

El ícono está en `build/icon.ico`. Si cambia el logo:

```bash
cd apps/sistema-modular
# 1. Regenerar PNG cuadrado 256x256 (script PowerShell o manualmente)
# 2. Regenerar ICO multi-resolución:
node -e "require('png-to-ico').default('build/icon-256.png').then(b => require('fs').writeFileSync('build/icon.ico', b))"
```
