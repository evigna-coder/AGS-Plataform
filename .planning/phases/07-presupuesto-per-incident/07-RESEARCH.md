# Phase 7 Research — presupuesto per_incident

**Researched:** 2026-04-20
**Domain:** Presupuesto tipo `'servicio'` — audit + token-first mail flow
**Confidence:** HIGH (all findings verified against local source)
**Scope:** Complements 07-01-PLAN.md and 07-02-PLAN.md — does NOT duplicate their 12-finding audit.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Naming `'servicio'` ≡ per_incident. No new enum string. Roadmap uses "per_incident" as a functional name; code uses `'servicio'`.
- Precios 100% manuales. `ConceptoServicio.valorBase` es referencia prellenada.
- Sin snapshot, sin estado `oc_recibida`. Validity clause del PDF es la protección contractual.
- Cargar OC dispara lógica SIN cambio de estado (en Phase 8).
- Phase 8 referencias NO se implementan acá (FLOW-01..07, auto-OT, auto-ticket, derivación Importaciones).

### Claude's Discretion
- Naming de callbacks internos (`handleEnviarClick`, etc.).
- Si extraer hook `useEnviarPresupuesto` (decidido SÍ por 07-02 plan — W-3 mandatorio).
- Exactamente qué toast/snackbar usar — usar el que ya existe en el modal (status + error inline strings).
- Tests unitarios — si existen, agregar casos; si no, verificación manual. **Este research confirma: no hay tests unitarios, pero hay Playwright E2E (ver abajo).**

### Deferred Ideas (OUT OF SCOPE)
- Snapshot precio / TC al `oc_recibida` — descartado 2026-04-20.
- Estado `oc_recibida` nuevo — NO se agrega.
- Plantillas rich-text condiciones comerciales — Phase 3 diferida.
- Auto-ticket / auto-OT / derivación Importaciones — Phase 8.
- Motor de precios por zona/contrato — Phase 6 diferida.
- Rename `'servicio'` → `'per_incident'` — no se hace.
- Excel export — Phase 10.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PTYP-01 | Implementación completa presupuesto per_incident (editor, PDF, mail OAuth, estados) | Validation via existing Playwright `03-presupuestos.spec.ts` (already has `selectOption('servicio')` flow) + manual checkpoints in 07-01-PLAN Task 4 |
| FMT-01 | PDF generator tipo 'servicio' reusando template teal | Visual-only; no automation possible — react-pdf output is binary Blob. Manual PDF checklist in 07-01 Task 4 step 5 |
| FMT-02 | Token-first order en envío por mail (Pitfall 5-A) | Partially automatable: `markEnviado` atomic update IS assertable via Firestore doc state after forced failure. Full path requires manual Playwright run (OAuth popup) |
</phase_requirements>

---

## Executive Summary

The existing plans (07-01, 07-02) already cover the implementation audit thoroughly: 8 findings for 07-01 (equipo-panel gate, PDF polish, explicit `tipo:'servicio'`) and 7 findings for 07-02 (atomic `markEnviado`, hook extraction, token-first order). Both have `checkpoint:human-verify` tasks at the end with detailed manual-test scripts.

What the plans **do not** cover and this research **adds**:

1. **Validation Architecture** — the codebase has Playwright E2E (`e2e/circuits/03-presupuestos.spec.ts`) but **zero** unit/integration tests. Any automation strategy for FMT-02 must extend Playwright (not invent a new framework). There is no way to automate the Google OAuth popup path; token-first correctness must be proven by forcing failure in Firestore-only assertions OR by a dedicated Playwright test that mocks `useGoogleOAuth`.
2. **Concrete risk scenarios** beyond the plans' findings — concurrent-tab sends, expired-cached-token, `sendGmail` succeeding after network timeout (orphan email), dirty-guard race in `subscribeById`, popup blockers.
3. **Reusable assets** the executor should consult before building — the plan correctly references files but misses some patterns (status-style messaging, blob-to-base64 helper already present, `buildMimeMessage` idempotency).

**Primary recommendation:** Treat the Playwright E2E suite as the Nyquist sampling layer. Add a single new spec file for the token-first assertion (with `useGoogleOAuth` mocked via `window.google` stub) — ~60 lines, dual-purpose: regression for Phase 7, reusable for Phase 10 when `'partes'`/`'mixto'`/`'ventas'` inherit the modal.

