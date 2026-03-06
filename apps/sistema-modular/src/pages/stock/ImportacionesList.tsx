import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useImportaciones } from '../../hooks/useImportaciones';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import type { EstadoImportacion } from '@ags/shared';
import { ESTADO_IMPORTACION_LABELS, ESTADO_IMPORTACION_COLORS } from '@ags/shared';

const ESTADOS: EstadoImportacion[] = [
  'preparacion', 'embarcado', 'en_transito', 'en_aduana', 'despachado', 'recibido', 'cancelado',
];

export const ImportacionesList = () => {
  const navigate = useNavigate();
  const { importaciones, loading, loadImportaciones } = useImportaciones();
  const [estadoFilter, setEstadoFilter] = useState<string>('');
  const [sortField, setSortField] = useState('fechaEstimadaArribo');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (f: string) => {
    const s = toggleSort(f, sortField, sortDir);
    setSortField(s.field); setSortDir(s.dir);
  };

  const sorted = useMemo(() => sortByField(importaciones, sortField, sortDir), [importaciones, sortField, sortDir]);

  useEffect(() => {
    loadImportaciones(estadoFilter ? { estado: estadoFilter } : undefined);
  }, [estadoFilter]);

  const formatDate = (d?: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Importaciones"
        subtitle="Operaciones de comercio exterior"
        count={sorted.length}
        actions={
          <Button size="sm" onClick={() => navigate('/stock/importaciones/nuevo')}>
            + Nueva importacion
          </Button>
        }
      >
        <div className="flex items-center gap-2">
          <select
            value={estadoFilter}
            onChange={e => setEstadoFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todos los estados</option>
            {ESTADOS.map(e => (
              <option key={e} value={e}>{ESTADO_IMPORTACION_LABELS[e]}</option>
            ))}
          </select>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-xs text-slate-400">Cargando...</div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-xs text-slate-400">No hay importaciones registradas</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-[11px] font-medium text-slate-400 tracking-wider py-2 px-4">Numero</th>
                  <th className="text-left text-[11px] font-medium text-slate-400 tracking-wider py-2 px-4">OC</th>
                  <th className="text-left text-[11px] font-medium text-slate-400 tracking-wider py-2 px-4">Proveedor</th>
                  <th className="text-left text-[11px] font-medium text-slate-400 tracking-wider py-2 px-4">Estado</th>
                  <th className="text-left text-[11px] font-medium text-slate-400 tracking-wider py-2 px-4">Puerto destino</th>
                  <SortableHeader label="ETA" field="fechaEstimadaArribo" currentField={sortField} currentDir={sortDir} onSort={handleSort} className="text-left text-[11px] font-medium text-slate-400 tracking-wider py-2 px-4" />
                  <th className="text-right text-[11px] font-medium text-slate-400 tracking-wider py-2 px-4">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(imp => (
                  <tr key={imp.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="text-xs py-2 px-4">
                      <Link to={`/stock/importaciones/${imp.id}`} className="text-indigo-600 font-medium hover:underline">
                        {imp.numero}
                      </Link>
                    </td>
                    <td className="text-xs py-2 px-4 text-slate-700">{imp.ordenCompraNumero}</td>
                    <td className="text-xs py-2 px-4 text-slate-700">{imp.proveedorNombre}</td>
                    <td className="text-xs py-2 px-4">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_IMPORTACION_COLORS[imp.estado]}`}>
                        {ESTADO_IMPORTACION_LABELS[imp.estado]}
                      </span>
                    </td>
                    <td className="text-xs py-2 px-4 text-slate-700">{imp.puertoDestino || '-'}</td>
                    <td className="text-xs py-2 px-4 text-slate-700">{formatDate(imp.fechaEstimadaArribo)}</td>
                    <td className="text-xs py-2 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/stock/importaciones/${imp.id}`)}
                      >
                        Ver
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
