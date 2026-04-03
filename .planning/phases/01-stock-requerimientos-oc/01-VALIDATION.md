---
phase: 1
slug: stock-requerimientos-oc
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-03
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no test framework in apps/sistema-modular |
| **Config file** | None |
| **Quick run command** | `pnpm dev` (manual verification at localhost:3001) |
| **Full suite command** | Manual smoke test of all 8 behaviors |
| **Estimated runtime** | ~10 min full manual sweep |

---

## Sampling Rate

- **After every task commit:** Run `pnpm dev` and manually verify the specific feature touched
- **After every plan wave:** Full smoke test of all 8 behaviors below
- **Before `/gsd:verify-work`:** All 8 manual checks must be green

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| RES-01 | Presupuesto aceptado → requerimientos auto-generados para items sin stock suficiente | manual-only | Cambiar estado de presupuesto a aceptado, verificar RequerimientosList | N/A | ⬜ pending |
| RES-02 | Botón manual "Reservar stock" en detalle del presupuesto | manual-only | Click botón, verificar que unidad se mueve a posición Reservas | N/A | ⬜ pending |
| RES-03 | UnidadesList muestra columnas Disponible / Reservado / Total | manual-only | Verificar columnas en `/stock/unidades` | N/A | ⬜ pending |
| RES-04 | RequerimientosList con edición inline proveedor + urgencia + cantidad | manual-only | Editar celda, verificar actualización en Firestore | N/A | ⬜ pending |
| RES-05 | "Generar OC" crea una OC por proveedor con reqs seleccionados | manual-only | Seleccionar 2 reqs del mismo proveedor → 1 OC creada | N/A | ⬜ pending |
| RES-06 | Requerimiento pasa a estado `en_compra` al generar OC, con link | manual-only | Verificar estado y link en RequerimientosList post-OC | N/A | ⬜ pending |
| RES-07 | Reposición de minikit desde InventarioIngenieroPage (cantidad editable) | manual-only | Click "Reponer", cantidad editable, verificar MovimientoStock creado | N/A | ⬜ pending |
| RES-08 | Ajuste de stock con justificación obligatoria | manual-only | Intentar ajuste sin motivo → debe bloquear | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Agregar campos de reserva a `UnidadStock` en `packages/shared/src/types/index.ts`: `reservadoParaPresupuestoId`, `reservadoParaClienteId`, `reservadoParaPresupuestoNumero`, `reservadoParaClienteNombre`
- [ ] Verificar que `requerimientosService` está re-exportado desde `apps/sistema-modular/src/services/firebaseService.ts`
- [ ] Confirmar que existe (o crear) el documento `PosicionStock` con tipo "reserva" en Firestore (seed data)

*(No automated test files needed — no test framework configured in apps/sistema-modular)*

---

## Manual-Only Verifications

| Behavior | Why Manual | Test Instructions |
|----------|------------|-------------------|
| Auto-generación de reqs desde presupuesto | No test framework | Abrir presupuesto con item con stockArticuloId → cambiar estado a aceptado → verificar en /stock/requerimientos |
| Reserva física de unidad | No test framework | Botón "Reservar" en PresupuestoDetail → verificar posición de la unidad en /stock/unidades |
| Generar OC multi-proveedor | No test framework | Seleccionar reqs de 2 proveedores → verificar que se crean 2 OC separadas |

---

## Validation Sign-Off

- [ ] Todos los comportamientos tienen instrucciones de verificación manual
- [ ] Wave 0 cubre los 3 gaps de tipo/datos
- [ ] `nyquist_compliant: true` set en frontmatter cuando todos los checks estén verdes

**Approval:** pending
