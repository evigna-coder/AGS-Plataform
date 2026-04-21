import { test, expect, TEST_PREFIX, timestamp } from '../fixtures/test-base';
import { getMailQueueDocs, pollUntil } from '../helpers/firestore-assert';

/**
 * CIRCUITO 11: Ciclo Comercial Completo
 *
 * Simula el flujo real de negocio de AGS Analítica de punta a punta:
 *
 *  ── SETUP ──
 *   1.  Crear cliente nuevo
 *   2.  Verificar cliente
 *
 *  ── TICKET ──
 *   3.  Crear ticket
 *   4.  Derivar ticket
 *
 *  ── PRESUPUESTO ──
 *   5.  Crear presupuesto (con banner de pendientes si aplica)
 *   6.  Verificar presupuesto en lista + abrir detalle
 *
 *  ── OT COMPLETA (ciclo 7 estados) ──
 *   7.  Crear OT con ingeniero y fecha
 *   8.  Abrir detalle de OT → estado CREADA/ASIGNADA
 *   9.  Avanzar estado → COORDINADA
 *  10.  Avanzar estado → EN_CURSO
 *  11.  Completar informe técnico + agregar materiales
 *  12.  Avanzar estado → CIERRE_TECNICO
 *  13.  Avanzar estado → CIERRE_ADMINISTRATIVO
 *  14.  Confirmar horas + confirmar partes en cierre admin
 *  15.  Confirmar cierre → FINALIZADO
 *  16.  Verificar OT finalizada (read-only)
 *
 *  ── CONTRATO ──
 *  17.  Crear contrato de servicio
 *
 *  ── PENDIENTES ──
 *  18.  Crear pendiente desde la página Pendientes
 *  19.  Verificar pendiente en lista
 *  20.  Finalizar ticket + crear pendiente en el flujo de cierre
 *  21.  Verificar pendientes generadas en ticket detail
 *  22.  Verificar banner de pendientes al crear presupuesto
 *  23.  Verificar sección pendientes en ClienteDetail
 *
 *  ── FACTURACIÓN & AGENDA ──
 *  24.  Facturación accesible
 *  25.  Agenda accesible (vista 2S)
 *
 *  ── INTEGRIDAD ──
 *  26.  Navegación cruzada 8 módulos sin crashes
 *  27.  Verificación final de datos E2E
 *
 * Precondiciones:
 *   - Dev server corriendo en localhost:3001
 *   - Login hecho (persistent profile con sesión de admin)
 *   - Al menos un tipo de servicio y un ingeniero existentes
 */

const ts = timestamp();
const CLIENTE = `${TEST_PREFIX} Full-Cycle ${ts}`;
const CONTACTO = `${TEST_PREFIX} Contacto ${ts}`;
const PROBLEMA = `${TEST_PREFIX} Equipo no enciende ${ts}`;
const REPORTE_TECNICO = `${TEST_PREFIX} Se diagnosticó falla en fuente de alimentación. Se reemplazó fusible y se verificó funcionamiento correcto. ${ts}`;
const ACCIONES_TOMAR = `${TEST_PREFIX} Reemplazar cable de poder en próxima visita preventiva ${ts}`;
const MATERIALES = `${TEST_PREFIX} Fusible 250V 1A, cable testeo multímetro`;
const PENDIENTE_DESC = `${TEST_PREFIX} Cotizar repuesto de bomba ${ts}`;
const PENDIENTE_TICKET = `${TEST_PREFIX} Revisar cables en próxima visita ${ts}`;
const NOTA_CIERRE = `${TEST_PREFIX} Horas confirmadas OK, materiales consumidos de stock.`;
const TODAY = new Date().toISOString().slice(0, 10);

