# Plan: Esquema de facturación porcentual + anticipos en Presupuestos

**Fecha:** 2026-04-25
**Objetivo:** Permitir que un presupuesto se facture en N cuotas porcentuales con hitos disparadores configurables, incluyendo cuotas que se emiten **antes** de que exista una OT cerrada (anticipos / pre-embarque). Cada cuota dispara una `solicitudFacturacion` independiente vinculada al ppto.
**Fuera de alcance:**
- Cobranza efectiva (módulo `facturacion` separado).
- Integración fiscal/AFIP — la solicitud sigue siendo aviso interno al contable, no factura electrónica.
- Cuotas en contratos anuales (`tipo='contrato'`) — ya tienen su propio modelo `PresupuestoCuota` y flujo aparte; este plan **no lo toca**.

---

## Caso de referencia (cliente de ventas de equipos)

> "30% anticipado y 70% diferido contra entrega" o "70% antes de embarcar mercadería + 30% al cierre".
> En ambos, la primera (o única) cuota se factura **antes** de que exista una OT cerrada — el aviso sale desde el presupuesto, no desde la OT.

Implicancias:
- Una solicitud puede generarse cuando aún no hay nada en `otsListasParaFacturar`.
- Una OT (cuando la haya) se ejecuta **después** del pago de la(s) cuota(s) anticipada(s).
- El ppto no debería finalizar mientras quede una cuota pendiente, aún si todas las OTs cerraron y se facturó el 70% restante.

---

## Estado actual (Tier-1, verificado 2026-04-25)

### Implementado
- `PresupuestoFacturacionSection.tsx`: tabla de OTs en `otsListasParaFacturar` + monto único editable + observaciones.
- `presupuestosService.generarAvisoFacturacion(presId, otNumbers, { monto, observaciones })`: tx atómico — crea `solicitudFacturacion` + saca las OTs del array.
- Línea 1310-1312 del service **bloquea** la generación si las OTs no están en el array → flujo "adelantado a la OT" hoy es imposible vía UI.
- `trySyncFinalizacion`: ppto pasa a `finalizado` si todas las OTs work-unit están `FINALIZADO` Y todas las solicitudes están `facturada` Y `otsListasParaFacturar` está vacío.

### No implementado
- Definir un esquema porcentual al armar el ppto.
- Generar solicitud sin OTs cerradas (anticipo, pre-embarque).
- Validar que la suma de % cierre 100%.
- Trackear cuánto del ppto está "ya facturado" (% / monto pendiente).
- Hitos disparadores distintos a "OT cierre admin".
- Estado intermedio "pre-embarque" o equivalente.

---

## Decisiones de diseño (cerradas con Esteban — sesión 2026-04-25)

1. **"Adelantada" y "porcentual" son la misma feature.** No se modela `esAnticipo` separado; toda solicitud porcentual nace de una cuota del esquema. Anticipo = cuota con hito anterior a OT cerrada.
2. **El esquema vive en el presupuesto.** Se define al armarlo (estilo "condiciones de pago"), queda fijo al pasar a `aceptado`.
3. **Hitos posibles**: `ppto_aceptado`, `oc_recibida`, `pre_embarque` (manual), `todas_ots_cerradas`, `manual` (siempre).
4. **El hito no auto-genera** la solicitud. Sólo la "habilita" — el admin tiene que tocar el botón "Generar solicitud" en la cuota. Esto preserva control humano y el patrón Tier-1 actual.
5. **Cuota ↔ Solicitud es 1:1.** `SolicitudFacturacion.cuotaId` apunta a la cuota; cuota tiene `solicitudFacturacionId`.
6. **Modo legacy intocado.** Pptos sin esquema (`esquemaFacturacion = null` o `[]`) siguen el flujo Tier-1 actual (1 solicitud al final). No hay migración/backfill.
7. **Aplica a TODO presupuesto** (todos los `tipo`) menos `contrato`. Caso típico es `ventas`, pero `per_incident` y otros también pueden tener anticipos.
8. **MIXTA con % por moneda separado.** Cada cuota declara un % independiente por moneda (ARS, USD, EUR), permitiendo todas las combinaciones — ej: cuota 1 = 30% ARS, cuota 2 = 70% ARS + 50% USD, cuota 3 = 50% USD. Validación: por cada moneda activa, la suma de %s a lo largo de las cuotas debe dar 100. Para pptos mono-moneda (no MIXTA), la UI colapsa a un solo % (la moneda activa del ppto) y la lógica es la misma con un solo bucket.

