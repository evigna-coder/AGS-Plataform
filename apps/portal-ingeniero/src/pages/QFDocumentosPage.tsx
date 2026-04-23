import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import type { QFDocumento } from '@ags/shared';
import { useAuth } from '../contexts/AuthContext';
import { qfDocumentosService } from '../services/qfDocumentosService';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import NuevoQFModal from '../components/qf-documentos/NuevoQFModal';
import NuevaVersionModal from '../components/qf-documentos/NuevaVersionModal';
import EditarQFModal from '../components/qf-documentos/EditarQFModal';
import HistorialDrawer from '../components/qf-documentos/HistorialDrawer';
import QFFilterBar from '../components/qf-documentos/QFFilterBar';
import QFList from '../components/qf-documentos/QFList';

const FILTER_SCHEMA = {
  search: { type: 'string', default: '' },
  tipo: { type: 'string', default: '' },
  familia: { type: 'string', default: '' },
  mostrarObsoletos: { type: 'boolean', default: false },
} as const;

export default function QFDocumentosPage() {
  const { hasRole } = useAuth();
  const canAccess = hasRole('admin', 'admin_ing_soporte');

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
    if (!canAccess) return;
    setLoading(true);
    unsubRef.current?.();
    unsubRef.current = qfDocumentosService.subscribe(
      (data) => { setDocs(data); setLoading(false); setError(null); },
      (err) => { console.error('Error QF:', err); setError(err.message); setLoading(false); },
    );
    return () => { unsubRef.current?.(); };
  }, [canAccess]);

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
    if (filters.tipo) {
      result = result.filter(d => d.tipo === filters.tipo);
    }
    if (filters.familia) {
      result = result.filter(d => String(d.familia) === filters.familia);
    }
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

  if (!canAccess) return <Navigate to="/leads" replace />;

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

      <div className="flex-1 min-h-0 px-3 md:px-5 pb-4 pt-3">
        {error && (
          <Card><p className="text-sm text-red-600 text-center py-4">{error}</p></Card>
        )}
        {loading && docs.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-12">Cargando QFs…</p>
        ) : filtered.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-400">No hay documentos QF {filters.search || filters.tipo || filters.familia ? 'que coincidan con los filtros.' : 'registrados aún.'}</p>
              <button onClick={() => setShowCreate(true)} className="text-teal-600 hover:underline mt-2 inline-block text-xs">
                Crear primer QF
              </button>
            </div>
          </Card>
        ) : (
          <QFList
            docs={filtered}
            onNuevaVersion={setVersionTarget}
            onHistorial={setHistorialTarget}
            onEditar={setEditTarget}
          />
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
