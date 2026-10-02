import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { remitosService } from '../../services/firebaseService';
import { inventarioToRemitoItem } from '../../utils/inventarioToRemitoItem';
import { RemitoInventarioSelector, itemKey } from '../remitos/RemitoInventarioSelector';
import { imprimirRemitoStock } from '../../utils/remitoImprimir';
import { NUMERO_PREIMPRESO_REGEX } from '../../hooks/useRemitoForm';
import { RemitoDestinatarioPicker, type DestinatarioSeleccion } from '../remitos/RemitoDestinatarioPicker';
import { RemitoTransportistaPicker, EMPTY_PARTY } from '../remitos/RemitoTransportistaPicker';
import { proveedoresService } from '../../services/personalService';
import type { DatosTransportista } from '../../services/stockService';
import type { InventarioItem } from '../../hooks/useInventarioIngeniero';
import type { Proveedor, TipoRemito, TipoRemitoItem } from '@ags/shared';

import { notify } from '../../utils/notify';
import { Select } from '../ui/Select';
interface Props {
  open: boolean;
  onClose: () => void;
  ingenieroId: string;
  ingenieroNombre: string;
  items: InventarioItem[];
  onRemitoCreado?: (remitoId: string) => void;
}

const TIPO_REMITO_OPTIONS: { value: TipoRemito; label: string }[] = [
  { value: 'salida_campo', label: 'Salida a campo' },
  { value: 'entrega_cliente', label: 'Entrega a cliente' },
  { value: 'interno', label: 'Interno' },
];

const TIPO_ITEM_OPTIONS: { value: TipoRemitoItem; label: string }[] = [
  { value: 'sale_y_vuelve', label: 'Sale y vuelve' },
  { value: 'entrega', label: 'Entrega' },
];

