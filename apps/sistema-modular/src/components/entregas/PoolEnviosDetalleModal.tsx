import { Modal } from '../ui/Modal';
import { ExportarButton } from '../ui/ExportarButton';
import { useConfirm } from '../ui/ConfirmDialog';
import type { ExportColumn } from '../../utils/exportToExcel';
import type { MovimientoPoolEnvios } from '../../utils/poolEnvios';

interface Props {
  open: boolean;
  onClose: () => void;
  ledger: MovimientoPoolEnvios[];
  onEliminarGasto: (gastoId: string) => Promise<void>;
}

const fmtUSD = (n: number) => `U$S ${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
const fmtARS = (n: number | null) => n == null ? '—' : `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
const fmtFecha = (d: string) => d ? d.split('-').reverse().join('/') : '—';
const th = 'px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';

export const POOL_ENVIOS_EXPORT_COLUMNS: ExportColumn<MovimientoPoolEnvios>[] = [
  { header: 'Fecha', width: 12, get: r => fmtFecha(r.fecha) },
  { header: 'Tipo', width: 10, get: r => (r.tipo === 'entrada' ? 'Entrada' : 'Salida') },
  { header: 'Cliente', width: 28, get: r => r.clienteNombre ?? '' },
  { header: 'Referencia', width: 34, get: r => r.referencia },
  { header: 'Pesos', width: 14, get: r => r.montoARS ?? '', align: 'right' },
  { header: 'TC', width: 10, get: r => r.tipoCambio ?? '', align: 'right' },
  { header: 'U$S', width: 12, get: r => (r.tipo === 'entrada' ? r.montoUSD : -r.montoUSD), align: 'right' },
  { header: 'Saldo U$S', width: 12, get: r => r.saldoUSD, align: 'right' },
  { header: 'Notas', width: 30, get: r => r.notas ?? '' },
];

/** Libro del pool: entradas por presupuesto aceptado y salidas por viaje, con saldo. */
export function PoolEnviosDetalleModal({ open, onClose, ledger, onEliminarGasto }: Props) {
  const confirm = useConfirm();
  const filas = [...ledger].reverse();

  const eliminar = async (m: MovimientoPoolEnvios) => {
    if (!m.id.startsWith('gasto:')) return;
    if (!await confirm(`¿Eliminar el envío del ${fmtFecha(m.fecha)} por ${fmtUSD(m.montoUSD)}? Vuelve al pool.`)) return;
    await onEliminarGasto(m.id.slice(6));
  };

  return (
    <Modal open={open} onClose={onClose} title="Detalle del pool de envíos" subtitle="Lo contemplado al cotizar entra al aceptarse; cada viaje sale al BNA vendedor del día" maxWidth="2xl"
      footer={<ExportarButton columnas={POOL_ENVIOS_EXPORT_COLUMNS} data={filas} titulo="Pool de envíos" filename="pool-envios" />}>
      {filas.length === 0 ? (
        <p className="text-xs text-slate-400 py-6 text-center">Todavía no hay movimientos. Las entradas aparecen al aceptar presupuestos con envío contemplado.</p>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto border border-slate-200 rounded-lg">
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
              <tr>
                <th className={th}>Fecha</th><th className={th}>Tipo</th><th className={th}>Cliente</th><th className={th}>Referencia</th>
                <th className={`${th} text-right`}>Pesos</th><th className={`${th} text-right`}>TC</th><th className={`${th} text-right`}>U$S</th><th className={`${th} text-right`}>Saldo</th><th className={th}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filas.map(m => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-3 py-1.5 text-[11px] text-slate-500 whitespace-nowrap">{fmtFecha(m.fecha)}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${m.tipo === 'entrada' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                      {m.tipo === 'entrada' ? 'Entrada' : 'Salida'}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-xs text-slate-700 truncate max-w-[180px]" title={m.clienteNombre ?? ''}>{m.clienteNombre ?? '—'}</td>
                  <td className="px-3 py-1.5 text-xs text-slate-600 truncate max-w-[260px]" title={`${m.referencia}${m.notas ? ` — ${m.notas}` : ''}`}>
                    {m.referencia}{m.notas && <span className="text-slate-400"> — {m.notas}</span>}
                  </td>
                  <td className="px-3 py-1.5 text-xs font-mono text-right text-slate-600 whitespace-nowrap">{fmtARS(m.montoARS)}</td>
                  <td className="px-3 py-1.5 text-xs font-mono text-right text-slate-400 whitespace-nowrap">{m.tipoCambio ?? '—'}</td>
                  <td className={`px-3 py-1.5 text-xs font-mono text-right whitespace-nowrap ${m.tipo === 'entrada' ? 'text-emerald-700' : 'text-amber-800'}`}>
                    {m.tipo === 'entrada' ? '+' : '−'}{fmtUSD(m.montoUSD)}
                  </td>
                  <td className={`px-3 py-1.5 text-xs font-mono font-semibold text-right whitespace-nowrap ${m.saldoUSD < 0 ? 'text-red-600' : 'text-slate-700'}`}>{fmtUSD(m.saldoUSD)}</td>
                  <td className="px-2 py-1.5 text-right whitespace-nowrap">
                    {m.tipo === 'salida' && (
                      <button type="button" onClick={() => void eliminar(m)} className="text-[10px] font-medium text-red-500 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50">Eliminar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
