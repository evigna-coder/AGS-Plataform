/**
 * Tests de reglas de Firestore contra el emulador.
 *
 * Corre con:  pnpm test:rules
 * (que envuelve esto en `firebase emulators:exec --only firestore`)
 *
 * Cubre las tres categorías de la Fase 1 de hardening:
 *   1. Colecciones internas → denegadas sin auth, permitidas con auth.
 *   2. Superficies públicas → lectura/alta anónima permitida donde corresponde.
 *   3. Firma remota → escritura anónima SOLO de los campos de firma; abuso bloqueado.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
} from 'firebase/firestore';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = resolve(__dirname, '../../firestore.rules');

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-ags',
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

// Helpers
const anon = () => testEnv.unauthenticatedContext().firestore();
// Staff = token con email verificado del dominio AGS (lo exige esStaff() fail-closed).
const authed = () =>
  testEnv.authenticatedContext('user-123', { email: 'staff@agsanalitica.com', email_verified: true }).firestore();
/** Siembra datos saltando las reglas (como lo haría el admin SDK / un usuario interno). */
const seed = (fn: (db: ReturnType<typeof anon>) => Promise<unknown>) =>
  testEnv.withSecurityRulesDisabled((ctx) => fn(ctx.firestore() as never));

describe('Colecciones internas — requieren auth', () => {
  const collections = ['clientes', 'presupuestos', 'usuarios', 'ordenes_trabajo', '_counters', 'mailQueue'];

  it('deniega lectura y escritura SIN auth', async () => {
    const db = anon();
    for (const col of collections) {
      await assertFails(getDoc(doc(db, col, 'x')));
      await assertFails(setDoc(doc(db, col, 'x'), { foo: 'bar' }));
    }
  });

  it('permite lectura y escritura CON auth', async () => {
    const db = authed();
    for (const col of collections) {
      await assertSucceeds(getDoc(doc(db, col, 'x')));
      await assertSucceeds(setDoc(doc(db, col, 'x'), { foo: 'bar' }));
    }
  });
});

describe('Staff fail-closed — autenticado sin dominio AGS NO es staff', () => {
  // Cuenta Google ajena: autenticada y con email verificado, pero NO @agsanalitica.com.
  // Antes del fix esto era tratado como staff (esStaff = cualquier auth sin role:'client').
  const intruso = () =>
    testEnv.authenticatedContext('intruso-1', { email: 'attacker@gmail.com', email_verified: true }).firestore();

  it('un usuario autenticado de dominio ajeno NO accede a colecciones internas', async () => {
    const db = intruso();
    for (const col of ['clientes', 'presupuestos', 'usuarios', 'ordenes_trabajo']) {
      await assertFails(getDoc(doc(db, col, 'x')));
      await assertFails(setDoc(doc(db, col, 'x'), { foo: 'bar' }));
    }
  });

  it('email del dominio pero NO verificado tampoco es staff', async () => {
    const db = testEnv
      .authenticatedContext('sinverif', { email: 'x@agsanalitica.com', email_verified: false })
      .firestore();
    await assertFails(getDoc(doc(db, 'clientes', 'x')));
    await assertFails(setDoc(doc(db, 'clientes', 'x'), { foo: 'bar' }));
  });
});

describe('Superficies públicas', () => {
  it('sistemas: lectura y escritura anónima DENEGADAS (cerrado, va por CF getEquipoPublico)', async () => {
    await seed((db) => setDoc(doc(db, 'sistemas', 'S1'), { agsVisibleId: 'AGS-1', nombre: 'HPLC', clienteId: 'C1' }));
    const db = anon();
    await assertFails(getDoc(doc(db, 'sistemas', 'S1')));
    await assertFails(setDoc(doc(db, 'sistemas', 'S1'), { nombre: 'hackeado' }));
  });

  it('sistemas: staff (auth) SÍ lee', async () => {
    await seed((db) => setDoc(doc(db, 'sistemas', 'S1'), { nombre: 'HPLC', clienteId: 'C1' }));
    await assertSucceeds(getDoc(doc(authed(), 'sistemas', 'S1')));
  });

  it('leads: lectura y alta anónima DENEGADAS (cerrado, va por CF submitSoporte)', async () => {
    const db = anon();
    await assertFails(getDocs(collection(db, 'leads')));
    await assertFails(setDoc(doc(db, 'leads', 'L1'), { razonSocial: 'ACME', estado: 'nuevo' }));
  });

  it('leads: staff (auth) lee y crea', async () => {
    const db = authed();
    await assertSucceeds(getDocs(collection(db, 'leads')));
    await assertSucceeds(setDoc(doc(db, 'leads', 'L1'), { razonSocial: 'ACME', estado: 'nuevo' }));
  });

  it('reportes: lectura anónima permitida (preview de firma — A.3 diferida)', async () => {
    await seed((db) => setDoc(doc(db, 'reportes', 'OT-1'), { otNumber: 'OT-1', status: 'BORRADOR' }));
    await assertSucceeds(getDoc(doc(anon(), 'reportes', 'OT-1')));
  });
});

