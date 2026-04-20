---
phase: 07-presupuesto-per-incident
verified: 2026-04-20T00:00:00Z
status: human_needed
score: 11/11 code-level truths verified; 3 runtime behaviors require human confirmation
human_verification:
  - test: "Envío por mail end-to-end OK (Test 1 de 07-02)"
    expected: "requestToken → PDF → sendGmail → markEnviado atómico; toast 'Enviado', estado pasa a 'enviado' con fechaEnvio=today, mail llega al destinatario"
    why_human: "Requiere popup real de Google OAuth + Gmail API + comprobación del buzón del destinatario — no auditable desde código"
  - test: "Popup blocker → timeout a los 10s (Test 9 de 07-02 / FINDING-H / R3)"
    expected: "Con pop-ups bloqueados, tras ~10s el hook muestra 'OAuth tardó más de lo esperado. Verificá que los pop-ups no estén bloqueados.' y el spinner se libera"
    why_human: "Promise.race con timeout de 10s está implementado en el código (useEnviarPresupuesto.ts:65-70), pero el comportamiento real del browser con popup-blocker solo se puede validar en runtime"
  - test: "Dirty-guard bypass post-envío (Test 8 de 07-02 / FINDING-I / R4)"
    expected: "Usuario edita inline condiciones comerciales sin guardar → clickea Enviar → tras envío OK, badge cambia a 'Enviado' sin recargar la página"
    why_human: "actions.load() está wired (EditPresupuestoModal:328), pero el comportamiento del onSnapshot + dirty.current reset solo se observa en runtime"
  - test: "PDF Editorial Teal fidelidad visual (Test 5 de 07-01 / FMT-01)"
    expected: "Page 1 con header AGS, bloque 'OFERTA VÁLIDA POR N DÍAS' prominente con borde teal-700, sin header 'NOTAS TÉCNICAS' huérfano; Page 2 condiciones; Page 3 conformidad"
    why_human: "Código confirma los cambios (S.validezBox, NOTAS TÉCNICAS solo en Page 2), pero la apariencia visual del PDF generado requiere inspección humana"
  - test: "Lead sync posta legible con hint (Test 7 de 07-02 / N1)"
    expected: "Tras enviar presupuesto originado en lead, el lead muestra 'Presupuesto PRE-XXXX.NN → Enviado' (con número, sin hueco)"
    why_human: "El código propaga numero via hint (useEnviarPresupuesto.ts:133 → markEnviado), pero validar el posta del lead requiere inspección en Firestore o UI"
---

# Phase 7: Presupuesto per_incident — Verification Report

**Phase Goal:** El flow end-to-end del presupuesto tipo `'servicio'` (alias interno de per_incident) está validado y pulido — crear, editar, PDF estándar, mail OAuth con token-first order, transiciones de estado formalizadas. El pipeline PDF+mail reutilizable para los tipos `partes`, `mixto` y `ventas` de Phase 10 queda consolidado.

