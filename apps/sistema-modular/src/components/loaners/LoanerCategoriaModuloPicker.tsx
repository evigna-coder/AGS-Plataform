import { useEffect, useMemo, useState } from 'react';
import { categoriasModuloService } from '../../services/firebaseService';
import { SearchableSelect } from '../ui/SearchableSelect';
import type { CategoriaModulo } from '@ags/shared';

export interface ModuloSelection {
  categoriaModuloId: string | null;
  categoriaModuloNombre: string | null;
  moduloCodigo: string | null;
  moduloDescripcion: string | null;
  moduloMarca: string | null;
}

interface Props {
  categoriaModuloId: string;
  moduloCodigo: string;
  onChange: (sel: ModuloSelection) => void;
  size?: 'sm' | 'md';
}

const EMPTY: ModuloSelection = {
  categoriaModuloId: null,
  categoriaModuloNombre: null,
  moduloCodigo: null,
  moduloDescripcion: null,
  moduloMarca: null,
};

/**
 * Cascada Categoría de módulo → Modelo. Reemplaza el viejo "vincular a artículo
 * de stock" en el alta/edición de loaners. Compartido entre CreateLoanerModal y
 * LoanerEditor para no duplicar la lógica de carga + cascada.
 */
export function LoanerCategoriaModuloPicker({ categoriaModuloId, moduloCodigo, onChange, size = 'md' }: Props) {
  const [categorias, setCategorias] = useState<CategoriaModulo[]>([]);

  useEffect(() => {
    categoriasModuloService.getAll().then(setCategorias).catch(() => setCategorias([]));
  }, []);

  const selectedCat = categorias.find(c => c.id === categoriaModuloId);
  const modelos = selectedCat?.modelos ?? [];

  const categoriaOptions = useMemo(
    () => [{ value: '', label: 'Sin vincular' }, ...categorias.map(c => ({ value: c.id, label: c.nombre }))],
    [categorias],
  );
  const modeloOptions = useMemo(
    () => modelos.map(m => ({ value: m.codigo, label: `${m.codigo} — ${m.descripcion}${m.marca ? ` (${m.marca})` : ''}` })),
    [modelos],
  );

  const labelCls = size === 'sm'
    ? 'block text-[11px] font-medium text-slate-500 mb-1'
    : 'block text-sm font-medium text-slate-700 mb-1';

  const handleCategoria = (catId: string) => {
    if (!catId) return onChange(EMPTY);
    const cat = categorias.find(c => c.id === catId);
    onChange({
      categoriaModuloId: catId,
      categoriaModuloNombre: cat?.nombre ?? null,
      moduloCodigo: null,
      moduloDescripcion: null,
      moduloMarca: null,
    });
  };

  const handleModelo = (codigo: string) => {
    const m = modelos.find(x => x.codigo === codigo);
    onChange({
      categoriaModuloId: selectedCat?.id ?? null,
      categoriaModuloNombre: selectedCat?.nombre ?? null,
      moduloCodigo: m?.codigo ?? null,
      moduloDescripcion: m?.descripcion ?? null,
      moduloMarca: m?.marca ?? null,
    });
  };

  return (
    <>
      <div>
        <label className={labelCls}>Categoria de modulo</label>
        <SearchableSelect size={size} value={categoriaModuloId} onChange={handleCategoria} options={categoriaOptions} placeholder="Sin vincular" />
      </div>
      <div>
        <label className={labelCls}>Modelo</label>
        <SearchableSelect
          size={size}
          value={moduloCodigo}
          onChange={handleModelo}
          options={modeloOptions}
          placeholder={selectedCat ? 'Seleccionar modelo' : 'Elegí una categoría primero'}
          disabled={!selectedCat}
        />
      </div>
    </>
  );
}