---

## Validation Architecture

> Config note: `.planning/config.json` does not set `workflow.nyquist_validation` → treated as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright `^1.59.1` (E2E only) |
| Config file | `apps/sistema-modular/playwright.config.ts` |
| Quick run command | `pnpm --filter @ags/sistema-modular e2e -- e2e/circuits/03-presupuestos.spec.ts` |
| Full suite command | `pnpm --filter @ags/sistema-modular e2e` |
| Type-check (contract) | `pnpm --filter @ags/sistema-modular type-check` |
| AST rule scan | `pnpm lint:ast` (catches `no-firestore-undefined`) |

**Pre-requisite for E2E:** dev server running on port 3001 (`pnpm dev:modular`) + one-time login via `pnpm e2e:setup` (persisted in `e2e/.auth-profile`). Tests share a single `BrowserContext` across files (serial mode, `workers: 1`, `fullyParallel: false`).

**No unit-test framework installed.** No Vitest, Jest, or React Testing Library in any `package.json`. Any attempt to add unit tests for this phase would introduce a framework as a side-effect — **do not do this for Phase 7**. File for follow-up post-v2.0.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| PTYP-01 | Crear presupuesto tipo `'servicio'` desde list + agregar ítem + persiste | E2E | `pnpm --filter @ags/sistema-modular e2e -- 03-presupuestos` | Yes — `e2e/circuits/03-presupuestos.spec.ts` lines 14-55 ✅ |
| PTYP-01 | Crear desde ticket (LeadDetail) con prefill | E2E | (new test — extend `02-leads-tickets.spec.ts` with Path A) | Partial — Path A not covered |
| PTYP-01 | AddItemModal NO muestra EquipoLinkPanel para `'servicio'` | E2E | (new test — assert the blue panel locator is not visible) | ❌ Wave 0 candidate |
| PTYP-01 | `tipo` field stored in Firestore doc | Manual or E2E via page.evaluate | `await app.evaluate(() => firebase.firestore()...)` — complex | Manual-only pragmatic |
| FMT-01 | PDF renders with header/items/totals/validez block | **Manual-only** (react-pdf Blob — no DOM) | N/A — visual diff would need pdf-parse + pixelmatch (not installed) | ❌ Justified manual (checkpoint 07-01 Task 4 step 5) |
| FMT-01 | MIXTA multi-moneda totals | Manual | N/A — same reason | ❌ Justified manual |
| FMT-02 | Happy path: estado passes to `'enviado'` + `fechaEnvio` set atomically | E2E (with mocked `useGoogleOAuth`) | (new spec) | ❌ Wave 0 candidate |
| FMT-02 | OAuth cancel → estado stays `'borrador'` | E2E (mock reject) | (new spec) | ❌ Wave 0 candidate |
| FMT-02 | `sendGmail` fails → estado stays `'borrador'` | E2E (mock throw) | (new spec) | ❌ Wave 0 candidate |
| FMT-02 | Re-send on already `'enviado'` does NOT overwrite `fechaEnvio` | Manual (requires 2 doc versions) | Could be E2E | Manual (checkpoint 07-02 Task 4 Test 4) |
| FMT-02 | Lead sync fires when `origenTipo='lead'` | E2E | Coupled to Path A — same file | Manual (checkpoint 07-02 Task 4 Test 7) |

### Sampling Rate

- **Per task commit:** `pnpm --filter @ags/sistema-modular type-check` (< 10s, catches interface breakage in `presupuestosService.markEnviado` signature, `EnviarPresupuestoModal` props, `useEnviarPresupuesto` hook contract).
- **Per wave merge (Wave 1 is both plans):** `pnpm --filter @ags/sistema-modular e2e -- 03-presupuestos` + `pnpm lint:ast` (checks `no-firestore-undefined` on the new `markEnviado` method).
- **Phase gate (before `/gsd:verify-work`):** full suite — `pnpm --filter @ags/sistema-modular e2e` + `pnpm --filter @ags/sistema-modular build` — plus the manual checkpoints in both plans' Task 4.

### Automated Assertions (concrete)

For each plan's code changes, the minimum automatable checks:

