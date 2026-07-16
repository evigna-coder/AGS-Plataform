import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';
import { useBulkAddStock } from '../../hooks/useBulkAddStock';
import { useAuth } from '../../contexts/AuthContext';
import type { Articulo, CondicionUnidad, TipoUbicacionStock } from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  /** Si viene, el artículo queda fijo (lanzado desde su detalle). */
  presetArticulo?: Articulo | null;
}

const CONDICIONES: CondicionUnidad[] = ['nuevo', 'bien_de_uso', 'reacondicionado', 'vendible', 'scrap'];
const CONDICION_LABELS: Record<CondicionUnidad, string> = {
  nuevo: 'Nuevo', bien_de_uso: 'Bien de uso', reacondicionado: 'Reacondicionado', vendible: 'Vendible', scrap: 'Scrap',
};
const TIPOS_UBICACION: TipoUbicacionStock[] = ['posicion', 'minikit', 'ingeniero', 'cliente', 'proveedor', 'transito'];
const TIPO_UBICACION_LABELS: Record<TipoUbicacionStock, string> = {
  posicion: 'Posicion', minikit: 'Minikit', ingeniero: 'Ingeniero', cliente: 'Cliente', proveedor: 'Proveedor', transito: 'En transito',
};

const lbl = 'block text-[10px] font-mono font-medium text-slate-500 mb-0.5 uppercase tracking-wide';
const ctrl = 'w-full border border-[#E5E5E5] rounded-md px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-700';

