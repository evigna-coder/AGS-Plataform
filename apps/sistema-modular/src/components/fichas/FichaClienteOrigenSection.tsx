import { Input } from '../ui/Input';
import type { Cliente, Establecimiento, Ingeniero, ViaIngreso } from '@ags/shared';
import { VIA_INGRESO_LABELS } from '@ags/shared';

interface Props {
  clientes: Cliente[];
  establecimientos: Establecimiento[];
  ingenieros: Ingeniero[];
  clienteId: string;
  onClienteChange: (id: string) => void;
  establecimientoId: string;
  onEstablecimientoChange: (id: string) => void;
  viaIngreso: ViaIngreso;
  onViaIngresoChange: (v: ViaIngreso) => void;
  traidoPor: string;
  onTraidoPorChange: (v: string) => void;
  fechaIngreso: string;
  onFechaIngresoChange: (v: string) => void;
  otReferencia: string;
  onOtReferenciaChange: (v: string) => void;
  errors: Record<string, string>;
  otReferenciaPlaceholder?: string;
}

const sel = 'w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs';
const lbl = 'block text-[11px] font-medium text-slate-500 mb-1';

/** Sección "Cliente y origen" compartida entre CreateFichaModal y EditFichaModal. */
export function FichaClienteOrigenSection({
  clientes, establecimientos, ingenieros,
  clienteId, onClienteChange,
  establecimientoId, onEstablecimientoChange,
  viaIngreso, onViaIngresoChange,
  traidoPor, onTraidoPorChange,
  fechaIngreso, onFechaIngresoChange,
  otReferencia, onOtReferenciaChange,
  errors, otReferenciaPlaceholder,
}: Props) {
  return (
    <section>
      <h3 className="text-xs font-semibold text-slate-700 mb-3 uppercase tracking-wide">Cliente y origen</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Cliente *</label>
          {/* El cliente actual se lista aunque esté inactivo — sin esto la ficha abre con el select vacío. */}
          <select className={sel} value={clienteId} onChange={e => onClienteChange(e.target.value)}>
            <option value="">Seleccionar cliente</option>
            {clientes.filter(c => c.activo || c.id === clienteId).map(c => <option key={c.id} value={c.id}>{c.razonSocial}</option>)}
          </select>
          {errors.clienteId && <p className="text-[10px] text-red-500 mt-0.5">{errors.clienteId}</p>}
        </div>
        <div>
          <label className={lbl}>Establecimiento</label>
          <select className={sel} value={establecimientoId} onChange={e => onEstablecimientoChange(e.target.value)} disabled={!clienteId}>
            <option value="">Seleccionar</option>
            {establecimientos.filter(e => e.activo || e.id === establecimientoId).map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>Via de ingreso</label>
          <select className={sel} value={viaIngreso} onChange={e => onViaIngresoChange(e.target.value as ViaIngreso)}>
            {(Object.keys(VIA_INGRESO_LABELS) as ViaIngreso[]).map(v => <option key={v} value={v}>{VIA_INGRESO_LABELS[v]}</option>)}
          </select>
        </div>
        {viaIngreso === 'ingeniero' ? (
          <div>
            <label className={lbl}>Traido por *</label>
            <select className={sel} value={traidoPor} onChange={e => onTraidoPorChange(e.target.value)}>
              <option value="">Seleccionar ingeniero</option>
              {ingenieros.map(i => <option key={i.id} value={i.nombre}>{i.nombre}</option>)}
            </select>
            {errors.traidoPor && <p className="text-[10px] text-red-500 mt-0.5">{errors.traidoPor}</p>}
          </div>
        ) : (
          <Input label="Traido por *" value={traidoPor} onChange={e => onTraidoPorChange(e.target.value)} error={errors.traidoPor} placeholder={viaIngreso === 'envio' ? 'Empresa de transporte' : 'Quien lo trajo'} />
        )}
        <Input label="Fecha de ingreso *" type="date" value={fechaIngreso} onChange={e => onFechaIngresoChange(e.target.value)} error={errors.fechaIngreso} />
        <Input label="OT de referencia" value={otReferencia} onChange={e => onOtReferenciaChange(e.target.value)} placeholder={otReferenciaPlaceholder} />
      </div>
    </section>
  );
}
