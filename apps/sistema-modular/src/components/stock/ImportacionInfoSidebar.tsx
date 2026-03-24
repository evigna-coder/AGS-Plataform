import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { ImportacionStatusTransition } from './ImportacionStatusTransition';
import type { Importacion } from '@ags/shared';
import { ESTADO_IMPORTACION_LABELS, ESTADO_IMPORTACION_COLORS } from '@ags/shared';

interface Props {
  imp: Importacion;
  onUpdate: () => void;
}

export const ImportacionInfoSidebar: React.FC<Props> = ({ imp, onUpdate }) => {
  const [showStatusModal, setShowStatusModal] = useState(false);

  const formatDate = (d?: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="space-y-4">
      <Card compact>
        <div className="space-y-3">
          {/* Numero */}
          <div>
            <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Numero</label>
            <p className="text-xs text-slate-700 font-semibold">{imp.numero}</p>
          </div>

          {/* Estado */}
          <div>
            <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Estado</label>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_IMPORTACION_COLORS[imp.estado]}`}>
                {ESTADO_IMPORTACION_LABELS[imp.estado]}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setShowStatusModal(true)}>
                Cambiar
              </Button>
            </div>
          </div>

          {/* OC */}
          <div>
            <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Orden de compra</label>
            <Link
              to={`/stock/ordenes-compra/${imp.ordenCompraId}`}
              className="text-xs text-teal-600 font-medium hover:underline"
            >
              {imp.ordenCompraNumero}
            </Link>
          </div>

          {/* Proveedor */}
          <div>
            <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Proveedor</label>
            <p className="text-xs text-slate-700">{imp.proveedorNombre}</p>
          </div>

          {/* Incoterm */}
          <div>
            <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Incoterm</label>
            <p className="text-xs text-slate-700">{imp.incoterm || '-'}</p>
          </div>

          {/* Fechas resumen */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div>
              <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Embarque</label>
              <p className="text-xs text-slate-700">{formatDate(imp.fechaEmbarque)}</p>
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">ETA</label>
              <p className="text-xs text-slate-700">{formatDate(imp.fechaEstimadaArribo)}</p>
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Arribo real</label>
              <p className="text-xs text-slate-700">{formatDate(imp.fechaArriboReal)}</p>
            </div>
          </div>

          {/* Notas */}
          {imp.notas && (
            <div className="pt-2 border-t border-slate-100">
              <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Notas</label>
              <p className="text-xs text-slate-700 whitespace-pre-wrap">{imp.notas}</p>
            </div>
          )}

          {/* Audit */}
          <div className="pt-2 border-t border-slate-100">
            <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Creado</label>
            <p className="text-xs text-slate-700">{formatDate(imp.createdAt)}</p>
          </div>
        </div>
      </Card>

      {showStatusModal && (
        <ImportacionStatusTransition
          imp={imp}
          onClose={() => setShowStatusModal(false)}
          onUpdate={() => { setShowStatusModal(false); onUpdate(); }}
        />
      )}
    </div>
  );
};
