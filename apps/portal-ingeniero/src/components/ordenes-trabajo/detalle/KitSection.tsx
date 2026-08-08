import { Link } from 'react-router-dom';
import type { KitItem } from '../../../hooks/useKitIngeniero';
import { GCard } from './atoms';

const TIPO_LABEL: Record<KitItem['tipo'], string> = {
  instrumento: 'Instrumento',
  patron: 'Patrón',
  minikit: 'Minikit',
  articulo: 'Artículo',
  dispositivo: 'Dispositivo',
};

/** "Asignado al ingeniero": instrumentos/patrones (con certificado), minikits, stock. */
export function KitIngenieroCard({ items, loading }: { items: KitItem[]; loading: boolean }) {
  if (!loading && items.length === 0) return null;
  return (
    <GCard label="Asignado al ingeniero">
      {loading && items.length === 0 && (
        <p className="text-xs text-slate-400 py-1">Cargando…</p>
      )}
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2.5 py-1.5 border-b border-slate-200 last:border-b-0 min-h-[52px] text-[13.5px]">
          <div className="flex-1 min-w-0">
            <span className="text-slate-800">{item.nombre}</span>
            <span className="block font-mono text-[11px] text-slate-500 mt-px">
              {[TIPO_LABEL[item.tipo], item.codigo].filter(Boolean).join(' · ')}
            </span>
            {/* Vencimiento del lote de patrón (2026-08-08): usar uno vencido
                invalida la calibración y en campo no hay cómo chequearlo. */}
            {item.vencimiento && (
              <span className={`block font-mono text-[11px] mt-px ${item.vencido ? 'text-red-600 font-semibold' : 'text-slate-400'}`}>
                {item.vencido ? '⚠ VENCIDO el ' : 'Vence '}
                {item.vencimiento.slice(0, 10).split('-').reverse().join('/')}
              </span>
            )}
          </div>
          {item.certificadoUrl && (
            <a
              href={item.certificadoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 shrink-0 font-mono text-[10px] font-semibold uppercase tracking-wider text-teal-700 bg-white border border-teal-700/40 rounded-xl whitespace-nowrap hover:bg-teal-50"
            >
              Ver certificado ↗
            </a>
          )}
          {/* Contenido del minikit con buscador (2026-08-03) — mismo patrón
              que "Ver certificado" de los instrumentos. */}
          {item.tipo === 'minikit' && item.codigo && (
            <Link
              to={`/minikits/${encodeURIComponent(item.codigo)}`}
              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 shrink-0 font-mono text-[10px] font-semibold uppercase tracking-wider text-teal-700 bg-white border border-teal-700/40 rounded-xl whitespace-nowrap hover:bg-teal-50"
            >
              Ver contenido →
            </Link>
          )}
        </div>
      ))}
    </GCard>
  );
}
