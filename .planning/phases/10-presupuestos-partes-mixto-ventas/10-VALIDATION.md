---
phase: 10
slug: presupuestos-partes-mixto-ventas
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
---

# Phase 10 — Validation Strategy

> Per-phase validation contract derived from `10-RESEARCH.md §Validation Architecture`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.59.1 (E2E) + `tsx` para unit tests ad-hoc (usado en Phase 9-01) |
| **Config file** | `apps/sistema-modular/playwright.config.ts` |
| **Quick run command** | `pnpm --filter @ags/sistema-modular type-check` (or temp `tsc --noEmit`) |
| **Full suite command** | `pnpm --filter @ags/sistema-modular e2e` |
| **Runtime** | type-check ~10s; spec individual ~30-90s; full suite ~15-25min |

---

## Sampling Rate

- **After every task commit:** `type-check` (<10s)
- **After every plan wave:** smoke de spec afectado (30-90s)
- **Phase gate:** full `pnpm e2e` antes de `/gsd:verify-work`

---

## Per-Requirement Verification Map

| Req | Behavior | Test Type | Command | File |
|-----|----------|-----------|---------|------|
| PTYP-02 | Presupuesto partes con items stock-linked + ATP inline + requerimiento condicional al aceptar | E2E | Extender `03-presupuestos.spec.ts` (test `partes-flow`) | ⚠️ Wave 0 extension |
| PTYP-03 | Presupuesto mixto con 2 secciones en PDF + editor soporta servicio+artículo intercambiables | E2E + visual | Extender `03-presupuestos` + visual PDF diff manual | ⚠️ Wave 0 extension + Manual |
| PTYP-04 | Presupuesto ventas crea 1 OT genérica al aceptar + ventasMetadata persistida + PDF incluye datos instalación | E2E | Nuevo test en `03-presupuestos` + assert via `firestore-assert.ts` | ⚠️ Wave 0 extension |
| FMT-03 | Cierre admin persiste `solicitudesFacturacion` en tx + mailQueue enqueue + dashboard muestra doc con estado `pendiente` | E2E | Extender `11-full-business-cycle.spec.ts` step 14 (desfixme + assertion nueva) | ⚠️ Extension |
| FMT-04 | Exportar presupuestos filtrados a Excel + PDF | E2E | Nuevo spec `14-exports.spec.ts` (happy path) | ❌ Wave 0 new |
| FMT-05 | Exportar OCs pendientes a Excel + PDF | E2E | `14-exports.spec.ts` escenario 2 | ❌ Wave 0 new |
| FMT-06 | Exportar solicitudes facturación a Excel + PDF | E2E | `14-exports.spec.ts` escenario 3 | ❌ Wave 0 new |

---

## Wave 0 Requirements

- [ ] NEW: `apps/sistema-modular/e2e/circuits/14-exports.spec.ts` — cubre FMT-04/05/06 con download assertions
- [ ] EXTEND: `apps/sistema-modular/e2e/circuits/03-presupuestos.spec.ts` — agregar scenarios para `partes`, `mixto`, `ventas` (incluido assert sobre ATP visible + `ventasMetadata` persistida + 1 OT creada post-aceptar)
- [ ] EXTEND: `apps/sistema-modular/e2e/circuits/11-full-business-cycle.spec.ts` step 14 — desfixme mailQueue assertion ya extendida en Phase 9, agregar nueva assertion sobre `solicitudesFacturacion/{id}` creado + estado `pendiente`
- [ ] EXTEND: `apps/sistema-modular/e2e/helpers/firestore-assert.ts` — agregar `getSolicitudFacturacion(id)` + `getOTsByPresupuesto(presupuestoId)` + `getPresupuesto(id)` helpers

**Scope out de Wave 0:** nuevo unit test runner formal (queda para Phase 11 TEST-01).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Instructions |
|----------|-------------|------------|--------------|
| PDF visual Editorial Teal con branch por tipo | PTYP-02/03/04 | Visual inspection; pixel diff no automatizable sin tooling extra | Generar PDF de ppto mixto (2 items servicio + 2 items artículo) → verificar 2 secciones con subtotales. Generar PDF ventas → verificar bloque "Datos de entrega e instalación" visible con los 3 campos. |
| PDF de exports visualmente aceptable | FMT-04/05/06 | Idem | Descargar export PDF de presupuestos → validar tabla legible con branding mínimo. |
| Mail recibido en inbox del contable | FMT-03 | Requiere inbox real (mailQueue consumer diferido; retry manual desde dashboard) | Disparar cierre admin → retry manual desde `/admin/acciones-pendientes` → confirmar recepción con link al dashboard. |
| StockAmplioIndicator renderiza al agregar artículo | PTYP-02 | Requiere data real de stock + interacción | Abrir AddItemModal en ppto partes → seleccionar artículo → verificar 4-bucket display inline. |
| Filter-aware exports | FMT-04/05/06 | Requiere flujo de filtrar + descargar + abrir xlsx/PDF | Aplicar filtro por cliente → "Exportar Excel" → abrir archivo → verificar subset correcto. |

---

## Risk Acknowledgements (from RESEARCH §Risk surface)

- Auto-OT ventas post-commit best-effort: si falla → `_appendPendingAction('crear_ot_ventas')`; aparece en dashboard; retry manual
- `cerrarAdministrativamente` tx integration safe (< 500-op limit)
- Idempotency de solicitudFacturacion via deterministic ID `${otNumber}_${presupuestoId}`
- Circular deps entre `presupuestosService` ↔ `otService` — resolver vía lazy import (precedent Phase 8-03)

---

## Validation Sign-Off

- [x] All phase requirements mapped to automated or manual verify
- [x] Sampling continuity: type-check per commit + smoke per task
- [ ] Wave 0 specs created (14-exports + extensions a 03/11) — blocks Wave 1
- [x] No watch-mode flags
- [x] Feedback latency documented (<10s type-check, <90s spec)
- [ ] `nyquist_compliant: true` — pending Wave 0 completion

**Approval:** pending — blocks on Wave 0 spec creation.
