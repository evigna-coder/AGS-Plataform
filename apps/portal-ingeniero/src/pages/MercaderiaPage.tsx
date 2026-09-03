import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner } from '../components/ui/Spinner';
import { mercaderiaFotosService, type DestinoFotos, type DocumentoConFotos } from '../services/mercaderiaFotosService';
import { matchesSearch } from '../utils/searchTerms';

const TABS: { destino: DestinoFotos; label: string; vacio: string }[] = [
  { destino: 'importacion', label: 'Recepción', vacio: 'No hay embarques cargados' },
  { destino: 'remito', label: 'Entrega', vacio: 'No hay remitos cargados' },
];

function formatDate(d?: string | null): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
  } catch {
    return d;
  }
}

/**
 * Fotos de mercadería (2026-09-03): se elige el DOCUMENTO —el embarque que
 * llegó o el remito que sale— y se disparan fotos seguidas.
 *
 * Antes cada foto colgaba de una unidad de stock: en la compra de un equipo con
 * 30 ítems, elegir el renglón foto por foto no lo hacía nadie.
 *
 * Solo admin / admin_soporte (gate en App.tsx).
 */
export default function MercaderiaPage() {
  const navigate = useNavigate();
  const [destino, setDestino] = useState<DestinoFotos>('importacion');
  const [docs, setDocs] = useState<DocumentoConFotos[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setDocs(null);
    setError(null);
    mercaderiaFotosService.recientes(destino)
      .then(d => { if (!cancelled) setDocs(d); })
      .catch(err => {
        console.error('[mercaderia] no se pudieron cargar los documentos:', err);
        if (!cancelled) { setError('No se pudo cargar la lista.'); setDocs([]); }
      });
    return () => { cancelled = true; };
  }, [destino]);

  const filtrados = useMemo(() => {
    if (!docs) return [];
    if (!search.trim()) return docs;
    return docs.filter(d => matchesSearch(search, d.numero, d.subtitulo));
  }, [docs, search]);

  const tab = TABS.find(t => t.destino === destino)!;

  return (
    <div className="max-w-md mx-auto px-4 py-4 space-y-3">
      <header>
        <p className="text-xs uppercase tracking-wide text-slate-500 font-mono">Mercadería</p>
        <h1 className="text-lg font-semibold text-slate-800">Fotos</h1>
        <p className="text-xs text-slate-500 mt-1">
          Elegí el embarque o el remito y sacá las fotos que hagan falta. La tanda
          queda abierta hasta que la cierres.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-1 bg-slate-100 rounded-xl p-1">
        {TABS.map(t => (
          <button
            key={t.destino}
            onClick={() => setDestino(t.destino)}
            className={`rounded-lg py-2 text-xs font-medium transition-colors ${
              destino === t.destino ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 active:bg-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder={destino === 'importacion' ? 'Buscar por IMP, OC o proveedor…' : 'Buscar por número o destinatario…'}
        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
      />

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      {docs === null ? (
        <div className="min-h-[30vh] flex items-center justify-center"><Spinner /></div>
      ) : filtrados.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-12">
          {docs.length === 0 ? tab.vacio : 'Sin resultados para la búsqueda'}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtrados.map(d => (
            <li key={d.id}>
              <button
                onClick={() => navigate(`/mercaderia/${d.destino}/${d.id}`)}
                className="w-full text-left bg-white border border-slate-200 rounded-xl px-3 py-3 hover:border-teal-400 active:bg-slate-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-sm font-semibold text-teal-700 truncate">{d.numero}</p>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${
                    d.cerradaAt ? 'bg-slate-100 text-slate-500'
                      : d.fotos.length > 0 ? 'bg-teal-50 text-teal-700'
                        : 'bg-amber-50 text-amber-700'
                  }`}>
                    {d.cerradaAt
                      ? `cerrada · ${d.fotos.length}`
                      : d.fotos.length > 0 ? `${d.fotos.length} foto${d.fotos.length === 1 ? '' : 's'}` : 'sin fotos'}
                  </span>
                </div>
                <p className="text-sm text-slate-800 mt-1 truncate">{d.subtitulo}</p>
                <p className="text-xs text-slate-500">{formatDate(d.fecha)}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
