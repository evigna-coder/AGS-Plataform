import { useState, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, PackageSearch, Send, Info, Loader2 } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useRequerimiento } from '@/data/detalle';
import { REQ_BADGE } from '@/data/types';

function parsePrecio(s: string): number {
  return Number(s.replace(/[^\d]/g, '')) || 0;
}

export function RequerimientoDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { req, loading } = useRequerimiento(id);

  const [precio, setPrecio] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [marca, setMarca] = useState('');
  const [plazo, setPlazo] = useState('');
  const [obs, setObs] = useState('');
  const [initFrom, setInitFrom] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-ink-faint">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!req) {
    return (
      <div className="py-24 text-center text-sm text-ink-soft">Requerimiento no encontrado.</div>
    );
  }

  // Precarga (una sola vez) según el requerimiento cargado.
  if (initFrom !== req.id) {
    setInitFrom(req.id);
    setCantidad(String(req.cantidad));
    setPrecio(req.cotizacion?.precioUnitario ?? '');
    setMarca(req.cotizacion?.marca ?? '');
    setPlazo(req.cotizacion?.plazo ?? '');
  }

  const badge = REQ_BADGE[req.estado];
  const total = parsePrecio(precio) * (Number(cantidad) || 0);
  const totalStr = total > 0 ? `USD ${total.toLocaleString('es-AR')}` : 'USD —';

  const meta: [string, string][] = [
    ['Parte solicitada', req.parte],
    ['Cantidad requerida', `${req.cantidad} unidad${req.cantidad > 1 ? 'es' : ''}`],
    ['Equipo destino', req.equipoNombre],
    ['Marca del equipo', req.equipoMarca],
    ['N° de serie', req.equipoSerie],
    ['Urgencia', req.urgencia],
  ];

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    navigate('/requerimientos');
  }

  return (
    <div className="flex flex-col gap-5">
      <button
        onClick={() => navigate('/requerimientos')}
        className="flex items-center gap-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        Requerimientos
      </button>

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-info-bg">
              <PackageSearch className="h-7 w-7 text-info" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2.5">
                <h2 className="font-display text-2xl font-semibold text-ink">{req.parte}</h2>
                <span className="rounded-md bg-surface-muted px-2 py-0.5 font-mono text-[11px] font-semibold text-ink-soft">
                  {req.id}
                </span>
              </div>
              <span className="font-mono text-xs text-ink-faint">
                Para {req.equipoNombre} · asignado {req.asignado}
              </span>
            </div>
          </div>
          <Badge label={badge.label} tone={badge.tone} />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_460px] lg:items-start">
        <Card className="flex flex-col gap-5">
          <CardHeader title="Detalle del requerimiento" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-5">
            {meta.map(([l, v]) => (
              <div key={l} className="flex flex-col gap-1">
                <span className="font-mono text-[10px] tracking-wide text-ink-faint">
                  {l.toUpperCase()}
                </span>
                <span className="text-sm font-medium text-ink">{v}</span>
              </div>
            ))}
          </div>
          <div className="h-px w-full bg-line" />
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] tracking-wide text-ink-faint">NOTAS DE AGS</span>
            <p className="text-sm leading-relaxed text-ink">{req.notasAgs}</p>
          </div>
        </Card>

        <div className="flex flex-col gap-5">
          <form
            onSubmit={onSubmit}
            className="flex flex-col gap-4 rounded-xl border border-teal-100 bg-teal-50 p-6"
          >
            <div>
              <h3 className="font-display text-base font-semibold text-ink">Cargar cotización</h3>
              <p className="text-xs text-ink-soft">AGS la revisa y, si aprueba, genera la OC.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="PRECIO UNITARIO (USD)"
                required
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                placeholder="0"
              />
              <Input
                label="CANTIDAD"
                type="number"
                min={1}
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
              />
            </div>
            <Input
              label="MARCA / ORIGEN DEL REPUESTO"
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              placeholder="Ej: original / equivalente compatible"
            />
            <Input
              label="PLAZO DE ENTREGA"
              value={plazo}
              onChange={(e) => setPlazo(e.target.value)}
              placeholder="Ej: 5 días hábiles"
            />
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] tracking-wide text-ink-soft">
                OBSERVACIONES (OPCIONAL)
              </span>
              <textarea
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                rows={2}
                placeholder="Ej: stock disponible, garantía 6 meses…"
                className="w-full rounded-xl border border-line-strong bg-surface px-3.5 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div className="h-px w-full bg-teal-100" />
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] tracking-wide text-ink-soft">TOTAL COTIZADO</span>
              <span className="font-display text-[22px] font-bold text-ink">{totalStr}</span>
            </div>
            <Button type="submit" block icon={<Send className="h-[17px] w-[17px]" />}>
              Enviar cotización a AGS
            </Button>
          </form>

          <div className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4">
            <Info className="mt-0.5 h-[18px] w-[18px] shrink-0 text-info" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-ink">¿Qué pasa después?</span>
              <span className="text-xs leading-relaxed text-ink-soft">
                AGS revisa tu cotización. Si la aprueba, se genera la orden de compra y la vas a ver
                en «Órdenes de compra» para informar la fecha de entrega.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
