import { useMemo, useState } from 'react';
import { costoUnitarioVigente, factorImportacionVigente } from '@ags/shared';
import type { UnidadStock, CondicionUnidad, EstadoUnidad } from '@ags/shared';

const CONDICION_LABELS: Record<CondicionUnidad, string> = { nuevo: 'Nuevo', bien_de_uso: 'Bien de uso', reacondicionado: 'Reacondicionado', vendible: 'Vendible', scrap: 'Scrap' };
const CONDICION_COLORS: Record<CondicionUnidad, string> = { nuevo: 'bg-green-100 text-green-700', bien_de_uso: 'bg-blue-100 text-blue-700', reacondicionado: 'bg-amber-100 text-amber-700', vendible: 'bg-teal-100 text-teal-700', scrap: 'bg-red-100 text-red-700' };
const ESTADO_LABELS: Record<EstadoUnidad, string> = { disponible: 'Disponible', reservado: 'Reservado', asignado: 'Asignado', en_transito: 'En transito', consumido: 'Consumido', vendido: 'Vendido', entregado: 'Entregado', baja: 'Baja' };
const ESTADO_COLORS: Record<EstadoUnidad, string> = { disponible: 'bg-green-100 text-green-700', reservado: 'bg-amber-100 text-amber-700', asignado: 'bg-blue-100 text-blue-700', en_transito: 'bg-purple-100 text-purple-700', consumido: 'bg-slate-100 text-slate-500', vendido: 'bg-slate-100 text-slate-500', entregado: 'bg-teal-100 text-teal-700', baja: 'bg-red-100 text-red-700' };
const UBICACION_LABELS: Record<string, string> = { posicion: 'Posicion', minikit: 'Minikit', ingeniero: 'Ingeniero', cliente: 'Cliente', proveedor: 'Proveedor', transito: 'En transito', remito: 'Remito' };

/**
 * Desglose de unidades de un artículo, AGRUPADO (2026-08-27): las unidades sin
 * serie ni lote que comparten condición, estado, reserva, ubicación y costo se
 * muestran como UNA fila con la cantidad sumada — la misma reserva de un
 * presupuesto desglosada en 4 tandas idénticas era puro ruido. Las tandas
 * siguen existiendo como documentos (costo por lote); el chip "×N tandas"
 * expande el grupo para operar una tanda puntual (Ajustar/Mover son por doc).
 */
interface Grupo {
  key: string;
  units: UnidadStock[];
  cantidad: number;
}

const grupoKey = (u: UnidadStock): string => {
  if (u.nroSerie) return `serie:${u.id}`; // serializadas nunca se unifican
  return [
    u.nroLote ?? '', u.condicion, u.estado,
    u.reservadoParaPresupuestoNumero ?? '',
    u.ubicacion.tipo, u.ubicacion.referenciaId ?? '',
    costoUnitarioVigente(u) ?? '', factorImportacionVigente(u) ?? '',
    u.monedaCosto ?? '', u.costeoConfirmadoAt ? 'conf' : 'est',
    u.activo === false ? 'inactiva' : 'activa',
  ].join('|');
};

const CostoFactorCell = ({ u }: { u: UnidadStock }) => {
  const costo = costoUnitarioVigente(u);
  const factor = factorImportacionVigente(u);
  if (costo == null && factor == null) return <span className="text-slate-300">—</span>;
  const confirmado = !!u.costeoConfirmadoAt;
  return (
    <span className="inline-flex flex-col items-end leading-tight">
      {costo != null && (
        <span className="font-mono text-slate-700 tabular-nums">{u.monedaCosto ?? 'USD'} {costo.toFixed(2)}</span>
      )}
      {factor != null && (
        <span className={`font-mono text-[10px] tabular-nums ${confirmado ? 'text-teal-600' : 'text-amber-600'}`}
          title={confirmado
            ? `Costeo confirmado el ${u.costeoConfirmadoAt!.slice(0, 10)}${u.factorImportacion != null ? ` · estimado original ${u.factorImportacion.toFixed(3)}` : ''}`
            : 'Costeo estimado — todavía sin confirmar contra las facturas reales'}>
          factor {factor.toFixed(3)}{confirmado ? '' : ' (est.)'}
        </span>
      )}
    </span>
  );
};

interface Props {
  units: UnidadStock[];
  onAjustar: (u: UnidadStock) => void;
  onMover?: (u: UnidadStock) => void;
  onLiberar?: (u: UnidadStock) => void;
  /** Liberar TODAS las unidades de un grupo unificado (una sola confirmación). */
  onLiberarGrupo?: (units: UnidadStock[]) => void;
}

