import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { Cliente, Sistema, CategoriaEquipo, Establecimiento } from '@ags/shared';
import { sistemasService } from '../../services/firebaseService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { MoveSistemaModal } from '../equipos/MoveSistemaModal';
import { CreateEquipoModal } from '../equipos/CreateEquipoModal';
import { CreateEstablecimientoModal } from '../establecimientos/CreateEstablecimientoModal';
import { PendientesClienteSection } from '../pendientes/PendientesClienteSection';
import { SistemaExpandableRow } from '../equipos/SistemaExpandableRow';
import { SistemasSearchBox } from '../equipos/SistemasSearchBox';
import { useSistemasSearch } from '../../hooks/useSistemasSearch';
import { useConfirm } from '../ui/ConfirmDialog';

interface ClienteMainContentProps {
  clienteId: string;
  cliente: Cliente;
  sistemas: Sistema[];
  establecimientos: Establecimiento[];
  categorias: CategoriaEquipo[];
  editing: boolean;
  formData: any;
  setFormData: (data: any) => void;
  onRefresh?: () => void;
}

const ChevronRight = () => (
  <svg className="w-4 h-4 text-slate-300 shrink-0 ml-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

export const ClienteMainContent = ({
  clienteId, cliente, sistemas, establecimientos, categorias, editing, formData, setFormData, onRefresh,
}: ClienteMainContentProps) => {
  const confirm = useConfirm();
  const { pathname } = useLocation();
  const [selectedSistemaIds, setSelectedSistemaIds] = useState<Set<string>>(new Set());
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showCreateEst, setShowCreateEst] = useState(false);
  const [showCreateEquipo, setShowCreateEquipo] = useState(false);
  // Deduplicar sistemas por ID (pueden venir duplicados por consultas legacy)
  const uniqueSistemas = sistemas.filter((s, i, arr) => arr.findIndex(x => x.id === s.id) === i);

  const {
    query, setQuery,
    filtered: filteredSistemas,
    matchedViaModulo,
    matchedModuloIds,
    isSearching,
    modulosBySistema,
    loadingModulos,
  } = useSistemasSearch(uniqueSistemas, categorias);

  return (
    <div className="flex-1 min-w-0 space-y-4">
      {/* Establecimientos */}
      <Card compact>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase">Establecimientos</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowCreateEst(true)}>+ Agregar</Button>
            <Link to={`/establecimientos?cliente=${clienteId}`}>
              <Button variant="ghost" size="sm">Ver todos</Button>
            </Link>
          </div>
        </div>
        {establecimientos.length > 0 ? (
          <div className="space-y-1.5">
            {establecimientos.map((est) => (
              <Link
                key={est.id}
                to={`/establecimientos/${est.id}`}
                state={{ from: pathname }}
                className="flex justify-between items-center px-3 py-2 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-900 truncate">{est.nombre}</p>
                  <p className="text-[11px] text-slate-400 truncate">{est.direccion}, {est.localidad}</p>
                </div>
                <ChevronRight />
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-slate-400 text-xs mb-2">Sin establecimientos</p>
            <Button variant="outline" size="sm" onClick={() => setShowCreateEst(true)}>+ Agregar</Button>
          </div>
        )}
      </Card>

      {/* Sistemas / Equipos — expandibles con módulos */}
      <Card compact>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase">Sistemas / Equipos</h3>
          <div className="flex gap-2">
            {selectedSistemaIds.size > 0 && (
              <>
                <Button variant="outline" size="sm" className="text-amber-600 border-amber-300 hover:bg-amber-50" onClick={() => setShowMoveModal(true)}>
                  Mover {selectedSistemaIds.size > 1 ? `(${selectedSistemaIds.size})` : ''}
                </Button>
                <Button variant="outline" size="sm" className="text-red-600 border-red-300 hover:bg-red-50" onClick={async () => {
                  const count = selectedSistemaIds.size;
                  if (!await confirm(`¿Eliminar ${count} sistema${count > 1 ? 's' : ''} permanentemente? Esta acción no se puede deshacer.`)) return;
                  for (const sId of selectedSistemaIds) {
                    await sistemasService.delete(sId);
                  }
                  setSelectedSistemaIds(new Set());
                  onRefresh?.();
                }}>
                  Eliminar {selectedSistemaIds.size > 1 ? `(${selectedSistemaIds.size})` : ''}
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowCreateEquipo(true)}>+ Agregar</Button>
            <Link to={`/equipos?cliente=${clienteId}`}>
              <Button variant="ghost" size="sm">Ver todos</Button>
            </Link>
          </div>
        </div>
        {uniqueSistemas.length > 0 && (
          <div className="mb-2">
            <SistemasSearchBox
              value={query}
              onChange={setQuery}
              resultCount={filteredSistemas.length}
              totalCount={uniqueSistemas.length}
              loading={loadingModulos}
            />
          </div>
        )}
        {uniqueSistemas.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-slate-400 text-xs mb-2">Sin sistemas registrados</p>
            <Button variant="outline" size="sm" onClick={() => setShowCreateEquipo(true)}>+ Agregar</Button>
          </div>
        ) : filteredSistemas.length === 0 ? (
          <p className="text-slate-400 text-xs text-center py-4">Sin resultados para "{query}"</p>
        ) : (
          <div className="space-y-1.5">
            {filteredSistemas.map((sistema) => (
              <SistemaExpandableRow
                key={sistema.id}
                sistema={sistema}
                establecimientos={establecimientos}
                categorias={categorias}
                modulos={modulosBySistema[sistema.id]}
                forceOpen={isSearching && matchedViaModulo.has(sistema.id)}
                matchedModuloIds={matchedModuloIds}
                selected={selectedSistemaIds.has(sistema.id)}
                onToggle={(sys) => {
                  setSelectedSistemaIds(prev => {
                    const next = new Set(prev);
                    if (next.has(sys.id)) next.delete(sys.id); else next.add(sys.id);
                    return next;
                  });
                }}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Pendientes del cliente */}
      <PendientesClienteSection
        clienteId={clienteId}
        clienteNombre={cliente.razonSocial}
        title="Pendientes del cliente"
      />

      {/* Notas */}
      <Card compact>
        <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3">Notas</h3>
        {editing ? (
          <textarea
            value={formData?.notas || ''}
            onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
            rows={3}
            className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none"
            placeholder="Notas internas sobre este cliente..."
          />
        ) : (
          <p className="text-xs text-slate-600 whitespace-pre-wrap">
            {cliente.notas || 'Sin notas'}
          </p>
        )}
      </Card>

      {showMoveModal && selectedSistemaIds.size > 0 && (
        <MoveSistemaModal
          sistemas={uniqueSistemas.filter(s => selectedSistemaIds.has(s.id))}
          clienteCuit={clienteId}
          onClose={() => setShowMoveModal(false)}
          onMoved={() => { setShowMoveModal(false); setSelectedSistemaIds(new Set()); onRefresh?.(); }}
        />
      )}

      <CreateEstablecimientoModal
        open={showCreateEst}
        onClose={() => setShowCreateEst(false)}
        onCreated={() => onRefresh?.()}
        preselectedClienteId={clienteId}
      />

      <CreateEquipoModal
        open={showCreateEquipo}
        onClose={() => setShowCreateEquipo(false)}
        onCreated={() => onRefresh?.()}
        defaultClienteId={clienteId}
      />
    </div>
  );
};
