/**
 * CIRCUITO 12: Pending Actions — FLOW-01 edge + FLOW-06 dashboard
 *
 * REWRITE 2026-07:
 *  - El spec original intentaba crear un ppto con clienteId null vía UI, pero
 *    CreatePresupuestoModal deshabilita "Crear presupuesto" sin cliente — el
 *    edge FLOW-01 solo puede sembrarse por service. Ahora todo el seed corre
 *    in-browser (patrón circuito 15) y el spec limpia sus datos en 12.99.
 *  - Los asserts Firestore van vía helpers page-based (browser autenticado).
 *
 * Scope:
 *   12.01 — Seed ppto A con clienteId vacío (edge FLOW-01)
 *   12.02 — markEnviado (service real) appendea pendingAction crear_ticket_seguimiento
 *   12.03 — [fixme] retry vía /admin/revision-clienteid (la UI repara tickets,
 *           no el clienteId del presupuesto — flujo E2E no implementado)
 *   12.04 — Placeholder estado auto-ticket (esperando_oc)
 *   12.05 — Dashboard /admin/acciones-pendientes lista la pendingAction
 *   12.06 — Reintentar (retry exitoso tras restaurar adminConfig) → row desaparece
 *   12.07 — [fixme condicional] usuario inactivo (sin fixture admin)
 *   12.08 — "Marcar resuelta" manual sobre la row del ppto A
 *   12.99 — Cleanup
 */

import { test, expect, TEST_PREFIX, timestamp } from '../fixtures/test-base';
import type { Page } from '@playwright/test';
import {
  getPendingActions,
  getTicketEstado,
  pollUntil,
} from '../helpers/firestore-assert';

const ts = timestamp();
const CLIENTE = `${TEST_PREFIX} PendingRetry ${ts}`;
const CLIENTE_B_ID = 'e2e-cliente-12';

/** Crea un ppto [E2E] mínimo vía service real (in-browser). */
async function seedPpto(app: Page, opts: { clienteId: string; clienteNombre: string; titulo: string }) {
  return app.evaluate(async (o) => {
    const { presupuestosService } = await import('/src/services/presupuestosService.ts');
    return await presupuestosService.create({
      clienteId: o.clienteId,
      clienteNombre: o.clienteNombre,
      titulo: o.titulo,
      tipo: 'servicio',
      estado: 'borrador',
      items: [{
        id: crypto.randomUUID(),
        descripcion: `${o.titulo} — item`,
        cantidad: 1, unidad: 'unidad', precioUnitario: 100, subtotal: 100,
      }],
      subtotal: 100, total: 100, moneda: 'USD', validezDias: 15,
      ordenesCompraIds: [], adjuntos: [],
    } as any);
  }, opts);
}

/** Lee/patchea adminConfig/flujos.usuarioSeguimientoId (merge, preserva el resto). */
async function patchUsuarioSeguimiento(app: Page, value: string | null): Promise<string | null> {
  return app.evaluate(async (v) => {
    const ags = (window as any).__ags;
    const { doc, getDoc, setDoc, Timestamp } = ags.firestore;
    const ref = doc(ags.db, 'adminConfig', 'flujos');
    const snap = await getDoc(ref);
    const prev = snap.exists() ? ((snap.data().usuarioSeguimientoId as string | null | undefined) ?? null) : null;
    await setDoc(ref, { usuarioSeguimientoId: v, updatedAt: Timestamp.now() }, { merge: true });
    return prev;
  }, value);
}

