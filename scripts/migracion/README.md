# AGS — Script de Migración desde Excel

Migra datos maestros (Clientes, Establecimientos, Sistemas, Módulos) desde un archivo `.xlsx` a Firestore.

---

## Requisitos previos

1. **Node.js 18+** y **pnpm** instalados.
2. **`service-account.json`** en este directorio (solo para el modo `--run`).
   Solicitá la clave JSON al administrador de la empresa. **No la commitees.**
3. Instalar dependencias:
   ```bash
   cd scripts/migracion
   pnpm install
   ```

---

## Uso

```bash
# 1. Validar el Excel sin escribir nada en Firestore:
npx ts-node migrar-desde-excel.ts --dry-run

# 2. Cuando el dry-run no arroja errores, ejecutar la migración real:
npx ts-node migrar-desde-excel.ts --run

# 3. Migrar solo una entidad:
npx ts-node migrar-desde-excel.ts --run --only=clientes
npx ts-node migrar-desde-excel.ts --run --only=establecimientos
npx ts-node migrar-desde-excel.ts --run --only=sistemas
npx ts-node migrar-desde-excel.ts --run --only=modulos
```

**Flujo recomendado:**
1. Preparar el Excel con el formato que se describe abajo.
2. Colocar el archivo en `scripts/migracion/input/datos.xlsx`.
3. Ejecutar `--dry-run` y corregir todos los errores.
4. Ejecutar `--run` con el `service-account.json` disponible.
5. El script guarda un reporte en `output/` (se excluye del git).

---

## Formato del Excel

El archivo debe llamarse **`datos.xlsx`** y contener **4 hojas** con exactamente estos nombres:

| # | Nombre de hoja | Descripción |
|---|---------------|-------------|
| 1 | `Clientes` | Empresas/clientes de AGS |
| 2 | `Establecimientos` | Sedes, plantas o ubicaciones por cliente |
| 3 | `Sistemas` | Equipos/sistemas instalados en un establecimiento |
| 4 | `Modulos` | Módulos (tarjetas, variadores, etc.) dentro de un sistema |

> **Importante:** La fila 1 de cada hoja debe ser el encabezado (nombres de columna).
> Los datos comienzan en la fila 2.

---

### Hoja 1 — `Clientes`

| Col | Nombre exacto de columna | Tipo | Req. | Ejemplo |
|-----|--------------------------|------|------|---------|
| A | `CUIT` | Texto/Número | ✅ | `30-71234567-9` o `30712345679` |
| B | `Razon Social` | Texto | ✅ | `ACME S.A.` |
| C | `Pais` | Texto | ✅ | `Argentina` |
| D | `Rubro` | Texto | ⚠️ | `Alimenticio` |
| E | `Direccion Fiscal` | Texto | ➖ | `Av. Siempreviva 742` |
| F | `Localidad` | Texto | ➖ | `Rosario` |
| G | `Provincia` | Texto | ➖ | `Santa Fe` |
| H | `Condicion IVA` | Texto | ➖ | `Responsable Inscripto` |
| I | `Notas` | Texto | ➖ | `Cliente VIP` |

**Notas:**
- El **CUIT** es el identificador único. Si ya existe en Firestore, la fila se omite (SKIP).
- El CUIT puede escribirse con o sin guiones: `30-71234567-9` y `30712345679` son equivalentes.
- `Pais` por defecto es `Argentina` si se deja vacío.
- ✅ = requerido, bloquea la migración si está vacío
  ⚠️ = recomendado, genera advertencia si está vacío
  ➖ = opcional

---

### Hoja 2 — `Establecimientos`

