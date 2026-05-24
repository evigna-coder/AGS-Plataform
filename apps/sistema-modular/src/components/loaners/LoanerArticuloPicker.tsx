import { useEffect, useState } from 'react';
import { SearchableSelect } from '../ui/SearchableSelect';
import { articulosService } from '../../services/stockService';
import type { Articulo } from '@ags/shared';

interface Props {
  /** Mounted only by the parent when loaner.articuloId is null; we still re-check on open. */
  open: boolean;
  value: string;
  onChange: (articuloId: string, articulo: Articulo | null) => void;
  /** Surfaces fetch errors to the parent for inline display in the modal banner. */
  onError: (msg: string) => void;
}

// Editorial Teal label convention (mirror DesagregarStockModal + repo wide).
const lbl =
  'block text-[10px] font-mono font-medium text-slate-500 mb-0.5 uppercase tracking-wide';

/**
 * Sub-component: SearchableSelect bloqueante que vincula un artículo del catálogo
 * a un loaner que no tenía `articuloId` previo. Extraído del LoanerVentaModal en
 * plan 15-03 para mantener el modal bajo budget (precedente Phase 14:
 * `PatronComponentesEditor` extraído de `PatronEditorPage`).
 *
 * Pitfall 6: `{ activoOnly: true }` explícito para no traer artículos dados de baja.
 */
export function LoanerArticuloPicker({ open, value, onChange, onError }: Props) {
  const [articulos, setArticulos] = useState<Articulo[]>([]);

  useEffect(() => {
    if (!open) return;
    articulosService
      .getAll({ activoOnly: true })
      .then(arts => setArticulos(arts))
      .catch(err => {
        console.error('[LoanerArticuloPicker] cargando artículos', err);
        onError('No se pudieron cargar los artículos. Reintentá o cancelá.');
      });
  }, [open, onError]);

  const handleChange = (id: string) => {
    const art = articulos.find(a => a.id === id) ?? null;
    onChange(id, art);
  };

  return (
    <div>
      <label className={lbl}>Vincular artículo del catálogo *</label>
      <SearchableSelect
        value={value}
        onChange={handleChange}
        options={articulos.map(a => ({
          value: a.id,
          label: a.descripcion ?? a.codigo ?? a.id,
          linkedCode: a.codigo,
        }))}
        placeholder="Buscar artículo..."
        required
      />
    </div>
  );
}
