import { useMemo } from 'react';
import { useActividad } from '../../hooks/useActividad';
import { haceCuanto, masUsadas, pantallaDeRuta } from '../../utils/actividadUsuario';

interface Entrada { path: string; name: string; icon: string; grupo: string }

interface Props {
  /** Pantallas del menú que el usuario puede ver (ya filtradas por permisos). */
  entradas: Entrada[];
  irA: (path: string) => void;
}

const MAS_USADAS = 8;
const RECIENTES = 8;
const titulo = 'text-[10px] font-mono font-medium text-slate-400 uppercase tracking-wide mb-2';
const tarjeta = `flex items-center gap-2.5 px-3 py-2.5 bg-white border border-slate-200 rounded-lg
  text-left hover:border-teal-500 hover:shadow-[0_1px_4px_rgba(0,0,0,0.06)] transition-all`;

/**
 * Accesos de la pestaña nueva (2026-10-01): las pantallas que el usuario más
 * usa (las visitas recientes pesan más) y los últimos documentos que abrió.
 * Sin historial todavía, se proponen las primeras pantallas de su menú.
 */
export function NuevaPestanaAccesos({ entradas, irA }: Props) {
  const actividad = useActividad();
  const porPath = useMemo(() => new Map(entradas.map(e => [e.path, e])), [entradas]);

  const usadas = useMemo(() => {
    const top = masUsadas(actividad, new Set(porPath.keys()), new Date(), MAS_USADAS)
      .map(p => porPath.get(p)!)
      .filter(Boolean);
    const sinHistorial = top.length === 0;
    return { lista: sinHistorial ? entradas.slice(0, 6) : top, sinHistorial };
  }, [actividad, porPath, entradas]);

  const recientes = useMemo(() => {
    const pantallas = entradas.map(e => e.path);
    const ahora = new Date();
    return actividad.recientes.slice(0, RECIENTES).map(r => {
      const pantalla = pantallaDeRuta(r.path.split('?')[0], pantallas);
      return { ...r, icon: (pantalla && porPath.get(pantalla)?.icon) || '📄', cuando: haceCuanto(r.t, ahora) };
    });
  }, [actividad, entradas, porPath]);

  if (usadas.lista.length === 0 && recientes.length === 0) return null;

  return (
    <div className="mt-7 space-y-6">
      {usadas.lista.length > 0 && (
        <section>
          <h2 className={titulo}>{usadas.sinHistorial ? 'Para empezar' : 'Tus más usadas'}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {usadas.lista.map(e => (
              <button key={e.path} onClick={() => irA(e.path)} className={tarjeta}>
                <span className="text-base leading-none shrink-0">{e.icon}</span>
                <span className="min-w-0">
                  <span className="block text-xs text-slate-700 truncate" title={e.name}>{e.name}</span>
                  <span className="block text-[10px] text-slate-400 truncate">{e.grupo}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
      {recientes.length > 0 && (
        <section>
          <h2 className={titulo}>Recientes</h2>
          <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
            {recientes.map(r => (
              <button key={r.path} onClick={() => irA(r.path)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50 transition-colors first:rounded-t-lg last:rounded-b-lg">
                <span className="text-sm leading-none shrink-0">{r.icon}</span>
                <span className="text-xs text-slate-700 truncate flex-1" title={r.titulo}>{r.titulo}</span>
                <span className="text-[10px] font-mono text-slate-400 shrink-0">{r.tipo}</span>
                <span className="text-[10px] text-slate-400 shrink-0 w-20 text-right">{r.cuando}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