describe('Aislamiento de cliente (multi-tenant)', () => {
  // Cliente C1 autenticado con custom claims role:'client' + clienteId:'C1'.
  const clienteC1 = () =>
    testEnv.authenticatedContext('client-1', { role: 'client', clienteId: 'C1' }).firestore();

  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'sistemas', 'S1'), { nombre: 'HPLC C1', clienteId: 'C1' });
      await setDoc(doc(db, 'sistemas', 'S2'), { nombre: 'GC C2', clienteId: 'C2' });
      await setDoc(doc(db, 'ordenes_trabajo', 'OT1'), { otNumber: '111', clienteId: 'C1' });
      await setDoc(doc(db, 'ordenes_trabajo', 'OT2'), { otNumber: '222', clienteId: 'C2' });
    });
  });

  it('el cliente SÍ lee sus propios equipos, NO los de otro cliente', async () => {
    const db = clienteC1();
    await assertSucceeds(getDoc(doc(db, 'sistemas', 'S1')));
    await assertFails(getDoc(doc(db, 'sistemas', 'S2')));
  });

  it('el cliente SÍ lee sus propias OTs, NO las de otro cliente', async () => {
    const db = clienteC1();
    await assertSucceeds(getDoc(doc(db, 'ordenes_trabajo', 'OT1')));
    await assertFails(getDoc(doc(db, 'ordenes_trabajo', 'OT2')));
  });

  it('el cliente NO puede escribir sus equipos (solo lectura)', async () => {
    await assertFails(setDoc(doc(clienteC1(), 'sistemas', 'S1'), { nombre: 'editado' }, { merge: true }));
  });

  it('el cliente NO puede tocar colecciones internas (clientes, presupuestos, leads)', async () => {
    const db = clienteC1();
    await assertFails(getDoc(doc(db, 'clientes', 'C1')));
    await assertFails(getDoc(doc(db, 'presupuestos', 'P1')));
    await assertFails(getDocs(collection(db, 'leads')));
  });
});

describe('Firma remota (reportes) — escritura anónima acotada', () => {
  beforeEach(async () => {
    await seed((db) => setDoc(doc(db, 'reportes', 'OT-1'), {
      otNumber: 'OT-1', status: 'BORRADOR', razonSocial: 'ACME',
    }));
  });

  it('permite merge anónimo SOLO de los campos de firma', async () => {
    const db = anon();
    await assertSucceeds(setDoc(
      doc(db, 'reportes', 'OT-1'),
      { signatureClient: 'data:image/png;base64,xxx', signedAt: new Date(), signedFrom: 'mobile' },
      { merge: true },
    ));
  });

  it('deniega tocar otros campos sin auth', async () => {
    const db = anon();
    await assertFails(updateDoc(doc(db, 'reportes', 'OT-1'), { razonSocial: 'hackeado' }));
    await assertFails(updateDoc(doc(db, 'reportes', 'OT-1'), {
      signatureClient: 'x', razonSocial: 'hackeado', // mezcla campo de firma + otro
    }));
  });

  it('deniega crear una OT nueva sin auth', async () => {
    const db = anon();
    await assertFails(setDoc(doc(db, 'reportes', 'OT-NUEVA'), {
      signatureClient: 'x', signedAt: new Date(), signedFrom: 'mobile',
    }));
  });
});

describe('audit_log — inmutable', () => {
  it('create con auth OK; update/delete siempre denegados', async () => {
    const db = authed();
    await assertSucceeds(setDoc(doc(db, 'audit_log', 'A1'), { accion: 'test' }));
    await assertFails(updateDoc(doc(db, 'audit_log', 'A1'), { accion: 'cambiado' }));
    await assertFails(deleteDoc(doc(db, 'audit_log', 'A1')));
  });

  it('create sin auth denegado', async () => {
    await assertFails(setDoc(doc(anon(), 'audit_log', 'A2'), { accion: 'test' }));
  });
});

describe('movimientosStock — log inmutable (auditoría I8)', () => {
  it('staff puede crear y leer; update/delete denegados', async () => {
    const db = authed();
    await assertSucceeds(setDoc(doc(db, 'movimientosStock', 'M1'), { tipo: 'ingreso', cantidad: 1 }));
    await assertFails(updateDoc(doc(db, 'movimientosStock', 'M1'), { cantidad: 99 }));
    await assertFails(deleteDoc(doc(db, 'movimientosStock', 'M1')));
  });

  it('sin auth: nada', async () => {
    await assertFails(setDoc(doc(anon(), 'movimientosStock', 'M2'), { tipo: 'ingreso' }));
  });
});
