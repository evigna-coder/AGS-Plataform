import { useRef } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import type { Remito } from '@ags/shared';

interface Props {
  remito: Remito;
  acting: boolean;
  onSubir: (file: File) => void;
  onQuitar: () => void;
}

const formatDate = (iso?: string | null) => {
  if (!iso) return '--';
  try { return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return '--'; }
};

/**
 * Firma del cliente sobre el remito de servicio. El remito firmado es la prueba de
 * entrega; gatea la facturación para clientes `requisitoFacturacion === 'remito_firmado'`.
 */
export const RemitoFirmaCard: React.FC<Props> = ({ remito, acting, onSubir, onQuitar }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <Card compact title="Firma del cliente">
      <div className="space-y-2">
        {remito.firmado ? (
          <>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">Firmado</span>
              <span className="text-[11px] text-slate-400">{formatDate(remito.fechaFirma)}</span>
            </div>
            {remito.remitoFirmadoUrl && (
              <a href={remito.remitoFirmadoUrl} target="_blank" rel="noreferrer" className="text-xs text-teal-600 hover:underline block">Ver remito firmado →</a>
            )}
            <Button size="sm" variant="ghost" onClick={onQuitar} disabled={acting} className="text-red-600">Quitar firma</Button>
          </>
        ) : (
          <>
            <p className="text-[11px] text-slate-400">Sin remito firmado cargado.</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) onSubir(f); e.target.value = ''; }}
            />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={acting}>
              {acting ? 'Subiendo...' : 'Subir remito firmado'}
            </Button>
          </>
        )}
      </div>
    </Card>
  );
};
