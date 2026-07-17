import { useEffect, useRef, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';
import { StockIntakeStepModal } from './StockIntakeStepModal';
import { useStockIntake } from '../../hooks/useStockIntake';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  /** Recepción desde una OC: precarga proveedor y N° de OC. */
  preset?: { proveedorId?: string; ocNumero?: string };
}

const lbl = 'block text-[10px] font-mono font-medium text-slate-500 mb-1 uppercase tracking-wide';

export const StockIntakeModal: React.FC<Props> = ({ open, onClose, onCreated, preset }) => {
  const { usuario, firebaseUser } = useAuth();
  const creadoPor = usuario?.displayName ?? usuario?.email ?? firebaseUser?.email ?? 'Admin';
  const h = useStockIntake(open, onClose, onCreated, creadoPor, preset);

  // Al terminar (o cancelar) el wizard de un artículo, devolver el cursor al
  // buscador para cargar el siguiente sin tocar el mouse (UAT 2026-07-15).
  const [searchFocusTick, setSearchFocusTick] = useState(0);
  const draftWasOpen = useRef(false);
  useEffect(() => {
    if (draftWasOpen.current && !h.draft && !h.finalizing) setSearchFocusTick(t => t + 1);
    draftWasOpen.current = !!h.draft;
  }, [h.draft, h.finalizing]);

  return (
    <Modal open={open} onClose={onClose} title="Ingresar stock" maxWidth="xl"
      subtitle="Alta manual de stock — proveedor, artículos y trazabilidad"
      footer={<>
        <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
        <Button size="sm" onClick={() => h.setFinalizing(true)} disabled={h.items.length === 0}>
          Finalizar ingreso ({h.totalUnidades} u.)
        </Button>
      </>}>
      <div className="space-y-4">
        {/* Proveedor — lo primero */}
        <div className="max-w-md">
          <label className={lbl}>Proveedor *</label>
          <SearchableSelect value={h.proveedorId} onChange={h.setProveedorId}
            options={h.proveedores.map(p => ({ value: p.id, label: p.nombre }))}
            placeholder="¿De quién ingresa el stock?" />
        </div>

        {/* Buscador de artículo — deshabilitado mientras el wizard por pasos está activo,
            para que no quede un dropdown de fondo abierto/clavado detrás del mini-modal. */}
        <div>
          <label className={lbl}>Agregar artículo</label>
          <SearchableSelect value="" onChange={(v) => { const a = h.articulos.find(x => x.id === v); if (a) h.startArticulo(a); }}
            options={h.articulos.map(a => ({ value: a.id, label: `${a.codigo} — ${a.descripcion}` }))}
            disabled={!!h.draft}
            autoFocusToken={searchFocusTick}
            placeholder="Buscar por código o descripción y elegir..." />
        </div>

        {/* Listado de fondo */}
        <div className="border border-slate-200 rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#F0F0F0] text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-1.5 px-2 text-left">Código</th>
                <th className="py-1.5 px-2 text-left">Descripción</th>
                <th className="py-1.5 px-2 text-right w-14">Cant.</th>
                <th className="py-1.5 px-2 text-left">Cond.</th>
                <th className="py-1.5 px-2 text-left">Ubicación</th>
                <th className="py-1.5 px-2 text-left">Serie/Lote</th>
                <th className="py-1.5 px-2 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {h.items.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-slate-400 py-6">Buscá un artículo arriba para empezar a cargar</td></tr>
              ) : h.items.map(it => (
                <tr key={it.key} className="hover:bg-slate-50">
                  <td className="px-2 py-1.5 font-mono text-teal-700 font-semibold">{it.articulo.codigo}</td>
                  <td className="px-2 py-1.5 text-slate-700 truncate max-w-[200px]">{it.articulo.descripcion}</td>
                  <td className="px-2 py-1.5 text-right font-semibold">{it.articulo.requiereNumeroSerie ? it.series.length : it.cantidad}</td>
                  <td className="px-2 py-1.5 text-slate-600 capitalize">{it.condicion.replace('_', ' ')}</td>
                  <td className="px-2 py-1.5 text-slate-600">{it.ubicacion.nombre}</td>
                  <td className="px-2 py-1.5 font-mono text-slate-500 truncate max-w-[160px]">
                    {it.series.length > 0 ? it.series.join(', ') : it.lote || '—'}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button onClick={() => h.removeItem(it.key)} className="text-slate-300 hover:text-red-500 text-sm leading-none">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {h.error && !h.draft && !h.finalizing && <p className="text-[11px] text-red-600">{h.error}</p>}
      </div>

      {/* Wizard por pasos del artículo en curso */}
      {h.draft && (
        <StockIntakeStepModal
          draft={h.draft as any}
          ubicOptions={h.draftUbic}
          error={h.error}
          onPatch={h.patchDraft}
          onAdvance={h.advance}
          onCancel={h.cancelDraft}
        />
      )}

      {/* Finalizar: OC + despacho */}
      {h.finalizing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30" onMouseDown={() => !h.saving && h.setFinalizing(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-4" onMouseDown={e => e.stopPropagation()}>
            <p className="text-[10px] font-mono text-teal-700 uppercase tracking-widest mb-3">Finalizar ingreso</p>
            <div className="space-y-3">
              <div>
                <label className={lbl}>Nº orden de compra</label>
                <input className="w-full border border-[#E5E5E5] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-700"
                  value={h.ocNumero} onChange={e => h.setOcNumero(e.target.value)} placeholder="Opcional" autoFocus />
              </div>
              <div>
                <label className={lbl}>Nº despacho de importación</label>
                <input className="w-full border border-[#E5E5E5] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-700"
                  value={h.despachoNumero} onChange={e => h.setDespachoNumero(e.target.value)} placeholder="Opcional" />
              </div>
              {h.error && <p className="text-[11px] text-red-600">{h.error}</p>}
            </div>
            <div className="flex justify-between items-center mt-4">
              <button onClick={() => h.setFinalizing(false)} disabled={h.saving} className="text-[11px] text-slate-400 hover:text-slate-600">Volver</button>
              <Button size="sm" onClick={h.confirmFinalize} disabled={h.saving}>
                {h.saving ? 'Guardando...' : `Guardar ingreso (${h.totalUnidades} u.)`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
