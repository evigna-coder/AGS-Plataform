/**
 * Lectura de correos .eml para adjuntar a una OC (2026-09-19).
 *   pnpm --filter @ags/sistema-modular test:mail-adjunto
 * (.msg no tiene fixture sintético posible: es un contenedor OLE; se prueba a mano.)
 */
import assert from 'node:assert/strict';
import { esArchivoDeMail, parsearMail } from '../mailParse';

let pasados = 0;
async function test(nombre: string, fn: () => Promise<void> | void) {
  try { await fn(); pasados++; console.log(`  ✓ ${nombre}`); }
  catch (err) { console.error(`  ✗ ${nombre}`); throw err; }
}

const PDF_B64 = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF').toString('base64');
const EML = [
  'From: "Compras Bagó" <compras@bago.com.ar>',
  'To: Miguel Barrios <mbarrios@agsanalitica.com>, ventas@agsanalitica.com',
  'Cc: "Esteban Vigna" <evigna@agsanalitica.com>',
  'Subject: RE: OC 4500123 - Presupuesto P2-005268-01',
  'Date: Thu, 18 Sep 2026 14:05:00 -0300',
  'MIME-Version: 1.0',
  'Content-Type: multipart/mixed; boundary="XX"',
  '',
  '--XX',
  'Content-Type: multipart/alternative; boundary="YY"',
  '',
  '--YY',
  'Content-Type: text/plain; charset=utf-8',
  '',
  'Hola Miguel, adjunto la OC aprobada. Saludos.',
  '--YY',
  'Content-Type: text/html; charset=utf-8',
  '',
  '<html><body><p>Hola Miguel, <b>adjunto la OC aprobada</b>.</p><p>Saludos.</p></body></html>',
  '--YY--',
  '--XX',
  'Content-Type: application/pdf; name="OC-4500123.pdf"',
  'Content-Disposition: attachment; filename="OC-4500123.pdf"',
  'Content-Transfer-Encoding: base64',
  '',
  PDF_B64,
  '--XX--',
  '',
].join('\r\n');

(async () => {
  console.log('esArchivoDeMail');
  await test('.msg / .eml por extensión, mime de Outlook, y un pdf no', () => {
    assert.equal(esArchivoDeMail({ name: 'oc.msg', type: '' }), true);
    assert.equal(esArchivoDeMail({ name: 'OC.EML', type: '' }), true);
    assert.equal(esArchivoDeMail({ name: 'raro', type: 'application/vnd.ms-outlook' }), true);
    assert.equal(esArchivoDeMail({ name: 'oc.pdf', type: 'application/pdf' }), false);
  });

  console.log('parsearMail (.eml)');
  const file = new File([EML], 'RE OC 4500123.eml', { type: 'message/rfc822' });
  const m = await parsearMail(file);
  await test('encabezado', () => {
    assert.equal(m.asunto, 'RE: OC 4500123 - Presupuesto P2-005268-01');
    assert.equal(m.de, 'Compras Bagó <compras@bago.com.ar>');
    assert.deepEqual(m.para, ['Miguel Barrios <mbarrios@agsanalitica.com>', 'ventas@agsanalitica.com']);
    assert.deepEqual(m.cc, ['Esteban Vigna <evigna@agsanalitica.com>']);
    assert.ok(m.fecha && m.fecha.startsWith('2026-09-18'), `fecha: ${m.fecha}`);
  });
  await test('cuerpo html y texto', () => {
    assert.match(m.html ?? '', /adjunto la OC aprobada/);
    assert.match(m.texto ?? '', /Hola Miguel/);
  });
  await test('adjunto interno con su contenido', () => {
    assert.equal(m.adjuntos.length, 1);
    assert.equal(m.adjuntos[0].nombre, 'OC-4500123.pdf');
    assert.equal(m.adjuntos[0].mime, 'application/pdf');
    assert.equal(Buffer.from(m.adjuntos[0].datos).toString('latin1').startsWith('%PDF-1.4'), true);
  });

  console.log(`\n${pasados} tests OK`);
})().catch(err => { console.error(err); process.exit(1); });
