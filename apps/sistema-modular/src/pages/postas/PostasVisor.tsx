import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  POSTA_CATEGORIA_LABELS, POSTA_CATEGORIA_COLORS,
  POSTA_TIPO_ENTIDAD_LABELS,
  POSTA_ESTADO_LABELS, POSTA_ESTADO_COLORS,
  POSTA_PRIORIDAD_LABELS, POSTA_PRIORIDAD_COLORS,
} from '@ags/shared';
import type { PostaCategoria, PostaTipoEntidad, PostaEstado, PostaWorkflow } from '@ags/shared';
import { usePostas, type PostaFilters } from '../../hooks/usePostas';
import { useAuth } from '../../contexts/AuthContext';
import { usuariosService } from '../../services/firebaseService';
import type { UsuarioAGS } from '@ags/shared';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';

const ENTIDAD_ROUTES: Record<string, string> = {
  orden_compra: '/stock/ordenes-compra',
  importacion: '/stock/importaciones',
  presupuesto: '/presupuestos',
  requerimiento: '/stock/requerimientos',
  agenda: '/agenda',
};

export const PostasVisor = () => {
  const { usuario } = useAuth();
  const [soloMias, setSoloMias] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState<PostaCategoria | ''>('');
  const [filtroTipo, setFiltroTipo] = useState<PostaTipoEntidad | ''>('');
  const [filtroEstado, setFiltroEstado] = useState<PostaEstado | ''>('');
  const [filtroResponsable, setFiltroResponsable] = useState('');
  const [usuarios, setUsuarios] = useState<UsuarioAGS[]>([]);

  useEffect(() => { usuariosService.getAll().then(setUsuarios); }, []);

  const filters: PostaFilters = {
    ...(filtroCategoria ? { categoria: filtroCategoria } : {}),
    ...(filtroTipo ? { tipoEntidad: filtroTipo } : {}),
    ...(filtroEstado ? { estado: filtroEstado } : {}),
    ...(soloMias && usuario ? { responsableId: usuario.id } : {}),
    ...(filtroResponsable && !soloMias ? { responsableId: filtroResponsable } : {}),
  };
  const { postas, loading } = usePostas(filters);
  const [sortField, setSortField] = useState('fechaCreacion');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (f: string) => {
    const s = toggleSort(f, sortField, sortDir);
    setSortField(s.field); setSortDir(s.dir);
  };

  const sorted = useMemo(() => sortByField(postas, sortField, sortDir), [postas, sortField, sortDir]);

  const limpiar = () => {
    setFiltroCategoria(''); setFiltroTipo(''); setFiltroEstado('');
    setFiltroResponsable(''); setSoloMias(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando postas...</p></div>;
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader title="Visor de Postas" subtitle="Derivaciones y seguimiento de procesos" count={sorted.length}>
        <div className="flex items-center gap-3 flex-wrap">
          <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value as PostaCategoria | '')}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Todas las categorias</option>
            {Object.entries(POSTA_CATEGORIA_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as PostaTipoEntidad | '')}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Todos los tipos</option>
            {Object.entries(POSTA_TIPO_ENTIDAD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as PostaEstado | '')}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Todos los estados</option>
            {Object.entries(POSTA_ESTADO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {!soloMias && (
            <select value={filtroResponsable} onChange={e => setFiltroResponsable(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Todos los responsables</option>
              {usuarios.filter(u => u.status === 'activo').map(u => <option key={u.id} value={u.id}>{u.displayName}</option>)}
            </select>
          )}
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
            <input type="checkbox" checked={soloMias} onChange={e => setSoloMias(e.target.checked)} className="rounded border-slate-300" />
            Solo mis postas
          </label>
          <Button size="sm" variant="ghost" onClick={limpiar}>Limpiar</Button>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-y-auto px-5 pb-4">
        {sorted.length === 0 ? (
          <Card><div className="text-center py-12"><p className="text-slate-400">No se encontraron postas</p></div></Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Referencia</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Tipo</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Categoria</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Accion requerida</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Estado</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Responsable</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Prioridad</th>
                    <SortableHeader label="Fecha" field="fechaCreacion" currentField={sortField} currentDir={sortDir} onSort={handleSort} className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider" />
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sorted.map(p => <PostaRow key={p.id} posta={p} />)}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

function PostaRow({ posta }: { posta: PostaWorkflow }) {
  const entidadRoute = ENTIDAD_ROUTES[posta.tipoEntidad];
  const entidadLink = entidadRoute && posta.tipoEntidad !== 'agenda'
    ? `${entidadRoute}/${posta.entidadId}`
    : entidadRoute;

  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-4 py-2 text-xs">
        {entidadLink ? (
          <Link to={entidadLink} className="text-indigo-600 hover:text-indigo-800 font-medium">{posta.entidadNumero}</Link>
        ) : (
          <span className="font-medium text-slate-700">{posta.entidadNumero}</span>
        )}
        <p className="text-[10px] text-slate-400 truncate max-w-[180px]">{posta.entidadDescripcion}</p>
      </td>
      <td className="px-4 py-2 text-xs">
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
          {POSTA_TIPO_ENTIDAD_LABELS[posta.tipoEntidad]}
        </span>
      </td>
      <td className="px-4 py-2 text-xs">
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${POSTA_CATEGORIA_COLORS[posta.categoria]}`}>
          {POSTA_CATEGORIA_LABELS[posta.categoria]}
        </span>
      </td>
      <td className="px-4 py-2 text-xs text-slate-700 max-w-[200px] truncate">{posta.accionRequerida}</td>
      <td className="px-4 py-2 text-xs">
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${POSTA_ESTADO_COLORS[posta.estado]}`}>
          {POSTA_ESTADO_LABELS[posta.estado]}
        </span>
      </td>
      <td className="px-4 py-2 text-xs text-slate-700">{posta.responsableNombre}</td>
      <td className="px-4 py-2 text-xs">
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${POSTA_PRIORIDAD_COLORS[posta.prioridad]}`}>
          {POSTA_PRIORIDAD_LABELS[posta.prioridad]}
        </span>
      </td>
      <td className="px-4 py-2 text-xs text-slate-500">
        {new Date(posta.fechaCreacion).toLocaleDateString('es-AR')}
      </td>
      <td className="px-4 py-2 text-xs">
        <Link to={`/postas/${posta.id}`}>
          <Button size="sm" variant="ghost">Ver</Button>
        </Link>
      </td>
    </tr>
  );
}
