import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { remitosService, type RemitoServicioLinea } from '../../services/stockService';
import { openRemitoPdfInNewTab } from '../../utils/remitoPdfActions';
import { RemitoOverlayPDF } from './pdf/RemitoOverlayPDF';
import {
  useRemitoServicio,
  buildOverlayItems,
  type RemitoServicioPrefill,
} from '../../hooks/useRemitoServicio';

const lbl = 'text-[10px] font-mono uppercase tracking-wide text-slate-500 mb-0.5 block';
const inp = 'w-full border rounded-lg px-2.5 py-1 text-xs bg-white border-slate-300';

/** dd/mm/yyyy desde un yyyy-mm-dd (el formato que espera el overlay). */
function formatFecha(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  prefill: RemitoServicioPrefill;
}

/**
 * Remito de SERVICIO impreso sobre el papel preimpreso R. Se arma por equipo:
 * consolida los servicios de N OTs del mismo equipo en un solo remito (una OT ≈
 * un servicio). Sirve para contrato y per-incident. No toca stock.
 */
export const RemitoServicioModal: React.FC<Props> = ({ open, onClose, onCreated, prefill }) => {
  const s = useRemitoServicio({ open, prefill });
  const D = (field: keyof typeof s.destinatario) => (e: React.ChangeEvent<HTMLInputElement>) =>
    s.setDestinatario({ ...s.destinatario, [field]: e.target.value });

  const equipoLabel = prefill.sistemaCodigoInterno
    ? `${prefill.sistemaNombre ?? ''} (${prefill.sistemaCodigoInterno})`.trim()
    : prefill.sistemaNombre ?? 'Sin equipo';

  const handleSubmit = async () => {
    if (!s.canSubmit || s.submitting) return;
    s.setSubmitting(true);
    s.setError(null);
    try {
      const lineas: RemitoServicioLinea[] = s.seleccionadas.map(l => ({
        servicioDescripcion: l.servicioDescripcion.trim(),
        otNumberOrigen: l.otNumberOrigen,
        presupuestoNumero: l.presupuestoNumero.trim() || null,
        ocNumero: l.ocNumero.trim() || null,
      }));
      await remitosService.createRemitoServicio({
        numero: s.numero.trim(),
        fecha: s.fecha,
        destinatario: s.destinatario,
        clienteId: prefill.clienteId ?? null,
        clienteNombre: s.cliente?.razonSocial ?? prefill.clienteNombre ?? null,
        sistemaId: prefill.sistemaId ?? null,
        sistemaNombre: prefill.sistemaNombre ?? null,
        sistemaCodigoInterno: prefill.sistemaCodigoInterno ?? null,
        ordenClienteNumero: s.ordenClienteNumero.trim() || null,
        datoInternoCliente: s.datoInternoCliente.trim() || null,
        lineas,
        observaciones: s.observaciones.trim() || null,
      });
      const items = buildOverlayItems({
        sistemaCodigoInterno: prefill.sistemaCodigoInterno,
        sistemaNombre: prefill.sistemaNombre,
        ordenClienteNumero: s.ordenClienteNumero,
        datoInternoCliente: s.datoInternoCliente,
        lineas,
      });
      await openRemitoPdfInNewTab(
        <RemitoOverlayPDF fecha={formatFecha(s.fecha)} destinatario={s.destinatario} items={items} />,
      );
      onCreated();
    } catch (e) {
      s.setError(e instanceof Error ? e.message : 'No se pudo generar el remito');
    } finally {
      s.setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Remito de servicio"
      subtitle={equipoLabel}
      maxWidth="xl"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} disabled={!s.canSubmit || s.submitting}>
            {s.submitting ? 'Generando...' : 'Generar e imprimir'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Número preimpreso + fecha */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={lbl}>N° preimpreso</span>
            <input value={s.numero} onChange={e => s.setNumero(e.target.value)} placeholder="0001-00000000"
              className={`${inp} font-mono ${s.numero && !s.numeroValido ? 'border-red-400' : ''}`} />
            {s.numero && !s.numeroValido && <p className="text-[10px] text-red-500 mt-0.5">Formato 0001-00000000</p>}
          </div>
          <div>
            <span className={lbl}>Fecha</span>
            <input type="date" value={s.fecha} onChange={e => s.setFecha(e.target.value)} className={inp} />
          </div>
        </div>

        {/* Destinatario */}
        <div>
          <p className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-2">Destinatario</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <span className={lbl}>Razón social</span>
              <input value={s.destinatario.razonSocial} onChange={D('razonSocial')} className={inp} />
            </div>
            <div className="col-span-2">
              <span className={lbl}>Domicilio</span>
              <input value={s.destinatario.domicilio} onChange={D('domicilio')} className={inp} />
            </div>
            <div><span className={lbl}>Localidad</span><input value={s.destinatario.localidad} onChange={D('localidad')} className={inp} /></div>
            <div><span className={lbl}>Provincia</span><input value={s.destinatario.provincia} onChange={D('provincia')} className={inp} /></div>
            <div><span className={lbl}>IVA</span><input value={s.destinatario.iva} onChange={D('iva')} className={inp} /></div>
            <div><span className={lbl}>CUIT</span><input value={s.destinatario.cuit} onChange={D('cuit')} className={`${inp} font-mono`} /></div>
          </div>
        </div>

        {/* Datos que pide el cliente */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={lbl}>N° orden del cliente</span>
            <input value={s.ordenClienteNumero} onChange={e => s.setOrdenClienteNumero(e.target.value)} className={inp} />
          </div>
          <div>
            <span className={lbl}>Dato interno del cliente</span>
            <input value={s.datoInternoCliente} onChange={e => s.setDatoInternoCliente(e.target.value)} className={inp} />
          </div>
        </div>

        {/* Servicios del equipo */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-500 tracking-wider uppercase">Servicios del equipo</p>
            <button onClick={s.addLineaManual} className="text-[11px] font-medium text-teal-600 hover:underline">+ Línea manual</button>
          </div>
          {s.lineas.length === 0 ? (
            <p className="text-[11px] text-slate-400 italic">No hay OTs de este equipo. Agregá una línea manual.</p>
          ) : (
            <div className="space-y-1.5">
              <div className="grid grid-cols-[24px_1fr_110px_110px_60px_24px] gap-1.5 px-1 text-[9px] font-mono uppercase tracking-wide text-slate-400">
                <span></span><span>Servicio</span><span>Presupuesto</span><span>OC</span><span>OT</span><span></span>
              </div>
              {s.lineas.map(l => (
                <div key={l.key} className="grid grid-cols-[24px_1fr_110px_110px_60px_24px] gap-1.5 items-center">
                  <input type="checkbox" checked={l.selected} onChange={() => s.toggleLinea(l.key)} className="w-3.5 h-3.5 justify-self-center" />
                  <input value={l.servicioDescripcion} onChange={e => s.updateLinea(l.key, { servicioDescripcion: e.target.value })}
                    placeholder="Descripción del servicio" className={inp} />
                  <input value={l.presupuestoNumero} onChange={e => s.updateLinea(l.key, { presupuestoNumero: e.target.value })}
                    placeholder="PRE-0000" className={`${inp} font-mono`} />
                  <input value={l.ocNumero} onChange={e => s.updateLinea(l.key, { ocNumero: e.target.value })}
                    placeholder="OC" className={`${inp} font-mono`} />
                  <span className="text-[10px] font-mono text-slate-500 truncate">{l.otNumberOrigen ?? '—'}</span>
                  <button onClick={() => s.removeLinea(l.key)} className="text-red-400 hover:text-red-600 text-xs justify-self-center">×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Observaciones */}
        <div>
          <span className={lbl}>Observaciones</span>
          <input value={s.observaciones} onChange={e => s.setObservaciones(e.target.value)} className={inp} />
        </div>

        {s.error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{s.error}</p>}
      </div>
    </Modal>
  );
};
