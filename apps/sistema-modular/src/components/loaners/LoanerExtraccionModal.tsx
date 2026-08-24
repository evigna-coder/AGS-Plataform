import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { LoanerExtraccionIngresoStock, type IngresoStockExtraccion } from './LoanerExtraccionIngresoStock';
import { getCurrentUser } from '../../services/currentUser';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (
    data: {
      descripcion: string;
      codigoArticulo: string | null;
      destino: string;
      otNumber: string | null;
      extraidoPor: string;
      dejaInoperativo: boolean;
    },
    ingresoStock: IngresoStockExtraccion | null,
  ) => Promise<void>;
}

export function LoanerExtraccionModal({ open, onClose, onConfirm }: Props) {
  const [descripcion, setDescripcion] = useState('');
  const [codigoArticulo, setCodigoArticulo] = useState('');
  const [destino, setDestino] = useState('');
  const [otNumber, setOtNumber] = useState('');
  // Quien está operando es quien extrae, en la enorme mayoría de los casos.
  // Se puede pisar si lo hizo otro (2026-08-23).
  const [extraidoPor, setExtraidoPor] = useState(getCurrentUser()?.displayName ?? '');
  // Por defecto SÍ deja el loaner inoperativo: es el caso normal —si se saca una
  // pieza, el equipo no anda. Destildarlo es la excepción (un repuesto suelto
  // que venía de acompañamiento y no hace al funcionamiento).
  const [dejaInoperativo, setDejaInoperativo] = useState(true);
  const [ingresoStock, setIngresoStock] = useState<IngresoStockExtraccion | null>(null);
  const [saving, setSaving] = useState(false);

  const ingresoIncompleto = !!ingresoStock && (!ingresoStock.articuloId || !ingresoStock.ubicacion.referenciaId);

  /**
   * El código de arriba y el artículo del catálogo son el MISMO dato
   * (2026-08-23). Estaban desconectados: se podía tipear un part number y
   * elegir otro artículo abajo, y la extracción quedaba diciendo una cosa y la
   * unidad creada otra. Al elegir del catálogo, el catálogo manda.
   */
  const cambiarIngreso = (v: IngresoStockExtraccion | null) => {
    setIngresoStock(v);
    if (v?.articuloCodigo) setCodigoArticulo(v.articuloCodigo);
  };

  const handleConfirm = async () => {
    if (!descripcion.trim() || !destino.trim() || !extraidoPor.trim() || ingresoIncompleto) return;
    setSaving(true);
    try {
      await onConfirm({
        descripcion: descripcion.trim(),
        codigoArticulo: codigoArticulo.trim() || null,
        destino: destino.trim(),
        otNumber: otNumber.trim() || null,
        extraidoPor: extraidoPor.trim(),
        dejaInoperativo,
      }, ingresoStock);
      onClose();
      setDescripcion(''); setCodigoArticulo(''); setDestino(''); setOtNumber(''); setExtraidoPor('');
      setDejaInoperativo(true); setIngresoStock(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Registrar extraccion de pieza" footer={
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" size="sm" onClick={handleConfirm} disabled={!descripcion.trim() || !destino.trim() || !extraidoPor.trim() || ingresoIncompleto || saving}>
          {saving ? 'Guardando...' : 'Registrar'}
        </Button>
      </div>
    }>
      <div className="space-y-4">
        <Input inputSize="sm" label="Descripcion de la pieza *" value={descripcion}
          onChange={e => setDescripcion(e.target.value)} placeholder="Qué pieza se extrae" />
        {/* El código libre desaparece cuando la pieza entra a stock: ahí lo
            define el artículo del catálogo y tener los dos campos era pedir el
            mismo dato dos veces (2026-08-23). */}
        {!ingresoStock && (
          <Input inputSize="sm" label="Codigo de articulo" value={codigoArticulo}
            onChange={e => setCodigoArticulo(e.target.value)}
            placeholder="Part number (opcional)" />
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input inputSize="sm" label="Destino *" value={destino}
            onChange={e => setDestino(e.target.value)} placeholder="Ej: Stock, Cliente X" />
          <Input inputSize="sm" label="OT asociada" value={otNumber}
            onChange={e => setOtNumber(e.target.value)} placeholder="Opcional" />
        </div>
        <Input inputSize="sm" label="Extraido por *" value={extraidoPor}
          onChange={e => setExtraidoPor(e.target.value)} placeholder="Nombre del ingeniero" />

        <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer select-none">
          <input type="checkbox" checked={dejaInoperativo} onChange={e => setDejaInoperativo(e.target.checked)}
            className="w-3.5 h-3.5 mt-0.5 rounded border-slate-300 accent-amber-600" />
          <span>
            Deja el loaner <span className="font-semibold">inoperativo</span>
            <span className="block text-[11px] text-slate-400">
              Queda marcado como incompleto hasta reponer la pieza, y avisa antes de prestarlo.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!!ingresoStock}
            onChange={e => setIngresoStock(e.target.checked
              ? { articuloId: '', articuloCodigo: '', articuloDescripcion: '', condicion: 'bien_de_uso', cantidad: 1, nroSerie: null, ubicacion: { tipo: 'posicion', referenciaId: '', referenciaNombre: '' } }
              : null)}
            className="w-3.5 h-3.5 mt-0.5 rounded border-slate-300 accent-teal-700"
          />
          <span>
            Ingresar la pieza a <span className="font-semibold">stock</span>
            <span className="block text-[11px] text-slate-400">
              Crea la unidad y su movimiento de ingreso con origen este loaner. Sin esto, la extracción queda solo documentada.
            </span>
          </span>
        </label>

        <LoanerExtraccionIngresoStock value={ingresoStock} onChange={cambiarIngreso} />
      </div>
    </Modal>
  );
}
