# AGS Plataform — Análisis Exhaustivo del Sistema

**Fecha:** 2026-06-04
**Versión actual sistema-modular:** v1.6.0
**Milestone activo:** v2.0 — Circuito Comercial Completo
**Branch:** `main` (limpio)

---

## Tabla de contenidos

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Estado global por aplicación](#2-estado-global-por-aplicación)
3. [Planning — estado de fases v2.0](#3-planning--estado-de-fases-v20)
4. [sistema-modular — por módulo](#4-sistema-modular--por-módulo)
5. [reportes-ot — por área](#5-reportes-ot--por-área)
6. [portal-ingeniero — por feature](#6-portal-ingeniero--por-feature)
7. [Cross-cutting concerns](#7-cross-cutting-concerns)
8. [Cobertura de tests](#8-cobertura-de-tests)
9. [Despliegues pendientes](#9-despliegues-pendientes)
10. [Issues críticos (P0)](#10-issues-críticos-p0)
11. [Recomendaciones y próximos pasos](#11-recomendaciones-y-próximos-pasos)
12. [Apéndice — punch list](#12-apéndice--punch-list)

---

## 1. Resumen ejecutivo

| Métrica | Valor |
|---|---|
| Apps en monorepo | 3 (sistema-modular + reportes-ot + portal-ingeniero) + `@ags/shared` |
| Versión sistema-modular | v1.6.0 (Electron + auto-update) |
| Despliegue reportes-ot / portal | Vercel (PWA desde `main`) |
| Fases planificadas | 18 (Phases 1-4 = v1.0 shipped; Phases 5-18 = v2.0 en progreso) |
| Fases completadas | 11/18 (61%) |
| Plans completados | 79/82 (96%) |
| Requirements pendientes | 21 (10 Phase 6 deferred + 3 Phase 7 + 5 TEST + 2 REV + 1 STKP) |
| Tests unit GREEN | 67/67 (último check 2026-05-29) |
| Tests rules GREEN | 10/10 (emulador Firestore) |
| Issues críticos abiertos (P0) | 5 |
| Punch list findings | ~120 (Wave A ≈ 20 P0) |

**Estado funcional global**: el sistema cubre end-to-end el flujo comercial (ticket → presupuesto → OT → reporte → cierre admin → facturación) con las apps las tres en producción. El milestone v2.0 está al 96% de plans pero 61% de fases — quedan Phase 17 (OC paridad), Phase 18 (importaciones liquidación), Phase 11 (E2E CI formal), Phase 7 (per_incident + token-first mail) y Phase 6 (pricing engine, diferida).

**Lo crítico que NO ven los KPIs**:
- **MailQueue consumer nunca desplegado** → mails de cierre admin no salen, UI miente con verde optimista.
- **Upload silent-fail en reportes-ot** → reportes pueden quedar FINALIZADO sin `pdfUrl`.
- **Hardening Firestore Fase 1**: código mergeado, **deploy pendiente** (gate manual del usuario).
- **Página pública `/equipo/{agsId}` no existe** → bloquea Fase 1 del QR roadmap.
- **Página de Phase 7 OAuth token-first**: 0/2 plans — riesgo de presupuesto en estado inconsistente si OAuth falla.

---

## 2. Estado global por aplicación

| App | Estado | Cobertura | Bugs activos | Próximas mejoras |
|---|---|---|---|---|
| **sistema-modular** | Maduro, en producción v1.6.0 | 29 páginas, 49 servicios, 66 hooks, 35+ módulos | mailQueue no desplegado; Phase 7 incompleto | Phase 17 (OC paridad), Phase 18 (NCM liquidación) |
| **reportes-ot** | Maduro, frozen surface | 23.4k LOC, 39 componentes, 14 hooks, 7 servicios | Upload silent-fail (P0), branch mobile no mergeada | Merge `feat/protocol-wizard-mobile`, fix upload |
| **portal-ingeniero** | Estable, evolución activa | 15 páginas, 14 hooks, 10 services, ~6.3k LOC | Sin tests, `firebaseService.ts` monolito 1326 LOC | Split por colección, iOS push hardening |
| **@ags/shared** | Estable, types + helpers | Tipos centralizados, helpers RBAC | Drift menor (qfDocumentosService duplicado en 2 apps) | Extract Wave B duplications |

---

## 3. Planning — estado de fases v2.0

### 3.1 Fases completadas (11/18)

| Phase | Nombre | Plans | Cerrada |
|---|---|---|---|
| 1 | Stock Reservas + Requerimientos + OC | 7/7 | v1.0 — 2026-04-10 |
| 2 | Comex Importaciones y Despachos | 6/6 | v1.0 — 2026-04-10 |
| 3 | Presupuestos Plantillas Texto | 7/7 | v1.0 (gap closure 03-03..07 lagged in roadmap text, work landed) |
| 4 | Presupuestos Anexo Consumibles | 6/6 | v1.0 — 2026-04-10 |
| 9 | Stock ATP Extendido | 3/3 | 2026-04-22 (STKP-02 cloud function live pero req sin flipear) |
| 10 | Presupuestos Partes/Mixto/Ventas | 7/7 | 2026-04-25 |
| 12 | Esquema Facturación + Anticipos | 8/8 | 2026-04-26 |
| 13 | Stock Equivalencias compra↔uso | 8/8 | 2026-05-15 |
| 14 | Stock Patrones BOM | 8/9 + 1 cancelled | 2026-05-24 (BOM-07 cancelled — domain model mismatch) |
| 15 | Venta Loaner espejo a stock | 4/4 | 2026-05-24 |
| 16 | Entregas Visor de Cumplimiento | 5/6 done; **16-06 awaiting UAT** | Paused 2026-05-29 |

### 3.2 Fases pendientes (7/18)

| Phase | Nombre | Plans | Estado | Acción |
|---|---|---|---|---|
| 5 | Pre-condiciones | 3/4 | Casi cerrada | Marcar PREC-03 como complete (functions/ workspace ya existe) |
| 6 | Catálogo Servicios + Precios | 0/6 | **DEFERRED** post-v2.0 | Decisión 2026-04-20; 4 anclajes lockeados |
| 7 | Presupuesto per_incident + token-first mail | 0/2 | Plan files exist; ROADMAP unchecked | **Cerrar pre-cutover** (Sprint 1 acordado) |
| 8 | Estados + OC + Flujo Automático | 5/6 | FLOW-01..07 complete; checkboxes lag | Reconciliar ROADMAP |
| 11 | Suite E2E Playwright CI | 0/4 | NO ARRANCADA | Plan + emulador wiring + CI integration |
| 17 | OC Paridad con presupuestos | 0 plans | Folder vacía | `/gsd:plan-phase 17` |
| 18 | Importaciones Liquidación NCM | 0 plans | Folder vacía | `/gsd:plan-phase 18` |

### 3.3 Requirements pendientes (21 totales)

- **CSVC-01..05, PRIC-01..05** (10) — Phase 6 deferred
- **PTYP-01, FMT-01, FMT-02** (3) — Phase 7
- **REV-01, REV-02** (2) — Revisiones
- **STKP-02** (1) — Cloud Function `updateResumenStock` (live en prod pero req sin flipear)
- **TEST-01..05** (5) — Phase 11
- **PREC-03** — ambiguous, posiblemente ya completo

---

## 4. sistema-modular — por módulo

### Módulos completos / maduros (~95%)

| Módulo | Detalle |
|---|---|
| **Clientes** | CRUD, contactos estructurados, validación CUIT batch AFIP, flags contrato/trazabilidad |
| **Establecimientos** | CRUD multi-sector, geocoding + autocomplete Google Places, validación masiva direcciones |
| **Tipos de Equipo / Plantillas** | Catálogo con seed inicial 7 plantillas, editor jerárquico, matching por substring |
| **QF Documentos** | Iteración 1 entregada, CRUD por familia QF/QI/QD/QP, numeración + historial inline |
| **Loaners** | CRUD + Phase 15 venta espejo a stock transaccional |
| **Entregas Visor** | Phase 16 cerrada (semáforo, ETA, cadena PresupuestoItem→Req→OC→Importación) |
| **Calificación Proveedores** | CRUD + modal de evaluación |
| **Tickets / Leads** | Refactor completo, multi-rol, áreas, prioridades, auto-asignación por área, timeline |

### Módulos con gaps significativos

#### Equipos (Sistemas / Módulos / GC Ports) — ~85%
- **Gap crítico**: página pública `/equipo/{agsVisibleId}` **NO EXISTE** → bloquea Fase 1 QR roadmap. Los stickers QR ya impresos llevan a un dominio sin página.
- Portal cliente para ver equipos propios — Fase 2 QR, no implementado.

#### Órdenes de Trabajo (OT) — ~90%
- Lifecycle completo end-to-end con flag `stockDeducido` correcto (decisión `project_cutover_v2_circuito_comercial.md`).
- **Gap crítico**: mail de cierre admin nunca sale (mailQueue consumer no desplegado).
- Cosecha automática items→OT: **decisión MANUAL** (no es gap).
- Phase 8 auto-derivaciones FLOW-01..07 implementadas (checkbox de roadmap lag).

#### Presupuestos — ~85%
- Tipo `contrato` cerrado end-to-end (cuotas MIXTA, plantillas auto-match, PDF moderno).
- Tipos `servicio/partes/mixto/ventas` operativos (Phase 10).
- **Gap**: Phase 7 token-first OAuth → 0/2 plans. Riesgo de estado inconsistente si OAuth falla durante envío.
- Cosecha items→OT diferida post-cutover.

#### Stock — ~95%
- Sub-módulos masivos completos: artículos, unidades, posiciones, minikits, reservas, requerimientos, OC, importaciones, ATP extendido, asignaciones a ingenieros, remitos, equivalencias, patrones BOM, loaners venta espejo, entregas visor.
- **Gaps**: Phase 18 NCM (0 plans), Phase 17 OC paridad (0 plans).
- **Feedback**: ArticulosList falta columna "Stock actual" (usar `articulo.resumenStock?.disponible` ya denormalizado).

#### Agenda — ~85%
- Grid semanal con DnD, sync con OT/ticket, navegación por teclado.
- **Gap**: `AgendaPage.tsx` 568 líneas (sobre budget 250) — candidato a refactor.
- Vista mobile no implementada.

#### Biblioteca de Tablas — ~85%
- Editor con tabs Columnas/Filas/Reglas, import JSON, sub-tablas por instancia (tipos OK).
- **Gap**: rendering de sub-tablas por instancia en CatalogTableView de reportes-ot (`project_instance_subtables.md`).

#### RBAC — ~70%
- 6 roles + multi-rol + overrides per-user funcional.
- **Gaps**: roles `admin_contable`, `cliente`, `proveedor` pending. Sin UI per-module permission editor.

#### Contratos — ~70%
- CRUD + modal crear + flag `enContrato` a nivel sistema.
- **Gap**: auto-activación desde presupuesto contrato aceptado NO implementada.
- Tarifas preferenciales: Phase 6 diferida.

#### Facturación — ~75%
- Phase 12 cuotas + esquema + anticipos completo.
- **Gap**: aviso por mail bloqueado por mailQueue.
- **Gap**: Phase 17 OC paridad sin arrancar.

#### Fichas Propiedad — ~85%
- Multi-item con remitos de devolución (overlay PDF), fotos ingreso/egreso.
- **Gaps**: wire derivación a proveedor desde `FichaDerivacionSection`; listado/detalle de remitos generados; calibración fina coords overlay PDF.

#### OC / Compras — ~80%
- OCList/OCEditor/OCDetail + transition status + vincular importaciones.
- **Gap**: Phase 17 — PDF OC, useEnviarOC (token-first), auto-derivación a comex, audit events.

#### Importaciones — ~85%
- Phase 2 complete: editor con prefill desde OC, secciones aduana/embarque/gastos, prorrateo.
- **Gap**: Phase 18 — alícuotas NCM, liquidación CIF, factor importación per item.

### Otros módulos secundarios
Dashboard, Pendientes, Vehículos, Dispositivos, Instrumentos, Columnas, Ingreso Empresas, Consumibles por Módulo, Personal — todos funcionales sin gaps documentados.

---

## 5. reportes-ot — por área

**Convención**: app frozen surface (`.claude/rules/reportes-ot.md`). Edits requieren `CLAUDE_ALLOW_REPORTES_OT=1`.

### Pipeline PDF — ESTABLE
- 4 etapas: Hoja 1 (html2pdf) → Protocolos (html2canvas per-page + pdf-lib) → Fotos → Certs/Trazab → Merge.
- Split en 2 archivos cuando hay protocolo adjunto.
- Workarounds frágiles documentados (overflow:hidden + border-radius, font tags del RichTextEditor).

### Catalog Views — ESTABLE
- 7 componentes: Table (2563 LOC), Checklist (857), Text (206), Cover (350), Signatures (158), PaginatedPreview (749), ProtocolSection (453).
- Glue chain UP-shift implementado (resuelve bug histórico OT 40001.85).

### SignaturePad — RESUELTO 2026-06-02
- Bug "firma fugada" entre reportes resuelto via `signaturePadGeneration` counter + `key` remount.
- Pendiente: verificación E2E en tablet real.

### Blank Preview Mode — ESTABLE
- Modo para enviar protocolo en blanco al cliente, vacía datos del equipo/contacto, conserva tablas + brand line.

### Mobile / Protocol Wizard — PENDIENTE MERGE
- Branch `feat/protocol-wizard-mobile` con accordion cards mobile-first.
- Memoria dice "lista para merge"; rama existe localmente pero no mergeada.

### Auth — ESTABLE
- Google Sign-In **siempre con popup** (no redirect, evita bug cookies cross-origin mobile).
- WebAuthn (passkeys) implementado contra Cloud Functions `/api/webauthn/*`.

### Email "Enviar por Mail" — RESUELTO + TESTS
- handleFinalSubmit reestructurado en 3 etapas, bandera `delivered` evita falso éxito.
- Registro `enviadoPorEmail` en cada intento (éxito, fallo Gmail, size-limit).
- 3/3 tests verdes.

### Upload silent-fail — **ABIERTO P0**
- En `usePDFGeneration.ts:855-857` y `1003-1005`: catch traga error de upload con `console.warn`.
- Resultado: OT queda FINALIZADO sin `pdfUrl` ni carpeta `reports/`; UI muestra "Éxito".
- Síntoma: portal-ingeniero historial manda a la app reportes-ot en vez del PDF.
- **NO RESUELTO**.

### MailQueue consumer — **ABIERTO P0**
- `processMailQueue` vive en `apps/reportes-ot/functions/src/mailer.ts` (paquete `reportes-ot-functions`).
- `firebase.json` raíz despliega otro paquete (`functions/`) que no procesa la cola.
- Resultado: mails de cierre admin nunca salen. UI marca verde optimista.
- Bugs adicionales si se desplegara: destinatario incorrecto, body con huecos.

### Trazabilidad — ESTABLE
- Solo instrumentos (no patrones, columnas, ingenieros). Orden cert→trazab por instrumento.

### FCM Notifications
- reportes-ot NO es PWA con SW propio (no manifest, no SW registrado).
- Cloud Function `notifications.ts` vive bajo reportes-ot pero su consumo es desde portal-ingeniero.

---

## 6. portal-ingeniero — por feature

### Mis Reportes Pendientes — ESTABLE
- Dos buckets (borrador + sin_empezar), admin ve todos.
- Incluye OTs sin empezar con `creadoPor.uid`, IDs equipo y tipoServicio.

### Agenda mobile — ESTABLE
- Lista mobile + grid desktop para admin. Subscribe a `agendaEntries`.
- Resolución dual `usuarios ↔ ingenieros` por mismatch histórico de IDs.

### Tickets — ESTABLE pero excede budget
- `LeadsPage.tsx` (508 LOC) y `LeadDetailPage.tsx` (393 LOC) violan budget 250.
- Filtros URL + modales completos + visibilidad RBAC + auto-asignación por área.

### Notificaciones FCM — Frágil en iOS
- SW único en `/firebase-messaging-sw.js` (Firebase compat 11.8.1 — drift menor con SDK 12.11).
- **Issue**: iOS revoca tokens silenciosamente cada pocas semanas (workaround: re-toggle).
- **Hardening pendiente**: `Urgency: 'high'` + `TTL` en `notifications.ts` server-side.

### Firma remota / Perfil — ESTABLE
- Firma persistente en `usuarios/{uid}.firmaBase64`.
- Decisión cerrada 2026-05-14: `onClientSignature` asigna a UNA persona (no copia paralela a Esteban).

### Historial — ESTABLE (post-fixes 2026-06)
- Merge `ordenes_trabajo` + `reportes` con enriquecimiento de `pdfUrl`, `protocolPdfUrl`, `enviadoPorEmail`.
- Fix timezone fechas + fix subscribe enrichment recientes.

### Auth — ESTABLE
- Google Sign-In popup + `indexedDBLocalPersistence` + fallback browser.
- Restringido a `@agsanalitica.com`.

### Layout / PWA — Instalable, sin offline real
- BottomNav mobile (Reportes · Pendientes · Tickets · Agenda · Más).
- **Gap**: theme_color del manifest sigue en `#4f46e5` (indigo legacy), debería ser teal.
- **Gap**: no hay offline support real — la PWA es instalable pero queda dependiente de red.

### Otros
- **Viáticos**: CRUD gastos con transacciones multi-tablet, totales por medio de pago.
- **Recepción**: wizard de captura de equipos con IndexedDB offline queue (admin + admin_soporte).
- **QF Documentos**: replica de sistema-modular (admin + admin_ing_soporte).
- **OT Detail flow paralelo**: existe `OTDetailPage` + `useOTForm` + `pdfGenerator.ts` local que coexiste con iframe a reportes-ot — candidato a deprecar o documentar mejor.

### Gaps transversales del portal
1. **Sin tests** en toda la app (no vitest/jest/playwright).
2. **`firebaseService.ts` monolito 1326 LOC** mezclando ~11 servicios — split por colección recomendado.
3. **Manifest theme indigo legacy** — branding inconsistente.
4. **OT flow duplicado** entre `OTDetailPage` local y iframe reportes-ot.
5. **SW Firebase compat 11.8.1** vs SDK 12.11 — drift menor.

---

## 7. Cross-cutting concerns

### 7.1 Firestore hardening
- **Fuente única**: `firestore.rules` + `firestore.indexes.json` en root.
- **Fase 1**: código mergeado en commit `16b4b31`, tests emulador 10/10 GREEN. **DEPLOY PENDIENTE** (gate manual del usuario, ventana low-traffic).
- **Fase 2 (DEFERRED)**: token-based remote signing.
- **Fase 3 (DEFERRED)**: lockdown público equipo page.

### 7.2 Release pipeline
- sistema-modular ships como `.exe` con electron-updater + GitHub Releases por tag.
- Actual: **v1.6.0** (commit `e2d98f8`).
- **Pitfall conocido**: drift package.json ↔ pnpm-lock.yaml en cualquier workspace rompe deploys Vercel de TODAS las apps.

### 7.3 Sentry monitoring
- Integrado 2026-05-31 vía `@sentry/electron@^7.13.0` (plataforma Electron, no React).
- DSN literal en `electron/main.cjs`; renderer hereda por IPC.
- Errors only (`tracesSampleRate: 0`).

### 7.4 MailQueue consumer
- **NUNCA DESPLEGADO** — `processMailQueue` vive en paquete no deployado.
- Impacto: mails de cierre admin OT + aviso facturación nunca salen.
- UI marca verde optimista (`avisoAdminEnviado:true`) — miente.

### 7.5 Avast CA / SSL scanning
- Bloquea `firebase login --reauth` y `firebase deploy`.
- Fix: `$env:NODE_EXTRA_CA_CERTS="$env:USERPROFILE\corp-ca-bundle.pem"` antes.
- Para `pnpm install`: `NODE_OPTIONS=--use-system-ca` (Node 24).

### 7.6 QR Digital Identity roadmap
- **Fase 1 (MVP)**: `agsVisibleId` + `QREquipoModal` IMPLEMENTADOS. Página pública `/equipo/{agsVisibleId}` **NO EXISTE** → bloquea cierre Fase 1.
- **Fases 2-4** (portal cliente, ticketing, inteligencia): no iniciadas.

### 7.7 Pricing strategy
- Phase 6 DIFERIDA post-v2.0 (decisión 2026-04-20).
- 4 anclajes lockeados:
  1. Zonas geográficas = informativas, sin tarifa.
  2. `tieneContrato:boolean` en cliente = badge visual sin tabla precios.
  3. Descuentos = manuales editando precio unitario.
  4. NO "reset to base tariff" button.

### 7.8 Cutover v2.0
- Decisiones consolidadas:
  - Stock deduction = cierre admin (no técnico).
  - Migración histórica = post-cutover.
  - Doble carga durante transición = aceptada.
  - Items→OT = MANUAL.
  - Phase 12 esquemas facturación = BLOCKER pre-cutover (cerrado).
- **Sprint 1 acordado**: (1) FINALIZADO button, (2) OAuth email prod verify, (3) items→OT decision, (4) Phase 12 decision.

### 7.9 Recepción móvil & Remitos devolución
- **Recepción móvil**: implementada en portal-ingeniero con IndexedDB offline queue (admin + admin_soporte).
- **Remitos devolución**: Fase 1 (devolución) IMPLEMENTADA. Pendientes:
  - Wire derivación a proveedor desde FichaDerivacionSection.
  - Listado/detalle de remitos generados.
  - Calibración fina coordenadas overlay PDF.

---

## 8. Cobertura de tests

### 8.1 Tests unitarios — 67/67 GREEN
Last full-suite check: 2026-05-29 (Plan 16-06 SUMMARY).

| Suite | Tests | Phase |
|---|---|---|
| `cuotasFacturacion.test.ts` | 9/9 | 12 |
| `equivalencias.test.ts` | 9/9 | 13 |
| `stockAmplio.test.ts` | 5/5 | 9 |
| `ventaLoaner.test.ts` | 5/5 | 15 |
| `patronBom.test.ts` | 18/18 | 14 |
| `entregasResolver.test.ts` | nuevo | 16 |
| `useSendReportByEmail.test.ts` (reportes-ot) | 3/3 | — |

### 8.2 Tests Firestore rules — 10/10 GREEN
- `tests/firestore-rules/rules.test.ts` (via `pnpm test:rules` + emulator).

### 8.3 Tests E2E Playwright
- **14 circuit specs** + **per-phase specs** (Phase 9, 13, 14).
- Phase 14: 13/13 GREEN pre-validados, re-run bloqueado por TLS corporate proxy (issue ambiental, no funcional).
- **Phase 11 (suite E2E formal con emulador + CI) NO ARRANCADA** — 0/4 plans, 5 reqs Pending.

### 8.4 Tests por app
- **sistema-modular**: ~46 unit tests + 14 E2E specs. Cobertura ~15% del código (módulos cubiertos: stock equivalencias/BOM/ATP/loaner/entregas + cuotas facturación).
- **reportes-ot**: ~30/31 tests vitest (2 rojos preexistentes ajenos: authService.test, LoginScreen.test).
- **portal-ingeniero**: **0 tests configurados**.

### 8.5 UAT pendiente
- **Phase 16 UI-01..UI-05**: automated 67/67 GREEN, manual sign-off pendiente. Bump recomendado: MINOR.
- **Phase 7**: docs existen, plans no commiteados.

---

## 9. Despliegues pendientes

| Item | App | Bloqueo | Prioridad |
|---|---|---|---|
| Firestore rules + storage Fase 1 | Firebase | Gate manual (ventana low-traffic) | **Alta** |
| Vercel rebuild reportes-ot | Vercel | Signature leak fix (commit `4fdbf6c`) + email fix (`519acf7`) | Alta |
| Vercel rebuild portal-ingeniero | Vercel | Timezone + enviadoPorEmail enrichment | Media |
| sistema-modular MINOR release | GitHub Releases | Phase 16 UAT pendiente | Media |
| MailQueue consumer | Functions | Portar `processMailQueue` a paquete deployado + corregir destinatario/body + SMTP | **Alta** |

---

## 10. Issues críticos (P0)

### 10.1 MailQueue consumer no desplegado
- **Impacto**: mails de cierre admin OT + aviso facturación NUNCA salen. UI miente con verde optimista.
- **Componentes afectados**: `otService.cerrarAdministrativamente()`, `useOTDetail.ts:169` (verde optimista), `mailQueue` collection acumula docs `pending`.
- **Fix de fondo**: portar `processMailQueue` de `apps/reportes-ot/functions/` a `functions/` raíz + corregir destinatario (`data.to` vs `ADMIN_EMAIL` env), corregir body (campos faltantes), configurar SMTP, reflejar estado real en UI.

### 10.2 Upload silent-fail en reportes-ot
- **Impacto**: OT queda FINALIZADO sin `pdfUrl` si upload falla por mala conexión. UI muestra "Éxito".
- **Síntoma user-facing**: portal historial manda a la app reportes-ot en vez del PDF.
- **Fix de fondo**: (1) NO marcar FINALIZADO antes de que `pdfUrl` exista en Storage; (2) NO tragar error de upload — mostrar error real + estado "pendiente de subida"; (3) cola de reintento al recuperar conexión.
- Requiere `CLAUDE_ALLOW_REPORTES_OT=1`.

### 10.3 Página pública `/equipo/{agsId}` no existe
- **Impacto**: stickers QR ya impresos llevan a dominio sin página. Bloquea cierre Fase 1 QR roadmap.
- **Fix**: implementar página pública en portal-ingeniero (ruta ya reservada, página vacía) con info mínima + form "Solicitar Soporte" que crea Lead.

### 10.4 Phase 7 token-first OAuth incompleto
- **Impacto**: si OAuth falla durante envío de presupuesto, puede dejar estado inconsistente.
- **Fix**: implementar 0/2 plans Phase 7 — `markEnviado()` atómico + EnviarPresupuestoModal con etapas auth/pdf/send/update.

### 10.5 Hardening Firestore Fase 1 sin deployar
- **Impacto**: rules abiertas vs hardened — exposición.
- **Estado**: código mergeado, tests emulador 10/10 GREEN.
- **Fix**: `firebase deploy --only firestore:rules,storage` en ventana low-traffic (requiere workaround Avast CA).

---

## 11. Recomendaciones y próximos pasos

### 11.1 Acciones inmediatas (esta semana)
1. **Deploy Fase 1 Firestore rules** en ventana low-traffic (con `NODE_EXTRA_CA_CERTS` set).
2. **Vercel rebuild** reportes-ot + portal-ingeniero — varios fixes esperando.
3. **UAT Phase 16** (UI-01..05) y release MINOR de sistema-modular.
4. **Portar `processMailQueue`** al paquete `functions/` raíz + smoke test con un cierre admin de prueba.

### 11.2 Próximas 2-4 semanas (Sprint 1 cutover)
1. **Phase 7** — cerrar token-first OAuth (2 plans).
2. **Fix upload silent-fail** en reportes-ot (requiere `CLAUDE_ALLOW_REPORTES_OT=1`).
3. **Página pública `/equipo/{agsId}`** — implementar Fase 1 QR completa.
4. **Phase 11** — plan + emulador wiring para suite E2E formal con CI.

### 11.3 Mediano plazo (cierre v2.0)
1. **Phase 17** — OC paridad con presupuestos (PDF + email + status + audit).
2. **Phase 18** — Importaciones liquidación NCM + factor.
3. **Wave A del punch list** — los 8 bugs P0 identificados en review.
4. **Refactor**:
   - `firebaseService.ts` de portal-ingeniero — split por colección.
   - `LeadsPage.tsx` + `LeadDetailPage.tsx` — aplicar budget 250.
   - `AgendaPage.tsx` sistema-modular — extraer subcomponentes.

### 11.4 Post v2.0
1. **Phase 6** — pricing engine (con los 4 anclajes lockeados).
2. **QR Fases 2-4** — portal cliente, ticketing técnico, inteligencia de servicio.
3. **iOS push hardening** — `Urgency: 'high'` + `TTL`.
4. **Wave B** — extraer duplicaciones a `@ags/shared`.

---

## 12. Apéndice — punch list

`.planning/review/PUNCH-LIST.md` documenta ~120 findings distribuidos en 5 reviews. **Wave A (~20 P0)** incluye bugs silenciosos de alta visibilidad:

| ID | Issue | Impacto |
|---|---|---|
| A1 | `WorkOrder.budgets[]` guarda doc-ID en vez de `numero` (`OTNew.tsx:203`) | Rompe sync de finalización; mail al contable dice "sin presupuesto vinculado" |
| A2 | Auto-reserva dead code en `presupuestosService.ts:331-478` (return en :357) | Dos presupuestos pueden reservar la misma unidad |
| A3 | `ordenesTrabajoService.create` permite silent overwrite | OT existente se sobrescribe si typeás número repetido |
| A4 | `useCreateOTForm` double-creates child `.01` | OTs duplicadas |
| A5 | `stockService.liberar()` no transaccional (TODO documentado) | Race con `reservar()` puede perder reservas |
| A6 | Calificación-Proveedores types faltan en `@ags/shared` | Bloquea build |
| A7 | `Ticket.createdAt` required pero 3 callers omiten; `Ticket.updatedBy` no existe pero `useLeadNotifications:117` lo usa | Bugs runtime |
| A8 | `ModuloId` no incluye `'calificacion-proveedores'` | Inconsistencia |

**Wave B (drift between apps)** — ~7 duplicaciones a extraer a `@ags/shared`:
- `qfDocumentosService` 200 LOC byte-identical en 2 apps.
- Leads/tickets parsers + migration tables.
- `OT_TO_LEAD_ESTADO`.
- `useUrlFilters`.
- `useResizableColumns`.
- `fcmTokensService` 3 copias.
- `LeadTimeline` ordering diverged entre portal y sistema-modular.

**Wave C** — P1 items donde reglas están escritas pero violadas en N lugares (component-size budget, etc.).

---

## Cierre

El sistema AGS Plataform es maduro y operativo en producción end-to-end, con un milestone v2.0 al 96% de plans pero con **5 issues críticos** y un trabajo de fases restantes (17, 18, 11) que define el cierre real del milestone.

**Lo que más mueve la aguja**: los 5 P0 listados arriba. Cualquier presentación o handoff debe transmitir que esos están abiertos — sobre todo el mailQueue (que tiene síntoma user-facing inmediato: dicen "se mandó" pero no se manda) y el upload silent-fail (data integrity).

**Lo que mejor está**: el core comercial (clientes, equipos, OTs, presupuestos, stock, agenda, tickets, biblioteca de tablas) ya cubre el ciclo completo, con cobertura de tests sólida en los módulos críticos de stock + cuotas.
