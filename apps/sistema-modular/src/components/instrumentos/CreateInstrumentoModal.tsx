import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import { marcasService } from '../../services/firebaseService';
import { useInstrumentos } from '../../hooks/useInstrumentos';
import type { Marca, CategoriaInstrumento, CategoriaPatron } from '@ags/shared';
import { CATEGORIA_INSTRUMENTO_LABELS, CATEGORIA_PATRON_LABELS } from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const emptyForm = {
  nombre: '', tipo: 'instrumento' as 'instrumento' | 'patron',
  marca: '', modelo: '', serie: '', lote: '',
  categorias: [] as (CategoriaInstrumento | CategoriaPatron)[],
};

export const CreateInstrumentoModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const navigate = useNavigate();
  const { saveInstrumento } = useInstrumentos();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [marcas, setMarcas] = useState<Marca[]>([]);

  useEffect(() => {
    if (!open) return;
    marcasService.getAll().then(setMarcas);
  }, [open]);

  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));
  const handleClose = () => { onClose(); setForm(emptyForm); };

  const toggleCategoria = (cat: CategoriaInstrumento | CategoriaPatron) => {
    setForm(prev => ({
      ...prev,
      categorias: prev.categorias.includes(cat)
        ? prev.categorias.filter(c => c !== cat)
        : [...prev.categorias, cat],
    }));
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) { alert('El nombre es obligatorio'); return; }
    if (form.categorias.length === 0) { alert('Seleccione al menos una categoria'); return; }

    setSaving(true);
    try {
      const id = await saveInstrumento({
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        marca: form.marca,
        modelo: form.modelo.trim(),
        serie: form.serie.trim(),
        categorias: form.categorias,
        lote: form.tipo === 'patron' && form.lote.trim() ? form.lote.trim() : null,
        certificadoUrl: null, certificadoNombre: null, certificadoStoragePath: null,
        certificadoEmisor: null, certificadoFechaEmision: null, certificadoVencimiento: null,
        trazabilidadUrl: null, trazabilidadNombre: null, trazabilidadStoragePath: null,
        reemplazaA: null, reemplazadoPor: null,
        activo: true,
      });
      handleClose();
      onCreated();
      navigate(`/instrumentos/${id}/editar`);
    } catch { alert('Error al crear el instrumento'); }
    finally { setSaving(false); }
  };

  const lbl = "block text-[11px] font-medium text-slate-500 mb-1";
  const selectCls = "w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500";

  const catLabels = form.tipo === 'instrumento'
    ? CATEGORIA_INSTRUMENTO_LABELS
    : CATEGORIA_PATRON_LABELS;

  return (
    <Modal open={open} onClose={handleClose} title="Nuevo instrumento / patron"
      subtitle="Complete los datos basicos. Certificados se cargan despues."
      footer={<>
        <Button variant="outline" size="sm" onClick={handleClose}>Cancelar</Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Creando...' : 'Crear instrumento'}
        </Button>
      </>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input inputSize="sm" label="Nombre *" value={form.nombre}
            onChange={e => set('nombre', e.target.value)} placeholder="Ej: Termometro digital" />
          <div>
            <label className={lbl}>Tipo</label>
            <select value={form.tipo}
              onChange={e => { set('tipo', e.target.value); set('categorias', []); }}
              className={selectCls}>
              <option value="instrumento">Instrumento</option>
              <option value="patron">Patron</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={lbl}>Marca</label>
            <SearchableSelect value={form.marca}
              onChange={v => set('marca', v)}
              options={marcas.map(m => ({ value: m.nombre, label: m.nombre }))}
              placeholder="Seleccionar..." />
          </div>
          <Input inputSize="sm" label="Modelo" value={form.modelo}
            onChange={e => set('modelo', e.target.value)} />
          <Input inputSize="sm" label="Serie" value={form.serie}
            onChange={e => set('serie', e.target.value)} />
        </div>

        {form.tipo === 'patron' && (
          <Input inputSize="sm" label="Lote" value={form.lote}
            onChange={e => set('lote', e.target.value)} />
        )}

        <hr className="border-slate-100" />

        <div>
          <label className={lbl}>Categorias * (seleccione al menos una)</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {(Object.entries(catLabels) as [string, string][]).map(([key, label]) => (
              <label key={key} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors text-xs ${
                form.categorias.includes(key as any)
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
                <input type="checkbox"
                  checked={form.categorias.includes(key as any)}
                  onChange={() => toggleCategoria(key as any)}
                  className="w-3 h-3 accent-indigo-600" />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};
