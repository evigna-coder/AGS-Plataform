import { useState } from 'react';
import { descripcionItemAsignacion } from '../../utils/itemAsignacionLabel';
import { Link } from 'react-router-dom';
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
                  <ItemRow key={`${item.asignacionId}-${item.id}`} item={item} saving={saving}
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

// ── Item row ──

const ItemRow = ({ item, saving, selected, onToggleSelect, onDevolver, onConsumir, onReasignarCliente, onTransferir }: {
  item: InventarioItem; saving: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onDevolver: (item: InventarioItem) => void;
  onConsumir: (item: InventarioItem) => void;
  onReasignarCliente: () => void;
  onTransferir: () => void;
}) => {
  const codigo = getItemCodigo(item);
  const desc = getItemDesc(item);
  const remaining = item.cantidad - item.cantidadDevuelta - item.cantidadConsumida;

  return (
    <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${selected ? 'bg-teal-50 border border-teal-200' : 'bg-slate-50'}`}>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {onToggleSelect && remaining > 0 && (
          <input type="checkbox" checked={!!selected} onChange={onToggleSelect}
            className="w-3.5 h-3.5 accent-teal-600 shrink-0" />
        )}
        <span className="font-mono text-[11px] text-teal-700 font-semibold shrink-0">{codigo}</span>
        <span className="text-xs text-slate-700 truncate">{desc}</span>
        <span className="text-[10px] bg-slate-200 text-slate-600 px-1 py-0.5 rounded shrink-0">{item.tipo}</span>
        {item.permanente && <span className="text-[10px] bg-purple-50 text-purple-700 px-1 py-0.5 rounded shrink-0">Perm</span>}
        {item.clienteNombre && <span className="text-[10px] text-slate-400 shrink-0">→ {item.clienteNombre}</span>}
        <Link to={`/stock/asignaciones/${item.asignacionId}`} className="text-teal-500 hover:underline font-mono text-[10px] shrink-0 ml-auto">
          {item.asignacionNumero}
        </Link>
      </div>
      {remaining > 0 && (
        <div className="flex gap-1 shrink-0 ml-3">
          <ActionBtn label="Devolver" onClick={() => onDevolver(item)} disabled={saving} />
          {!item.permanente && <ActionBtn label="Consumir" onClick={() => onConsumir(item)} disabled={saving} />}
          <ActionBtn label="Cliente" onClick={onReasignarCliente} disabled={saving} />
          <ActionBtn label="Transferir" onClick={onTransferir} disabled={saving} />
        </div>
      )}
    </div>
  );
};

const ActionBtn = ({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) => (
  <button onClick={onClick} disabled={disabled}
    className="px-2 py-0.5 text-[10px] font-medium rounded border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40 transition-colors">
    {label}
  </button>
);

// ── Helpers ──

function getItemCodigo(item: InventarioItem): string {
  return item.articuloCodigo || item.minikitCodigo || item.loanerCodigo || item.vehiculoPatente || '';
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
