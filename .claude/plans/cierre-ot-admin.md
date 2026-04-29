# Plan: Cierre del cierre administrativo de OT

**Fecha:** 2026-04-28
**Objetivo:** Dejar el lifecycle de OT cerrado end-to-end (CREADA → … → FINALIZADO). Implementar la transición terminal `CIERRE_ADMINISTRATIVO → FINALIZADO` con el modelo híbrido (auto cuando facturada, manual cuando no aplica facturación).
**Fuera de alcance:** Deducción real de stock al cerrar (→ milestone Stock Evolution). Cierre forzado sin reporte técnico (descartado por decisión del usuario). Cambios en `apps/reportes-ot/` (frozen surface).

---

## Estado actual (verificado 2026-04-28)

La memoria [project_ot_lifecycle.md](memory/project_ot_lifecycle.md) está 44 días desactualizada. Estado real verificado contra código:

### Ya construido
- Modal de cierre admin con confirmación de horas, partes, notas, stock origin selector, preview PDF, wizard de facturación: [OTCierreAdminSection.tsx](apps/sistema-modular/src/components/ordenes-trabajo/OTCierreAdminSection.tsx)
- `otService.cerrarAdministrativamente()` con tx atómica (registra en `presupuesto.otsListasParaFacturar[]`, crea ticket admin + mailQueue): [otService.ts:607-787](apps/sistema-modular/src/services/otService.ts)
- Estados unificados (`status` técnico vs. `estadoAdmin` administrativo, sin colisión) + matriz `OT_TRANSICIONES_VALIDAS` en `packages/shared/src/types/index.ts`
- Persistencia de `horasTrabajadas` + `tiempoViaje` desde reportes-ot (la memoria decía que faltaba — DRIFT)
- Linkeo Tier-1 presupuesto-céntrico con Facturación vía [CierreFacturacionWizard.tsx](apps/sistema-modular/src/components/ordenes-trabajo/CierreFacturacionWizard.tsx)
- `delete()` ya bloquea OTs en `CIERRE_ADMINISTRATIVO` y `FINALIZADO`

### Faltante
- Transición terminal `CIERRE_ADMINISTRATIVO → FINALIZADO` (existe en matriz, no en UI ni service)
- Auto-cierre cuando se cobra última factura vinculada
- Vista read-only completa para estado `FINALIZADO`
- Tests E2E del lifecycle
- Memoria desactualizada

---

## Decisiones tomadas (2026-04-28)

- **P1 — Modelo de cierre**: híbrido. Manual desde UI cuando no aplica facturación; automático cuando todas las solicitudes de facturación vinculadas pasan a estado terminal.
- **P2 — Deducción de stock**: separada. Sigue como flag manual (`stockDeducido: boolean`) en este plan; la lógica real va al milestone Stock Evolution (`memory/project_stock_evolution.md`, Fase 4 engineer inventory).
- **P3 — OTs sin reporte técnico**: no permitidas. Toda OT debe pasar por `CIERRE_TECNICO` antes de `CIERRE_ADMINISTRATIVO`. Si no tiene reporte, se crea uno (no hay flag de cierre forzado).

---

## Tasks

### T1 — Transición manual `CIERRE_ADMINISTRATIVO → FINALIZADO`

**Service** ([otService.ts](apps/sistema-modular/src/services/otService.ts)):
- Nuevo método `finalizar(otNumber: string, actor: { uid: string; nombre: string }): Promise<void>`.
- Dentro de `runTransaction`:
  - Read OT, valida `estadoAdmin === 'CIERRE_ADMINISTRATIVO'` (idempotente: si ya `FINALIZADO`, no-op silencioso).
  - Valida transición con `isOTTransicionValida()`.
  - Verifica condición de habilitación (ver UI abajo) — si no se cumple, throw error semántico.
  - Write: `estadoAdmin='FINALIZADO'`, `estadoAdminFecha=Timestamp.now()`, append a `estadoHistorial[]` con `{ from: 'CIERRE_ADMINISTRATIVO', to: 'FINALIZADO', at, actor }`.
