# Plan: Presentaciones — pool de stock único por unidad base

> Estado: **modelo confirmado (2026-07-24), build NO iniciado.** Reemplaza el modelo de
> equivalencias 1:1 + desagregación (Phase 13) para el caso "mismo artículo, varios N° de
> parte según cantidad".

## Modelo confirmado (Model 1 — pool único)

**Un artículo base** por ítem = **un único pool de stock**, medido en la **unidad más chica**.
Cada N° de parte adicional es una **presentación** del mismo artículo, con un `factor` a unidad
base. Las presentaciones se usan por igual en **compra, presupuesto y venta**. **No hay
conversión física**: cualquier cantidad se expresa/transacciona en cualquier presentación al
instante contra el mismo pool.

Ejemplo del usuario: base = unidad; `4491` ×100, `4492` ×1.000, `4493` ×10.000.
- Ingreso de 1× `4493` → **+10.000** unidades base al pool.
- Venta/presupuesto de 1× `4491` → **−100** unidades base del pool.
- El stock (ej. 43 base) se expresa en cada presentación (0,43 × 4491, 0,043 × 4492, …).

Decisiones del usuario: **A** (PDF de OC muestra el N° de parte del proveedor) ✔, **C** (se puede
transaccionar por la unidad base, factor 1) ✔, **D** (varias presentaciones por artículo) ✔,
**B** (migración) → **manual/asistida, NO automática**.

### Por qué NO se colapsa/borra los artículos-presentación de una

Los N° de parte (4491/4492/4493, 5190-2209, …) están **referenciados en presupuestos y ventas
históricas**. La migración debe **preservar y remapear** esas referencias al artículo base +
presentación, par por par, no borrar.

## Cambio de tipo (`packages/shared`)

```ts
interface Presentacion {
  codigoParte: string;      // N° de parte del proveedor/venta (ej. "4491")
  descripcion?: string | null;
  factor: number;           // unidades base por 1 de esta presentación (entero > 0)
  activo?: boolean;
}

interface Articulo {
  // El artículo base: `codigo` = unidad base, `unidadMedida` = base, stock vive acá.
  presentaciones?: Presentacion[];   // NUEVO
  // equivalencias / articuloIdDestinoEquivalencia → DEPRECADOS (migrar y quitar)
}
```

- Búsqueda de artículos: matchear también por `presentaciones[].codigoParte` (encontrar el base
  tecleando cualquier N° de parte).
- Factor entero > 0 (reusar validación de `linkEquivalencia`).

## Fases

### Fase 1 — Tipos + edición del artículo  *(reversible, no toca stock)*
- `Presentacion` + `Articulo.presentaciones` en `@ags/shared`.
- Editor de artículo: sección "Presentaciones" (alta/baja de `{codigoParte, descripcion, factor}`).
- Búsqueda por `codigoParte`.
- Vista de stock del artículo: mostrar el pool base + "expresado en cada presentación".

### Fase 2 — Compra / ingreso por presentación
- OC/importación: ítem = artículo base + presentación + cantidad (ej. "3 × 4493"). PDF al
  proveedor con el `codigoParte` (decisión A).
- Ingreso: suma `cantidad × factor` unidades **base** al pool (una sola alta, sin desagregar).
- Denormalizar en el `MovimientoStock`: presentación + factor usados.

### Fase 3 — Presupuesto / venta por presentación  *(módulo comercial — sensible)*
- Ítem de presupuesto/venta = artículo base + presentación + cantidad; el precio va por
  presentación (como hoy va en la línea).
- Deducción (cierre OT / venta): descuenta `cantidad × factor` del pool base.
- Revisar todos los puntos que hoy asumen "1 ítem = 1 artículo con su unidad": presupuestos,
  cierre OT (`stockSelections`), reservas.

### Fase 4 — Migración manual/asistida  *(producción — backup + dry-run)*
- Herramienta que, **par por par / familia por familia**, deja: designar el artículo base,
  agregar los demás N° de parte como `presentaciones` con su factor, **remapear** las líneas de
  presupuestos/OCs históricos que referencian los no-base al (base + presentación), consolidar el
  stock existente al pool base, y desactivar el artículo-presentación (sin borrar, para no romper
  históricos ya denormalizados).
- Idempotente, con dry-run (listar qué se tocaría) y `gcloud firestore export` antes.
- Correr desde localhost (`window.__ags`), sin release.

### Fase 5 — Retirar modelo viejo
- Quitar `EquivalenciaDualDisplay` / "Desagregar ahora" / `equivalenciasService` /
  `desagregarUnidades` una vez migrado todo (la conversión ya no existe en Model 1).

## Riesgos / notas
- **Fase 3 toca el módulo comercial** (presupuestos/ventas) — es lo más sensible después de la
  migración. Mucho testing.
- **Migración manual** por diseño: los N° de parte viven en presupuestos/ventas; remapear, no borrar.
- Preservar denormalización (`articuloCodigo`/`descripcion`) en OCs/presupuestos históricos.
- `resumenStock`/CF ya suman `cantidad` bien; el fix de `resolveStock` ya está aplicado.
- Cada fase de runtime visible → `release:` cuando corresponda. Migración (Fase 4) sin release.

## Fuera de alcance
- Precios por presentación como catálogo (hoy el precio va en la línea de OC/presupuesto).
- Conversión física entre formas (Model 1 la elimina).