**07-01 Task 1 (equipo-panel gate):**
- `type-check` must pass — `EquipoLinkPanel.tsx` props align with `AddItemModal.tsx` pass-through.
- Manual (no E2E locator exists yet): the blue panel `div[class*="bg-blue-50"]` inside `AddItemModal` must be absent when `Tipo = Servicio`. Candidate new E2E (Wave 0 gap):
  ```ts
  test('AddItemModal hides EquipoLinkPanel for tipo=servicio', async ({ app, nav }) => {
    await nav.goToFresh('Presupuestos');
    // ... create servicio, open add item
    await expect(app.locator('text=Vincular a equipo')).toHaveCount(0);
  });
  ```

**07-01 Task 2 (PDF polish):**
- Not automatable. `generatePresupuestoPDF` returns `Promise<Blob>`; the Blob is opaque binary from `@react-pdf/renderer`. No pdf-parse / visual-diff tooling is installed and adding one is out of scope. **Rely on the Task 4 manual checkpoint.**

**07-01 Task 3 (explicit `tipo:'servicio'` in `PresupuestoNew`):**
- `type-check` catches type divergence.
- Existing E2E `03-presupuestos.spec.ts` test 3.2 already exercises this path — if it passes post-edit, the happy path is covered.

**07-02 Task 1 (`markEnviado` atomic):**
- `type-check` catches signature.
- `pnpm lint:ast` catches `undefined` leaks into the payload (hard rule — `deepCleanForFirestore` is used, so it should not trigger; verify it doesn't in the diff review).
- Wave 0 E2E candidate: after full happy-path send, assert via `page.evaluate` that the Firestore doc has `estado === 'enviado'` AND `fechaEnvio` set. **This requires injecting a Firestore read helper into the test page (`window.__E2E_FS__`).** Complexity medium; can be deferred with a justified manual-only note.

**07-02 Task 2 (`useEnviarPresupuesto` hook):**
- `wc -l apps/sistema-modular/src/components/presupuestos/EnviarPresupuestoModal.tsx` must be `< 250` post-edit (hard rule, not a test — a grep check).
- Stage-by-stage error strings are testable via Playwright if `useGoogleOAuth.requestToken` is stubbable. Feasible via `page.addInitScript` that replaces `window.google.accounts.oauth2.initTokenClient`. **This is the most valuable new automated test — documented below in Risk Surface.**

**07-02 Task 3 (`EditPresupuestoModal.onSent` no-op):**
- `type-check` catches the 4 new props required on `<EnviarPresupuestoModal />`.
- Behavior is passive (subscribe-driven refresh). Hard to unit-test without fakes. Manual verification in Task 4 test 1 covers it.

### Manual-Only Checkpoints (with justification)

| Scenario | Why Manual | Plan Reference |
|----------|-----------|----------------|
| PDF visual render (all pages, validez block, header cleanup) | react-pdf output is binary Blob; no visual-diff tooling in repo | 07-01 Task 4 step 5 |
| Gmail send lands in actual inbox | Gmail API is real; cannot be mocked in prod path | 07-02 Task 4 Test 1 step 8 |
| OAuth popup cancel UX | Real Google Identity popup, user-driven gesture | 07-02 Task 4 Test 2 |
| Firestore offline mid-stage-4 | DevTools network blocking, hard to scriptly | 07-02 Task 4 Test 6 |

### Wave 0 Gaps

- None required for the plans to proceed — existing Playwright `03-presupuestos.spec.ts` smoke-covers PTYP-01 creation.
- **Optional but recommended** (documented as future improvement, not blocking):
  - `e2e/circuits/03-presupuestos.spec.ts` — add one test for `AddItemModal` panel-gate (03-presupuestos.5 or new 03-presupuestos.6).
  - `e2e/circuits/03-presupuestos.spec.ts` — add token-first order test with mocked `window.google` (see Risk Surface → Popup-blocker recommendation).
- **If the executor wants to add them:** budget ~45 min for both. If they push the phase over timebox, defer to a post-phase follow-up issue.

---

## Risk Surface (beyond the planner's audit)

These scenarios are NOT covered by the 12-finding audit in the plans. Document them in the SUMMARY if observed during manual testing.

### 1. Cached OAuth token stale race (HIGH likelihood, LOW impact)
`useGoogleOAuth` returns a cached token when `Date.now() < expiresAt - 60000` (`useGoogleOAuth.ts:21`). If the user opens the modal, waits 59 minutes (Gmail tokens default 3600s), then clicks send — the cache check passes but `sendGmail` may receive `401 invalid_token`. **Current behavior** (post-07-02): stage 3 (`sending`) fails, user sees "El mail no se pudo enviar...". **Mitigation:** the error path already covers this correctly; user can retry and `requestToken` will re-request. No plan change needed — document as known behavior.

### 2. Concurrent tab sends (LOW likelihood, MEDIUM impact)
User opens the same presupuesto in 2 browser tabs (possible — the modal is non-modal in URL terms). Both tabs click send simultaneously:
- Both `requestToken` calls resolve (token is shared).
- Both `sendGmail` calls succeed — **two emails leave the server**.
- Both `markEnviado` calls run. `updateDoc` is last-write-wins; `fechaEnvio` gets set twice to the same date — idempotent, no harm.
- The lead sync fires twice. `leadsService.syncFromPresupuesto` is also mostly idempotent (checks terminal states at line 403).
- **Net damage:** client receives 2 identical emails. UX annoyance, not a data bug.
- **Mitigation (not required for v2.0):** add `fechaEnvio` absence as a condition in `markEnviado` OR use `runTransaction`. Flag for Phase 8 (FLOW-05 already calls out `runTransaction` for state transitions).

### 3. `sendGmail` resolves AFTER user closes modal / tab (LOW likelihood)
Network is slow, user clicks Cancel or closes the tab after clicking send. The `fetch` in `gmailService.ts:58` may resolve server-side (email sent) but the React state reflecting stages 4-5 never runs. Result: email sent, but `markEnviado` never fires — presupuesto stays `'borrador'` with no record the email went out.
- **Mitigation path:** Listen for `beforeunload` and either block close while `sending` OR store a sentinel in sessionStorage so the user knows on reopen. Not in scope for 07-02 — **document in plan SUMMARY as known**.

### 4. Popup blocker kills `requestToken` silently (HIGH likelihood if user has ad blocker)
`google.accounts.oauth2.initTokenClient(...).requestAccessToken()` triggers a popup. If the browser blocks it (user gesture timing, popup blocker extension), the `callback` / `error_callback` may never fire → `requestToken` Promise never settles → the hook's `sending` state is stuck truthy forever.
- **Evidence:** `useGoogleOAuth.ts` has no timeout on the `new Promise`. The ref-based resolve/reject never gets called if Google's SDK throws synchronously or the popup is blocked before callback wiring.
- **Mitigation:** add a `setTimeout` guard in the hook (e.g., 60s reject) — **out of scope**, but the executor should check if `error_callback` is actually invoked on popup-blocked in their browser. Document in Task 4 Test 2 result.
- **Testing implication:** the new E2E spec for token-first assertion should mock `window.google.accounts.oauth2.initTokenClient` with a synchronous success/failure path instead of relying on a real popup.

### 5. `subscribeById` dirty-guard may skip the refresh (MEDIUM likelihood)
`usePresupuestoEdit.ts:197` skips snapshot updates when `dirty.current === true`. Scenario:
- User opens the presupuesto → `dirty = false`.
- User edits a field (e.g., notasTecnicas) → `dirty = true` (set via `setField` in the hook; check the exact flag).
- User clicks "Enviar por email" without saving first → modal opens.
- Modal runs full flow → `markEnviado` writes `estado='enviado'`.
- `subscribeById` fires the callback → **skipped** because `dirty === true`.
- User closes the send modal → `EditPresupuestoModal` still shows `estado='borrador'` in its badge until they manually save or reload.
- The list page refresh (via `onUpdated?.()`) DOES refresh the list, so next open is correct.
- **Not broken, but confusing UX.** Document in plan SUMMARY. Phase 8 or later should handle "pending local edits at time of send" — warn, save-first, or force-sync after `markEnviado`.

### 6. `fechaEnvio` vs `updatedAt` divergence (LOW impact)
`markEnviado` sets `fechaEnvio = Timestamp.fromDate(new Date('YYYY-MM-DD'))` (midnight UTC of today's date) and `updatedAt = Timestamp.now()` (exact moment). Consumers that read `fechaEnvio.toDate()` get midnight UTC; consumers reading `updatedAt.toDate()` get send time. Consistent with the existing `usePresupuestoEdit.handleEstadoChange` pattern (plan Task 1 contract — no divergence). **OK — no action.**

### 7. `PresupuestoPDFEstandar` font loading at send time (LOW likelihood)
The PDF uses Newsreader + Inter + JetBrains Mono via `@react-pdf/renderer`'s font registration. If the user has NEVER generated this PDF in-session, the first `generatePresupuestoPDF` call can take 2-5 s while fonts fetch. During `sending` stage (stage 2), the user sees "Generando PDF..." — expected. **Mitigation:** consider pre-warming the PDF by rendering a hidden instance on `EditPresupuestoModal` mount. **Out of scope for 07-01**; nice-to-have.

### 8. `blobToBase64` memory spike for large PDFs (LOW likelihood)
`FileReader.readAsDataURL` loads the entire Blob into memory twice (Blob + data URL string). For a presupuesto with 20+ items and multiple pages, ~2-5 MB PDFs are realistic. On low-end devices this is fine; no action. Document as a constraint if the phase ever targets huge presupuestos.

### 9. `gmailService.sendGmail` return type (SIGNATURE MISMATCH — LOW impact)
`sendGmail` actually returns `Promise<{ id: string; threadId: string }>` (`gmailService.ts:53`), NOT `Promise<void>` as the 07-02 interface comment claims. The hook in Task 2 uses `await sendGmail(...)` and discards the return — fine at runtime, but the documented type is wrong. **Action for executor:** when writing the hook, either use `const { id } = await sendGmail(...)` or leave as `await sendGmail(...)` (both compile). Update the type comment if touched. **Tiny correctness fix — flag in SUMMARY.**

---

## Reusable Helpers & Patterns (executor reference)

### Firestore helpers (do NOT recreate)
- `deepCleanForFirestore(obj)` — `services/firebase.ts`, imported in `presupuestosService.ts:4`. REQUIRED for nested payloads.
- `getUpdateTrace()` — returns `{ updatedBy, updatedByUid }` — already imported in `presupuestosService.ts:4`. MUST include in `markEnviado`.
- `createBatch()` + `batchAudit()` — audit-log pattern used by every mutation in `presupuestosService.ts`. Plan 07-02 Task 1 already follows this.
- `docRef('presupuestos', id)` — shorter than `doc(db, ...)`. Present in the service imports.

### Subscription helpers
- `presupuestosService.subscribeById(id, onData, onError?)` at line 158 of the service. Already wired in `usePresupuestoEdit.ts:183`. **No new subscription needed** — `markEnviado`'s write triggers it automatically.

### Status-message convention (reuse, don't reinvent)
The existing modal (`EnviarPresupuestoModal.tsx:52`) uses the pattern:
```ts
const [status, setStatus] = useState<'idle' | 'authorizing' | 'generating_pdf' | 'sending' | 'sent' | 'error'>('idle');
```
Plan 07-02 extends this with `'updating_firestore'`. The `statusMessages` map at line 114 is the right place to add it. Inline string rendering at lines 175-185 (blue for in-progress, emerald for sent, red for error) is the established visual contract — **reuse these exact classes**.

### `blobToBase64` helper (already exists, don't duplicate)
Defined at `EnviarPresupuestoModal.tsx:29-39`. Plan 07-02 Task 2 recreates it inside the new hook — **OK**, but consider moving it to `utils/` for Phase 10 reuse when `'partes'` etc. need the same modal. If extracted, the hook imports from `utils/blobToBase64.ts` — cleaner long-term.

### Playwright fixture patterns
`e2e/fixtures/test-base.ts` exposes `{ app, nav, forms, table, modal }` — use these. Key reusable pieces:
- `nav.goToFresh('Presupuestos')` — forces router reset (line 71).
- `forms.searchableSelectFirst(placeholder)` — for SearchableSelect dropdowns (line 155).
- `modal.expectOpen(title)` / `modal.expectClosed()` (lines 223-230).

### OAuth mock pattern (for Wave 0 E2E)
To automate the token-first test without a real popup, inject via `page.addInitScript`:
```ts
await app.addInitScript(() => {
  (window as any).google = {
    accounts: {
      oauth2: {
        initTokenClient: (cfg: any) => ({
          requestAccessToken: () => setTimeout(() => cfg.callback({ access_token: 'FAKE', expires_in: 3600 }), 10),
        }),
      },
    },
  };
});
```
And for the failure path, swap `callback` for `cfg.error_callback({ message: 'User cancelled' })`. Pair with `page.route('**/gmail.googleapis.com/**', route => route.abort())` to force stage 3 failure. Then assert the Firestore doc via a small `window.__E2E__.getPresupuesto(id)` helper (would need to be added to a debug-mode global — optional effort).

### Lead sync side-effect (critical to preserve in markEnviado)
`update()` at `presupuestosService.ts:293-314` does `leadsService.syncFromPresupuesto(origenId, numero, estado)` AFTER the commit. The plan's `markEnviado` replicates this. Signature (verified at `leadsService.ts:401`):
```ts
async syncFromPresupuesto(leadId: string, presupuestoNumero: string, newEstado: PresupuestoEstado)
```
Three positional args, second is the numero (string), NOT the presupuestoId. Plan 07-02 Task 1 passes `''` as numero with a `/* numero */` comment — **this is sub-optimal**: the lead's posta log will record a blank presupuesto numero. Fix: pass the numero from the `hint` (extend hint to `{ origenTipo, origenId, numero }`) OR always do the `getById` to read the numero. **Recommendation:** extend hint to include `numero`; the modal has `presupuestoNumero` already in scope. Minor correctness improvement — flag for executor.

---

## State of the Art / Known-Good Patterns in this Codebase

| Old Approach (what NOT to do) | Current Approach | Why |
|-------------------------------|------------------|-----|
| Components call `setDoc`/`updateDoc` directly | All writes via `presupuestosService.*` | Hard rule + audit batching |
| Raw `undefined` in payload | `deepCleanForFirestore(obj)` | Hard rule — Firestore rejects `undefined` |
| State refresh via manual reload after mutation | `subscribeById` onSnapshot pushes updates | Real-time, avoids stale UI |
| PDFs via html2pdf in sistema-modular | `@react-pdf/renderer` | Mixing libraries already burned us in `reportes-ot` |
| Inline modal logic >250 LOC | Extract hook (`use*`) or subcomponent | Hard rule (components.md) |
| Mail flow: state change → send → (maybe) | **Token-first: validate → send → state change** | Pitfall 5-A — this phase's core fix |

---

## Open Questions

1. **Should the Wave 0 E2E gap (token-first mock test) be included in 07-02 or deferred?**
   - What we know: the plan Task 4 is manual-only. A mocked spec would catch regressions in Phase 10 automatically.
   - What's unclear: whether the ~60-min budget to add it is justified for v2.0.
   - **Recommendation:** defer. Add to v2.0 follow-up issues. The manual checkpoint + `type-check` + `lint:ast` is sufficient for v2.0 gate.

2. **Should `blobToBase64` be extracted to `utils/` now?**
   - What we know: it's about to be duplicated (inline in modal + inline in hook).
   - **Recommendation:** executor decides at the moment of Task 2. If they feel a scope-creep hesitation, inline-duplicate is fine (2 small callsites).

3. **Should the `numero` be added to the `hint` param in `markEnviado` to avoid blank presupuesto numero in lead posta?**
   - What we know: the plan passes `''`; `leadsService.syncFromPresupuesto` records this in the posta log.
   - **Recommendation:** YES, extend hint to `{ origenTipo?, origenId?, numero? }`. Minor + cheap + auditable.

---

## References

Verified local file paths (all lines numbered cat -n):
- `apps/sistema-modular/src/components/presupuestos/EnviarPresupuestoModal.tsx` (196 LOC, lines 29-39 blobToBase64, 52 status type, 65-112 handleSend, 114 statusMessages).
- `apps/sistema-modular/src/hooks/useGoogleOAuth.ts` (63 LOC — no timeout on popup promise at line 34-59).
- `apps/sistema-modular/src/services/gmailService.ts` (73 LOC — `sendGmail` returns `{ id, threadId }` at line 53).
- `apps/sistema-modular/src/services/presupuestosService.ts` (line 4 imports `deepCleanForFirestore`/`getUpdateTrace`/`createBatch`/`docRef`/`batchAudit`; line 158 `subscribeById`; line 293-314 existing `update`; line 308-314 lead sync side-effect pattern).
- `apps/sistema-modular/src/services/leadsService.ts:401` — `syncFromPresupuesto(leadId, presupuestoNumero, newEstado)`.
- `apps/sistema-modular/src/hooks/usePresupuestoEdit.ts:183-210` — subscribe + dirty-guard.
- `apps/sistema-modular/src/components/presupuestos/pdf/PresupuestoPDFEstandar.tsx` (476 LOC — line 236-238 validez, line 401-403 orphan NOTAS TÉCNICAS header).
- `apps/sistema-modular/src/components/presupuestos/pdf/generatePresupuestoPDF.tsx:122-125` — dispatcher.
- `apps/sistema-modular/playwright.config.ts` — serial, workers:1, port 3001, auth profile persisted.
- `apps/sistema-modular/e2e/circuits/03-presupuestos.spec.ts` (72 LOC — tests 3.1-3.4; test 3.2 already uses `selectOption('servicio')`).
- `apps/sistema-modular/e2e/fixtures/test-base.ts` (236 LOC — fixture helpers for navigation/forms/tables/modals).
- `apps/sistema-modular/package.json:22-27` — e2e scripts: `e2e`, `e2e:headed`, `e2e:report`, `e2e:full`, `e2e:setup`.

Line counts of files the plans will modify:
- `EnviarPresupuestoModal.tsx` 196 → must stay <250 post-hook-extract (target ~120-150).
- `AddItemModal.tsx` 257 → must drop <250 after `EquipoLinkPanel` extract (target ~200).
- `EditPresupuestoModal.tsx` 384 → flagged by 07-02 as over-budget, not refactored in this phase.
- `PresupuestoItemsTable.tsx` 231 → stays <250.
- `PresupuestoPDFEstandar.tsx` 476 → no LOC budget (PDF template).

---

## Metadata

**Confidence breakdown:**
- Validation architecture (Playwright-only, no unit tests): **HIGH** — verified via `package.json` + file scan.
- Risk surface scenarios: **MEDIUM** — derived from reading the actual code; not all scenarios empirically tested in this research.
- Reusable helpers: **HIGH** — all references cite specific file+line.
- Wave 0 gaps (optional Playwright specs): **MEDIUM** — recommendation based on effort/reward heuristic, not policy.

**Research date:** 2026-04-20
**Valid until:** 2026-05-20 (30 days — codebase stable; re-validate if react-pdf or firebase-js-sdk major bumps)

---

## RESEARCH COMPLETE

**Phase:** 07 - presupuesto-per-incident
**Confidence:** HIGH

### What this research adds beyond the planner's 12-finding audit
1. **Validation Architecture (Nyquist Dimension 8)** — documented that the repo has Playwright E2E only (no unit tests); mapped each requirement to manual vs automated; identified `03-presupuestos.spec.ts` as the existing sampling point for PTYP-01; provided a concrete OAuth-mock recipe for an optional Wave 0 E2E covering FMT-02.
2. **9 risk scenarios** the audit did not cover, including: popup-blocker hanging the `requestToken` promise (no timeout in `useGoogleOAuth`), `subscribeById` dirty-guard skipping the post-send refresh, concurrent-tab double-send, `sendGmail` resolving after modal close (orphan email), and a `sendGmail` return-type discrepancy in the plan's interface comment.
3. **Two correctness nits** for 07-02 Task 1: (a) extend the `hint` param to include `numero` so lead posta logs the presupuesto number correctly instead of `''`; (b) document that `sendGmail` actually returns `{id, threadId}` not `void`.
4. **Reusable helpers inventory** with exact file+line refs — `deepCleanForFirestore`, `getUpdateTrace`, `createBatch`/`batchAudit`, `subscribeById`, `blobToBase64`, the Playwright fixture helpers, and the status-message visual contract.
5. **Explicit Wave 0 gap list** marked optional/deferred with effort estimates — the executor can proceed immediately without them.

### Ready for Execution
Both 07-01-PLAN.md and 07-02-PLAN.md can proceed as written. This research supplements the plans; it does not block or modify them. The executor should read this file once (< 5 min) before starting Task 1 of either plan.
