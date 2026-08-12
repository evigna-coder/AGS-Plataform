import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Presupuesto, PresupuestoCuotaFacturacion, MonedaCuota, MonedaPresupuesto } from '@ags/shared';
import { presupuestosService, clientesService } from '../../services/firebaseService';
import { computeTotalsByCurrency } from '../../utils/cuotasFacturacion';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { GenerarSolicitudCuotaModal } from '../../components/presupuestos/GenerarSolicitudCuotaModal';
import { ExportarButton } from '../../components/ui/ExportarButton';
import { CUOTAS_POR_FACTURAR_EXPORT_COLUMNS, buildCuotasPorFacturarRows } from '../../utils/exports/exportCuotasPorFacturar';
import { filtrosAplicadosDesc } from '../../utils/exports/filtros';

interface Fila {
  ppto: Presupuesto;
  cuota: PresupuestoCuotaFacturacion;
}

const currentMonth = () => new Date().toISOString().slice(0, 7); // YYYY-MM

/** Fin del mes YYYY-MM en ISO (día 0 del mes siguiente = último día del mes). */
const endOfMonthISO = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0, 23, 59, 59, 999).toISOString();
};

const fmtFecha = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' }) : '—';

/** Monto estimado por moneda = %cuota × total del ppto (solo display). */
const fmtMonto = (cuota: PresupuestoCuotaFacturacion, ppto: Presupuesto) => {
  const totals = computeTotalsByCurrency(ppto.items ?? [], ppto.moneda as MonedaPresupuesto);
  const parts = Object.entries(cuota.porcentajePorMoneda ?? {})
    .filter(([, p]) => (p ?? 0) > 0)
    .map(([m, p]) => {
      const monto = Math.round(((p as number) / 100) * (totals[m as MonedaCuota] ?? 0));
      return `${m} ${monto.toLocaleString('es-AR')}`;
    });
  return parts.join(' + ') || '—';
};

export const CuotasPorFacturarPage = () => {
  const { firebaseUser, usuario } = useAuth();
  const [pptos, setPptos] = useState<Presupuesto[]>([]);
  const [nombreById, setNombreById] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [mes, setMes] = useState(currentMonth);
  const [modalFila, setModalFila] = useState<Fila | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ps, cs] = await Promise.all([presupuestosService.getAll(), clientesService.getAll(false)]);
      setPptos(ps);
      setNombreById(new Map(cs.map(c => [c.id, c.razonSocial])));
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // Solo cuotas mensuales (con fechaPrevista), habilitadas, que vencen hasta el mes elegido.
  const filas = useMemo<Fila[]>(() => {
    const hasta = endOfMonthISO(mes);
    const out: Fila[] = [];
    for (const p of pptos) {
      for (const c of p.esquemaFacturacion ?? []) {
        if (!c.fechaPrevista) continue;
        if (c.estado !== 'habilitada') continue;
        if (c.fechaPrevista > hasta) continue;
        out.push({ ppto: p, cuota: c });
      }
    }
    out.sort((a, b) => (a.cuota.fechaPrevista || '').localeCompare(b.cuota.fechaPrevista || ''));
    return out;
  }, [pptos, mes]);

  // Export Excel/PDF de las mismas filas que muestran las cards.
  const exportRows = useMemo(() => buildCuotasPorFacturarRows(filas, nombreById), [filas, nombreById]);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Cuotas por facturar"
        subtitle="Cuotas mensuales de contrato que vencen hasta el mes elegido — confirmá el aviso a facturación"
        actions={
          <div className="flex items-center gap-2">
            <ExportarButton
              columnas={CUOTAS_POR_FACTURAR_EXPORT_COLUMNS}
              data={exportRows}
              titulo="Cuotas por Facturar"
              filename="cuotas-por-facturar"
              filtrosAplicados={filtrosAplicadosDesc({ 'Vence hasta': mes })}
            />
            <input type="month" value={mes} onChange={e => setMes(e.target.value)} className="border rounded-lg px-2 py-1 text-xs border-slate-300 bg-white" />
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
        {loading ? (
          <p className="text-slate-400 text-sm">Cargando...</p>
        ) : filas.length === 0 ? (
          <p className="text-slate-400 text-sm">No hay cuotas mensuales por facturar hasta ese mes.</p>
        ) : filas.map(({ ppto, cuota }) => (
          <Card key={`${ppto.id}:${cuota.id}`} compact>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800 truncate">{nombreById.get(ppto.clienteId) || ppto.clienteId}</span>
                  <span className="text-[11px] text-slate-400 font-mono">{ppto.numero}</span>
                </div>
                <p className="text-[11px] text-slate-500">{cuota.descripcion} · vence {fmtFecha(cuota.fechaPrevista)} · ~{fmtMonto(cuota, ppto)}</p>
              </div>
              <Button size="sm" onClick={() => setModalFila({ ppto, cuota })} className="shrink-0">Generar aviso</Button>
            </div>
          </Card>
        ))}
      </div>
      {modalFila && (
        <GenerarSolicitudCuotaModal
          open={!!modalFila}
          cuota={modalFila.cuota}
          presupuestoId={modalFila.ppto.id}
          itemsForTotals={modalFila.ppto.items ?? []}
          pptoMoneda={modalFila.ppto.moneda}
          otsListasParaFacturar={modalFila.ppto.otsListasParaFacturar ?? []}
          onClose={() => setModalFila(null)}
          onGenerated={() => { setModalFila(null); void load(); }}
          actor={{ uid: firebaseUser?.uid || '', name: usuario?.displayName }}
        />
      )}
    </div>
  );
};
