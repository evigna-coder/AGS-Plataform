import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { CapturaFotosStep } from '../components/recepcion/CapturaFotosStep';
import { fichasPropiedadService } from '../services/fichasPropiedadService';
import type { FichaPropiedad, ItemFicha } from '@ags/shared';
import { ESTADO_FICHA_LABELS } from '@ags/shared';

/**
 * Pantalla para sumar fotos de egreso pre-embalaje a una ficha existente.
 *
 * Sin :fichaId → lista de fichas activas (no entregadas).
 * Con :fichaId → captura por item de la ficha (`momento: 'egreso'`).
 */
export default function FichaFotosEgresoPage() {
  const { fichaId } = useParams<{ fichaId?: string }>();
  if (fichaId) return <CapturaFichaEgreso fichaId={fichaId} />;
  return <ListaFichasEgreso />;
}

function itemTitulo(it: ItemFicha): string {
  return it.articuloDescripcion || it.descripcionLibre || it.subId || 'Item';
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
        <h1 className="text-lg font-semibold text-slate-800">Fichas activas</h1>
        <p className="text-xs text-slate-500 mt-1">
          Tocá una ficha para sumar fotos antes de embalar.
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
            return (
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
                  <p className="text-xs text-slate-500 truncate">{summary}</p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function CapturaFichaEgreso({ fichaId }: { fichaId: string }) {
  const navigate = useNavigate();
  const [ficha, setFicha] = useState<FichaPropiedad | null | undefined>(undefined);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  useEffect(() => {
    void fichasPropiedadService.getById(fichaId).then(f => {
      setFicha(f);
      // Auto-selección si hay un solo item
      if (f && f.items.length === 1) setSelectedItemId(f.items[0].id);
    });
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

  // Picker de item si hay >1 y no eligió
  if (!selectedItemId && ficha.items.length > 1) {
    return (
      <div className="max-w-md mx-auto px-4 py-4 space-y-3">
        <header>
          <p className="text-xs uppercase tracking-wide text-slate-500 font-mono">Egreso</p>
          <h1 className="text-base font-semibold text-slate-800 mt-0.5">
            {ficha.numero} · {ficha.clienteNombre}
          </h1>
          <p className="text-xs text-slate-500 mt-1">¿A qué item le tomás fotos?</p>
        </header>
        <ul className="space-y-2">
          {ficha.items.map(it => (
            <li key={it.id}>
              <button
                onClick={() => setSelectedItemId(it.id)}
                className="w-full text-left bg-white border border-slate-200 rounded-xl px-3 py-3 hover:border-teal-400 active:bg-slate-50"
              >
                <p className="font-mono text-xs text-teal-700">{it.subId}</p>
                <p className="text-sm text-slate-800 truncate">{itemTitulo(it)}</p>
                {it.serie && <p className="text-[11px] text-slate-500 font-mono">S/N {it.serie}</p>}
              </button>
            </li>
          ))}
        </ul>
        <Button variant="outline" onClick={() => navigate('/recepcion/egreso')} className="w-full">
          Cancelar
        </Button>
      </div>
    );
  }

  const item = ficha.items.find(it => it.id === selectedItemId);
  if (!item) {
    return (
      <div className="max-w-md mx-auto px-4 py-8 text-center">
        <p className="text-sm text-slate-700">Esta ficha no tiene items</p>
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
          {item.subId} · {ficha.clienteNombre}
        </h1>
        <p className="text-xs text-slate-500">{itemTitulo(item)}</p>
      </header>

      <CapturaFotosStep
        fichaId={ficha.id}
        fichaNumero={ficha.numero}
        itemId={item.id}
        itemSubId={item.subId}
        momento="egreso"
        fotosConfirmadas={item.fotos ?? []}
        onDone={() => navigate('/recepcion/egreso')}
        doneLabel="Listo"
      />
    </div>
  );
}
