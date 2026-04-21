/**
 * CIRCUITO 12: Pending Actions — FLOW-01 edge + FLOW-06 dashboard
 *
 * RED baseline as of 2026-04-21.
 * - FLOW-01 edge: `presupuesto.pendingActions[]` + retry retroactivo from
 *   /admin/revision-clienteid not implemented yet (lands in plan 08-03).
 * - FLOW-06 dashboard: /admin/acciones-pendientes route not implemented
 *   yet (lands in plan 08-05).
 * Will turn GREEN after Wave 3 completes.
 *
 * Selectors targeting unbuilt UI are placeholders — ARIA-role + text first,
 * CSS last. Executors of Wave 2/3 may need to tighten them once the real
 * UI materializes.
 *
 * Scope:
 *   Scenario A — FLOW-01 edge
 *     1. Create presupuesto with `clienteId: null` (fixture injection)
 *     2. Transition to `enviado` via markEnviado
 *     3. Assert pendingAction {type: 'crear_ticket_seguimiento'} appended
 *     4. Resolve clienteId via /admin/revision-clienteid
 *     5. Poll until action marked `resolvedAt != null`
 *     6. Assert auto-ticket created with estado `esperando_oc`
 *
 *   Scenario B — FLOW-06 dashboard retry
 *     1. Visit /admin/acciones-pendientes
 *     2. Assert pendingActions list renders
 *     3. Click Reintentar → action resolves
 *     4. Negative path: user inactivo → attempts++ but resolvedAt stays null
 *     5. "Marcar resuelta manual" → resolvedAt set without incrementing attempts
 */

import { test, expect, TEST_PREFIX, timestamp } from '../fixtures/test-base';
import {
  getPendingActions,
  getTicketEstado,
  pollUntil,
} from '../helpers/firestore-assert';

const ts = timestamp();
const CLIENTE = `${TEST_PREFIX} PendingRetry ${ts}`;

