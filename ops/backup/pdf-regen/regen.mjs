/**
 * regen.mjs — Arma el dossier de PRESUPUESTOS del backup (una carpeta por
 * presupuesto: `<numero> - <cliente>`) con el PDF regenerado + la OC del cliente
 * adentro. También genera los PDF de OC a proveedor confirmadas.
 *
 * Lee el .ndjson más nuevo de <base>/firestore, arma los mapas de entidades y:
 *   Presupuestos/<numero> - <cliente>/
 *       <numero> - <cliente>.pdf        ← regenerado con los componentes de la app
 *       <archivos de la OC del cliente>  ← bajados de Storage (adjuntos del ppto
 *                                          tipo orden_compra + ordenesCompraCliente)
 *   OC Proveedor/<numero - proveedor>.pdf ← OC confirmadas (enviada/embarcada/recibida)
 *
 * La OC del cliente vive en Storage bajo un id propio embebido en la URL del
 * adjunto (NO el doc id), así que se extrae por regex — igual que certificados.
 * Los archivos de Storage huérfanos (de presupuestos/OC borrados) van a
 * Presupuestos/_sin-vincular/ para no perderlos.
 *
 * Necesita rclone (baja los adjuntos). Corre en el weekly, DESPUÉS de la baja base.
 *
 * Flags:
 *   --base=E:\backups-ags   raíz del backup (default E:\backups-ags)
 *   --limit=N               procesar solo N presupuestos (test)
 *   --only=P5-005018-01     procesar solo ese número
 *   --force                 re-renderizar aunque el PDF ya exista
 *   --dry                   no escribe/baja nada; solo valida que rendericen
 *   --no-adjuntos           genera PDFs pero NO baja adjuntos (rápido, sin rclone)
 *   --oc-all                OC proveedor en cualquier estado (backfill/test)
 */
import { createReadStream, readdirSync, existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const { renderPresupuesto, renderOrdenCompra } = await import(pathToFileURL(join(here, 'dist', 'render.mjs')).href);

// OC a proveedor: "confirmadas" = las que salieron al proveedor (no borrador/cancelada).
const OC_CONFIRMADAS = new Set(['enviada_proveedor', 'embarcada', 'recibida']);

// ---- args ----
const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));
const BASE = (args.base || 'E:\\backups-ags').replace(/\\+$/, '');
const LIMIT = args.limit ? parseInt(args.limit, 10) : Infinity;
const ONLY = args.only || null;
const FORCE = !!args.force;
const DRY = !!args.dry;
const NO_ADJUNTOS = !!args['no-adjuntos'] || DRY;
const OC_ALL = !!args['oc-all'];
const RCLONE = args.rclone || 'C:\\rclone\\rclone.exe';
const BUCKET = 'gcs:agssop-e7353.firebasestorage.app';

// ---- decode de tags __t del dump ----
function decode(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(decode);
  if (v.__t === 'ts') return new Date(v.s * 1000 + Math.floor((v.n || 0) / 1e6)).toISOString();
  if (v.__t === 'geo') return { lat: v.lat, lng: v.lng };
  if (v.__t === 'bytes') return v.b64;
  if (v.__t === 'ref') return v.path;
  const out = {};
  for (const [k, val] of Object.entries(v)) out[k] = decode(val);
  return out;
}
const idFromPath = (p) => p.split('/').pop();

