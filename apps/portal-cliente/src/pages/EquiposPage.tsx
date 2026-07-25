import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Boxes } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useEquipos, useEquipoDetalle } from '@/data/equipos';
import { EquipoList } from '@/components/equipos/EquipoList';
import { EquipoDetail } from '@/components/equipos/EquipoDetail';

function EmptyDetail() {
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line bg-surface/50 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-muted">
        <Boxes className="h-6 w-6 text-ink-faint" />
      </div>
      <p className="max-w-xs text-sm text-ink-soft">
        Elegí un equipo de la lista para ver su ficha, historial e informes.
      </p>
    </div>
  );
}

export function EquiposPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { equipos, loading } = useEquipos();
  const { equipo } = useEquipoDetalle(id);
  const hasSelection = Boolean(id);

  return (
    <div>
      {hasSelection && (
        <button
          onClick={() => navigate('/equipos')}
          className="mb-4 flex items-center gap-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink lg:hidden"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a mis equipos
        </button>
      )}

      <div className={cn('mb-5', hasSelection && 'hidden lg:block')}>
        <h1 className="font-display text-[26px] font-semibold text-ink">Mis equipos</h1>
        <p className="text-sm text-ink-soft">
          {equipos.length} equipos · elegí uno para ver su ficha e historial
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[380px_1fr] lg:items-start">
        <div className={cn(hasSelection && 'hidden lg:block')}>
          {loading ? (
            <div className="flex h-40 items-center justify-center text-ink-faint">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <EquipoList equipos={equipos} selectedId={id} />
          )}
        </div>

        <div className={cn(!hasSelection && 'hidden lg:block')}>
          {equipo ? <EquipoDetail equipo={equipo} /> : <EmptyDetail />}
        </div>
      </div>
    </div>
  );
}
