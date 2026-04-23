import { useEffect, useMemo, useRef, useState } from 'react';
import type { QFDocumento, QFEstado } from '@ags/shared';
import { qfDocumentosService } from '../../services/qfDocumentosService';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { NuevoQFModal } from '../../components/qf-documentos/NuevoQFModal';
import { NuevaVersionModal } from '../../components/qf-documentos/NuevaVersionModal';
import { EditarQFModal } from '../../components/qf-documentos/EditarQFModal';
import { HistorialDrawer } from '../../components/qf-documentos/HistorialDrawer';
import { QFFilterBar } from '../../components/qf-documentos/QFFilterBar';

const FILTER_SCHEMA = {
  search: { type: 'string', default: '' },
  tipo: { type: 'string', default: '' },
  familia: { type: 'string', default: '' },
  mostrarObsoletos: { type: 'boolean', default: false },
} as const;

function formatFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' });
  } catch {
    return iso;
  }
}

const ESTADO_BADGE: Record<QFEstado, string> = {
  vigente: 'bg-teal-50 text-teal-700 border border-teal-200',
  obsoleto: 'bg-slate-100 text-slate-500 border border-slate-200',
};

export function QFDocumentosList() {
  const [docs, setDocs] = useState<QFDocumento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilter] = useUrlFilters(FILTER_SCHEMA);

  const [showCreate, setShowCreate] = useState(false);
  const [versionTarget, setVersionTarget] = useState<QFDocumento | null>(null);
  const [editTarget, setEditTarget] = useState<QFDocumento | null>(null);
  const [historialTarget, setHistorialTarget] = useState<QFDocumento | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setLoading(true);
    unsubRef.current?.();
    unsubRef.current = qfDocumentosService.subscribe(
      (data) => { setDocs(data); setLoading(false); setError(null); },
      (err) => { console.error('Error QF:', err); setError(err.message); setLoading(false); },
    );
    return () => { unsubRef.current?.(); };
  }, []);

  const familias = useMemo(() => {
    const set = new Set<number>();
    docs.forEach(d => set.add(d.familia));
    return Array.from(set).sort((a, b) => a - b);
  }, [docs]);

  const filtered = useMemo(() => {
    let result = docs;
    if (!filters.mostrarObsoletos) {
      result = result.filter(d => d.estado === 'vigente');
    }
    if (filters.tipo) result = result.filter(d => d.tipo === filters.tipo);
    if (filters.familia) result = result.filter(d => String(d.familia) === filters.familia);
    if (filters.search.trim()) {
      const q = filters.search.toLowerCase();
      result = result.filter(d =>
        d.numeroCompleto.toLowerCase().includes(q) ||
        d.nombre.toLowerCase().includes(q) ||
        (d.descripcion || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [docs, filters]);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Documentos QF"
        count={filtered.length}
        actions={<Button size="sm" onClick={() => setShowCreate(true)}>+ Nuevo QF</Button>}
      >
        <QFFilterBar
          search={filters.search}
          tipo={filters.tipo}
          familia={filters.familia}
          mostrarObsoletos={filters.mostrarObsoletos}
          familias={familias}
          onChange={{
            search: (v) => setFilter('search', v),
            tipo: (v) => setFilter('tipo', v),
            familia: (v) => setFilter('familia', v),
            mostrarObsoletos: (v) => setFilter('mostrarObsoletos', v),
          }}
        />
      </PageHeader>

      <div className="flex-1 min-h-0 px-5 pb-4 pt-3 overflow-y-auto">
        {error && (
          <Card><p className="text-sm text-red-600 text-center py-4">{error}</p></Card>
        )}
        {loading && docs.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-12">Cargando QFs…</p>
        ) : filtered.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-400">
                No hay documentos QF {filters.search || filters.tipo || filters.familia ? 'que coincidan con los filtros.' : 'registrados aún.'}
              </p>
              <button onClick={() => setShowCreate(true)} className="text-teal-700 hover:underline mt-2 inline-block text-xs">
                Crear primer QF
              </button>
            </div>
          </Card>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <table className="w-full">
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
                {filtered.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono text-xs font-semibold text-teal-700 whitespace-nowrap">
                      {d.numeroCompleto}.{d.versionActual}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-800">
                      <div className="font-medium">{d.nombre}</div>
                      {d.descripcion && <div className="text-[10px] text-slate-400 line-clamp-1">{d.descripcion}</div>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_BADGE[d.estado]}`}>
                        {d.estado === 'vigente' ? 'Vigente' : 'Obsoleto'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{formatFecha(d.fechaUltimaActualizacion)}</td>
                    <td className="px-3 py-2 text-xs text-slate-500 truncate max-w-[160px]" title={d.ultimoUsuarioEmail}>
                      {d.ultimoUsuarioNombre || d.ultimoUsuarioEmail}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button onClick={() => setVersionTarget(d)} className="text-[10px] font-medium text-teal-700 hover:text-teal-800 px-1.5 py-0.5 rounded hover:bg-teal-50 mr-1">Nueva versión</button>
                      <button onClick={() => setHistorialTarget(d)} className="text-[10px] font-medium text-slate-600 hover:text-slate-800 px-1.5 py-0.5 rounded hover:bg-slate-100 mr-1">Historial</button>
                      <button onClick={() => setEditTarget(d)} className="text-[10px] font-medium text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded hover:bg-slate-100">Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <NuevoQFModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          onCreated={() => setShowCreate(false)}
        />
      )}
      {versionTarget && (
        <NuevaVersionModal
          qf={versionTarget}
          onClose={() => setVersionTarget(null)}
          onSuccess={() => setVersionTarget(null)}
        />
      )}
      {editTarget && (
        <EditarQFModal
          qf={editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={() => setEditTarget(null)}
        />
      )}
      {historialTarget && (
        <HistorialDrawer qf={historialTarget} onClose={() => setHistorialTarget(null)} />
      )}
    </div>
  );
}
