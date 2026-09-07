import { useEffect, useState } from 'react';
import type { ImporteCertificado, ItemCertificacion } from '@ags/shared';
import { MONEDA_SIMBOLO } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { certificacionesService } from '../../services/certificacionesService';

const lbl = 'text-[10px] font-mono uppercase tracking-wide text-slate-500 mb-1 block';
const inp = 'w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs';

interface Props {
  open: boolean;
  onClose: () => void;
  onAgregada: () => void;
  loteId: string;
  clienteNombre: string;
  periodo?: string | null;
  /** OTs del lote que siguen pendientes: el documento elige cuáles certifica (todas, por defecto). */
  pendientes: ItemCertificacion[];
}

/**
 * Carga una certificación recibida del cliente (2026-08-17).
 *
 * Un lote admite varias: el cliente puede mandar un documento por planta o
 * separar por moneda. Los importes son la clave — lo que se factura es lo que
 * el cliente certificó, no lo que decía el presupuesto.
 */
export function AgregarRecibidaModal({ open, onClose, onAgregada, loteId, clienteNombre, periodo, pendientes }: Props) {
  const [numero, setNumero] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  /** Pesos y dólares siempre a la vista (2026-09-07): el caso normal es
   *  un documento con una parte en cada moneda. Euros, a pedido. */
  const [importes, setImportes] = useState<ImporteCertificado[]>([{ moneda: 'ARS', monto: 0 }, { moneda: 'USD', monto: 0 }]);
  const [observaciones, setObservaciones] = useState('');
  const [archivos, setArchivos] = useState<File[]>([]);
  /**
   * Por defecto certifica todo lo pendiente: el cliente manda UN papel por el
   * conjunto. Cuando manda uno por planta (2026-09-04), se destildan las de
   * la otra planta y el lote queda abierto para el papel siguiente.
   */
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNumero(''); setFecha(new Date().toISOString().slice(0, 10));
    setImportes([{ moneda: 'ARS', monto: 0 }, { moneda: 'USD', monto: 0 }]);
    setObservaciones(''); setArchivos([]);
    setElegidas(new Set(pendientes.map(p => p.otNumber)));
  }, [open, pendientes]);

  const setImporte = (i: number, patch: Partial<ImporteCertificado>) =>
    setImportes(prev => prev.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const conMonto = importes.filter(i => Number.isFinite(i.monto) && i.monto !== 0);

  const handleSubmit = async () => {
    if (guardando) return;
    setGuardando(true);
    try {
      await certificacionesService.agregarRecibida(loteId, {
        numero: numero.trim() || null,
        fecha: fecha || null,
        importes: conMonto,
        observaciones: observaciones.trim() || null,
        archivos,
        otNumbers: [...elegidas],
      });
      onAgregada();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo cargar la certificación');
    } finally { setGuardando(false); }
  };

  return (
    <Modal open={open} onClose={onClose} maxWidth="md"
      title="Cargar certificación recibida"
      subtitle={`${clienteNombre}${periodo ? ` · ${periodo}` : ''}`}
      footer={<>
        <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
        <Button size="sm" onClick={() => void handleSubmit()} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Cargar certificación'}
        </Button>
      </>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {/* Número y fecha OPCIONALES (2026-09-04): hay clientes que certifican
              con un papel sin número ni fecha. Lo que manda son los importes. */}
          <div>
            <label className={lbl}>N° de certificación <span className="normal-case tracking-normal text-slate-400">(si tiene)</span></label>
            <input value={numero} onChange={e => setNumero(e.target.value)}
              placeholder="El que puso el cliente, o vacío" className={`${inp} font-mono`} />
          </div>
          <div>
            <label className={lbl}>Fecha del documento <span className="normal-case tracking-normal text-slate-400">(si tiene)</span></label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inp} />
          </div>
        </div>

        {/* Importes: recuadro destacado (2026-09-07, "apenas se veía"), con
            pesos y dólares fijos — un documento suele certificar una parte en
            cada moneda, y cada una genera su propia solicitud de facturación. */}
        <div className="rounded-lg border-2 border-teal-200 bg-teal-50/40 px-3 py-2.5">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xs font-semibold text-teal-900">Importes certificados
              <span className="font-normal text-teal-700/80"> (si el cliente los informa)</span>
            </span>
            {!importes.some(i => i.moneda === 'EUR') && (
              <button onClick={() => setImportes(p => [...p, { moneda: 'EUR', monto: 0 }])}
                className="text-[11px] text-teal-700 hover:underline">+ Euros</button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {importes.map((imp, i) => (
              <div key={imp.moneda}>
                <label className="block text-[11px] font-medium text-teal-900 mb-1">
                  {imp.moneda === 'ARS' ? 'Pesos (ARS)' : imp.moneda === 'USD' ? 'Dólares (USD)' : 'Euros (EUR)'}
                  {imp.moneda === 'EUR' && (
                    <button onClick={() => setImportes(p => p.filter((_, j) => j !== i))}
                      className="ml-2 text-red-400 hover:text-red-600">quitar</button>
                  )}
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-mono text-teal-700 w-9 shrink-0">{MONEDA_SIMBOLO[imp.moneda] || imp.moneda}</span>
                  <input type="number" step="0.01" min={0} value={imp.monto || ''}
                    onChange={e => setImporte(i, { monto: Number(e.target.value) || 0 })}
                    placeholder="0,00"
                    className="w-full border border-teal-300 bg-white rounded-lg px-3 py-2 text-base text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-teal-800/70 mt-2">
            Se genera una solicitud de facturación por cada moneda con monto. Si no se informa
            ningún importe, se factura según el presupuesto de las OTs que certifica.
          </p>
        </div>

        {/* El caso normal: un documento por el conjunto de servicios. Si el
            cliente manda uno por planta, se eligen las de esa planta. */}
        {pendientes.length > 0 && (
          <div className="bg-teal-50/60 border border-teal-200 rounded-lg px-3 py-2">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[11px] font-medium text-teal-900">
                Este documento certifica {elegidas.size} de {pendientes.length} OT{pendientes.length !== 1 ? 's' : ''} pendientes
              </span>
              <button type="button" className="text-[10px] text-teal-700 hover:underline"
                onClick={() => setElegidas(elegidas.size === pendientes.length ? new Set() : new Set(pendientes.map(p => p.otNumber)))}>
                {elegidas.size === pendientes.length ? 'Ninguna' : 'Todas'}
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-0.5">
              {pendientes.map(p => (
                <label key={p.otNumber} className="flex items-center gap-2 text-[11px] text-teal-900 cursor-pointer">
                  <input type="checkbox" checked={elegidas.has(p.otNumber)}
                    onChange={() => setElegidas(prev => { const n = new Set(prev); n.has(p.otNumber) ? n.delete(p.otNumber) : n.add(p.otNumber); return n; })}
                    className="w-3.5 h-3.5 accent-teal-600 shrink-0" />
                  <span className="font-mono font-semibold shrink-0">{p.otNumber}</span>
                  <span className="text-teal-800/80 truncate">{[p.establecimientoNombre, p.equipo].filter(Boolean).join(' · ')}</span>
                </label>
              ))}
            </div>
            <p className="text-[10px] text-teal-700/80 mt-1">
              Las elegidas se liberan a facturación. Las que no, siguen esperando otro documento
              o se objetan desde la lista.
            </p>
          </div>
        )}

        <div>
          <label className={lbl}>Archivos de la certificación <span className="normal-case tracking-normal text-slate-400">(uno o varios)</span></label>
          <input type="file" accept="application/pdf,image/*" multiple
            onChange={e => setArchivos(prev => [...prev, ...Array.from(e.target.files ?? [])])}
            className="text-[11px] text-slate-600 file:mr-2 file:px-2 file:py-1 file:text-[11px] file:rounded file:border file:border-slate-300 file:bg-white" />
          {archivos.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {archivos.map((a, i) => (
                <li key={`${a.name}-${i}`} className="text-[10px] text-teal-700 flex items-center gap-2">
                  <span className="truncate">{a.name}</span>
                  <button type="button" onClick={() => setArchivos(prev => prev.filter((_, j) => j !== i))}
                    className="text-red-400 hover:text-red-600">×</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label className={lbl}>Observaciones</label>
          <input value={observaciones} onChange={e => setObservaciones(e.target.value)}
            placeholder="Opcional" className={inp} />
        </div>
      </div>
    </Modal>
  );
}
