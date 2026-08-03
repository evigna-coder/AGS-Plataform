import type { Minikit, MinikitRequeridoItem, UnidadStock } from '@ags/shared';

export type OrdenListadoMinikit = 'sector' | 'codigo' | 'descripcion';

/**
 * Listado imprimible del minikit (pedido 2026-08-03): va pegado en el kit
 * físico. Abre una ventana con HTML plano y dispara window.print().
 * La fecha de última revisión sale de `ultimaVerificacion` (control físico).
 */
export function imprimirListadoMinikit(
  minikit: Minikit,
  requeridos: MinikitRequeridoItem[],
  unidades: UnidadStock[],
  orden: OrdenListadoMinikit,
): void {
  const filas = requeridos.map(r => ({
    ...r,
    actual: unidades.filter(u => u.articuloId === r.articuloId).length,
  }));

  filas.sort((a, b) => {
    if (orden === 'codigo') return (a.articuloCodigo || '').localeCompare(b.articuloCodigo || '');
    if (orden === 'descripcion') return (a.articuloDescripcion || '').localeCompare(b.articuloDescripcion || '');
    // sector: agrupa por sector (sin sector al final), alfabético adentro
    const sa = a.sector || '￿';
    const sb = b.sector || '￿';
    return sa.localeCompare(sb) || (a.articuloDescripcion || '').localeCompare(b.articuloDescripcion || '');
  });

  const fmtFecha = (iso?: string | null) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
    catch { return iso; }
  };

  const esc = (s: string | null | undefined) =>
    (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  let cuerpo = '';
  let sectorActual: string | null | undefined;
  for (const f of filas) {
    if (orden === 'sector' && f.sector !== sectorActual) {
      sectorActual = f.sector;
      cuerpo += `<tr class="sector"><td colspan="4">${esc(f.sector || 'Sin sector')}</td></tr>`;
    }
    cuerpo += `<tr>
      <td class="mono">${esc(f.articuloCodigo)}</td>
      <td>${esc(f.articuloDescripcion)}${orden !== 'sector' && f.sector ? ` <span class="sec">(${esc(f.sector)})</span>` : ''}</td>
      <td class="num">${f.cantidadMinima}</td>
      <td class="num">${f.actual}</td>
    </tr>`;
  }

  const rev = minikit.ultimaVerificacion;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(minikit.codigo)} — Listado</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; padding: 24px; }
  h1 { font-size: 16px; margin-bottom: 2px; }
  .sub { color: #444; margin-bottom: 2px; }
  .meta { color: #444; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #999; padding: 4px 6px; text-align: left; }
  th { background: #eee; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
  .mono { font-family: 'Courier New', monospace; font-weight: bold; white-space: nowrap; }
  .num { text-align: center; width: 60px; }
  .sec { color: #666; font-size: 10px; }
  tr.sector td { background: #ddd; font-weight: bold; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
  @media print { body { padding: 0; } }
</style></head><body>
  <h1>${esc(minikit.codigo)} — ${esc(minikit.nombre)}</h1>
  ${minikit.descripcion ? `<p class="sub">${esc(minikit.descripcion)}</p>` : ''}
  <p class="meta">Última revisión física: <b>${fmtFecha(rev?.fecha)}</b>${rev?.byName ? ` (${esc(rev.byName)})` : ''} · Impreso: ${fmtFecha(new Date().toISOString())}</p>
  <table>
    <thead><tr><th>Código</th><th>Descripción</th><th>Mínimo</th><th>Cantidad</th></tr></thead>
    <tbody>${cuerpo}</tbody>
  </table>
<script>window.onload = () => { window.print(); };</script>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) { alert('El navegador bloqueó la ventana de impresión — habilitá popups para este sitio.'); return; }
  w.document.write(html);
  w.document.close();
}
