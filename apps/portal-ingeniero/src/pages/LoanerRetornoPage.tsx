import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { CapturaFotosLoaner } from '../components/loaners/CapturaFotosLoaner';
import { usePendingForLoaner } from '../hooks/useUploadQueue';
import { loanersPortalService, prestamoActivo } from '../services/loanersPortalService';
import type { Loaner } from '@ags/shared';

/**
 * Registrar el retorno de un loaner desde el portal: fotos del estado al
 * volver (contexto 'devolucion') + condición de retorno + confirmación.
 * Las fotos van a la cola offline: la devolución se puede registrar aunque
 * queden fotos pendientes — la cola las sube después con su prestamoId.
 * El loaner queda 'en_recalificacion'; la OT de recalificación y el ticket
 * los crea el back-office automáticamente (sweep) — el portal NO los crea.
 */
export default function LoanerRetornoPage() {
  const { loanerId } = useParams<{ loanerId: string }>();
  const navigate = useNavigate();
  const [loaner, setLoaner] = useState<Loaner | null | undefined>(undefined);
  const [condicion, setCondicion] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const pendientes = usePendingForLoaner(loanerId ?? '');
  const enCola = pendientes.filter(p => p.contexto === 'devolucion').length;

  useEffect(() => {
    if (!loanerId) return;
    return loanersPortalService.subscribeById(loanerId, setLoaner);
  }, [loanerId]);

  if (loaner === undefined) {
    return <div className="min-h-[40vh] flex items-center justify-center"><Spinner /></div>;
  }

  const prestamo = loaner ? prestamoActivo(loaner) : undefined;

  if (done && loaner) {
    return (
      <div className="max-w-md mx-auto px-4 py-8 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Devolución registrada</h2>
          <p className="text-sm text-purple-700 font-medium mt-1">
            {loaner.codigo} pendiente de recalificación
          </p>
          {enCola > 0 && (
            <p className="text-xs text-amber-700 mt-2">
              {enCola} foto{enCola === 1 ? '' : 's'} se subirá{enCola === 1 ? '' : 'n'} automáticamente
              cuando haya señal — no hace falta esperar acá.
            </p>
          )}
          <p className="text-xs text-slate-500 mt-2">
            Administración va a coordinar la OT de recalificación. El módulo vuelve a estar
            disponible cuando esa OT cierre técnicamente.
          </p>
        </div>
        <Button size="lg" className="w-full" onClick={() => navigate('/loaners')}>
          Volver a Loaners
        </Button>
      </div>
    );
  }

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

  const fotosConfirmadas = (loaner.fotos ?? []).filter(
    f => f.contexto === 'devolucion' && f.prestamoId === prestamo.id,
  );
  const puedeRegistrar = condicion.trim().length > 0 && confirmado && !saving;

  const handleRegistrar = async () => {
    if (!puedeRegistrar) return;
    setSaving(true);
    setError(null);
    try {
      await loanersPortalService.registrarDevolucion(loaner.id, prestamo.id, {
        fechaRetornoReal: new Date().toISOString(),
        condicionRetorno: condicion.trim(),
        requiereRecalificacion: true,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la devolución');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-4 space-y-4 pb-8">
      <header>
        <p className="text-xs uppercase tracking-wide text-slate-500 font-mono">Registrar retorno</p>
        <h1 className="text-base font-semibold text-slate-800 mt-0.5">
          {loaner.codigo} · {prestamo.clienteNombre}
        </h1>
        <p className="text-xs text-slate-500">{loaner.descripcion}</p>
      </header>

      <CapturaFotosLoaner
        loanerId={loaner.id}
        loanerCodigo={loaner.codigo}
        contexto="devolucion"
        prestamoId={prestamo.id}
        fotosConfirmadas={fotosConfirmadas}
        titulo="Estado del módulo al volver"
      />

      <div>
        <label className="block text-[10px] uppercase tracking-wide text-slate-500 font-mono mb-1">
          Condición de retorno *
        </label>
        <textarea
          value={condicion}
          onChange={e => setCondicion(e.target.value)}
          rows={3}
          placeholder="Estado en el que vuelve el módulo, faltantes, observaciones…"
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      <label className="flex items-start gap-2 rounded-xl bg-purple-50 border border-purple-200 px-3 py-3 cursor-pointer">
        <input
          type="checkbox"
          checked={confirmado}
          onChange={e => setConfirmado(e.target.checked)}
          className="mt-0.5 rounded border-purple-300"
        />
        <span className="text-xs text-purple-800">
          Entiendo que el módulo queda <strong>pendiente de recalificación</strong> y no vuelve
          a estar disponible hasta que la OT de recalificación cierre.
        </span>
      </label>

      {enCola > 0 && (
        <p className="text-[11px] text-amber-700">
          {enCola} foto{enCola === 1 ? '' : 's'} se subirá{enCola === 1 ? '' : 'n'} cuando haya
          señal. Podés registrar la devolución igual — quedan asociadas al préstamo.
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}

      <Button size="lg" className="w-full" disabled={!puedeRegistrar} onClick={() => void handleRegistrar()}>
        {saving ? 'Registrando…' : 'Registrar devolución'}
      </Button>
      <Button variant="outline" className="w-full" onClick={() => navigate(`/loaners/${loaner.id}`)}>
        Cancelar
      </Button>
    </div>
  );
}
