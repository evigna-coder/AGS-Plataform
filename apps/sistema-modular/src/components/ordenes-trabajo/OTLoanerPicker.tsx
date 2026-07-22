import { useEffect, useState } from 'react';
import { SearchableSelect } from '../ui/SearchableSelect';
import { categoriasModuloService } from '../../services/firebaseService';
import { loanersService } from '../../services/loanersService';
import type { CategoriaModulo, Loaner } from '@ags/shared';

const lbl = 'block text-[11px] font-medium text-slate-500 mb-0.5';

interface Props {
  /** Id del loaner actualmente elegido ('' si ninguno). */
  loanerId: string;
  onSelect: (loaner: Loaner | null) => void;
}

/**
 * Cascada Categoría de módulo → loaner disponible, para OTs sobre módulos AGS
 * (reemplaza el selector de equipo/sistema en CreateOTModal cuando el toggle
 * "OT sobre módulo AGS" está activo). Solo lista loaners 'en_base' activos.
 */
export function OTLoanerPicker({ loanerId, onSelect }: Props) {
  const [categorias, setCategorias] = useState<CategoriaModulo[]>([]);
  const [loaners, setLoaners] = useState<Loaner[]>([]);
  const [categoriaId, setCategoriaId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      categoriasModuloService.getAll().catch(() => [] as CategoriaModulo[]),
      loanersService.getDisponibles().catch(() => [] as Loaner[]),
    ]).then(([cats, lns]) => {
      if (cancelled) return;
      setCategorias(cats);
      setLoaners(lns);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const filtrados = categoriaId
    ? loaners.filter(l => l.categoriaModuloId === categoriaId)
    : loaners;
  const seleccionado = loaners.find(l => l.id === loanerId) ?? null;

  const loanerLabel = (l: Loaner) =>
    `${l.codigo} — ${l.moduloCodigo ?? l.descripcion}${l.serie ? ` (SN ${l.serie})` : ''}`;

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className={lbl}>Categoria de modulo</label>
        <SearchableSelect
          value={categoriaId}
          onChange={v => {
            setCategoriaId(v);
            // Si el loaner elegido no pertenece a la nueva categoría, limpiarlo.
            if (seleccionado && v && seleccionado.categoriaModuloId !== v) onSelect(null);
          }}
          options={[
            { value: '', label: 'Todas las categorias' },
            ...categorias.map(c => ({ value: c.id, label: c.nombre })),
          ]}
          placeholder={loading ? 'Cargando...' : 'Filtrar por categoria...'} />
      </div>
      <div>
        <label className={lbl}>Modulo AGS (loaner) *</label>
        <SearchableSelect
          value={loanerId}
          onChange={v => onSelect(loaners.find(l => l.id === v) ?? null)}
          options={[
            { value: '', label: 'Sin seleccionar' },
            ...filtrados.map(l => ({ value: l.id, label: loanerLabel(l) })),
          ]}
          placeholder={loading
            ? 'Cargando...'
            : filtrados.length === 0 ? 'Sin loaners disponibles' : 'Seleccionar loaner...'} />
        {!loading && filtrados.length === 0 && (
          <p className="mt-1 text-[10px] text-amber-600">
            No hay loaners disponibles (en base){categoriaId ? ' en esta categoria' : ''}.
          </p>
        )}
      </div>
    </div>
  );
}
