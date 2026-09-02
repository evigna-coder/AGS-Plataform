import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { CapturaFotosUnidad } from '../components/mercaderia/CapturaFotosUnidad';
import { usePendingForUnidad } from '../hooks/useUploadQueue';
import { unidadesFotosService, etiquetaUnidad } from '../services/unidadesFotosService';
import type { MomentoFotoUnidad, UnidadStock } from '@ags/shared';

const MOMENTOS: { valor: MomentoFotoUnidad; label: string; titulo: string }[] = [
  { valor: 'recepcion', label: 'Recepcion', titulo: 'Como llego la mercaderia' },
  { valor: 'entrega', label: 'Entrega', titulo: 'Como sale hacia el cliente' },
];

/**
 * Fotos de una unidad de stock (2026-09-02). La captura es la misma para los
 * dos momentos; lo unico que cambia es con que `momento` se guardan, que es lo
 * que despues separa "como llego" de "como salio" en la galeria del sistema.
 *
 * Arranca en recepcion, que es el caso del pedido. Entrega queda a mano para
 * las ventas de equipos, donde tambien se fotografia antes de despachar.
 */
export default function MercaderiaFotosPage() {
  const { unidadId } = useParams<{ unidadId: string }>();
  const navigate = useNavigate();
  const [unidad, setUnidad] = useState<UnidadStock | null | undefined>(undefined);
  const [momento, setMomento] = useState<MomentoFotoUnidad>('recepcion');
  const pendientes = usePendingForUnidad(unidadId ?? '');

  useEffect(() => {
    if (!unidadId) return;
    return unidadesFotosService.subscribeById(unidadId, setUnidad);
  }, [unidadId]);

  if (unidad === undefined) {
    return <div className="min-h-[40vh] flex items-center justify-center"><Spinner /></div>;
  }
  if (!unidad) {
    return (
      <div className="max-w-md mx-auto px-4 py-8 text-center space-y-3">
        <p className="text-sm text-slate-700">Unidad no encontrada</p>
        <Button variant="outline" onClick={() => navigate('/mercaderia')} className="w-full">
          Volver a Mercaderia
        </Button>
      </div>
    );
  }

  const fotosDelMomento = (unidad.fotos ?? []).filter(f => f.momento === momento);
  const enCola = pendientes.filter(p => p.momento === momento).length;
  const activo = MOMENTOS.find(m => m.valor === momento)!;
  const origen = unidad.importacionNumero
    ? `${unidad.importacionNumero}${unidad.ordenCompraNumero ? ` · OC ${unidad.ordenCompraNumero}` : ''}`
    : unidad.ordenCompraNumero ? `OC ${unidad.ordenCompraNumero}` : null;

  return (
    <div className="max-w-md mx-auto px-4 py-4 space-y-3">
      <header>
        <p className="text-xs uppercase tracking-wide text-slate-500 font-mono">Mercaderia</p>
        <h1 className="text-base font-semibold text-slate-800 mt-0.5 font-mono">
          {unidad.articuloCodigo}
        </h1>
        <p className="text-xs text-slate-600">{unidad.articuloDescripcion}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {etiquetaUnidad(unidad)}{origen ? ` · ${origen}` : ''}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-1 bg-slate-100 rounded-xl p-1">
        {MOMENTOS.map(m => {
          const cantidad = (unidad.fotos ?? []).filter(f => f.momento === m.valor).length;
          return (
            <button
              key={m.valor}
              onClick={() => setMomento(m.valor)}
              className={`rounded-lg py-2 text-xs font-medium transition-colors ${
                momento === m.valor
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-slate-500 active:bg-slate-200'
              }`}
            >
              {m.label}
              {cantidad > 0 && <span className="ml-1 text-[10px] text-slate-400">({cantidad})</span>}
            </button>
          );
        })}
      </div>

      <CapturaFotosUnidad
        unidadId={unidad.id}
        unidadEtiqueta={`${unidad.articuloCodigo} · ${etiquetaUnidad(unidad)}`}
        momento={momento}
        fotosConfirmadas={fotosDelMomento}
        titulo={activo.titulo}
      />

      {enCola > 0 && (
        <p className="text-[11px] text-amber-700">
          {enCola} foto{enCola === 1 ? '' : 's'} se subira{enCola === 1 ? '' : 'n'} automaticamente
          cuando haya senal — podes salir de esta pantalla.
        </p>
      )}

      <Button size="lg" className="w-full" onClick={() => navigate('/mercaderia')}>
        Listo
      </Button>
    </div>
  );
}
