/**
 * Unit tests — resolución del landing según el sidebar visible del usuario.
 *
 * Run with: pnpm --filter @ags/sistema-modular test:landing
 *   (tsx src/components/layout/__tests__/landingPath.test.ts)
 *
 * node:assert/strict, sin framework (mismo patrón que presupuestosMetrics.test.ts).
 * `landingPath.ts` sólo importa el TIPO NavItem, así que el test no arrastra
 * React/Firebase.
 */

import assert from 'node:assert/strict';
import type { NavItem } from '../navigation.js';
import { resolveLandingPath, DEFAULT_LANDING, FALLBACK_LANDING } from '../landingPath.js';

// ── Fixtures: sub-árboles como los devuelve useNavigation() ya filtrado ───────

const clientes: NavItem = { name: 'Clientes', path: '/clientes', modulo: 'clientes' };
const tickets: NavItem = { name: 'Tickets', path: '/leads', modulo: 'leads' };
const presupuestos: NavItem = { name: 'Presupuestos', path: '/presupuestos', modulo: 'presupuestos' };
const qf: NavItem = { name: 'Documentos QF', path: '/qf-documentos' };

const comercial = (children: NavItem[]): NavItem => ({ name: 'Comercial', path: '#comercial', children });
const stock = (children: NavItem[]): NavItem => ({ name: 'Stock', path: '/stock', children });

// ── Tests ────────────────────────────────────────────────────────────────────

// 1. Usuario con acceso a clientes → mantiene el landing histórico.
assert.equal(
  resolveLandingPath([comercial([clientes, tickets]), qf]),
  DEFAULT_LANDING,
  'con /clientes visible el landing no debe cambiar',
);

// 2. Usuario SIN clientes (rol administracion) → primera pantalla de su sidebar.
assert.equal(
  resolveLandingPath([comercial([tickets, presupuestos]), qf]),
  '/leads',
  'sin /clientes debe entrar a la primera hoja visible',
);

// 3. Grupos sintéticos (#) no son destino navegable; se baja a la hoja.
assert.equal(
  resolveLandingPath([
    stock([{ name: 'Operación', path: '#stock-operacion', children: [{ name: 'Unidades', path: '/stock/unidades', modulo: 'stock-operacion' }] }]),
  ]),
  '/stock/unidades',
  'un grupo sintético no puede ser el landing',
);

// 4. Sidebar vacío → fallback sin gate de módulo.
assert.equal(resolveLandingPath([]), FALLBACK_LANDING, 'sin nav visible debe caer al fallback');

console.log('✅ landingPath: 4/4 OK');
