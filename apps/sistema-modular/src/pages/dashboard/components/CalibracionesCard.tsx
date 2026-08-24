import { useNavigate } from 'react-router-dom';
import type { EstadoCertificado } from '@ags/shared';
import type { CalibracionKPIs } from '../../../services/dashboardService';
import { KpiCard } from './KpiCard';

/**
 * Vencimientos de certificados — instrumentos y lotes de patrones (2026-08-22).
 *
 * El estado ya se calculaba y se veía en cada listado; lo que faltaba era el
 * aviso. Sin esto había que entrar al módulo y acordarse de mirar, que es
 * justamente lo que observó la auditoría.
 */

const fmtVenc = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' }) : 'sin fecha';

const ESTADO_LABEL: Record<EstadoCertificado, string> = {
  vencido: 'Vencido',
  por_vencer: 'Por vencer',
  sin_certificado: 'Sin certificado',
  vigente: 'Vigente',
};

const ESTADO_CLS: Record<EstadoCertificado, string> = {
  vencido: 'bg-red-50 text-red-700',
  por_vencer: 'bg-amber-50 text-amber-700',
  sin_certificado: 'bg-slate-100 text-slate-600',
  vigente: 'bg-emerald-50 text-emerald-700',
};

export const CalibracionesCard: React.FC<{ data: CalibracionKPIs }> = ({ data }) => {
  const navigate = useNavigate();
  const { instrumentos, patrones, proximos } = data;

  const vencidos = instrumentos.vencidos + patrones.vencidos;
  const porVencer = instrumentos.porVencer + patrones.porVencer;

  // "1 lotes de patrón" quedaba feo en una card que mira la dirección.
  const desglose = (inst: number, lotes: number) =>
    `${inst} instrumento${inst === 1 ? '' : 's'} · ${lotes} lote${lotes === 1 ? '' : 's'} de patrón`;

  return (
    <section>
      <h3 className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">
        Instrumentos &amp; Patrones
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3">
          <KpiCard
            label="Certificados vencidos"
            value={vencidos}
            tone={vencidos > 0 ? 'danger' : 'positive'}
            hint={desglose(instrumentos.vencidos, patrones.vencidos)}
            onClick={() => navigate('/instrumentos')}
          />
          <KpiCard
            label="Por vencer (30d)"
            value={porVencer}
            tone={porVencer > 0 ? 'warning' : 'positive'}
            hint={desglose(instrumentos.porVencer, patrones.porVencer)}
            onClick={() => navigate('/instrumentos')}
          />
          <KpiCard
            label="Sin certificado"
            value={instrumentos.sinCertificado}
            tone={instrumentos.sinCertificado > 0 ? 'warning' : 'positive'}
            hint={instrumentos.enCalibracion > 0
              ? `${instrumentos.enCalibracion} en calibración, no se cuenta${instrumentos.enCalibracion === 1 ? '' : 'n'}`
              : 'Instrumentos activos sin certificado cargado'}
            onClick={() => navigate('/instrumentos')}
          />
        </div>

        <div className="rounded-xl bg-white border border-slate-200 p-4 lg:col-span-2">
          <p className="text-[10px] font-mono uppercase tracking-wide text-slate-500 mb-2">
            A recalibrar — más urgentes primero
          </p>
          {proximos.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">
              Todo vigente. Nada vence en los próximos 30 días.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {proximos.slice(0, 8).map((p, i) => (
                <li
                  key={`${p.tipo}-${p.id}-${i}`}
                  onClick={() => navigate(p.tipo === 'instrumento' ? '/instrumentos' : '/patrones')}
                  className="flex items-center gap-3 py-1.5 cursor-pointer hover:bg-slate-50 -mx-1 px-1 rounded"
                >
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${ESTADO_CLS[p.estado]}`}>
                    {ESTADO_LABEL[p.estado]}
                  </span>
                  <span className="text-xs text-slate-800 truncate flex-1 min-w-0">
                    {p.nombre}
                    {p.detalle && <span className="text-slate-400"> · {p.detalle}</span>}
                  </span>
                  <span className="text-[11px] text-slate-500 tabular-nums shrink-0">
                    {fmtVenc(p.vencimiento)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {proximos.length > 8 && (
            <p className="text-[11px] text-slate-400 mt-2">
              y {proximos.length - 8} más
            </p>
          )}
        </div>
      </div>
    </section>
  );
};
