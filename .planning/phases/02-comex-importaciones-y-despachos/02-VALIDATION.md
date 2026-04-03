---
phase: 2
slug: comex-importaciones-y-despachos
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-03
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no test framework in apps/sistema-modular (vitest optional Wave 0) |
| **Config file** | None — `apps/sistema-modular/vitest.config.ts` si se instala en Wave 0 |
| **Quick run command** | `pnpm tsc --noEmit` (TypeScript build check per task) |
| **Full suite command** | Manual smoke test en dev server |
| **Estimated runtime** | ~15 min full manual sweep |

---

## Sampling Rate

- **After every task commit:** `pnpm tsc --noEmit` — build limpio obligatorio
- **After every plan wave:** Manual smoke test de los comportamientos del wave
- **Before `/gsd:verify-work`:** Todos los 8 checks manuales verdes

---

## Per-Task Verification Map

| Req ID | Comportamiento | Tipo | Comando | Archivo | Status |
|--------|---------------|------|---------|---------|--------|
| COMEX-01 | OC tipo `importacion` muestra botón "Crear Importación" | manual | Dev server `/stock/ordenes-compra/:id` | N/A | ⬜ pending |
| COMEX-02 | ImportacionEditor precompleta desde `location.state.fromOC` | manual | Navegar desde OCDetail → Editor | N/A | ⬜ pending |
| COMEX-03 | Transición a `embarcado` bloquea sin `fechaEmbarque` + `booking` | manual | Intentar cambiar estado sin campos | N/A | ⬜ pending |
| COMEX-04 | Badge ETA vencida en ImportacionesList | manual | Importación con ETA pasada y no recibida | N/A | ⬜ pending |
| COMEX-05 | Prorrateo distribuye gastos proporcional al valor | unit puro | `calcularProrrateo.test.ts` si se instala vitest | ❌ Wave 0 | ⬜ pending |
| COMEX-06 | Ingresar stock crea UnidadStock + MovimientoStock por unidad | manual | Botón "Ingresar al stock" en ImportacionDetail | N/A | ⬜ pending |
| COMEX-07 | Requerimiento `en_compra` → `completado` al recibir cantidad suficiente | manual | Verificar RequerimientosList post-recepción | N/A | ⬜ pending |
| COMEX-08 | Filtros de ImportacionesList persisten en URL | manual | Cambiar filtro, recargar página, verificar filtro activo | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Agregar `numeroGuia?: string | null`, `items?: ItemImportacion[] | null`, `fechaRecepcion?: string | null`, `stockIngresado?: boolean | null` al tipo `Importacion` en `packages/shared/src/types/index.ts`
- [ ] Crear tipo `ItemImportacion` en shared (articuloId, descripcion, cantidad, precioUnitario, etc.)
- [ ] Agregar `fechaRecepcion` al array `dateFields` en `importacionesService.update()`
- [ ] (Opcional) `apps/sistema-modular/src/utils/calcularProrrateo.ts` — función pura extraída para COMEX-05

---

## Manual-Only Verifications

| Comportamiento | Por qué manual | Instrucciones |
|---------------|----------------|---------------|
| Flujo OC→Importación completo | Sin framework de tests | Abrir OC tipo importacion → Crear Importación → completar campos → cambiar estados |
| Alta de stock con seriales | Sin framework de tests | Botón "Ingresar al stock" → cargar seriales → verificar en /stock/unidades |
| Cierre de requerimientos | Sin framework de tests | Verificar estado en /stock/requerimientos tras ingresar stock |

---

## Validation Sign-Off

- [ ] Todos los comportamientos tienen instrucciones de verificación manual
- [ ] Wave 0 cubre gaps de tipo/datos
- [ ] Build TypeScript limpio antes de cada commit
- [ ] `nyquist_compliant: true` cuando todos los checks estén verdes

**Approval:** pending
