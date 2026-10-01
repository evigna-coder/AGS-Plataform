import { Drawer } from '../ui/Drawer';
import { fmtCantidad, labelMes, ORIGEN_LABEL, type FilaPlan, type ServicioPrevisto } from '../../utils/planificacionInsumos';

interface Props {
  fila: FilaPlan | null;
  onClose: () => void;
}

const ORIGEN_CLASE: Record<ServicioPrevisto['origen'], string> = {
  agenda: 'bg-teal-50 text-teal-700 border-teal-200',
  pendiente: 'bg-sky-50 text-sky-700 border-sky-200',
  contrato: 'bg-violet-50 text-violet-700 border-violet-200',
  anio_anterior: 'bg-amber-50 text-amber-700 border-amber-200',
};

/**
 * De dónde sale cada número de la fila: por mes, los servicios previstos
 * (con su origen y qué perfil aportó el consumo) y los ingresos esperados.
 */
export function PlanificacionDetalleDrawer({ fila, onClose }: Props) {
  return (
    <Drawer open={!!fila} onClose={onClose} title={fila?.codigo ?? ''} subtitle={fila?.descripcion} width="max-w-2xl">
      {fila && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3 text-xs">
            <Dato label="Stock hoy" valor={`${fmtCantidad(fila.stockInicial)}${fila.stockEnKits > 0 ? ` (${fmtCantidad(fila.stockEnKits)} en kits)` : ''}`} />
            <Dato label="Mínimo" valor={fila.stockMinimo > 0 ? String(fila.stockMinimo) : '—'} />
            <Dato label="Comprar" valor={fila.comprar > 0 ? `${fila.comprar}${fila.mesQuiebre ? ` (quiebra ${labelMes(fila.mesQuiebre)})` : ''}` : 'No hace falta'} resaltar={fila.comprar > 0} />
          </div>
          {/* Kits (2026-09-30): el artículo se compra dentro de un kit. */}
          {fila.kits.length > 0 && (
            <p className="text-[11px] text-violet-700 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
              Viene en kit: {fila.kits.map(k => `${k.kitCodigo} (${k.cantidadPorKit} por kit · ${k.disponibles} disponible${k.disponibles === 1 ? '' : 's'}${fila.comprar > 0 ? ` · comprar ${k.comprarKits}` : ''})`).join(' · ')}.
              {fila.kits.length > 1 && ' Está en más de un kit: elegí vos cuál comprar.'}
            </p>
          )}
          {fila.ingresosSinFecha > 0 && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {fmtCantidad(fila.ingresosSinFecha)} unidades compradas sin fecha estimada de llegada se contaron en el primer mes.
            </p>
          )}
          {fila.meses.map(c => (
            <section key={c.mes} className="border border-slate-200 rounded-lg overflow-hidden">
              <header className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-b border-slate-200">
                <span className="text-xs font-semibold text-slate-700 capitalize">{labelMes(c.mes)}</span>
                <span className="text-[11px] text-slate-500">
                  demanda {fmtCantidad(c.demanda)} · ingresos {fmtCantidad(c.ingresos)} ·{' '}
                  <span className={c.stockFin < 0 ? 'text-red-600 font-semibold' : 'text-slate-700 font-medium'}>fin {fmtCantidad(c.stockFin)}</span>
                </span>
              </header>
              {c.servicios.length === 0 && c.ingresosDetalle.length === 0 ? (
                <p className="px-3 py-2 text-[11px] text-slate-400 italic">Sin servicios previstos ni ingresos.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {c.servicios.map((s, i) => (
                    <li key={`s${i}`} className="flex items-center gap-2 px-3 py-1.5 text-[11px]">
                      <span className={`px-1.5 py-0.5 rounded border text-[9px] font-mono uppercase tracking-wide ${ORIGEN_CLASE[s.origen]}`}>{ORIGEN_LABEL[s.origen]}</span>
                      <span className="flex-1 text-slate-700 truncate" title={s.sistemaNombre}>
                        {s.sistemaNombre}
                        {s.otNumber && <span className="text-slate-400 font-mono ml-1">{s.otNumber}</span>}
                      </span>
                      <span className="text-slate-400 truncate max-w-[180px]" title={s.perfiles.join(', ')}>
                        {s.perfiles.length > 0 ? s.perfiles.join(', ') : 'sin perfil'}
                      </span>
                      <span className="font-mono text-slate-700 w-16 text-right">
                        {s.cantidad !== 1 && <span className="text-slate-400">{fmtCantidad(s.cantidad)} × </span>}{fmtCantidad(s.consumo)}
                      </span>
                    </li>
                  ))}
                  {c.ingresosDetalle.map((ing, i) => (
                    <li key={`i${i}`} className="flex items-center gap-2 px-3 py-1.5 text-[11px] bg-teal-50/40">
                      <span className="px-1.5 py-0.5 rounded border border-teal-200 bg-white text-teal-700 text-[9px] font-mono uppercase tracking-wide">
                        {ing.origen === 'oc' ? 'OC' : 'Importación'}
                      </span>
                      <span className="flex-1 text-slate-700">
                        {ing.referencia}
                        {ing.viaKit && <span className="text-violet-600 ml-1">· {ing.viaKit.kits} kit{ing.viaKit.kits === 1 ? '' : 's'} {ing.viaKit.kitCodigo}</span>}
                        {!ing.fecha && <span className="text-amber-600 ml-1">(sin fecha)</span>}
                      </span>
                      <span className="font-mono text-teal-700 w-16 text-right">+{fmtCantidad(ing.cantidad)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </Drawer>
  );
}

function Dato({ label, valor, resaltar }: { label: string; valor: string; resaltar?: boolean }) {
  return (
    <div className="bg-slate-50 rounded-lg px-3 py-2">
      <span className="block text-[10px] font-mono uppercase tracking-wide text-slate-400">{label}</span>
      <span className={`text-sm font-semibold ${resaltar ? 'text-red-600' : 'text-slate-800'}`}>{valor}</span>
    </div>
  );
}
