import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { CapturaFotosLoaner } from '../components/loaners/CapturaFotosLoaner';
import { usePendingForLoaner } from '../hooks/useUploadQueue';
import { loanersPortalService, prestamoActivo } from '../services/loanersPortalService';
import type { Loaner } from '@ags/shared';

/**
 * Fotos de salida del préstamo activo (contexto 'prestamo').
 * El egreso ya fue registrado por el back-office (con remito); acá el
 * ingeniero solo documenta el estado del módulo al salir. Las fotos van a la
 * cola offline — puede salir de la pantalla con subidas pendientes.
 */
export default function LoanerFotosSalidaPage() {
  const { loanerId } = useParams<{ loanerId: string }>();
  const navigate = useNavigate();
  const [loaner, setLoaner] = useState<Loaner | null | undefined>(undefined);
  const pendientes = usePendingForLoaner(loanerId ?? '');

  useEffect(() => {
    if (!loanerId) return;
    return loanersPortalService.subscribeById(loanerId, setLoaner);
  }, [loanerId]);

  if (loaner === undefined) {
    return <div className="min-h-[40vh] flex items-center justify-center"><Spinner /></div>;
  }

  const prestamo = loaner ? prestamoActivo(loaner) : undefined;
  if (!loaner || !prestamo) {
    return (
      <div className="max-w-md mx-auto px-4 py-8 text-center space-y-3">
        <p className="text-sm text-slate-700">
          {loaner ? 'Este loaner no tiene un préstamo activo' : 'Loaner no encontrado'}
        </p>
        <Button variant="outline" onClick={() => navigate('/loaners')} className="w-full">
          Volver a Loaners
        </Button>
      </div>
    );
  }

  const fotosPrevias = (loaner.fotos ?? []).filter(
    f => f.contexto === 'prestamo' && f.prestamoId === prestamo.id,
  );
  const enCola = pendientes.filter(
    p => p.contexto === 'prestamo' && p.prestamoId === prestamo.id,
  ).length;

  return (
    <div className="max-w-md mx-auto px-4 py-4 space-y-3">
      <header>
        <p className="text-xs uppercase tracking-wide text-slate-500 font-mono">Fotos de salida</p>
        <h1 className="text-base font-semibold text-slate-800 mt-0.5">
          {loaner.codigo} · {prestamo.clienteNombre}
        </h1>
        <p className="text-xs text-slate-500">{loaner.descripcion}</p>
      </header>

      <CapturaFotosLoaner
        loanerId={loaner.id}
        loanerCodigo={loaner.codigo}
        contexto="prestamo"
        prestamoId={prestamo.id}
        fotosConfirmadas={fotosPrevias}
        titulo="Estado del módulo al salir"
      />

      {enCola > 0 && (
        <p className="text-[11px] text-amber-700">
          {enCola} foto{enCola === 1 ? '' : 's'} se subirá{enCola === 1 ? '' : 'n'} automáticamente
          cuando haya señal — podés salir de esta pantalla.
        </p>
      )}

      <Button size="lg" className="w-full" onClick={() => navigate(`/loaners/${loaner.id}`)}>
        Listo
      </Button>
    </div>
  );
}
