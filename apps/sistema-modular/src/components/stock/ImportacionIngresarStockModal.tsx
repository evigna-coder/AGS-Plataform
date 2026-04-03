import React, { useState, useEffect } from 'react';
import type { Importacion, ItemImportacion, PosicionStock } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';
import { posicionesStockService } from '../../services/stockService';
import { useIngresarStock, type RecepcionItem } from '../../hooks/useIngresarStock';

interface ImportacionIngresarStockModalProps {
  imp: Importacion;
  onClose: () => void;
  onSuccess: () => void;
}

interface ItemState {
  posicionId: string;
  posicionNombre: string;
  cantidadReal: number;
  serialesText: string;
}

const labelClass = 'block text-[10px] font-medium uppercase tracking-wider text-slate-400 font-mono mb-1';
const inputClass = 'w-full border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500';

export const ImportacionIngresarStockModal: React.FC<ImportacionIngresarStockModalProps> = ({
  imp,
  onClose,
  onSuccess,
}) => {
  const items = imp.items ?? [];
  const [posiciones, setPosiciones] = useState<PosicionStock[]>([]);
  const [itemStates, setItemStates] = useState<Record<string, ItemState>>(() =>
    Object.fromEntries(
      items.map((it: ItemImportacion) => [
        it.id,
        { posicionId: '', posicionNombre: '', cantidadReal: it.cantidadPedida, serialesText: '' },
      ]),
    ),
  );
  const { ingresarStock, loading, error } = useIngresarStock();

  useEffect(() => {
    posicionesStockService
      .getAll(true)
      .then(all => setPosiciones(all.filter(p => p.codigo !== 'RESERVAS')));
  }, []);

  const posicionOptions = posiciones.map(p => ({ value: p.id, label: p.nombre }));

  const handlePosicion = (itemId: string, posicionId: string) => {
    const pos = posiciones.find(p => p.id === posicionId);
    setItemStates(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], posicionId, posicionNombre: pos?.nombre ?? '' },
    }));
  };

  const handleCantidad = (itemId: string, value: string) => {
    const n = parseInt(value, 10);
    if (!isNaN(n) && n >= 0) {
      setItemStates(prev => ({ ...prev, [itemId]: { ...prev[itemId], cantidadReal: n } }));
    }
  };

  const handleSeriales = (itemId: string, value: string) => {
    setItemStates(prev => ({ ...prev, [itemId]: { ...prev[itemId], serialesText: value } }));
  };

  const handleConfirmar = async () => {
    const recepciones: RecepcionItem[] = items.map((it: ItemImportacion) => {
      const s = itemStates[it.id];
      return {
        item: it,
        posicionId: s.posicionId,
        posicionNombre: s.posicionNombre,
        cantidadReal: s.cantidadReal,
        nrosSerie: s.serialesText.trim()
          ? s.serialesText.split('\n').map(l => l.trim()).filter(Boolean)
          : [],
      };
    });

    const ok = await ingresarStock(imp, recepciones);
    if (ok) {
      onSuccess();
      onClose();
    }
  };

  const footer = (
    <div className="flex items-center justify-between w-full">
      <div className="flex-1">
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button size="sm" onClick={handleConfirmar} disabled={loading}>
          {loading ? 'Procesando...' : 'Confirmar ingreso'}
        </Button>
      </div>
    </div>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title="Ingresar al stock"
      subtitle={`Importación ${imp.numero} — ${imp.proveedorNombre}`}
      maxWidth="xl"
      footer={footer}
      closeOnBackdropClick={false}
    >
      {items.length === 0 ? (
        <p className="text-xs text-slate-400 py-4">Esta importación no tiene ítems registrados.</p>
      ) : (
        <div className="space-y-4">
          {items.map((it: ItemImportacion) => {
            const s = itemStates[it.id];
            return (
              <div key={it.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs font-medium text-slate-800">{it.descripcion}</p>
                    {it.articuloCodigo && (
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">{it.articuloCodigo}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono ml-4 shrink-0">
                    Pedido: {it.cantidadPedida} {it.unidadMedida}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>Cantidad recibida</label>
                    <input
                      type="number"
                      min={0}
                      value={s.cantidadReal}
                      onChange={e => handleCantidad(it.id, e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Posición destino</label>
                    <SearchableSelect
                      value={s.posicionId}
                      onChange={v => handlePosicion(it.id, v)}
                      options={posicionOptions}
                      placeholder="Seleccionar posición..."
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Números de serie (uno por línea)</label>
                    <textarea
                      value={s.serialesText}
                      onChange={e => handleSeriales(it.id, e.target.value)}
                      rows={2}
                      placeholder="Opcional — uno por línea"
                      className={`${inputClass} resize-none`}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
};
