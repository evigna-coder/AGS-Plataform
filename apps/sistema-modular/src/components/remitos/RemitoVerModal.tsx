import { Link } from 'react-router-dom';
import type { Remito, TipoRemito, EstadoRemito } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { RemitoItemsInline } from './RemitoItemsInline';
import { FotosMercaderiaSection } from '../stock/FotosMercaderiaSection';
import { RemitoHistorialCard } from './RemitoHistorialCard';

const TIPO_LABELS: Record<TipoRemito, string> = { salida_campo: 'Salida a campo', entrega_cliente: 'Entrega a cliente', devolucion: 'Devolución', interno: 'Interno', derivacion_proveedor: 'Derivación proveedor', loaner_salida: 'Loaner salida', servicio: 'Servicio' };
const ESTADO_LABELS: Record<EstadoRemito, string> = { borrador: 'Borrador', confirmado: 'Confirmado', en_transito: 'En tránsito', en_proveedor: 'En proveedor externo', completado: 'Completado', completado_parcial: 'Parcial', cancelado: 'Cancelado' };
const ESTADO_COLORS: Record<EstadoRemito, string> = { borrador: 'bg-slate-100 text-slate-600', confirmado: 'bg-blue-100 text-blue-700', en_transito: 'bg-amber-100 text-amber-700', en_proveedor: 'bg-orange-100 text-orange-700', completado: 'bg-green-100 text-green-700', completado_parcial: 'bg-purple-100 text-purple-700', cancelado: 'bg-red-100 text-red-700' };

const LV = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <p className="text-[10px] font-mono uppercase tracking-wide text-slate-400 mb-0.5">{label}</p>
    <p className="text-xs text-slate-700">{value || '—'}</p>
  </div>
);

const fmtFecha = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/**
 * Vista rápida del remito en modal (2026-08-04: "que el botón Ver habilite un
 * modal"): datos, items y historial sin salir del listado. La ficha completa
 * (acciones de firma, descarga, etc.) sigue en /stock/remitos/:id.
 */
export function RemitoVerModal({ remito, onClose, clientePorFicha }: {
  remito: Remito;
  onClose: () => void;
  /** Dueño por ficha, para detallar el cliente de cada línea (2026-08-07). */
  clientePorFicha?: Map<string, string>;
}) {
  return (
    <Modal open onClose={onClose} title={`Remito ${remito.numero}`} maxWidth="2xl">
      <div className="space-y-4">
        <div className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">{TIPO_LABELS[remito.tipo]}</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${ESTADO_COLORS[remito.estado]}`}>{ESTADO_LABELS[remito.estado]}</span>
          {remito.impreso && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-600">Impreso</span>}
        </div>

        <div className="grid grid-cols-3 gap-x-4 gap-y-3">
          <LV label="Cliente" value={remito.clienteNombre
            ? `${remito.clienteNombre}${remito.establecimientoNombre ? ` (${remito.establecimientoNombre})` : ''}`
            : '—'} />
          <LV label={remito.transportistaNombre && !remito.ingenieroNombre ? 'Transportista' : 'Ingeniero'}
            value={remito.ingenieroNombre || remito.transportistaNombre} />
          <LV label="OTs" value={remito.otNumbers?.length ? remito.otNumbers.join(', ') : '—'} />
          <LV label="Fecha salida" value={fmtFecha(remito.fechaSalida)} />
          <LV label="Fecha devolución" value={fmtFecha(remito.fechaDevolucion)} />
          {remito.proveedorNombre && <LV label="Proveedor" value={remito.proveedorNombre} />}
        </div>

        {remito.observaciones && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            <p className="text-[10px] font-mono uppercase tracking-wide text-slate-400 mb-0.5">Observaciones</p>
            <p className="text-xs text-slate-700 whitespace-pre-wrap">{remito.observaciones}</p>
          </div>
        )}

        <div>
          <p className="text-[10px] font-mono uppercase tracking-wide text-slate-400 mb-1">Items ({remito.items?.length ?? 0})</p>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <RemitoItemsInline remito={remito} clientePorFicha={clientePorFicha} />
          </div>
        </div>

        {/* Fotos de cómo salió la mercadería (2026-09-03) — el camino
            "mostrame lo que le mandamos a tal cliente". */}
        <FotosMercaderiaSection
          titulo="Fotos de entrega"
          fotos={remito.fotos}
          cerradaAt={remito.fotosCerradasAt}
          cerradaPor={remito.fotosCerradasPor}
        />
        <RemitoHistorialCard remitoId={remito.id} />

        <div className="flex justify-end pt-1">
          <Link to={`/stock/remitos/${remito.id}`} onClick={onClose}
            className="text-xs text-teal-600 hover:underline font-medium">
            Abrir ficha completa ↗
          </Link>
        </div>
      </div>
    </Modal>
  );
}
