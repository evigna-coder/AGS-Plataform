import { useState, useEffect, useMemo } from 'react';
import { plantillasTextoPresupuestoService } from '../../services/firebaseService';
import type { PlantillaTextoPresupuesto, TipoPresupuesto, PresupuestoSeccionesVisibles } from '@ags/shared';
import { PRESUPUESTO_SECCIONES_LABELS, TIPO_PRESUPUESTO_LABELS } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useConfirm } from '../ui/ConfirmDialog';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { PlantillaTextoForm } from './PlantillaTextoForm';
import { PlantillaRow } from './PlantillaRow';

interface Props { open: boolean; onClose: () => void; }

type SeccionKey = keyof PresupuestoSeccionesVisibles;

type FormShape = {
  nombre: string;
  tipo: SeccionKey;
  tipoPresupuestoAplica: TipoPresupuesto[];
  esDefault: boolean;
  activo: boolean;
  contenido: string;
};

export const PlantillasTextoModal: React.FC<Props> = ({ open, onClose }) => {
  const [plantillas, setPlantillas] = useState<PlantillaTextoPresupuesto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<PlantillaTextoPresupuesto | null>(null);
  const [showForm, setShowForm] = useState(false);
  const confirm = useConfirm();

  // URL-persisted filters (HARD RULE — never useState for list filters)
  const [filters, setFilter, , resetFilters] = useUrlFilters({
    plantilla_seccion: { type: 'string' as const, default: '' },
    plantilla_tipo: { type: 'string' as const, default: '' },
    plantilla_soloActivas: { type: 'boolean' as const, default: true },
  });

  useEffect(() => { if (open) loadData(); }, [open]);

  const loadData = async () => {
    setLoading(true);
    try { setPlantillas(await plantillasTextoPresupuestoService.getAll()); }
    catch (e) { console.error('Error loading plantillas:', e); }
    finally { setLoading(false); }
  };

  const filtered = useMemo(() => {
    return plantillas.filter(p => {
      if (filters.plantilla_soloActivas && !p.activo) return false;
      if (filters.plantilla_seccion && p.tipo !== filters.plantilla_seccion) return false;
      if (filters.plantilla_tipo && !p.tipoPresupuestoAplica.includes(filters.plantilla_tipo as TipoPresupuesto)) return false;
      return true;
    });
  }, [plantillas, filters]);

  const handleSave = async (form: FormShape) => {
    setSaving(true);
    try {
      if (editing) await plantillasTextoPresupuestoService.update(editing.id, form);
      else await plantillasTextoPresupuestoService.create(form);
      setShowForm(false);
      setEditing(null);
      await loadData();
    } catch (e) {
      console.error('Error saving plantilla:', e);
      alert('Error al guardar la plantilla');
    } finally { setSaving(false); }
  };

  const handleDelete = async (p: PlantillaTextoPresupuesto) => {
    if (!await confirm(`¿Eliminar la plantilla "${p.nombre}"?`)) return;
    try {
      await plantillasTextoPresupuestoService.delete(p.id);
      await loadData();
    } catch (e) {
      console.error('Error deleting plantilla:', e);
      alert('Error al eliminar');
    }
  };

  const handleEdit = (p: PlantillaTextoPresupuesto) => { setEditing(p); setShowForm(true); };

  const handleClose = () => {
    setShowForm(false);
    setEditing(null);
    resetFilters();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Plantillas de textos"
      subtitle={`${filtered.length} de ${plantillas.length} plantillas`}
      maxWidth="xl"
    >
      <div className="space-y-3">
        {!showForm && (
          <>
            {/* Filters */}
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-wide mb-0.5">Sección</label>
                <select
                  value={filters.plantilla_seccion}
                  onChange={e => setFilter('plantilla_seccion', e.target.value)}
                  className="border border-slate-200 rounded-md px-2 py-1 text-xs bg-white"
                >
                  <option value="">Todas</option>
                  {(Object.keys(PRESUPUESTO_SECCIONES_LABELS) as SeccionKey[]).map(k => (
                    <option key={k} value={k}>{PRESUPUESTO_SECCIONES_LABELS[k]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-wide mb-0.5">Tipo de presupuesto</label>
                <select
                  value={filters.plantilla_tipo}
                  onChange={e => setFilter('plantilla_tipo', e.target.value)}
                  className="border border-slate-200 rounded-md px-2 py-1 text-xs bg-white"
                >
                  <option value="">Todos</option>
                  {(Object.keys(TIPO_PRESUPUESTO_LABELS) as TipoPresupuesto[]).map(t => (
                    <option key={t} value={t}>{TIPO_PRESUPUESTO_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer ml-auto">
                <input
                  type="checkbox"
                  checked={filters.plantilla_soloActivas}
                  onChange={e => setFilter('plantilla_soloActivas', e.target.checked)}
                  className="rounded border-slate-300"
                />
                Solo activas
              </label>
              <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }}>+ Nueva plantilla</Button>
            </div>

            {/* Table */}
            {loading ? (
              <p className="text-center text-slate-400 text-xs py-6">Cargando...</p>
            ) : filtered.length === 0 ? (
              <p className="text-center text-slate-400 text-xs py-6">
                {plantillas.length === 0 ? 'No hay plantillas — crea la primera' : 'Ninguna plantilla coincide con los filtros'}
              </p>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-y border-slate-200">
                  <tr>
                    <th className="px-3 py-1.5 text-left text-[10px] font-medium text-slate-400 tracking-wider">Nombre</th>
                    <th className="px-3 py-1.5 text-left text-[10px] font-medium text-slate-400 tracking-wider">Sección</th>
                    <th className="px-3 py-1.5 text-left text-[10px] font-medium text-slate-400 tracking-wider">Aplica a</th>
                    <th className="px-3 py-1.5 text-center text-[10px] font-medium text-slate-400 tracking-wider">Default</th>
                    <th className="px-3 py-1.5 text-center text-[10px] font-medium text-slate-400 tracking-wider">Estado</th>
                    <th className="px-3 py-1.5 text-center text-[10px] font-medium text-slate-400 tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(p => (
                    <PlantillaRow key={p.id} plantilla={p} onEdit={handleEdit} onDelete={handleDelete} />
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {showForm && (
          <PlantillaTextoForm
            plantilla={editing}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditing(null); }}
            saving={saving}
          />
        )}
      </div>
    </Modal>
  );
};
