import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/StatusBadge';
import type { CuotaFila, EstadoCuotaFila } from '../../hooks/useCuotasPorFacturar';

interface Props {
  fila: CuotaFila;
  ocupada: boolean;
  onGenerar: () => void;
  onFacturadaExterna: () => void;
  onRegistrarFactura: () => void;
}

const ESTADO_LABEL: Record<EstadoCuotaFila, string> = {
  por_facturar: 'Por facturar', solicitada: 'Aviso enviado', facturada: 'Facturada', cobrada: 'Cobrada',
};
const ESTADO_COLOR: Record<EstadoCuotaFila, string> = {
  por_facturar: 'bg-amber-50 text-amber-700 border-amber-200',
  solicitada: 'bg-sky-50 text-sky-700 border-sky-200',
  facturada: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cobrada: 'bg-slate-100 text-slate-600 border-slate-200',
};

const fmtMes = (iso: string) => {
  const [y, m] = iso.slice(0, 7).split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' });
};
const fmtDia = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');

const td = 'px-3 py-1.5 text-xs text-slate-700 whitespace-nowrap';

/** Fila compacta de "Cuotas por facturar" (2026-09-16, estilo listado de importaciones). */
export function CuotaFilaRow({ fila, ocupada, onGenerar, onFacturadaExterna, onRegistrarFactura }: Props) {
  const sol = fila.solicitud;
  const automatico = !!sol?.observaciones?.includes('Aviso automático');
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/50">
      <td className={`${td} font-medium text-slate-800 max-w-[220px] truncate`} title={fila.clienteNombre}>{fila.clienteNombre}</td>
      <td className={`${td} font-mono text-slate-500`}>
        {fila.ppto.numero}
        {fila.origen === 'contrato' && <span className="ml-1 text-[9px] uppercase tracking-wide text-teal-700">contrato</span>}
      </td>
      <td className={td}>{fila.descripcion}</td>
      <td className={td}>{fmtMes(fila.fecha)}</td>
      <td className={`${td} font-mono text-right`}>{fila.montoTexto}</td>
      <td className={td}><StatusBadge label={ESTADO_LABEL[fila.estado]} colorClass={ESTADO_COLOR[fila.estado]} /></td>
      <td className={`${td} text-slate-500`}>
        {sol ? (
          <>
            {fmtDia(sol.createdAt)}
            {automatico && <span className="ml-1 text-[9px] uppercase tracking-wide text-slate-400" title="Generado solo el primer día hábil">auto</span>}
            {sol.facturadaExterna && <span className="ml-1 text-[9px] uppercase tracking-wide text-slate-400" title="Facturada fuera del sistema">externa</span>}
          </>
        ) : '—'}
      </td>
      <td className={`${td} font-mono`}>{sol?.numeroFactura || '—'}</td>
      <td className={`${td} text-right`}>
        {fila.estado === 'por_facturar' && (
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={onFacturadaExterna} disabled={ocupada}
              title="Ya se facturó por fuera del sistema: registrarla sin generar aviso">Por fuera</Button>
            <Button size="sm" onClick={onGenerar} disabled={ocupada}>{ocupada ? 'Generando…' : 'Generar aviso'}</Button>
          </div>
        )}
        {fila.estado === 'solicitada' && sol && (
          <Button size="sm" variant="secondary" onClick={onRegistrarFactura} disabled={ocupada}>Registrar factura</Button>
        )}
      </td>
    </tr>
  );
}