export const BulkAddStockModal: React.FC<Props> = ({ open, onClose, onCreated, presetArticulo }) => {
  const { usuario, firebaseUser } = useAuth();
  const creadoPor = usuario?.displayName ?? usuario?.email ?? firebaseUser?.email ?? 'Admin';
  const h = useBulkAddStock(open, presetArticulo, onClose, onCreated, creadoPor);

  const showSerie = h.requiereSerie;
  const showLote = h.requiereLote || !h.requiereSerie; // lote-only o sin-traza muestran lote opcional
  const showCantidad = !h.requiereSerie;

  return (
    <Modal open={open} onClose={onClose} title="Cargar stock" maxWidth="xl"
      subtitle={h.articulo ? `${h.articulo.codigo} — ${h.articulo.descripcion.slice(0, 50)}` : 'Alta de unidades en lote'}
      footer={<>
        <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
        <Button size="sm" onClick={h.handleSave} disabled={h.saving || !h.articulo}>
          {h.saving ? 'Cargando...' : `Cargar ${h.totalUnidades} unidad${h.totalUnidades === 1 ? '' : 'es'}`}
        </Button>
      </>}>
      <div className="space-y-4">
        {/* Artículo */}
        {!presetArticulo && (
          <div className="max-w-md">
            <label className={lbl}>Artículo *</label>
            <SearchableSelect value={h.articuloId} onChange={h.setArticuloId}
              options={h.articulos.map(a => ({ value: a.id, label: `${a.codigo} — ${a.descripcion}` }))}
              placeholder="Buscar artículo..."
              autoFocusToken={open && !h.articuloId} />
          </div>
        )}

        {h.articulo && (
          <>
            {/* Trazabilidad detectada */}
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-slate-400 font-mono uppercase tracking-wide">Trazabilidad:</span>
              {h.requiereSerie && <span className="px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700 font-medium">Nº de serie (1 fila = 1 unidad)</span>}
              {h.requiereLote && <span className="px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">Nº de lote</span>}
              {!h.requiereSerie && !h.requiereLote && <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">Sin trazabilidad (por cantidad)</span>}
            </div>
            {h.requiereSerie && (
              <p className="text-[11px] text-slate-500 -mt-2">
                Este artículo es serializado: no hay campo cantidad — cargá <span className="font-medium">una fila por unidad</span>, cada
                una con su número de serie. La cantidad total = filas cargadas.
              </p>
            )}

            {/* Campos comunes */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 bg-slate-50 border border-slate-100 rounded-lg p-3">
              <div className="col-span-2 md:col-span-4">
                <label className={lbl}>Proveedor (origen del ingreso)</label>
                <SearchableSelect value={h.proveedorId} onChange={h.setProveedorId}
                  options={h.proveedores.map(p => ({ value: p.id, label: p.nombre }))}
                  placeholder="Opcional — de quién ingresa el stock" />
              </div>
              <div>
                <label className={lbl}>Condición</label>
                <select className={ctrl} value={h.condicion} onChange={e => h.setCondicion(e.target.value as CondicionUnidad)}>
                  {CONDICIONES.map(c => <option key={c} value={c}>{CONDICION_LABELS[c]}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Tipo ubicación</label>
                <select className={ctrl} value={h.ubicacionTipo}
                  onChange={e => { h.setUbicacionTipo(e.target.value as TipoUbicacionStock); h.setUbicacionRefId(''); h.setUbicacionRefNombre(''); }}>
                  {TIPOS_UBICACION.map(t => <option key={t} value={t}>{TIPO_UBICACION_LABELS[t]}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Ubicación *</label>
                {h.refOptions.length > 0 ? (
                  <select className={ctrl} value={h.ubicacionRefId} onChange={e => h.setUbicacionRefId(e.target.value)}>
                    <option value="">Seleccionar...</option>
                    {h.refOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                ) : (
                  <input className={ctrl} value={h.ubicacionRefNombre} onChange={e => h.setUbicacionRefNombre(e.target.value)} placeholder="Nombre referencia" />
                )}
              </div>
              <div>
                <label className={lbl}>Costo unitario</label>
                <div className="flex gap-1">
                  <input type="number" className={ctrl} value={h.costoUnitario} onChange={e => h.setCostoUnitario(e.target.value)} />
                  <select className="border border-[#E5E5E5] rounded-md px-1 text-xs bg-white" value={h.monedaCosto} onChange={e => h.setMonedaCosto(e.target.value as 'ARS' | 'USD')}>
                    <option value="USD">USD</option><option value="ARS">ARS</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Filas */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className={lbl}>{showSerie ? 'Unidades (una por nº de serie)' : 'Líneas de carga'}</span>
                <div className="flex gap-1.5">
                  {showSerie && <Button variant="ghost" size="sm" onClick={() => h.addRows(5)}>+5 filas</Button>}
                  <Button variant="outline" size="sm" onClick={h.addRow}>+ Fila</Button>
                </div>
              </div>
              <div className="border border-[#E5E5E5] rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#F0F0F0] text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-1.5 px-2 w-8 text-center">#</th>
                      {showSerie && <th className="py-1.5 px-2 text-left">Nº serie *</th>}
                      {showLote && <th className="py-1.5 px-2 text-left">Nº lote{h.requiereLote ? ' *' : ''}</th>}
                      {showCantidad && <th className="py-1.5 px-2 w-24 text-left">Cantidad</th>}
                      <th className="py-1.5 px-2 text-left">Observaciones</th>
                      <th className="py-1.5 px-2 w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {h.rows.map((r, idx) => (
                      <tr key={r.key} className="hover:bg-slate-50">
                        <td className="px-2 py-1 text-center text-slate-400 font-mono">{idx + 1}</td>
                        {showSerie && (
                          <td className="px-2 py-1">
                            <input className={ctrl + ' font-mono'} value={r.nroSerie} onChange={e => h.setRow(r.key, { nroSerie: e.target.value })} />
                          </td>
                        )}
                        {showLote && (
                          <td className="px-2 py-1">
                            <input className={ctrl + ' font-mono'} value={r.nroLote} onChange={e => h.setRow(r.key, { nroLote: e.target.value })} />
                          </td>
                        )}
                        {showCantidad && (
                          <td className="px-2 py-1">
                            <input type="number" min={1} className={ctrl} value={r.cantidad}
                              onChange={e => h.setRow(r.key, { cantidad: Number(e.target.value) || 1 })} />
                          </td>
                        )}
                        <td className="px-2 py-1">
                          <input className={ctrl} value={r.observaciones} onChange={e => h.setRow(r.key, { observaciones: e.target.value })} />
                        </td>
                        <td className="px-2 py-1 text-center">
                          <button onClick={() => h.removeRow(r.key)} disabled={h.rows.length === 1}
                            className="text-slate-300 hover:text-red-500 disabled:opacity-30 text-sm leading-none">×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {h.error && <p className="text-[11px] text-red-600">{h.error}</p>}
          </>
        )}
      </div>
    </Modal>
  );
};
