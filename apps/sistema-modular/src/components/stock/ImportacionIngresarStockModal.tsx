import React, { useState, useEffect, useMemo } from 'react';
import type { Importacion, ItemImportacion, PosicionStock, Articulo } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { posicionesStockService, articulosService } from '../../services/stockService';
import { useIngresarStock, type RecepcionItem } from '../../hooks/useIngresarStock';
import { pendienteDeItem, resumenRecepcion } from '../../utils/importacionRecepcion';
import { IngresarStockItemRow, rowValido, seriesDe, type IngresoItemState } from './IngresarStockItemRow';

interface Props {
  imp: Importacion;
  onClose: () => void;
  onSuccess: () => void;
}

// Default de cantidad = lo PENDIENTE del ítem (en la primera recepción coincide
// con lo pedido; en re-ingresos por faltante, con lo que falta — I3).
const initState = (it: ItemImportacion): IngresoItemState => ({
  verificado: false, posicionId: '', posicionNombre: '',
  cantidadReal: pendienteDeItem(it), serialesText: '', nroLote: '',
});

export const ImportacionIngresarStockModal: React.FC<Props> = ({ imp, onClose, onSuccess }) => {
  // Solo los ítems con faltante: lo ya ingresado en recepciones anteriores no se re-ofrece.
  const items = (imp.items ?? []).filter(it => pendienteDeItem(it) > 0);
  const resumen = resumenRecepcion(imp);
  const [posiciones, setPosiciones] = useState<PosicionStock[]>([]);
  const [articulosById, setArticulosById] = useState<Map<string, Articulo>>(new Map());
  const [itemStates, setItemStates] = useState<Record<string, IngresoItemState>>(
    () => Object.fromEntries(items.map(it => [it.id, initState(it)])),
  );
  const { ingresarStock, loading, error } = useIngresarStock();

  useEffect(() => {
    posicionesStockService.getAll(true).then(all => setPosiciones(all.filter(p => p.codigo !== 'RESERVAS')));
    const ids = Array.from(new Set(items.map(i => i.articuloId).filter(Boolean) as string[]));
    Promise.all(ids.map(id => articulosService.getById(id).catch(() => null)))
      .then(arts => setArticulosById(new Map(arts.filter((a): a is Articulo => !!a).map(a => [a.id, a]))));
  }, []);

  const posicionOptions = useMemo(() => posiciones.map(p => ({ value: p.id, label: p.nombre })), [posiciones]);
  const artDe = (it: ItemImportacion) => (it.articuloId ? articulosById.get(it.articuloId) ?? null : null);

  const patch = (itemId: string, p: Partial<IngresoItemState>) =>
    setItemStates(prev => ({ ...prev, [itemId]: { ...prev[itemId], ...p } }));
  const handlePosicion = (itemId: string, posicionId: string) => {
    const pos = posiciones.find(p => p.id === posicionId);
    patch(itemId, { posicionId, posicionNombre: pos?.nombre ?? '' });
  };

  const verificadosCount = items.filter(it => itemStates[it.id]?.verificado).length;
  const allVerificados = items.length > 0 && verificadosCount === items.length;
  const toggleTodos = () => setItemStates(prev => {
    const next = { ...prev };
    for (const it of items) next[it.id] = { ...next[it.id], verificado: !allVerificados };
    return next;
  });

  // Solo los tildados se ingresan; los no tildados se asumen "no llegaron".
  const tildados = items.filter(it => itemStates[it.id]?.verificado);
  const noTildados = items.filter(it => !itemStates[it.id]?.verificado);
  const puedeConfirmar = tildados.length > 0 && tildados.every(it => rowValido(artDe(it), itemStates[it.id]));
  const [confirmandoFaltantes, setConfirmandoFaltantes] = useState(false);

  const doIngresar = async () => {
    const recepciones: RecepcionItem[] = tildados.map(it => {
      const s = itemStates[it.id];
      return {
        item: it,
        posicionId: s.posicionId,
        posicionNombre: s.posicionNombre,
        cantidadReal: s.cantidadReal,
        nroLote: s.nroLote.trim() || null,
        nrosSerie: seriesDe(s),
      };
    });
    const ok = await ingresarStock(imp, recepciones);
    if (ok) { onSuccess(); onClose(); }
  };

  const handleConfirmar = () => {
    // Si hay artículos sin tildar, pedir confirmación explícita antes de ingresar.
    if (noTildados.length > 0 && !confirmandoFaltantes) { setConfirmandoFaltantes(true); return; }
    void doIngresar();
  };

  const footer = (
    <div className="flex items-center justify-between w-full">
      <div className="flex-1 text-xs">
        {error ? <span className="text-red-600">{error}</span>
          : <span className="text-slate-400">{verificadosCount}/{items.length} verificados{noTildados.length > 0 ? ` · ${noTildados.length} sin tildar` : ''}</span>}
      </div>
      <div className="flex gap-2">
        {confirmandoFaltantes && (
          <Button variant="ghost" size="sm" onClick={() => setConfirmandoFaltantes(false)} disabled={loading}>Volver</Button>
        )}
        {!confirmandoFaltantes && <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>Cancelar</Button>}
        <Button size="sm" onClick={handleConfirmar} disabled={loading || !puedeConfirmar}
          variant={confirmandoFaltantes ? 'danger' : 'primary'}>
          {loading ? 'Procesando...' : confirmandoFaltantes ? 'Sí, ingresar igual' : 'Confirmar ingreso'}
        </Button>
      </div>
    </div>
  );

  return (
    <Modal open onClose={onClose} title="Ingresar al stock"
      subtitle={`OC ${imp.ordenCompraNumero}${imp.despachoNumero ? ` · Despacho ${imp.despachoNumero}` : ''} — ${imp.proveedorNombre}`}
      maxWidth="xl" footer={footer} closeOnBackdropClick={false}>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400 py-4">
          {(imp.items?.length ?? 0) > 0
            ? 'Todos los ítems del embarque ya fueron ingresados al stock.'
            : 'Esta importación no tiene ítems registrados.'}
        </p>
      ) : (
        <div className="space-y-3">
          {resumen.huboRecepcion && (
            <div className="bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
              <p className="text-[11px] text-teal-800">
                <span className="font-medium">Recepción parcial previa:</span> recibido {resumen.recibido} de {resumen.pedido} unidades.
                Se muestran solo los ítems con faltante; las cantidades sugeridas son lo pendiente.
              </p>
            </div>
          )}
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            <p className="text-[11px] text-slate-500">
              Cada unidad se vincula a <span className="font-mono text-teal-700">OC {imp.ordenCompraNumero}</span>
              {imp.despachoNumero && <> y al despacho <span className="font-mono text-teal-700">{imp.despachoNumero}</span></>}.
            </p>
            <button type="button" onClick={toggleTodos} className="text-[11px] font-medium text-teal-600 hover:underline shrink-0">
              {allVerificados ? 'Destildar todos' : 'Tildar todos'}
            </button>
          </div>

          {confirmandoFaltantes && noTildados.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg px-3 py-2.5">
              <p className="text-xs font-medium text-amber-800">⚠ {noTildados.length} artículo{noTildados.length > 1 ? 's' : ''} sin tildar — se asume que NO llegaron en esta tanda y no se ingresarán ahora:</p>
              <ul className="mt-1 space-y-0.5">
                {noTildados.map(it => (
                  <li key={it.id} className="text-[11px] text-amber-700">
                    • {it.articuloCodigo ? <span className="font-mono">{it.articuloCodigo} </span> : null}{it.descripcion} <span className="text-amber-500">({pendienteDeItem(it)} {it.unidadMedida})</span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-amber-600 mt-1.5">La importación quedará abierta para ingresar el faltante en otra recepción (o cerrarla incompleta desde el detalle). ¿Confirmás?</p>
            </div>
          )}
          {items.map(it => (
            <IngresarStockItemRow
              key={it.id}
              item={it}
              articulo={artDe(it)}
              state={itemStates[it.id]}
              posicionOptions={posicionOptions}
              onChange={p => patch(it.id, p)}
              onPosicion={posId => handlePosicion(it.id, posId)}
            />
          ))}
        </div>
      )}
    </Modal>
  );
};
