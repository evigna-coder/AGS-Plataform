import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { Sistema, CategoriaEquipo, Establecimiento, ModuloSistema } from '@ags/shared';
import { modulosService } from '../../services/firebaseService';

interface Props {
  sistema: Sistema;
  establecimientos?: Establecimiento[];
  categorias?: CategoriaEquipo[];
  /** Si se pasa, el row no fetch-ea: usa estos módulos (parent ya los precargó). */
  modulos?: ModuloSistema[];
  /** Fuerza el row abierto (típicamente desde búsqueda con match en módulo). */
  forceOpen?: boolean;
  /** IDs de módulos que matchearon la búsqueda — se resaltan. */
  matchedModuloIds?: Set<string>;
  selected?: boolean;
  onToggle?: (s: Sistema) => void;
  /** Mostrar checkbox para selección múltiple. */
  showCheckbox?: boolean;
}

const ChevronDown = ({ open }: { open: boolean }) => (
  <svg
    className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
  </svg>
);

export function SistemaExpandableRow({
  sistema,
  establecimientos,
  categorias,
  modulos: modulosProp,
  forceOpen,
  matchedModuloIds,
  selected,
  onToggle,
  showCheckbox = true,
}: Props) {
  const { pathname } = useLocation();
  const [userOpen, setUserOpen] = useState(false);
  const [modulos, setModulos] = useState<ModuloSistema[]>(modulosProp ?? []);
  const [loadingModulos, setLoadingModulos] = useState(false);

  const open = userOpen || !!forceOpen;
  const usingProp = modulosProp !== undefined;

  useEffect(() => {
    if (usingProp) {
      setModulos(modulosProp ?? []);
    }
  }, [usingProp, modulosProp]);

  useEffect(() => {
    if (usingProp || !open || modulos.length > 0) return;
    setLoadingModulos(true);
    modulosService
      .getBySistema(sistema.id)
      .then((m) => setModulos(m))
      .catch((err) => console.error('Error cargando módulos:', err))
      .finally(() => setLoadingModulos(false));
  }, [usingProp, open, sistema.id]);

  const categoria = categorias?.find((c) => c.id === sistema.categoriaId);
  const est = sistema.establecimientoId
    ? establecimientos?.find((e) => e.id === sistema.establecimientoId)
    : null;

  return (
    <div className="bg-slate-50 rounded-lg border border-slate-100">
      <div className="flex items-center gap-1.5">
        {showCheckbox && onToggle && (
          <input
            type="checkbox"
            checked={!!selected}
            onChange={() => onToggle(sistema)}
            className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 shrink-0 ml-2"
          />
        )}
        <button
          onClick={() => setUserOpen((v) => !v)}
          className="flex-1 flex justify-between items-center px-3 py-2 hover:bg-slate-100 transition-colors rounded-lg text-left"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs font-medium text-slate-900 truncate">{sistema.nombre}</p>
              {sistema.sector && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-600">
                  {sistema.sector}
                </span>
              )}
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                  sistema.activo ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-400'
                }`}
              >
                {sistema.activo ? 'Activo' : 'Inactivo'}
              </span>
              {sistema.enContrato && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                  Contrato
                </span>
              )}
            </div>
            <div className="flex gap-2 text-[11px] text-slate-400 truncate">
              {est && <span>{est.nombre}</span>}
              {categoria && <span>· {categoria.nombre}</span>}
              {sistema.codigoInternoCliente && <span>· {sistema.codigoInternoCliente}</span>}
              {sistema.agsVisibleId && <span>· {sistema.agsVisibleId}</span>}
            </div>
          </div>
          <ChevronDown open={open} />
        </button>
        <Link
          to={`/equipos/${sistema.id}`}
          state={{ from: pathname }}
          className="shrink-0 px-2 py-2 text-[10px] font-medium text-teal-600 hover:text-teal-800 hover:bg-teal-50 rounded mr-1"
          title="Ver detalle del sistema"
        >
          Ver
        </Link>
      </div>

      {open && (
        <div className="px-3 pb-2.5">
          {loadingModulos ? (
            <p className="text-[11px] text-slate-400 py-2">Cargando módulos...</p>
          ) : modulos.length === 0 ? (
            <p className="text-[11px] text-slate-400 py-2">Sin módulos registrados</p>
          ) : (
            <table className="w-full mt-1">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-center text-[10px] font-medium text-slate-400 py-1 pr-2">Código</th>
                  <th className="text-center text-[10px] font-medium text-slate-400 py-1 pr-2">Descripción</th>
                  <th className="text-center text-[10px] font-medium text-slate-400 py-1 pr-2">Serie</th>
                  <th className="text-center text-[10px] font-medium text-slate-400 py-1 pr-2">Firmware</th>
                  <th className="text-center text-[10px] font-medium text-slate-400 py-1">Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {modulos.map((m) => {
                  const matched = matchedModuloIds?.has(m.id);
                  return (
                    <tr
                      key={m.id}
                      className={`border-b border-slate-100 last:border-0 ${
                        matched ? 'bg-amber-50/60' : ''
                      }`}
                    >
                      <td className="text-[11px] font-mono text-slate-700 py-1.5 pr-2 whitespace-nowrap">
                        {m.nombre || '—'}
                      </td>
                      <td
                        className="text-[11px] text-slate-600 py-1.5 pr-2 truncate max-w-[180px]"
                        title={m.descripcion}
                      >
                        {m.descripcion || '—'}
                      </td>
                      <td className="text-[11px] font-mono text-slate-600 py-1.5 pr-2 whitespace-nowrap">
                        {m.serie || '—'}
                      </td>
                      <td className="text-[11px] text-slate-600 py-1.5 pr-2 whitespace-nowrap">
                        {m.firmware || '—'}
                      </td>
                      <td
                        className="text-[11px] text-slate-500 py-1.5 truncate max-w-[150px]"
                        title={m.observaciones}
                      >
                        {m.observaciones || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
