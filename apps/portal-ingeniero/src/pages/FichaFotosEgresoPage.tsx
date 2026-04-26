import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { CapturaFotosStep } from '../components/recepcion/CapturaFotosStep';
import { fichasPropiedadService } from '../services/fichasPropiedadService';
import type { FichaPropiedad } from '@ags/shared';
import { ESTADO_FICHA_LABELS } from '@ags/shared';

/**
 * Pantalla para sumar fotos de egreso pre-embalaje a una ficha existente.
 *
 * Sin :fichaId → lista de fichas activas (no entregadas).
 * Con :fichaId → captura directa para esa ficha (`momento: 'egreso'`).
 *
 * No cambia el estado de la ficha — el remito y el cambio a `entregado` siguen
 * siendo desktop. Esto es solo el registro fotográfico previo al embalaje.
 */
export default function FichaFotosEgresoPage() {
  const { fichaId } = useParams<{ fichaId?: string }>();

  if (fichaId) {
    return <CapturaFichaEgreso fichaId={fichaId} />;
  }
  return <ListaFichasEgreso />;
}

function ListaFichasEgreso() {
  const navigate = useNavigate();
  const [fichas, setFichas] = useState<FichaPropiedad[] | null>(null);

  useEffect(() => {
    return fichasPropiedadService.subscribeActivas(setFichas);
  }, []);

  if (fichas === null) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-4 space-y-3">
      <header>
        <p className="text-xs uppercase tracking-wide text-slate-500 font-mono">
          Egreso · Fotos pre-embalaje
        </p>
        <h1 className="text-lg font-semibold text-slate-800">
          Fichas activas
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Tocá una ficha para sumar fotos antes de embalar.
        </p>
      </header>

      {fichas.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-12">
          No hay fichas activas
        </p>
      ) : (
        <ul className="space-y-2">
          {fichas.map(f => (
            <li key={f.id}>
              <button
                onClick={() => navigate(`/recepcion/egreso/${f.id}`)}
                className="w-full text-left bg-white border border-slate-200 rounded-xl px-3 py-3 hover:border-teal-400 active:bg-slate-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-sm font-semibold text-teal-700">{f.numero}</p>
                  <span className="text-[10px] uppercase tracking-wide text-slate-500 font-mono">
                    {ESTADO_FICHA_LABELS[f.estado]}
                  </span>
                </div>
                <p className="text-sm text-slate-800 mt-1 truncate">{f.clienteNombre}</p>
                <p className="text-xs text-slate-500 truncate">
                  {f.sistemaNombre || f.descripcionLibre || '—'}
                  {f.moduloNombre ? ` · ${f.moduloNombre}` : ''}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CapturaFichaEgreso({ fichaId }: { fichaId: string }) {
  const navigate = useNavigate();
  const [ficha, setFicha] = useState<FichaPropiedad | null | undefined>(undefined);

  useEffect(() => {
    void fichasPropiedadService.getById(fichaId).then(setFicha);
  }, [fichaId]);

  if (ficha === undefined) {
    return <div className="min-h-[40vh] flex items-center justify-center"><Spinner /></div>;
  }
  if (ficha === null) {
    return (
      <div className="max-w-md mx-auto px-4 py-8 text-center space-y-3">
        <p className="text-sm text-slate-700">Ficha no encontrada</p>
        <Button variant="outline" onClick={() => navigate('/recepcion/egreso')} className="w-full">
          Volver a la lista
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-4">
      <header className="mb-3">
        <p className="text-xs uppercase tracking-wide text-slate-500 font-mono">
          Egreso · Pre-embalaje
        </p>
        <h1 className="text-base font-semibold text-slate-800 mt-0.5">
          {ficha.numero} · {ficha.clienteNombre}
        </h1>
        <p className="text-xs text-slate-500">{ficha.sistemaNombre || '—'}</p>
      </header>

      <CapturaFotosStep
        fichaId={ficha.id}
        fichaNumero={ficha.numero}
        momento="egreso"
        fotosConfirmadas={ficha.fotos ?? []}
        onDone={() => navigate('/recepcion/egreso')}
        doneLabel="Listo"
      />
    </div>
  );
}
