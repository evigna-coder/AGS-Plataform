import { useMemo, useRef, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { AsignarItemsPanel } from './AsignarItemsPanel';
import { IngenieroDropZone } from './IngenieroDropZone';
import { InventarioIngenieroModal } from './InventarioIngenieroModal';
import { InventarioIngenieroInline } from './InventarioIngenieroInline';
import { ConfirmarAsignacionModal } from './ConfirmarAsignacionModal';
import { useAsignacionRapida, type DragPayload } from '../../hooks/useAsignacionRapida';

interface Props {
  open: boolean;
  onClose: () => void;
  /** IST sugerido como destino ("+ Asignar" desde su card): se lista primero. */
  ingenieroDestacadoId?: string | null;
}

/**
 * Modal "Asignar material" (rediseño 2026-08-11): la UI de asignación rápida
 * (tabs + drag & drop hacia los IST) movida adentro de un modal ancho — la
 * página principal pasó a ser la vista de material por ingeniero. La lógica es
 * la misma de siempre: vive intacta en useAsignacionRapida.
 *
 * Montar solo cuando está abierto (`{open && <AsignarMaterialModal …/>}`) para
 * que el hook cargue los catálogos recién al abrir.
 */
export const AsignarMaterialModal = ({ open, onClose, ingenieroDestacadoId }: Props) => {
  const {
    loading, saving, cart, tab, setTab, searchQuery, setSearchQuery,
    ingenieros, clientes, observaciones, setObservaciones,
    proveedores, transportistaId, transportista, setTransportistaSeleccion,
    filteredUnits, filteredMinikits, filteredInstrumentos, filteredDispositivos, filteredVehiculos,
    filteredPatrones, filteredColumnas,
    cartByIngeniero, assignToIngeniero, setIngenieroCliente,
    removeFromCart, updateCartItem, handleConfirm, loadData,
  } = useAsignacionRapida();

  const dragRef = useRef<DragPayload | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [inventarioIngId, setInventarioIngId] = useState<string | null>(null);
  /** Confirmar abre el paso del remito de salida (transportista). */
  const [confirmOpen, setConfirmOpen] = useState(false);
  /** Vista rápida inline del inventario: click en el nombre despliega. */
  const [expandedIngId, setExpandedIngId] = useState<string | null>(null);

  const clienteOpts = [{ value: '', label: 'Sin cliente' }, ...Object.values(
    clientes.filter(c => c.cuit).reduce<Record<string, { value: string; label: string }>>((acc, c) => {
      if (!acc[c.cuit!]) acc[c.cuit!] = { value: c.cuit!, label: c.razonSocial };
      return acc;
    }, {})
  )];

  /** El IST desde cuya card se abrió el modal va primero en la lista. */
  const ingenierosOrdenados = useMemo(() => {
    if (!ingenieroDestacadoId) return ingenieros;
    return [...ingenieros].sort((a, b) =>
      a.id === ingenieroDestacadoId ? -1 : b.id === ingenieroDestacadoId ? 1 : 0);
  }, [ingenieros, ingenieroDestacadoId]);

  const startDrag = (payload: DragPayload) => (e: React.DragEvent) => {
    dragRef.current = payload;
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', payload.label);
  };

  const handleDrop = (ingId: string, ingNombre: string) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverId(null);
    if (dragRef.current) {
      assignToIngeniero(ingId, ingNombre, dragRef.current);
      dragRef.current = null;
    }
  };

  const handleDragOver = (ingId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverId(ingId);
  };

  const ingenieroCount = Object.keys(cartByIngeniero).length;

  return (
    <>
      <Modal open={open} onClose={onClose} title="Asignar material"
        subtitle="Arrastre items hacia los ingenieros" maxWidth="2xl">
        {loading ? (
          <div className="h-[65vh] flex items-center justify-center"><p className="text-xs text-slate-400">Cargando...</p></div>
        ) : (
          <div className="flex gap-4 h-[65vh]">
            <AsignarItemsPanel
              tab={tab} setTab={setTab} searchQuery={searchQuery} setSearchQuery={setSearchQuery}
              filteredUnits={filteredUnits} filteredMinikits={filteredMinikits}
              filteredInstrumentos={filteredInstrumentos} filteredPatrones={filteredPatrones}
              filteredColumnas={filteredColumnas} filteredDispositivos={filteredDispositivos}
              filteredVehiculos={filteredVehiculos} startDrag={startDrag}
            />

            {/* ═══ Right: engineer drop-zones ═══ */}
            <div className="flex-[2] flex flex-col min-w-0 bg-white border border-slate-200 rounded-xl p-3 overflow-hidden">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Ingenieros — arrastre items aquí
              </p>

              <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                {ingenierosOrdenados.map(ing => {
                  const group = cartByIngeniero[ing.id];
                  const count = group?.items.length ?? 0;
                  return (
                    <IngenieroDropZone key={ing.id}
                      nombre={ing.nombre} count={count} isOver={dragOverId === ing.id}
                      clienteId={group?.clienteId ?? ''}
                      clienteOpts={clienteOpts}
                      onClienteChange={val => setIngenieroCliente(ing.id, val)}
                      onDrop={handleDrop(ing.id, ing.nombre)}
                      onDragOver={handleDragOver(ing.id)}
                      onDragLeave={() => setDragOverId(null)}
                      items={group?.items ?? []}
                      onRemove={removeFromCart}
                      onTogglePerm={(id, val) => updateCartItem(id, { permanente: val })}
                      onCantidad={(id, val) => updateCartItem(id, { cantidad: val })}
                      expanded={expandedIngId === ing.id}
                      onNameClick={() => setExpandedIngId(prev => prev === ing.id ? null : ing.id)}
                      onOpenDetalle={() => setInventarioIngId(ing.id)}
                      inline={expandedIngId === ing.id ? <InventarioIngenieroInline ingenieroId={ing.id} /> : null}
                    />
                  );
                })}
              </div>

              {/* Footer — el transportista se pide al confirmar, junto con la
                  creación del remito de salida. */}
              <div className="shrink-0 space-y-2 pt-2 mt-2 border-t border-slate-100">
                <Input inputSize="sm" label="Observaciones" value={observaciones}
                  onChange={e => setObservaciones(e.target.value)} placeholder="Notas opcionales..." />
                <Button className="w-full" size="sm" onClick={() => setConfirmOpen(true)}
                  disabled={saving || cart.length === 0}>
                  {`Confirmar ${cart.length} items → ${ingenieroCount} IST`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Inventario modal (anidado) */}
      <InventarioIngenieroModal ingenieroId={inventarioIngId} onClose={() => { setInventarioIngId(null); loadData(); }} />

      <ConfirmarAsignacionModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        saving={saving}
        itemCount={cart.length}
        ingenieroCount={ingenieroCount}
        proveedores={proveedores}
        transportistaId={transportistaId}
        transportista={transportista}
        onTransportistaChange={setTransportistaSeleccion}
      />
    </>
  );
};