| Col | Nombre exacto de columna | Tipo | Req. | Ejemplo |
|-----|--------------------------|------|------|---------|
| A | `CUIT Cliente` | Texto/Número | ✅ | `30712345679` |
| B | `Nombre` | Texto | ✅ | `Planta Norte` |
| C | `Direccion` | Texto | ✅ | `Ruta 9 Km 42` |
| D | `Localidad` | Texto | ✅ | `Córdoba` |
| E | `Provincia` | Texto | ✅ | `Córdoba` |
| F | `Codigo Postal` | Texto | ➖ | `5000` |
| G | `Tipo` | Texto | ➖ | `Planta` / `Oficina` / `Depósito` |
| H | `Latitud` | Número | ➖ | `-31.4201` |
| I | `Longitud` | Número | ➖ | `-64.1888` |

**Notas:**
- `CUIT Cliente` debe coincidir exactamente con un CUIT de la hoja `Clientes`.
- La clave de deduplicación es **CUIT Cliente + Nombre**. Si ya existe un establecimiento con ese par, se omite.
- `Tipo` es texto libre (sin validación estricta).

---

### Hoja 3 — `Sistemas`

| Col | Nombre exacto de columna | Tipo | Req. | Ejemplo |
|-----|--------------------------|------|------|---------|
| A | `CUIT Cliente` | Texto/Número | ✅ | `30712345679` |
| B | `Establecimiento` | Texto | ✅ | `Planta Norte` |
| C | `Categoria ID` | Texto | ✅ | `variadores` / `ups` / `gc` |
| D | `Nombre Sistema` | Texto | ✅ | `Cromatógrafo Gaseoso Agilent 7890` |
| E | `Codigo Interno` | Texto | ✅ | `CLI-001` |
| F | `Software` | Texto | ➖ | `ChemStation Rev. B.04` |
| G | `Observaciones` | Texto | ➖ | `Requiere N2 de alta pureza` |
| H | `GC Puerto Front` | Texto | ➖ ⚠️ | `SSL` / `COC` / `PTV` |
| I | `GC Puerto Back` | Texto | ➖ ⚠️ | `SSL` / `COC` / `PTV` |
| J | `GC Detector Front` | Texto | ➖ ⚠️ | `FID` / `NCD` / `FPD` / `ECD` / `SCD` |
| K | `GC Detector Back` | Texto | ➖ ⚠️ | `FID` / `NCD` / `FPD` / `ECD` / `SCD` |

**Notas:**
- `Establecimiento` debe coincidir exactamente (mismo nombre) con una fila de la hoja `Establecimientos` para el mismo `CUIT Cliente`.
- `Categoria ID` debe ser un ID válido de la colección `categorias_equipo` en Firestore.
  Consultá los IDs disponibles en el sistema antes de migrar.
- `Codigo Interno` es el identificador del sistema dentro del cliente. Debe ser único por cliente.
  La clave de deduplicación es **CUIT Cliente + Codigo Interno**.

#### Columnas GC (Cromatógrafo Gaseoso) — cols H a K

Las columnas H–K son **opcionales** y solo aplican a sistemas cuyo `Nombre Sistema` contiene la palabra **"gaseoso"** (sin distinción de mayúsculas).

| Campo | Valores válidos |
|-------|----------------|
| `GC Puerto Front` | `SSL` · `COC` · `PTV` |
| `GC Puerto Back` | `SSL` · `COC` · `PTV` |
| `GC Detector Front` | `FID` · `NCD` · `FPD` · `ECD` · `SCD` |
| `GC Detector Back` | `FID` · `NCD` · `FPD` · `ECD` · `SCD` |

Referencia rápida de siglas:

| Código | Nombre completo |
|--------|----------------|
| SSL | Split/Splitless |
| COC | Cool on Column |
| PTV | Programmed Temperature Vaporization |
| FID | Flame Ionization Detector |
| NCD | Nitrogen/Phosphorus Detector |
| FPD | Flame Photometric Detector |
| ECD | Electron Capture Detector |
| SCD | Sulfur Chemiluminescence Detector |

> Si el sistema NO contiene "gaseoso" pero se completan estas columnas, el script genera una **advertencia** (no bloquea).
> Si el sistema SÍ contiene "gaseoso" y se completan con valores inválidos, el script genera un **error bloqueante**.

