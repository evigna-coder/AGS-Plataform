import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { loanersService, articulosService } from '../../services/firebaseService';
import type { Loaner, Articulo, EstadoLoaner, CategoriaEquipoStock } from '@ags/shared';

const CATEGORIAS: CategoriaEquipoStock[] = ['HPLC', 'GC', 'MSD', 'UV', 'OSMOMETRO', 'GENERAL'];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateLoanerModal({ open, onClose, onCreated }: Props) {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [descripcion, setDescripcion] = useState('');
  const [articuloId, setArticuloId] = useState('');
  const [serie, setSerie] = useState('');
  const [categoriaEquipo, setCategoriaEquipo] = useState('');
  const [condicion, setCondicion] = useState('Bueno');

  useEffect(() => {
    if (open) articulosService.getAll({ activoOnly: true }).then(setArticulos);
  }, [open]);

  // Auto-fill from articulo
  useEffect(() => {
    if (!articuloId) return;
    const art = articulos.find(a => a.id === articuloId);
    if (art) {
      if (!descripcion) setDescripcion(art.descripcion);
      if (!categoriaEquipo) setCategoriaEquipo(art.categoriaEquipo);
    }
  }, [articuloId, articulos]);

  const resetForm = () => {
    setDescripcion(''); setArticuloId(''); setSerie('');
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
      const selectedArticulo = articulos.find(a => a.id === articuloId);

      const data: Omit<Loaner, 'id' | 'codigo' | 'createdAt' | 'updatedAt'> = {
        descripcion: descripcion.trim(),
        articuloId: articuloId || null,
        articuloCodigo: selectedArticulo?.codigo || null,
        articuloDescripcion: selectedArticulo?.descripcion || null,
        serie: serie.trim() || null,
        categoriaEquipo: categoriaEquipo || null,
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
              <Input size="sm" label="Descripcion *" value={descripcion} onChange={e => setDescripcion(e.target.value)} error={errors.descripcion} placeholder="Ej: Bomba cuaternaria 1260 Infinity II" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Vincular a articulo de stock</label>
              <select className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs" value={articuloId} onChange={e => setArticuloId(e.target.value)}>
                <option value="">Sin vincular</option>
                {articulos.map(a => <option key={a.id} value={a.id}>{a.codigo} — {a.descripcion}</option>)}
              </select>
            </div>
            <Input size="sm" label="Numero de serie" value={serie} onChange={e => setSerie(e.target.value)} placeholder="S/N" />
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Categoria de equipo</label>
              <select className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs" value={categoriaEquipo} onChange={e => setCategoriaEquipo(e.target.value)}>
                <option value="">Seleccionar</option>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <Input size="sm" label="Condicion *" value={condicion} onChange={e => setCondicion(e.target.value)} error={errors.condicion} placeholder="Ej: Bueno, Reacondicionado" />
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
