import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { TICKET_AREA_LABELS, type TicketArea } from '@ags/shared';

interface TicketAreaBarsProps {
  porArea: Record<TicketArea | 'sin_area', number>;
}

const AREA_ORDER: (TicketArea | 'sin_area')[] = [
  'admin_soporte', 'ing_soporte', 'administracion', 'ventas', 'compras', 'materiales', 'sistema', 'sin_area',
];

const AREA_COLORS: Record<TicketArea | 'sin_area', string> = {
  admin_soporte: '#3B82F6',
  ing_soporte: '#0D6E6E',
  administracion: '#8B5CF6',
  ventas: '#10B981',
  compras: '#F59E0B',
  materiales: '#06B6D4',
  sistema: '#A855F7',
  sin_area: '#94A3B8',
};

const LABELS: Record<TicketArea | 'sin_area', string> = {
  ...TICKET_AREA_LABELS,
  sin_area: 'Sin área',
};

export const TicketAreaBars: React.FC<TicketAreaBarsProps> = ({ porArea }) => {
  const data = AREA_ORDER
    .map(area => ({ area, nombre: LABELS[area], cantidad: porArea[area] ?? 0 }))
    .filter(d => d.cantidad > 0);

  if (data.length === 0) {
    return <p className="text-xs text-slate-400 py-8 text-center">No hay tickets abiertos</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
        <XAxis type="number" tick={{ fontSize: 10, fill: '#64748B' }} allowDecimals={false} />
        <YAxis
          dataKey="nombre"
          type="category"
          tick={{ fontSize: 11, fill: '#475569' }}
          width={140}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}
          formatter={(v) => [String(v ?? 0), 'Tickets']}
          labelFormatter={(l) => String(l)}
        />
        <Bar dataKey="cantidad" radius={[0, 4, 4, 0]}>
          {data.map(d => (
            <Cell key={d.area} fill={AREA_COLORS[d.area]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};
