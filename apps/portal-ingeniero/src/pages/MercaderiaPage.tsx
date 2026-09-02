import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner } from '../components/ui/Spinner';
import { unidadesFotosService, etiquetaUnidad } from '../services/unidadesFotosService';
import { matchesSearch } from '../utils/searchTerms';
import type { UnidadStock } from '@ags/shared';

const SIN_IMPO = '__sin_impo__';

function formatDate(d?: string | null): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
  } catch {
    return d;
  }
}

/** Cabecera del grupo: la importacion que trajo estas unidades, o la OC suelta. */
function tituloGrupo(u: UnidadStock): string {
  if (u.importacionNumero) {
    return u.ordenCompraNumero
      ? `${u.importacionNumero} · OC ${u.ordenCompraNumero}`
      : u.importacionNumero;
  }
  return u.ordenCompraNumero ? `OC ${u.ordenCompraNumero}` : 'Sin importacion';
}

/**
 * Recepcion de mercaderia (2026-09-02): fotos de lo que llega, sacadas desde el
 * celular en el deposito. Solo admin / admin_soporte (gate en App.tsx).
 *
 * Entra por lo ultimo ingresado al stock, que es lo que se esta desembalando.
 * Las fotos cuelgan de la UNIDAD, asi que la unidad tiene que existir: primero
 * se ingresa la mercaderia desde la PC, despues se fotografia.
 *
 * Nada exige fotos ni las valida — el que recibe sabe que amerita (equipos de
 * venta, columnas certificadas, cualquier cosa fragil). Es dejar constancia.
 */
export default function MercaderiaPage() {
  const navigate = useNavigate();
  const [unidades, setUnidades] = useState<UnidadStock[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    unidadesFotosService.recientes()
      .then(us => { if (!cancelled) setUnidades(us); })
      .catch(err => {
        console.error('[mercaderia] no se pudieron cargar las unidades:', err);
        if (!cancelled) { setError('No se pudo cargar el stock reciente.'); setUnidades([]); }
      });
    return () => { cancelled = true; };
  }, []);

  const filtradas = useMemo(() => {
    if (!unidades) return [];
    if (!search.trim()) return unidades;
    return unidades.filter(u => matchesSearch(
      search,
      u.articuloCodigo, u.articuloDescripcion, u.nroSerie, u.nroLote,
      u.importacionNumero, u.ordenCompraNumero, u.despachoImportacionNumero,
    ));
  }, [unidades, search]);

  /** Agrupadas por importacion, conservando el orden (mas nuevo primero). */
  const grupos = useMemo(() => {
    const mapa = new Map<string, { titulo: string; unidades: UnidadStock[] }>();
    for (const u of filtradas) {
      const key = u.importacionNumero || u.ordenCompraNumero || SIN_IMPO;
      if (!mapa.has(key)) mapa.set(key, { titulo: tituloGrupo(u), unidades: [] });
      mapa.get(key)!.unidades.push(u);
    }
    return [...mapa.values()];
  }, [filtradas]);

  if (unidades === null) {
    return <div className="min-h-[40vh] flex items-center justify-center"><Spinner /></div>;
  }

  return (
    <div className="max-w-md mx-auto px-4 py-4 space-y-3">
      <header>
        <p className="text-xs uppercase tracking-wide text-slate-500 font-mono">Mercaderia</p>
        <h1 className="text-lg font-semibold text-slate-800">Fotos de recepcion</h1>
        <p className="text-xs text-slate-500 mt-1">
          Lo ultimo ingresado al stock. Toca una unidad para fotografiarla — equipos
          de venta, columnas certificadas, y todo lo que convenga dejar documentado.
        </p>
      </header>

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Buscar por codigo, descripcion, serie, lote, IMP…"
        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
      />

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {grupos.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <p className="text-sm text-slate-400">
            {unidades.length === 0
              ? 'No hay unidades ingresadas todavia'
              : 'Sin resultados para la busqueda'}
          </p>
          {unidades.length === 0 && (
            <p className="text-xs text-slate-400 px-6">
              La mercaderia se ingresa al stock desde la PC. Una vez ingresada,
              aparece aca para fotografiar.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {grupos.map((g, i) => (
            <section key={`${g.titulo}-${i}`}>
              <p className="text-[10px] font-mono uppercase tracking-wide text-teal-700 border-b border-teal-100 pb-1 mb-2">
                {g.titulo} · {g.unidades.length} unidad{g.unidades.length === 1 ? '' : 'es'}
              </p>
              <ul className="space-y-2">
                {g.unidades.map(u => {
                  const fotos = (u.fotos ?? []).filter(f => f.momento === 'recepcion').length;
                  return (
                    <li key={u.id}>
                      <button
                        onClick={() => navigate(`/mercaderia/${u.id}`)}
                        className="w-full text-left bg-white border border-slate-200 rounded-xl px-3 py-3 hover:border-teal-400 active:bg-slate-50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-mono text-sm font-semibold text-teal-700 truncate">
                            {u.articuloCodigo}
                          </p>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${
                            fotos > 0 ? 'bg-teal-50 text-teal-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {fotos > 0 ? `${fotos} foto${fotos === 1 ? '' : 's'}` : 'sin fotos'}
                          </span>
                        </div>
                        <p className="text-sm text-slate-800 mt-1 truncate">{u.articuloDescripcion}</p>
                        <p className="text-xs text-slate-500 truncate">
                          {etiquetaUnidad(u)} · ingresada {formatDate(u.createdAt)}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
