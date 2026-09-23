import { useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { usePoolEnvios } from '../../hooks/usePoolEnvios';
import { RegistrarEnvioModal, type PptoEnvioOption } from './RegistrarEnvioModal';
import { PoolEnviosDetalleModal } from './PoolEnviosDetalleModal';
import type { EntregaRow } from '../../utils/entregasResolver';

const fmtUSD = (n: number) => `U$S ${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
const fmtARS = (n: number) => `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const Kpi = ({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: string }) => (
  <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 min-w-[150px]">
    <p className="text-[10px] font-mono uppercase tracking-wide text-slate-400">{label}</p>
    <p className={`text-base font-semibold font-mono ${tone}`}>{value}</p>
    {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
  </div>
);

/**
 * Pool de envíos en Entregas (2026-09-23): saldo disponible para fletes,
 * entrado y gastado en el mes, y las dos acciones: registrar un viaje y ver
 * el libro completo. Los presupuestos de la grilla se ofrecen para vincular.
 */
export function PoolEnviosBar({ rows }: { rows: EntregaRow[] }) {
  const { ledger, resumen, loading, registrar, eliminar } = usePoolEnvios();
  const [registrando, setRegistrando] = useState(false);
  const [detalle, setDetalle] = useState(false);

  const pptoOptions = useMemo<PptoEnvioOption[]>(() => {
    const m = new Map<string, PptoEnvioOption>();
    for (const r of rows) if (!m.has(r.presupuestoId)) m.set(r.presupuestoId, { id: r.presupuestoId, numero: r.presupuestoNumero, clienteNombre: r.clienteNombre });
    return Array.from(m.values()).sort((a, b) => b.numero.localeCompare(a.numero));
  }, [rows]);

  return (
    <div className="flex items-center gap-2 flex-wrap mt-3 px-5">
      <Kpi label="Pool de envíos" value={loading ? '…' : fmtUSD(resumen.saldoUSD)}
        sub={loading ? undefined : `${resumen.cantidadEntradas} entradas · ${resumen.cantidadSalidas} viajes`}
        tone={resumen.saldoUSD < 0 ? 'text-red-600' : 'text-teal-700'} />
      <Kpi label="Entró este mes" value={loading ? '…' : fmtUSD(resumen.entradasMesUSD)} tone="text-emerald-700" />
      <Kpi label="Gastado este mes" value={loading ? '…' : fmtUSD(resumen.salidasMesUSD)}
        sub={loading ? undefined : fmtARS(resumen.salidasMesARS)} tone="text-amber-800" />
      <div className="flex items-center gap-2 ml-auto">
        <Button size="sm" variant="outline" onClick={() => setDetalle(true)}>Detalle del pool</Button>
        <Button size="sm" onClick={() => setRegistrando(true)}>Registrar envío</Button>
      </div>
      <RegistrarEnvioModal open={registrando} onClose={() => setRegistrando(false)} onRegistrar={registrar} pptoOptions={pptoOptions} />
      <PoolEnviosDetalleModal open={detalle} onClose={() => setDetalle(false)} ledger={ledger} onEliminarGasto={eliminar} />
    </div>
  );
}
