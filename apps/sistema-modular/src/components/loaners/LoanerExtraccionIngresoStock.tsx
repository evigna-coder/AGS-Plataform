import { useEffect, useMemo, useState } from 'react';
import { SearchableSelect } from '../ui/SearchableSelect';
import { Input } from '../ui/Input';
import { articulosService } from '../../services/stockService';
import { posicionesStockService } from '../../services/firebaseService';
import type { Articulo, CondicionUnidad, PosicionStock } from '@ags/shared';

/** Datos del alta en stock de la pieza extraída. `null` = no entra al inventario. */
export interface IngresoStockExtraccion {
  articuloId: string;
  articuloCodigo: string;
  articuloDescripcion: string;
  condicion: CondicionUnidad;
  cantidad: number;
  nroSerie: string | null;
  ubicacion: { tipo: 'posicion'; referenciaId: string; referenciaNombre: string };
}

interface Props {
  value: IngresoStockExtraccion | null;
  onChange: (v: IngresoStockExtraccion | null) => void;
}

const lbl = 'block text-[10px] font-mono font-medium text-slate-500 mb-0.5 uppercase tracking-wide';
const selectClass = 'w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500';

/**
 * Alta en stock de la pieza que se saca de un loaner (2026-08-20).
 *
 * Va como subcomponente y no dentro del modal para no pasarlo de presupuesto de
 * líneas: el modal ya trae cinco campos propios.
 *
 * La condición arranca en "bien de uso": una pieza que sale de un equipo en
 * préstamo es usada por definición. Se puede cambiar (una parte nueva que nunca
 * llegó a trabajar, o scrap si sale rota) pero el default es el caso real.
 */
export function LoanerExtraccionIngresoStock({ value, onChange }: Props) {
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [posiciones, setPosiciones] = useState<PosicionStock[]>([]);

  useEffect(() => {
    Promise.all([
      articulosService.getAll({ activoOnly: true }),
      posicionesStockService.getAll(),
    ]).then(([arts, pos]) => {
      setArticulos(arts);
      setPosiciones(pos);
    }).catch(err => console.error('[LoanerExtraccionIngresoStock] cargando catálogos', err));
  }, []);

  const articuloOpts = useMemo(
    () => articulos.map(a => ({ value: a.id, label: a.descripcion ?? a.codigo ?? a.id, linkedCode: a.codigo })),
    [articulos],
  );
  const posicionOpts = useMemo(
    () => posiciones.map(p => ({ value: p.id, label: `${p.codigo} — ${p.nombre}` })),
    [posiciones],
  );

  const set = (patch: Partial<IngresoStockExtraccion>) => {
    if (!value) return;
    onChange({ ...value, ...patch });
  };

  if (!value) return null;

  return (
    <div className="space-y-3 border-l-2 border-teal-200 pl-3">
      <div>
        <label className={lbl}>Artículo del catálogo *</label>
        <SearchableSelect
          value={value.articuloId}
          onChange={id => {
            const a = articulos.find(x => x.id === id);
            set({
              articuloId: id,
              articuloCodigo: a?.codigo ?? '',
              articuloDescripcion: a?.descripcion ?? '',
            });
          }}
          options={articuloOpts}
          placeholder="Buscar artículo por código o descripción..."
          emptyMessage="Sin artículos"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={lbl}>Condición</label>
          <select
            value={value.condicion}
            onChange={e => set({ condicion: e.target.value as CondicionUnidad })}
            className={selectClass}
          >
            <option value="bien_de_uso">Bien de uso (usada)</option>
            <option value="nuevo">Nuevo</option>
            <option value="reacondicionado">Reacondicionado</option>
            <option value="vendible">Vendible</option>
            <option value="scrap">Scrap</option>
          </select>
        </div>
        <Input
          label="Cantidad"
          type="number"
          min={1}
          value={String(value.cantidad)}
          onChange={e => set({ cantidad: Math.max(1, Number(e.target.value) || 1) })}
        />
      </div>
      <Input
        label="N° de serie de la pieza"
        value={value.nroSerie ?? ''}
        onChange={e => set({ nroSerie: e.target.value.trim() || null })}
        placeholder="Opcional"
      />
      <div>
        <label className={lbl}>Ubicación donde queda *</label>
        <SearchableSelect
          value={value.ubicacion.referenciaId}
          onChange={id => {
            const p = posiciones.find(x => x.id === id);
            set({ ubicacion: { tipo: 'posicion', referenciaId: id, referenciaNombre: p ? `${p.codigo} — ${p.nombre}` : '' } });
          }}
          options={posicionOpts}
          placeholder="Elegí la posición..."
          emptyMessage="Sin posiciones"
        />
      </div>
    </div>
  );
}
