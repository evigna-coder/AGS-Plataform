import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { loanersService } from '../../services/firebaseService';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { LoanerCategoriaModuloPicker, type ModuloSelection } from '../../components/loaners/LoanerCategoriaModuloPicker';
import type { Loaner, EstadoLoaner, CategoriaEquipoStock } from '@ags/shared';
import { useNavigateBack } from '../../hooks/useNavigateBack';

const CATEGORIAS: CategoriaEquipoStock[] = ['HPLC', 'GC', 'MSD', 'UV', 'OSMOMETRO', 'GENERAL'];

const EMPTY_MODULO: ModuloSelection = {
  categoriaModuloId: null, categoriaModuloNombre: null,
  moduloCodigo: null, moduloDescripcion: null, moduloMarca: null,
};

export function LoanerEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const goBack = useNavigateBack();
  const isEdit = Boolean(id);
  const [saving, setSaving] = useState(false);

  const [descripcion, setDescripcion] = useState('');
  const [modulo, setModulo] = useState<ModuloSelection>(EMPTY_MODULO);
  // Artículo vinculado al vender (se preserva en edición, no se edita acá).
  const [articulo, setArticulo] = useState<{ id: string | null; codigo: string | null; descripcion: string | null }>({ id: null, codigo: null, descripcion: null });
  const [serie, setSerie] = useState('');
  const [categoriaEquipo, setCategoriaEquipo] = useState('');
  const [condicion, setCondicion] = useState('Bueno');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const catOptions = useMemo(() => CATEGORIAS.map(c => ({ value: c, label: c })), []);

  useEffect(() => {
    if (!id) return;
    loanersService.getById(id).then(l => {
      if (!l) return navigate('/loaners');
      setDescripcion(l.descripcion);
      setArticulo({ id: l.articuloId ?? null, codigo: l.articuloCodigo ?? null, descripcion: l.articuloDescripcion ?? null });
      setModulo({
        categoriaModuloId: l.categoriaModuloId ?? null,
        categoriaModuloNombre: l.categoriaModuloNombre ?? null,
        moduloCodigo: l.moduloCodigo ?? null,
        moduloDescripcion: l.moduloDescripcion ?? null,
        moduloMarca: l.moduloMarca ?? null,
      });
      setSerie(l.serie || '');
      setCategoriaEquipo(l.categoriaEquipo || '');
      setCondicion(l.condicion);
    });
  }, [id, navigate]);

  /** La descripción sale del catálogo cuando hay modelo vinculado — ver CreateLoanerModal. */
  const descripcionCatalogo = modulo.moduloDescripcion?.trim() ?? '';
  const descripcionFinal = descripcionCatalogo || descripcion;

  const handleModuloChange = (sel: ModuloSelection) => {
    setModulo(sel);
    if (errors.descripcion) setErrors(prev => ({ ...prev, descripcion: '' }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!descripcionFinal.trim()) e.descripcion = 'Vinculá un modelo del catálogo o escribí una descripción';
    if (!condicion.trim()) e.condicion = 'Requerido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      // Nº de serie único entre loaners activos (2026-09-01). Al editar, el
      // propio loaner no cuenta.
      if (serie.trim()) {
        const enUso = await loanersService.findBySerie(serie, isEdit ? id : undefined).catch(() => null);
        if (enUso) {
          setErrors({ serie: `El nº de serie ya está en el loaner ${enUso.codigo} (${enUso.descripcion}).` });
          setSaving(false);
          return;
        }
      }
      const data: Omit<Loaner, 'id' | 'codigo' | 'createdAt' | 'updatedAt'> = {
        descripcion: descripcionFinal.trim(),
        articuloId: articulo.id,
        articuloCodigo: articulo.codigo,
        articuloDescripcion: articulo.descripcion,
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
    <div className="h-full flex flex-col">
      <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 tracking-tight">
            {isEdit ? 'Editar loaner' : 'Nuevo loaner'}
          </h1>
          <p className="text-xs text-slate-500">Equipo de la empresa para prestamo o venta</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => goBack()}>Cancelar</Button>
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
                <Input
                  label="Descripcion *"
                  value={descripcionFinal}
                  onChange={e => setDescripcion(e.target.value)}
                  disabled={!!descripcionCatalogo}
                  description={descripcionCatalogo
                    ? 'Se toma del catálogo de módulos. Para cambiarla, editá el modelo en Categorías de módulo.'
                    : 'Se completa sola al vincular un modelo del catálogo.'}
                  error={errors.descripcion}
                  placeholder="Ej: Bomba cuaternaria 1260 Infinity II"
                />
              </div>
              <LoanerCategoriaModuloPicker
                categoriaModuloId={modulo.categoriaModuloId || ''}
                moduloCodigo={modulo.moduloCodigo || ''}
                onChange={handleModuloChange}
              />
              <Input label="Numero de serie" value={serie}
                onChange={e => { setSerie(e.target.value); if (errors.serie) setErrors(prev => ({ ...prev, serie: '' })); }}
                error={errors.serie} placeholder="S/N" />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Categoria de equipo</label>
                <SearchableSelect value={categoriaEquipo} onChange={setCategoriaEquipo} options={catOptions} placeholder="Seleccionar" />
              </div>
              <Input label="Condicion *" value={condicion} onChange={e => setCondicion(e.target.value)} error={errors.condicion} placeholder="Ej: Bueno, Reacondicionado" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