export const UnidadesSubTable = ({ units, onAjustar, onMover, onLiberar, onLiberarGrupo }: Props) => {
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const grupos = useMemo<Grupo[]>(() => {
    const map = new Map<string, Grupo>();
    for (const u of units) {
      const key = grupoKey(u);
      const g = map.get(key);
      if (g) { g.units.push(u); g.cantidad += u.cantidad ?? 1; }
      else map.set(key, { key, units: [u], cantidad: u.cantidad ?? 1 });
    }
    return [...map.values()];
  }, [units]);

  const toggle = (key: string) => setAbiertos(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const fila = (u: UnidadStock, opts: { grupo?: Grupo; tanda?: boolean }) => {
    const esGrupo = !!opts.grupo && opts.grupo.units.length > 1;
    const cantidad = esGrupo ? opts.grupo!.cantidad : (u.cantidad ?? 1);
    return (
      <tr key={esGrupo ? opts.grupo!.key : u.id} className={`hover:bg-slate-50 ${!u.activo ? 'opacity-50' : ''} ${opts.tanda ? 'bg-slate-50/70' : ''}`}>
        <td className="px-2 py-1.5 text-right font-semibold text-slate-700">
          {opts.tanda && <span className="text-slate-300 mr-1">└</span>}{cantidad}
        </td>
        <td className="px-2 py-1.5 font-mono text-slate-700">{u.nroSerie || '—'}</td>
        <td className="px-2 py-1.5 font-mono text-slate-600">{u.nroLote || '—'}</td>
        <td className="px-2 py-1.5 text-center">
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${CONDICION_COLORS[u.condicion]}`}>{CONDICION_LABELS[u.condicion]}</span>
        </td>
        <td className="px-2 py-1.5 text-center">
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${ESTADO_COLORS[u.estado]}`}>{ESTADO_LABELS[u.estado]}</span>
          {u.estado === 'reservado' && u.reservadoParaPresupuestoNumero && (
            <div className="text-[9px] text-slate-400 font-mono mt-0.5">{u.reservadoParaPresupuestoNumero}</div>
          )}
        </td>
        <td className="px-2 py-1.5 text-slate-600">
          {UBICACION_LABELS[u.ubicacion.tipo] ?? u.ubicacion.tipo}
          {u.ubicacion.referenciaNombre && <span className="text-slate-400"> — {u.ubicacion.referenciaNombre}</span>}
        </td>
        <td className="px-2 py-1.5 text-right whitespace-nowrap"><CostoFactorCell u={u} /></td>
        <td className="px-2 py-1.5 text-center whitespace-nowrap">
          {esGrupo ? (
            <>
              {onLiberarGrupo && u.estado === 'reservado' && (
                <button onClick={() => onLiberarGrupo(opts.grupo!.units)} className="text-[10px] font-medium text-amber-600 hover:text-amber-800 px-1.5 py-0.5 rounded hover:bg-amber-50">Liberar</button>
              )}
              <button onClick={() => toggle(opts.grupo!.key)}
                title="Este renglón unifica varias tandas de ingreso idénticas — expandir para Mover/Ajustar una tanda puntual"
                className="text-[10px] font-medium text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded hover:bg-slate-100">
                {abiertos.has(opts.grupo!.key) ? '− tandas' : `×${opts.grupo!.units.length} tandas`}
              </button>
            </>
          ) : (
            <>
              {onMover && u.estado === 'disponible' && (
                <button onClick={() => onMover(u)} className="text-[10px] font-medium text-teal-600 hover:text-teal-800 px-1.5 py-0.5 rounded hover:bg-teal-50">Mover</button>
              )}
              {onLiberar && u.estado === 'reservado' && (
                <button onClick={() => onLiberar(u)} className="text-[10px] font-medium text-amber-600 hover:text-amber-800 px-1.5 py-0.5 rounded hover:bg-amber-50">Liberar</button>
              )}
              <button onClick={() => onAjustar(u)} className="text-[10px] font-medium text-slate-500 hover:text-slate-700 px-1.5 py-0.5 rounded hover:bg-slate-100">Ajustar</button>
            </>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[#F0F0F0] text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wider">
            <th className="py-1.5 px-2 w-12 text-right">Cant.</th>
            <th className="py-1.5 px-2 text-left">Nº serie</th>
            <th className="py-1.5 px-2 text-left">Nº lote</th>
            <th className="py-1.5 px-2 text-center">Condición</th>
            <th className="py-1.5 px-2 text-center">Estado</th>
            <th className="py-1.5 px-2 text-left">Ubicación</th>
            <th className="py-1.5 px-2 text-right w-28">Costo / factor</th>
            <th className="py-1.5 px-2 w-24" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {grupos.map(g => {
            const abierto = g.units.length > 1 && abiertos.has(g.key);
            return (
              <FragmentGrupo key={g.key} filaGrupo={fila(g.units[0], { grupo: g })}
                tandas={abierto ? g.units.map(u => fila(u, { tanda: true })) : null} />
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/** Fila del grupo + (si está expandido) una fila por tanda. */
const FragmentGrupo = ({ filaGrupo, tandas }: { filaGrupo: React.ReactNode; tandas: React.ReactNode[] | null }) => (
  <>
    {filaGrupo}
    {tandas}
  </>
);
