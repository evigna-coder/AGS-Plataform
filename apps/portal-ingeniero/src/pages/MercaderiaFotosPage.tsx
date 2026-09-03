import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { CapturaFotosMercaderia } from '../components/mercaderia/CapturaFotosMercaderia';
import { usePendingForDestino } from '../hooks/useUploadQueue';
import { mercaderiaFotosService, type DestinoFotos, type DocumentoConFotos } from '../services/mercaderiaFotosService';

const TITULO: Record<DestinoFotos, string> = {
  importacion: 'Cómo llegó la mercadería',
  remito: 'Cómo sale hacia el cliente',
};

/**
 * Tanda de fotos de un documento (2026-09-03).
 *
 * La tanda queda ABIERTA y admite más fotos —hoy, mañana, cuando aparezca el
 * bulto que faltaba— hasta que alguien la cierra. Cerrada significa "esto es
 * todo lo que se documentó", y se puede cerrar incompleta: es lo que pasa en la
 * práctica. Se puede reabrir.
 */
export default function MercaderiaFotosPage() {
  const { destino, docId } = useParams<{ destino: DestinoFotos; docId: string }>();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<DocumentoConFotos | null | undefined>(undefined);
  const [guardando, setGuardando] = useState(false);
  const pendientes = usePendingForDestino(docId ?? '');

  useEffect(() => {
    if (!destino || !docId) return;
    return mercaderiaFotosService.subscribeById(destino, docId, setDoc);
  }, [destino, docId]);

  if (doc === undefined) {
    return <div className="min-h-[40vh] flex items-center justify-center"><Spinner /></div>;
  }
  if (!doc || !destino || !docId) {
    return (
      <div className="max-w-md mx-auto px-4 py-8 text-center space-y-3">
        <p className="text-sm text-slate-700">No se encontró el documento</p>
        <Button variant="outline" onClick={() => navigate('/mercaderia')} className="w-full">
          Volver a Mercadería
        </Button>
      </div>
    );
  }

  const cerrada = !!doc.cerradaAt;
  const enCola = pendientes.length;

  const alternarCierre = async () => {
    setGuardando(true);
    try {
      await mercaderiaFotosService.cerrarTanda(destino, docId, !cerrada);
    } catch (err) {
      console.error('[mercaderia] cerrar tanda:', err);
      alert('No se pudo actualizar la tanda.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-4 space-y-3">
      <header>
        <p className="text-xs uppercase tracking-wide text-slate-500 font-mono">
          {destino === 'importacion' ? 'Recepción' : 'Entrega'}
        </p>
        <h1 className="text-base font-semibold text-slate-800 mt-0.5 font-mono">{doc.numero}</h1>
        <p className="text-xs text-slate-600">{doc.subtitulo}</p>
      </header>

      {cerrada && (
        <p className="text-[11px] text-slate-600 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2">
          Tanda cerrada. Para sumar fotos, reabrila abajo.
        </p>
      )}

      <CapturaFotosMercaderia
        destino={destino}
        destinoId={docId}
        destinoEtiqueta={doc.numero}
        fotosConfirmadas={doc.fotos}
        titulo={TITULO[destino]}
        cerrada={cerrada}
      />

      {enCola > 0 && (
        <p className="text-[11px] text-amber-700">
          {enCola} foto{enCola === 1 ? '' : 's'} se subirá{enCola === 1 ? '' : 'n'} automáticamente
          cuando haya señal — podés salir de esta pantalla.
        </p>
      )}

      <Button
        variant="outline"
        className="w-full"
        disabled={guardando || enCola > 0}
        onClick={() => void alternarCierre()}
        title={enCola > 0 ? 'Esperá a que suban las fotos en cola' : undefined}
      >
        {cerrada ? 'Reabrir tanda' : 'Cerrar tanda'}
      </Button>
      {enCola > 0 && !cerrada && (
        <p className="text-[10px] text-slate-400 text-center -mt-1">
          No se puede cerrar con fotos sin subir.
        </p>
      )}

      <Button size="lg" className="w-full" onClick={() => navigate('/mercaderia')}>
        Listo
      </Button>
    </div>
  );
}
