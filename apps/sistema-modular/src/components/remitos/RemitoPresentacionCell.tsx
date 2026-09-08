import type { RemitoItem } from '@ags/shared';
import { cantidadImpresaRemito } from '../../utils/inventarioToRemitoItem';

import { Select } from '../ui/Select';
interface Props {
  item: RemitoItem;
  /** Envases declarados en el artículo base de esta línea. */
  envases: { codigoParte: string; factor: number }[];
  onUpdate: (id: string, patch: Partial<RemitoItem>) => void;
}


/**
 * Con qué código y en qué unidad sale IMPRESA la línea del remito (2026-08-14).
 *
 * El cliente compra por el N° de parte del envase —"5183-2067 × 1"— mientras
 * que el stock vive en unidades del artículo base —"5182-0715 × 10"—. Sin esta
 * elección el papel declaraba un código que el cliente no reconoce en su orden
 * de compra, y la salida era armar la línea a mano, sin descontar stock.
 *
 * La cantidad del remito NO cambia: sigue en unidad base porque es lo que se
 * descuenta. Acá solo se elige cómo se traduce al papel.
 */
export function RemitoPresentacionCell({ item, envases, onUpdate }: Props) {
  // Ítem manual o artículo sin envases declarados: no hay nada que elegir.
  if (!item.unidadId || envases.length === 0) {
    return <span className="block text-[10px] text-slate-400 text-center">—</span>;
  }

  const actual = item.presentacion?.codigoParte ?? '';
  const impresa = cantidadImpresaRemito(item);
  const parcial = item.presentacion != null && !Number.isInteger(impresa as number);

  return (
    <div className="space-y-0.5">
      <Select
        value={actual}
        onChange={e => {
          const env = envases.find(x => x.codigoParte === e.target.value);
          onUpdate(item.id, {
            presentacion: env ? { codigoParte: env.codigoParte, factor: env.factor } : null,
          });
        }}
        className="w-full font-mono" selectSize="xs"
      >
        <option value="">{item.articuloCodigo || 'Unidad'} (unidad)</option>
        {envases.map(e => (
          <option key={e.codigoParte} value={e.codigoParte}>{e.codigoParte} ×{e.factor}</option>
        ))}
      </Select>
      {item.presentacion && (
        <span className={`block text-[9px] ${parcial ? 'text-amber-600' : 'text-slate-400'}`}>
          Imprime {impresa} × {item.presentacion.codigoParte}
          {parcial && ' — envase incompleto'}
        </span>
      )}
    </div>
  );
}
