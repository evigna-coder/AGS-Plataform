import type { Certificacion } from '@ags/shared';
import { recibidasDeCertificacion, recibidasSinFacturar, totalesCertificados } from '@ags/shared';

const fmt = (moneda: string, monto: number) => `${moneda} ${monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

interface Props {
  cert: Certificacion;
  actuando: boolean;
  onPasarAFacturacion: (cert: Certificacion) => void;
}

/**
 * Documentos recibidos de un lote, con lo que habilitan a facturar. Salió de
 * `CertificacionesAbiertasSection` (2026-09-04) al pasar la facturación a
 * documento por documento: cada papel dice si ya se facturó, y el botón
 * "Pasar a facturación" cuenta los que faltan.
 */
export function CertificacionRecibidasBlock({ cert, actuando, onPasarAFacturacion }: Props) {
  const recibidas = recibidasDeCertificacion(cert);
  if (recibidas.length === 0) return null;
  const sinFacturar = recibidasSinFacturar(cert);
  const sinFacturarIds = new Set(sinFacturar.map(r => r.id));
  const totales = totalesCertificados(recibidas);
  return (
    <div className="px-3 py-2 bg-teal-50/40 border-b border-teal-100 space-y-1">
      {recibidas.map(r => (
        <div key={r.id} className="flex items-center gap-2 text-[11px]">
          <span className="font-mono font-semibold text-teal-800 shrink-0">{r.numero || 'S/N'}</span>
          <span className="text-slate-500 shrink-0">{r.fecha ? r.fecha.slice(0, 10) : 's/f'}</span>
          <span className="text-slate-700 flex-1 tabular-nums">
            {r.importes.map(i => fmt(i.moneda, i.monto)).join('  ·  ') || '—'}
            {r.otNumbers?.length ? <span className="text-slate-400"> · {r.otNumbers.length} OT{r.otNumbers.length !== 1 ? 's' : ''}</span> : null}
          </span>
          {r.importes.length > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
              sinFacturarIds.has(r.id) ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'
            }`}>
              {sinFacturarIds.has(r.id) ? 'Sin facturar' : 'Facturada'}
            </span>
          )}
          {(r.archivos?.length ? r.archivos : r.archivoUrl ? [{ url: r.archivoUrl, path: '', nombre: '' }] : []).map((a, i, arr) => (
            <a key={a.url} href={a.url} target="_blank" rel="noreferrer" title={a.nombre || undefined}
              className="text-teal-700 hover:underline shrink-0">
              {arr.length > 1 ? `Ver ${i + 1}` : 'Ver'}
            </a>
          ))}
        </div>
      ))}
      {/* Lo que se factura es esto, no el presupuesto. */}
      <div className="flex items-center gap-2 pt-1 border-t border-teal-100">
        <span className="text-[10px] font-mono uppercase tracking-wide text-teal-700 shrink-0">Certificado</span>
        <span className="text-xs font-semibold text-teal-900 tabular-nums">
          {totales.map(t => fmt(t.moneda, t.monto)).join('   ·   ') || '—'}
        </span>
        <div className="ml-auto">
          {sinFacturar.length > 0 ? (
            <button onClick={() => onPasarAFacturacion(cert)} disabled={actuando}
              className="text-[10px] font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded px-2 py-1 disabled:opacity-40">
              Pasar a facturación{sinFacturar.length > 1 ? ` (${sinFacturar.length})` : ''}
            </button>
          ) : (
            <span className="text-[10px] text-emerald-700 font-medium">✓ Pasado a facturación</span>
          )}
        </div>
      </div>
    </div>
  );
}
