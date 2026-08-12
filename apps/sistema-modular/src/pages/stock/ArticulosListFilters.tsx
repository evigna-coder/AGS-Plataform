import { useMemo } from 'react';
import type { CategoriaEquipoStock, Marca, TipoArticulo } from '@ags/shared';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import type { DepositoOption } from './hooks/useDepositoFilter';
// Labels movidos al módulo de export para que el archivo Excel/PDF muestre
// exactamente los mismos textos que los selectores.
import {
  CATEGORIA_ARTICULO_LABELS as CATEGORIA_LABELS,
  TIPO_ARTICULO_LABELS as TIPO_LABELS,
} from '../../utils/exports/exportArticulos';

interface Props {
  localSearch: string;
  onSearchChange: (val: string) => void;
  categoriaEquipo: string;
  onCategoriaChange: (val: string) => void;
  marcaId: string;
  onMarcaChange: (val: string) => void;
  tipo: string;
  onTipoChange: (val: string) => void;
  showInactive: boolean;
  onShowInactiveChange: (val: boolean) => void;
  marcas: Marca[];
  deposito: string;
  onDepositoChange: (val: string) => void;
  depositos: DepositoOption[];
}

/**
 * Phase 13 STKE-07 — filter bar extracted from ArticulosList for LOC budget compliance.
 * Renders the search input + categoria/marca/tipo selects + showInactive toggle.
 */
export function ArticulosListFilters({
  localSearch,
  onSearchChange,
  categoriaEquipo,
  onCategoriaChange,
  marcaId,
  onMarcaChange,
  tipo,
  onTipoChange,
  showInactive,
  onShowInactiveChange,
  marcas,
  deposito,
  onDepositoChange,
  depositos,
}: Props) {
  const depositoOptions = useMemo(
    () => [{ value: '', label: 'Todos los depositos' }, ...depositos],
    [depositos],
  );
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <input
        type="text"
        placeholder="Buscar por codigo o descripcion..."
        value={localSearch}
        onChange={e => onSearchChange(e.target.value)}
        className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs w-56 focus:outline-none focus:ring-2 focus:ring-teal-500"
      />
      <select
        value={categoriaEquipo}
        onChange={e => onCategoriaChange(e.target.value)}
        className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
      >
        <option value="">Todas las categorias</option>
        {(Object.keys(CATEGORIA_LABELS) as CategoriaEquipoStock[]).map(k => (
          <option key={k} value={k}>{CATEGORIA_LABELS[k]}</option>
        ))}
      </select>
      <select
        value={marcaId}
        onChange={e => onMarcaChange(e.target.value)}
        className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
      >
        <option value="">Todas las marcas</option>
        {marcas.map(m => (
          <option key={m.id} value={m.id}>{m.nombre}</option>
        ))}
      </select>
      <select
        value={tipo}
        onChange={e => onTipoChange(e.target.value)}
        className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
      >
        <option value="">Todos los tipos</option>
        {(Object.keys(TIPO_LABELS) as TipoArticulo[]).map(k => (
          <option key={k} value={k}>{TIPO_LABELS[k]}</option>
        ))}
      </select>
      <div className="w-52">
        <SearchableSelect value={deposito} onChange={onDepositoChange} options={depositoOptions} placeholder="Deposito" size="sm" />
      </div>
      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-500">
        <input
          type="checkbox"
          checked={showInactive}
          onChange={e => onShowInactiveChange(e.target.checked)}
          className="w-3.5 h-3.5 rounded border-slate-300"
        />
        Mostrar inactivos
      </label>
    </div>
  );
}
