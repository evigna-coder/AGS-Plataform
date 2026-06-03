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
const authed = () => testEnv.authenticatedContext('user-123').firestore();
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

describe('Superficies públicas', () => {
  it('sistemas: lectura anónima permitida, escritura anónima denegada', async () => {
    await seed((db) => setDoc(doc(db, 'sistemas', 'S1'), { agsVisibleId: 'AGS-1', nombre: 'HPLC' }));
    const db = anon();
    await assertSucceeds(getDoc(doc(db, 'sistemas', 'S1')));
    await assertFails(setDoc(doc(db, 'sistemas', 'S1'), { nombre: 'hackeado' }));
  });

  it('leads: lectura (scan) y alta anónima permitidas; update/delete denegados', async () => {
    const db = anon();
    await assertSucceeds(getDocs(collection(db, 'leads')));
    await assertSucceeds(setDoc(doc(db, 'leads', 'L1'), { razonSocial: 'ACME', estado: 'nuevo' }));
    // update/delete sin auth: bloqueados
    await seed((d) => setDoc(doc(d, 'leads', 'L2'), { razonSocial: 'X', estado: 'nuevo' }));
    await assertFails(updateDoc(doc(db, 'leads', 'L2'), { estado: 'perdido' }));
    await assertFails(deleteDoc(doc(db, 'leads', 'L2')));
  });

  it('reportes: lectura anónima permitida (preview de firma)', async () => {
    await seed((db) => setDoc(doc(db, 'reportes', 'OT-1'), { otNumber: 'OT-1', status: 'BORRADOR' }));
    await assertSucceeds(getDoc(doc(anon(), 'reportes', 'OT-1')));
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
