import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { LoanerExtraccionIngresoStock, type IngresoStockExtraccion } from './LoanerExtraccionIngresoStock';

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
  const [extraidoPor, setExtraidoPor] = useState('');
  // Por defecto SÍ deja el loaner inoperativo: es el caso normal —si se saca una
  // pieza, el equipo no anda. Destildarlo es la excepción (un repuesto suelto
  // que venía de acompañamiento y no hace al funcionamiento).
  const [dejaInoperativo, setDejaInoperativo] = useState(true);
  const [ingresoStock, setIngresoStock] = useState<IngresoStockExtraccion | null>(null);
  const [saving, setSaving] = useState(false);

  const ingresoIncompleto = !!ingresoStock && (!ingresoStock.articuloId || !ingresoStock.ubicacion.referenciaId);

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
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Descripcion de la pieza *</label>
          <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[60px]" value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Que pieza se extrae" />
        </div>
        <Input label="Codigo de articulo" value={codigoArticulo} onChange={e => setCodigoArticulo(e.target.value)} placeholder="Part number (opcional)" />
        <Input label="Destino *" value={destino} onChange={e => setDestino(e.target.value)} placeholder="Ej: OT 25660, Stock, Cliente X" />
        <Input label="OT asociada" value={otNumber} onChange={e => setOtNumber(e.target.value)} placeholder="Numero de OT (opcional)" />
        <Input label="Extraido por *" value={extraidoPor} onChange={e => setExtraidoPor(e.target.value)} placeholder="Nombre del ingeniero" />

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

        <LoanerExtraccionIngresoStock value={ingresoStock} onChange={setIngresoStock} />
      </div>
    </Modal>
  );
}
