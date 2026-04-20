---
plan: 07-01
phase: 07
status: complete
completed: 2026-04-20
requirements: [PTYP-01, FMT-01]
approved_by: user (UAT reviewed inline)
---

# 07-01 Summary — Audit + fixes flow `'servicio'` + PDF polish

## Objective delivered

Flow end-to-end del presupuesto tipo `'servicio'` auditado y pulido. Panel "Vincular a equipo" ahora condicional por tipo (solo `'contrato'`). PDF estándar listo como template base para `partes/mixto/ventas` de Phase 10.

## Commits

| Commit | Change |
|--------|--------|
| `6cd351a` | Extract `EquipoLinkPanel` + gate equipo selector a contrato (AddItemModal 257→160 LOC) |
| `ad98ebe` | Polish `PresupuestoPDFEstandar`: validez con card borde teal, header huérfano removido, `titleIcon: 'X'` cleanup |
| `68ca417` | `PresupuestoNew` setea `tipo: 'servicio'` + `moneda: 'USD'` explícito (no más fallback) |

## Findings cerrados (del audit del planner)

- **FINDING-1** (blocking): `AddItemModal` renderizaba panel "Vincular a equipo" para todos los tipos → gateado por `tipoPresupuesto === 'contrato'`
- **FINDING-2**: Header huérfano "NOTAS TÉCNICAS:" en Page 1 → removido
- **FINDING-3**: Bloque validez tenue → promovido a card con borde teal (fondo teal claro)
- **FINDING-4**: `titleIcon: 'X'` placeholder legacy → eliminado
- **FINDING-5**: `PresupuestoNew` dependía de fallback del service → `tipo: 'servicio'` explícito
- **FINDING-6/7** (verify-only): `CreatePresupuestoModal` desde ticket y list filter por tipo — confirmados funcionando
- **FINDING-8 (W-1)**: `AddItemModal` 257 LOC → extraído `EquipoLinkPanel` (134 LOC); archivo quedó en 160 LOC

## Files changed

- NEW: `apps/sistema-modular/src/components/presupuestos/EquipoLinkPanel.tsx` (134 LOC)
- `apps/sistema-modular/src/components/presupuestos/AddItemModal.tsx` (257→160)
- `apps/sistema-modular/src/components/presupuestos/PresupuestoItemsTable.tsx` (231→233)
- `apps/sistema-modular/src/components/presupuestos/pdf/PresupuestoPDFEstandar.tsx` (476→473)
- `apps/sistema-modular/src/components/presupuestos/pdf/pdfStyles.ts` (377→393)
- `apps/sistema-modular/src/pages/presupuestos/PresupuestoNew.tsx`

## Verification

- `pnpm type-check` passes
- `pnpm --filter sistema-modular build:web` ✓ 1m49s
- UAT: user approved inline (no regression flagged; contrato flow intact)

## Deviations

None. Plan executed as revised.
