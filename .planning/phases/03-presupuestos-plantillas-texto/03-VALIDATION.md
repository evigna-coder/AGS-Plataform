---
phase: 3
slug: presupuestos-plantillas-texto
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript strict (type gate) + Playwright (e2e, existing) |
| **Config file** | `apps/sistema-modular/tsconfig.json` + `apps/sistema-modular/playwright.config.ts` (if exists) |
| **Quick run command** | `pnpm --filter @ags/sistema-modular exec tsc --noEmit` |
| **Full suite command** | `pnpm --filter @ags/sistema-modular exec tsc --noEmit && pnpm --filter @ags/sistema-modular build` |
| **Estimated runtime** | ~15–25 seconds (tsc), ~45s (+ build) |

**No unit test framework exists** — no `vitest`, `jest`, `mocha` in dependencies. Per project convention (matches memory: "AGS Plataform — Memory", no unit test infrastructure), validation is:
1. TypeScript strict (type gate on every commit)
2. Build green (`pnpm build` must succeed — catches type + import errors)
3. UAT manual checklist per phase (operated by user/team)

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @ags/sistema-modular exec tsc --noEmit` (must pass)
- **After every plan wave:** Run full suite: tsc + build
- **Before `/gsd:verify-work`:** Full suite green + manual UAT checklist completed
- **Max feedback latency:** ~25 seconds (tsc alone)

---

## Per-Task Verification Map

| Behavior | Plan | Wave | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-----------|-------------------|-------------|--------|
| `PlantillaTextoPresupuesto` type compiles | 01 | 1 | gate | `pnpm --filter @ags/shared exec tsc --noEmit` | ✅ existing | ⬜ pending |
| `plantillasTextoPresupuestoService` CRUD compiles | 01 | 1 | gate | `pnpm --filter @ags/sistema-modular exec tsc --noEmit` | ✅ existing | ⬜ pending |
| RichTextEditor alignment buttons render | 02 | 1 | manual UAT | — (visual) | — | ⬜ pending |
| `PDFRichText` component renders HTML→PDF | 03 | 2 | manual UAT | — (visual) | — | ⬜ pending |
| PDF integration: bold/italic/underline visible | 03 | 2 | manual UAT | — (visual) | — | ⬜ pending |
| PDF integration: font size 10–24pt respected | 03 | 2 | manual UAT | — (visual) | — | ⬜ pending |
| PDF integration: text-align left/center/right | 03 | 2 | manual UAT | — (visual) | — | ⬜ pending |
| `PlantillasTextoModal` opens from PresupuestosList | 04 | 2 | manual UAT | — (flow) | — | ⬜ pending |
| Create plantilla flow end-to-end | 04 | 2 | manual UAT | — (flow) | — | ⬜ pending |
| Edit plantilla flow end-to-end | 04 | 2 | manual UAT | — (flow) | — | ⬜ pending |
| Filters (sección + tipo + activas) via useUrlFilters | 04 | 2 | manual UAT | — (flow) | — | ⬜ pending |
| Auto-apply defaults on tipo selection at creation | 05 | 3 | manual UAT | — (flow) | — | ⬜ pending |
| Dropdown "Cargar plantilla" in editor | 05 | 3 | manual UAT | — (flow) | — | ⬜ pending |
| Conflict selector (2+ defaults) shown inline | 05 | 3 | manual UAT | — (flow) | — | ⬜ pending |
| No auto-apply on tipo change for existing presupuesto | 05 | 3 | manual UAT | — (flow) | — | ⬜ pending |
| Seed script migrates PRESUPUESTO_TEMPLATES idempotently | 06 | 3 | manual UAT | — (console) | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

**None — no Wave 0 needed.**

- No test fixtures required (project has no unit test infrastructure — adding one is out of scope)
- TypeScript strict + Playwright e2e already configured
- Manual UAT checklist is the phase gate

*Existing infrastructure (tsc + build + manual UAT) covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Why Manual | Test Instructions |
|----------|------------|-------------------|
| PDF rendering of rich HTML (bold/italic/underline/lists/font-size/alignment) | `@react-pdf/renderer` is visual output; no practical snapshot framework in this project. Per CONTEXT.md, validation = render + visual inspection. | 1. Crear plantilla con contenido formateado (bold + italic + lista + font size 20pt + alineación centro). 2. Asignarla a un presupuesto. 3. Generar PDF. 4. Inspeccionar: bold se ve negrita, italic inclinado, listas con bullets/números, font size diferenciado, alineación correcta. |
| Seed idempotencia | One-shot script ejecutado en producción una vez. | 1. Ejecutar script en browser console con DB sin plantillas. 2. Verificar 8 plantillas creadas (6 base + 2 contrato). 3. Re-ejecutar script. 4. Verificar que NO crea duplicados (usa getAll + filtra por nombre+tipo+tipoAplicable existentes). |
| Conflict selector UX | Depende de percepción de flujo — ¿es intrusivo? ¿aparece al momento adecuado? | 1. Crear 2 plantillas de `condicionesComerciales` ambas con `esDefault=true` + `tipoPresupuestoAplica` incluye 'servicio'. 2. Crear presupuesto nuevo tipo 'servicio'. 3. Observar: selector aparece inline en la sección, listando los 2 candidatos con preview, permite elegir o dejar vacío. |
| No auto-apply en edición | Feature de seguridad contra pérdida de datos. | 1. Abrir presupuesto existente tipo 'servicio' con textos ya editados. 2. Cambiar tipo a 'contrato'. 3. Verificar: textos quedan como estaban, NO se reemplazan automáticamente. 4. Opcional: cargar manualmente plantilla de contrato vía dropdown y verificar que sí reemplaza. |
| Editor → PDF roundtrip fidelity | Bugs históricos conocidos (ver memory `reportes-ot-pdf.md` sobre `<font size>`). | 1. Editor: escribir texto con font-size 24pt + centrado + negrita. 2. Guardar presupuesto. 3. Generar PDF. 4. Comparar: lo que se ve en editor ≈ lo que sale en PDF. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify (tsc) or are flagged manual-only with test instructions
- [ ] Sampling continuity: tsc runs after every task commit — no gap
- [ ] Wave 0 covers all MISSING references (none needed — existing infra sufficient)
- [ ] No watch-mode flags (tsc runs `--noEmit` once)
- [ ] Feedback latency < 30s (tsc ~25s)
- [ ] `nyquist_compliant: true` set after wave 0 complete (N/A — no wave 0)

**Approval:** pending

---

## Notes for Planner

- **Do NOT add new unit test framework** — project convention is tsc + Playwright + manual UAT. Adding Vitest/Jest here is scope creep.
- **Do NOT add e2e Playwright tests for this phase unless explicitly scoped** — existing project UAT practice covers these flows. Research recommended this.
- `tsc --noEmit` is THE automated gate. Every task must leave the type check green.
- The manual UAT checklist above is the final phase gate. User runs through it before `/gsd:verify-work`.
