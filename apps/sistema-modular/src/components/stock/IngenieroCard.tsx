import { descripcionItemAsignacion } from '../../utils/itemAsignacionLabel';
import { codigoItemEnCampo, type IngenieroConMaterial } from '../../hooks/useAsignacionesVista';

const TIPO_LABELS: Record<string, string> = {
  articulo: 'Artículo', minikit: 'Minikit', instrumento: 'Instrumento',
  patron: 'Patrón', columna: 'Columna', dispositivo: 'Dispositivo',
  vehiculo: 'Vehículo', loaner: 'Loaner',
};

const AREA_LABELS: Record<string, string> = {
  campo: 'Campo', taller: 'Taller', electronica: 'Electrónica',
  mecanica: 'Mecánica', ventas: 'Ventas', admin: 'Admin',
};

/** 4 → 6 (2026-08-11): mas partes visibles por card, con la card mas compacta. */
const MAX_ITEMS_VISIBLES = 6;

const fmtFecha = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');

const iniciales = (nombre: string) =>
  nombre.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('');

interface Props {
  data: IngenieroConMaterial;
  /** Con búsqueda activa los items ya vienen filtrados: se muestran todos. */
  searchActive: boolean;
  onVerInventario: () => void;
  onDevolver: () => void;
  onAsignar: () => void;
}

export const IngenieroCard = ({ data, searchActive, onVerInventario, onDevolver, onAsignar }: Props) => {
  const { ingeniero, items, ultimaAsignacion, patronesVencidos } = data;
  const visibles = searchActive ? items : items.slice(0, MAX_ITEMS_VISIBLES);
  const restantes = items.length - visibles.length;
  const metaLine = [
    ingeniero.area ? AREA_LABELS[ingeniero.area] ?? ingeniero.area : null,
    ultimaAsignacion ? `últ. asignación ${fmtFecha(ultimaAsignacion)}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="bg-white rounded-xl border border-slate-200 border-t-[3px] border-t-teal-600 shadow-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 pt-2.5 pb-1.5">
        <div className="w-7 h-7 rounded-full bg-teal-50 flex items-center justify-center shrink-0">
          <span className="font-serif font-semibold text-teal-700 text-xs">{iniciales(ingeniero.nombre)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-slate-900 truncate">{ingeniero.nombre}</p>
          {metaLine && (
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide truncate">{metaLine}</p>
          )}
        </div>
        <span className="shrink-0 text-[10px] font-mono font-semibold bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      {/* Items */}
      <div className="flex-1 px-3 pb-1.5 space-y-0.5">
        {items.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-2">Sin material en campo</p>
        ) : (
          <>
            {visibles.map(item => {
              const codigo = codigoItemEnCampo(item);
              const desc = descripcionItemAsignacion(item);
              return (
              <div key={`${item.asignacionId}:${item.id}`} className="flex items-center gap-1.5 bg-slate-50 rounded px-2 py-[3px] min-w-0">
                <span className="font-mono text-[10px] text-teal-700 font-semibold shrink-0">{codigo}</span>
                <span className="text-[11px] text-slate-700 truncate flex-1">
                  {/* Sin descripción propia (minikits, instrumentos sin marca) el
                      fallback repetía el código dos veces en la misma línea. */}
                  {desc === codigo ? '' : desc}
                </span>
                <span className="shrink-0 text-[9px] bg-slate-200/60 text-slate-500 px-1 py-0.5 rounded">
                  {TIPO_LABELS[item.tipo] ?? item.tipo}
                </span>
              </div>
              );
            })}
            {restantes > 0 && (
              <button onClick={onVerInventario} className="text-[11px] text-teal-700 font-medium hover:underline px-2">
                + {restantes} más…
              </button>
            )}
          </>
        )}
        {patronesVencidos.map(p => (
          <div key={`venc-${p.asignacionId}:${p.id}`} className="flex items-center gap-1.5 bg-amber-100 text-amber-700 rounded px-2 py-1 text-[11px] font-medium">
            <span className="shrink-0">⚠</span>
            <span className="truncate">
              {p.patronCodigo ?? codigoItemEnCampo(p)}{p.patronLote ? ` lote ${p.patronLote}` : ''} vencido en campo
            </span>
          </div>
        ))}
      </div>

      {/* Footer acciones */}
      <div className="border-t border-slate-100 px-3 py-1.5 flex items-center gap-3">
        <button onClick={onVerInventario} className="text-[11px] font-medium text-slate-500 hover:text-teal-700">
          Ver inventario
        </button>
        <button onClick={onDevolver} className="text-[11px] font-medium text-slate-500 hover:text-teal-700">
          Devolver…
        </button>
        <button onClick={onAsignar} className="text-[11px] font-medium text-teal-700 hover:text-teal-800 ml-auto">
          + Asignar
        </button>
      </div>
    </div>
  );
};
