import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { loanersService, articulosService } from '../../services/firebaseService';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import type { Loaner, Articulo, EstadoLoaner, CategoriaEquipoStock } from '@ags/shared';

const CATEGORIAS: CategoriaEquipoStock[] = ['HPLC', 'GC', 'MSD', 'UV', 'OSMOMETRO', 'GENERAL'];

export function LoanerEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [saving, setSaving] = useState(false);

  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [descripcion, setDescripcion] = useState('');
  const [articuloId, setArticuloId] = useState('');
  const [serie, setSerie] = useState('');
  const [categoriaEquipo, setCategoriaEquipo] = useState('');
  const [condicion, setCondicion] = useState('Bueno');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    articulosService.getAll({ activoOnly: true }).then(setArticulos);
  }, []);

  useEffect(() => {
    if (!id) return;
    loanersService.getById(id).then(l => {
      if (!l) return navigate('/loaners');
      setDescripcion(l.descripcion);
      setArticuloId(l.articuloId || '');
      setSerie(l.serie || '');
      setCategoriaEquipo(l.categoriaEquipo || '');
      setCondicion(l.condicion);
    });
  }, [id, navigate]);

  // Auto-fill from articulo
  useEffect(() => {
    if (!articuloId) return;
    const art = articulos.find(a => a.id === articuloId);
    if (art) {
      if (!descripcion) setDescripcion(art.descripcion);
      if (!categoriaEquipo) setCategoriaEquipo(art.categoriaEquipo);
    }
  }, [articuloId, articulos, descripcion, categoriaEquipo]);

  const selectedArticulo = articulos.find(a => a.id === articuloId);

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

      if (isEdit) {
        await loanersService.update(id!, data);
        navigate(`/loaners/${id}`);
      } else {
        const loanerId = await loanersService.create(data);
        navigate(`/loaners/${loanerId}`);
      }
    } catch (err) {
      console.error('Error guardando loaner:', err);
      alert('Error al guardar el loaner');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col">
      <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 tracking-tight">
            {isEdit ? 'Editar loaner' : 'Nuevo loaner'}
          </h1>
          <p className="text-xs text-slate-500">Equipo de la empresa para prestamo o venta</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate('/loaners')}>Cancelar</Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50 px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <Card title="Identificacion del equipo">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Input label="Descripcion *" value={descripcion} onChange={e => setDescripcion(e.target.value)} error={errors.descripcion} placeholder="Ej: Bomba cuaternaria 1260 Infinity II" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Vincular a articulo de stock</label>
                <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={articuloId} onChange={e => setArticuloId(e.target.value)}>
                  <option value="">Sin vincular</option>
                  {articulos.map(a => <option key={a.id} value={a.id}>{a.codigo} — {a.descripcion}</option>)}
                </select>
              </div>
              <Input label="Numero de serie" value={serie} onChange={e => setSerie(e.target.value)} placeholder="S/N" />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Categoria de equipo</label>
                <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={categoriaEquipo} onChange={e => setCategoriaEquipo(e.target.value)}>
                  <option value="">Seleccionar</option>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <Input label="Condicion *" value={condicion} onChange={e => setCondicion(e.target.value)} error={errors.condicion} placeholder="Ej: Bueno, Reacondicionado" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
