import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';
import { LoanerCategoriaModuloPicker, type ModuloSelection } from './LoanerCategoriaModuloPicker';
import { LoanerArticuloPicker } from './LoanerArticuloPicker';
import type { Articulo } from '@ags/shared';
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
  /**
   * Artículo del catálogo (2026-08-23). Se vinculaba recién AL VENDER, y por eso
   * el remito de préstamo salía sin número de parte: el loaner no tenía de dónde
   * sacarlo. Un loaner es un artículo del catálogo desde que entra a la casa.
   */
  const [articulo, setArticulo] = useState<Articulo | null>(null);

  const catOptions = useMemo(() => CATEGORIAS.map(c => ({ value: c, label: c })), []);

  /**
   * La descripción SALE DEL CATÁLOGO cuando hay un modelo vinculado
   * (2026-09-01). Antes se escribía a mano —el modelo solo la sugería si el
   * campo estaba vacío— y dos loaners del mismo módulo terminaban con textos
   * distintos, que es lo que rompe el resumen por tipo. Queda manual solo
   * cuando el loaner no se vincula a ningún modelo.
   */
  const descripcionCatalogo = modulo.moduloDescripcion?.trim() ?? '';
  const descripcionFinal = descripcionCatalogo || descripcion;

  const handleModuloChange = (sel: ModuloSelection) => {
    setModulo(sel);
    if (errors.descripcion) setErrors(prev => ({ ...prev, descripcion: '' }));
  };

  const resetForm = () => {
    setDescripcion(''); setModulo(EMPTY_MODULO); setSerie('');
    setCategoriaEquipo(''); setCondicion('Bueno'); setArticulo(null); setErrors({});
  };

  const handleClose = () => { resetForm(); onClose(); };

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
      // El nº de serie identifica una máquina física: no puede repetirse entre
      // loaners activos (2026-09-01). Se chequea acá y no en validate() porque
      // requiere ir a la base.
      if (serie.trim()) {
        const enUso = await loanersService.findBySerie(serie).catch(() => null);
        if (enUso) {
          setErrors({ serie: `El nº de serie ya está en el loaner ${enUso.codigo} (${enUso.descripcion}).` });
          setSaving(false);
          return;
        }
      }
      const data: Omit<Loaner, 'id' | 'codigo' | 'createdAt' | 'updatedAt'> = {
        descripcion: descripcionFinal.trim(),
        articuloId: articulo?.id ?? null,
        articuloCodigo: articulo?.codigo ?? null,
        articuloDescripcion: articulo?.descripcion ?? null,
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
              <Input
                inputSize="sm"
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
              size="sm"
              categoriaModuloId={modulo.categoriaModuloId || ''}
              moduloCodigo={modulo.moduloCodigo || ''}
              onChange={handleModuloChange}
            />
            {/* Sin esto el remito de préstamo sale sin código de artículo. */}
            <LoanerArticuloPicker
              open
              value={articulo?.id ?? ''}
              onChange={(_id, a) => setArticulo(a)}
              onError={msg => setErrors(prev => ({ ...prev, articulo: msg }))}
            />
            {errors.articulo && <p className="text-[11px] text-red-600">{errors.articulo}</p>}
            <Input inputSize="sm" label="Numero de serie" value={serie}
              onChange={e => { setSerie(e.target.value); if (errors.serie) setErrors(prev => ({ ...prev, serie: '' })); }}
              error={errors.serie} placeholder="S/N" />
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Categoria de equipo</label>
              <SearchableSelect size="sm" value={categoriaEquipo} onChange={setCategoriaEquipo} options={catOptions} placeholder="Seleccionar" />
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
