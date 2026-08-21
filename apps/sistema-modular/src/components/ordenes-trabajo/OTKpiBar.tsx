interface Props {
  kpis: {
    byEstado: Record<string, number>;
    totalHsLab: number;
    totalHsViaje: number;
    pendientes: number;
    /** Entrega + proveedor externo + alquiler sin cerrar (2026-08-21). */
    sinAgenda: number;
    facturables: number;
    total: number;
  };
  /** Valor actual del filtro `estadoAdmin` — marca la card activa. */
  estadoActivo: string;
  /** Click en una card: setea ese valor de `estadoAdmin` ('' = ver todas). */
  onFiltrar: (estadoAdmin: string) => void;
}

/**
 * Resumen KPI sobre todas las OTs (no filtradas).
 *
 * Purga 2026-08-08: se sacaron "En curso" (estado que en la práctica no se usa),
 * "Hs Lab", "Hs Viaje" (van a tener su propia vista) y "Facturables". Quedan los
 * cuatro que se miran de verdad.
 */
export const OTKpiBar: React.FC<Props> = ({ kpis, estadoActivo, onFiltrar }) => {
  /**
   * Cada card escribe en el MISMO filtro que el desplegable de estado
   * (`estadoAdmin`), no en uno paralelo. En presupuestos las cards eran un
   * filtro aparte que se SUMABA al del desplegable: elegir un estado con una
   * card activa dejaba la lista vacía sin salida visible (fix 2026-08-05). Acá
   * no puede pasar: es un solo filtro y la card es otra forma de tocarlo, así
   * que el desplegable siempre refleja lo que la card eligió.
   */
  // Ordenadas siguiendo el flujo real de la OT: creada → cierre técnico →
  // cierre admin → finalizada.
  const items = [
    { label: 'Total', value: kpis.total, color: 'text-slate-700', filtro: '', title: 'Ver todas las órdenes' },
    { label: 'Pendientes', value: kpis.pendientes, color: 'text-amber-600', filtro: '__pendientes__', title: 'Filtrar: todo lo que no está finalizado' },
    { label: 'Creadas', value: kpis.byEstado['CREADA'] || 0, color: 'text-violet-600', filtro: 'CREADA', title: 'Filtrar por creadas (sin asignar todavía)' },
    // Las que no se agendan: se reclaman, no se coordinan (2026-08-21).
    { label: 'Sin agenda', value: kpis.sinAgenda, color: 'text-orange-600', filtro: '__sin_agenda__', title: 'Entregas, proveedor externo y alquiler sin cerrar — no se agendan, se reclaman' },
    { label: 'Cierre técnico', value: kpis.byEstado['CIERRE_TECNICO'] || 0, color: 'text-indigo-600', filtro: 'CIERRE_TECNICO', title: 'Filtrar por cierre técnico — trabajo hecho, falta el cierre administrativo' },
    { label: 'Cierre admin', value: kpis.byEstado['CIERRE_ADMINISTRATIVO'] || 0, color: 'text-cyan-600', filtro: 'CIERRE_ADMINISTRATIVO', title: 'Filtrar por cierre administrativo' },
    { label: 'Finalizadas', value: kpis.byEstado['FINALIZADO'] || 0, color: 'text-emerald-600', filtro: 'FINALIZADO', title: 'Filtrar por finalizadas' },
  ];
  return (
    <div className="px-5 pb-2 flex gap-3 flex-wrap">
      {items.map(kpi => {
        const activo = estadoActivo === kpi.filtro;
        return (
          <button
            key={kpi.label}
            type="button"
            // Click en la card activa la apaga (vuelve a "ver todas"): sin toggle
            // el usuario queda encerrado en el filtro que eligió.
            onClick={() => onFiltrar(activo ? '' : kpi.filtro)}
            title={kpi.title}
            className={`bg-white border rounded-lg px-3 py-1.5 min-w-[80px] text-left transition-colors ${
              activo ? 'border-teal-500 ring-1 ring-teal-500 bg-teal-50/30' : 'border-slate-200 hover:border-teal-300'
            }`}
          >
            <p className="text-[10px] text-slate-400 font-medium">{kpi.label}</p>
            <p className={`text-sm font-semibold ${kpi.color}`}>{kpi.value}</p>
          </button>
        );
      })}
    </div>
  );
};
