# AGS Plataforma — Módulo Stock

## Vision
Sistema integral de gestión de stock para AGS Analítica. Cubre desde el alta de mercadería, reservas para clientes, movimientos internos, inventario de ingenieros, requerimientos de compra y generación de órdenes de compra a proveedores.

## Stack
- React 19 + TypeScript + Tailwind CSS
- Firebase Firestore (backend)
- Monorepo pnpm: `apps/sistema-modular`, `packages/shared`
- Design system: Editorial Teal (teal-700, Newsreader, JetBrains Mono)

## Non-negotiables
- NUNCA escribir `undefined` en Firestore (usar `null` o omitir el campo)
- Máximo 250 líneas por componente React — extraer hooks/subcomponentes si se pasa
- Todos los filtros de listas usan `useUrlFilters`, nunca `useState`
- Cada mutación de stock genera un `MovimientoStock` inmutable (audit trail)
- No tocar nada en `apps/reportes-ot`

## Users
- Admin / Admin Soporte: gestión completa del stock
- Ingenieros: consultan su inventario, informan consumos (el admin los carga)
