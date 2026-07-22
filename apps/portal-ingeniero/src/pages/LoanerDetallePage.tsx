import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { loanersPortalService, prestamoActivo, ultimoPrestamoDevuelto } from '../services/loanersPortalService';
import type { Loaner } from '@ags/shared';
import { ESTADO_LOANER_LABELS, ESTADO_LOANER_COLORS } from '@ags/shared';

function formatDate(d?: string | null): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-mono shrink-0">{label}</p>
      <p className="text-xs text-slate-700 text-right truncate">{value}</p>
    </div>
  );
}

/**
 * Detalle mobile de un loaner. Acciones solo con préstamo activo:
 * agregar fotos de salida / registrar retorno. 'en_recalificacion' es
 * informativo (la OT la coordina administración desde el back-office).
 */
export default function LoanerDetallePage() {
  const { loanerId } = useParams<{ loanerId: string }>();
  const navigate = useNavigate();
  const [loaner, setLoaner] = useState<Loaner | null | undefined>(undefined);

  useEffect(() => {
    if (!loanerId) return;
    return loanersPortalService.subscribeById(loanerId, setLoaner);
  }, [loanerId]);

  if (loaner === undefined) {
    return <div className="min-h-[40vh] flex items-center justify-center"><Spinner /></div>;
  }
  if (loaner === null) {
    return (
      <div className="max-w-md mx-auto px-4 py-8 text-center space-y-3">
        <p className="text-sm text-slate-700">Loaner no encontrado</p>
        <Button variant="outline" onClick={() => navigate('/loaners')} className="w-full">Volver</Button>
      </div>
    );
  }

  const prestamo = prestamoActivo(loaner);
  const devuelto = ultimoPrestamoDevuelto(loaner);
  const fotosSalida = (loaner.fotos ?? []).filter(
    f => f.contexto === 'prestamo' && f.prestamoId === prestamo?.id,
  ).length;

  return (
    <div className="max-w-md mx-auto px-4 py-4 space-y-3">
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 font-mono">Loaner</p>
          <h1 className="text-lg font-semibold text-slate-800 font-mono">{loaner.codigo}</h1>
          <p className="text-xs text-slate-500">{loaner.descripcion}</p>
        </div>
        <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_LOANER_COLORS[loaner.estado]}`}>
          {ESTADO_LOANER_LABELS[loaner.estado]}
        </span>
      </header>

      <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 divide-y divide-slate-100">
        <InfoRow label="Categoría" value={loaner.categoriaModuloNombre || loaner.categoriaEquipo} />
        <InfoRow label="Modelo" value={loaner.moduloCodigo} />
        <InfoRow label="Serie" value={loaner.serie} />
        <InfoRow label="Condición" value={loaner.condicion} />
      </div>

      {prestamo && (
        <div className="bg-white border border-slate-200 rounded-xl px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-400 font-mono mb-1">Préstamo activo</p>
          <p className="text-sm font-medium text-slate-800">{prestamo.clienteNombre}</p>
          {prestamo.establecimientoNombre && (
            <p className="text-xs text-slate-500">{prestamo.establecimientoNombre}</p>
          )}
          <p className="text-xs text-slate-500 mt-1">
            Salida {formatDate(prestamo.fechaSalida)}
            {prestamo.fechaRetornoPrevista ? ` · retorno previsto ${formatDate(prestamo.fechaRetornoPrevista)}` : ''}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">
            {fotosSalida} foto{fotosSalida === 1 ? '' : 's'} de salida
          </p>
        </div>
      )}

      {loaner.estado === 'en_cliente' && prestamo && (
        <div className="space-y-2">
          <Button size="lg" className="w-full" onClick={() => navigate(`/loaners/${loaner.id}/fotos`)}>
            Agregar fotos de salida
          </Button>
          <Button size="lg" variant="secondary" className="w-full" onClick={() => navigate(`/loaners/${loaner.id}/retorno`)}>
            Registrar retorno
          </Button>
        </div>
      )}

      {loaner.estado === 'en_recalificacion' && (
        <div className="rounded-xl bg-purple-50 border border-purple-200 px-3 py-3">
          <p className="text-xs font-semibold text-purple-800">Pendiente de recalificación</p>
          <p className="text-[11px] text-purple-700 mt-1">
            {devuelto?.clienteNombre ? `Devuelto por ${devuelto.clienteNombre}. ` : ''}
            La OT de recalificación la coordina administración; el módulo vuelve a estar
            disponible cuando cierre técnicamente.
            {devuelto?.otRecalificacionNumber && devuelto.otRecalificacionNumber !== 'PENDIENTE'
              ? ` OT ${devuelto.otRecalificacionNumber}.`
              : ''}
          </p>
        </div>
      )}

      <Button variant="outline" className="w-full" onClick={() => navigate('/loaners')}>
        Volver a Loaners
      </Button>
    </div>
  );
}
