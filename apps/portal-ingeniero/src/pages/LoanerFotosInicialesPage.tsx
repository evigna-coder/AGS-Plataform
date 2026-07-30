import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { CapturaFotosLoaner } from '../components/loaners/CapturaFotosLoaner';
import { usePendingForLoaner } from '../hooks/useUploadQueue';
import { loanersPortalService } from '../services/loanersPortalService';
import type { Loaner } from '@ags/shared';

/**
 * Fotos INICIALES del loaner (contexto 'general'): el estado base del módulo,
 * independiente de préstamos. Pedido 2026-07-29: todos los módulos del catálogo
 * deben tener sus fotos iniciales; las de movimientos (salida/retorno) son
 * opcionales. Disponible en cualquier estado del loaner.
 */
export default function LoanerFotosInicialesPage() {
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
  if (!loaner) {
    return (
      <div className="max-w-md mx-auto px-4 py-8 text-center space-y-3">
        <p className="text-sm text-slate-700">Loaner no encontrado</p>
        <Button variant="outline" onClick={() => navigate('/loaners')} className="w-full">
          Volver a Loaners
        </Button>
      </div>
    );
  }

  const fotosPrevias = (loaner.fotos ?? []).filter(f => f.contexto === 'general');
  const enCola = pendientes.filter(p => p.contexto === 'general').length;

  return (
    <div className="max-w-md mx-auto px-4 py-4 space-y-3">
      <header>
        <p className="text-xs uppercase tracking-wide text-slate-500 font-mono">Fotos iniciales</p>
        <h1 className="text-base font-semibold text-slate-800 mt-0.5 font-mono">{loaner.codigo}</h1>
        <p className="text-xs text-slate-500">{loaner.descripcion}</p>
      </header>

      <CapturaFotosLoaner
        loanerId={loaner.id}
        loanerCodigo={loaner.codigo}
        contexto="general"
        prestamoId={null}
        fotosConfirmadas={fotosPrevias}
        titulo="Estado base del módulo"
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