---

## Modelo de datos

### Nuevo tipo `PresupuestoCuotaFacturacion` (en `packages/shared/src/types/index.ts`)

```typescript
export type CuotaFacturacionHito =
  | 'ppto_aceptado'          // ppto.estado === 'aceptado'
  | 'oc_recibida'            // ppto tiene al menos 1 OC cargada
  | 'pre_embarque'           // toggle manual del admin (Presupuesto.preEmbarque === true)
  | 'todas_ots_cerradas'     // todas las work-unit OTs en CIERRE_ADMINISTRATIVO o FINALIZADO
  | 'manual';                // sin precondición — el admin la dispara cuando quiera

export type CuotaFacturacionEstado =
  | 'pendiente'              // hito no cumplido aún
  | 'habilitada'             // hito cumplido pero sin solicitud generada
  | 'solicitada'             // solicitudFacturacion creada (estado pendiente/enviada)
  | 'facturada'              // solicitud en estado 'facturada' o posterior
  | 'cobrada';               // solicitud en estado 'cobrada'

// Moneda concreta — MIXTA NO se almacena por cuota; las cuotas siempre usan
// monedas individuales (ARS/USD/EUR), aún cuando ppto.moneda === 'MIXTA'.
export type MonedaCuota = 'ARS' | 'USD' | 'EUR';

export interface PresupuestoCuotaFacturacion {
  id: string;                              // uuid stable, asignado al crear
  numero: number;                          // 1, 2, 3... (orden display)
  // % por moneda — al menos una entrada con valor > 0. Las que no aparecen → 0% para esa moneda.
  // Para ppto mono-moneda, solo tendrá la moneda activa. Para MIXTA, puede tener 1 o más.
  porcentajePorMoneda: Partial<Record<MonedaCuota, number>>;
  // Ej mono-ARS:    { ARS: 30 }
  // Ej mono-USD:    { USD: 50 }
  // Ej MIXTA:       { ARS: 30, USD: 50 }   ← cubre 30% del total ARS y 50% del total USD
  // Ej MIXTA solo USD: { USD: 70 }         ← esta cuota no factura nada en ARS
  descripcion: string;                     // "Anticipo 30%", "Saldo contra entrega"
  hito: CuotaFacturacionHito;
  // Solo si hito === 'pre_embarque' — flag separado en el ppto (más abajo)
  // Solo si hito === 'manual' — siempre habilitada

  // Estado dinámico — sync con la solicitud al generarse
  estado: CuotaFacturacionEstado;
  solicitudFacturacionId?: string | null;  // back-ref a la solicitud creada
  // Monto real facturado por moneda (puede !== porcentaje*total si admin override).
  // Mono-moneda: { ARS: 1500 }. MIXTA: { ARS: 1500, USD: 200 }.
  montoFacturadoPorMoneda?: Partial<Record<MonedaCuota, number>> | null;
}
```

### Cambios en `Presupuesto`

```typescript
// Nuevo campo
esquemaFacturacion?: PresupuestoCuotaFacturacion[] | null;  // null/[] = modo legacy Tier-1
preEmbarque?: boolean;  // toggle manual; si esquema tiene cuota con hito='pre_embarque', habilita esa cuota
```

### Cambios en `SolicitudFacturacion`

