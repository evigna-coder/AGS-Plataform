# Stack Research — Circuito Comercial Completo (v2.0)

**Domain:** B2B commercial platform — ERP-adjacent (tickets → quotes → POs → work orders → billing)
**Researched:** 2026-04-18
**Confidence:** HIGH (most decisions grounded in existing codebase + verified docs)

---

## Context: What Already Exists (Do Not Re-research)

The existing `apps/sistema-modular` package.json establishes the locked baseline:

- React 19 + TypeScript 5.8 + Tailwind 3.4 + Vite 6.2
- Firebase 12.11 (Firestore, Auth, Storage, FCM)
- `@react-pdf/renderer` 4.3 for PDF generation
- `xlsx` 0.18.5 already installed
- `google-auth-library` 9.15 + custom `gmailService.ts` for OAuth email
- `geocodingService.ts` already uses `VITE_GOOGLE_MAPS_API_KEY` and Google Maps JS SDK
- Playwright 1.59 with persistent auth profile and helpers in `e2e/fixtures/test-base.ts`
- `@playwright/test` 1.59 — E2E circuits already cover 11 scenarios

All five research questions below are **additive** — new capabilities layered onto the above.

---

## Focus Area 1: Distance Calculation (km entre base AGS y establecimiento)

### Decision: Haversine puro para precios, Google Maps JS SDK ya presente para geocoding

**Rationale:**

The project already uses `VITE_GOOGLE_MAPS_API_KEY` and loads the Google Maps JS SDK in `geocodingService.ts`. Establecimientos already store `lat`/`lng` after geocoding (the `GeocodingResult` interface confirms this). AGS base coordinates are a fixed known point.

For **pricing rules by distance** the key question is: what's the precision requirement? Price bands (e.g., 0–50 km, 50–150 km, 150+ km) do not need road-distance precision — straight-line Haversine error vs road distance is typically 20–30% for Argentine geography, which doesn't affect which band a location falls into unless it's right on a boundary. That edge case can be handled with a manual override field on the `Establecimiento`.

Google Routes API Compute Route Matrix: $5.00 per 1,000 elements after a 10,000/month free cap. For a platform with ~50 unique establecimientos, geocoding is done once at record creation; distance to base is computed once and stored. Volume will never exhaust the free cap. **However**, the added complexity of a backend proxy (Routes API requires server-side calls to avoid key exposure, or CORS-restricted key config) is not justified when the stored `lat`/`lng` already exists.

OpenRouteService free tier: 500 matrix requests/day, sufficient for this scale, but introduces an external dependency with no clear advantage over Haversine given that only one origin (AGS base) is involved.

**Recommendation: implement a `distanceKm(lat1, lng1, lat2, lng2): number` utility using the Haversine formula. Store the computed km on the `Establecimiento` document when coordinates are saved. Price rules evaluate against the stored value.**

No new library needed. Implementation is ~10 lines of TypeScript.

