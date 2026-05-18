import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { OT_ESTADO_LABELS, OT_ESTADO_ORDER, type OTEstadoAdmin } from '@ags/shared';

interface OTFunnelChartProps {
  porEstado: Record<OTEstadoAdmin, number>;
}

const COLORS: Record<OTEstadoAdmin, string> = {
  CREADA: '#94A3B8',
  ASIGNADA: '#64748B',
  COORDINADA: '#0EA5E9',
  EN_CURSO: '#0D6E6E',
  CIERRE_TECNICO: '#0D9488',
  CIERRE_ADMINISTRATIVO: '#14B8A6',
  FINALIZADO: '#10B981',
};

export const OTFunnelChart: React.FC<OTFunnelChartProps> = ({ porEstado }) => {
  const data = OT_ESTADO_ORDER.map(estado => ({
    estado,
    nombre: OT_ESTADO_LABELS[estado],
    cantidad: porEstado[estado] ?? 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 32 }}>
        <XAxis
          dataKey="nombre"
          tick={{ fontSize: 10, fill: '#64748B' }}
          angle={-25}
          textAnchor="end"
          interval={0}
          height={50}
        />
        <YAxis tick={{ fontSize: 10, fill: '#64748B' }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}
          formatter={(v) => [String(v ?? 0), 'OTs']}
          labelFormatter={(l) => String(l)}
        />
        <Bar dataKey="cantidad" radius={[4, 4, 0, 0]}>
          {data.map(d => (
            <Cell key={d.estado} fill={COLORS[d.estado]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};