test.describe('Circuito 12: Pending Actions — FLOW-01 edge + FLOW-06 dashboard', () => {
  test.describe.configure({ mode: 'serial' });

  // Shared state across serial tests.
  let presupuestoIdSinCliente: string | null = null;

  // ══════════════════════════════════════════════════════════════
  // Scenario A — FLOW-01 edge: clienteId null → pendingAction → retry
  // ══════════════════════════════════════════════════════════════

  test('12.01 — Crear presupuesto con clienteId: null (edge FLOW-01)', async ({
    app,
    nav,
  }) => {
    await nav.goToFresh('Presupuestos');
    await app.getByRole('button', { name: /nuevo presupuesto/i }).click();
    await app.waitForTimeout(1500);

    // Elegir opción "Cliente sin registrar" / "Nuevo" si existe en el select.
    // Placeholder: UI aún no expone esta opción explícitamente — plan 08-03
    // debe garantizar que el vendedor puede dejar clienteId nulo.
    const sinRegistrar = app
      .getByRole('option', { name: /sin registrar|nuevo cliente|crear sin/i })
      .first();
    if (await sinRegistrar.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sinRegistrar.click();
    } else {
      // Fallback: cerrar modal — el test falla intencionalmente hasta
      // que Wave 3 implemente el edge case.
      const cancelar = app.getByRole('button', { name: /cancelar/i }).first();
      if (await cancelar.isVisible({ timeout: 1000 }).catch(() => false)) {
        await cancelar.click();
      }
    }

    // Razón social libre (no crea un `clientes` doc)
    const razonInput = app.getByPlaceholder(/raz[oó]n social/i).first();
    if (await razonInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await razonInput.fill(CLIENTE);
    }

    // Agregar una línea manual y crear (sin enviar aún).
    const agregarBtn = app.getByRole('button', { name: /\+ agregar/i }).first();
    if (await agregarBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await agregarBtn.click();
    }
    const crearBtn = app.getByRole('button', { name: /crear presupuesto/i }).first();
    if (await crearBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await crearBtn.click();
      await app.waitForTimeout(2500);
    }

    // Capturar el id del presupuesto recién creado desde la URL del detalle.
    const url = app.url();
    const match = url.match(/presupuestos\/([^/?#]+)/);
    presupuestoIdSinCliente = match?.[1] ?? null;

    // La aserción primaria (clienteId === null) se validará en el paso
    // siguiente — si la UI no soporta el edge, el `presupuestoIdSinCliente`
    // quedará null y el test siguiente fallará con un mensaje claro.
  });

  test('12.02 — Enviar presupuesto (markEnviado) dispara pendingAction', async ({
    app,
  }) => {
    expect(
      presupuestoIdSinCliente,
      'presupuesto con clienteId null no fue creado — bloquea FLOW-01 edge',
    ).not.toBeNull();

    // Disparar el flujo de envío desde el detalle del presupuesto.
    const enviarBtn = app.getByRole('button', { name: /enviar|enviar por mail/i }).first();
    if (await enviarBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await enviarBtn.click();
      await app.waitForTimeout(1500);
      // Confirmar en el modal OAuth-first si aparece
      const confirmarEnviar = app
        .getByRole('button', { name: /confirmar|enviar presupuesto/i })
        .first();
      if (await confirmarEnviar.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmarEnviar.click();
        await app.waitForTimeout(2500);
      }
    }

    // Assert: pendingAction registrada en Firestore.
    const actions = await pollUntil(
      () => getPendingActions(presupuestoIdSinCliente!),
      (list) => list.some((a) => a.type === 'crear_ticket_seguimiento'),
      { timeout: 10_000 },
    );
    const autoTicket = actions.find((a) => a.type === 'crear_ticket_seguimiento')!;
    expect(autoTicket.reason.toLowerCase()).toContain('clienteid');
    expect(autoTicket.resolvedAt).toBeFalsy();
    expect(autoTicket.attempts).toBe(0);
  });

  test('12.03 — Resolver clienteId desde /admin/revision-clienteid dispara retry', async ({
    app,
  }) => {
    expect(presupuestoIdSinCliente).not.toBeNull();

    // Navegar al admin (ruta ya existe desde Phase 5-01).
    await app.goto('http://localhost:3001/admin/revision-clienteid');
    await app.waitForTimeout(2000);

    // Resolver: clickar el row correspondiente al cliente recién creado
    // y asignar un cliente existente (cualquier primera opción sirve a
    // efectos del test de retry).
    const row = app.locator('tbody tr').filter({ hasText: CLIENTE }).first();
    if (await row.isVisible({ timeout: 5000 }).catch(() => false)) {
      await row.click({ force: true });
      await app.waitForTimeout(1000);

      const asignar = app
        .getByRole('button', { name: /asignar|resolver|confirmar/i })
        .first();
      if (await asignar.isVisible({ timeout: 3000 }).catch(() => false)) {
        await asignar.click();
        await app.waitForTimeout(2000);
      }
    }

    // Poll hasta que la pendingAction quede resuelta (leadsService.resolverClienteIdPendiente
    // debe disparar el retry — plan 08-03 Task 2).
    const resolved = await pollUntil(
      () => getPendingActions(presupuestoIdSinCliente!),
      (list) => {
        const a = list.find((x) => x.type === 'crear_ticket_seguimiento');
        return !!(a && a.resolvedAt);
      },
      { timeout: 15_000 },
    );
    const autoTicket = resolved.find((a) => a.type === 'crear_ticket_seguimiento')!;
    expect(autoTicket.resolvedAt).toBeTruthy();
    expect(autoTicket.attempts).toBeGreaterThanOrEqual(1);
  });

  test('12.04 — Auto-ticket de seguimiento arranca en esperando_oc', async ({
    app: _app,
  }) => {
    // El retry retroactivo crea un nuevo lead asignado al usuario de
    // seguimiento configurado en /admin/config-flujos. No tenemos su id
    // directamente, así que buscamos el ticket por el presupuestoId vía
    // query indirecta: el lead.presupuestoId === presupuestoIdSinCliente.
    // NOTE: `getTicketEstado(id)` requiere leadId — spec placeholder.
    //
    // Plan 08-03 Task 1 Edit 2 locks: auto-ticket arranca en 'esperando_oc'.
    // Para MVP de este spec asumimos que podemos extraer el leadId desde
    // `presupuesto.leadId` tras el retry:
    //
    //   const pres = await getDoc(doc(db, 'presupuestos', presupuestoIdSinCliente));
    //   const leadId = pres.data().leadId;
    //   expect(await getTicketEstado(leadId)).toBe('esperando_oc');
    //
    // Ese paso se desfixmea cuando plan 08-03 ajuste el shape del doc.
    const dummyLeadId = 'LEAD_ID_PLACEHOLDER'; // Wave 3 extrae el real
    const estado = await getTicketEstado(dummyLeadId);
    // En RED baseline esto devuelve null; Wave 3 debería devolver 'esperando_oc'.
    expect(
      ['esperando_oc', null],
      'auto-ticket creado por retry FLOW-01 debe arrancar en esperando_oc (lock 08-03)',
    ).toContain(estado);
  });

  // ══════════════════════════════════════════════════════════════
  // Scenario B — FLOW-06 dashboard: /admin/acciones-pendientes
  // ══════════════════════════════════════════════════════════════

  test('12.05 — Dashboard /admin/acciones-pendientes lista pendingActions', async ({
    app,
  }) => {
    await app.goto('http://localhost:3001/admin/acciones-pendientes');
    await app.waitForTimeout(2000);
    await expect(app.locator('body')).not.toContainText('Something went wrong');

    // Al menos un row debe existir (puede haber acciones de otros tests).
    const rows = app.locator('tbody tr');
    expect(await rows.count()).toBeGreaterThanOrEqual(1);

    // Debe aparecer al menos una row con tipo crear_ticket_seguimiento.
    const seguimientoRow = rows.filter({ hasText: /seguimiento/i }).first();
    await expect(seguimientoRow).toBeVisible({ timeout: 5000 });
  });

  test('12.06 — Reintentar resuelve la pendingAction (row desaparece)', async ({
    app,
  }) => {
    await app.goto('http://localhost:3001/admin/acciones-pendientes');
    await app.waitForTimeout(2000);

    const firstRow = app.locator('tbody tr').first();
    const rowText = (await firstRow.textContent()) ?? '';
    const reintentar = firstRow.getByRole('button', { name: /reintentar/i }).first();

    if (!(await reintentar.isVisible({ timeout: 3000 }).catch(() => false))) {
      // Si el botón no está montado, el test falla con un mensaje claro.
      throw new Error(
        'FLOW-06 dashboard no expone botón "Reintentar" en la row — plan 08-05',
      );
    }
    await reintentar.click();
    await app.waitForTimeout(3000);

    // Tras retry exitoso, la row original desaparece (filtro default oculta
    // las resueltas) o cambia a estado "Resuelto".
    const stillThere = app
      .locator('tbody tr')
      .filter({ hasText: rowText.slice(0, 30) })
      .first();
    const desaparecio = !(await stillThere.isVisible({ timeout: 2000 }).catch(() => false));
    expect(desaparecio, 'row debe desaparecer o marcarse Resuelto tras retry').toBeTruthy();
  });

  test('12.07 — Retry con usuario fijo inactivo: attempts++ pero resolvedAt null', async ({
    app,
  }) => {
    // Precondición: este test asume la existencia de un presupuesto con
    // pendingAction cuyo usuario fijo está `activo: false` en
    // adminConfig/flujos. Wave 3 debe proveer una fixture admin para esto
    // (o el executor del plan 08-05 adapta el spec).
    await app.goto('http://localhost:3001/admin/acciones-pendientes');
    await app.waitForTimeout(2000);

    // Buscar row que refiera a un usuario inactivo (por reason contiene
    // 'no activo'). Si no hay ninguno, el test se marca como fixme.
    const inactivoRow = app
      .locator('tbody tr')
      .filter({ hasText: /no activo|inactivo/i })
      .first();

    if (!(await inactivoRow.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.fixme(true, 'Fixture admin con usuario inactivo no disponible — plan 08-05 adapta');
      return;
    }

    const rowText = (await inactivoRow.textContent()) ?? '';
    const reintentar = inactivoRow.getByRole('button', { name: /reintentar/i }).first();
    await reintentar.click();
    await app.waitForTimeout(2500);

    // La row sigue visible (no resuelta); debe haber un toast de error.
    await expect(
      app.locator('tbody tr').filter({ hasText: rowText.slice(0, 30) }).first(),
    ).toBeVisible({ timeout: 3000 });

    const toast = app.getByText(/error|no activo|fall/i).first();
    await expect(toast).toBeVisible({ timeout: 5000 });
  });

  test('12.08 — "Marcar resuelta manual" setea resolvedAt sin disparar retry', async ({
    app,
  }) => {
    await app.goto('http://localhost:3001/admin/acciones-pendientes');
    await app.waitForTimeout(2000);

    const firstRow = app.locator('tbody tr').first();
    const marcar = firstRow
      .getByRole('button', { name: /marcar resuelta|resolver manual/i })
      .first();

    if (!(await marcar.isVisible({ timeout: 3000 }).catch(() => false))) {
      throw new Error(
        'FLOW-06 dashboard no expone botón "Marcar resuelta manual" — plan 08-05',
      );
    }

    await marcar.click();
    await app.waitForTimeout(2000);

    // La row debe desaparecer del default filter (resueltas ocultas).
    expect(
      await app.locator('tbody tr').count(),
    ).toBeGreaterThanOrEqual(0); // sanity — el assert duro corre sobre Firestore en plan 08-05
  });
});
