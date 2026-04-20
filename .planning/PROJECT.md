# AGS Plataforma

## What This Is

Plataforma comercial integral para AGS Analítica: desde el ingreso de un lead/ticket hasta el aviso de facturación, pasando por presupuestos, órdenes de trabajo, reportes técnicos de campo, stock, comex y planificación. Monorepo con tres apps (sistema-modular administrativo, portal-ingeniero de campo, reportes-ot para técnicos) y paquete compartido.

## Core Value

**Cerrar end-to-end el ciclo comercial** desde la consulta inicial hasta el aviso de facturación — con trazabilidad, estados automáticos y sin datos que se pierdan entre áreas.

## Current Milestone: v2.0 Circuito Comercial Completo

**Goal:** Cerrar el ciclo Ticket → Presupuesto → OC → OT → Facturación con derivaciones automáticas entre áreas, reglas de precios por contrato y distancia, y planificación de stock amplia (disponible + tránsito + reservas + otras órdenes) para decidir si derivar a Importaciones.

**Target features:**
- Catálogo de servicios/categorías con reglas de precio (contrato + rangos km)
- Presupuestos completos para todos los tipos (per_incident, partes, mixto, ventas, contrato)
- Flujo automático: presupuesto sin ticket → auto-crear ticket de seguimiento → llega OC → deriva a crear OT → detecta importación → deriva a Importaciones → aviso a Facturación
- Planificación de stock extendida (no solo disponible — tránsito, reservas, otras OCs)
- Formatos: PDF para todos los tipos de presupuesto, mails de envío, exportables
- Suite E2E Playwright cubriendo el circuito completo y sus branches

**Target plazo:** 2 semanas.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Módulo Stock operativo completo — v1.0 Phase 1 (reservas, movimientos, requerimientos, OC interna)
- ✓ Comex — importaciones y despachos — v1.0 Phase 2 (DUAs, ETA, prorrateo de gastos, ingreso al stock desde importación)
- ✓ Módulo Tickets (leads) — flujo operativo con postas, derivaciones, estados simplificados, QR, Acciones a tomar desde reportes
- ✓ Módulo Clientes/Establecimientos con contactos y sistemas/módulos
- ✓ Módulo Equipos con QR e identidad digital (agsVisibleId)
- ✓ Módulo Presupuestos — Contrato cerrado end-to-end (catálogo tiposEquipoPlantillas, editor jerárquico Sector→Sistema→Servicios, PDF teal con cuotas asimétricas, envío por mail OAuth)
- ✓ Reportes técnicos de campo (reportes-ot) con generación PDF split (Hoja 1 + protocolos + fotos)
- ✓ Biblioteca de Tablas (protocolCatalog / tableCatalog) con publicación
- ✓ Portal Ingeniero (tickets, OTs, adjuntos, contactos editables)
- ✓ RBAC híbrido (rol por defecto + overrides por usuario)
- ✓ Sidebar desktop MVP con feature flag VITE_DESKTOP_MVP

### Active

<!-- Current milestone v2.0. -->

Ver [REQUIREMENTS.md](./REQUIREMENTS.md) para el desglose completo por categoría.

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- **Facturación real en Bejerman** — el milestone cierra con "aviso a Facturación" (ticket + mail). La emisión fiscal queda en Bejerman, integración futura.
- **Listado exhaustivo de servicios** — la infra soporta todos los servicios; la carga masiva del catálogo se hace incremental post-lanzamiento.
- **Cosecha Items→OT automática** — diseño documentado en `.claude/plans/presupuestos-item-a-ot-design.md` pero no entra en v2.0. La OT se crea con prefill manual desde presupuesto aceptado.
- **Email entrante parseado para OC** — OC cliente se carga siempre manual (número + adjunto).
- **Auto-update del instalable desktop** — primero estabilizar v2.0 y lanzar build instalable; electron-updater y feature flags remotos son milestone posterior.

## Context

**Estado tecnológico:**
- Monorepo pnpm: `apps/sistema-modular` (admin + Electron), `apps/portal-ingeniero` (campo), `apps/reportes-ot` (técnicos — UI sagrada), `packages/shared`
- React 19 + TypeScript + Tailwind CSS
- Firebase: Firestore + Storage + Auth + Messaging (FCM)
- OAuth Gmail para envío de mails
- Design system: Editorial Teal (teal-700, Newsreader, JetBrains Mono)

**Estado del producto:**
- v1.0 cerrada con stock + comex + contratos operativos
- Plataforma en uso interno por equipo AGS
- Lanzamiento desktop MVP planificado tras v2.0

**Usuarios:**
- Admin / Admin Soporte — gestión completa desde sistema-modular
- Vendedores / Seguimiento comercial — crean presupuestos, siguen OC del cliente
- Ingenieros — consultan su inventario, toman tickets/OTs desde portal-ingeniero
- Coordinadores OT — generan OTs desde presupuestos aceptados
- Importaciones / Comex — reciben requerimientos desde presupuestos
- Administración / Facturación — reciben aviso para cargar en Bejerman

## Constraints

- **Tech stack:** React 19 + TypeScript + Tailwind + Firebase (definido por v1.0 — no cambiar)
- **Timeline:** 2 semanas para v2.0 desde inicio del milestone
- **Design system:** Editorial Teal — tokens definidos en `design_system.md`
- **Component size:** Máximo 250 líneas por componente React (regla dura)
- **Firestore:** nunca escribir `undefined` (usar `null` o omitir campo); usar `deepCleanForFirestore()` para nested
- **List filters:** `useUrlFilters` obligatorio en todas las list pages (persistencia en URL)
- **reportes-ot:** NO tocar nada visual/funcional (UI sagrada en producción con técnicos)
- **Pendiente externo:** Facturación fiscal depende de Bejerman — integración futura

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Monorepo pnpm con 3 apps + shared | Separar responsabilidades (admin vs campo vs técnico) sin duplicar tipos | ✓ Funciona bien |
| Firestore como única fuente | Tiempo real + offline + permisos granulares por reglas | ✓ Bien |
| OAuth Gmail para emails | Los usuarios envían desde su propia casilla; conforme a cumplimiento AGS | ✓ Implementado en contratos |
| CUIT normalizado como id de Cliente | Evitar duplicados, id estable entre sistemas | ⚠️ Revisar — algunos tickets viejos tienen clienteId null |
| Design system Editorial Teal | Diferenciación visual + consistencia entre apps | ✓ Bien |
| Ticket vs Lead (rename) | "Ticket" es más amplio y cubre soporte + ventas | ⚠️ Rename archivos todavía pendiente |
| Electron como distribución desktop | Usuarios esperan app instalable, no solo web | — Pending validation post v2.0 |
| Feature flag VITE_DESKTOP_MVP | Lanzar MVP solo con módulos maduros; desbloquear gradual | — Pending validation post v2.0 |

---
*Last updated: 2026-04-19 after iniciar milestone v2.0 Circuito Comercial Completo*
