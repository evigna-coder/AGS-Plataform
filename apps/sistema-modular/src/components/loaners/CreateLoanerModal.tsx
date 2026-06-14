import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { LoanerCategoriaModuloPicker, type ModuloSelection } from './LoanerCategoriaModuloPicker';
import { loanersService } from '../../services/firebaseService';
import type { Loaner, EstadoLoaner, CategoriaEquipoStock } from '@ags/shared';

const CATEGORIAS: CategoriaEquipoStock[] = ['HPLC', 'GC', 'MSD', 'UV', 'OSMOMETRO', 'GENERAL'];

const EMPTY_MODULO: ModuloSelection = {
  categoriaModuloId: null, categoriaModuloNombre: null,
  moduloCodigo: null, moduloDescripcion: null, moduloMarca: null,
};

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateLoanerModal({ open, onClose, onCreated }: Props) {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [descripcion, setDescripcion] = useState('');
  const [modulo, setModulo] = useState<ModuloSelection>(EMPTY_MODULO);
  const [serie, setSerie] = useState('');
  const [categoriaEquipo, setCategoriaEquipo] = useState('');
  const [condicion, setCondicion] = useState('Bueno');

  // Al elegir un modelo, auto-llenar la descripción si está vacía (no destructivo).
  const handleModuloChange = (sel: ModuloSelection) => {
    setModulo(sel);
    if (sel.moduloDescripcion && !descripcion) setDescripcion(sel.moduloDescripcion);
  };

  const resetForm = () => {
    setDescripcion(''); setModulo(EMPTY_MODULO); setSerie('');
    setCategoriaEquipo(''); setCondicion('Bueno'); setErrors({});
  };

  const handleClose = () => { resetForm(); onClose(); };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!descripcion.trim()) e.descripcion = 'Requerido';
    if (!condicion.trim()) e.condicion = 'Requerido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const data: Omit<Loaner, 'id' | 'codigo' | 'createdAt' | 'updatedAt'> = {
        descripcion: descripcion.trim(),
        articuloId: null,
        articuloCodigo: null,
        articuloDescripcion: null,
        serie: serie.trim() || null,
        categoriaEquipo: categoriaEquipo || null,
        categoriaModuloId: modulo.categoriaModuloId,
        categoriaModuloNombre: modulo.categoriaModuloNombre,
        moduloCodigo: modulo.moduloCodigo,
        moduloDescripcion: modulo.moduloDescripcion,
        moduloMarca: modulo.moduloMarca,
        condicion: condicion.trim(),
        estado: 'en_base' as EstadoLoaner,
        prestamos: [],
        extracciones: [],
        venta: null,
        activo: true,
      };

      const loanerId = await loanersService.create(data);
      resetForm();
      onCreated();
      onClose();
      navigate(`/loaners/${loanerId}`);
    } catch (err) {
      console.error('Error creando loaner:', err);
      alert('Error al crear el loaner');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Nuevo loaner" subtitle="Equipo de la empresa para prestamo o venta" maxWidth="md">
      <div className="space-y-5 p-5">
        <div>
          <h3 className="text-xs font-semibold text-slate-700 mb-3">Identificacion del equipo</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Input inputSize="sm" label="Descripcion *" value={descripcion} onChange={e => setDescripcion(e.target.value)} error={errors.descripcion} placeholder="Ej: Bomba cuaternaria 1260 Infinity II" />
            </div>
            <LoanerCategoriaModuloPicker
              size="sm"
              categoriaModuloId={modulo.categoriaModuloId || ''}
              moduloCodigo={modulo.moduloCodigo || ''}
              onChange={handleModuloChange}
            />
            <Input inputSize="sm" label="Numero de serie" value={serie} onChange={e => setSerie(e.target.value)} placeholder="S/N" />
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Categoria de equipo</label>
              <select className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs" value={categoriaEquipo} onChange={e => setCategoriaEquipo(e.target.value)}>
                <option value="">Seleccionar</option>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <Input inputSize="sm" label="Condicion *" value={condicion} onChange={e => setCondicion(e.target.value)} error={errors.condicion} placeholder="Ej: Bueno, Reacondicionado" />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50 rounded-b-xl">
        <Button variant="secondary" size="sm" onClick={handleClose}>Cancelar</Button>
        <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Creando...' : 'Crear loaner'}
        </Button>
      </div>
    </Modal>
  );
}