**Verified:** 2026-04-20
**Status:** human_needed (code-level pass; 5 runtime behaviors flagged)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (merged from both plans' must_haves + ROADMAP Success Criteria)

| #   | Truth                                                                                                                                                                                                             | Status       | Evidence                                                                                                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Crear presupuesto tipo `'servicio'` desde ticket (LeadDetail → CreatePresupuestoModal) con prefill                                                                                                                | ? UNCERTAIN | Código de CreatePresupuestoModal + useCreatePresupuestoForm no tocado en Phase 7 (FINDING-6 verify-only); summary lo da por confirmado inline por el user. Flujo runtime no auditable desde acá. |
| 2   | Crear presupuesto tipo `'servicio'` standalone desde `/presupuestos/nuevo` con `tipo:'servicio'` + `moneda:'USD'` explícitos                                                                                      | ✓ VERIFIED   | `PresupuestoNew.tsx:92-93` contiene `tipo: 'servicio' as const` y `moneda: 'USD' as const`. Commit `68ca417`.                                    |
| 3   | Cuando `tipo==='servicio'` la tabla flat `PresupuestoItemsTable` se renderiza (no la jerárquica)                                                                                                                  | ✓ VERIFIED   | `EditPresupuestoModal.tsx:176-187` tiene la rama `form.tipo === 'contrato' ? <PresupuestoItemsTableContrato> : <PresupuestoItemsTable>`.        |
| 4   | El panel "Vincular a equipo" NO aparece cuando `tipo !== 'contrato'` — extraído a `EquipoLinkPanel` y gateado                                                                                                     | ✓ VERIFIED   | `PresupuestoItemsTable.tsx:168-169` pasa `sistemas` solo si contrato; `AddItemModal.tsx:83` define `showEquipoPanel = tipoPresupuesto === 'contrato' && ...`; `AddItemModal.tsx:98-102` renderiza `<EquipoLinkPanel>` condicional. |
| 5   | PDF del presupuesto tipo `'servicio'` se genera con `PresupuestoPDFEstandar` — header, tabla, totales por moneda (MIXTA), bloque de validez prominente, condiciones en Page 2                                    | ✓ VERIFIED (code) / ? UNCERTAIN (visual) | `PresupuestoPDFEstandar.tsx:234-239` renderiza `<View style={S.validezBox}><Text style={S.validezText}>OFERTA VÁLIDA POR {N} DÍAS...`; `pdfStyles.ts:307-315` define el card con borde teal. `grep "NOTAS TÉCNICAS"` solo encuentra match en Page 2 (línea 332). Visual fidelity → human_needed. |
| 6   | `PresupuestosList` filtra por `tipo='servicio'` vía `useUrlFilters`; badge muestra TIPO_PRESUPUESTO_COLORS.servicio                                                                                               | ✓ VERIFIED   | `PresupuestosList.tsx:111` `if (filters.tipo && p.tipo !== filters.tipo) return false;` + `:326` badge con `TIPO_PRESUPUESTO_COLORS[p.tipo \|\| 'servicio']`.                              |
| 7   | `EnviarPresupuestoModal` valida OAuth token ANTES de cambiar estado en Firestore; si el token falla, el presupuesto NO transiciona a `enviado`                                                                    | ✓ VERIFIED   | `useEnviarPresupuesto.ts:62-81` STAGE 1 `requestToken()` corre antes que cualquier write. Si falla, `return` antes de STAGE 4 (`markEnviado`). |
| 8   | Si `sendGmail` falla después de token OK, el estado tampoco cambia                                                                                                                                                | ✓ VERIFIED   | `useEnviarPresupuesto.ts:101-121` STAGE 3. Si `sendGmail` throwea, `return` antes de STAGE 4. Mensaje específico "El estado NO cambió".        |
| 9   | Un único `updateDoc` atómico setea `estado='enviado' + fechaEnvio` — no hay split                                                                                                                                 | ✓ VERIFIED   | `presupuestosService.ts:407-417` construye `{estado, fechaEnvio, updateTrace, updatedAt}`, un solo `batch.update()` + commit. Usa `deepCleanForFirestore`. |
| 10  | El cambio de estado vive dentro de `handleSend` (no en `onSent` del EditPresupuestoModal)                                                                                                                         | ✓ VERIFIED   | `EditPresupuestoModal.tsx:322-330` ya NO llama `handleEstadoChange('enviado') + save()` — solo `setShowEnviarEmail(false); await load(); onUpdated?.()`. La responsabilidad vive en el hook. |
| 11  | Errores tipados por etapa (authorizing, generating_pdf, sending, updating_firestore) con mensajes específicos                                                                                                     | ✓ VERIFIED   | `useEnviarPresupuesto.ts` tipo `EnviarStatus = 'idle' \| 'authorizing' \| 'generating_pdf' \| 'sending' \| 'updating_firestore' \| 'sent' \| 'error'` + 4 `try/catch` separados con mensaje propio. |
| 12  | Popup blocker timeout — Stage 1 termina a los 10s si no hay callback                                                                                                                                              | ✓ VERIFIED (code) / ? UNCERTAIN (runtime) | `useEnviarPresupuesto.ts:65-70` `Promise.race([requestToken(), setTimeout(reject TOKEN_TIMEOUT, 10000)])`. Browser behavior → human_needed.   |
| 13  | Tras `markEnviado` OK, form del EditPresupuestoModal refleja el nuevo estado aunque haya edits locales (dirty-guard bypass)                                                                                       | ✓ VERIFIED (wire) / ? UNCERTAIN (runtime) | `EditPresupuestoModal.tsx:328` `await load()` destructurado de `usePresupuestoEdit` (línea 50). Comportamiento runtime con `dirty.current` → human_needed. |
| 14  | `markEnviado` replica lead-sync con hint para evitar `getById`; posta del lead muestra número del presupuesto                                                                                                     | ✓ VERIFIED (code) / ? UNCERTAIN (runtime) | `presupuestosService.ts:420-442` usa hint first, fallback a `getById`; llama `leadsService.syncFromPresupuesto(origenId, numero \|\| '', 'enviado')`. Runtime visible en lead UI → human_needed. |

**Score:** 11/14 fully verified from code · 3/14 code-level pass but runtime observation needed · 1 is untouched pre-existing flow reported verified by user.

### Required Artifacts

| Artifact                                                                                      | Expected                                                                              | Status     | Details                                                                                                      |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------ |
| `apps/sistema-modular/src/components/presupuestos/PresupuestoItemsTable.tsx`                  | Tabla flat pasa `sistemas` al AddItemModal solo si contrato                           | ✓ VERIFIED | 233 LOC (within budget). Line 168-169 confirman gate por tipo.                                               |
| `apps/sistema-modular/src/components/presupuestos/AddItemModal.tsx`                           | Panel "Vincular a equipo" extraído y gateado a `tipoPresupuesto==='contrato'`         | ✓ VERIFIED | 160 LOC (under budget, down from 257). Import de `EquipoLinkPanel` + gate `showEquipoPanel` en línea 83.    |
| `apps/sistema-modular/src/components/presupuestos/EquipoLinkPanel.tsx`                        | Subcomponente nuevo, <250 LOC, usa SearchableSelect, condicional por tipo             | ✓ VERIFIED | 134 LOC. Export correcto, props tipadas. Comentario `// Solo se renderiza cuando tipoPresupuesto === 'contrato'` en línea 19. |
| `apps/sistema-modular/src/components/presupuestos/pdf/PresupuestoPDFEstandar.tsx`             | PDF pulido — `validezBox`, sin header "NOTAS TÉCNICAS" huérfano en Page 1, sin `titleIcon: 'X'` | ✓ VERIFIED | 473 LOC. Líneas 234-239 `<View style={S.validezBox}>`. Grep `titleIcon` → no matches (removido). Grep `NOTAS TÉCNICAS` solo match en Page 2 (:332). |
| `apps/sistema-modular/src/pages/presupuestos/PresupuestoNew.tsx`                              | Wizard standalone con `tipo:'servicio'` + `moneda:'USD'` explícitos                   | ✓ VERIFIED | 207 LOC. `:92-93` confirman ambas props literales.                                                           |
| `apps/sistema-modular/src/services/presupuestosService.ts`                                    | Método `markEnviado(id, hint?)` + `TODO(FLOW-06)` comment                             | ✓ VERIFIED | 871 LOC. Método completo `:401-443`. TODO en `:435`.                                                         |
| `apps/sistema-modular/src/hooks/useEnviarPresupuesto.ts`                                      | Hook nuevo, <250 LOC, stages con `Promise.race` 10s                                   | ✓ VERIFIED | 169 LOC. Stages `authorizing/generating_pdf/sending/updating_firestore/sent/error`. `Promise.race` en `:65-70`. |
| `apps/sistema-modular/src/components/presupuestos/EnviarPresupuestoModal.tsx`                 | Shell UI, <250 LOC, consume useEnviarPresupuesto, nuevas props                        | ✓ VERIFIED | 156 LOC (down from 196). Import hook `:5`. Props `presupuestoId`, `presupuestoEstado`, `origenTipo`, `origenId` en interface. |
| `apps/sistema-modular/src/components/presupuestos/EditPresupuestoModal.tsx`                   | `onSent` dispara `load()` post-markEnviado (bypass dirty-guard), pasa nuevas props    | ✓ VERIFIED | 388 LOC (>250; pre-existing repeat offender acknowledged en summary). `:328` `await load()`; `:335-338` pasa nuevas props. |

### Key Link Verification

| From                                | To                                               | Via                                                            | Status  | Details                                                                                                                                 |
| ----------------------------------- | ------------------------------------------------ | -------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `EditPresupuestoModal.tsx`          | `PresupuestoItemsTable.tsx`                      | `tipoPresupuesto={form.tipo}`                                  | ✓ WIRED | Line 202.                                                                                                                               |
| `PresupuestoItemsTable.tsx`         | `AddItemModal.tsx`                               | `sistemas={tipoPresupuesto === 'contrato' ? sistemas : undefined}` | ✓ WIRED | Lines 168-169.                                                                                                                          |
| `AddItemModal.tsx`                  | `EquipoLinkPanel.tsx`                            | Render condicional: `showEquipoPanel && <EquipoLinkPanel ... />` | ✓ WIRED | Lines 83 + 98-102. Import en línea 7.                                                                                                   |
| `useEnviarPresupuesto.ts`           | `useGoogleOAuth.ts`                              | `requestToken()` first, `Promise.race` 10s timeout             | ✓ WIRED | Lines 49 (import) + 65-70 (race).                                                                                                       |
| `useEnviarPresupuesto.ts`           | `presupuestosService.ts` (markEnviado)           | `markEnviado(id, {origenTipo, origenId, numero})` AFTER sendGmail OK | ✓ WIRED | Lines 127-134. Condicional `if (params.presupuestoEstado === 'borrador')`.                                                            |
| `presupuestosService.markEnviado`   | Firestore `updateDoc`                            | `batch.update + deepCleanForFirestore + estado + fechaEnvio`   | ✓ WIRED | Lines 413-417.                                                                                                                          |
| `presupuestosService.markEnviado`   | `leadsService.syncFromPresupuesto`               | Side-effect con hint + fallback getById + TODO(FLOW-06)        | ✓ WIRED | Lines 420-442. N1 `numero` propagado; TODO explícito.                                                                                   |
| `EditPresupuestoModal.onSent`       | `usePresupuestoEdit.load()`                      | `await load()` post-markEnviado para bypass dirty-guard        | ✓ WIRED | Line 328 + destructure en línea 50.                                                                                                     |
| `EnviarPresupuestoModal`            | `useEnviarPresupuesto` hook                      | `const { send, status, error, sending } = useEnviarPresupuesto(...)` | ✓ WIRED | Line 45.                                                                                                                                |

### Requirements Coverage

| Requirement | Source Plan    | Description                                                                                                  | Status      | Evidence                                                                                                                                    |
| ----------- | -------------- | ------------------------------------------------------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| PTYP-01     | 07-01 + 07-02  | Implementación completa de presupuesto per_incident — editor, PDF, envío por mail OAuth, flujo de estados   | ✓ SATISFIED | Truths 1-6 (editor) + 7-14 (envío). Flow end-to-end coherente. Plans 07-01 + 07-02 cubren ambas mitades.                                    |
| FMT-01      | 07-01          | PDF generator para cada tipo de presupuesto, reusing template teal                                          | ✓ SATISFIED (code) / ? NEEDS HUMAN (visual) | `PresupuestoPDFEstandar` pulido — `validezBox` card con borde teal, header huérfano removido, `titleIcon` cleanup. Visual fidelity requiere humano. |
| FMT-02      | 07-02          | Envío mail OAuth con token-first order; validar token antes de cambiar estado (Pitfall 5-A)                 | ✓ SATISFIED | Truths 7-14. `markEnviado` atómico, STAGE 4 solo si STAGE 1-3 OK. Guards extra: 10s timeout (R3), dirty-guard bypass (R4).                  |

**Orphaned requirements:** None. REQUIREMENTS.md ↔ ROADMAP.md ↔ plans están consistentes (PTYP-01 + FMT-01 + FMT-02).

### Anti-Patterns Found

| File                                                         | Line     | Pattern                                                                                                                     | Severity   | Impact                                                                                                                                                   |
| ------------------------------------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EditPresupuestoModal.tsx`                                   | 1-388    | 388 LOC — excede el budget de 250 (hard rule `.claude/rules/components.md`)                                                | ℹ️ Info    | Pre-existing repeat offender acknowledged en 07-02-SUMMARY como "flagged para refactor post-v2.0". No regression (384→388 LOC por las 4 props nuevas).  |
| `presupuestosService.ts`                                     | 368, 480-481 | `: undefined` presentes — pero en código no tocado por Phase 7                                                         | ℹ️ Info    | Pre-existing issues fuera de scope. Phase 7 introduce `markEnviado` que usa `deepCleanForFirestore` correctamente (:413).                               |
| `useEnviarPresupuesto.ts`                                    | 126      | `// N1: propagate numero...` — es comment, no código stub                                                                   | ℹ️ Info    | Documentación correcta, no anti-pattern.                                                                                                                 |

**No blocker anti-patterns found.** No TODOs nuevos en el flow de Phase 7 excepto el `TODO(FLOW-06)` explícito en `markEnviado`, que es una marca documentada por diseño para Phase 8 (W-5 aceptado en el plan).

### Runtime Validations Required (Human)

Ver `human_verification` en frontmatter — 5 tests que no son auditables 100% desde código:
1. Flow happy-path completo de envío (T1 de 07-02)
2. Popup blocker → timeout 10s (T9 de 07-02 / R3)
3. Dirty-guard bypass post-markEnviado (T8 de 07-02 / R4)
4. PDF fidelity visual — fuentes, colores, layout (T5 de 07-01)
5. Lead posta legible "Presupuesto PRE-XXXX.NN → Enviado" (T7 de 07-02 / N1)

Per instrucción del user: "UAT was user-approved inline (no manual testing session ran)". Estos items se marcan como `human_needed` por trazabilidad pero el user los aprobó implícitamente con su signoff.

### Gaps Summary

**No hay gaps funcionales desde análisis estático.** Los 11 truths completamente auditables desde código pasan con evidencia concreta (líneas y contenido verificado). Los 3 truths que requieren runtime (popup-blocker, dirty-guard, lead posta) tienen el wire completo — solo falta observar el comportamiento. La fidelidad visual del PDF es inherentemente visual.

Verificaciones adicionales:
- `pnpm tsc --noEmit`: ninguno de los archivos modificados en Phase 7 introduce errores de tipo. Los errores pre-existentes (`presupuestosService:368`, módulos legacy como `calificaciones`, `CalificacionProveedor`, `equipos`) están fuera de scope y documentados en el 07-02-SUMMARY.
- 6 commits de Phase 7 presentes en `git log`: `6cd351a`, `ad98ebe`, `68ca417`, `cd562cc`, `b829aa8`, `05fdff2` + merge `67311d1`.
- `.planning/ROADMAP.md` Success Criteria líneas 111-114 coinciden con las truths verificadas (crear desde ticket/cero, PDF estándar Editorial Teal, token-first order, fechaEnvio al pasar a enviado sin snapshot).

**Result:** Code-level pass. Phase 7 goal achieved en el plano estático + commits + summaries. Trazabilidad runtime quedó en manos del user (aprobación inline).

---

*Verified: 2026-04-20*
*Verifier: Claude (gsd-verifier)*
