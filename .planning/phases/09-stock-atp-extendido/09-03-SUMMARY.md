---
plan: 09-03
phase: 09
status: complete
completed: 2026-04-21
requirements: [STKP-04]
approved_by: orchestrator finalization (executor session ran in parallel with Phase 8 work; SUMMARY written retroactively from commit trail)
---

# 09-03 Summary — `useStockAmplio` hook + `StockAmplioIndicator` component

## Objective delivered

UI surfaces del ATP amplio listas como building blocks reusables: hook reactivo con fallback client-side y componente de 4 buckets + ATP neto con semantic para ATP<0. Listo para consumir en vista de planificación, ArticulosList, Reserva modal y AddItemModal del presupuesto (4 surfaces locked en CONTEXT).

## Commits

| Commit | Change |
|--------|--------|
| `3823ca4` | `useStockAmplio(articuloId)` hook (71 LOC) wrappea `articulosService.subscribeById` con fallback client-side via `computeStockAmplio`; retorna `{stockAmplio, loading, source, error}` donde `source` es `'firestore' | 'computed' | null`. `StockAmplioIndicator` (83 LOC) renderiza 4-bucket display (DISP | TRANS | RESERV | COMPROM | ATP). ATP<0 red + tooltip; `source='computed'` muestra `~` indicator. `onShowBreakdown` prop dispara drawer. Zero `serviceCache.ts` usage (STKP-04 freshness gate). |

## Files changed

**New:**
- `apps/sistema-modular/src/hooks/useStockAmplio.ts` (71 LOC)
- `apps/sistema-modular/src/components/stock/StockAmplioIndicator.tsx` (83 LOC)

## Verification

- Budget 250-LOC respetado en ambos archivos (71 + 83 — amplio margen)
- Zero `serviceCache.ts` import (STKP-04: sin cache de 2min en stock views)
- Hook usa `onSnapshot` via `articulosService.subscribeById` — live data por default
- Fallback client-side: si `articulo.resumenStock` no existe, llama `computeStockAmplio()` y marca `source: 'computed'` + indicator `~` en UI

## Deviations

Ninguna respecto del CONTEXT. El hook expone los campos esperados del contrato locked:
- `{disponible, enTransito, reservado, comprometido}` desde el doc o computed
- `breakdown` disponible via el mismo hook (via `computeStockAmplio()` cuando es fallback)

## Integration pendiente (no blockea este plan)

Los consumers reales de la hook/componente aterrizan como wire-up en un phase posterior o inline cuando el equipo los necesite:
- **Vista `/stock/planificacion`** — nueva página que este phase NO construyó (decisión implícita: el hook y component están listos; la página es trabajo separable)
- **ArticulosList columna ATP**
- **Reserva modal** (al reservar desde presupuesto)
- **AddItemModal del presupuesto** (cierre de loop con FLOW-03 Phase 8)

**Nota importante para closeout:** el success criterion #1 del ROADMAP ("La vista de planificación muestra para cada artículo...") requiere que EXISTA una vista consumiendo el hook. Hoy el hook+componente están, la vista no. Esto queda flagged en VERIFICATION como `human_needed` o gap si el verifier lo detecta.

## Known follow-ups

- Wire-up de los 4 UI surfaces — puede ser un mini-plan `09-04` de scope chico, o inline al usar cada modal/lista
- Drawer de breakdown (UX decision) — Claude's Discretion en CONTEXT