```typescript
cuotaId?: string | null;          // null = solicitud libre (Tier-1 legacy o "saldo restante" sin cuota)
// Cobertura por moneda — mono-moneda tendrá una sola entrada, MIXTA puede tener varias.
// Calculado al crear como (montoSolicitud[moneda] / totalPpto[moneda]) * 100.
porcentajeCoberturaPorMoneda?: Partial<Record<'ARS' | 'USD' | 'EUR', number>> | null;
```

### Cambios en `cleanFirestoreData` / `deepCleanForFirestore`

Ya manejan nullables — el array `esquemaFacturacion` cuando vacío se persiste como `[]`. Lectura defensiva en service: `?? []`.

---

## UI

### Nuevo: `EsquemaFacturacionSection.tsx` (en editor del ppto)

- Visible si `tipo !== 'contrato'`.
- Posición: dentro de `EditPresupuestoModal`, en una sección plegable nueva entre "Items" y "Cuotas" (la sección Cuotas existente queda solo para `contrato`).
- Filas editables con: descripción, hito (dropdown), y **una columna `%` por moneda activa del ppto**.
  - Para ppto mono-moneda (ARS, USD o EUR): una sola columna `%`.
  - Para ppto MIXTA: dos (o tres) columnas, una por moneda. Cada celda admite 0 o vacío para "esta cuota no factura esta moneda".
- Botón "+ Agregar cuota". Borrar fila vía X.
- **Validación inline**: por cada moneda activa, muestra `Σ% (ARS): 100` con badge verde si === 100, rojo si !== 100. La validación es **independiente por moneda** — ARS puede sumar 100 con 2 cuotas y USD con otras 3 cuotas distintas, siempre que cada columna cierre.
- **Lock**: si `ppto.estado !== 'borrador'`, todos los inputs son read-only — solo se ven los estados.
- **Default**: ppto nuevo arranca con esquema vacío. UI tiene botones quick-templates (sensibles al `ppto.moneda`):
  - "100% al cierre" → 1 cuota con 100% en cada moneda activa, hito `todas_ots_cerradas`.
  - "30/70 anticipo+entrega" → 2 cuotas (30% `ppto_aceptado` + 70% `todas_ots_cerradas`) en cada moneda activa.
  - "70/30 pre-embarque" → 70% `pre_embarque` + 30% `todas_ots_cerradas` en cada moneda activa.
  - (Para MIXTA, los templates aplican el mismo % en ARS y USD por simplicidad. Para combinaciones asimétricas, edición manual.)

### Refactor: `PresupuestoFacturacionSection.tsx`

Reemplazar el componente actual. Dos sub-secciones:

**A. "Cuotas del esquema"** (visible si `esquemaFacturacion?.length > 0`)
- Card por cuota: `% — descripción — hito — estado — monto calculado` + botón contextual:
  - `pendiente` → badge "Esperando hito" + botón gris disabled.
  - `habilitada` → botón teal "Generar solicitud".
  - `solicitada` / `facturada` / `cobrada` → link a la solicitud + estado coloreado.
- Botón "Generar solicitud" abre un mini-modal:
  - Monto pre-cargado: `(porcentaje / 100) * total` (con redondeo y currency awareness).
  - Editable (override permitido — registra warning visual si no coincide con el %).
  - Observaciones libres.
  - Selector de OTs (opcional) — si hay OTs en `otsListasParaFacturar`, permitir incluirlas como referencia (muchos contables piden el N° de OT como concepto).
  - Confirmar → llama `generarAvisoFacturacion(presId, otNumbers, { monto, observaciones, cuotaId })`.

**B. "OTs sin asociar a cuota"** (visible si `otsListasParaFacturar.length > 0` y todas las cuotas ya facturadas, O si `esquemaFacturacion` es null/[])
- Tabla de OTs como hoy + monto + observaciones + botón "Generar aviso".
- Mismo flujo Tier-1 actual pero con `cuotaId: null`.

### Mini-modal "Generar solicitud para cuota X"

