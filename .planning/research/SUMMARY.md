# Research Summary — Circuito Comercial Completo v2.0

**Synthesized:** 2026-04-19
**Input files:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md, PROJECT.md
**Overall confidence:** HIGH

---

## Executive Summary

AGS Plataforma v2.0 extends an operational system to close the full commercial circuit end-to-end: **Ticket → Presupuesto → OC → OT → Facturación**.

Domain is B2B post-venta for laboratory equipment — field service model, confirmed against Dynamics 365 Field Service and ATP industry standards.

**Recommended architecture:** stays entirely **client-side** for the commercial pipeline state machine triggers (extending the proven `presupuestosService → leadsService → otService` chain). Cloud Functions are used **only** for `resumenStock` denormalization on the stock planning list view. This split respects the 2-week timeline and avoids bootstrapping new infrastructure for the business logic layer.

---

## Tension Resolutions

### Tension 1 — Client-side vs Cloud Functions for derivation

**Resolution: Client-side wins.**

Cloud Functions would add `functions/` workspace bootstrap, Blaze plan activation, cold start latency in E2E, and a less-debuggable environment — without eliminating the same idempotency problems that exist client-side.

**Failure mode mitigation:**
- `pendingActions: string[]` field on presupuesto
- Monitoring dashboard to detect orphaned derivations
- Explicit error handling (replace silent `.catch(console.error)` with logged + retry-able failures)

### Tension 2 — Stock planning architecture

**Resolution: Hybrid approach.**

- **Cloud Function** → `resumenStock: { disponible, enTransito, reservado, comprometido }` denormalized on articulo doc, for the planning **list view** (N articles × 4 queries = unacceptable cost)
- **`computeStockAmplio()` pure function** → individual ATP checks in detail views (freshness required, 3 queries acceptable)

Both are complementary, not competing.

### Tension 3 — Distance pricing: km exact vs geographic zones

**Resolution: Open business decision before Phase 1.**

FEATURES research recommends named geographic zones (AMBA / Interior BA / Interior país) over exact km. The user confirmed "Mixto" (tabla global + override por servicio). The `kmRangos[]` data model supports both.

**Action:** Define zone names and km boundaries in a commercial team session before the catalog editor is built.

---

## Feature Categorization

### Table Stakes (v2.0 must have)
- Q2C lifecycle with 6 estados incluyendo `aceptado_verbal` vs `oc_recibida`
- ATP stock verification (`disponible + tránsito + OCs abiertas - reservado`)
- Auto-derivation pipeline (sin ticket → auto-ticket; OC recibida → crear OT; importación detectada → Comex)
- Price snapshot on `enviado` state (nunca actualizar retroactivamente)
- PDF + mail para todos los tipos (per_incident, partes, mixto, ventas, contrato)
- Facturación notification (ticket + mail)

### Differentiators AGS
- Desktop MVP instalable con feature flag per-módulo
- QR + agsVisibleId en equipos (ya implementado)
- Editor jerárquico Sector→Sistema→Servicios para contratos (ya existe)
- Cruce de stock amplio ATP (no solo disponible)

### Anti-features (NO construir)
- Distance calculation exacto por GPS/km real (usar zonas)
- Parseo de emails entrantes para OC
- Facturación real en Bejerman (out of scope)
- Auto-approval sin OC (requiere OC física como conformidad)
- Precio dinámico retroactivo en presupuestos viejos

### Deferred to v2.1
- Presupuesto mixto completo (servicios + partes combinados en un solo flujo)
- OT parcial con continuación automática
- Cosecha Items → OT automática

---

## Suggested Phase Structure (6 phases)

### Phase 5 (0-adjacent): Pre-conditions + Data Cleanup + Shared Utilities
**Goal:** unlock el resto. Hard prerequisite — auto-triggers break on dirty legacy data.

**Scope:**
- Migration batch: tickets con `clienteId: null` (buscar por razón social, setear o marcar unresolved)
- Migration batch: `contactos` planos → array estructurado
- Shared utility functions: `haversineKm`, `computePrecioServicio`, `computeStockAmplio`
- `functions/` workspace bootstrap (solo para `resumenStock` más adelante)
- Feature flags remotos (colección `featureFlags`, UI admin)

### Phase 6: Catálogo de Servicios con Precios
**Scope:**
- Extender `conceptos_servicio` con `kmRangos[]` + `preciosContrato[]` + `zonas[]`
- CRUD pages (lista + editor)
- `computePrecioServicio()` pure function
- Disciplina de `precioUnitarioSnapshot` + `precioManual` desde día 1 (prevents Pitfalls 1-A, 1-D)