export const CrearRemitoDesdeInventarioModal = ({
  open, onClose, ingenieroId, ingenieroNombre, items, onRemitoCreado,
}: Props) => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tipoRemito, setTipoRemito] = useState<TipoRemito>('salida_campo');
  const [tipoRemitoItem, setTipoRemitoItem] = useState<TipoRemitoItem>('sale_y_vuelve');
  const [observaciones, setObservaciones] = useState('');
  // Destinatario + impresión (2026-08-06): el caso principal es la ingeniera
  // entrando materiales de AGS a un cliente que pide el detalle en papel.
  const [destinatario, setDestinatario] = useState<DestinatarioSeleccion | null>(null);
  // Transportista (2026-08-11): este remito ES el que sale impreso en el papel
  // del talonario, y no tenía forma de cargar quién transporta — el recuadro
  // salía vacío siempre. Mismo picker + snapshot que asignaciones/derivación.
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [transportistaId, setTransportistaId] = useState('');
  const [transportista, setTransportista] = useState<DatosTransportista>(EMPTY_PARTY);
  const [imprimir, setImprimir] = useState(true);
  /** Número del papel preimpreso. Si se imprime, el remito TIENE que salir con
   *  el número del talonario — no con el correlativo interno REM- (2026-08-10):
   *  se imprimía "REM-0032" sobre un papel que en la esquina decía 0001-000174xx. */
  const [numero, setNumero] = useState('');
  useEffect(() => {
    if (!open) return;
    remitosService.getProximoNumeroPreimpreso()
      .then((n: string) => setNumero(prev => prev || n))
      .catch(() => { /* el usuario lo carga a mano */ });
    proveedoresService.getAll(true).then(setProveedores).catch(() => setProveedores([]));
  }, [open]);
  // Guarda anti doble-click: ref, no state (el disabled llega tarde al 2do click).
  const creandoRef = useRef(false);

  // Solo items asignados con cantidad neta > 0
  const elegibles = useMemo(() =>
    items.filter(i => i.estado === 'asignado' && (i.cantidad - i.cantidadDevuelta - i.cantidadConsumida) > 0),
    [items],
  );

  const handleClose = () => {
    onClose();
    setSelectedIds(new Set());
    setTipoRemito('salida_campo');
    setTipoRemitoItem('sale_y_vuelve');
    setObservaciones('');
    setDestinatario(null);
    setTransportistaId('');
    setTransportista(EMPTY_PARTY);
    setImprimir(true);
  };

  const handleCrear = async () => {
    if (creandoRef.current) return;
    const selected = elegibles.filter(i => selectedIds.has(itemKey(i)));
    if (selected.length === 0) return;
    if (imprimir && !destinatario) { notify.warning('Para imprimir el remito elegí el cliente destinatario (o destildá "Imprimir").'); return; }
    if (imprimir && !NUMERO_PREIMPRESO_REGEX.test(numero.trim())) {
      notify.warning('Para imprimir, cargá el número del papel preimpreso (formato 0001-00017405).');
      return;
    }

    creandoRef.current = true;
    setSaving(true);
    try {
      const remitoItems = selected.map(i => inventarioToRemitoItem(i, tipoRemitoItem));
      const newId = await remitosService.create({
        // Con impresión va el número del TALONARIO; sin imprimir, el service
        // asigna el correlativo interno REM-.
        ...(imprimir ? { numero: numero.trim() } : {}),
        tipo: tipoRemito,
        estado: 'borrador',
        ingenieroId,
        ingenieroNombre,
        clienteId: destinatario?.clienteId ?? null,
        clienteNombre: destinatario?.clienteNombre ?? null,
        establecimientoId: destinatario?.establecimientoId ?? null,
        establecimientoNombre: destinatario?.establecimientoNombre ?? null,
        transportistaId: transportistaId || null,
        transportistaNombre: transportista.razonSocial.trim() || null,
        transportista: transportista.razonSocial.trim() ? transportista : null,
        items: remitoItems,
        observaciones: observaciones.trim() || null,
        fechaSalida: new Date().toISOString().slice(0, 10),
      });
      // Imprimir por el pipeline calibrado (triplicado sobre papel preimpreso,
      // domicilio del establecimiento, recuadro de obs, marca impreso). Los
      // items de asignación son documentales — no mueven stock. Best-effort.
      if (imprimir) {
        const remito = await remitosService.getById(newId);
        if (remito) {
          await imprimirRemitoStock(remito)
            .catch(err => console.warn('[CrearRemitoDesdeInventario] impresión falló:', err));
        }
      }
      handleClose();
      onRemitoCreado?.(newId);
      navigate(`/stock/remitos/${newId}`);
    } catch {
      notify.error('Error al crear el remito');
    } finally {
      creandoRef.current = false;
      setSaving(false);
    }
  };

  const lbl = "block text-[11px] font-medium text-slate-500 mb-1";

  return (
    <Modal open={open} onClose={handleClose} maxWidth="lg"
      title="Crear remito desde inventario"
      subtitle={`Ingeniero: ${ingenieroNombre}`}
      footer={<>
        <Button variant="outline" size="sm" onClick={handleClose}>Cancelar</Button>
        <Button size="sm" onClick={handleCrear} disabled={saving || selectedIds.size === 0}>
          {saving ? 'Creando...' : `Crear remito (${selectedIds.size} items)`}
        </Button>
      </>}
    >
      <div className="space-y-3">
        {/* Selector con buscador y filas compactas (2026-10-02). */}
        <RemitoInventarioSelector elegibles={elegibles} selectedIds={selectedIds} onChange={setSelectedIds} />

        {/* Tipo de remito, de ítems y N° del papel en una sola fila. */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={lbl}>Tipo de remito</label>
            <Select value={tipoRemito} onChange={e => setTipoRemito(e.target.value as TipoRemito)} className="w-full">
              {TIPO_REMITO_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </div>
          <div>
            <label className={lbl}>Tipo de items</label>
            <Select value={tipoRemitoItem} onChange={e => setTipoRemitoItem(e.target.value as TipoRemitoItem)} className="w-full">
              {TIPO_ITEM_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </div>
          {imprimir && (
            <div>
              <label className={lbl}>N° remito (preimpreso) *</label>
              <input value={numero} onChange={e => setNumero(e.target.value)} placeholder="0001-00017405"
                title="El número del papel que vas a usar. Sugerido desde el último cargado."
                className={`w-full border rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                  numero && !NUMERO_PREIMPRESO_REGEX.test(numero.trim()) ? 'border-red-300' : 'border-slate-200'}`} />
            </div>
          )}
        </div>

        <RemitoDestinatarioPicker value={destinatario} onChange={setDestinatario} requerido={imprimir} />

        <RemitoTransportistaPicker
          proveedores={proveedores}
          selectedId={transportistaId}
          value={transportista}
          onChange={({ id, datos }) => { setTransportistaId(id); setTransportista(datos); }}
          compacto
        />

        <div>
          <label className={lbl}>Observaciones</label>
          <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={1}
            placeholder="Observaciones del remito... (salen en el recuadro impreso)"
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs resize-y focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={imprimir} onChange={e => setImprimir(e.target.checked)}
            className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
          <span className="text-xs text-slate-700">
            Imprimir al crear <span className="text-slate-400">(triplicado sobre papel preimpreso, mismo formato que los demás remitos)</span>
          </span>
        </label>
      </div>
    </Modal>
  );
};
