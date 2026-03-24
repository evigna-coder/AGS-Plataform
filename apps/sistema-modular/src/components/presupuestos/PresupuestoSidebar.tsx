import { Link, useLocation } from 'react-router-dom';
import type { Presupuesto, Cliente, Sistema, CondicionPago, TipoPresupuesto, MonedaPresupuesto, UsuarioAGS } from '@ags/shared';
import { TIPO_PRESUPUESTO_LABELS, TIPO_PRESUPUESTO_COLORS, MONEDA_SIMBOLO, ESTADO_PRESUPUESTO_LABELS, ESTADO_PRESUPUESTO_COLORS, ORIGEN_PRESUPUESTO_LABELS } from '@ags/shared';
import { Card } from '../ui/Card';
import { SearchableSelect } from '../ui/SearchableSelect';
import { getDaysUntilExpiry, getDaysSinceEnvio, getDaysUntilContacto, getExpiryStatusColor, getExpiryStatusText, getContactoStatusColor, getContactoStatusText } from '../../utils/presupuestoHelpers';

interface PresupuestoTotals {
  subtotal: number;
  iva: number;
  ganancias: number;
  iibb: number;
  totalImpuestos: number;
  total: number;
}

const estadoOptions = Object.entries(ESTADO_PRESUPUESTO_LABELS).map(([value, label]) => ({ value, label }));
const tipoOptions = Object.entries(TIPO_PRESUPUESTO_LABELS).map(([value, label]) => ({ value, label }));
const monedaOptions: { value: MonedaPresupuesto; label: string }[] = [
  { value: 'USD', label: 'USD (U$S)' },
  { value: 'ARS', label: 'ARS ($)' },
  { value: 'EUR', label: 'EUR (€)' },
];

interface PresupuestoSidebarProps {
  estado: Presupuesto['estado'];
  tipo: TipoPresupuesto;
  moneda: MonedaPresupuesto;
  cliente: Cliente | null;
  sistema: Sistema | null;
  origenTipo?: string | null;
  origenId?: string | null;
  origenRef?: string | null;
  totals: PresupuestoTotals;
  tipoCambio: number | undefined;
  condicionPagoId: string | undefined;
  condicionesPago: CondicionPago[];
  validezDias: number;
  validUntil: string;
  fechaEnvio: string;
  proximoContacto: string;
  responsableId: string;
  usuarios: UsuarioAGS[];
  onEstadoChange: (estado: Presupuesto['estado']) => void;
  onTipoChange: (tipo: TipoPresupuesto) => void;
  onMonedaChange: (moneda: MonedaPresupuesto) => void;
  onTipoCambioChange: (v: number | undefined) => void;
  onCondicionPagoIdChange: (v: string | undefined) => void;
  onValidezDiasChange: (v: number) => void;
  onValidUntilChange: (v: string) => void;
  onFechaEnvioChange: (v: string) => void;
  onProximoContactoChange: (v: string) => void;
  onResponsableChange: (id: string, nombre: string) => void;
}

const LabelValue = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-[11px] font-medium text-slate-400 mb-0.5">{label}</p>
    <p className="text-xs text-slate-700">{value || '—'}</p>
  </div>
);

