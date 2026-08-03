import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Factura, Lead } from '@ags/shared';
import { FACTURA_ESTADO_LABELS, FACTURA_ESTADO_COLORS } from '@ags/shared';
import { facturasService } from '../../services/facturasService';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/StatusBadge';
import { AprobarFacturaModal } from './AprobarFacturaModal';

/**
 * Card de la factura vinculada a un ticket de Control de facturas (2026-08-03):
 * acceso directo desde el ticket + aprobación sin ir al listado.
 * Renderiza null si el ticket no tiene factura. Para tickets creados antes del
 * campo `facturaId`, cae al id embebido en la descripción ("#<id>").
 */
export const TicketFacturaCard = ({ lead }: { lead: Lead }) => {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [factura, setFactura] = useState<Factura | null>(null);
  const [aprobando, setAprobando] = useState(false);

  const facturaId = lead.facturaId
    || lead.descripcion?.match(/Control de facturas #([A-Za-z0-9]+)/)?.[1]
    || null;

  useEffect(() => {
    if (!facturaId) { setFactura(null); return; }
    let cancel = false;
    facturasService.getById(facturaId)
      .then(f => { if (!cancel) setFactura(f); })
      .catch(err => console.error('Error cargando factura del ticket:', err));
    return () => { cancel = true; };
  }, [facturaId]);

  if (!facturaId || !factura) return null;

  return (
    <>
      <Card>
        <div className="p-4 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <h3 className="text-[11px] font-medium text-slate-400 mb-1">Factura vinculada</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-mono font-semibold text-slate-800">{factura.numero ?? '—'}</span>
              <span className="text-xs text-slate-600 truncate">{factura.proveedorNombre}</span>
              <StatusBadge label={FACTURA_ESTADO_LABELS[factura.estado]} colorClass={FACTURA_ESTADO_COLORS[factura.estado]} />
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {factura.pdfUrl && (
              <a href={factura.pdfUrl} target="_blank" rel="noopener noreferrer"
                className="text-[11px] font-medium text-emerald-600 hover:text-emerald-800 px-2 py-1 rounded hover:bg-emerald-50">
                Previsualizar
              </a>
            )}
            {factura.estado === 'pendiente' && (
              <Button size="sm" onClick={() => setAprobando(true)}>Aprobar</Button>
            )}
            {/* estado= vacío fuerza "Todas": el default del listado es 'pendiente'
                y una factura ya aprobada/pagada quedaría filtrada (invisible). */}
            <Button size="sm" variant="outline" onClick={() => navigate(`/control-facturas?estado=&factura=${factura.id}`)}>
              Ver en Control de facturas
            </Button>
          </div>
        </div>
      </Card>
      {aprobando && (
        <AprobarFacturaModal
          factura={factura}
          actor={usuario?.displayName ?? 'Sistema'}
          onClose={() => setAprobando(false)}
          onApproved={() => { facturasService.getById(factura.id).then(setFactura); }}
        />
      )}
    </>
  );
};