### Phase 7: Presupuesto Per-Incident — Editor, PDF, Mail
**Scope:**
- Highest-volume workflow; reusa patrones de editor/PDF/mail
- Token-first mail order (Pitfall 5-A): token válido ANTES de cambiar estado
- Price freeze on transición a `enviado`
- Reuse de template PDF teal del contrato adaptado

### Phase 8: Estados + OC Tracking + Alertas
**Scope:**
- Full `PresupuestoEstado` lifecycle
- `runTransaction` en transiciones críticas (Pitfall 2-D)
- OC: número + adjunto PDF obligatorio; adjunto dispara cambio de estado
- Vencimiento scheduled job (alerta 5 días sin OC)
- FCM notification al coordinador on `oc_recibida`

### Phase 9: Stock ATP + Auto-Derivation to Importaciones
**Scope:**
- Wire `computeStockAmplio()` en acceptance de OC
- `StockAmplioIndicator` component
- Atomic reservation via `runTransaction` (Pitfall 3-B)
- No-cache rule en stock views (Pitfall 3-C)
- Cloud Function `resumenStock` aggregation (primer uso de functions)
- Auto-creación de `requerimiento` para Comex

### Phase 10: Aviso a Facturación + Auto-Ticket + Presupuestos Partes/Mixto/Ventas
**Scope:**
- Cierre del circuito: `CIERRE_ADMINISTRATIVO` → `solicitudesFacturacion.create()` + `sendAvisoFacturacionEmail()`
- Auto-ticket desde presupuesto con `clienteId` guard (Pitfall 2-E)
- Implementación tipos restantes: partes, mixto (básico), ventas
- Todos los tipos con PDF + mail

### Phase 11: Excel Exports + Playwright E2E Suite
**Scope:**
- Pure function exports (presupuestos, OCs pendientes, solicitudes facturación)
- Playwright circuits cubriendo full pipeline + branches
- Firestore emulator con `clearFirestoreData()` entre suites
- `expect.poll()` para asserts async (Cloud Function stock aggregation)
- `page.route()` mocks para Gmail/Maps (no side effects)

---

## Pre-Conditions & Watch Out For

### Must happen before Phase 6:
- **Data migration** — tickets con clienteId null y contactos planos (Phase 5)
- **Zone/km decision** — 30-min sesión con equipo comercial AGS
- **Blaze plan activation** — confirmar billing antes de functions/ bootstrap
- **runTransaction discipline** — introducir en services críticos ANTES de agregar concurrencia

### Top pitfalls elevados:
- **1-A** — Precios cacheados en presupuestos viejos quedan desactualizados → usar snapshot policy
- **2-D** — Race conditions multi-usuario → runTransaction en transiciones
- **2-E** — `.catch(console.error)` silencia fallos → logging + retry explícito
- **3-A** — Doble conteo stock (revisar fórmula líneas 252-258 de presupuestosService)
- **5-A** — OAuth token expirado → invertir orden: enviar mail antes de cambiar estado
- **7-A** — clienteId null en tickets viejos → migración batch pre-condición

---

## Open Questions (must resolve before roadmap locks)

1. **Zone/km breakpoints** — definir AMBA / Interior BA / Interior país boundaries en sesión con equipo comercial (30 min)
2. **Blaze plan** — confirmar Firebase billing plan activation antes de Phase 0 `functions/` bootstrap
3. **`tipoCambioSnapshot` policy** — ¿cuándo se bloquea el TC de MIXTA? ¿Date of `enviado`? ¿`oc_recibida`? Decisión de negocio
4. **`personalService.getByRole()` exists?** — verificar antes de Phase 5; alternativa: `VITE_FACTURACION_EMAIL` env fallback
5. **E2E emulator feasibility** — confirmar Firestore emulator configurable para Playwright antes de Phase 6
6. **SLA de OC no recibida** — 5 días estándar industria; ¿customizable por cliente o valor global?
7. **Facturación parcial** — ¿existen acuerdos con algunos clientes? Si sí, simplificar scope o diferir a v2.1

---

## Confidence Assessment

| Area | Level |
|------|-------|
| Q2C lifecycle (estados de presupuesto) | HIGH — Dynamics 365 + Salesforce FSL verified |
| ATP stock formula | HIGH — Microsoft Docs + industry standard |
| Client-side trigger pattern | HIGH — existing `presupuestosService → leadsService` proven |
| Stock computation | HIGH — existing `_generarRequerimientosAutomaticos()` analyzed |
| Km pricing pattern | LOW — extrapolated, requires AGS commercial decision |
| Mail pipeline | HIGH — existing gmailService + contrato flow validated |
| Migration pitfalls | HIGH — real data issues already detected (clienteId null) |
| Playwright patterns | MEDIUM — setup no existe aún; based on 2026 best practices |
