import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Establecimiento, ModuloSistema, Sistema } from '@ags/shared';
import { modulosService } from '../../services/firebaseService';
import { matchesSearch } from '../../utils/searchTerms';
import { LoadingState } from '../ui/LoadingState';
import { EmptyState } from '../ui/EmptyState';
import { SeleccionFlotante } from '../ui/SeleccionFlotante';
import { ExportarButton } from '../ui/ExportarButton';
import { MODULOS_EXPORT_COLUMNS } from '../../utils/exports/exportEquipos';

interface Props {
  /** Sistemas ya filtrados por estado y categoría (el buscador se aplica acá, también sobre los módulos). */
  sistemas: Sistema[];
  busqueda: string;
  clienteDe: (s: Sistema) => string;
  estMap: Record<string, Establecimiento>;
  catMap: Record<string, string>;
}

const PASO = 300;
const th = 'px-3 py-2 text-left text-[10px] font-mono uppercase tracking-wide text-slate-400 whitespace-nowrap';

/**
 * Equipos vistos por MÓDULO (2026-10-01, pedido del user): hasta ahora la lista
 * solo mostraba sistemas y para ver una bomba o un detector había que entrar a
 * cada equipo. Cada fila es un módulo con su serie y marca, y el sistema,
 * cliente y establecimiento al que pertenece. El buscador mira también los
 * datos del módulo (nombre, modelo, serie, marca, firmware).
 */
export function EquiposModulosVista({ sistemas, busqueda, clienteDe, estMap, catMap }: Props) {
  const [modulos, setModulos] = useState<ModuloSistema[] | null>(null);
  const [limite, setLimite] = useState(PASO);
  // Selección para exportar (2026-10-01): clave sistema-módulo.
  const [sel, setSel] = useState<Set<string>>(new Set());
  const clave = (sId: string, mId: string) => `${sId}-${mId}`;

  useEffect(() => {
    let vivo = true;
    modulosService.getAllGrouped()
      .then(m => { if (vivo) setModulos(m); })
      .catch(err => { console.error('[EquiposModulosVista]', err); if (vivo) setModulos([]); });
    return () => { vivo = false; };
  }, []);
  useEffect(() => { setLimite(PASO); }, [busqueda, sistemas]);

  const filas = useMemo(() => {
    if (!modulos) return [];
    const porId = new Map(sistemas.map(s => [s.id, s]));
    return modulos
      .filter(m => porId.has(m.sistemaId))
      .map(m => {
        const s = porId.get(m.sistemaId)!;
        const est = estMap[s.establecimientoId || ''];
        return { m, s, cliente: clienteDe(s), est: est?.nombre ?? '', categoria: catMap[s.categoriaId] ?? '' };
      })
      .filter(f => !busqueda.trim() || matchesSearch(busqueda,
        f.m.nombre, f.m.descripcion, f.m.serie, f.m.marca, f.m.firmware,
        f.s.nombre, f.s.codigoInternoCliente, f.s.agsVisibleId, f.cliente, f.est))
      .sort((a, b) => a.cliente.localeCompare(b.cliente) || (a.s.nombre ?? '').localeCompare(b.s.nombre ?? '') || (a.m.nombre ?? '').localeCompare(b.m.nombre ?? ''));
  }, [modulos, sistemas, busqueda, clienteDe, estMap, catMap]);
  const seleccionadas = useMemo(() => filas.filter(f => sel.has(clave(f.s.id, f.m.id))), [filas, sel]);
  const todas = filas.length > 0 && seleccionadas.length === filas.length;
  const alternar = (k: string) => setSel(prev => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  if (!modulos) return <LoadingState message="Cargando módulos…" />;
  if (filas.length === 0) return <EmptyState message="No se encontraron módulos" hint="Probá con otros filtros o ampliá la búsqueda" />;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-auto h-full">
      <table className="tabla-compacta w-full">
        <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-3 py-2 w-8">
              <input type="checkbox" checked={todas} title="Seleccionar todos los que muestra la búsqueda"
                onChange={() => setSel(todas ? new Set() : new Set(filas.map(f => clave(f.s.id, f.m.id))))}
                className="rounded border-slate-300 accent-teal-600" />
            </th>
            <th className={th}>Módulo</th><th className={th}>Descripción</th><th className={th}>N° serie</th>
            <th className={th}>Marca</th><th className={th}>Sistema</th><th className={th}>ID equipo</th>
            <th className={th}>Cliente</th><th className={th}>Establecimiento</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filas.slice(0, limite).map(({ m, s, cliente, est }) => (
            <tr key={`${s.id}-${m.id}`} className={sel.has(clave(s.id, m.id)) ? 'bg-teal-50/60' : 'hover:bg-slate-50'}>
              <td className="px-3 py-1.5">
                <input type="checkbox" checked={sel.has(clave(s.id, m.id))} onChange={() => alternar(clave(s.id, m.id))}
                  className="rounded border-slate-300 accent-teal-600" />
              </td>
              <td className="px-3 py-1.5 text-xs font-semibold text-slate-800 whitespace-nowrap">{m.nombre || '—'}</td>
              <td className="px-3 py-1.5 text-xs text-slate-600 max-w-[260px] truncate" title={m.descripcion}>{m.descripcion || '—'}</td>
              <td className="px-3 py-1.5 text-xs font-mono text-slate-700 whitespace-nowrap">{m.serie || '—'}</td>
              <td className="px-3 py-1.5 text-xs text-slate-600">{m.marca || '—'}</td>
              <td className="px-3 py-1.5 text-xs whitespace-nowrap">
                <Link to={`/equipos/${s.id}`} className="text-teal-700 hover:underline font-medium">{s.nombre}</Link>
                {catMap[s.categoriaId] && <span className="ml-1.5 text-[10px] text-slate-400">{catMap[s.categoriaId]}</span>}
              </td>
              <td className="px-3 py-1.5 text-xs font-mono text-slate-600">{s.codigoInternoCliente || s.agsVisibleId || '—'}</td>
              <td className="px-3 py-1.5 text-xs text-slate-700 max-w-[200px] truncate" title={cliente}>{cliente || '—'}</td>
              <td className="px-3 py-1.5 text-xs text-slate-500 max-w-[180px] truncate" title={est}>{est || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between px-3 py-2 text-[11px] text-slate-500 border-t border-slate-100">
        <span>{Math.min(limite, filas.length)} de {filas.length} módulos</span>
        {filas.length > limite && (
          <button onClick={() => setLimite(l => l + PASO)} className="text-teal-700 hover:underline">Ver {Math.min(PASO, filas.length - limite)} más</button>
        )}
      </div>
      <SeleccionFlotante cantidad={seleccionadas.length} nombre="módulo" onLimpiar={() => setSel(new Set())}>
        <ExportarButton columnas={MODULOS_EXPORT_COLUMNS} data={seleccionadas}
          titulo="Módulos seleccionados" filename="modulos-seleccionados" />
      </SeleccionFlotante>
    </div>
  );
}
