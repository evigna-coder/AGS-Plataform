import { Link } from 'react-router-dom';
import { CalendarPlus, Truck } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { OrdenCompra } from '@/data/types';
import { OC_BADGE } from '@/data/types';

export function OrdenesCard({ items }: { items: OrdenCompra[] }) {
  return (
    <Card className="flex flex-col gap-3.5">
      <CardHeader
        title="Órdenes de compra activas"
        action={
          <Link to="/ordenes" className="text-[13px] font-medium text-teal-600">
            Ver todas
          </Link>
        }
      />
      <div className="flex flex-col gap-3">
        {items.map((oc) => {
          const badge = OC_BADGE[oc.estado];
          return (
            <Link
              key={oc.numero}
              to={`/ordenes/${oc.numero}`}
              className="flex flex-col gap-3 rounded-xl bg-surface-muted p-4 transition-colors hover:bg-teal-50"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="font-display text-base font-bold text-ink">{oc.numero}</span>
                  <span className="font-mono text-[12px] text-ink-soft">
                    {oc.itemsCount} ítems · {oc.monto}
                  </span>
                </div>
                <Badge label={badge.label} tone={badge.tone} />
              </div>
              <div className="h-px w-full bg-line" />
              {oc.entrega ? (
                <div className="flex items-center gap-2">
                  <Truck className="h-[15px] w-[15px] text-success" />
                  <span className="font-mono text-[11px] text-ink-soft">ENTREGA INFORMADA</span>
                  <span className="ml-auto font-display text-sm font-semibold text-ink">
                    {oc.entrega}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-ink-faint">FECHA DE ENTREGA</span>
                  <span className="flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-[13px] font-semibold text-ink-inv">
                    <CalendarPlus className="h-[15px] w-[15px]" />
                    Informar fecha
                  </span>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
