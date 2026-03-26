import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import { useInventarioIngeniero, type InventarioItem } from '../../hooks/useInventarioIngeniero';

export const InventarioIngenieroPage = () => {
  const { id } = useParams<{ id: string }>();
  const goBack = useNavigateBack();
  const {
    ingeniero, ingenieros, clientes, unidades,
    loading, saving, allItems, temporales, permanentes,
    handleDevolver, handleConsumir, handleReasignarCliente, handleTransferir,
  } = useInventarioIngeniero(id);

  const [tab, setTab] = useState<'temporales' | 'permanentes'>('temporales');
  const [actionModal, setActionModal] = useState<{ item: InventarioItem; action: 'cliente' | 'transferir' } | null>(null);
  const [actionValue, setActionValue] = useState('');

  const visibleItems = tab === 'temporales' ? temporales : permanentes;

  const clienteOpts = [{ value: '', label: 'Sin cliente' }, ...Object.values(
    clientes.filter(c => c.cuit).reduce<Record<string, { value: string; label: string }>>((acc, c) => {
      if (!acc[c.cuit!]) acc[c.cuit!] = { value: c.cuit!, label: c.razonSocial };
      return acc;
    }, {})
  )];
  const ingOpts = ingenieros.map(i => ({ value: i.id, label: i.nombre }));

  const confirmAction = async () => {
    if (!actionModal || !actionValue) return;
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

  if (loading) return <div className="h-full flex items-center justify-center bg-slate-50"><p className="text-xs text-slate-400">Cargando...</p></div>;
  if (!ingeniero) return (
    <div className="h-full flex flex-col items-center justify-center bg-slate-50 gap-4">
      <p className="text-slate-500">Ingeniero no encontrado</p>
      <Link to="/stock/asignaciones" className="text-teal-600 hover:underline text-sm font-medium">Volver</Link>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.06)] z-10 px-5 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => goBack()} className="text-slate-400 hover:text-slate-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div>
              <h2 className="text-base font-semibold text-slate-900 tracking-tight">Inventario de {ingeniero.nombre}</h2>
              <p className="text-xs text-slate-400">
                {ingeniero.area && `${ingeniero.area} · `}
                {allItems.length} items activos · {unidades.length} unidades en poder
              </p>
            </div>
          </div>
          <Link to="/stock/asignaciones" className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700">
            + Asignar
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-4 gap-3">
          {[['Total items', allItems.length], ['Temporales', temporales.length], ['Permanentes', permanentes.length], ['Unidades físicas', unidades.length]].map(([label, value]) => (
            <div key={label as string} className="bg-white rounded-lg border border-slate-100 px-4 py-3">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
              <p className="text-lg font-semibold text-slate-900 mt-0.5">{value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {(['temporales', 'permanentes'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded text-xs font-medium ${tab === t ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {t === 'temporales' ? `Temporales (${temporales.length})` : `Permanentes (${permanentes.length})`}
            </button>
          ))}
        </div>

        {/* Items table */}
        {visibleItems.length === 0 ? (
          <Card><div className="text-center py-8"><p className="text-xs text-slate-400">No hay items {tab}.</p></div></Card>
        ) : (
          <Card compact>
            <div className="space-y-1">
              {visibleItems.map(item => (
                <ItemRow key={`${item.asignacionId}-${item.id}`} item={item} saving={saving}
                  onDevolver={handleDevolver} onConsumir={handleConsumir}
                  onReasignarCliente={() => { setActionModal({ item, action: 'cliente' }); setActionValue(item.clienteId || ''); }}
                  onTransferir={() => { setActionModal({ item, action: 'transferir' }); setActionValue(''); }}
                />
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Action Modal */}
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
          <SearchableSelect
            value={actionValue}
            onChange={setActionValue}
            options={actionModal?.action === 'cliente' ? clienteOpts : ingOpts}
            placeholder={actionModal?.action === 'cliente' ? 'Seleccionar cliente...' : 'Seleccionar ingeniero...'}
          />
        </div>
      </Modal>
    </div>
  );
};

// ── Item row with actions ──

const ItemRow = ({ item, saving, onDevolver, onConsumir, onReasignarCliente, onTransferir }: {
  item: InventarioItem; saving: boolean;
  onDevolver: (item: InventarioItem) => void;
  onConsumir: (item: InventarioItem) => void;
  onReasignarCliente: () => void;
  onTransferir: () => void;
}) => {
  const codigo = getItemCodigo(item);
  const desc = getItemDesc(item);
  const remaining = item.cantidad - item.cantidadDevuelta - item.cantidadConsumida;
  const canAct = remaining > 0;

  return (
    <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="font-mono text-[11px] text-teal-700 font-semibold shrink-0">{codigo}</span>
        <span className="text-xs text-slate-700 truncate">{desc}</span>
        <span className="text-[10px] bg-slate-200 text-slate-600 px-1 py-0.5 rounded shrink-0">{item.tipo}</span>
        {item.permanente && <span className="text-[10px] bg-purple-50 text-purple-700 px-1 py-0.5 rounded shrink-0">Perm</span>}
        {item.clienteNombre && <span className="text-[10px] text-slate-400 shrink-0">→ {item.clienteNombre}</span>}
        <Link to={`/stock/asignaciones/${item.asignacionId}`} className="text-teal-500 hover:underline font-mono text-[10px] shrink-0 ml-auto">
          {item.asignacionNumero}
        </Link>
      </div>
      {canAct && (
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
  return item.articuloDescripcion || item.instrumentoNombre || item.dispositivoDescripcion || item.minikitCodigo || '';
}
