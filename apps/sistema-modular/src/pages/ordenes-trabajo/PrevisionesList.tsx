import { useEffect, useMemo, useState } from 'react';
import type { AgendaPrevision, Ingeniero } from '@ags/shared';
import { previsionesService } from '../../services/previsionesService';
import { getResponsablesOT } from '../../services/personalService';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { OTTabs, type OTTabId } from '../../components/ordenes-trabajo/OTTabs';
import { CreateOTModal } from '../../components/ordenes-trabajo/CreateOTModal';
import { PrevisionesTable } from '../../components/previsiones/PrevisionesTable';
import { PrevisionesFiltersBar } from '../../components/previsiones/PrevisionesFiltersBar';
import { GenerarPrevisionesButton } from '../../components/previsiones/GenerarPrevisionesButton';
import { ReprogramarPrevisionModal } from '../../components/previsiones/ReprogramarPrevisionModal';

const anioActual = new Date().getFullYear();

// `tab` NO va en este schema a propósito: `resetFilters` borra todas las claves del
// schema, y si incluyera `tab` el botón "Limpiar" te sacaría de la pestaña.
const FILTER_SCHEMA = {
  anio: { type: 'string' as const, default: String(anioActual + 1) },
  ingenieroId: { type: 'string' as const, default: '' },
  estado: { type: 'string' as const, default: '' },
  busqueda: { type: 'string' as const, default: '' },
};

/** Años ofrecidos en el filtro: el anterior, el actual y los dos siguientes. */
const ANIOS = [anioActual - 1, anioActual, anioActual + 1, anioActual + 2];

interface Props {
  onTabChange: (tab: OTTabId) => void;
}

/**
 * Pestaña "Previsiones" del módulo Órdenes de Trabajo: servicios regulatorios de
 * vigencia anual con el lugar ya reservado en la agenda del año siguiente, todavía
 * SIN OT abierta. Viven en `agendaPrevisiones` para no ensuciar la agenda real.
 */
export const PrevisionesList: React.FC<Props> = ({ onTabChange }) => {
  const confirm = useConfirm();
  const [filters, setFilter, , resetFilters] = useUrlFilters(FILTER_SCHEMA);
  const anio = Number(filters.anio) || anioActual + 1;

  const [previsiones, setPrevisiones] = useState<AgendaPrevision[]>([]);
  const [ingenieros, setIngenieros] = useState<Ingeniero[]>([]);
  const [loading, setLoading] = useState(true);
  const [reprogramar, setReprogramar] = useState<AgendaPrevision | null>(null);
  const [convertir, setConvertir] = useState<AgendaPrevision | null>(null);

  useEffect(() => {
    getResponsablesOT().then(setIngenieros).catch(err =>
      console.warn('[PrevisionesList] no se pudieron cargar los ingenieros:', err));
  }, []);

  useEffect(() => {
    setLoading(true);
    const unsub = previsionesService.subscribe(anio, items => {
      setPrevisiones(items);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [anio]);

  const visibles = useMemo(() => {
    const q = filters.busqueda.trim().toLowerCase();
    return previsiones.filter(p => {
      if (filters.ingenieroId && p.ingenieroId !== filters.ingenieroId) return false;
      if (filters.estado && p.estado !== filters.estado) return false;
      if (!q) return true;
      return [
        p.clienteNombre, p.tipoServicio, p.sistemaNombre, p.establecimientoNombre,
        p.equipoModelo, p.equipoAgsId, p.origenOtNumber, p.otNumberGenerada, p.ingenieroNombre,
      ].some(v => (v || '').toLowerCase().includes(q));
    });
  }, [previsiones, filters.ingenieroId, filters.estado, filters.busqueda]);

  const handleDescartar = async (p: AgendaPrevision) => {
    if (!await confirm(`¿Descartar la previsión de ${p.clienteNombre} (${p.tipoServicio})?`)) return;
    try { await previsionesService.descartar(p.id); }
    catch { alert('Error al descartar la previsión'); }
  };

  const handleConvertida = async (otNumber?: string) => {
    const p = convertir;
    setConvertir(null);
    if (!p || !otNumber) return;
    try { await previsionesService.marcarConvertida(p.id, otNumber); }
    catch (err) {
      console.error('Error marcando la previsión como convertida:', err);
      alert(`La OT ${otNumber} se creó, pero no se pudo marcar la previsión como convertida.`);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Órdenes de Trabajo"
        count={loading ? undefined : visibles.length}
        actions={<GenerarPrevisionesButton anioOrigen={anio - 1} />}
      >
        <div className="space-y-3">
          <OTTabs tab="previsiones" onChange={onTabChange} />
          <div className="pt-3">
            <PrevisionesFiltersBar
              filters={filters}
              setFilter={setFilter as (key: string, value: string) => void}
              resetFilters={resetFilters}
              anios={ANIOS}
              ingenieros={ingenieros}
            />
          </div>
        </div>
      </PageHeader>

      <div className="flex-1 min-h-0 flex flex-col px-5 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-slate-400">Cargando previsiones...</p>
          </div>
        ) : visibles.length === 0 ? (
          <EmptyState message={
            previsiones.length === 0
              ? `No hay previsiones para ${anio}. Generalas desde los servicios completados en ${anio - 1}.`
              : 'Ninguna previsión coincide con los filtros.'
          } />
        ) : (
          <PrevisionesTable
            previsiones={visibles}
            onConvertir={setConvertir}
            onReprogramar={setReprogramar}
            onDescartar={handleDescartar}
          />
        )}
      </div>

      <ReprogramarPrevisionModal
        prevision={reprogramar}
        ingenieros={ingenieros}
        onClose={() => setReprogramar(null)}
        onSaved={() => {}}
      />

      {convertir && (
        <CreateOTModal
          key={convertir.id}
          open
          onClose={() => setConvertir(null)}
          onCreated={handleConvertida}
          prefill={{
            clienteId: convertir.clienteId ?? undefined,
            establecimientoId: convertir.establecimientoId ?? undefined,
            sistemaId: convertir.sistemaId ?? undefined,
            moduloId: convertir.moduloId ?? undefined,
            tipoServicioId: convertir.tipoServicioId ?? undefined,
            ingenieroId: convertir.ingenieroId || undefined,
            fechaServicioAprox: convertir.fechaInicio,
          }}
        />
      )}
    </div>
  );
};