```typescript
// packages/shared/src/utils/distance.ts  (or directly in establishimientosService)
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

Store `distanciaKmBase: number | null` on the `Establecimiento` Firestore document. Recompute on geocoding update. Price catalog references distance bands, not raw km, so precision is not critical.

**If a future milestone requires road-distance precision** (e.g., billing kilometers traveled by a technician): use Google Routes API Compute Route Matrix via a Cloud Function or a CORS-restricted API key scoped to the domain. That is a v3.0 concern.

**Confidence: HIGH** — decision based on existing service code, pricing verified at developers.google.com/maps/billing-and-pricing/pricing.

---

## Focus Area 2: Stock Planning — Cross-collection Queries

### Decision: No new abstraction layer — denormalize a `resumenStock` field per articulo via Cloud Function trigger

**Rationale:**

Current `stockService.ts` issues individual `getDocs` queries per collection: `posicionesStock`, `unidadesStock`, `movimientosStock`, `ordenesCompra`. "Planificación extendida" (disponible + en tránsito + reservado + comprometido en otras OCs) requires combining at least 4 collections per artículo.

Options evaluated:

**Option A — Client-side fan-out (current pattern):** Query each collection separately in parallel with `Promise.all`, merge in memory. Works today for single-article detail views. For a planning list showing all articles, N articles × 4 queries = 4N reads, which Firestore bills per document. For 200 articles this is 800 reads per page load — acceptable at current scale but degrades with growth and creates a waterfall UX delay.

**Option B — Firestore Pipeline (preview, Feb 2026):** Google's new pipeline operations support server-side aggregations. Status: **preview**, not GA. Avoid for production features in a 2-week milestone.

**Option C — Denormalized `resumenStock` field on each `articulo` document:** A Cloud Function trigger (`onDocumentWritten` on `unidadesStock`, `movimientosStock`, `ordenesCompra`) recomputes and writes `{ disponible, enTransito, reservado, comprometido, updatedAt }` back to the `articulo` doc. The planning list then reads only the `articulos` collection — 1 read per article.

**Recommendation: Option C** — Cloud Function trigger to maintain a `resumenStock` summary field on each `articulo`. This is the standard Firebase write-time aggregation pattern, well-documented, GA, and matches the existing service architecture. The planning view becomes a single collection query.

This is the only case where a Cloud Function is justified purely for data architecture (not event routing). It does not introduce a new runtime — Cloud Functions are already in the Firebase project (the project uses `firebase-admin` in devDependencies, confirming the Firebase project exists).

**New dependency: Firebase Cloud Functions v2 (Node 22)**
- Runtime: Cloud Functions for Firebase (2nd gen), Node 22
- Trigger: `onDocumentWritten` on `unidadesStock`, `movimientosStock`, `ordenesCompra/{id}`
- Action: recompute aggregates → `batch.update(articuloDoc, { resumenStock: {...} })`
- Cost: Cloud Functions invocations are free up to 2M/month (gen2). For internal platform at AGS scale, cost is effectively zero.

**Confidence: HIGH** — Firestore write-time aggregation pattern is documented at firebase.google.com/docs/firestore/solutions/aggregation. Cloud Functions gen2 Firestore triggers confirmed at firebase.google.com/docs/firestore/extend-with-functions-2nd-gen.

---

## Focus Area 3: Event-Driven State Machine — Derivación Automática de Tickets

### Decision: Cloud Functions v2 Firestore triggers — onDocumentUpdated watching estado transitions

**Rationale:**

The auto-derivation workflow described in the milestone:
- Presupuesto without ticket → auto-create ticket
- OC arrives → derive to create OT
- Import detected → derive to Importaciones
- OT closed → notify Facturación

These transitions must fire reliably regardless of which user or which UI session triggers the state change. Client-side hooks in React (`useEffect` watching state) are unreliable: the user could close the tab mid-transition, or two users could trigger simultaneous updates. This is exactly the use case for server-side Firestore triggers.

**Recommendation: Cloud Functions v2, `onDocumentUpdated`, watching estado transitions on `presupuestos` and `leads` collections.**

Pattern:
```
onDocumentUpdated('presupuestos/{id}') → if before.estado !== after.estado → run transition logic
```

Each transition function should be a pure state machine step: check current state, validate guard conditions, write next-state document(s), write audit log entry.

Cloud Functions gen2 advantages over gen1 for this use case:
- Higher concurrency (multiple instances per function)
- 60-minute timeout (sufficient for complex workflows with multiple Firestore writes)
- Node 22 runtime (no deprecated Node 18)
- Direct Eventarc integration for future expansion

**No additional library needed** beyond `firebase-functions` (v2 package). The Firebase project already uses `firebase-admin` devDependency, confirming Functions deployment infrastructure exists.

**State machine implementation:** Use a plain TypeScript `switch` / transition table inside the function — no XState or external FSM library needed at this scale. XState adds a learning curve and bundle overhead not justified for 5–8 transitions.

**Client-side complement:** React UI continues to write estado changes via Firestore document updates. The Cloud Function reacts and creates secondary effects (new tickets, notifications, FCM messages). The `onSnapshot` subscriptions already in use will surface those secondary writes back to the UI in real-time.

**Confidence: HIGH** — pattern verified at firebase.google.com/docs/functions/firestore-events and firebase.google.com/docs/firestore/extend-with-functions-2nd-gen.

---

## Focus Area 4: Excel/CSV Export

### Decision: Keep `xlsx` 0.18.5 already installed — no library change needed

**Rationale:**

`xlsx` (SheetJS Community Edition) 0.18.5 is already in `package.json`. It supports:
- `XLSX.utils.json_to_sheet()` — converts array of objects to worksheet
- `XLSX.utils.book_new()` / `XLSX.utils.book_append_sheet()` — creates workbook
- `XLSX.writeFile()` — triggers browser download
- CSV output via `XLSX.utils.sheet_to_csv()`

For the export requirements in this milestone (list views: tickets, presupuestos, stock, OTs), SheetJS is sufficient. The data is flat or easily flattened at export time.

**ExcelJS vs SheetJS for this project:**

ExcelJS 4.x supports rich formatting (merged cells, images, formula evaluation) and is actively maintained. However, it adds ~500KB to the bundle. For this milestone, exports are data-only tabular lists — no formulas, no merged headers beyond a title row. SheetJS handles this with zero additional install cost.

**Security note:** SheetJS Community Edition 0.18.x has known CVEs in parsing (reading malicious files). This project only **writes** Excel files (export, never import parse from untrusted input), so the vulnerability surface does not apply.

**Recommendation: Use `xlsx` 0.18.5 as-is.** Implement a shared `exportToExcel(rows, columns, filename)` utility in `packages/shared` or as a hook in `sistema-modular`. No new dependency.

If a future milestone requires Excel **import** from untrusted user uploads (e.g., bulk stock upload), evaluate ExcelJS 4.x at that time — it has a better security track record for parsing.

**Confidence: HIGH** — package already installed, API verified at docs.sheetjs.com.

---

## Focus Area 5: Playwright Patterns for Async/State Flows

### Decision: `expect.poll()` + `page.waitForSelector()` + explicit state-change triggers — no new library

**Rationale:**

Existing E2E architecture (from `e2e/fixtures/test-base.ts` and circuit 11) uses:
- Shared persistent browser context with pre-authenticated session
- Helper classes (`NavHelpers`, `FormHelpers`, `TableHelpers`, `ModalHelpers`)
- Playwright 1.59 (`@playwright/test`)

For the new milestone, circuits must test async state machine transitions where:
1. User action writes to Firestore
2. Cloud Function trigger runs (latency: 1–5s typically)
3. Firestore onSnapshot propagates back to UI
4. UI re-renders with new state

**Recommended patterns:**

**Pattern A — `expect.poll()` for state badge changes (preferred):**
```typescript
// Wait up to 15s for a status badge to show "EN_PROCESO"
await expect.poll(
  () => page.locator('[data-testid="ticket-estado"]').textContent(),
  { timeout: 15_000, intervals: [500, 1000, 2000] }
).toBe('EN_PROCESO');
```
`expect.poll()` retries a function until the assertion passes. No manual sleep. Handles Cloud Function latency gracefully.

**Pattern B — `page.waitForSelector()` with timeout for new documents appearing in lists:**
```typescript
await page.waitForSelector(`text=${expectedTicketTitle}`, { timeout: 20_000 });
```

**Pattern C — `page.waitForFunction()` for complex DOM conditions:**
```typescript
await page.waitForFunction(
  (id) => document.querySelector(`[data-id="${id}"]`)?.getAttribute('data-estado') === 'CERRADO',
  ticketId,
  { timeout: 15_000, polling: 1000 }
);
```

**For Firestore-dependent tests:** Do NOT mock Firestore in integration E2E tests for this project. The value of the circuit tests is verifying the real Firebase project state machine. Use `page.route()` only for mocking external APIs (Gmail send, Google Maps geocoding) to avoid side effects in test runs.

**Recommended `page.route()` mocks for E2E:**
```typescript
// Mock Gmail send — prevent actual emails during E2E
await page.route('https://gmail.googleapis.com/**', async route => {
  await route.fulfill({ status: 200, body: JSON.stringify({ id: 'mock-msg-id', threadId: 'mock-thread' }) });
});

