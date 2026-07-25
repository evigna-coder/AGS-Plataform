import { useState, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Truck, Check, Mail, Loader2, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useOrden } from '@/data/detalle';
import { OC_BADGE } from '@/data/types';
import type { OcItem } from '@/data/types';

function ItemsTable({ items, total }: { items: OcItem[]; total: string }) {
  return (
    <div className="flex flex-col">
      <div className="flex gap-4 border-b border-line pb-3">
        <span className="flex-1 font-mono text-[10px] font-semibold tracking-wide text-ink-soft">ARTÍCULO</span>
        <span className="w-14 text-right font-mono text-[10px] font-semibold tracking-wide text-ink-soft">CANT.</span>
        <span className="w-24 text-right font-mono text-[10px] font-semibold tracking-wide text-ink-soft">P. UNIT.</span>
        <span className="w-24 text-right font-mono text-[10px] font-semibold tracking-wide text-ink-soft">SUBTOTAL</span>
      </div>
      {items.map((it) => (
        <div key={it.articulo} className="flex items-center gap-4 border-b border-line py-3.5">
          <div className="flex flex-1 flex-col">
            <span className="text-sm font-medium text-ink">{it.articulo}</span>
            <span className="font-mono text-[10px] text-ink-faint">{it.equipo}</span>
          </div>
          <span className="w-14 text-right text-sm text-ink">{it.cantidad}</span>
          <span className="w-24 text-right font-mono text-[13px] text-ink-soft">{it.precioUnit}</span>
          <span className="w-24 text-right font-display text-sm font-semibold text-ink">{it.subtotal}</span>
        </div>
      ))}
      <div className="flex items-center justify-end gap-6 pt-4">
        <span className="font-mono text-[11px] tracking-wide text-ink-soft">TOTAL</span>
        <span className="font-display text-xl font-bold text-ink">{total}</span>
      </div>
    </div>
  );
}

export function OrdenDetailPage() {
  const { numero } = useParams();
  const navigate = useNavigate();
  const { orden, loading } = useOrden(numero);
  const [fecha, setFecha] = useState('');
  const [obs, setObs] = useState('');

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-ink-faint">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!orden) {
    return <div className="py-24 text-center text-sm text-ink-soft">Orden no encontrada.</div>;
  }

  const badge = OC_BADGE[orden.estado];
  const datos: [string, string][] = [
    ['Emitida', orden.emitida],
    ['Condición de pago', orden.condicionPago],
    ['Moneda', orden.moneda],
    ['N° de requerimiento', orden.requerimientos],
  ];

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    navigate('/ordenes');
  }

  return (
    <div className="flex flex-col gap-5">
      <button
        onClick={() => navigate('/ordenes')}
        className="flex items-center gap-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        Órdenes de compra
      </button>

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-3">
              <h2 className="font-display text-2xl font-semibold text-ink">Orden {orden.numero}</h2>
              <Badge label={badge.label} tone={badge.tone} />
            </div>
            <span className="font-mono text-xs text-ink-faint">
              Emitida {orden.emitida} · {orden.cliente} · {orden.items.length} ítems
            </span>
          </div>
          <div className="flex flex-col sm:items-end">
            <span className="font-mono text-[10px] tracking-wide text-ink-faint">TOTAL DE LA ORDEN</span>
            <span className="font-display text-[26px] font-bold text-ink">{orden.total}</span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_420px] lg:items-start">
        <Card className="flex flex-col gap-4">
          <CardHeader title="Ítems de la orden" />
          <ItemsTable items={orden.items} total={orden.total} />
        </Card>

        <div className="flex flex-col gap-5">
          {orden.entrega ? (
            <Card className="flex items-center gap-3.5 border-success/30 bg-success-bg">
              <CheckCircle2 className="h-8 w-8 shrink-0 text-success" />
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-ink">Entrega informada</span>
                <span className="text-[13px] text-ink-soft">
                  Fecha estimada: <strong className="text-ink">{orden.entrega}</strong>
                </span>
              </div>
            </Card>
          ) : (
            <form
              onSubmit={onSubmit}
              className="flex flex-col gap-4 rounded-xl border border-teal-100 bg-teal-50 p-6"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700">
                  <Truck className="h-5 w-5 text-ink-inv" />
                </div>
                <div className="flex flex-col">
                  <span className="font-display text-base font-semibold text-ink">
                    Informar fecha de entrega
                  </span>
                  <span className="text-xs text-ink-soft">AGS coordinará la recepción con esta fecha.</span>
                </div>
              </div>
              <Input
                label="FECHA ESTIMADA DE ENTREGA"
                type="date"
                required
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] tracking-wide text-ink-soft">
                  OBSERVACIONES (OPCIONAL)
                </span>
                <textarea
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  rows={2}
                  placeholder="Ej: se despacha por transporte propio, 2 bultos…"
                  className="w-full rounded-xl border border-line-strong bg-surface px-3.5 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <Button type="submit" block icon={<Check className="h-[17px] w-[17px]" />}>
                Confirmar fecha de entrega
              </Button>
            </form>
          )}

          <Card className="flex flex-col gap-4">
            <h3 className="font-display text-base font-semibold text-ink">Datos de la orden</h3>
            {datos.map(([l, v]) => (
              <div key={l} className="flex items-center justify-between gap-4">
                <span className="text-[13px] text-ink-soft">{l}</span>
                <span className="text-[13px] font-semibold text-ink">{v}</span>
              </div>
            ))}
            <div className="h-px w-full bg-line" />
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-100 font-mono text-[11px] font-bold text-teal-700">
                AC
              </div>
              <div className="flex flex-1 flex-col">
                <span className="text-[13px] font-semibold text-ink">Compras · AGS Analítica</span>
                <span className="font-mono text-[11px] text-ink-faint">compras@agsanalitica.com</span>
              </div>
              <Mail className="h-[18px] w-[18px] text-teal-600" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
