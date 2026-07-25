import { Headset, Download, FileClock } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CategoriaIcon } from './CategoriaIcon';
import { BenchBlock } from './BenchBlock';
import { OtHistoryChart } from './OtHistoryChart';
import type { EquipoDetalle } from '@/data/types';
import { ESTADO_BADGE, estaEnBench } from '@/data/types';

export function EquipoDetail({ equipo }: { equipo: EquipoDetalle }) {
  const badge = ESTADO_BADGE[equipo.estado];
  const bench = estaEnBench(equipo.estado);

  const meta: [string, string][] = [
    ['Marca', equipo.marca],
    ['N° de serie', equipo.serie],
    ['Software', equipo.software ?? '—'],
    ['Establecimiento', equipo.establecimiento],
    ['Sector', equipo.sector],
    ['Contrato', equipo.contrato ? 'Vigente · anual' : 'Sin contrato'],
  ];

  const stats: [string, string][] = [
    ['OTs totales', String(equipo.otsCount)],
    ['Último servicio', equipo.ultimoServicio ?? '—'],
    ['Próximo (agenda)', equipo.proximoServicio ?? '—'],
  ];

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'flex h-14 w-14 items-center justify-center rounded-2xl',
                bench ? 'bg-warn-bg' : 'bg-teal-50',
              )}
            >
              <CategoriaIcon
                name={equipo.icon}
                className={cn('h-7 w-7', bench ? 'text-warn' : 'text-teal-700')}
              />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="font-display text-2xl font-semibold text-ink">{equipo.nombre}</h2>
              <span className="font-mono text-xs text-ink-faint">
                {equipo.id} · {equipo.categoria}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge label={badge.label} tone={badge.tone} />
            <Button size="sm" icon={<Headset className="h-4 w-4" />}>
              Solicitar servicio
            </Button>
          </div>
        </div>
      </Card>

      {equipo.ficha && <BenchBlock ficha={equipo.ficha} />}

      <Card className="flex flex-col gap-5">
        <CardHeader title="Ficha técnica" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
          {meta.map(([l, v]) => (
            <div key={l} className="flex flex-col gap-1">
              <span className="font-mono text-[10px] tracking-wide text-ink-faint">
                {l.toUpperCase()}
              </span>
              <span className="text-sm font-medium text-ink">{v}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_400px]">
        <Card className="flex flex-col gap-5">
          <CardHeader title="Historial de servicios" />
          <div className="flex gap-4">
            {stats.map(([l, v]) => (
              <div key={l} className="flex flex-1 flex-col gap-0.5">
                <span className="font-display text-xl font-bold text-ink">{v}</span>
                <span className="font-mono text-[10px] text-ink-soft">{l.toUpperCase()}</span>
              </div>
            ))}
          </div>
          <OtHistoryChart data={equipo.otsPorAnio} />
        </Card>

        <Card className="flex flex-col gap-1">
          <CardHeader title="Últimas órdenes" />
          <div className="mt-2 divide-y divide-line">
            {equipo.ultimasOts.map((ot) => (
              <div key={ot.id} className="flex items-center gap-3 py-3">
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="text-sm font-semibold text-ink">{ot.tipo}</span>
                  <span className="font-mono text-[11px] text-ink-faint">
                    {ot.id} · {ot.fecha}
                  </span>
                </div>
                {ot.pdf ? (
                  <button className="flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 font-mono text-[11px] font-semibold text-ink-inv">
                    <Download className="h-3.5 w-3.5" /> PDF
                  </button>
                ) : (
                  <span className="flex items-center gap-1.5 font-mono text-[11px] text-ink-faint">
                    <FileClock className="h-3.5 w-3.5" /> En proceso
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
