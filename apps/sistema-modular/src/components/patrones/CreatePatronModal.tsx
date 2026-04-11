import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import { marcasService } from '../../services/firebaseService';
import { usePatrones } from '../../hooks/usePatrones';
import type { Marca, CategoriaPatron } from '@ags/shared';
import { CATEGORIA_PATRON_LABELS } from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const emptyForm = {
  codigoArticulo: '',
  descripcion: '',
  marca: '',
  categorias: [] as CategoriaPatron[],
};

export const CreatePatronModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const navigate = useNavigate();
  const { savePatron } = usePatrones();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [marcas, setMarcas] = useState<Marca[]>([]);

  useEffect(() => {
    if (!open) return;
    marcasService.getAll().then(setMarcas);
  }, [open]);

  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));
  const handleClose = () => { onClose(); setForm(emptyForm); };

  const toggleCategoria = (cat: CategoriaPatron) => {
    setForm(prev => ({
      ...prev,
      categorias: prev.categorias.includes(cat)
        ? prev.categorias.filter(c => c !== cat)
        : [...prev.categorias, cat],
    }));
  };

  const handleSave = async () => {
    if (!form.codigoArticulo.trim()) { alert('El código de artículo es obligatorio'); return; }
    if (!form.descripcion.trim()) { alert('La descripción es obligatoria'); return; }
    if (form.categorias.length === 0) { alert('Seleccione al menos una categoría'); return; }

    setSaving(true);
    try {
      const id = await savePatron({
        codigoArticulo: form.codigoArticulo.trim(),
        descripcion: form.descripcion.trim(),
        marca: form.marca,
        categorias: form.categorias,
        lotes: [],
        activo: true,
      });
      handleClose();
      onCreated();
      navigate(`/patrones/${id}/editar`);
    } catch { alert('Error al crear el patrón'); }
    finally { setSaving(false); }
  };

  const lbl = "block text-[11px] font-medium text-slate-500 mb-1";

  return (
    <Modal open={open} onClose={handleClose} title="Nuevo patrón" size="md">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Código de artículo *</label>
            <Input value={form.codigoArticulo} onChange={e => set('codigoArticulo', e.target.value)}
              placeholder="Ej: 8500-6917" />
          </div>
          <div>
            <label className={lbl}>Marca</label>
            <SearchableSelect value={form.marca}
              onChange={(v) => set('marca', v)}
              options={[{ value: '', label: '—' }, ...marcas.map(m => ({ value: m.nombre, label: m.nombre }))]}
              placeholder="Seleccionar" />
          </div>
        </div>
        <div>
          <label className={lbl}>Descripción *</label>
          <Input value={form.descripcion} onChange={e => set('descripcion', e.target.value)}
            placeholder="Ej: Caffeine Standards Kit for LC/MS OQ/PV" />
        </div>
        <div>
          <label className={lbl}>Categorías *</label>
          <div className="flex flex-wrap gap-1.5">
            {(Object.entries(CATEGORIA_PATRON_LABELS) as [CategoriaPatron, string][]).map(([k, v]) => (
              <button key={k} type="button"
                onClick={() => toggleCategoria(k)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                  form.categorias.includes(k)
                    ? 'bg-teal-50 border-teal-300 text-teal-700'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                }`}>
                {v}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-slate-400 italic">
          Los lotes se cargan desde la pantalla de edición luego de crear el patrón.
        </p>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="secondary" onClick={handleClose}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando…' : 'Crear'}</Button>
      </div>
    </Modal>
  );
};
