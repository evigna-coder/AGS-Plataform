import { useMemo } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import type { MinikitRequeridoItem, UnidadStock } from '@ags/shared';

interface Props {
  requeridos: MinikitRequeridoItem[];
  unidades: UnidadStock[];
  onEdit: () => void;
}

const Badge = ({ label, color }: { label: string; color: string }) => (
  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${color}`}>{label}</span>
);

export const MinikitRequeridosCard = ({ requeridos, unidades, onEdit }: Props) => {
  const comparison = useMemo(() => {
    return requeridos.map(req => {
      const actual = unidades.filter(u => u.articuloId === req.articuloId).length;
      const diff = actual - req.cantidadMinima;
      const status: 'ok' | 'warning' | 'missing' = diff >= 0 ? 'ok' : diff >= -1 ? 'warning' : 'missing';
      return { ...req, actual, diff, status };
    });
  }, [requeridos, unidades]);

  const statusColors = { ok: 'bg-green-100 text-green-700', warning: 'bg-amber-100 text-amber-700', missing: 'bg-red-100 text-red-700' };
  const statusLabels = { ok: 'Completo', warning: 'Casi', missing: 'Faltante' };
  const allOk = comparison.length > 0 && comparison.every(c => c.status === 'ok');
  const faltantes = comparison.filter(c => c.status !== 'ok').length;

  if (requeridos.length === 0) {
    return (
      <Card compact title="Artículos requeridos">
        <div className="flex items-center justify-between py-2">
          <p className="text-xs text-slate-500">Este minikit aún no tiene artículos requeridos configurados — no hay alertas de reposición.</p>
          <Button size="sm" variant="outline" onClick={onEdit}>+ Configurar</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card
      compact
      title="Artículos requeridos"
      actions={
        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${allOk ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {allOk ? 'Completo' : `Reposición pendiente (${faltantes})`}
          </span>
          <button onClick={onEdit} className="text-teal-600 hover:underline font-medium text-[11px]">Editar</button>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 text-center">Artículo</th>
              <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 text-center">Sector</th>
              <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 text-center">Mínimo</th>
              <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 text-center">Actual</th>
              <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 text-center">Estado</th>
            </tr>
          </thead>
          <tbody>
            {comparison.map((c, i) => (
              <tr key={i} className="border-b border-slate-50 last:border-0">
                <td className="text-xs py-2 pr-3">
                  <span className="font-mono text-teal-600 font-semibold">{c.articuloCodigo}</span>
                  <span className="text-slate-600 ml-1.5">{c.articuloDescripcion}</span>
                </td>
                <td className="text-xs py-2 text-center text-slate-500">{c.sector || '—'}</td>
                <td className="text-xs py-2 text-center text-slate-500">{c.cantidadMinima}</td>
                <td className="text-xs py-2 text-center font-medium">{c.actual}</td>
                <td className="text-xs py-2 text-center">
                  <Badge label={statusLabels[c.status]} color={statusColors[c.status]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
