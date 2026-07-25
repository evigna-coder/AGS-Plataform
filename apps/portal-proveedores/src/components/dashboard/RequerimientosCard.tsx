import { Link, useNavigate } from 'react-router-dom';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { Requerimiento } from '@/data/types';
import { REQ_BADGE } from '@/data/types';

export function RequerimientosCard({ items }: { items: Requerimiento[] }) {
  const nuevos = items.filter((i) => i.estado === 'nuevo').length;
  const navigate = useNavigate();

  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Requerimientos asignados"
        action={
          <div className="flex items-center gap-3">
            <Badge label={`${nuevos} nuevos`} tone="info" dot={false} />
            <Link to="/requerimientos" className="text-[13px] font-medium text-teal-600">
              Ver todos
            </Link>
          </div>
        }
      />
      <div className="mt-3 divide-y divide-line">
        {items.map((r) => {
          const badge = REQ_BADGE[r.estado];
          const nuevo = r.estado === 'nuevo';
          return (
            <div key={r.id} className="flex items-center gap-4 py-3.5">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink-soft">
                    {r.id}
                  </span>
                  <span className="truncate text-sm font-semibold text-ink">{r.parte}</span>
                </div>
                <span className="font-mono text-[11px] text-ink-faint">{r.equipo}</span>
              </div>
              <div className="hidden flex-col items-center sm:flex">
                <span className="font-display text-base font-bold text-ink">{r.cantidad}</span>
                <span className="font-mono text-[9px] text-ink-faint">CANT.</span>
              </div>
              <Badge label={badge.label} tone={badge.tone} />
              <Button
                size="sm"
                variant={nuevo ? 'primary' : 'secondary'}
                onClick={() => navigate(`/requerimientos/${r.id}`)}
              >
                {nuevo ? 'Cotizar' : 'Ver'}
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