// Mock Google Maps geocoding — deterministic coordinates
await page.route('https://maps.googleapis.com/maps/api/geocode/**', async route => {
  await route.fulfill({ status: 200, body: JSON.stringify({ results: [mockGeoResult], status: 'OK' }) });
});
```

**Test timeout guidance:**
- Standard UI interaction: 5s (Playwright default)
- Firestore write → UI update (no Cloud Function): 5–8s
- Cloud Function trigger → UI update: 15–20s (set per-test timeout in `test.setTimeout(30_000)`)
- Full business cycle (circuit 11 with state machine): 120s

**Confidence: HIGH** — Playwright API verified at playwright.dev/docs/test-assertions. Cloud Function latency range from direct Firebase documentation and community pattern.

---

## Summary: New Stack Additions

| Addition | Type | Justification |
|----------|------|---------------|
| `haversineKm()` utility | ~10 lines TypeScript in packages/shared | No library — replaces Distance Matrix API call for price-band calculations |
| Cloud Functions v2 (Node 22) | New Firebase project resource | Required for: stock `resumenStock` aggregation trigger + estado machine transitions |
| `firebase-functions` npm package (v2) | New devDependency in `/functions` workspace | Required to deploy Cloud Functions |
| `page.route()` mocks for Gmail + Maps | E2E test pattern | Prevent side effects in Playwright runs |
| `expect.poll()` pattern | E2E test pattern | Handle Cloud Function latency in assertions |

## What Does NOT Need to Change

| Area | Decision | Reason |
|------|----------|--------|
| Distance API | No API call — use stored lat/lng + Haversine | VITE_GOOGLE_MAPS_API_KEY already exists for geocoding; distance to single fixed base needs no road routing |
| Excel/CSV | `xlsx` 0.18.5 as-is | Already installed; write-only use case; no CVE exposure |
| Email with attachments | `gmailService.ts` as-is | Already implements MIME multipart with `attachments[]` array; supports multiple files today |
| PDF types | `@react-pdf/renderer` 4.3 as-is | New PDF types (per_incident, partes, mixto, ventas) follow same pattern as existing contrato PDF |
| State machine library | None — plain TypeScript switch | XState overhead not justified for 5–8 transitions |
| Firestore aggregation SDK | No pipeline/BigQuery | Not GA; write-time denormalization via Cloud Function is the proven pattern |

## Installation (Net New)

```bash
# In project root — create functions workspace
mkdir functions
cd functions && npm init -y