// nombre de carpeta/archivo legible (conserva espacios, guiones, paréntesis).
function sane(s) {
  return String(s ?? '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/[ .]+$/, '').trim().slice(0, 120) || '_';
}
// id de storage embebido en la URL de un adjunto (NO el doc id).
function storageIdFromUrl(prefix, url) {
  const re = new RegExp(`${prefix}(?:\\/|%2F)([^/%]+)`);
  const m = re.exec(String(url || ''));
  return m ? m[1] : null;
}

// ---- cargar dump ----
const fsDir = join(BASE, 'firestore');
const latest = readdirSync(fsDir).filter(f => f.endsWith('.ndjson')).sort().pop();
if (!latest) { console.error('No hay dump .ndjson en', fsDir); process.exit(1); }
const dumpPath = join(fsDir, latest);
const dumpMtime = statSync(dumpPath).mtimeMs;
console.log('Dump:', dumpPath);

const clientes = new Map();
const establecimientos = new Map();
const contactos = new Map();
const condicionesPago = new Map();
const categorias = [];
const modulosBySistema = {};
const presupuestos = [];
const proveedores = new Map();
const ordenesCompra = [];
const occDocs = []; // ordenesCompraCliente

const rl = createInterface({ input: createReadStream(dumpPath), crlfDelay: Infinity });
for await (const line of rl) {
  if (!line.trim()) continue;
  let obj; try { obj = JSON.parse(line); } catch { continue; }
  const path = obj.path || '';
  const parts = path.split('/');
  const data = decode(obj.data || {});
  data.id = idFromPath(path);

  if (parts.length === 2) {
    switch (parts[0]) {
      case 'clientes': clientes.set(data.id, data); break;
      case 'establecimientos': establecimientos.set(data.id, data); break;
      case 'condiciones_pago': condicionesPago.set(data.id, data); break;
      case 'categorias_presupuesto': categorias.push(data); break;
      case 'presupuestos': presupuestos.push(data); break;
      case 'proveedores': proveedores.set(data.id, data); break;
      case 'ordenes_compra': ordenesCompra.push(data); break;
      case 'ordenesCompraCliente': occDocs.push(data); break;
    }
  } else if (parts.length === 4 && parts[2] === 'contactos') {
    contactos.set(data.id, data);
  } else if (parts.length === 4 && parts[0] === 'sistemas' && parts[2] === 'modulos') {
    (modulosBySistema[parts[1]] ||= []).push(data);
  }
}

// OC cliente linkeadas por presupuestoId → sus ids de storage.
const occByPresu = new Map();
for (const occ of occDocs) {
  const sids = (occ.adjuntos || []).map(a => storageIdFromUrl('ordenesCompraCliente', a?.url)).filter(Boolean);
  for (const pid of (occ.presupuestosIds || [])) {
    const arr = occByPresu.get(pid) || [];
    arr.push(...sids);
    occByPresu.set(pid, arr);
  }
}

console.log(`Entidades: presupuestos=${presupuestos.length} clientes=${clientes.size} contactos=${contactos.size} condPago=${condicionesPago.size} categorias=${categorias.length} OC=${ordenesCompra.length} proveedores=${proveedores.size} ocCliente=${occDocs.length}`);

// ---- rclone helpers ----
const usedPresuStorage = new Set(); // ids de storage de presupuestos ya bajados (para detectar huérfanos)
const usedOccStorage = new Set();
function rcloneCopy(srcPath, dstDir) {
  if (NO_ADJUNTOS) return;
  mkdirSync(dstDir, { recursive: true });
  try { execFileSync(RCLONE, ['copy', `${BUCKET}/${srcPath}`, dstDir, '--no-traverse'], { stdio: 'ignore' }); }
  catch { /* carpeta inexistente / sin permisos: se ignora, no rompe el dossier */ }
}
function rcloneDirs(prefix) {
  try {
    return execFileSync(RCLONE, ['lsf', `${BUCKET}/${prefix}`, '--dirs-only'], { encoding: 'utf8' })
      .split('\n').map(s => s.replace(/\/\s*$/, '').trim()).filter(Boolean);
  } catch { return []; }
}

// ---- presupuestos: carpeta por presupuesto con PDF + OC ----
const presuDir = join(BASE, 'archivo', 'Presupuestos');
if (!DRY) mkdirSync(presuDir, { recursive: true });

let ok = 0, skip = 0, fail = 0, done = 0;
for (const presupuesto of presupuestos) {
  if (done >= LIMIT) break;
  if (ONLY && presupuesto.numero !== ONLY) continue;
  done++;

  const cliente = clientes.get(presupuesto.clienteId) || null;
  const establecimiento = establecimientos.get(presupuesto.establecimientoId) || null;
  const contacto = presupuesto.contactoId ? (contactos.get(presupuesto.contactoId) || null) : null;
  const condicionPago = presupuesto.condicionPagoId ? (condicionesPago.get(presupuesto.condicionPagoId) || null) : null;

  let mbs;
  if (presupuesto.tipo === 'contrato') {
    const sids = [...new Set((presupuesto.items || []).map(i => i.sistemaId).filter(Boolean))];
    mbs = {};
    for (const sid of sids) mbs[sid] = modulosBySistema[sid] || [];
  }

  const folderName = sane(`${presupuesto.numero}${cliente?.razonSocial ? ' - ' + cliente.razonSocial : ''}`);
  const folder = join(presuDir, folderName);
  const pdfPath = join(folder, `${folderName}.pdf`);

  // 1) PDF (incremental: skip si ya existe y es >= dump)
  const pdfFresh = !FORCE && !DRY && existsSync(pdfPath) && statSync(pdfPath).mtimeMs >= dumpMtime;
  if (pdfFresh) {
    skip++;
  } else {
    try {
      const buf = await renderPresupuesto({ presupuesto, cliente, establecimiento, contacto, condicionPago, categorias, modulosBySistema: mbs });
      if (!buf || buf.length < 500 || buf.slice(0, 4).toString() !== '%PDF') throw new Error('PDF inválido');
      if (!DRY) { mkdirSync(folder, { recursive: true }); writeFileSync(pdfPath, buf); }
      ok++;
      console.log(`  ✓ ${folderName}/  (${(buf.length / 1024).toFixed(0)} KB)${DRY ? ' [dry]' : ''}`);
    } catch (err) {
      fail++;
      console.error(`  ✗ ${presupuesto.numero} (${presupuesto.tipo}): ${err.message}`);
      continue;
    }
  }

  // 2) OC del cliente adentro de la carpeta.
  //   a) adjuntos subidos al propio presupuesto (tipo orden_compra, etc.)
  for (const adj of (presupuesto.adjuntos || [])) {
    const sid = storageIdFromUrl('presupuestos', adj?.url);
    if (sid) { usedPresuStorage.add(sid); rcloneCopy(`presupuestos/${sid}/adjuntos`, folder); }
  }
  //   b) ordenesCompraCliente linkeadas a este presupuesto
  for (const sid of (occByPresu.get(presupuesto.id) || [])) {
    usedOccStorage.add(sid); rcloneCopy(`ordenesCompraCliente/${sid}/adjuntos`, folder);
  }
}
console.log(`\nPresupuestos → generados: ${ok}, sin cambios: ${skip}, fallidos: ${fail}`);

// ---- huérfanos: archivos en Storage de presupuestos/OC borrados ----
if (!NO_ADJUNTOS) {
  let huerfanos = 0;
  const sinVinc = join(presuDir, '_sin-vincular');
  for (const sid of rcloneDirs('presupuestos')) {
    if (!usedPresuStorage.has(sid)) { rcloneCopy(`presupuestos/${sid}`, join(sinVinc, sid)); huerfanos++; }
  }
  for (const sid of rcloneDirs('ordenesCompraCliente')) {
    if (!usedOccStorage.has(sid)) { rcloneCopy(`ordenesCompraCliente/${sid}`, join(sinVinc, 'oc-' + sid)); huerfanos++; }
  }
  if (huerfanos) console.log(`Adjuntos huérfanos (presupuestos/OC borrados) → _sin-vincular: ${huerfanos}`);
}

// ---- OC a proveedor (confirmadas) ----
const ocDir = join(BASE, 'archivo', 'OC Proveedor');
const ocConfirmadas = ordenesCompra.filter(oc => OC_ALL || OC_CONFIRMADAS.has(oc.estado));
let ocOk = 0, ocSkip = 0, ocFail = 0;
if (ocConfirmadas.length && !DRY) mkdirSync(ocDir, { recursive: true });
console.log(`\nOC a proveedor: ${ordenesCompra.length} totales, ${ocConfirmadas.length} ${OC_ALL ? '(todas, --oc-all)' : 'confirmadas'} a generar`);
for (const oc of ocConfirmadas) {
  if (ONLY && oc.numero !== ONLY) continue;
  const proveedor = oc.proveedorId ? (proveedores.get(oc.proveedorId) || null) : null;
  const fname = `${sane(oc.numero)}${oc.proveedorNombre || proveedor?.nombre ? ' - ' + sane(oc.proveedorNombre || proveedor?.nombre) : ''}.pdf`;
  const outPath = join(ocDir, fname);
  if (!FORCE && !DRY && existsSync(outPath) && statSync(outPath).mtimeMs >= dumpMtime) { ocSkip++; continue; }
  try {
    const buf = await renderOrdenCompra(oc, proveedor);
    if (!buf || buf.length < 500 || buf.slice(0, 4).toString() !== '%PDF') throw new Error('PDF inválido');
    if (!DRY) writeFileSync(outPath, buf);
    ocOk++;
    console.log(`  ✓ ${fname} (${(buf.length / 1024).toFixed(0)} KB)${DRY ? ' [dry]' : ''}`);
  } catch (err) {
    ocFail++;
    console.error(`  ✗ ${oc.numero} (${oc.estado}): ${err.message}`);
  }
}
console.log(`OC proveedor → generadas: ${ocOk}, sin cambios: ${ocSkip}, fallidas: ${ocFail}`);

if (fail > 0 || ocFail > 0) process.exit(2);
