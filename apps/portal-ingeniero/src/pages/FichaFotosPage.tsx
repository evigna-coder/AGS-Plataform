import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { CapturaFotosStep } from '../components/recepcion/CapturaFotosStep';
import { fichasPropiedadService } from '../services/fichasPropiedadService';
import type { FichaPropiedad, ItemFicha, MomentoFotoFicha } from '@ags/shared';
import { ESTADO_FICHA_LABELS } from '@ags/shared';

/**
 * Pantalla para sumar fotos a una ficha existente.
 *
 * Sin :fichaId → lista de fichas activas.
 * Con :fichaId → captura, con toggle de momento (ingreso / egreso).
 *
 * Casos cubiertos:
 *   - Cliente mandó algo después de la recepción inicial → momento: ingreso.
 *   - Pre-embalaje antes de devolver → momento: egreso.
 */
export default function FichaFotosPage() {
  const { fichaId } = useParams<{ fichaId?: string }>();
  if (fichaId) return <CapturaFichaFotos fichaId={fichaId} />;
  return <ListaFichas />;
}

function itemTitulo(it: ItemFicha): string {
  return it.articuloDescripcion || it.descripcionLibre || it.subId || 'Item';
}

function ListaFichas() {
  const navigate = useNavigate();
  const [fichas, setFichas] = useState<FichaPropiedad[] | null>(null);
  const [demorado, setDemorado] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);
  const [reintento, setReintento] = useState(0);

  useEffect(() => {
    setDemorado(false);
    setErrorDetalle(null);
    // Si en 8s no llegó ni el snapshot de caché, Firestore está trabado:
    // mostrar salida en vez de spinner mudo. Si la suscripción ERRA, mostrar
    // el detalle técnico en pantalla (diagnóstico sin F12 — UAT 2026-07-29).
    const timer = setTimeout(() => setDemorado(true), 8_000);
    const unsub = fichasPropiedadService.subscribeActivas(
      items => { clearTimeout(timer); setDemorado(false); setFichas(items); },
      err => { clearTimeout(timer); setDemorado(true); setErrorDetalle(err?.message || String(err)); },
    );
    return () => { clearTimeout(timer); unsub(); };
  }, [reintento]);

  if (fichas === null) {
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3 px-6 text-center">
        <Spinner />
        {demorado && (
          <>
            <p className="text-xs text-slate-500">
              {errorDetalle
                ? 'La carga falló con este error:'
                : 'La carga está tardando demasiado (sin respuesta de la base). Puede ser la red, o el portal abierto en la app y en Safari a la vez.'}
            </p>
            {errorDetalle && (
              <p className="text-[11px] font-mono text-red-600 break-words max-w-full bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {errorDetalle}
              </p>
            )}
            <Button variant="outline" onClick={() => setReintento(n => n + 1)}>Reintentar</Button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-4 space-y-3">
      <header>
        <p className="text-xs uppercase tracking-wide text-slate-500 font-mono">Sumar fotos</p>
        <h1 className="text-lg font-semibold text-slate-800">Fichas activas</h1>
        <p className="text-xs text-slate-500 mt-1">
          Tocá una ficha para agregar fotos de ingreso (algo llegó después) o de egreso (pre-embalaje).
        </p>
      </header>

      {fichas.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-12">No hay fichas activas</p>
      ) : (
        <ul className="space-y-2">
          {fichas.map(f => {
            const first = f.items?.[0];
            const summary = first
              ? `${itemTitulo(first)}${f.items.length > 1 ? ` (+${f.items.length - 1})` : ''}`
              : '—';
            const fotosCount = f.fotos?.length ?? 0;
            return (
              <li key={f.id}>
                <button
                  onClick={() => navigate(`/recepcion/fotos/${f.id}`)}
                  className="w-full text-left bg-white border border-slate-200 rounded-xl px-3 py-3 hover:border-teal-400 active:bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-sm font-semibold text-teal-700">{f.numero}</p>
                    <span className="text-[10px] uppercase tracking-wide text-slate-500 font-mono">
                      {ESTADO_FICHA_LABELS[f.estado]}
                    </span>
                  </div>
                  <p className="text-sm text-slate-800 mt-1 truncate">{f.clienteNombre}</p>
                  <p className="text-xs text-slate-500 truncate">{summary}</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {fotosCount} foto{fotosCount === 1 ? '' : 's'}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function CapturaFichaFotos({ fichaId }: { fichaId: string }) {
  const navigate = useNavigate();
  const [ficha, setFicha] = useState<FichaPropiedad | null | undefined>(undefined);
  const [momento, setMomento] = useState<MomentoFotoFicha>('ingreso');
  const [demorado, setDemorado] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);
  const [reintento, setReintento] = useState(0);

  useEffect(() => {
    setDemorado(false);
    setErrorDetalle(null);
    const timer = setTimeout(() => setDemorado(true), 8_000);
    fichasPropiedadService.getById(fichaId)
      .then(f => { clearTimeout(timer); setFicha(f); })
      .catch(err => { clearTimeout(timer); setDemorado(true); setErrorDetalle(err?.message || String(err)); });
    return () => clearTimeout(timer);
  }, [fichaId, reintento]);

  if (ficha === undefined) {
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3 px-6 text-center">
        <Spinner />
        {demorado && (
          <>
            <p className="text-xs text-slate-500">
              {errorDetalle
                ? 'La carga falló con este error:'
                : 'La carga está tardando demasiado (sin respuesta de la base). Puede ser la red, o el portal abierto en la app y en Safari a la vez.'}
            </p>
            {errorDetalle && (
              <p className="text-[11px] font-mono text-red-600 break-words max-w-full bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {errorDetalle}
              </p>
            )}
            <Button variant="outline" onClick={() => setReintento(n => n + 1)}>Reintentar</Button>
          </>
        )}
      </div>
    );
  }
  if (ficha === null) {
    return (
      <div className="max-w-md mx-auto px-4 py-8 text-center space-y-3">
        <p className="text-sm text-slate-700">Ficha no encontrada</p>
        <Button variant="outline" onClick={() => navigate('/recepcion/fotos')} className="w-full">
          Volver
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-4">
      <header className="mb-3">
        <p className="text-xs uppercase tracking-wide text-slate-500 font-mono">Sumar fotos</p>
        <h1 className="text-base font-semibold text-slate-800 mt-0.5">
          {ficha.numero} · {ficha.clienteNombre}
        </h1>
        <p className="text-xs text-slate-500">
          {ficha.items.length} item{ficha.items.length === 1 ? '' : 's'} · {ficha.fotos?.length ?? 0} foto{(ficha.fotos?.length ?? 0) === 1 ? '' : 's'}
        </p>
      </header>

      {/* Toggle ingreso / egreso */}
      <div className="flex bg-slate-100 rounded-lg p-1 mb-3 text-xs font-medium">
        <button
          onClick={() => setMomento('ingreso')}
          className={`flex-1 py-1.5 rounded-md transition-colors ${
            momento === 'ingreso'
              ? 'bg-white text-teal-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          Ingreso
        </button>
        <button
          onClick={() => setMomento('egreso')}
          className={`flex-1 py-1.5 rounded-md transition-colors ${
            momento === 'egreso'
              ? 'bg-white text-cyan-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          Egreso (pre-embalaje)
        </button>
      </div>

      <CapturaFotosStep
        fichaId={ficha.id}
        fichaNumero={ficha.numero}
        momento={momento}
        fotosConfirmadas={ficha.fotos ?? []}
        onDone={() => navigate('/recepcion/fotos')}
        doneLabel="Listo"
      />
    </div>
  );
}
