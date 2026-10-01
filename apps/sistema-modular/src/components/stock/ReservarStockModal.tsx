import { useState, useEffect } from 'react';
import { unidadesService } from '../../services/stockService';
import { useReservaStock } from '../../hooks/useReservaStock';
import { Modal } from '../ui/Modal';
import type { UnidadStock } from '@ags/shared';
import type { ArticuloAReservar } from '../../utils/reservaManual';

type StockItem = ArticuloAReservar;

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
  // Cuánto reservar (2026-10-01): antes se reservaba la unidad entera y un lote
  // de 50 quedaba todo para el cliente aunque pidiera 20. Se propone lo que falta.
  const [yaReservadas, setYaReservadas] = useState(0);
  const [cantidad, setCantidad] = useState('');

  useEffect(() => {
    if (!selectedItem) return;
    setLoadingUnidades(true);
    Promise.all([
      unidadesService.getAll({ articuloId: selectedItem.articuloId, estado: 'disponible' }),
      unidadesService.getAll({ articuloId: selectedItem.articuloId, estado: 'reservado' }),
    ])
      .then(([disp, res]) => {
        setUnidades(disp);
        const ya = res.filter(u => u.reservadoParaPresupuestoId === props.presupuestoId).reduce((a, u) => a + (u.cantidad ?? 1), 0);
        setYaReservadas(ya);
        setCantidad(String(Math.max(selectedItem.necesaria - ya, 0)));
      })
      .catch(() => setUnidades([]))
      .finally(() => setLoadingUnidades(false));
  }, [selectedItem, props.presupuestoId]);

  const faltan = selectedItem ? Math.max(selectedItem.necesaria - yaReservadas, 0) : 0;
  const pedida = Number(cantidad) || 0;

  const handleReservar = async (unidad: UnidadStock) => {
    if (pedida <= 0) return;
    const ok = await reservar({
      cantidad: Math.min(pedida, unidad.cantidad ?? 1),
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
              <div className="flex items-end justify-between gap-3 mb-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                <p className="text-[11px] text-slate-500">
                  Pide <b className="text-slate-700">{selectedItem.necesaria}</b> u. · reservadas <b className="text-slate-700">{yaReservadas}</b> · faltan <b className="text-slate-700">{faltan}</b>
                </p>
                <label className="text-[10px] font-mono uppercase tracking-wide text-slate-500">
                  Reservar
                  <input type="number" min={1} value={cantidad} onChange={e => setCantidad(e.target.value)} onFocus={e => e.target.select()}
                    className="ml-2 w-20 border border-slate-300 rounded px-2 py-0.5 text-xs font-mono text-right normal-case" />
                </label>
              </div>
              <p className="text-xs text-slate-500 mb-2">Elegí de qué unidad o lote sale:</p>
              {unidades.map((u, idx) => (
                <button
                  key={u.id}
                  onClick={() => handleReservar(u)}
                  disabled={reservando || pedida <= 0}
                  className="w-full text-left px-3 py-2.5 rounded-lg border border-slate-200 hover:border-teal-400 hover:bg-teal-50 transition-colors disabled:opacity-50"
                >
                  <span className="text-xs font-mono text-slate-700">
                    {u.nroSerie ? `Serie: ${u.nroSerie}` : `Unidad #${idx + 1}`}
                  </span>
                  {(u.cantidad ?? 1) > 1 && (
                    <span className="text-xs text-slate-500 ml-2">· lote de {u.cantidad} → reserva {Math.min(pedida, u.cantidad ?? 1)}</span>
                  )}
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