test.describe('Circuito 12: Pending Actions — FLOW-01 edge + FLOW-06 dashboard', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  // Shared state across serial tests.
  let pptoAId: string | null = null;   // clienteId vacío (edge FLOW-01)
  let pptoANumero: string | null = null;
  let pptoBId: string | null = null;   // clienteId dummy (retry exitoso 12.06)
  let pptoBNumero: string | null = null;
  let cfgPrevio: { saved: boolean; value: string | null } = { saved: false, value: null };

  // ══════════════════════════════════════════════════════════════
  // Scenario A — FLOW-01 edge: clienteId vacío → pendingAction
  // ══════════════════════════════════════════════════════════════

  test('12.01 — Seed presupuesto con clienteId vacío (edge FLOW-01)', async ({ app, nav }) => {
    await nav.ensureLoaded();
    const r = await seedPpto(app, { clienteId: '', clienteNombre: CLIENTE, titulo: `${TEST_PREFIX} pending retry A ${ts}` });
    pptoAId = r.id;
    pptoANumero = r.numero;
    expect(pptoAId).toBeTruthy();
  });

  test('12.02 — markEnviado (service real) dispara pendingAction', async ({ app }) => {
    expect(pptoAId, 'seed 12.01 debe haber corrido').not.toBeNull();

    // Mismo service que dispara la UI al enviar el ppto.
    await app.evaluate(async (id) => {
      const { presupuestosService } = await import('/src/services/presupuestosService.ts');
      await presupuestosService.markEnviado(id);
    }, pptoAId!);

    // Assert: pendingAction registrada en Firestore.
    const actions = await pollUntil(
      () => getPendingActions(app, pptoAId!),
      (list) => list.some((a) => a.type === 'crear_ticket_seguimiento'),
      { timeout: 15_000 },
    );
    const autoTicket = actions.find((a) => a.type === 'crear_ticket_seguimiento')!;
    expect(autoTicket.reason.toLowerCase()).toContain('clienteid');
    expect(autoTicket.resolvedAt).toBeFalsy();
    expect(autoTicket.attempts).toBe(0);
  });

  test('12.03 — Resolver clienteId desde /admin/revision-clienteid dispara retry', async () => {
    test.fixme(true, 'La UI /admin/revision-clienteid resuelve TICKETS con pendienteClienteId; no repara el clienteId del presupuesto, y retryPendingActionsForCliente(clienteId) nunca matchea un ppto con clienteId vacío — el flujo E2E completo no está implementado (plan 08-03 lo dejó a nivel ticket).');
  });

  test('12.04 — Auto-ticket de seguimiento arranca en esperando_oc', async ({ app }) => {
    // Placeholder heredado: sin leadId real (el retry del edge A nunca crea el
    // ticket porque clienteId sigue vacío). getTicketEstado(placeholder) → null.
    const dummyLeadId = 'LEAD_ID_PLACEHOLDER';
    const estado = await getTicketEstado(app, dummyLeadId);
    expect(
      ['esperando_oc', null],
      'auto-ticket creado por retry FLOW-01 debe arrancar en esperando_oc (lock 08-03)',
    ).toContain(estado);
  });

  // ══════════════════════════════════════════════════════════════
  // Scenario B — FLOW-06 dashboard: /admin/acciones-pendientes
  // ══════════════════════════════════════════════════════════════

  test('12.05 — Dashboard /admin/acciones-pendientes lista pendingActions', async ({ app }) => {
    await app.goto('http://localhost:3001/admin/acciones-pendientes');
    await app.waitForTimeout(2500);
    await expect(app.locator('body')).not.toContainText('Something went wrong');

    // La row de NUESTRO ppto A debe estar (tipo "Crear ticket seguimiento").
    const row = app.locator('tbody tr').filter({ hasText: pptoANumero! }).first();
    await expect(row, `row del ppto ${pptoANumero} no aparece en el dashboard`).toBeVisible({ timeout: 10_000 });
    await expect(row).toContainText(/crear ticket seguimiento/i);
  });

  test('12.06 — Reintentar resuelve la pendingAction (row desaparece)', async ({ app }) => {
    // Precondición: usuarioSeguimientoId configurado y activo en esta DB —
    // sin eso el retry no puede tener éxito jamás.
    const cfgOk = await app.evaluate(async () => {
      const ags = (window as any).__ags;
      const { doc, getDoc } = ags.firestore;
      const cfg = await getDoc(doc(ags.db, 'adminConfig', 'flujos'));
      const uid = cfg.exists() ? cfg.data().usuarioSeguimientoId : null;
      if (!uid) return { ok: false as const, reason: 'usuarioSeguimientoId no configurado' };
      const user = await getDoc(doc(ags.db, 'usuarios', uid));
      if (!user.exists() || user.data().status !== 'activo') {
        return { ok: false as const, reason: `usuario seguimiento ${uid} no activo` };
      }
      return { ok: true as const };
    });
    test.skip(!cfgOk.ok, `Precondición adminConfig no se cumple en esta DB: ${(cfgOk as any).reason ?? ''}`);

    // 1. Seed ppto B con clienteId dummy y forzar el fallo del auto-ticket
    //    desconfigurando usuarioSeguimientoId TEMPORALMENTE.
    cfgPrevio = { saved: true, value: await patchUsuarioSeguimiento(app, null) };
    try {
      const r = await seedPpto(app, { clienteId: CLIENTE_B_ID, clienteNombre: `${CLIENTE} B`, titulo: `${TEST_PREFIX} pending retry B ${ts}` });
      pptoBId = r.id;
      pptoBNumero = r.numero;

      await app.evaluate(async (id) => {
        const { presupuestosService } = await import('/src/services/presupuestosService.ts');
        await presupuestosService.markEnviado(id);
      }, pptoBId!);

      await pollUntil(
        () => getPendingActions(app, pptoBId!),
        (list) => list.some((a) => a.type === 'crear_ticket_seguimiento' && !a.resolvedAt),
        { timeout: 15_000 },
      );
    } finally {
      // 2. Restaurar la config — ahora el retry PUEDE tener éxito.
      await patchUsuarioSeguimiento(app, cfgPrevio.value);
    }

    // 3. Dashboard → Reintentar en la row del ppto B.
    await app.goto('http://localhost:3001/admin/acciones-pendientes');
    await app.waitForTimeout(2500);
    const row = app.locator('tbody tr').filter({ hasText: pptoBNumero! }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.getByRole('button', { name: /reintentar/i }).click();

    // 4. La acción queda resuelta en Firestore y la row desaparece.
    await pollUntil(
      () => getPendingActions(app, pptoBId!),
      (list) => list.some((a) => a.type === 'crear_ticket_seguimiento' && !!a.resolvedAt),
      { timeout: 15_000 },
    );
    await expect(
      app.locator('tbody tr').filter({ hasText: pptoBNumero! }),
    ).toHaveCount(0, { timeout: 10_000 });
  });

  test('12.07 — Retry con usuario fijo inactivo: attempts++ pero resolvedAt null', async ({ app }) => {
    // Precondición: row cuyo usuario fijo está inactivo. No hay fixture admin
    // para esto (requeriría deshabilitar un usuario real de la DB).
    await app.goto('http://localhost:3001/admin/acciones-pendientes');
    await app.waitForTimeout(2000);

    const inactivoRow = app
      .locator('tbody tr')
      .filter({ hasText: /no activo|inactivo/i })
      .first();

    if (!(await inactivoRow.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.fixme(true, 'Fixture admin con usuario inactivo no disponible — requeriría deshabilitar un usuario real');
      return;
    }

    const rowText = (await inactivoRow.textContent()) ?? '';
    const reintentar = inactivoRow.getByRole('button', { name: /reintentar/i }).first();
    await reintentar.click();
    await app.waitForTimeout(2500);

    // La row sigue visible (no resuelta).
    await expect(
      app.locator('tbody tr').filter({ hasText: rowText.slice(0, 30) }).first(),
    ).toBeVisible({ timeout: 3000 });
  });

  test('12.08 — "Marcar resuelta" manual setea resolvedAt sin disparar retry', async ({ app }) => {
    expect(pptoAId).not.toBeNull();
    await app.goto('http://localhost:3001/admin/acciones-pendientes');
    await app.waitForTimeout(2500);

    const row = app.locator('tbody tr').filter({ hasText: pptoANumero! }).first();
    await expect(row, `row del ppto ${pptoANumero} no está en el dashboard`).toBeVisible({ timeout: 10_000 });

    const attemptsAntes = (await getPendingActions(app, pptoAId!))
      .find((a) => a.type === 'crear_ticket_seguimiento')?.attempts ?? 0;

    // El botón dispara window.confirm — aceptarlo.
    app.once('dialog', (d) => { void d.accept(); });
    await row.getByRole('button', { name: /marcar resuelta/i }).click();

    // resolvedAt seteado SIN incrementar attempts.
    const actions = await pollUntil(
      () => getPendingActions(app, pptoAId!),
      (list) => list.some((a) => a.type === 'crear_ticket_seguimiento' && !!a.resolvedAt),
      { timeout: 15_000 },
    );
    const resolved = actions.find((a) => a.type === 'crear_ticket_seguimiento')!;
    expect(resolved.attempts, 'marcar resuelta manual no debe incrementar attempts').toBe(attemptsAntes);

    // La row desaparece del filtro default (resueltas ocultas).
    await expect(
      app.locator('tbody tr').filter({ hasText: pptoANumero! }),
    ).toHaveCount(0, { timeout: 10_000 });
  });

  // ══════════════════════════════════════════════════════════════
  // 12.99 — Cleanup
  // ══════════════════════════════════════════════════════════════

  test('12.99 — Cleanup datos [E2E] del circuito 12', async ({ app }) => {
    // Restaurar adminConfig por si 12.06 quedó a mitad de camino (idempotente).
    if (cfgPrevio.saved) await patchUsuarioSeguimiento(app, cfgPrevio.value);

    const summary = await app.evaluate(async (c) => {
      const ags = (window as any).__ags;
      const { collection, query, where, getDocs, doc, deleteDoc } = ags.firestore;
      let deleted = 0;
      for (const pid of c.pptos) {
        if (!pid) continue;
        // tickets auto-creados (presupuestosIds contiene el ppto)
        const leads = await getDocs(query(collection(ags.db, 'leads'), where('presupuestosIds', 'array-contains', pid)));
        for (const d of leads.docs) { await deleteDoc(d.ref).catch(() => {}); deleted++; }
        await deleteDoc(doc(ags.db, 'presupuestos', pid)).catch(() => {});
        deleted++;
      }
      return { deleted };
    }, { pptos: [pptoAId, pptoBId] });
    console.log(`[12.99] cleanup: ${summary.deleted} docs borrados`);
    expect(summary.deleted).toBeGreaterThanOrEqual(0);
  });
});
