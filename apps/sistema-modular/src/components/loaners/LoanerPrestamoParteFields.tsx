import { useEffect, useState } from 'react';
import { articulosService } from '../../services/stockService';
import type { Articulo, ParteLoanerPrestada } from '@ags/shared';
import { LoanerParteRow } from './LoanerParteRow';

type Alcance = 'modulo' | 'parte';

interface Props {
  alcance: Alcance;
  onAlcanceChange: (a: Alcance) => void;
  partes: ParteLoanerPrestada[];
  onPartesChange: (p: ParteLoanerPrestada[]) => void;
}

export const PARTE_VACIA = (): ParteLoanerPrestada =>
  ({ id: crypto.randomUUID(), descripcion: '', codigoArticulo: null, articuloId: null, serie: null, dejaInoperativo: true });

/**
 * Qué se presta: el módulo entero o partes suyas (2026-09-04; varias en el
 * mismo movimiento desde 2026-09-08). Con partes el módulo sigue en base; si
 * alguna lo deja inoperativo, figura INCOMPLETO hasta que se reinstale.
 */
export function LoanerPrestamoParteFields({ alcance, onAlcanceChange, partes, onPartesChange }: Props) {
  const [articulos, setArticulos] = useState<Articulo[]>([]);

  useEffect(() => {
    if (alcance !== 'parte' || articulos.length > 0) return;
    articulosService.getAll({ activoOnly: true })
      .then(setArticulos)
      .catch(err => console.error('[LoanerPrestamoParteFields] artículos:', err));
  }, [alcance, articulos.length]);

  const setParte = (i: number, p: ParteLoanerPrestada) => onPartesChange(partes.map((x, j) => (j === i ? p : x)));

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Qué se presta</label>
        <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
          {([['modulo', 'Módulo completo'], ['parte', 'Partes']] as const).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => onAlcanceChange(v)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                alcance === v ? 'bg-teal-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {alcance === 'parte' && (
        <div className="space-y-3">
          {partes.map((p, i) => (
            <LoanerParteRow
              key={p.id ?? i}
              indice={i}
              parte={p}
              articulos={articulos}
              onChange={np => setParte(i, np)}
              onRemove={partes.length > 1 ? () => onPartesChange(partes.filter((_, j) => j !== i)) : undefined}
            />
          ))}
          <button
            type="button"
            onClick={() => onPartesChange([...partes, PARTE_VACIA()])}
            className="text-[11px] text-teal-700 hover:underline"
          >
            + Otra parte del mismo módulo
          </button>
        </div>
      )}
    </div>
  );
}