export const PresupuestoSidebar = ({
  estado, tipo, moneda, cliente, sistema,
  origenTipo, origenId, origenRef,
  totals, tipoCambio, condicionPagoId, condicionesPago,
  validezDias, validUntil, fechaEnvio,
  proximoContacto, responsableId, usuarios,
  onEstadoChange, onTipoChange, onMonedaChange,
  onTipoCambioChange, onCondicionPagoIdChange,
  onValidezDiasChange, onValidUntilChange, onFechaEnvioChange,
  onProximoContactoChange, onResponsableChange,
}: PresupuestoSidebarProps) => {
  const { pathname } = useLocation();
  const condicionPagoSeleccionada = condicionesPago.find(c => c.id === condicionPagoId);
  const sym = MONEDA_SIMBOLO[moneda] || '$';
  const fmtMoney = (n: number) => `${sym} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

  const daysUntilExpiry = getDaysUntilExpiry(validUntil, fechaEnvio, validezDias);
  const daysSinceEnvio = getDaysSinceEnvio(fechaEnvio);
  const daysUntilContacto = getDaysUntilContacto(proximoContacto);

  return (
    <div className="w-72 shrink-0 space-y-4">
      {/* Estado */}
      <Card compact>
        <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3">Estado</h3>
        <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full mb-2 ${ESTADO_PRESUPUESTO_COLORS[estado]}`}>
          {ESTADO_PRESUPUESTO_LABELS[estado]}
        </span>
        <SearchableSelect value={estado} onChange={(v) => onEstadoChange(v as Presupuesto['estado'])} options={estadoOptions} placeholder="Cambiar estado..." />
      </Card>

      {/* Tipo y moneda */}
      <Card compact>
        <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3">Tipo y moneda</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TIPO_PRESUPUESTO_COLORS[tipo]}`}>
              {TIPO_PRESUPUESTO_LABELS[tipo]}
            </span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {moneda}
            </span>
          </div>
          <SearchableSelect value={tipo} onChange={(v) => onTipoChange(v as TipoPresupuesto)} options={tipoOptions} placeholder="Tipo..." />
          <SearchableSelect value={moneda} onChange={(v) => onMonedaChange(v as MonedaPresupuesto)} options={monedaOptions} placeholder="Moneda..." />
        </div>
      </Card>

      {/* Cliente y sistema */}
      <Card compact>
        <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3">Cliente</h3>
        <div className="space-y-3">
          <div>
            <LabelValue label="Razon Social" value={cliente?.razonSocial || 'No encontrado'} />
            {cliente && (
              <Link to={`/clientes/${cliente.id}`} state={{ from: pathname }} className="text-[11px] text-teal-600 hover:underline mt-0.5 inline-block">Ver cliente →</Link>
            )}
          </div>
          {sistema && (
            <div>
              <LabelValue label="Sistema" value={sistema.nombre} />
              <Link to={`/equipos/${sistema.id}`} state={{ from: pathname }} className="text-[11px] text-teal-600 hover:underline mt-0.5 inline-block">Ver sistema →</Link>
            </div>
          )}
        </div>
      </Card>

      {/* Origen */}
      {origenTipo && (
        <Card compact>
          <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3">Origen</h3>
          <LabelValue label="Tipo" value={ORIGEN_PRESUPUESTO_LABELS[origenTipo as keyof typeof ORIGEN_PRESUPUESTO_LABELS] || origenTipo} />
          {origenTipo === 'lead' && origenId && (
            <Link to={`/leads/${origenId}`} state={{ from: pathname }} className="text-[11px] text-teal-600 hover:underline mt-1 inline-block">Ver lead →</Link>
          )}
          {origenTipo === 'ot' && origenId && (
            <Link to={`/ordenes-trabajo/${origenId}`} state={{ from: pathname }} className="text-[11px] text-teal-600 hover:underline mt-1 inline-block">Ver OT →</Link>
          )}
          {origenRef && <LabelValue label="Referencia" value={origenRef} />}
        </Card>
      )}

      {/* Seguimiento */}
      <Card compact>
        <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3">Seguimiento</h3>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Responsable</label>
            <SearchableSelect value={responsableId}
              onChange={(v) => {
                const usr = usuarios.find(u => u.id === v);
                onResponsableChange(v, usr?.displayName || '');
              }}
              options={[{ value: '', label: 'Sin asignar' }, ...usuarios.filter(u => u.status === 'activo').map(u => ({ value: u.id, label: u.displayName }))]}
              placeholder="Asignar..." />
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Próximo contacto</label>
            <input type="date" value={proximoContacto} onChange={e => onProximoContactoChange(e.target.value)}
              className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white border-slate-200" />
            {daysUntilContacto !== null && (
              <span className={`text-[10px] font-medium mt-0.5 block ${getContactoStatusColor(daysUntilContacto)}`}>
                {getContactoStatusText(daysUntilContacto)}
              </span>
            )}
          </div>
          {daysSinceEnvio !== null && (
            <div>
              <p className="text-[11px] font-medium text-slate-400 mb-0.5">Enviado hace</p>
              <span className="text-xs font-medium text-slate-600">{daysSinceEnvio}d</span>
            </div>
          )}
          {daysUntilExpiry !== null && (
            <div>
              <p className="text-[11px] font-medium text-slate-400 mb-0.5">Validez</p>
              <span className={`text-xs font-medium ${getExpiryStatusColor(daysUntilExpiry)}`}>
                {getExpiryStatusText(daysUntilExpiry)}
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Totales */}
      <Card compact>
        <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3">Totales</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-[11px] font-medium text-slate-400">Subtotal</span>
            <span className="text-xs font-semibold text-slate-700">{fmtMoney(totals.subtotal)}</span>
          </div>
          {totals.iva > 0 && (
            <div className="flex justify-between">
              <span className="text-[11px] font-medium text-slate-400">IVA</span>
              <span className="text-xs text-slate-600">{fmtMoney(totals.iva)}</span>
            </div>
          )}
          {totals.ganancias > 0 && (
            <div className="flex justify-between">
              <span className="text-[11px] font-medium text-slate-400">Ganancias</span>
              <span className="text-xs text-slate-600">{fmtMoney(totals.ganancias)}</span>
            </div>
          )}
          {totals.iibb > 0 && (
            <div className="flex justify-between">
              <span className="text-[11px] font-medium text-slate-400">IIBB</span>
              <span className="text-xs text-slate-600">{fmtMoney(totals.iibb)}</span>
            </div>
          )}
          <div className="border-t border-slate-100 pt-2 flex justify-between">
            <span className="text-xs font-semibold text-slate-700">Total</span>
            <span className="text-sm font-semibold text-teal-700">{fmtMoney(totals.total)}</span>
          </div>
          {condicionPagoSeleccionada && (
            <p className="text-[11px] text-slate-400 mt-1">{condicionPagoSeleccionada.nombre}{condicionPagoSeleccionada.dias > 0 && ` (${condicionPagoSeleccionada.dias} dias)`}</p>
          )}
        </div>
      </Card>

      {/* Fechas y condiciones */}
      <Card compact>
        <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3">Condiciones</h3>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Tipo de cambio</label>
            <input type="number" min="0" step="0.01" value={tipoCambio || ''} onChange={(e) => onTipoCambioChange(e.target.value ? Number(e.target.value) : undefined)} placeholder="Ej: 1.0" className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white border-slate-200" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Condicion de pago</label>
            <SearchableSelect value={condicionPagoId || ''} onChange={(v) => onCondicionPagoIdChange(v || undefined)}
              options={[{ value: '', label: 'Sin condicion' }, ...condicionesPago.filter(c => c.activo).map(c => ({ value: c.id, label: `${c.nombre}${c.dias > 0 ? ` (${c.dias} dias)` : ' (Contado)'}` }))]}
              placeholder="Seleccionar..." />
            <Link to="/presupuestos/condiciones-pago" className="text-[11px] text-teal-600 hover:underline mt-0.5 inline-block">Gestionar condiciones →</Link>
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Validez (dias)</label>
            <input type="number" min="1" value={validezDias} onChange={(e) => onValidezDiasChange(Number(e.target.value) || 15)} className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white border-slate-200" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Valido hasta</label>
            <input type="date" value={validUntil} onChange={(e) => onValidUntilChange(e.target.value)} className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white border-slate-200" />
          </div>
          {(estado === 'enviado' || fechaEnvio) && (
            <div>
              <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Fecha de envio</label>
              <input type="date" value={fechaEnvio} onChange={(e) => onFechaEnvioChange(e.target.value)} className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white border-slate-200" />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
