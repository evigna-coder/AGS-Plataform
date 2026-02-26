# Migración: CUIT como ID de Cliente + Establecimientos

## Resumen del cambio de modelo

1. **Clientes**: El documento en `clientes` pasa a tener como **id** el CUIT normalizado (solo dígitos) o `LEGACY-{uuid}` si no tiene CUIT. El campo `cuit` puede ser `null` para clientes legacy.
2. **Establecimientos**: Nueva colección `establecimientos` con `clienteCuit` (FK al id del cliente). Cada cliente puede tener varias sedes/plantas.
3. **Sistemas**: Pasan a depender de **establecimiento** (`establecimientoId`). Se mantiene `clienteId` opcional durante la migración.
4. **Contactos**: Pasan de `clientes/{id}/contactos` a `establecimientos/{establecimientoId}/contactos`. Se migran al establecimiento "Principal" de cada cliente.

## Fases de despliegue

- **Fase 0**: Cambios en tipos, servicios y UI (establecimientoId en sistemas, sin eliminar clienteId).
- **Fase 1**: Ejecutar script de migración (dry-run y luego run). Revisar `mapping.json` y `errors.csv`.
- **Fase 2**: UI ya exige selección de establecimiento al crear sistemas/OT.
- **Fase 3**: Eliminar `clienteId` de sistemas cuando todo esté validado.

## Script de migración

El script `scripts/migrate-establecimientos.js` (Node + Firebase Admin SDK) hace:

1. Cargar todos los clientes actuales.
2. Para cada cliente: calcular `newId = normalizeCuit(cuit) || 'LEGACY-' + uuid`. Si el doc actual ya tiene id = newId, no hace nada.
3. Si el id actual ≠ newId: crear documento en `clientes/{newId}` con los mismos datos (y `cuit` normalizado o null). **No** se copian contactos al nuevo cliente (se migran al establecimiento).
4. Por cada cliente (nuevo id): si no existe, crear un establecimiento "Principal" con dirección del cliente; si ya existe uno para ese cliente, reutilizarlo. Guardar en mapping.
5. **Migrar contactos**: de `clientes/{id}/contactos` a `establecimientos/{establecimientoPrincipalId}/contactos` (campo `establecimientoId` en cada contacto).
6. Por cada sistema: asignar `establecimientoId` al establecimiento Principal del cliente y actualizar `clienteId` al nuevo id.
7. Escribir `mapping.json` (clientes: oldId→newId; establecimientos: clienteCuit→estId; sistemas: sistemaId→establecimientoId; contactosMigrados: estId→cantidad) y `errors.csv`.

### Uso del script

```bash
cd apps/sistema-modular
# Instalar Firebase Admin (si no está): npm install firebase-admin
# Crear service-account.json en la raíz del repo o en apps/sistema-modular

# Dry-run (solo logs, no escribe en Firestore)
node scripts/migrate-establecimientos.js --dry-run

# Ejecución real
node scripts/migrate-establecimientos.js --run
```

Variables de entorno o argumentos: path a `service-account.json` y opcionalmente proyecto Firebase.

## Validaciones post-migración

- Todos los documentos en `clientes` tienen id = CUIT normalizado o `LEGACY-*`.
- Existe al menos un documento en `establecimientos` por cada cliente con sistemas.
- Cada documento en `sistemas` tiene `establecimientoId` válido.
- `mapping.json` completo y `errors.csv` vacío o con filas justificadas para revisión manual.

## Compatibilidad hacia atrás

- Durante la migración, los sistemas pueden seguir teniendo `clienteId` (opcional). Los servicios aceptan filtros por `clienteId` o `clienteCuit`.
- Las rutas de cliente siguen siendo `/clientes/:id` donde `id` es CUIT o LEGACY-xxx.
