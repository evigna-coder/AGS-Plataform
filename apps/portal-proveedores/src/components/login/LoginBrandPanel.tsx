import { Inbox, ClipboardList, Truck, type LucideIcon } from 'lucide-react';

interface Point {
  icon: LucideIcon;
  title: string;
  desc: string;
}

const POINTS: Point[] = [
  { icon: Inbox, title: 'Requerimientos al instante', desc: 'Anticipate a las partes apenas te asignan un requerimiento.' },
  { icon: ClipboardList, title: 'Órdenes de compra claras', desc: 'Ítems, cantidades y montos de cada OC a la vista.' },
  { icon: Truck, title: 'Informá tus entregas', desc: 'Cargá la fecha de entrega y AGS coordina la recepción.' },
];

/** Panel lateral de marca del login (solo desktop). */
export function LoginBrandPanel() {
  return (
    <div className="hidden flex-col justify-between bg-gradient-to-br from-teal-700 to-[#093F3F] p-12 lg:flex lg:w-[46%]">
      <div className="flex flex-col gap-0.5">
        <span className="font-display text-lg font-semibold text-ink-inv">Portal Proveedores</span>
        <span className="font-mono text-[10px] tracking-widest text-teal-500">AGS ANALÍTICA</span>
      </div>

      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <h2 className="font-display text-4xl font-semibold leading-tight text-ink-inv">
            Trabajemos juntos,
            <br />
            sin fricción.
          </h2>
          <p className="max-w-md text-[15px] leading-relaxed text-[#B9D4D4]">
            Recibí los requerimientos asignados, cargá tus cotizaciones e informá las fechas de
            entrega de cada orden de compra, todo en un solo lugar.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          {POINTS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                <Icon className="h-5 w-5 text-teal-500" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-ink-inv">{title}</span>
                <span className="text-[13px] text-[#B9D4D4]">{desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <span className="font-mono text-[11px] text-[#5E8C8C]">
        AGS Analítica · Servicio técnico de instrumental
      </span>
    </div>
  );
}
