import { Link } from 'react-router-dom';
import type { Presupuesto, Cliente, Sistema, CondicionPago } from '@ags/shared';
import { Card } from '../ui/Card';
import { SearchableSelect } from '../ui/SearchableSelect';

interface PresupuestoTotals {
  subtotal: number;
  iva: number;
  ganancias: number;
  iibb: number;
  totalImpuestos: number;
  total: number;
}

const estadoLabels: Record<Presupuesto['estado'], string> = {
  borrador: 'Borrador',
  enviado: 'Enviado',
  en_seguimiento: 'En Seguimiento',
  pendiente_oc: 'Pendiente OC',
  aceptado: 'Aceptado',
  pendiente_certificacion: 'Pendiente Cert.',
  aguarda: 'Aguarda',
};

const estadoColors: Record<Presupuesto['estado'], string> = {
  borrador: 'bg-slate-100 text-slate-700',
  enviado: 'bg-blue-100 text-blue-700',
  en_seguimiento: 'bg-yellow-100 text-yellow-700',
  pendiente_oc: 'bg-orange-100 text-orange-700',
  aceptado: 'bg-green-100 text-green-700',
  pendiente_certificacion: 'bg-purple-100 text-purple-700',
  aguarda: 'bg-red-100 text-red-700',
};

const estadoOptions = Object.entries(estadoLabels).map(([value, label]) => ({ value, label }));

interface PresupuestoSidebarProps {
  estado: Presupuesto['estado'];
  cliente: Cliente | null;
  sistema: Sistema | null;
  totals: PresupuestoTotals;
  tipoCambio: number | undefined;
  condicionPagoId: string | undefined;
  condicionesPago: CondicionPago[];
  validUntil: string;
  fechaEnvio: string;
  onEstadoChange: (estado: Presupuesto['estado']) => void;
  onTipoCambioChange: (v: number | undefined) => void;
  onCondicionPagoIdChange: (v: string | undefined) => void;
  onValidUntilChange: (v: string) => void;
  onFechaEnvioChange: (v: string) => void;
}

const LabelValue = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-[11px] font-medium text-slate-400 mb-0.5">{label}</p>
    <p className="text-xs text-slate-700">{value || '—'}</p>
  </div>
);

export const PresupuestoSidebar = ({
  estado,
  cliente,
  sistema,
  totals,
  tipoCambio,
  condicionPagoId,
  condicionesPago,
  validUntil,
  fechaEnvio,
  onEstadoChange,
  onTipoCambioChange,
  onCondicionPagoIdChange,
  onValidUntilChange,
  onFechaEnvioChange,
}: PresupuestoSidebarProps) => {
  const condicionPagoSeleccionada = condicionesPago.find(c => c.id === condicionPagoId);

  return (
    <div className="w-72 shrink-0 space-y-4">
      {/* Estado */}
      <Card compact>
        <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3">Estado</h3>
        <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full mb-2 ${estadoColors[estado]}`}>
          {estadoLabels[estado]}
        </span>
        <SearchableSelect
          value={estado}
          onChange={(v) => onEstadoChange(v as Presupuesto['estado'])}
          options={estadoOptions}
          placeholder="Cambiar estado..."
        />
      </Card>

      {/* Cliente y sistema */}
      <Card compact>
        <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3">Cliente</h3>
        <div className="space-y-3">
          <div>
            <LabelValue label="Razon Social" value={cliente?.razonSocial || 'No encontrado'} />
            {cliente && (
              <Link to={`/clientes/${cliente.id}`} className="text-[11px] text-indigo-600 hover:underline mt-0.5 inline-block">
                Ver cliente →
              </Link>
            )}
          </div>
          {sistema && (
            <div>
              <LabelValue label="Sistema" value={sistema.nombre} />
              <Link to={`/equipos/${sistema.id}`} className="text-[11px] text-indigo-600 hover:underline mt-0.5 inline-block">
                Ver sistema →
              </Link>
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
            <span className="text-xs font-semibold text-slate-700">
              ${totals.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          {totals.iva > 0 && (
            <div className="flex justify-between">
              <span className="text-[11px] font-medium text-slate-400">IVA</span>
              <span className="text-xs text-slate-600">
                ${totals.iva.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
          {totals.ganancias > 0 && (
            <div className="flex justify-between">
              <span className="text-[11px] font-medium text-slate-400">Ganancias</span>
              <span className="text-xs text-slate-600">
                ${totals.ganancias.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
          {totals.iibb > 0 && (
            <div className="flex justify-between">
              <span className="text-[11px] font-medium text-slate-400">IIBB</span>
              <span className="text-xs text-slate-600">
                ${totals.iibb.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
          <div className="border-t border-slate-100 pt-2 flex justify-between">
            <span className="text-xs font-semibold text-slate-700">Total</span>
            <span className="text-sm font-semibold text-indigo-700">
              ${totals.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          {condicionPagoSeleccionada && (
            <p className="text-[11px] text-slate-400 mt-1">
              {condicionPagoSeleccionada.nombre}
              {condicionPagoSeleccionada.dias > 0 && ` (${condicionPagoSeleccionada.dias} dias)`}
            </p>
          )}
        </div>
      </Card>

      {/* Fechas y condiciones */}
      <Card compact>
        <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3">Condiciones</h3>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Tipo de cambio</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={tipoCambio || ''}
              onChange={(e) => onTipoCambioChange(e.target.value ? Number(e.target.value) : undefined)}
              placeholder="Ej: 1.0"
              className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white border-slate-200"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Condicion de pago</label>
            <SearchableSelect
              value={condicionPagoId || ''}
              onChange={(v) => onCondicionPagoIdChange(v || undefined)}
              options={[
                { value: '', label: 'Sin condicion' },
                ...condicionesPago.filter(c => c.activo).map(c => ({
                  value: c.id,
                  label: `${c.nombre}${c.dias > 0 ? ` (${c.dias} dias)` : ' (Contado)'}`,
                })),
              ]}
              placeholder="Seleccionar..."
            />
            <Link to="/presupuestos/condiciones-pago" className="text-[11px] text-indigo-600 hover:underline mt-0.5 inline-block">
              Gestionar condiciones →
            </Link>
            {condicionPagoSeleccionada?.descripcion && (
              <p className="text-[11px] text-slate-400 mt-0.5 italic">{condicionPagoSeleccionada.descripcion}</p>
            )}
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Valido hasta</label>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => onValidUntilChange(e.target.value)}
              className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white border-slate-200"
            />
          </div>
          {estado === 'enviado' && (
            <div>
              <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Fecha de envio</label>
              <input
                type="date"
                value={fechaEnvio}
                onChange={(e) => onFechaEnvioChange(e.target.value)}
                className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white border-slate-200"
              />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