---

### Hoja 4 — `Modulos`

| Col | Nombre exacto de columna | Tipo | Req. | Ejemplo |
|-----|--------------------------|------|------|---------|
| A | `CUIT Cliente` | Texto/Número | ✅ | `30712345679` |
| B | `Establecimiento` | Texto | ✅ | `Planta Norte` |
| C | `Codigo Sistema` | Texto | ✅ | `CLI-001` |
| D | `Nombre Modulo` | Texto | ✅ | `Variador de frecuencia principal` |
| E | `Numero Serie` | Texto | ✅ | `A13456789` |
| F | `Firmware` | Texto | ➖ | `v3.14` |
| G | `Marca` | Texto | ➖ | `Allen-Bradley` |
| H | `Observaciones` | Texto | ➖ | `Reemplazado en OT-2024-001` |

**Notas:**
- `Codigo Sistema` debe coincidir con el `Codigo Interno` de la hoja `Sistemas` para el mismo `CUIT Cliente`.
- `Numero Serie` es el identificador único del módulo dentro del sistema.
  La clave de deduplicación es **sistema padre + Numero Serie**. Si ya existe, se omite.

---

## Ejemplo mínimo de Excel

### Hoja `Clientes`

| CUIT | Razon Social | Pais | Rubro |
|------|-------------|------|-------|
| 30712345679 | ACME S.A. | Argentina | Alimenticio |
| 20987654321 | BETA SRL | Argentina | Químico |

### Hoja `Establecimientos`

| CUIT Cliente | Nombre | Direccion | Localidad | Provincia |
|-------------|--------|-----------|-----------|-----------|
| 30712345679 | Planta Norte | Ruta 9 Km 42 | Córdoba | Córdoba |
| 30712345679 | Depósito Sur | Av. Industrial 100 | Villa María | Córdoba |
| 20987654321 | Sede Central | Belgrano 1500 | Rosario | Santa Fe |

### Hoja `Sistemas`

| CUIT Cliente | Establecimiento | Categoria ID | Nombre Sistema | Codigo Interno |
|-------------|----------------|-------------|---------------|----------------|
| 30712345679 | Planta Norte | variadores | Línea de Envase A | ACME-001 |
| 30712345679 | Planta Norte | ups | UPS sala servidores | ACME-002 |
| 20987654321 | Sede Central | arrancadores | Compresor principal | BETA-001 |

### Hoja `Modulos`

| CUIT Cliente | Establecimiento | Codigo Sistema | Nombre Modulo | Numero Serie |
|-------------|----------------|----------------|--------------|-------------|
| 30712345679 | Planta Norte | ACME-001 | Variador PowerFlex 755 | SN-A13456789 |
| 30712345679 | Planta Norte | ACME-001 | Variador PowerFlex 753 | SN-B98765432 |
| 30712345679 | Planta Norte | ACME-002 | UPS APC 10kVA | SN-UPS001 |
| 20987654321 | Sede Central | BETA-001 | Arrancador suave ABB | SN-ABB2024 |

---

## Errores comunes

| Error | Causa | Solución |
|-------|-------|----------|
| `CUIT inválido: "30-71-12345"` | CUIT con formato incorrecto | Usar solo dígitos o formato `XX-XXXXXXXX-X` |
| `CUIT no existe en hoja Clientes` | `CUIT Cliente` en Establecimientos no coincide | Verificar que el CUIT esté en la hoja Clientes |
| `Establecimiento "X" no encontrado` | El nombre no coincide exactamente | Verificar espacios, mayúsculas, tildes |
| `Sistema con código "X" no encontrado` | `Codigo Sistema` en Módulos no coincide | Verificar que el código esté en la hoja Sistemas |

> **Tip:** Siempre ejecutar `--dry-run` primero. El script no escribe nada hasta que no haya errores bloqueantes y se pase `--run`.