# Firebase Functions v2
npm install firebase-functions firebase-admin

# In root pnpm-workspace.yaml — add 'functions' to workspaces
```

Cloud Functions deploy separately from the React app — they do not affect the Vite bundle.

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| `firebase-functions` | ^6.x (v2 runtime) | `firebase-admin` ^13 | Both in Firebase gen2 ecosystem |
| `firebase-admin` | ^13.0 (already devDep) | Firebase 12.11 SDK | Same project credentials |
| `xlsx` | 0.18.5 (existing) | React 19, Vite 6 | No change needed |
| `@playwright/test` | 1.59 (existing) | Node 22, Chromium | `expect.poll()` available since 1.25 |

## Sources

- [Google Maps Billing & Pricing](https://developers.google.com/maps/billing-and-pricing/pricing) — Routes API free cap (10,000/month) and per-element pricing verified
- [OpenRouteService API Restrictions](https://openrouteservice.org/restrictions/) — Matrix: 500/day, 3,500 locations per request
- [Firestore Aggregation (Write-time)](https://firebase.google.com/docs/firestore/solutions/aggregation) — write-time pattern confirmed GA
- [Firestore Extend with Cloud Functions gen2](https://firebase.google.com/docs/firestore/extend-with-functions-2nd-gen) — onDocumentWritten/Updated triggers confirmed
- [Firestore Pipeline Operations](https://www.infoq.com/news/2026/02/firestore-enterprise-pipeline/) — confirmed preview status as of Feb 2026, not GA
- [SheetJS Community Edition](https://docs.sheetjs.com/docs/) — write-only API confirmed
- [Playwright Assertions](https://playwright.dev/docs/test-assertions) — expect.poll() API confirmed
- [Playwright Network Mocking](https://playwright.dev/docs/mock) — page.route() pattern confirmed
- [Google Maps Distance Matrix Legacy](https://developers.google.com/maps/documentation/distance-matrix/usage-and-billing) — confirmed Legacy status as of March 2025

---
*Stack research for: AGS Plataforma v2.0 Circuito Comercial Completo*
*Researched: 2026-04-18*
