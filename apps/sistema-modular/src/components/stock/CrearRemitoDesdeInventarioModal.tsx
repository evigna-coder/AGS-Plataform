import { useState, useMemo, useRef, useEffect } from 'react';
import { descripcionItemAsignacion } from '../../utils/itemAsignacionLabel';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { remitosService } from '../../services/firebaseService';
import { inventarioToRemitoItem, getTipoEntidadLabel } from '../../utils/inventarioToRemitoItem';
import { imprimirRemitoStock } from '../../utils/remitoImprimir';
import { NUMERO_PREIMPRESO_REGEX } from '../../hooks/useRemitoForm';
import { RemitoDestinatarioPicker, type DestinatarioSeleccion } from '../remitos/RemitoDestinatarioPicker';
import { RemitoTransportistaPicker, EMPTY_PARTY } from '../remitos/RemitoTransportistaPicker';
import { proveedoresService } from '../../services/personalService';
import type { DatosTransportista } from '../../services/stockService';
import type { InventarioItem } from '../../hooks/useInventarioIngeniero';
import type { Proveedor, TipoRemito, TipoRemitoItem, TipoItemAsignacion } from '@ags/shared';

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
  const [filterTipo, setFilterTipo] = useState<TipoItemAsignacion | 'todos'>('todos');
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

  // Tipos disponibles (solo los que existen en el inventario)
  const tiposDisponibles = useMemo(() => {
    const set = new Set(elegibles.map(i => i.tipo));
    return Array.from(set) as TipoItemAsignacion[];
  }, [elegibles]);

  // Items filtrados por tipo
  const filtrados = useMemo(() =>
    filterTipo === 'todos' ? elegibles : elegibles.filter(i => i.tipo === filterTipo),
    [elegibles, filterTipo],
  );

  const allFilteredSelected = filtrados.length > 0 && filtrados.every(i => selectedIds.has(itemKey(i)));

  const toggleAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filtrados.forEach(i => next.delete(itemKey(i)));
      } else {
        filtrados.forEach(i => next.add(itemKey(i)));
      }
      return next;
    });
  };

  const toggleItem = (item: InventarioItem) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const key = itemKey(item);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleClose = () => {
    onClose();
    setSelectedIds(new Set());
    setFilterTipo('todos');
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
    if (imprimir && !destinatario) { alert('Para imprimir el remito elegí el cliente destinatario (o destildá "Imprimir").'); return; }
    if (imprimir && !NUMERO_PREIMPRESO_REGEX.test(numero.trim())) {
      alert('Para imprimir, cargá el número del papel preimpreso (formato 0001-00017405).');
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
      alert('Error al crear el remito');
    } finally {
      creandoRef.current = false;
      setSaving(false);
    }
  };

  const lbl = "block text-[11px] font-medium text-slate-500 mb-1";
  const selectCls = "w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500";

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
      <div className="space-y-4">
        {/* Filter chips */}
        <div>
          <label className={lbl}>Filtrar por tipo</label>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={filterTipo === 'todos'} onClick={() => setFilterTipo('todos')}>
              Todos ({elegibles.length})
            </FilterChip>
            {tiposDisponibles.map(t => (
              <FilterChip key={t} active={filterTipo === t} onClick={() => setFilterTipo(t)}>
                {getTipoEntidadLabel(t)} ({elegibles.filter(i => i.tipo === t).length})
              </FilterChip>
            ))}
          </div>
        </div>

        {/* Select all + items list */}
        <div>
          <label className="flex items-center gap-2 mb-2 cursor-pointer">
            <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
            <span className="text-xs font-medium text-slate-600">
              Seleccionar todos ({filtrados.length})
            </span>
          </label>

          <div className="max-h-[280px] overflow-y-auto space-y-1 border border-slate-100 rounded-lg p-2">
            {filtrados.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No hay items elegibles.</p>
            ) : filtrados.map(item => {
              const key = itemKey(item);
              const codigo = getItemCodigo(item);
              const desc = getItemDesc(item);
              const neta = item.cantidad - item.cantidadDevuelta - item.cantidadConsumida;
              return (
                <label key={key}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    selectedIds.has(key) ? 'bg-teal-50 border border-teal-200' : 'bg-slate-50 border border-transparent hover:bg-slate-100'
                  }`}>
                  <input type="checkbox" checked={selectedIds.has(key)} onChange={() => toggleItem(item)}
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 shrink-0" />
                  <span className="font-mono text-[11px] text-teal-700 font-semibold shrink-0">{codigo}</span>
                  <span className="text-xs text-slate-700 truncate flex-1">{desc}</span>
                  <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded shrink-0">
                    {getTipoEntidadLabel(item.tipo)}
                  </span>
                  <span className="text-[10px] text-slate-500 shrink-0">x{neta}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Remito config */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Tipo de remito</label>
            <select value={tipoRemito} onChange={e => setTipoRemito(e.target.value as TipoRemito)} className={selectCls}>
              {TIPO_REMITO_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Tipo de items</label>
            <select value={tipoRemitoItem} onChange={e => setTipoRemitoItem(e.target.value as TipoRemitoItem)} className={selectCls}>
              {TIPO_ITEM_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>

        <RemitoDestinatarioPicker value={destinatario} onChange={setDestinatario} requerido={imprimir} />

        <RemitoTransportistaPicker
          proveedores={proveedores}
          selectedId={transportistaId}
          value={transportista}
          onChange={({ id, datos }) => { setTransportistaId(id); setTransportista(datos); }}
        />

        <div>
          <label className={lbl}>Observaciones</label>
          <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2}
            placeholder="Observaciones del remito... (salen en el recuadro impreso)"
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs resize-y focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>

        {imprimir && (
          <div>
            <label className={lbl}>N° Remito (preimpreso) *</label>
            <input value={numero} onChange={e => setNumero(e.target.value)}
              placeholder="0001-00017405"
              className={`w-full border rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                numero && !NUMERO_PREIMPRESO_REGEX.test(numero.trim()) ? 'border-red-300' : 'border-slate-200'}`} />
            <p className="text-[10px] text-slate-400 mt-0.5">El número del papel que vas a usar. Sugerido desde el último cargado.</p>
          </div>
        )}

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

// ── Helpers ──

const FilterChip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button onClick={onClick}
    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
      active ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
    }`}>
    {children}
  </button>
);

function itemKey(item: InventarioItem): string {
  return `${item.asignacionId}-${item.id}`;
}

function getItemCodigo(item: InventarioItem): string {
  return item.articuloCodigo || item.minikitCodigo || item.loanerCodigo || item.vehiculoPatente || '';
}

function getItemDesc(item: InventarioItem): string {
  return descripcionItemAsignacion(item);
}
