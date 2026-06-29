/**
 * backup-renamed.mjs — Descarga los archivos de Storage DIRECTAMENTE renombrados
 * (UNA sola copia, sin carpeta cruda). Incremental: rclone saltea lo ya bajado.
 *
 * Lee el mapa de nombres del .ndjson (E:\backups-ags\firestore\<ultimo>) y, por cada
 * carpeta del bucket, hace `rclone copy` al destino con nombre legible.
 *
 * Destino: E:\backups-ags\archivo\{Tickets,Presupuestos,OT,Certificados,...}\<nombre>\
 * Restaurar a la nube = usa el .ndjson como índice (script de restore a pedido).
 */
import { createReadStream, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const arg = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const BASE = arg.base || 'E:\\backups-ags';
const RCLONE = arg.rclone || 'C:\\rclone\\rclone.exe';
const BUCKET = 'gcs:agssop-e7353.firebasestorage.app';
const FS_DIR = join(BASE, 'firestore');
const OUT = join(BASE, 'archivo');

const log = (m) => console.log(m);
const sane = (s) => String(s ?? '').replace(/[<>:"/\\|?* -]/g, '_').replace(/[ .]+$/, '').trim().slice(0, 120) || '_';

// ---- ubicar el .ndjson más nuevo ----
if (!existsSync(FS_DIR)) { console.error('No existe', FS_DIR, '— corré primero la baja de Firestore.'); process.exit(1); }
const nd = readdirSync(FS_DIR).filter(f => f.endsWith('.ndjson')).sort().pop();
if (!nd) { console.error('No hay .ndjson en', FS_DIR); process.exit(1); }
const NDJSON = join(FS_DIR, nd);
log(`Índice: ${NDJSON}`);

// ---- mapas desde el .ndjson ----
const leadMap = new Map(), presuMap = new Map(), auditPresuMap = new Map(), certMap = new Map();
const CERT_RE = /certificados(?:-ingeniero)?(?:\/|%2F)(?:patrones(?:\/|%2F))?([0-9a-fA-F-]{20,})/g;
const bestName = (d, fs) => { for (const f of fs) if (d[f]) return String(d[f]); return ''; };

await new Promise((res) => {
  const rl = createInterface({ input: createReadStream(NDJSON), crlfDelay: Infinity });
  rl.on('line', (line) => {
    if (!line.trim()) return;
    let o; try { o = JSON.parse(line); } catch { return; }
    const { path, data } = o; if (!path || !data) return;
    const [col, id] = path.split('/');
    if (col === 'leads') leadMap.set(id, `${data.numero || id}${data.razonSocial ? ' - ' + data.razonSocial : ''}`);
    else if (col === 'presupuestos') presuMap.set(id, `${data.numero || id}`);
    else if (col === 'audit_log' && data.collection === 'presupuestos' && data.documentId) {
      const n = data?.changes?.after?.numero; if (n) auditPresuMap.set(data.documentId, n);
    } else if (['instrumentos', 'patrones', 'columnas', 'certificadosIngeniero'].includes(col)) {
      const nombre = bestName(data, ['certificadoNombre', 'nombre', 'descripcion', 'ingenieroNombre', 'tipo']) ||
        [data.marca, data.modelo, data.serie].filter(Boolean).join(' ');
      const blob = JSON.stringify(data); let m;
      while ((m = CERT_RE.exec(blob)) !== null) if (!certMap.has(m[1])) certMap.set(m[1], sane(nombre || id));
    }
  });
  rl.on('close', res);
});
log(`Mapas: leads=${leadMap.size} presupuestos=${presuMap.size}(+${auditPresuMap.size} hist) certificados=${certMap.size}`);

// ---- rutas ----
const ROUTES = {
  leads:                    { cat: 'Tickets',                resolve: (id) => leadMap.get(id) },
  presupuestos:             { cat: 'Presupuestos',           resolve: (id) => presuMap.get(id) || (auditPresuMap.has(id) ? auditPresuMap.get(id) + ' (eliminado)' : undefined) },
  reports:                  { cat: 'OT',                     resolve: (id) => id },
  adjuntos:                 { cat: 'OT',                     resolve: (id) => id, sub: 'adjuntos' },
  certificados:             { cat: 'Certificados',           resolve: (id) => certMap.get(id), descend: ['patrones'] },
  'certificados-ingeniero': { cat: 'Certificados Ingeniero', resolve: (id) => certMap.get(id) },
  fotosFichas:              { cat: 'Fichas',                 resolve: (id) => id },
  'sistema-modular':        { cat: 'Otros',                  resolve: (id) => id },
};

const rcloneDirs = (path) => {
  try {
    return execFileSync(RCLONE, ['lsf', `${BUCKET}/${path}`, '--dirs-only'], { encoding: 'utf8' })
      .split('\n').map(s => s.replace(/\/\s*$/, '').trim()).filter(Boolean);
  } catch { return []; }
};
const rcloneCopy = (src, dst) => {
  mkdirSync(dst, { recursive: true });
  execFileSync(RCLONE, ['copy', `${BUCKET}/${src}`, dst, '--no-traverse'], { stdio: 'ignore' });
};

let done = 0, sinVincular = 0;
function fetchFolder(src, route, id) {
  const name = route.resolve(id);
  let dst = name ? join(OUT, route.cat, sane(name)) : join(OUT, route.cat, '_sin-vincular', sane(id));
  if (!name) sinVincular++;
  if (route.sub) dst = join(dst, route.sub);
  rcloneCopy(src, dst);
  if (++done % 50 === 0) log(`  ...${done} carpetas`);
}

for (const [prefix, route] of Object.entries(ROUTES)) {
  const ids = rcloneDirs(prefix);
  if (!ids.length) continue;
  log(`${prefix}: ${ids.length} carpetas`);
  for (const id of ids) {
    if (route.descend && route.descend.includes(id)) {
      for (const sub of rcloneDirs(`${prefix}/${id}`)) fetchFolder(`${prefix}/${id}/${sub}`, route, sub);
    } else {
      fetchFolder(`${prefix}/${id}`, route, id);
    }
  }
}

log(`\n✅ Descarga renombrada completa en ${OUT}`);
log(`   Carpetas: ${done}  (sin vincular: ${sinVincular})`);