- Post-commit best-effort: `leadsService.syncFromOT()` y `presupuestosService.trySyncFinalizacion()`.

**UI** ([OTCierreAdminSection.tsx](apps/sistema-modular/src/components/ordenes-trabajo/OTCierreAdminSection.tsx)):
- Botón "Finalizar OT" visible solo cuando `estadoAdmin === 'CIERRE_ADMINISTRATIVO'`.
- **Habilitado** cuando se cumple alguna de:
  - `budgets.length === 0` (OT sin presupuestos vinculados — garantía / cortesía / sin cargo).
  - Todas las `SolicitudFacturacion` vinculadas (vía `presupuesto.otsListasParaFacturar` / `solicitudesFacturacion.otNumbers`) están en estado terminal: `enviada` | `facturada` | `cobrada` | `anulada`.
- **Deshabilitado con tooltip** si hay solicitudes en `pendiente` u OT sin solicitud creada cuando había budgets: tooltip "Hay facturación pendiente — generá y enviá las solicitudes antes de finalizar."
- ConfirmDialog antes de ejecutar: "Esta acción es terminal. La OT no podrá editarse después de finalizar."

**Esfuerzo**: 1-1.5 días.

### T2 — Auto-cierre cuando se cobra última factura

**Service** ([facturacionService.ts](apps/sistema-modular/src/services/facturacionService.ts)):
- En el método que actualiza el estado de `SolicitudFacturacion` (probablemente `updateEstado` o equivalente — verificar nombre exacto al implementar), después del write exitoso:
  - Para cada `otNumber` en `solicitud.otNumbers ?? []`:
    - Leer la OT.
    - Si `estadoAdmin !== 'CIERRE_ADMINISTRATIVO'`, skip (la OT aún no llegó a esa fase).
    - Buscar todas las solicitudes de facturación que referencien esa OT (vía `presupuestos vinculados → solicitudes`).
    - Si todas están en estado terminal → `await otService.finalizar(otNumber, { uid: 'system', nombre: 'Auto-cierre por facturación' })`.
- **Idempotencia**: `finalizar()` es no-op si ya está `FINALIZADO`, así que dos triggers concurrentes son seguros.
- **Logueo**: console-log al disparar auto-cierre con el `otNumber` y la `solicitudId` que lo gatilló.

**Esfuerzo**: 0.5-1 día.

### T3 — UI estado FINALIZADO read-only

- **Badge terminal** en [OTStatusBadge.tsx](apps/sistema-modular/src/components/ordenes-trabajo/OTStatusBadge.tsx): `bg-teal-700 text-white`, label "Finalizado".
- **EditOTModal** ([EditOTModal.tsx](apps/sistema-modular/src/components/ordenes-trabajo/EditOTModal.tsx)): cuando `estadoAdmin === 'FINALIZADO'`, mostrar banner sticky en top "Esta OT está finalizada. Para modificar, contactá al admin." y deshabilitar todos los inputs + ocultar botón Guardar.
- **OTCierreAdminSection**: ya tiene `disabled` cuando `FINALIZADO`. Auditar que cubra todas las inputs (incluido `CierreStockSelector`, notas, checkboxes).
- **EditOTEstadoBar** ([EditOTEstadoBar.tsx](apps/sistema-modular/src/components/ordenes-trabajo/EditOTEstadoBar.tsx)): no permitir cambio de estado desde `FINALIZADO` (es terminal). Si la matriz ya lo bloquea, validar que el dropdown lo refleje visualmente.

**Esfuerzo**: 0.5 día.

### T4 — Tests E2E del lifecycle

**Path A — Con facturación (auto-cierre)**:
1. Crear OT (CREADA).
2. Asignar (ASIGNADA → COORDINADA).
3. Iniciar (EN_CURSO).
4. Cerrar técnicamente desde reportes-ot (CIERRE_TECNICO).
5. Cierre admin desde sistema-modular (CIERRE_ADMINISTRATIVO).
6. Crear `SolicitudFacturacion` desde wizard.
7. Marcar solicitud como `cobrada` → la OT debe pasar a `FINALIZADO` automáticamente.

