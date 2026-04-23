import type { QFDocumento, QFEstado } from '@ags/shared';

interface Props {
  docs: QFDocumento[];
  onNuevaVersion: (d: QFDocumento) => void;
  onHistorial: (d: QFDocumento) => void;
  onEditar: (d: QFDocumento) => void;
}

const ESTADO_BADGE: Record<QFEstado, string> = {
  vigente: 'bg-teal-50 text-teal-700 border border-teal-200',
  obsoleto: 'bg-slate-100 text-slate-500 border border-slate-200',
};

function formatFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' });
  } catch {
    return iso;
  }
}

export default function QFList({ docs, onNuevaVersion, onHistorial, onEditar }: Props) {
  return (
    <>
      {/* Mobile cards (< md) */}
      <div className="md:hidden space-y-2">
        {docs.map(d => (
          <div key={d.id} className="bg-white rounded-xl border border-slate-200 p-3">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="min-w-0">
                <p className="text-xs font-mono font-semibold text-teal-700">{d.numeroCompleto}.{d.versionActual}</p>
                <p className="text-sm text-slate-800 truncate">{d.nombre}</p>
              </div>
              <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_BADGE[d.estado]}`}>
                {d.estado === 'vigente' ? 'Vigente' : 'Obsoleto'}
              </span>
            </div>
            {d.descripcion && <p className="text-[11px] text-slate-500 line-clamp-2 mb-2">{d.descripcion}</p>}
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-2">
              <span>{formatFecha(d.fechaUltimaActualizacion)}</span>
              <span className="truncate ml-2">{d.ultimoUsuarioNombre || d.ultimoUsuarioEmail}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={() => onNuevaVersion(d)} className="text-[10px] font-medium text-teal-600 hover:text-teal-800 px-1.5 py-0.5 rounded hover:bg-teal-50">Nueva versión</button>
              <button onClick={() => onHistorial(d)} className="text-[10px] font-medium text-slate-600 hover:text-slate-800 px-1.5 py-0.5 rounded hover:bg-slate-100">Historial</button>
              <button onClick={() => onEditar(d)} className="text-[10px] font-medium text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded hover:bg-slate-100 ml-auto">Editar</button>
            </div>
          </div>
        ))}
      </div>

      {/* Tablet / small notebook (md–lg): card-style rows */}
      <div className="hidden md:block lg:hidden space-y-2">
        {docs.map(d => (
          <div key={d.id} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-1.5">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-mono font-semibold text-teal-700">{d.numeroCompleto}.{d.versionActual}</p>
                <p className="text-sm font-medium text-slate-800 truncate">{d.nombre}</p>
                {d.descripcion && <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{d.descripcion}</p>}
              </div>
              <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_BADGE[d.estado]}`}>
                {d.estado === 'vigente' ? 'Vigente' : 'Obsoleto'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-2">
              <span>{formatFecha(d.fechaUltimaActualizacion)}</span>
              <span className="truncate ml-2 max-w-[60%]">{d.ultimoUsuarioNombre || d.ultimoUsuarioEmail}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={() => onNuevaVersion(d)} className="text-[11px] font-medium text-teal-600 hover:text-teal-800 px-2 py-1 rounded hover:bg-teal-50">Nueva versión</button>
              <button onClick={() => onHistorial(d)} className="text-[11px] font-medium text-slate-600 hover:text-slate-800 px-2 py-1 rounded hover:bg-slate-100">Historial</button>
              <button onClick={() => onEditar(d)} className="text-[11px] font-medium text-slate-400 hover:text-slate-600 px-2 py-1 rounded hover:bg-slate-100 ml-auto">Editar</button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table (lg+): fixed widths + horizontal scroll fallback */}
      <div className="hidden lg:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-auto">
        <table className="w-full table-fixed min-w-[920px]">
          <colgroup>
            <col className="w-[120px]" />
            <col />
            <col className="w-[90px]" />
            <col className="w-[100px]" />
            <col className="w-[170px]" />
            <col className="w-[240px]" />
          </colgroup>
          <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
            <tr>
              <th className="px-3 py-2 text-left text-[10px] font-mono uppercase tracking-wider text-slate-500">Número</th>
              <th className="px-3 py-2 text-left text-[10px] font-mono uppercase tracking-wider text-slate-500">Nombre</th>
              <th className="px-3 py-2 text-left text-[10px] font-mono uppercase tracking-wider text-slate-500">Estado</th>
              <th className="px-3 py-2 text-left text-[10px] font-mono uppercase tracking-wider text-slate-500">Actualizado</th>
              <th className="px-3 py-2 text-left text-[10px] font-mono uppercase tracking-wider text-slate-500">Usuario</th>
              <th className="px-3 py-2 text-right text-[10px] font-mono uppercase tracking-wider text-slate-500">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {docs.map(d => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-mono text-xs font-semibold text-teal-700 truncate" title={`${d.numeroCompleto}.${d.versionActual}`}>
                  {d.numeroCompleto}.{d.versionActual}
                </td>
                <td className="px-3 py-2 text-xs text-slate-800 min-w-0">
                  <div className="font-medium truncate" title={d.nombre}>{d.nombre}</div>
                  {d.descripcion && <div className="text-[10px] text-slate-400 truncate" title={d.descripcion}>{d.descripcion}</div>}
                </td>
                <td className="px-3 py-2">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_BADGE[d.estado]}`}>
                    {d.estado === 'vigente' ? 'Vigente' : 'Obsoleto'}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-slate-500 truncate">{formatFecha(d.fechaUltimaActualizacion)}</td>
                <td className="px-3 py-2 text-xs text-slate-500 truncate" title={d.ultimoUsuarioEmail}>
                  {d.ultimoUsuarioNombre || d.ultimoUsuarioEmail}
                </td>
                <td className="px-2 py-2 text-right whitespace-nowrap">
                  <button onClick={() => onNuevaVersion(d)} className="text-[10px] font-medium text-teal-600 hover:text-teal-800 px-1.5 py-0.5 rounded hover:bg-teal-50 mr-1">Nueva versión</button>
                  <button onClick={() => onHistorial(d)} className="text-[10px] font-medium text-slate-600 hover:text-slate-800 px-1.5 py-0.5 rounded hover:bg-slate-100 mr-1">Historial</button>
                  <button onClick={() => onEditar(d)} className="text-[10px] font-medium text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded hover:bg-slate-100">Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