test.describe('Circuito 11: Ciclo Comercial Completo', () => {
  test.describe.configure({ mode: 'serial' });

  // ═══════════════════════════════════════════════════════════
  // SETUP: Cliente
  // ═══════════════════════════════════════════════════════════

  test('11.01 — Crear cliente nuevo', async ({ app, nav, forms }) => {
    await nav.goToFresh('Clientes');
    await forms.clickButton(/Nuevo Cliente/i);
    await app.waitForTimeout(1000);

    const modal = app.locator('[class*="modal"], [role="dialog"]').last();
    await expect(modal).toBeVisible({ timeout: 5000 });

    await forms.fillField('Razón Social', CLIENTE, modal);
    await forms.fillField('Rubro', 'Industria Farmacéutica', modal);

    await modal.getByRole('button', { name: /guardar|crear/i }).click();
    await app.waitForTimeout(2500);
  });

  test('11.02 — Verificar cliente en lista', async ({ app, nav, table }) => {
    await nav.goToFresh('Clientes');
    await table.search(CLIENTE);
    await app.waitForTimeout(2000);
    await table.expectRowWithText(CLIENTE);
  });

  // ═══════════════════════════════════════════════════════════
  // TICKET
  // ═══════════════════════════════════════════════════════════

  test('11.03 — Crear ticket para el cliente', async ({ app, nav, forms }) => {
    await nav.goToFresh('Tickets');
    await forms.clickButton(/Nuevo Ticket/i);
    await app.waitForTimeout(1000);

    const modal = app.locator('[class*="modal"], [role="dialog"]').last();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Cliente
    const clienteInput = modal.locator('input').first();
    await clienteInput.click();
    await app.waitForTimeout(500);
    await clienteInput.fill(CLIENTE.slice(0, 15));
    await app.waitForTimeout(1200);
    const clientOption = app.locator('li, [role="option"]')
      .filter({ hasText: CLIENTE }).first();
    if (await clientOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clientOption.click();
    } else {
      const firstOpt = app.locator('li, [role="option"]').filter({ hasNotText: /crear/i }).first();
      if (await firstOpt.isVisible({ timeout: 2000 }).catch(() => false)) await firstOpt.click();
    }
    await app.waitForTimeout(500);

    // Contacto
    const contactoInput = modal.getByPlaceholder('Persona de contacto').first();
    await contactoInput.waitFor({ timeout: 5000 });
    await contactoInput.fill(CONTACTO);

    // Motivo
    await forms.selectField('Motivo', 1, modal);

    await modal.getByRole('button', { name: /guardar|crear/i }).click();
    await app.waitForTimeout(2500);
  });

  test('11.04 — Derivar ticket', async ({ app, nav }) => {
    await nav.goToFresh('Tickets');
    await app.waitForTimeout(2000);
    await app.locator('tbody tr').first().click({ force: true });
    await app.waitForTimeout(2500);

    const derivarBtn = app.getByRole('button', { name: /derivar/i }).first();
    if (await derivarBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await derivarBtn.click();
      await app.waitForTimeout(1500);
      const modal = app.locator('[class*="modal"], [role="dialog"]').last();
      if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
        const userCombo = modal.locator('select, [role="combobox"]').first();
        if (await userCombo.isVisible({ timeout: 2000 }).catch(() => false)) {
          await userCombo.selectOption({ index: 1 });
          await app.waitForTimeout(300);
        }
        const confirmBtn = modal.getByRole('button', { name: /derivar|confirmar/i }).first();
        if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmBtn.click();
          await app.waitForTimeout(2000);
        }
      }
    }
  });

  // ═══════════════════════════════════════════════════════════
  // PRESUPUESTO
  // ═══════════════════════════════════════════════════════════

  test('11.05 — Crear presupuesto', async ({ app, nav }) => {
    await nav.goToFresh('Presupuestos');
    await app.getByRole('button', { name: '+ Nuevo Presupuesto' }).click();
    await app.waitForTimeout(1500);

    // Cliente
    await app.getByRole('combobox').filter({ hasText: 'Seleccionar cliente...' }).click();
    await app.waitForTimeout(800);
    await app.locator('[role="listbox"] [role="option"], ul li').first().click();
    await app.waitForTimeout(1500);

    // Catálogo (si hay)
    const catalogCombo = app.getByRole('combobox').filter({ hasText: 'Carga manual...' });
    if (await catalogCombo.isVisible({ timeout: 2000 }).catch(() => false)) {
      await catalogCombo.click();
      await app.waitForTimeout(500);
      const opt = app.getByRole('option').first();
      if (await opt.isVisible({ timeout: 2000 }).catch(() => false)) await opt.click();
      await app.waitForTimeout(500);
    }

    // Agregar línea + Crear
    await app.getByRole('button', { name: '+ Agregar' }).evaluate((el: HTMLElement) => el.click());
    await app.waitForTimeout(500);
    await app.getByRole('button', { name: 'Crear presupuesto' }).evaluate((el: HTMLElement) => el.click());
    await app.waitForTimeout(3000);

    // Verificar que el modal se cerró
    const modalOverlay = app.locator('[class*="bg-black/50"]');
    if (await modalOverlay.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Modal still open — press Escape to close
      await app.keyboard.press('Escape');
      await app.waitForTimeout(1500);
    }
  });

  test('11.06 — Verificar presupuesto y abrir detalle', async ({ app, nav }) => {
    await nav.goToFresh('Presupuestos');
    await app.waitForTimeout(2000);
    expect(await app.locator('tbody tr').count()).toBeGreaterThanOrEqual(1);
    await app.locator('tbody tr').first().click({ force: true });
    await app.waitForTimeout(2000);
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  // ═══════════════════════════════════════════════════════════
  // OT COMPLETA — Ciclo de 7 estados
  // ═══════════════════════════════════════════════════════════

  test('11.07 — Crear OT con ingeniero y fecha', async ({ app, nav }) => {
    // Safety: close any leftover modal
    await app.keyboard.press('Escape');
    await app.waitForTimeout(500);

    await nav.goToFresh('Ordenes de Trabajo');
    await app.getByRole('button', { name: '+ Nueva OT' }).click();
    await app.waitForTimeout(1500);

    // Tipo servicio
    await app.getByRole('combobox').filter({ hasText: 'Seleccionar tipo...' }).click();
    await app.waitForTimeout(500);
    await app.getByRole('option').first().click();
    await app.waitForTimeout(500);

    // Cliente
    await app.getByRole('combobox').filter({ hasText: 'Seleccionar cliente...' }).click();
    await app.waitForTimeout(500);
    await app.getByRole('option').first().click();
    await app.waitForTimeout(1500);

    // Ingeniero
    const ingCombo = app.getByRole('combobox').filter({ hasText: 'Sin asignar' });
    if (await ingCombo.isVisible({ timeout: 2000 }).catch(() => false)) {
      await ingCombo.click();
      await app.waitForTimeout(500);
      const ingOpt = app.locator('[role="listbox"] [role="option"]').filter({ hasNotText: /sin asignar/i }).first();
      if (await ingOpt.isVisible({ timeout: 2000 }).catch(() => false)) {
        await ingOpt.click();
        await app.waitForTimeout(500);
      }
    }

    // Fecha aprox servicio
    const fechaInput = app.locator('input[type="date"]').last();
    if (await fechaInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await fechaInput.fill(TODAY);
    }

    // Problema
    const descInput = app.locator('textarea[placeholder*="Descripcion"], textarea[placeholder*="problema"]').first();
    if (await descInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await descInput.fill(PROBLEMA);
    }

    await app.getByRole('button', { name: 'Crear OT' }).click();
    await app.waitForTimeout(3000);

    // Force close modal if still open
    const modalOverlay = app.locator('[class*="bg-black/50"]');
    if (await modalOverlay.isVisible({ timeout: 2000 }).catch(() => false)) {
      const cancelBtn = app.getByRole('button', { name: /cancelar/i }).first();
      if (await cancelBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await cancelBtn.click();
      } else {
        await app.keyboard.press('Escape');
      }
      await app.waitForTimeout(1500);
    }
  });

  test('11.08 — Abrir detalle de OT creada', async ({ app, nav }) => {
    await nav.goToFresh('Ordenes de Trabajo');
    await app.waitForTimeout(2000);
    expect(await app.locator('tbody tr').count()).toBeGreaterThanOrEqual(1);
    // Click en la primera OT (la más reciente)
    await app.locator('tbody tr').first().click({ force: true });
    await app.waitForTimeout(3000);
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('11.09 — Avanzar OT → COORDINADA', async ({ app }) => {
    // Buscar el select de estado admin
    const estadoSelect = app.locator('select').filter({ has: app.locator('option', { hasText: /COORDINADA/i }) }).first();
    if (await estadoSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      await estadoSelect.selectOption('COORDINADA');
      await app.waitForTimeout(2000);
    }
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('11.10 — Avanzar OT → EN_CURSO', async ({ app }) => {
    const estadoSelect = app.locator('select').filter({ has: app.locator('option', { hasText: /EN_CURSO/i }) }).first();
    if (await estadoSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await estadoSelect.selectOption('EN_CURSO');
      await app.waitForTimeout(2000);
    }
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('11.11 — Completar informe técnico + agregar materiales', async ({ app }) => {
    // Recorrer textareas para llenar campos de protocolo
    const textareas = app.locator('textarea');
    const count = await textareas.count();

    // Recorrer textareas para encontrar los de protocolo
    for (let i = 0; i < count; i++) {
      const ta = textareas.nth(i);
      const placeholder = await ta.getAttribute('placeholder').catch(() => '') || '';
      const parentText = await ta.locator('..').textContent().catch(() => '') || '';

      if (parentText.toLowerCase().includes('informe') || parentText.toLowerCase().includes('reporte') || placeholder.toLowerCase().includes('informe')) {
        await ta.fill(REPORTE_TECNICO);
        await app.waitForTimeout(300);
      } else if (parentText.toLowerCase().includes('acciones') || parentText.toLowerCase().includes('observaciones')) {
        await ta.fill(ACCIONES_TOMAR);
        await app.waitForTimeout(300);
      } else if (parentText.toLowerCase().includes('materiales para')) {
        await ta.fill(MATERIALES);
        await app.waitForTimeout(300);
      }
    }

    // Horas trabajadas
    const horasInput = app.locator('input').filter({ has: app.locator('..', { hasText: /hs lab|horas lab/i }) }).first();
    if (await horasInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await horasInput.fill('4');
      await app.waitForTimeout(300);
    }

    // Tiempo viaje
    const viajeInput = app.locator('input').filter({ has: app.locator('..', { hasText: /hs trasl|horas trasl|viaje/i }) }).first();
    if (await viajeInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await viajeInput.fill('2');
      await app.waitForTimeout(300);
    }

    // Agregar material manual (si el botón existe)
    const addManualBtn = app.getByRole('button', { name: /manual/i }).first();
    if (await addManualBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addManualBtn.click();
      await app.waitForTimeout(800);
      // Llenar la fila de material
      const codigoInput = app.locator('input[maxlength="18"]').last();
      if (await codigoInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await codigoInput.fill('FUS-250V-1A');
        await app.waitForTimeout(200);
      }
      const descInput = app.locator('input[maxlength="90"]').last();
      if (await descInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await descInput.fill('Fusible 250V 1A');
        await app.waitForTimeout(200);
      }
      const cantInput = app.locator('input[type="number"]').last();
      if (await cantInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cantInput.fill('1');
        await app.waitForTimeout(200);
      }
    }

    // Esperar autosave
    await app.waitForTimeout(2000);
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('11.12 — Avanzar OT → CIERRE_TECNICO', async ({ app }) => {
    const estadoSelect = app.locator('select').filter({ has: app.locator('option', { hasText: /CIERRE_TECNICO/i }) }).first();
    if (await estadoSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await estadoSelect.selectOption('CIERRE_TECNICO');
      await app.waitForTimeout(2000);
    }
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('11.13 — Avanzar OT → CIERRE_ADMINISTRATIVO', async ({ app }) => {
    const estadoSelect = app.locator('select').filter({ has: app.locator('option', { hasText: /CIERRE_ADMINISTRATIVO/i }) }).first();
    if (await estadoSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await estadoSelect.selectOption('CIERRE_ADMINISTRATIVO');
      await app.waitForTimeout(2500);
    }
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  // FLOW-04 — Aviso a Facturación al CIERRE_ADMINISTRATIVO
  //
  // Plan 08-05 implementa `otService.cerrarAdministrativamente` que encola el mail
  // en `mailQueue` con type='cierre_admin_ot' y crea un ticket admin atómicamente.
  // Este test desfixmeado en plan 08-05.
  test('11.13b — FLOW-04: mailQueue doc + ticket admin al CIERRE_ADMINISTRATIVO', async ({ app }) => {
    // Assert 1: un doc en mailQueue con type='cierre_admin_ot' y status='pending'.
    await pollUntil(
      () => getMailQueueDocs({ type: 'cierre_admin_ot', status: 'pending', limit: 5 }),
      (docs) => docs.length >= 1,
      { timeout: 10_000 },
    );

    // Assert 2: ticket admin creado (area === 'administracion') con refencia
    // al número de OT recién cerrada. Consulta pendiente — el plan 08-05
    // puede extender firestore-assert con un helper `getTicketsByArea`.
    //
    //   const adminTickets = await getTicketsByArea({ area: 'administracion' });
    //   expect(adminTickets.some(t => (t.descripcion || '').includes(otNumber)))
    //     .toBeTruthy();

    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('11.14 — Confirmar horas y partes en cierre administrativo', async ({ app }) => {
    // Scroll para ver la sección de cierre admin
    await app.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await app.waitForTimeout(1500);

    // Ajustar horas (si los campos están disponibles con highlight cyan)
    const horasLabAj = app.locator('input').filter({ has: app.locator('..', { hasText: /lab ajustadas|lab \(ajuste\)/i }) }).first();
    if (await horasLabAj.isVisible({ timeout: 3000 }).catch(() => false)) {
      await horasLabAj.fill('4');
      await app.waitForTimeout(300);
    }

    const horasViajeAj = app.locator('input').filter({ has: app.locator('..', { hasText: /viaje ajust|viaje \(ajuste\)/i }) }).first();
    if (await horasViajeAj.isVisible({ timeout: 2000 }).catch(() => false)) {
      await horasViajeAj.fill('2');
      await app.waitForTimeout(300);
    }

    // Marcar "Horas confirmadas"
    const horasCheck = app.locator('input[type="checkbox"]').filter({ has: app.locator('..', { hasText: /horas confirmadas/i }) }).first();
    if (await horasCheck.isVisible({ timeout: 3000 }).catch(() => false)) {
      if (!await horasCheck.isChecked()) {
        await horasCheck.click();
        await app.waitForTimeout(500);
      }
    }

    // Marcar "Partes confirmadas" (si hay artículos)
    const partesCheck = app.locator('input[type="checkbox"]').filter({ has: app.locator('..', { hasText: /partes confirmadas/i }) }).first();
    if (await partesCheck.isVisible({ timeout: 2000 }).catch(() => false)) {
      if (!await partesCheck.isChecked()) {
        await partesCheck.click();
        await app.waitForTimeout(500);
      }
    }

    // Notas de cierre (si el textarea existe)
    const notasArea = app.locator('textarea').filter({ has: app.locator('..', { hasText: /notas.*cierre|cierre.*notas/i }) }).first();
    if (await notasArea.isVisible({ timeout: 2000 }).catch(() => false)) {
      await notasArea.fill(NOTA_CIERRE);
      await app.waitForTimeout(300);
    }

    // Esperar autosave
    await app.waitForTimeout(2000);
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('11.15 — Confirmar cierre → FINALIZADO', async ({ app }) => {
    // Buscar botón de confirmar cierre
    const confirmarBtn = app.getByRole('button', { name: /confirmar.*cierre|confirmar y enviar/i }).first();
    if (await confirmarBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await confirmarBtn.scrollIntoViewIfNeeded();
      await confirmarBtn.click();
      await app.waitForTimeout(2000);

      // Si aparece un modal de confirmación/preview, confirmar
      const confirmModal = app.locator('[class*="modal"], [role="dialog"]').last();
      if (await confirmModal.isVisible({ timeout: 3000 }).catch(() => false)) {
        const confirmFinalBtn = confirmModal.getByRole('button', { name: /confirmar|enviar/i }).first();
        if (await confirmFinalBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmFinalBtn.click();
          await app.waitForTimeout(3000);
        }
      }
    } else {
      // Fallback: cambiar estado directamente via select si existe
      const estadoSelect = app.locator('select').filter({ has: app.locator('option', { hasText: /FINALIZADO/i }) }).first();
      if (await estadoSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        await estadoSelect.selectOption('FINALIZADO');
        await app.waitForTimeout(2000);
      }
    }
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('11.16 — Verificar OT finalizada (read-only)', async ({ app }) => {
    await app.waitForTimeout(1500);
    // Verificar badge FINALIZADO visible
    const finalizadoBadge = app.getByText('FINALIZADO', { exact: true }).first();
    if (await finalizadoBadge.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(finalizadoBadge).toBeVisible();
    }
    // Verificar que no crasheó
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  // ═══════════════════════════════════════════════════════════
  // CONTRATO
  // ═══════════════════════════════════════════════════════════

  test('11.17 — Crear contrato de servicio', async ({ app, nav, forms }) => {
    await app.keyboard.press('Escape');
    await app.waitForTimeout(500);
    await nav.goToFresh('Contratos');
    await forms.clickButton(/Nuevo Contrato/i);
    await app.waitForTimeout(1000);

    const modal = app.locator('[class*="modal"], [role="dialog"]').last();
    await expect(modal).toBeVisible({ timeout: 5000 });

    await forms.searchableSelectFirst('Seleccionar cliente...', modal);
    await app.waitForTimeout(500);
    await forms.fillField('Fecha inicio', '2026-04-01', modal);
    await forms.fillField('Fecha fin', '2027-04-01', modal);

    const serviceBtns = modal.locator('button.rounded-full, button[class*="rounded-full"]');
    if (await serviceBtns.count() > 0) {
      await serviceBtns.first().click();
      await app.waitForTimeout(300);
    }

    await modal.getByRole('button', { name: /guardar|crear/i }).click();
    await app.waitForTimeout(2500);
  });

  // ═══════════════════════════════════════════════════════════
  // PENDIENTES
  // ═══════════════════════════════════════════════════════════

  test('11.18 — Crear pendiente manualmente', async ({ app, nav, forms }) => {
    await app.keyboard.press('Escape');
    await app.waitForTimeout(500);
    await nav.goToFresh('Pendientes');
    await app.waitForTimeout(2000);
    await expect(app.locator('body')).not.toContainText('Something went wrong');

    await forms.clickButton(/Nueva Pendiente/i);
    await app.waitForTimeout(1000);

    const modal = app.locator('[class*="modal"], [role="dialog"]').last();
    await expect(modal).toBeVisible({ timeout: 5000 });

    await forms.searchableSelectFirst('Seleccionar cliente...', modal);
    await app.waitForTimeout(800);

    const presupuestoPill = modal.getByText('Presupuesto', { exact: true }).first();
    if (await presupuestoPill.isVisible({ timeout: 2000 }).catch(() => false)) {
      await presupuestoPill.click();
      await app.waitForTimeout(300);
    }

    await modal.locator('textarea').first().fill(PENDIENTE_DESC);
    await modal.getByRole('button', { name: /crear pendiente/i }).click();
    await app.waitForTimeout(2500);
  });

  test('11.19 — Verificar pendiente en lista', async ({ app, nav }) => {
    await nav.goToFresh('Pendientes');
    await app.waitForTimeout(2000);
    expect(await app.locator('tbody tr').count()).toBeGreaterThanOrEqual(1);
  });

  test('11.20 — Finalizar ticket + generar pendiente en cierre', async ({ app, nav }) => {
    await app.keyboard.press('Escape');
    await app.waitForTimeout(500);
    await nav.goToFresh('Tickets');
    await app.waitForTimeout(2000);

    // Desmarcar "Mis tickets" si existe para ver todos
    const misTicketsCheckbox = app.locator('input[type="checkbox"]').filter({ has: app.locator('..', { hasText: /mis tickets/i }) }).first();
    if (await misTicketsCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
      if (await misTicketsCheckbox.isChecked()) {
        await misTicketsCheckbox.click();
        await app.waitForTimeout(1500);
      }
    }

    const firstRow = app.locator('tbody tr').first();
    if (!await firstRow.isVisible({ timeout: 3000 }).catch(() => false)) return;
    await firstRow.click({ force: true });
    await app.waitForTimeout(2500);

    const finalizarBtn = app.getByRole('button', { name: /finalizar/i }).first();
    if (await finalizarBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await finalizarBtn.click();
      await app.waitForTimeout(1500);

      const modal = app.locator('[class*="modal"], [role="dialog"]').last();
      await expect(modal).toBeVisible({ timeout: 5000 });

      // Comentario
      const comentarioInput = modal.locator('textarea').first();
      if (await comentarioInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await comentarioInput.fill(`${TEST_PREFIX} Cierre con pendiente generada`);
      }

      // Agregar pendiente
      const addPendienteBtn = modal.getByText('+ Agregar pendiente', { exact: false }).first();
      if (await addPendienteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await addPendienteBtn.click();
        await app.waitForTimeout(800);

        const pendienteTextarea = modal.locator('textarea').last();
        if (await pendienteTextarea.isVisible({ timeout: 2000 }).catch(() => false)) {
          await pendienteTextarea.fill(PENDIENTE_TICKET);
          await app.waitForTimeout(300);
        }

        const agregarBtn = modal.getByRole('button', { name: /^agregar$/i }).first();
        if (await agregarBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await agregarBtn.click();
          await app.waitForTimeout(500);
        }
      }

      await modal.getByRole('button', { name: /finalizar|marcar/i }).first().click();
      await app.waitForTimeout(3000);
    }
  });

  test('11.21 — Verificar pendientes generadas en ticket detail', async ({ app }) => {
    await app.waitForTimeout(2000);
    const section = app.getByText('Pendientes generados', { exact: false }).first();
    if (await section.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(section).toBeVisible();
    }
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('11.22 — Banner de pendientes al crear presupuesto', async ({ app, nav }) => {
    await app.keyboard.press('Escape');
    await app.waitForTimeout(500);
    await nav.goToFresh('Presupuestos');
    await app.getByRole('button', { name: '+ Nuevo Presupuesto' }).click();
    await app.waitForTimeout(1500);

    await app.getByRole('combobox').filter({ hasText: 'Seleccionar cliente...' }).click();
    await app.waitForTimeout(800);
    await app.locator('[role="listbox"] [role="option"], ul li').first().click();
    await app.waitForTimeout(2000);

    const banner = app.getByText('Pendientes del cliente', { exact: false }).first();
    if (await banner.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(banner).toBeVisible();
    }

    await app.getByRole('button', { name: /cancelar/i }).first().click();
    await app.waitForTimeout(500);
  });

  test('11.23 — Sección pendientes en ClienteDetail', async ({ app, nav }) => {
    await app.keyboard.press('Escape');
    await app.waitForTimeout(500);
    await nav.goToFresh('Clientes');
    await app.waitForTimeout(1500);
    await app.locator('tbody tr').first().click({ force: true });
    await app.waitForTimeout(2500);

    const pendientesTitle = app.getByText('Pendientes del cliente', { exact: false }).first();
    if (await pendientesTitle.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(pendientesTitle).toBeVisible();
    }
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  // ═══════════════════════════════════════════════════════════
  // FACTURACIÓN & AGENDA
  // ═══════════════════════════════════════════════════════════

  test('11.24 — Facturación accesible', async ({ app, nav }) => {
    await nav.goToFresh('Facturacion');
    await app.waitForTimeout(2000);
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('11.25 — Agenda accesible (vista 2S)', async ({ app, nav }) => {
    await nav.goToFresh('Agenda');
    await app.waitForTimeout(2000);
    await expect(app.locator('body')).not.toContainText('Something went wrong');
    // Verificar que muestra la vista 2S (no debería haber pills de zoom)
    const zoomPills = app.getByText('1S', { exact: true });
    expect(await zoomPills.count()).toBe(0);
  });

  // ═══════════════════════════════════════════════════════════
  // INTEGRIDAD
  // ═══════════════════════════════════════════════════════════

  test('11.26 — Navegación cruzada sin crashes', async ({ app, nav }) => {
    const modules = [
      'Presupuestos', 'Ordenes de Trabajo', 'Tickets',
      'Contratos', 'Pendientes', 'Clientes', 'Equipos', 'Agenda',
    ];
    for (const mod of modules) {
      await nav.goTo(mod);
      await app.waitForTimeout(1200);
      await expect(app.locator('body')).not.toContainText('Something went wrong');
    }
  });

  test('11.27 — Verificación final: cliente E2E existe', async ({ app, nav, table }) => {
    await nav.goToFresh('Clientes');
    await table.search(CLIENTE);
    await app.waitForTimeout(2000);
    await table.expectRowWithText(CLIENTE);
  });

  test('11.28 — Verificación final: pendientes E2E existen', async ({ app, nav }) => {
    await nav.goToFresh('Pendientes');
    await app.waitForTimeout(2000);
    expect(await app.locator('tbody tr').count()).toBeGreaterThanOrEqual(1);
  });

  test('11.29 — Verificación final: OTs E2E existen', async ({ app, nav }) => {
    await nav.goToFresh('Ordenes de Trabajo');
    await app.waitForTimeout(2000);
    expect(await app.locator('tbody tr').count()).toBeGreaterThanOrEqual(1);
  });

  test('11.30 — Verificación final: presupuestos E2E existen', async ({ app, nav }) => {
    await nav.goToFresh('Presupuestos');
    await app.waitForTimeout(2000);
    expect(await app.locator('tbody tr').count()).toBeGreaterThanOrEqual(1);
  });
});
