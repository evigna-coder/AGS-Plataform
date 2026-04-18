# Rule: React component size budget

## Invariant

No React component file in `apps/sistema-modular/src/` or `apps/portal-ingeniero/src/` should exceed **250 lines**. When a component grows past that, extract hooks (`useXxx`) or subcomponents before adding more.

(`apps/reportes-ot/` is excluded — see [reportes-ot.md](reportes-ot.md).)

## Why

- Component files over 250 lines in this codebase have historically become dumping grounds: mixed state, IO, formatting, conditional trees, and dead branches. They fail to load in a reviewer's head in one pass.
- The existing UI atoms (`Button`, `Card`, `Input`, `SearchableSelect`) were extracted exactly to keep pages under this budget — the pattern works.

## How to apply

### When creating a new component

- Start by sketching the responsibilities. If you already see 3+ distinct ones (data fetch, form state, layout, presentation), plan subcomponents from the start.
- Put presentational atoms in [apps/sistema-modular/src/components/ui/](apps/sistema-modular/src/components/ui/).
- Put feature-specific subcomponents colocated with the feature under `components/[feature]/` or `pages/[feature]/components/`.

### When editing an existing file that's already near 250

1. Identify what can move out: custom hook for state/effects, presentational subcomponent for a block of JSX, helper in `utils/` for pure logic.
2. Extract in the same PR as the change — don't land a file at 280 "temporarily".

### Hook vs subcomponent decision

- **Extract a hook** when the bulk is state, effects, callbacks, or derived values — logic the parent owns.
- **Extract a subcomponent** when the bulk is JSX — rendering the parent delegates.

## Enforcement

- Hook `check-component-size` prints a soft warning on stderr when an edit leaves a `.tsx` over 250 lines. Not blocking — budget, not invariant.
- Repeated offenders (same file crossing the budget multiple times) should be refactored, not silenced.