- Pre-cargado con N inputs de monto, **uno por cada moneda con porcentaje > 0** en la cuota:
  - Mono-moneda: 1 input. Default = `(porcentaje / 100) * total`.
  - MIXTA con 2 monedas: 2 inputs. Default = `(porcentajePorMoneda[m] / 100) * totalPpto[m]` por cada moneda.
- Cada input editable (override permitido — registra warning visual si no coincide con el % declarado).
- Observaciones libres.
- Selector opcional de OTs en `otsListasParaFacturar` para incluir como referencia.
- Confirmar → llama `generarAvisoFacturacion(presId, otNumbers, { montoPorMoneda, observaciones, cuotaId })`.

### Toggle "pre-embarque" en el ppto

- Nuevo checkbox en header del editor: "Mercadería en pre-embarque" (visible si esquema tiene cuota con hito `pre_embarque`).
- Al togglear → `ppto.preEmbarque = true`, recalcula estados de cuotas, la cuota correspondiente pasa a `habilitada`.
- Audit trace en `PostaPresupuesto`.

---

## Lógica de estados de cuota

Función pura `recomputeCuotaEstados(presupuesto, ots[], solicitudes[]): PresupuestoCuotaFacturacion[]`.
Llamar en:
- `presupuestosService.update()` post-write (auto-recompute).
- `presupuestosService.generarAvisoFacturacion()` post-tx.
- `otService.cerrarAdministrativamente()` post-tx (sync presupuestos vinculados).
- `facturacionService.marcarFacturada()` / `marcarCobrada()` post-write.

Reglas:

```
Para cada cuota:
  Si cuota.solicitudFacturacionId != null:
    Buscar solicitud asociada.
    Si solicitud.estado === 'cobrada' → cuota.estado = 'cobrada'
    Si solicitud.estado === 'facturada' → cuota.estado = 'facturada'
    Si solicitud.estado in ('pendiente','enviada') → cuota.estado = 'solicitada'
    Si solicitud.estado === 'anulada' → cuota.estado = 'habilitada' (limpiar id, dejar regenerar)
  Sino:
    Evaluar hito:
      'manual' → 'habilitada'
      'ppto_aceptado' → 'habilitada' si ppto.estado in ('aceptado','en_ejecucion'), si no 'pendiente'
      'oc_recibida' → 'habilitada' si ppto.ordenesCompraIds?.length > 0
      'pre_embarque' → 'habilitada' si ppto.preEmbarque === true
      'todas_ots_cerradas' → 'habilitada' si todas las work-unit OTs están en CIERRE_ADMIN o FINALIZADO
```

---

## Cambios en `trySyncFinalizacion`

Ppto pasa a `finalizado` solo si:
- (Modo legacy, sin esquema) Reglas actuales — ya cubierto.
- (Modo nuevo, con esquema) **Todas las cuotas en `cobrada`** + (todas las OTs FINALIZADO).
  - Si `cobrada` no se marca operativamente (algunos clientes saltean el step), permitir `facturada` como terminal vía un setting `presupuesto.finalizarConSoloFacturado: boolean` (default true).

---

## Validaciones

| Validación | Cuándo | Acción |
|---|---|---|
| Σ% === 100 por moneda | Al guardar ppto en estado borrador | Bloquea save con mensaje "Cuotas en ARS suman X%, deben sumar 100%" (se evalúa cada moneda activa por separado) |
| Esquema lockeado | Al pasar a `aceptado` | Inputs read-only en la UI |
| No editar cuota facturada | Al borrar cuota con `estado in ('solicitada','facturada','cobrada')` | Bloquea con mensaje |
| No solicitar cuota deshabilitada | Al hacer click en "Generar solicitud" si `estado !== 'habilitada'` | Botón disabled (ya en UI) + check server-side en `generarAvisoFacturacion` |
| Monto override coherente | Al generar solicitud con monto !== %*total | Warning amarillo, no bloquea (admin a veces ajusta por redondeo o IVA) |

---

## Fases de implementación

