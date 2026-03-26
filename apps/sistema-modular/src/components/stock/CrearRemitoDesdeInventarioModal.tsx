import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { remitosService } from '../../services/firebaseService';
import { inventarioToRemitoItem, getTipoEntidadLabel } from '../../utils/inventarioToRemitoItem';
import type { InventarioItem } from '../../hooks/useInventarioIngeniero';
import type { TipoRemito, TipoRemitoItem, TipoItemAsignacion } from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  ingenieroId: string;
  ingenieroNombre: string;
  items: InventarioItem[];
  onRemitoCreado?: (remitoId: string) => void;
}

const TIPO_REMITO_OPTIONS: { value: TipoRemito; label: string }[] = [
  { value: 'salida_campo', label: 'Salida a campo' },
  { value: 'entrega_cliente', label: 'Entrega a cliente' },
  { value: 'interno', label: 'Interno' },
];

const TIPO_ITEM_OPTIONS: { value: TipoRemitoItem; label: string }[] = [
  { value: 'sale_y_vuelve', label: 'Sale y vuelve' },
  { value: 'entrega', label: 'Entrega' },
];

export const CrearRemitoDesdeInventarioModal = ({
  open, onClose, ingenieroId, ingenieroNombre, items, onRemitoCreado,
}: Props) => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterTipo, setFilterTipo] = useState<TipoItemAsignacion | 'todos'>('todos');
  const [tipoRemito, setTipoRemito] = useState<TipoRemito>('salida_campo');
  const [tipoRemitoItem, setTipoRemitoItem] = useState<TipoRemitoItem>('sale_y_vuelve');
  const [observaciones, setObservaciones] = useState('');

  // Solo items asignados con cantidad neta > 0
  const elegibles = useMemo(() =>
    items.filter(i => i.estado === 'asignado' && (i.cantidad - i.cantidadDevuelta - i.cantidadConsumida) > 0),
    [items],
  );

  // Tipos disponibles (solo los que existen en el inventario)
  const tiposDisponibles = useMemo(() => {
    const set = new Set(elegibles.map(i => i.tipo));
    return Array.from(set) as TipoItemAsignacion[];
  }, [elegibles]);

  // Items filtrados por tipo
  const filtrados = useMemo(() =>
    filterTipo === 'todos' ? elegibles : elegibles.filter(i => i.tipo === filterTipo),
    [elegibles, filterTipo],
  );

  const allFilteredSelected = filtrados.length > 0 && filtrados.every(i => selectedIds.has(itemKey(i)));

  const toggleAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filtrados.forEach(i => next.delete(itemKey(i)));
      } else {
        filtrados.forEach(i => next.add(itemKey(i)));
      }
      return next;
    });
  };

  const toggleItem = (item: InventarioItem) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const key = itemKey(item);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleClose = () => {
    onClose();
    setSelectedIds(new Set());
    setFilterTipo('todos');
    setTipoRemito('salida_campo');
    setTipoRemitoItem('sale_y_vuelve');
    setObservaciones('');
  };

  const handleCrear = async () => {
    const selected = elegibles.filter(i => selectedIds.has(itemKey(i)));
    if (selected.length === 0) return;

    setSaving(true);
    try {
      const remitoItems = selected.map(i => inventarioToRemitoItem(i, tipoRemitoItem));
      const newId = await remitosService.create({
        tipo: tipoRemito,
        estado: 'borrador',
        ingenieroId,
        ingenieroNombre,
        items: remitoItems,
        observaciones: observaciones.trim() || null,
        fechaSalida: new Date().toISOString().slice(0, 10),
      });
      handleClose();
      onRemitoCreado?.(newId);
      navigate(`/stock/remitos/${newId}`);
    } catch {
      alert('Error al crear el remito');
    } finally {
      setSaving(false);
    }
  };

  const lbl = "block text-[11px] font-medium text-slate-500 mb-1";
  const selectCls = "w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500";

  return (
    <Modal open={open} onClose={handleClose} maxWidth="lg"
      title="Crear remito desde inventario"
      subtitle={`Ingeniero: ${ingenieroNombre}`}
      footer={<>
        <Button variant="outline" size="sm" onClick={handleClose}>Cancelar</Button>
        <Button size="sm" onClick={handleCrear} disabled={saving || selectedIds.size === 0}>
          {saving ? 'Creando...' : `Crear remito (${selectedIds.size} items)`}
        </Button>
      </>}
    >
      <div className="space-y-4">
        {/* Filter chips */}
        <div>
          <label className={lbl}>Filtrar por tipo</label>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={filterTipo === 'todos'} onClick={() => setFilterTipo('todos')}>
              Todos ({elegibles.length})
            </FilterChip>
            {tiposDisponibles.map(t => (
              <FilterChip key={t} active={filterTipo === t} onClick={() => setFilterTipo(t)}>
                {getTipoEntidadLabel(t)} ({elegibles.filter(i => i.tipo === t).length})
              </FilterChip>
            ))}
          </div>
        </div>

        {/* Select all + items list */}
        <div>
          <label className="flex items-center gap-2 mb-2 cursor-pointer">
            <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
            <span className="text-xs font-medium text-slate-600">
              Seleccionar todos ({filtrados.length})
            </span>
          </label>

          <div className="max-h-[280px] overflow-y-auto space-y-1 border border-slate-100 rounded-lg p-2">
            {filtrados.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No hay items elegibles.</p>
            ) : filtrados.map(item => {
              const key = itemKey(item);
              const codigo = getItemCodigo(item);
              const desc = getItemDesc(item);
              const neta = item.cantidad - item.cantidadDevuelta - item.cantidadConsumida;
              return (
                <label key={key}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    selectedIds.has(key) ? 'bg-teal-50 border border-teal-200' : 'bg-slate-50 border border-transparent hover:bg-slate-100'
                  }`}>
                  <input type="checkbox" checked={selectedIds.has(key)} onChange={() => toggleItem(item)}
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 shrink-0" />
                  <span className="font-mono text-[11px] text-teal-700 font-semibold shrink-0">{codigo}</span>
                  <span className="text-xs text-slate-700 truncate flex-1">{desc}</span>
                  <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded shrink-0">
                    {getTipoEntidadLabel(item.tipo)}
                  </span>
                  <span className="text-[10px] text-slate-500 shrink-0">x{neta}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Remito config */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Tipo de remito</label>
            <select value={tipoRemito} onChange={e => setTipoRemito(e.target.value as TipoRemito)} className={selectCls}>
              {TIPO_REMITO_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Tipo de items</label>
            <select value={tipoRemitoItem} onChange={e => setTipoRemitoItem(e.target.value as TipoRemitoItem)} className={selectCls}>
              {TIPO_ITEM_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className={lbl}>Observaciones</label>
          <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2}
            placeholder="Observaciones del remito..."
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs resize-y focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
      </div>
    </Modal>
  );
};

// ── Helpers ──

const FilterChip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button onClick={onClick}
    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
      active ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
    }`}>
    {children}
  </button>
);

function itemKey(item: InventarioItem): string {
  return `${item.asignacionId}-${item.id}`;
}

function getItemCodigo(item: InventarioItem): string {
  return item.articuloCodigo || item.minikitCodigo || item.loanerCodigo || item.vehiculoPatente || '';
}

function getItemDesc(item: InventarioItem): string {
  return item.articuloDescripcion || item.instrumentoNombre || item.dispositivoDescripcion || item.minikitCodigo || '';
}
