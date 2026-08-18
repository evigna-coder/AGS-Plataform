import { useEffect, useState } from 'react';
import type { ImporteCertificado, MonedaPresupuesto } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { certificacionesService } from '../../services/certificacionesService';

const MONEDAS: MonedaPresupuesto[] = ['ARS', 'USD', 'EUR'];
const lbl = 'text-[10px] font-mono uppercase tracking-wide text-slate-500 mb-1 block';
const inp = 'w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs';

interface Props {
  open: boolean;
  onClose: () => void;
  onAgregada: () => void;
  loteId: string;
  clienteNombre: string;
  periodo?: string | null;
  /** Cuántas OTs del lote siguen pendientes — se certifican todas de una. */
  pendientes: number;
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
  const [importes, setImportes] = useState<ImporteCertificado[]>([{ moneda: 'ARS', monto: 0 }]);
  const [observaciones, setObservaciones] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  /** Por defecto certifica todo el lote: el cliente manda UN papel por el conjunto. */
  const [certificarTodas, setCertificarTodas] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNumero(''); setFecha(new Date().toISOString().slice(0, 10));
    setImportes([{ moneda: 'ARS', monto: 0 }]);
    setObservaciones(''); setArchivo(null); setCertificarTodas(true);
  }, [open]);

  const setImporte = (i: number, patch: Partial<ImporteCertificado>) =>
    setImportes(prev => prev.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const conMonto = importes.filter(i => Number.isFinite(i.monto) && i.monto !== 0);

  const handleSubmit = async () => {
    if (guardando) return;
    if (conMonto.length === 0) { alert('Cargá al menos un importe certificado'); return; }
    setGuardando(true);
    try {
      await certificacionesService.agregarRecibida(loteId, {
        numero: numero.trim() || null,
        fecha,
        importes: conMonto,
        observaciones: observaciones.trim() || null,
        archivo,
        certificarPendientes: certificarTodas,
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
          <div>
            <label className={lbl}>N° de certificación</label>
            <input value={numero} onChange={e => setNumero(e.target.value)}
              placeholder="El que puso el cliente" className={`${inp} font-mono`} />
          </div>
          <div>
            <label className={lbl}>Fecha del documento</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inp} />
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-1">
            <span className={lbl}>Importes certificados</span>
            <button onClick={() => setImportes(p => [...p, { moneda: 'USD', monto: 0 }])}
              className="text-[11px] text-teal-600 hover:underline">+ Otra moneda</button>
          </div>
          {/* Multi-moneda: un mismo documento puede certificar pesos y dólares
              por separado, y así se factura. */}
          <div className="space-y-1.5">
            {importes.map((imp, i) => (
              <div key={i} className="flex items-center gap-2">
                <select value={imp.moneda} className={`${inp} w-24`}
                  onChange={e => setImporte(i, { moneda: e.target.value as MonedaPresupuesto })}>
                  {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <input type="number" step="0.01" min={0} value={imp.monto || ''}
                  onChange={e => setImporte(i, { monto: Number(e.target.value) || 0 })}
                  placeholder="0,00" className={`${inp} flex-1 text-right tabular-nums`} />
                {importes.length > 1 && (
                  <button onClick={() => setImportes(p => p.filter((_, j) => j !== i))}
                    className="text-red-400 hover:text-red-600 text-sm px-1">×</button>
                )}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Es el monto que se va a facturar. Si el cliente certificó menos de lo presupuestado,
            va lo certificado.
          </p>
        </div>

        {/* El caso normal: un documento por el conjunto de servicios. Resolver
            OT por OT es la excepción, no la regla. */}
        {pendientes > 0 && (
          <label className="flex items-start gap-2 bg-teal-50/60 border border-teal-200 rounded-lg px-3 py-2 cursor-pointer">
            <input type="checkbox" checked={certificarTodas}
              onChange={e => setCertificarTodas(e.target.checked)}
              className="w-3.5 h-3.5 accent-teal-600 mt-0.5 shrink-0" />
            <span className="text-[11px] text-teal-900">
              Certifica las {pendientes} OT{pendientes !== 1 ? 's' : ''} pendientes del lote
              <span className="block text-[10px] text-teal-700/80 mt-0.5">
                Se liberan todas a facturación. Si el cliente objetó alguna, destildá esto o
                marcá la excepción después en la lista.
              </span>
            </span>
          </label>
        )}

        <div>
          <label className={lbl}>Archivo de la certificación</label>
          <input type="file" accept="application/pdf,image/*"
            onChange={e => setArchivo(e.target.files?.[0] ?? null)}
            className="text-[11px] text-slate-600 file:mr-2 file:px-2 file:py-1 file:text-[11px] file:rounded file:border file:border-slate-300 file:bg-white" />
          {archivo && <p className="text-[10px] text-teal-700 mt-1">{archivo.name}</p>}
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
