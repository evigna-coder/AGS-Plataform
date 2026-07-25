import { Activity, FileText, Headset, type LucideIcon } from 'lucide-react';

interface Point {
  icon: LucideIcon;
  title: string;
  desc: string;
}

const POINTS: Point[] = [
  { icon: Activity, title: 'Estado en vivo', desc: 'Seguí el avance de cada equipo en nuestro bench.' },
  { icon: FileText, title: 'Informes a un clic', desc: 'Descargá el PDF de cada servicio cuando lo necesites.' },
  { icon: Headset, title: 'Servicio a demanda', desc: 'Solicitá una visita o retiro en segundos.' },
];

/** Panel lateral de marca del login (solo desktop). */
export function LoginBrandPanel() {
  return (
    <div className="hidden flex-col justify-between bg-gradient-to-br from-teal-700 to-[#093F3F] p-12 lg:flex lg:w-[46%]">
      <div className="flex flex-col gap-0.5">
        <span className="font-display text-lg font-semibold text-ink-inv">Portal Cliente</span>
        <span className="font-mono text-[10px] tracking-widest text-teal-500">AGS ANALÍTICA</span>
      </div>

      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <h2 className="font-display text-4xl font-semibold leading-tight text-ink-inv">
            Tus equipos,
            <br />
            siempre a la vista.
          </h2>
          <p className="max-w-md text-[15px] leading-relaxed text-[#B9D4D4]">
            Seguí el estado de tu flota, el avance de las reparaciones en nuestro bench y descargá
            los informes de cada servicio, todo en un solo lugar.
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
