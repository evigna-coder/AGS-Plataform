import { useEffect, useState } from 'react';
import type { WorkOrder } from '@ags/shared';
import { puedeReabrirOT, solicitudesVivasDeOT, TEXTO_AVISO_REAPERTURA_TECNICA, type NivelReapertura, type SolicitudVivaOT } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ordenesTrabajoService } from '../../services/firebaseService';
import { db } from '../../services/firebase';
import { notify } from '../../utils/notify';

interface Props {
  open: boolean;
  otNumber: string;
  onClose: () => void;
  /** Reabierta: el caller refresca la OT. */
  onReabierta: () => void;
  /** Nivel inicial: desde el cierre admin conviene 'administrativa'; desde cierre técnico, 'tecnica'. */
  nivelInicial?: NivelReapertura;
}

/**
 * Reabrir una OT cerrada (2026-09-10). Diseño en .claude/plans/reapertura-ot.md.
 * Muestra ANTES de confirmar qué se mantiene (stock descontado, aviso de
 * facturación) y qué pasa con el reporte; pide motivo obligatorio.
 */
export const ReabrirOTModal: React.FC<Props> = ({ open, otNumber, onClose, onReabierta, nivelInicial = 'administrativa' }) => {
  const [ot, setOt] = useState<WorkOrder | null>(null);
  const [solicitudes, setSolicitudes] = useState<SolicitudVivaOT[]>([]);
  const [nivel, setNivel] = useState<NivelReapertura>(nivelInicial);
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNivel(nivelInicial); setMotivo(''); setLoading(true);
    Promise.all([ordenesTrabajoService.getByOtNumber(otNumber), solicitudesVivasDeOT(db, otNumber)])
      .then(([o, s]) => { setOt(o); setSolicitudes(s); })
      .catch(err => { console.error('[ReabrirOTModal] carga:', err); notify.error('No se pudo cargar la OT'); })
      .finally(() => setLoading(false));
  }, [open, otNumber, nivelInicial]);

  const chequeoAdmin = ot ? puedeReabrirOT(ot, 'administrativa') : { ok: false };
  const chequeoTec = ot ? puedeReabrirOT(ot, 'tecnica') : { ok: false };
  const chequeo = nivel === 'tecnica' ? chequeoTec : chequeoAdmin;
  const stockDeducido = !!ot?.cierreAdmin?.stockDeducido;
  const facturada = solicitudes.find(s => s.estado === 'facturada' || s.estado === 'cobrada');
  const enAviso = solicitudes[0];

  const handleConfirm = async () => {
    if (!motivo.trim()) { notify.warning('Escribí el motivo de la reapertura'); return; }
    setSaving(true);
    try {
      await ordenesTrabajoService.reabrir(otNumber, { nivel, motivo });
      notify.success(nivel === 'tecnica' ? `OT ${otNumber} reabierta: el reporte vuelve a estar editable` : `OT ${otNumber} reabierta a cierre técnico`);
      onReabierta();
      onClose();
    } catch (err) {
      console.error('[ReabrirOTModal] reabrir falló:', err);
      notify.error(err instanceof Error ? err.message : 'No se pudo reabrir la OT');
    } finally {
      setSaving(false);
    }
  };

  const opcion = (valor: NivelReapertura, titulo: string, detalle: string, habilitada: boolean) => (
    <label className={`flex items-start gap-2 border rounded-lg px-3 py-2 ${habilitada ? 'cursor-pointer' : 'opacity-50'} ${nivel === valor ? 'border-teal-500 bg-teal-50' : 'border-slate-200'}`}>
      <input type="radio" className="mt-0.5 accent-teal-600" checked={nivel === valor} disabled={!habilitada} onChange={() => setNivel(valor)} />
      <span>
        <span className="block text-xs font-medium text-slate-800">{titulo}</span>
        <span className="block text-[11px] text-slate-500">{detalle}</span>
      </span>
    </label>
  );

  return (
    <Modal open={open} onClose={onClose} maxWidth="md" title={`Reabrir OT ${otNumber}`}
      subtitle="Nada se borra: lo ya hecho queda marcado y al re-cerrar solo se aplica lo nuevo"
      footer={<>
        <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button size="sm" onClick={handleConfirm} disabled={saving || loading || !chequeo.ok || !motivo.trim()}
          className="bg-amber-600 hover:bg-amber-700 text-white">
          {saving ? 'Reabriendo...' : 'Reabrir OT'}
        </Button>
      </>}>
      {loading || !ot ? (
        <p className="text-xs text-slate-400 py-6 text-center">Cargando...</p>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            {opcion('administrativa', 'Corregir el cierre administrativo',
              'Vuelve a Cierre Técnico. Horas, materiales y documentos anexados; el reporte del técnico no se toca.', chequeoAdmin.ok)}
            {opcion('tecnica', 'Corregir el reporte técnico',
              'Vuelve a En Curso y el reporte queda editable en la app de campo. El técnico lo re-finaliza y después se re-cierra.', chequeoTec.ok)}
          </div>
          {!chequeo.ok && chequeo.motivo && <p className="text-[11px] text-red-600">{chequeo.motivo}</p>}

          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 space-y-1 text-[11px] text-slate-600">
            <p><span className="font-medium text-slate-700">Stock:</span> {stockDeducido ? 'ya descontado en el cierre anterior — se mantiene; al re-cerrar solo se descuenta lo nuevo.' : 'sin descuento previo.'}</p>
            <p><span className="font-medium text-slate-700">Facturación:</span> {enAviso
              ? `ya está en el aviso ${enAviso.numero ?? ''} (${enAviso.estado}) — no se toca; al re-cerrar no se vuelve a ofrecer. Para refacturar, anulá la solicitud desde Facturación.`
              : 'sin aviso emitido — la OT deja de estar lista para facturar hasta que se re-cierre.'}</p>
            {facturada && <p className="text-red-700 font-medium">Esta OT ya está facturada{facturada.estado === 'cobrada' ? ' y cobrada' : ''}.</p>}
            {nivel === 'tecnica' && (
              <p className="text-amber-800"><span className="font-medium">Reporte:</span> {TEXTO_AVISO_REAPERTURA_TECNICA} El PDF anterior se resguarda y se avisa al ingeniero con un ticket.</p>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Motivo *</label>
            <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3}
              placeholder="Qué hay que corregir y por qué"
              className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
        </div>
      )}
    </Modal>
  );
};
