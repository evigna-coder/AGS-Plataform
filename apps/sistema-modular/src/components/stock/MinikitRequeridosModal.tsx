import { useState, useEffect } from 'react';
import { articulosService } from '../../services/firebaseService';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import { Modal } from '../ui/Modal';
import type { MinikitRequeridoItem, Articulo } from '@ags/shared';

interface Props {
  initialRequeridos: MinikitRequeridoItem[];
  initialSectores: string[];
  onClose: () => void;
  onSave: (requeridos: MinikitRequeridoItem[], sectores: string[]) => Promise<void>;
}

export const MinikitRequeridosModal = ({ initialRequeridos, initialSectores, onClose, onSave }: Props) => {
  const [sectores, setSectores] = useState<string[]>(initialSectores);
  const [items, setItems] = useState<MinikitRequeridoItem[]>(initialRequeridos);
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [saving, setSaving] = useState(false);
  const [addArticuloId, setAddArticuloId] = useState('');
  const [addCantidad, setAddCantidad] = useState(1);
  const [addSector, setAddSector] = useState('');
  const [newSector, setNewSector] = useState('');

  useEffect(() => {
    articulosService.getAll({ activoOnly: true }).then(setArticulos).catch(console.error);
  }, []);

  const articuloOptions = articulos
    .filter(a => !items.some(i => i.articuloId === a.id))
    .map(a => ({ value: a.id, label: `${a.codigo} — ${a.descripcion}` }));

  const sectorOpts = [{ value: '', label: 'Sin sector' }, ...sectores.map(s => ({ value: s, label: s }))];

  const handleAddSector = () => {
    const name = newSector.trim();
    if (!name || sectores.includes(name)) return;
    setSectores(prev => [...prev, name]);
    setNewSector('');
  };

  const handleRemoveSector = (sector: string) => {
    setSectores(prev => prev.filter(s => s !== sector));
    setItems(prev => prev.map(i => i.sector === sector ? { ...i, sector: null } : i));
  };

  const handleAddItem = () => {
    const art = articulos.find(a => a.id === addArticuloId);
    if (!art || addCantidad < 1) return;
    setItems(prev => [...prev, {
      articuloId: art.id, articuloCodigo: art.codigo,
      articuloDescripcion: art.descripcion, cantidadMinima: addCantidad,
      sector: addSector || null,
    }]);
    setAddArticuloId('');
    setAddCantidad(1);
  };

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const updateItem = (idx: number, updates: Partial<MinikitRequeridoItem>) =>
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, ...updates } : item));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(items, sectores);
    } catch {
      alert('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title="Configurar artículos requeridos" onClose={onClose} maxWidth="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar configuración'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Sectors */}
        <div>
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Sectores ({sectores.length})</p>
          {sectores.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {sectores.map(s => (
                <span key={s} className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded-lg border border-purple-100">
                  {s}
                  <button onClick={() => handleRemoveSector(s)} className="text-purple-400 hover:text-purple-700 text-[10px] ml-0.5">✕</button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Input inputSize="sm" value={newSector} onChange={e => setNewSector(e.target.value)}
                placeholder="Ej: Caja 1, Bolsa 1, Bandeja..."
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddSector(); } }} />
            </div>
            <Button size="sm" variant="outline" onClick={handleAddSector} disabled={!newSector.trim()}>+ Sector</Button>
          </div>
        </div>

        {/* Items */}
        <div>
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Artículos requeridos ({items.length})</p>
          {items.length > 0 && (
            <div className="space-y-1 mb-3">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-slate-50 rounded px-2 py-1.5">
                  <span className="font-mono text-[11px] text-teal-700 font-semibold shrink-0">{item.articuloCodigo}</span>
                  <span className="text-xs text-slate-700 truncate flex-1">{item.articuloDescripcion}</span>
                  {sectores.length > 0 && (
                    <select value={item.sector || ''} onChange={e => updateItem(idx, { sector: e.target.value || null })}
                      className="text-[10px] border border-slate-200 rounded px-1.5 py-0.5 bg-white text-slate-600 w-24">
                      <option value="">Sin sector</option>
                      {sectores.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                  <span className="text-[10px] text-slate-400 shrink-0">Min:</span>
                  <input type="number" min={1} value={item.cantidadMinima}
                    onChange={e => updateItem(idx, { cantidadMinima: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-14 border border-slate-200 rounded px-1.5 py-0.5 text-xs text-center" />
                  <button onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700 text-xs shrink-0">✕</button>
                </div>
              ))}
            </div>
          )}

          <div className={`grid gap-2 items-end ${sectores.length > 0 ? 'grid-cols-[1fr_auto_70px_36px]' : 'grid-cols-[1fr_70px_36px]'}`}>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-0.5">Agregar artículo</label>
              <SearchableSelect value={addArticuloId} onChange={setAddArticuloId} options={articuloOptions} placeholder="Buscar artículo..." />
            </div>
            {sectores.length > 0 && (
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-0.5">Sector</label>
                <SearchableSelect value={addSector} onChange={setAddSector} options={sectorOpts} placeholder="Sector" />
              </div>
            )}
            <Input label="Cant." type="number" value={String(addCantidad)}
              onChange={e => setAddCantidad(Math.max(1, parseInt(e.target.value) || 1))} />
            <Button size="sm" variant="outline" onClick={handleAddItem} disabled={!addArticuloId}>+</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
