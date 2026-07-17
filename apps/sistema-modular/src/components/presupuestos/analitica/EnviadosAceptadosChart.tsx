import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { SerieMensualPunto } from '../../../utils/analitica/presupuestosMetrics';

interface Props {
  serie: SerieMensualPunto[];
}

/** Enviados vs. aprobados por mes — mismo estilo recharts que OTFunnelChart. */
export const EnviadosAceptadosChart: React.FC<Props> = ({ serie }) => {
  if (serie.length === 0) {
    return (
      <div className="h-[220px] flex items-center justify-center">
        <p className="text-xs text-slate-400">Sin datos de envío/aprobación en el período</p>
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={serie} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748B' }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10, fill: '#64748B' }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}
          labelFormatter={(l) => String(l)}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="enviados" name="Enviados" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
        <Bar dataKey="aceptados" name="Aprobados" fill="#0D6E6E" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};
