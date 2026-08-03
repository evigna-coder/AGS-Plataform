import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Minikit, MinikitRequeridoItem, UnidadStock } from '@ags/shared';
import { misOTService } from '../services/misOTService';
import { useNavigateBack } from '../hooks/useNavigateBack';
import { Spinner } from '../components/ui/Spinner';

const fmtFecha = (iso?: string | null) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
};

/**
 * Contenido de un minikit para el ingeniero (pedido 2026-08-03): consulta
 * rápida de existencias con buscador — "¿tengo capilar en el kit? ¿cuántos?".
 * Solo lectura; se llega desde el kit asignado en el detalle de la OT.
 */
export default function MinikitPage() {
  const { codigo } = useParams<{ codigo: string }>();
  const goBack = useNavigateBack();
  const [minikit, setMinikit] = useState<Minikit | null>(null);
  const [unidades, setUnidades] = useState<UnidadStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!codigo) return;
    let cancel = false;
    setLoading(true);
    (async () => {
      const mk = await misOTService.getMinikitByCodigo(codigo) as unknown as Minikit | null;
      if (cancel) return;
      setMinikit(mk);
      if (mk) {
        const us = await misOTService.getUnidadesDeMinikit(mk.id).catch(() => [] as UnidadStock[]);
        if (!cancel) setUnidades(us);
      }
    })().catch(err => console.error('[MinikitPage] load failed:', err))
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [codigo]);

  const filas = useMemo(() => {
    const reqs: MinikitRequeridoItem[] = minikit?.requeridos ?? [];
    const term = q.trim().toLowerCase();
    return reqs
      .map(r => ({ ...r, actual: unidades.filter(u => u.articuloId === r.articuloId).length }))
      .filter(r => !term
        || r.articuloCodigo?.toLowerCase().includes(term)
        || r.articuloDescripcion?.toLowerCase().includes(term)
        || r.sector?.toLowerCase().includes(term))
      .sort((a, b) => (a.sector || '￿').localeCompare(b.sector || '￿')
        || (a.articuloDescripcion || '').localeCompare(b.articuloDescripcion || ''));
  }, [minikit, unidades, q]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>;
  }

  if (!minikit) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-slate-500">No se encontró el minikit {codigo}.</p>
        <button onClick={() => goBack()} className="mt-3 text-sm font-semibold text-teal-700">← Volver</button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 bg-white border-b border-slate-100 px-4 py-3">
        <div className="max-w-3xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <button onClick={() => goBack()} className="text-slate-400 hover:text-slate-600 shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-slate-900 truncate">
                <span className="font-mono text-teal-700">{minikit.codigo}</span> · {minikit.nombre}
              </h1>
              <p className="text-[11px] text-slate-400">
                {minikit.descripcion ? `${minikit.descripcion} · ` : ''}
                Última revisión: {fmtFecha(minikit.ultimaVerificacion?.fecha)}
              </p>
            </div>
          </div>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar artículo por código, descripción o sector…"
            className="mt-3 w-full min-h-[44px] text-sm border border-slate-200 rounded-xl px-3.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="max-w-3xl mx-auto w-full space-y-1.5">
          {filas.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">
              {q ? 'Ningún artículo coincide con la búsqueda.' : 'Este minikit no tiene artículos configurados.'}
            </p>
          ) : (
            filas.map((f, i) => {
              const falta = f.actual < f.cantidadMinima;
              return (
                <div key={i} className="bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-[12px] font-semibold text-teal-700">{f.articuloCodigo}</span>
                    <p className="text-[13px] text-slate-800 leading-snug">{f.articuloDescripcion}</p>
                    {f.sector && <p className="text-[10px] font-mono uppercase tracking-wide text-slate-400 mt-0.5">{f.sector}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-lg font-bold leading-none ${falta ? 'text-red-600' : 'text-slate-800'}`}>{f.actual}</p>
                    <p className="text-[10px] text-slate-400">mín. {f.cantidadMinima}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
