interface Props {
  kpis: {
    byEstado: Record<string, number>;
    totalHsLab: number;
    totalHsViaje: number;
    pendientes: number;
    facturables: number;
    total: number;
  };
}

/** Resumen KPI sobre todas las OTs (no filtradas). */
export const OTKpiBar: React.FC<Props> = ({ kpis }) => {
  const items = [
    { label: 'Total', value: kpis.total, color: 'text-slate-700' },
    { label: 'Pendientes', value: kpis.pendientes, color: 'text-amber-600' },
    { label: 'En curso', value: kpis.byEstado['EN_CURSO'] || 0, color: 'text-blue-600' },
    { label: 'Cierre admin', value: kpis.byEstado['CIERRE_ADMINISTRATIVO'] || 0, color: 'text-cyan-600' },
    { label: 'Finalizadas', value: kpis.byEstado['FINALIZADO'] || 0, color: 'text-emerald-600' },
    { label: 'Hs Lab', value: kpis.totalHsLab.toFixed(0) + 'h', color: 'text-slate-600' },
    { label: 'Hs Viaje', value: kpis.totalHsViaje.toFixed(0) + 'h', color: 'text-slate-600' },
    { label: 'Facturables', value: kpis.facturables, color: 'text-teal-600' },
  ];
  return (
    <div className="px-5 pb-2 flex gap-3 flex-wrap">
      {items.map(kpi => (
        <div key={kpi.label} className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 min-w-[80px]">
          <p className="text-[10px] text-slate-400 font-medium">{kpi.label}</p>
          <p className={`text-sm font-semibold ${kpi.color}`}>{kpi.value}</p>
        </div>
      ))}
    </div>
  );
};
