import { useState } from 'react';
import type { OrdenCompra } from '@ags/shared';
import { ESTADO_OC_LABELS, ESTADO_OC_COLORS } from '@ags/shared';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { OCStatusTransition } from './OCStatusTransition';

const TIPO_LABELS: Record<string, string> = { nacional: 'Nacional', importacion: 'Importacion' };
const TIPO_COLORS: Record<string, string> = { nacional: 'bg-emerald-100 text-emerald-700', importacion: 'bg-violet-100 text-violet-700' };
const MONEDA_SYM: Record<string, string> = { ARS: '$', USD: 'U$S', EUR: '\u20AC' };

interface Props {
  oc: OrdenCompra;
  onUpdate: () => void;
}

const LabelValue = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <p className="text-[11px] font-medium text-slate-400 mb-0.5">{label}</p>
    <p className="text-xs text-slate-700">{value || '-'}</p>
  </div>
);

export const OCInfoSidebar: React.FC<Props> = ({ oc, onUpdate }) => {
  const [showTransition, setShowTransition] = useState(false);
  const sym = MONEDA_SYM[oc.moneda] || '$';

  const fmtCurrency = (val: number | null | undefined) => {
    if (val == null) return '-';
    return `${sym} ${val.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  };

  const fmtDate = (val: string | null | undefined) => {
    if (!val) return '-';
    return new Date(val).toLocaleDateString('es-AR');
  };

  return (
    <div className="w-72 shrink-0 space-y-4">
      <Card compact>
        <div className="space-y-3">
          <LabelValue label="Numero" value={<span className="font-mono font-semibold">{oc.numero}</span>} />

          <div>
            <p className="text-[11px] font-medium text-slate-400 mb-0.5">Tipo</p>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TIPO_COLORS[oc.tipo] || ''}`}>
              {TIPO_LABELS[oc.tipo] || oc.tipo}
            </span>
          </div>

          <div>
            <p className="text-[11px] font-medium text-slate-400 mb-0.5">Estado</p>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_OC_COLORS[oc.estado]}`}>
              {ESTADO_OC_LABELS[oc.estado]}
            </span>
          </div>

          <LabelValue label="Proveedor" value={oc.proveedorNombre} />
        </div>
      </Card>

      {/* Proforma */}
      {(oc.proformaNumero || oc.fechaProforma) && (
        <Card title="Proforma" compact>
          <div className="space-y-3">
            <LabelValue label="Numero proforma" value={oc.proformaNumero} />
            <LabelValue label="Fecha proforma" value={fmtDate(oc.fechaProforma)} />
          </div>
        </Card>
      )}

      {/* Financials */}
      <Card title="Valores" compact>
        <div className="space-y-3">
          <LabelValue label="Moneda" value={oc.moneda} />
          <LabelValue label="Subtotal" value={fmtCurrency(oc.subtotal)} />
          <LabelValue label="Impuestos" value={fmtCurrency(oc.impuestos)} />
          <div>
            <p className="text-[11px] font-medium text-slate-400 mb-0.5">Total</p>
            <p className="text-sm font-semibold text-slate-900">{fmtCurrency(oc.total)}</p>
          </div>
        </div>
      </Card>

      {/* Dates */}
      <Card title="Fechas" compact>
        <div className="space-y-3">
          <LabelValue label="Entrega estimada" value={fmtDate(oc.fechaEntregaEstimada)} />
          <LabelValue label="Recepcion" value={fmtDate(oc.fechaRecepcion)} />
          <LabelValue label="Creado" value={fmtDate(oc.createdAt)} />
          <LabelValue label="Actualizado" value={fmtDate(oc.updatedAt)} />
        </div>
      </Card>

      {/* Extra */}
      {(oc.condicionesPago || oc.notas) && (
        <Card compact>
          <div className="space-y-3">
            {oc.condicionesPago && <LabelValue label="Condiciones de pago" value={oc.condicionesPago} />}
            {oc.notas && <LabelValue label="Notas" value={oc.notas} />}
          </div>
        </Card>
      )}

      <Button size="sm" variant="outline" className="w-full" onClick={() => setShowTransition(true)}>
        Cambiar estado
      </Button>

      <OCStatusTransition
        oc={oc}
        open={showTransition}
        onClose={() => setShowTransition(false)}
        onUpdated={() => { setShowTransition(false); onUpdate(); }}
      />
    </div>
  );
};
