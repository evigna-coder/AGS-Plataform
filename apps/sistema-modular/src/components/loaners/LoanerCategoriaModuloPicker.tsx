import { useEffect, useState } from 'react';
import { categoriasModuloService } from '../../services/firebaseService';
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

  const selectCls = size === 'sm'
    ? 'w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs'
    : 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm';
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
        <select className={selectCls} value={categoriaModuloId} onChange={e => handleCategoria(e.target.value)}>
          <option value="">Sin vincular</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>
      <div>
        <label className={labelCls}>Modelo</label>
        <select className={selectCls} value={moduloCodigo} onChange={e => handleModelo(e.target.value)} disabled={!selectedCat}>
          <option value="">{selectedCat ? 'Seleccionar modelo' : 'Elegí una categoría primero'}</option>
          {modelos.map(m => (
            <option key={m.codigo} value={m.codigo}>
              {m.codigo} — {m.descripcion}{m.marca ? ` (${m.marca})` : ''}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