### Fase 1 — Tipos y modelo (1-2 hs)
- Tipos en `packages/shared/src/types/index.ts`.
- Helper `recomputeCuotaEstados(...)` en utility nuevo `apps/sistema-modular/src/utils/cuotasFacturacion.ts`.
- Tests unitarios del helper (casos: vacío, 1 cuota 100%, 2 cuotas con distintos hitos, anulada, override de monto).
- **No toca UI.**
- Criterio: `pnpm type-check` clean. Tests pasan.

### Fase 2 — UI: definir esquema en el ppto (3-4 hs)
- `EsquemaFacturacionSection.tsx` (≤250 líneas — split si crece).
- Wire en `EditPresupuestoModal`.
- Botones de quick-templates (100, 30/70, 70/30).
- Validación inline Σ%.
- Toggle `preEmbarque` en header.
- Persistencia vía `presupuestosService.update`.
- **No toca el flujo de generar solicitud todavía.**
- Criterio: armar ppto borrador con 30/70, guardar, reload, ver esquema persistido.

### Fase 3 — Refactor `PresupuestoFacturacionSection` (3-4 hs)
- Dos sub-secciones (cuotas / OTs sueltas) con la lógica nueva.
- Mini-modal "Generar solicitud para cuota".
- `generarAvisoFacturacion` extendido: nuevo parámetro `cuotaId?: string`. Si presente, validar que la cuota esté `habilitada` y persistir back-ref en solicitud + actualizar cuota en el ppto en la misma tx.
- Modo legacy preservado: si `cuotaId` no se pasa y el ppto no tiene esquema → comportamiento Tier-1 actual.
- Criterio: con un ppto 30/70 aceptado, generar la cuota 1 (anticipo) sin tener OTs cerradas; verificar que la solicitud se crea con `cuotaId` correcto y la cuota pasa a `solicitada`.

### Fase 4 — Hitos automáticos y sync (2-3 hs)
- Wire `recomputeCuotaEstados` en los 4 puntos de sync (update ppto, generarAviso, otService.cerrarAdministrativamente, facturacionService.marcarFacturada).
- Update de `trySyncFinalizacion` para considerar el esquema.
- Cuando `ppto.estado === 'aceptado'` o `oc_recibida` o `preEmbarque=true` → cuotas correspondientes pasan automáticamente a `habilitada`.
- Criterio: pasar ppto a aceptado → la UI refleja que la cuota anticipo quedó habilitada sin reload manual.

### Fase 5 — Cierre del flujo end-to-end (2 hs)
- E2E manual del caso 30/70:
  1. Armar ppto con esquema 30/70.
  2. Aceptar → cuota 1 habilitada.
  3. Generar solicitud cuota 1 → marcar facturada → cuota 1 = facturada.
  4. Crear OT, ejecutar, cierre admin.
  5. Verificar que cuota 2 pasó a habilitada (`todas_ots_cerradas`).
  6. Generar solicitud cuota 2 → facturar → cobrar.
  7. `trySyncFinalizacion` debe pasar el ppto a `finalizado`.
- E2E del caso 70/30 pre-embarque: similar, con toggle preEmbarque entre paso 2 y 3.
- Criterio: ambos flujos pasan sin warnings en consola, sin huérfanos en `solicitudesFacturacion`, ppto finaliza correctamente.

### Fase 6 — Tests Playwright (2-3 hs)
- Extender `e2e/circuits/11-full-business-cycle.spec.ts` con dos sub-suites:
  - `11.51 — Esquema 30/70 (anticipo + cierre)`
  - `11.52 — Esquema 70/30 (pre-embarque + cierre)`
- Reusar helpers existentes (`getSolicitudesFacturacion`, etc.) + agregar `getPresupuestoEsquema` en `helpers/firestore-assert.ts`.
- Criterio: `pnpm e2e` corre los nuevos tests en verde headless.

### Fase 7 — UX polish (1-2 hs, opcional)
- Badge "Facturado X% / Pendiente Y%" en la lista de presupuestos.
- Filtro nuevo en `PresupuestosList`: "con cuotas pendientes".
- Sección en `ClienteDetail`: deuda total estimada por ppto pendiente.

