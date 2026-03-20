import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import type { Loaner } from '@ags/shared';

interface Props {
  loaner: Loaner;
  onVender: () => void;
}

export function LoanerVentaSection({ loaner, onVender }: Props) {
  if (loaner.venta) {
    const formatDate = (iso: string) => {
      try { return new Date(iso).toLocaleDateString('es-AR'); } catch { return '-'; }
    };

    return (
      <Card title="Detalle de venta">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Cliente</span>
            <span className="text-slate-700 font-medium">{loaner.venta.clienteNombre}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Fecha</span>
            <span className="text-slate-700">{formatDate(loaner.venta.fecha)}</span>
          </div>
          {loaner.venta.precio != null && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Precio</span>
              <span className="text-slate-700 font-medium">{loaner.venta.moneda || 'ARS'} {loaner.venta.precio.toLocaleString()}</span>
            </div>
          )}
          {loaner.venta.notas && (
            <p className="text-xs text-slate-500 mt-2">{loaner.venta.notas}</p>
          )}
        </div>
      </Card>
    );
  }

  if (loaner.estado === 'en_base') {
    return (
      <Card title="Venta">
        <div className="text-center py-2">
          <p className="text-sm text-slate-400 mb-3">Este loaner no ha sido vendido</p>
          <Button variant="secondary" size="sm" onClick={onVender}>Registrar venta</Button>
        </div>
      </Card>
    );
  }

  return null;
}
