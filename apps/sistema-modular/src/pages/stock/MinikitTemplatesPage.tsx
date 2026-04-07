import { useState, useEffect, useCallback, useRef } from 'react';
import { minikitTemplatesService, articulosService } from '../../services/firebaseService';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { Modal } from '../../components/ui/Modal';
import type { MinikitTemplate, MinikitTemplateItem, Articulo } from '@ags/shared';
import { useConfirm } from '../../components/ui/ConfirmDialog';

export const MinikitTemplatesPage = () => {
  const [templates, setTemplates] = useState<MinikitTemplate[]>([]);

  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MinikitTemplate | null>(null);

  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    unsubRef.current?.();
    unsubRef.current = minikitTemplatesService.subscribe(
      false,
      (data) => { setTemplates(data); setLoading(false); },
      (err) => { console.error('Error cargando plantillas:', err); setLoading(false); }
    );
    return () => { unsubRef.current?.(); };
  }, []);

  const reload = useCallback((_silent = false) => {}, []);

  const openCreate = () => { setEditingTemplate(null); setShowModal(true); };
  const openEdit = (t: MinikitTemplate) => { setEditingTemplate(t); setShowModal(true); };

  const handleDuplicate = async (t: MinikitTemplate) => {
    const nombre = prompt('Nombre para la copia:', `${t.nombre} (copia)`);
    if (!nombre?.trim()) return;
    try {
      await minikitTemplatesService.create({
        nombre: nombre.trim(), descripcion: t.descripcion,
        sectores: [...t.sectores], items: t.items.map(i => ({ ...i })), activo: true,
      });
      reload(true);
    } catch { alert('Error al duplicar'); }
  };

  const handleDelete = async (t: MinikitTemplate) => {
    if (!await confirm(`¿Eliminar plantilla "${t.nombre}"?`)) return;
    try { await minikitTemplatesService.delete(t.id); reload(true); }
    catch { alert('Error al eliminar'); }
  };

  const handleToggle = async (t: MinikitTemplate) => {
    try { await minikitTemplatesService.update(t.id, { activo: !t.activo }); reload(true); }
    catch { alert('Error al cambiar estado'); }
  };

  const groupBySector = (items: MinikitTemplateItem[]) => {
    const groups: Record<string, MinikitTemplateItem[]> = {};
    for (const item of items) {
      const key = item.sector || 'Sin sector';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader title="Plantillas de minikit" subtitle="Composición y mínimos para cada tipo de minikit" count={templates.length}
        actions={<Button size="sm" onClick={openCreate}>+ Nueva plantilla</Button>} />
      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12"><p className="text-xs text-slate-400">Cargando...</p></div>
        ) : templates.length === 0 ? (
          <Card><div className="text-center py-8"><p className="text-xs text-slate-400">No hay plantillas registradas.</p></div></Card>
        ) : (
          <div className="space-y-3">
            {templates.map(t => {
              const groups = groupBySector(t.items);
              return (
                <Card key={t.id} compact>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-slate-900">{t.nombre}</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${t.activo ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                          {t.activo ? 'Activa' : 'Inactiva'}
                        </span>
                        <span className="text-[10px] font-medium bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{t.items.length} artículos</span>
                        {t.sectores?.length > 0 && (
                          <span className="text-[10px] font-medium bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">{t.sectores.length} sectores</span>
                        )}
                      </div>
                      {t.descripcion && <p className="text-[11px] text-slate-400 mt-0.5">{t.descripcion}</p>}
                      {t.items.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {Object.entries(groups).map(([sector, sectorItems]) => (
                            <div key={sector} className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-semibold text-slate-500">{sector}:</span>
                              {sectorItems.map((item, i) => (
                                <span key={i} className="text-[10px] bg-slate-50 text-slate-600 px-1.5 py-0.5 rounded border border-slate-100">
                                  {item.articuloCodigo} x{item.cantidadMinima}
                                </span>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0 ml-3">
                      <ActionLink onClick={() => openEdit(t)} color="teal">Editar</ActionLink>
                      <ActionLink onClick={() => handleDuplicate(t)} color="blue">Duplicar</ActionLink>
                      <ActionLink onClick={() => handleToggle(t)} color={t.activo ? 'amber' : 'green'}>
                        {t.activo ? 'Desactivar' : 'Activar'}
                      </ActionLink>
                      <ActionLink onClick={() => handleDelete(t)} color="red">Eliminar</ActionLink>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
      {showModal && (
        <TemplateModal existing={editingTemplate} onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); reload(true); }} />
      )}
    </div>
  );
};

const ActionLink = ({ onClick, color, children }: { onClick: () => void; color: string; children: React.ReactNode }) => (
  <button onClick={onClick} className={`text-${color}-600 hover:underline font-medium text-[11px]`}>{children}</button>
);

// --- Modal ---

const TemplateModal = ({ existing, onClose, onSaved }: { existing: MinikitTemplate | null; onClose: () => void; onSaved: () => void }) => {
  const [nombre, setNombre] = useState(existing?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(existing?.descripcion ?? '');
  const [sectores, setSectores] = useState<string[]>(existing?.sectores ?? []);
  const [items, setItems] = useState<MinikitTemplateItem[]>(existing?.items ?? []);
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

  const updateItem = (idx: number, updates: Partial<MinikitTemplateItem>) =>
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, ...updates } : item));

  const handleSave = async () => {
    if (!nombre.trim()) return;
    setSaving(true);
    try {
      const data = { nombre: nombre.trim(), descripcion: descripcion.trim() || null, sectores, items, activo: existing?.activo ?? true };
      if (existing) await minikitTemplatesService.update(existing.id, data);
      else await minikitTemplatesService.create(data);
      onSaved();
    } catch { alert('Error al guardar plantilla'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open title={existing ? 'Editar plantilla' : 'Nueva plantilla'} onClose={onClose} maxWidth="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !nombre.trim()}>
            {saving ? 'Guardando...' : existing ? 'Guardar cambios' : 'Crear plantilla'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Nombre *" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Kit GC Básico" autoFocus />
          <Input label="Descripcion" value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Opcional" />
        </div>

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