---

## Orden de ejecución sugerido

1. Fase 1 — tipos
2. Fase 2 — UI esquema
3. Fase 3 — refactor sección facturación
4. Fase 4 — hitos
5. Fase 5 — verificación E2E manual
6. Fase 6 — tests automatizados
7. Fase 7 — polish (opcional, diferible)

Total estimado: **13-18 hs** + 1-2 hs polish.

---

## Riesgos identificados

- **Override de monto vs % declarado**: si admin pone monto distinto al %*total, el reporte de "% facturado" diverge. Mitigación: usar `montoFacturado` real para sumas, `porcentaje` solo para display.
- **Cuota anulada y regeneración**: si una solicitud se anula, la cuota debería volver a `habilitada` para regenerar. Implementado en `recomputeCuotaEstados` pero requiere test específico.
- **Race condition en hitos automáticos**: dos cambios simultáneos (ppto.estado + ppto.preEmbarque) podrían generar inconsistencia si no se serializan. Mitigación: `recomputeCuotaEstados` siempre dentro del mismo `update` del ppto, no en triggers separados.
- **Esquema vacío post-aceptación**: si admin acepta un ppto sin esquema definido, queda Tier-1 legacy. Mitigación: gate al aceptar — si tipo === 'ventas', forzar definir esquema (al menos 100% al cierre). Otros tipos: opcional.
- **Override de monto por moneda en MIXTA**: con `porcentajePorMoneda` y `montoFacturadoPorMoneda` per-moneda, hay 2× la superficie para errores de redondeo o override divergente. Mitigación: tests específicos en Fase 1 con `recomputeCuotaEstados` para combinaciones MIXTA típicas (cuota solo-USD, cuota mixta, cuota anulada).

---

## Preguntas abiertas (resolver al llegar a cada fase)

- ~~**F1**: ¿el esquema aplica también a `tipo='per_incident'`?~~ ✅ Resuelto 2026-04-25: aplica a **todo** ppto excepto `contrato`.
- ~~**F1**: MIXTA — ¿% por moneda o global?~~ ✅ Resuelto 2026-04-25: % **por moneda separado** (`porcentajePorMoneda`), validación independiente por moneda.
- ~~**F2**: gate al aceptar ppto sin esquema?~~ ✅ Resuelto 2026-04-25: **sin gate** — pptos sin esquema caen al modo Tier-1 legacy (1 solicitud al final con total).
- **F3**: ¿el override de monto debe quedar trazable como `montoOverridePorPorcentaje` para auditoría? → Probable yes, agregar campo opcional en Solicitud.
- **F7**: filtros y dashboards — ¿cuál es el reporte que más le interesa al admin contable? → Priorizar después de Fase 5.

---

## Decisiones tomadas (sesión 2026-04-25)

- Adelantada y porcentual son **una sola feature**; "adelantada" = cuota con hito anterior a OT cerrada.
- Esquema se define en el ppto; lockea al aceptar.
- Hitos disparan habilitación; el admin sigue siendo quien tira el botón "Generar".
- 1:1 entre cuota y solicitud (cuotaId back-ref).
- No se rompe el modo Tier-1 legacy (esquema null/[] mantiene el flujo actual).
- `tipo='contrato'` sigue su propio flujo de cuotas mensuales/trimestrales — fuera de alcance.
- Hito `todas_ots_cerradas` reemplaza al "OT cierre admin" individual del Tier-1 (porque el ppto puede tener N OTs, y la solicitud debe esperar a que cierren todas).
- El esquema aplica a **todo** ppto excepto `contrato` (no se restringe a `ventas`).
- En MIXTA, el % es **separado por moneda**: cada cuota declara `{ ARS: x, USD: y }` (puede tener una sola moneda o ambas). Validación por moneda independiente.
- **Sin gate** al aceptar: pptos sin esquema definido caen al modo Tier-1 legacy. Esquema es opcional.
