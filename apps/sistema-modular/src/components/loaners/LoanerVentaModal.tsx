import { useState, useEffect, useMemo, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { LoanerArticuloPicker } from './LoanerArticuloPicker';
import { clientesService } from '../../services/firebaseService';
import type { Cliente, Articulo, Loaner, VentaLoaner } from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  loaner: Loaner;
  onConfirm: (payload: {
    venta: Omit<VentaLoaner, 'fecha'> & { costoUnitario: number; monedaCosto: 'ARS' | 'USD' };
    articuloRecienVinculado: {
      articuloId: string;
      articuloCodigo: string;
      articuloDescripcion: string;
    } | null;
  }) => Promise<void>;
}

// Editorial Teal label convention (mirror DesagregarStockModal + repo wide).
const lbl =
  'block text-[10px] font-mono font-medium text-slate-500 mb-0.5 uppercase tracking-wide';

export function LoanerVentaModal({ open, onClose, loaner, onConfirm }: Props) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState('');
  const [articuloIdSeleccionado, setArticuloIdSeleccionado] = useState('');
  const [articuloSeleccionado, setArticuloSeleccionado] = useState<Articulo | null>(null);
  const [precio, setPrecio] = useState('');
  const [moneda, setMoneda] = useState<'ARS' | 'USD'>('USD');
  const [costoUnitario, setCostoUnitario] = useState('');
  const [monedaCosto, setMonedaCosto] = useState<'ARS' | 'USD'>('USD');
  const [notas, setNotas] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state every time the modal opens so previous attempts (incluido un
  // error inline visible) no se quedan persistidos en el próximo open.
  useEffect(() => {
    if (open) {
      setError(null);
      setClienteId('');
      setArticuloIdSeleccionado('');
      setArticuloSeleccionado(null);
      setPrecio('');
      setMoneda('USD');
      setCostoUnitario('');
      setMonedaCosto('USD');
      setNotas('');
    }
  }, [open]);

  // Cargar clientes activos cada vez que se abre el modal.
  useEffect(() => {
    if (!open) return;
    clientesService.getAll().then(c => setClientes(c.filter(x => x.activo)));
  }, [open]);

  const handleArticuloChange = useCallback((id: string, art: Articulo | null) => {
    setArticuloIdSeleccionado(id);
    setArticuloSeleccionado(art);
  }, []);

  // Stable callback: el picker dispara onError en su useEffect, así que la ref
  // tiene que sobrevivir entre renders sin re-trigger del effect dependency.
  const handlePickerError = useCallback((msg: string) => setError(msg), []);

  const selectedCliente = useMemo(
    () => clientes.find(c => c.id === clienteId),
    [clientes, clienteId],
  );

  const articuloIdEfectivo = loaner.articuloId || articuloIdSeleccionado || null;

  const articuloRecienVinculado = useMemo(() => {
    if (loaner.articuloId) return null;
    if (!articuloSeleccionado) return null;
    return {
      articuloId: articuloSeleccionado.id,
      articuloCodigo: articuloSeleccionado.codigo ?? '',
      articuloDescripcion: articuloSeleccionado.descripcion ?? '',
    };
  }, [loaner.articuloId, articuloSeleccionado]);

  const canConfirm =
    !!clienteId && !!articuloIdEfectivo && !!costoUnitario && !saving;

  const handleConfirm = async () => {
    setError(null);
    setSaving(true);
    try {
      const ventaPayload = {
        clienteId,
        clienteNombre: selectedCliente?.razonSocial || '',
        precio: precio ? parseFloat(precio) : null,
        moneda: precio ? moneda : null,
        notas: notas.trim() || null,
        costoUnitario: parseFloat(costoUnitario),
        monedaCosto,
      };
      await onConfirm({ venta: ventaPayload, articuloRecienVinculado });
      onClose();
    } catch (e: any) {
      // Banner inline (no toast efímero) — cubre errores transaccionales del
      // service como 'Loaner ya vendido' (race entre tabs) o 'Costo requerido'.
      setError(e?.message ?? 'Error al registrar la venta');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar venta de loaner"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {saving ? 'Registrando...' : 'Confirmar venta'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Banner error inline — primero, así el usuario lo ve sin scroll. */}
        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900">
            {error}
          </div>
        )}

        {/*
          Bloque artículo: SOLO cuando loaner.articuloId es null. Si ya existe,
          se esconde por completo (decisión planner 15-03): el header del page
          ya muestra el artículo asociado, repetirlo sería ruido visual.
        */}
        {!loaner.articuloId && (
          <LoanerArticuloPicker
            open={open}
            value={articuloIdSeleccionado}
            onChange={handleArticuloChange}
            onError={handlePickerError}
          />
        )}

        <div>
          <label className={lbl}>Cliente *</label>
          <select
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={clienteId}
            onChange={e => setClienteId(e.target.value)}
          >
            <option value="">Seleccionar cliente</option>
            {clientes.map(c => (
              <option key={c.id} value={c.id}>
                {c.razonSocial}
              </option>
            ))}
          </select>
        </div>

        {/* Precio venta + Moneda venta (revenue, arriba). */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Precio de venta"
            type="number"
            value={precio}
            onChange={e => setPrecio(e.target.value)}
            placeholder="0.00"
          />
          <div>
            <label className={lbl}>Moneda venta</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={moneda}
              onChange={e => setMoneda(e.target.value as 'ARS' | 'USD')}
            >
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </select>
          </div>
        </div>

        {/* Costo activo + Moneda costo (costo, abajo). Layout 2x2 doble apilado
            para separar visualmente revenue vs costo (semántica distinta). */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Costo del activo *"
            type="number"
            value={costoUnitario}
            onChange={e => setCostoUnitario(e.target.value)}
            placeholder="0.00"
            required
          />
          <div>
            <label className={lbl}>Moneda costo *</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={monedaCosto}
              onChange={e => setMonedaCosto(e.target.value as 'ARS' | 'USD')}
            >
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </select>
          </div>
        </div>

        <div>
          <label className={lbl}>Notas</label>
          <textarea
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[60px]"
            value={notas}
            onChange={e => setNotas(e.target.value)}
            placeholder="Observaciones sobre la venta"
          />
        </div>
      </div>
    </Modal>
  );
}
