import { useState, useEffect } from 'react';
import { unidadesService } from '../../services/stockService';
import { useReservaStock } from '../../hooks/useReservaStock';
import { Modal } from '../ui/Modal';
import type { UnidadStock } from '@ags/shared';

interface StockItem {
  articuloId: string;
  descripcion: string;
}

interface Props {
  presupuestoId: string;
  presupuestoNumero: string;
  clienteId: string;
  clienteNombre: string;
  items: StockItem[];
  onClose: () => void;
  onSuccess: () => void;
}

export function ReservarStockModal(props: Props) {
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(
    props.items.length === 1 ? props.items[0] : null,
  );
  const [unidades, setUnidades] = useState<UnidadStock[]>([]);
  const [loadingUnidades, setLoadingUnidades] = useState(false);
  const { reservar, loading: reservando } = useReservaStock();

  useEffect(() => {
    if (!selectedItem) return;
    setLoadingUnidades(true);
    unidadesService
      .getAll({ articuloId: selectedItem.articuloId, estado: 'disponible' })
      .then(setUnidades)
      .catch(() => setUnidades([]))
      .finally(() => setLoadingUnidades(false));
  }, [selectedItem]);

  const handleReservar = async (unidad: UnidadStock) => {
    const ok = await reservar({
      unidadId: unidad.id,
      unidad,
      presupuestoId: props.presupuestoId,
      presupuestoNumero: props.presupuestoNumero,
      clienteId: props.clienteId,
      clienteNombre: props.clienteNombre,
      solicitadoPorNombre: 'Admin',
    });
    if (ok) props.onSuccess();
  };

  const modalTitle = selectedItem
    ? `Reservar Stock — ${selectedItem.descripcion}`
    : 'Reservar Stock — Seleccionar artículo';

  return (
    <Modal open onClose={props.onClose} title={modalTitle} maxWidth="md">
      {/* Step 1: item selector */}
      {!selectedItem && (
        <div className="py-2 space-y-1">
          <p className="text-xs text-slate-500 mb-3">Seleccioná el artículo a reservar:</p>
          {props.items.map(item => (
            <button
              key={item.articuloId}
              onClick={() => setSelectedItem(item)}
              className="w-full text-left px-3 py-2.5 rounded-lg border border-slate-200 hover:border-teal-400 hover:bg-teal-50 transition-colors text-sm text-slate-700"
            >
              {item.descripcion}
            </button>
          ))}
        </div>
      )}

      {/* Step 2: unit selector */}
      {selectedItem && (
        <div className="py-2">
          {props.items.length > 1 && (
            <button
              onClick={() => setSelectedItem(null)}
              className="text-xs text-teal-600 hover:underline mb-3 flex items-center gap-1"
            >
              ← Volver
            </button>
          )}
          {loadingUnidades && (
            <p className="text-xs text-slate-400 py-4 text-center">Cargando unidades disponibles...</p>
          )}
          {!loadingUnidades && unidades.length === 0 && (
            <div className="text-center py-6">
              <p className="text-sm text-slate-500">No hay unidades disponibles para este artículo.</p>
              {props.items.length > 1 && (
                <button onClick={() => setSelectedItem(null)} className="mt-3 text-xs text-teal-600 hover:underline">
                  ← Volver
                </button>
              )}
            </div>
          )}
          {!loadingUnidades && unidades.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-slate-500 mb-3">Seleccioná una unidad para reservar:</p>
              {unidades.map((u, idx) => (
                <button
                  key={u.id}
                  onClick={() => handleReservar(u)}
                  disabled={reservando}
                  className="w-full text-left px-3 py-2.5 rounded-lg border border-slate-200 hover:border-teal-400 hover:bg-teal-50 transition-colors disabled:opacity-50"
                >
                  <span className="text-xs font-mono text-slate-700">
                    {u.nroSerie ? `Serie: ${u.nroSerie}` : `Unidad #${idx + 1}`}
                  </span>
                  {u.ubicacion.referenciaNombre && (
                    <span className="text-xs text-slate-400 ml-2">— {u.ubicacion.referenciaNombre}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