**Path B — Sin facturación (manual)**:
1-5. Idem hasta `CIERRE_ADMINISTRATIVO`.
6. OT sin budgets vinculados (garantía).
7. Click "Finalizar OT" → OT pasa a `FINALIZADO` manualmente.

**Path C — Múltiples solicitudes**: OT vinculada a 2 presupuestos con 2 solicitudes; auto-cierre solo dispara cuando ambas están en estado terminal.

Tests pueden vivir en `apps/sistema-modular/src/services/__tests__/otService.lifecycle.test.ts` (unit) + un E2E manual documentado para validación con datos reales.

**Esfuerzo**: 0.5-1 día.

### T5 — Actualizar memoria

- Reescribir [project_ot_lifecycle.md](memory/project_ot_lifecycle.md) con el estado real verificado:
  - Quitar referencias a Bejerman.
  - Quitar "dual status" (no aplica).
  - Marcar persistencia de horas como hecho.
  - Reflejar el nuevo modelo híbrido de cierre terminal.
  - Marcar deducción de stock como diferida (link a milestone Stock).
- Bumpear "Last verified" del bloque OT en [.claude/skills/ags-system-guide/SKILL.md](.claude/skills/ags-system-guide/SKILL.md) (o donde corresponda en la skill).

**Esfuerzo**: 0.25 día.

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| **Idempotencia T2** — dos solicitudes pasando a `cobrada` casi simultáneo disparan dos `finalizar()` | `finalizar()` lee dentro de tx y no-op si ya `FINALIZADO`. Test concurrente en T4. |
| **Cascada T2** — costo de leer N solicitudes de M presupuestos por cada update | Aceptable porque ocurre una vez por OT al cobrar la última. Si crece, mover a CF batch posterior. |
| **OTs huérfanas** — OT en `CIERRE_ADMINISTRATIVO` sin solicitudes nunca finaliza si nunca se vincula a budget | Habilitación manual cubre el caso (botón visible cuando `budgets.length === 0`). |
| **Drift entre matriz y UI** — la matriz permite la transición pero la UI podría ofrecer `FINALIZADO` desde otros estados por error | Validación dura en `finalizar()` con throw. Test en T4. |

---

## No-goals explícitos

- **Sin deducción real de stock** — el flag `stockDeducido` sigue manual. La lógica real va al milestone Stock Evolution.
- **Sin cambios en `reportes-ot`** — frozen surface; la persistencia de horas ya estaba hecha.
- **Sin "cierre forzado"** — toda OT requiere reporte técnico previo (P3).
- **Sin emisión a `lifecycleEvents`** — el sistema de audit log diseñado en [ot-lifecycle-events.md](.claude/plans/ot-lifecycle-events.md) aún no existe. Cuando se implemente, se le suma a `finalizar()` la emisión de un `closed` event en una phase posterior. Este plan no espera por eso.
- **Sin migración de OTs históricas** — OTs hoy en `CIERRE_ADMINISTRATIVO` siguen donde están; admin puede llevarlas a `FINALIZADO` con el nuevo botón si corresponde.

---

## Cross-references

- Audit log durable: [ot-lifecycle-events.md](.claude/plans/ot-lifecycle-events.md) — complementario, no bloqueante.
- Cosecha Item→OT (Fase 6 presupuestos): [presupuestos-item-a-ot-design.md](.claude/plans/presupuestos-item-a-ot-design.md) — diferida.
- Stock Evolution Plan: `memory/project_stock_evolution.md` — donde vive la deducción real al cerrar.

---

## Orden de ejecución

1. T1 (manual + service) — base.
2. T3 (UI read-only) — en paralelo con T1.
3. T2 (auto-cierre) — depende de T1 (`finalizar()` debe existir).
4. T4 (tests) — al final, valida los 3 paths.
5. T5 (memoria) — cierre del plan.

**Esfuerzo total estimado**: 3-4 días.

---

## Próximo paso

Ejecutar T1 cuando se levante el plan. Si querés flujo GSD formal, este plan se puede cargar en `/gsd:plan-phase` como input ya estructurado.
