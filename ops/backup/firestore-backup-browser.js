/* ===========================================================================
   BACKUP DE FIRESTORE — desde la consola del sistema-modular (modo DEV)
   ===========================================================================
   Sin claves, sin gcloud. Usa la sesión autenticada (staff) que ya pasa las
   reglas. Escribe un NDJSON (una línea {path,data} por documento) directo a
   una carpeta de tu disco vía File System Access API.

   CÓMO USAR:
   1. Levantá sistema-modular en DEV:   pnpm dev:modular
      (en la app instalada NO existe window.__ags — tiene que ser dev).
   2. Logueate normal (staff @agsanalitica.com).
   3. Abrí la consola del navegador (F12 → Console).
   4. Pegá TODO este archivo y Enter.
   5. Aparece un botón flotante "▶ Backup Firestore" arriba a la derecha.
      Clic → elegís la carpeta del disco → corre.

   Para una prueba rápida primero: poné ONLY = ['clientes','sistemas'] abajo,
   corré, y cuando funcione dejá ONLY = [] (todas).
   =========================================================================== */
(() => {
  // ----- CONFIG -----
  const ONLY = [];   // ej. ['clientes','sistemas'] para probar; [] = todas
  const SKIP = [];   // colecciones a saltar (ej. ['audit_log'])

  // Colecciones raíz (de firestore.rules) + subcolecciones conocidas.
  const ROOT = [
    'quotes','inventory','appointments','invoices','clientes','establecimientos',
    'categorias_equipo','categorias_modulo','presupuestos','categorias_presupuesto',
    'plantillas_texto_presupuesto','condiciones_pago','tipos_servicio','ordenes_compra',
    'protocolCatalog','tableCatalog','tableProjects','usuarios','adjuntos','instrumentos',
    'patrones','columnas','marcas','ingenieros','proveedores','posicionesStock','articulos',
    'unidades','minikits','movimientosStock','remitos','conceptos_servicio',
    'tiposEquipoPlantillas','consumibles_por_modulo','fichasPropiedad','loaners',
    'posiciones_arancelarias','requerimientos_compra','importaciones','agentesCarga',
    'asignaciones','agendaEntries','agendaNotas','pendientes','postas','viaticos',
    'ordenes_trabajo','contratos','solicitudesFacturacion','ordenesCompraCliente',
    '_counters','feriados','mailQueue','emailTemplates','ingresosEmpresas','dispositivos',
    'vehiculos','calificaciones_proveedor','catalogoSectores','certificadosIngeniero',
    'adminConfig','featureFlags','qfDocumentos','audit_log','sistemas','leads','reportes',
  ];
  const SUBCOLS = {
    clientes: ['contactos'],
    establecimientos: ['contactos'],
    sistemas: ['modulos'],
    usuarios: ['fcmTokens'],
  };

  const ags = window.__ags;
  if (!ags || !ags.db) {
    alert('No encuentro window.__ags. ¿Estás en sistema-modular en modo DEV (pnpm dev:modular)?');
    return;
  }
  const { db } = ags;
  const { collection, getDocs } = ags.firestore;

  // Serialización con fidelidad de tipos (mismo formato que backup-ags.mjs).
  function convert(v) {
    if (v === null || typeof v !== 'object') return v;
    if (typeof v.toDate === 'function' && 'seconds' in v && 'nanoseconds' in v)
      return { __t: 'ts', s: v.seconds, n: v.nanoseconds };
    if ('latitude' in v && 'longitude' in v && Object.keys(v).length === 2)
      return { __t: 'geo', lat: v.latitude, lng: v.longitude };
    if (v.firestore && typeof v.path === 'string' && v.parent) return { __t: 'ref', path: v.path };
    if (Array.isArray(v)) return v.map(convert);
    const out = {};
    for (const [k, val] of Object.entries(v)) out[k] = convert(val);
    return out;
  }

  async function run(btn) {
    let dirHandle;
    try {
      dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    } catch { return; } // canceló

    const date = new Date().toISOString().slice(0, 10);
    const fileHandle = await dirHandle.getFileHandle(`backup-firestore-${date}.ndjson`, { create: true });
    const writable = await fileHandle.createWritable();

    const cols = ROOT.filter(c => (ONLY.length ? ONLY.includes(c) : true) && !SKIP.includes(c));
    let total = 0;
    const t0 = Date.now();

    async function dumpDocs(snap, colPathParts) {
      for (const d of snap.docs) {
        const fullPath = [...colPathParts, d.id].join('/');
        await writable.write(JSON.stringify({ path: fullPath, data: convert(d.data()) }) + '\n');
        total++;
        if (total % 500 === 0) {
          btn.textContent = `⏳ ${total} docs...`;
          console.log(`  ...${total} docs`);
        }
        // subcolecciones conocidas
        const parentCol = colPathParts[colPathParts.length - 1];
        for (const sub of (SUBCOLS[parentCol] || [])) {
          const subSnap = await getDocs(collection(db, ...colPathParts, d.id, sub));
          await dumpDocs(subSnap, [...colPathParts, d.id, sub]);
        }
      }
    }

    try {
      for (const col of cols) {
        console.log(`Colección: ${col}`);
        btn.textContent = `⏳ ${col}...`;
        const snap = await getDocs(collection(db, col));
        await dumpDocs(snap, [col]);
      }
      await writable.close();
      const secs = ((Date.now() - t0) / 1000).toFixed(0);
      btn.textContent = `✅ ${total} docs (${secs}s)`;
      console.log(`%c✅ Backup OK: ${total} documentos en backup-firestore-${date}.ndjson (${secs}s)`, 'color:#0D6E6E;font-weight:bold');
      alert(`Backup completo: ${total} documentos.\nArchivo: backup-firestore-${date}.ndjson`);
    } catch (e) {
      await writable.abort?.();
      btn.textContent = '❌ Error (ver consola)';
      console.error('Backup falló:', e);
      alert('Error: ' + (e?.message || e));
    }
  }

  // Botón flotante (el picker necesita un gesto del usuario).
  const old = document.getElementById('__ags_backup_btn');
  if (old) old.remove();
  const btn = document.createElement('button');
  btn.id = '__ags_backup_btn';
  btn.textContent = '▶ Backup Firestore';
  Object.assign(btn.style, {
    position: 'fixed', top: '12px', right: '12px', zIndex: 999999,
    padding: '10px 16px', background: '#0D6E6E', color: '#fff', border: 'none',
    borderRadius: '8px', fontFamily: 'monospace', fontSize: '13px', cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,.3)',
  });
  btn.onclick = () => run(btn);
  document.body.appendChild(btn);
  console.log('%c▶ Botón "Backup Firestore" agregado arriba a la derecha. Hacé clic para empezar.', 'color:#0D6E6E;font-weight:bold');
})();
