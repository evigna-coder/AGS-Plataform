import { useMemo, useState } from 'react';
import { descripcionItemAsignacion, codigoItemAsignacion } from '../../utils/itemAsignacionLabel';
import { seriesDesdeUnidades, serieDeItemAsignacion } from '../../utils/asignacionSeries';
import { InventarioItemRow } from '../../pages/stock/InventarioItemRow';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';
import { CrearRemitoDesdeInventarioModal } from './CrearRemitoDesdeInventarioModal';
import { useInventarioIngeniero, type InventarioItem } from '../../hooks/useInventarioIngeniero';
import type { Cliente } from '@ags/shared';

interface Props {
  ingenieroId: string | null;
  onClose: () => void;
}

export const InventarioIngenieroModal = ({ ingenieroId, onClose }: Props) => {
  const {
    ingeniero, ingenieros, clientes, unidades,
    loading, saving, allItems, temporales, permanentes,
    handleDevolver, handleDevolverVarios, handleConsumir, handleReasignarCliente, handleTransferir,
  } = useInventarioIngeniero(ingenieroId ?? undefined);

  const [tab, setTabRaw] = useState<'temporales' | 'permanentes'>('temporales');
  /** Selección múltiple para devolver en lote (2026-08-11). */
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const setTab = (t: 'temporales' | 'permanentes') => { setTabRaw(t); setSeleccion(new Set()); };
  const [actionModal, setActionModal] = useState<{ item: InventarioItem; action: 'cliente' | 'transferir' } | null>(null);
  const [actionValue, setActionValue] = useState('');
  const [showRemitoModal, setShowRemitoModal] = useState(false);

  // Las unidades del ingeniero ya vienen cargadas por el hook: la serie sale de
  // ahí, sin una lectura extra (2026-08-14).
  const series = useMemo(() => seriesDesdeUnidades(unidades), [unidades]);
  const visibleItems = tab === 'temporales' ? temporales : permanentes;
  const devolvibles = visibleItems.filter(i => i.cantidad - i.cantidadDevuelta - i.cantidadConsumida > 0);
  const todosSeleccionados = devolvibles.length > 0 && devolvibles.every(i => seleccion.has(i.id));
  const toggleSeleccion = (itemId: string) => setSeleccion(prev => {
    const next = new Set(prev);
    if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
    return next;
  });
  const devolverSeleccionados = async () => {
    await handleDevolverVarios(devolvibles.filter(i => seleccion.has(i.id)));
    setSeleccion(new Set());
  };

  const clienteOpts = buildClienteOpts(clientes);
  const ingOpts = ingenieros.map(i => ({ value: i.id, label: i.nombre }));

  const confirmAction = async () => {
    if (!actionModal || (actionModal.action === 'transferir' && !actionValue)) return;
    if (actionModal.action === 'cliente') {
      const cl = clientes.find(c => c.cuit === actionValue);
      await handleReasignarCliente(actionModal.item, actionValue, cl?.razonSocial || 'Sin cliente');
    } else {
      const ing = ingenieros.find(i => i.id === actionValue);
      if (ing) await handleTransferir(actionModal.item, ing.id, ing.nombre);
    }
    setActionModal(null);
    setActionValue('');
  };

  return (
    <>
      <Modal open={!!ingenieroId} onClose={onClose}
        title={ingeniero ? `Inventario de ${ingeniero.nombre}` : 'Inventario'}
        subtitle={ingeniero ? `${allItems.length} items activos · ${unidades.length} unidades en poder` : ''}
        maxWidth="xl"
      >
        {loading ? (
          <div className="flex justify-center py-12"><p className="text-xs text-slate-400">Cargando...</p></div>
        ) : !ingeniero ? (
          <div className="text-center py-8"><p className="text-xs text-slate-400">Ingeniero no encontrado</p></div>
        ) : (
          <div className="space-y-3">
            {/* Summary */}
            <div className="grid grid-cols-4 gap-2">
              {[['Total', allItems.length], ['Temporales', temporales.length], ['Permanentes', permanentes.length], ['Unidades', unidades.length]].map(([label, value]) => (
                <div key={label as string} className="bg-slate-50 rounded-lg px-3 py-2">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
                  <p className="text-base font-semibold text-slate-900">{value}</p>
                </div>
              ))}
            </div>

            {/* Tabs + Crear Remito */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {(['temporales', 'permanentes'] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`px-2.5 py-1 rounded text-xs font-medium ${tab === t ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    {t === 'temporales' ? `Temporales (${temporales.length})` : `Permanentes (${permanentes.length})`}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                {devolvibles.length > 0 && (
                  <>
                    <label className="flex items-center gap-1 cursor-pointer text-[11px] text-slate-600">
                      <input type="checkbox" checked={todosSeleccionados}
                        onChange={() => setSeleccion(todosSeleccionados ? new Set() : new Set(devolvibles.map(i => i.id)))}
                        className="w-3.5 h-3.5 accent-teal-600" />
                      Todos
                    </label>
                    <button onClick={devolverSeleccionados} disabled={saving || seleccion.size === 0}
                      className="px-2.5 py-1 bg-teal-600 text-white rounded text-xs font-medium hover:bg-teal-700 disabled:opacity-40">
                      {saving ? 'Procesando...' : `Devolver (${seleccion.size})`}
                    </button>
                  </>
                )}
                <button onClick={() => setShowRemitoModal(true)} disabled={allItems.length === 0}
                  className="px-2.5 py-1 border border-teal-600 text-teal-700 rounded text-xs font-medium hover:bg-teal-50 disabled:opacity-40">
                  Crear Remito
                </button>
              </div>
            </div>

            {/* Items */}
            {visibleItems.length === 0 ? (
              <div className="text-center py-6"><p className="text-xs text-slate-400">No hay items {tab}.</p></div>
            ) : (
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {visibleItems.map(item => (
                  <InventarioItemRow key={`${item.asignacionId}-${item.id}`} item={item} saving={saving}
                    serie={serieDeItemAsignacion(item, series)}
                    selected={seleccion.has(item.id)} onToggleSelect={() => toggleSeleccion(item.id)}
                    onDevolver={handleDevolver} onConsumir={handleConsumir}
                    onReasignarCliente={() => { setActionModal({ item, action: 'cliente' }); setActionValue(item.clienteId || ''); }}
                    onTransferir={() => { setActionModal({ item, action: 'transferir' }); setActionValue(''); }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Nested action modal */}
      <Modal open={!!actionModal} onClose={() => { setActionModal(null); setActionValue(''); }}
        title={actionModal?.action === 'cliente' ? 'Reasignar cliente' : 'Transferir a IST'}
        subtitle={actionModal ? `${getItemCodigo(actionModal.item)} — ${getItemDesc(actionModal.item)}` : ''}
        maxWidth="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setActionModal(null); setActionValue(''); }}>Cancelar</Button>
            <Button size="sm" onClick={confirmAction} disabled={saving || (actionModal?.action === 'transferir' && !actionValue)}>
              {saving ? 'Procesando...' : 'Confirmar'}
            </Button>
          </div>
        }
      >
        <div className="py-2">
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">
            {actionModal?.action === 'cliente' ? 'Nuevo cliente' : 'Ingeniero destino'}
          </label>
          <SearchableSelect value={actionValue} onChange={setActionValue}
            options={actionModal?.action === 'cliente' ? clienteOpts : ingOpts}
            placeholder={actionModal?.action === 'cliente' ? 'Seleccionar cliente...' : 'Seleccionar ingeniero...'} />
        </div>
      </Modal>

      {/* Crear Remito Modal */}
      {ingeniero && (
        <CrearRemitoDesdeInventarioModal
          open={showRemitoModal}
          onClose={() => setShowRemitoModal(false)}
          ingenieroId={ingeniero.id}
          ingenieroNombre={ingeniero.nombre}
          items={allItems}
        />
      )}
    </>
  );
};

// ── Helpers ──

function getItemCodigo(item: InventarioItem): string {
  return codigoItemAsignacion(item);
}
function getItemDesc(item: InventarioItem): string {
  return descripcionItemAsignacion(item);
}
function buildClienteOpts(clientes: Cliente[]) {
  return [{ value: '', label: 'Sin cliente' }, ...Object.values(
    clientes.filter(c => c.cuit).reduce<Record<string, { value: string; label: string }>>((acc, c) => {
      if (!acc[c.cuit!]) acc[c.cuit!] = { value: c.cuit!, label: c.razonSocial };
      return acc;
    }, {})
  )];
}
