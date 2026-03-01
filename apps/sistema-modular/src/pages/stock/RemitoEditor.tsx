import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { remitosService, ingenierosService, clientesService, unidadesService } from '../../services/firebaseService';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import type { Ingeniero, UnidadStock, RemitoItem, TipoRemito, TipoRemitoItem } from '@ags/shared';

const TIPO_OPTIONS: { value: TipoRemito; label: string }[] = [
  { value: 'salida_campo', label: 'Salida a campo' },
  { value: 'entrega_cliente', label: 'Entrega a cliente' },
  { value: 'devolucion', label: 'Devolución' },
  { value: 'interno', label: 'Interno' },
];
const TIPO_ITEM_OPTIONS: { value: TipoRemitoItem; label: string }[] = [
  { value: 'sale_y_vuelve', label: 'Sale y vuelve' },
  { value: 'entrega', label: 'Entrega' },
];

interface DraftItem extends Omit<RemitoItem, 'id'> { localId: string; }

export const RemitoEditor = () => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  // Form state
  const [tipo, setTipo] = useState<TipoRemito>('salida_campo');
  const [ingenieroId, setIngenieroId] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [otNumbers, setOtNumbers] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [fechaSalida, setFechaSalida] = useState(() => new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<DraftItem[]>([]);

  // Lookup data
  const [ingenieros, setIngenieros] = useState<Ingeniero[]>([]);
  const [clientes, setClientes] = useState<{ id: string; razonSocial: string }[]>([]);
  const [availableUnits, setAvailableUnits] = useState<UnidadStock[]>([]);
  const [unitSearchOpen, setUnitSearchOpen] = useState(false);
  const [unitSearchTerm, setUnitSearchTerm] = useState('');

  useEffect(() => {
    ingenierosService.getAll().then(setIngenieros);
    clientesService.getAll(true).then((data: any[]) => setClientes(data.map(c => ({ id: c.id, razonSocial: c.razonSocial }))));
    unidadesService.getAll({ estado: 'disponible' }).then(setAvailableUnits);
  }, []);

  const ingenieroOptions = ingenieros.map(i => ({ value: i.id, label: i.nombre }));
  const clienteOptions = clientes.map(c => ({ value: c.id, label: c.razonSocial }));
  const selectedIngeniero = ingenieros.find(i => i.id === ingenieroId);
  const selectedCliente = clientes.find(c => c.id === clienteId);

  // Filter available units for the search
  const addedUnitIds = new Set(items.map(i => i.unidadId));
  const filteredUnits = availableUnits.filter(u => {
    if (addedUnitIds.has(u.id)) return false;
    if (!unitSearchTerm) return true;
    const term = unitSearchTerm.toLowerCase();
    return u.articuloCodigo.toLowerCase().includes(term) || u.articuloDescripcion.toLowerCase().includes(term);
  });

  const addItem = (unit: UnidadStock) => {
    setItems(prev => [...prev, {
      localId: crypto.randomUUID(),
      unidadId: unit.id,
      articuloId: unit.articuloId,
      articuloCodigo: unit.articuloCodigo,
      articuloDescripcion: unit.articuloDescripcion,
      cantidad: 1,
      tipoItem: 'sale_y_vuelve',
      devuelto: false,
    }]);
    setUnitSearchOpen(false);
    setUnitSearchTerm('');
  };

  const updateItem = (localId: string, field: keyof DraftItem, value: unknown) => {
    setItems(prev => prev.map(i => i.localId === localId ? { ...i, [field]: value } : i));
  };

  const removeItem = (localId: string) => {
    setItems(prev => prev.filter(i => i.localId !== localId));
  };

  const handleSave = async () => {
    if (!ingenieroId) { alert('Seleccione un ingeniero'); return; }
    if (items.length === 0) { alert('Agregue al menos un item'); return; }
    setSaving(true);
    try {
      const remitoItems: RemitoItem[] = items.map(i => ({
        id: crypto.randomUUID(),
        unidadId: i.unidadId,
        articuloId: i.articuloId,
        articuloCodigo: i.articuloCodigo,
        articuloDescripcion: i.articuloDescripcion,
        cantidad: i.cantidad,
        tipoItem: i.tipoItem,
        devuelto: false,
      }));
      const parsedOts = otNumbers.split(',').map(s => s.trim()).filter(Boolean);
      const newId = await remitosService.create({
        tipo,
        estado: 'borrador',
        ingenieroId,
        ingenieroNombre: selectedIngeniero?.nombre ?? '',
        clienteId: tipo === 'entrega_cliente' ? (clienteId || null) : null,
        clienteNombre: tipo === 'entrega_cliente' ? (selectedCliente?.razonSocial ?? null) : null,
        otNumbers: parsedOts.length > 0 ? parsedOts : [],
        items: remitoItems,
        observaciones: observaciones.trim() || null,
        fechaSalida: fechaSalida || null,
      });
      navigate(`/stock/remitos/${newId}`);
    } catch (err) {
      console.error('Error creando remito:', err);
      alert('Error al crear el remito');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col bg-slate-50">
      <div className="shrink-0 px-6 pt-6 pb-4 bg-white border-b border-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.06)] z-10">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Nuevo remito</h2>
            <p className="text-sm text-slate-500 mt-0.5">Complete los datos y agregue items</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate('/stock/remitos')}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar borrador'}</Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        <Card>
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Datos generales</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de remito</label>
              <select value={tipo} onChange={e => setTipo(e.target.value as TipoRemito)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                {TIPO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ingeniero</label>
              <SearchableSelect value={ingenieroId} onChange={setIngenieroId} options={ingenieroOptions} placeholder="Seleccionar ingeniero..." />
            </div>
            {tipo === 'entrega_cliente' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
                <SearchableSelect value={clienteId} onChange={setClienteId} options={clienteOptions} placeholder="Seleccionar cliente..." />
              </div>
            )}
            <Input label="OTs asociadas" value={otNumbers} onChange={e => setOtNumbers(e.target.value)} placeholder="OT-001, OT-002..." />
            <Input label="Fecha de salida" type="date" value={fechaSalida} onChange={e => setFechaSalida(e.target.value)} />
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">Observaciones</label>
            <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={3}
              placeholder="Notas sobre este remito..." className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-y" />
          </div>
        </Card>

        <Card>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-slate-900">Items ({items.length})</h3>
            <Button variant="outline" onClick={() => setUnitSearchOpen(!unitSearchOpen)}>+ Agregar unidad</Button>
          </div>

          {unitSearchOpen && (
            <div className="mb-4 border border-slate-200 rounded-lg p-3 bg-slate-50">
              <input type="text" value={unitSearchTerm} onChange={e => setUnitSearchTerm(e.target.value)}
                placeholder="Buscar por codigo o descripcion..." autoFocus
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                {filteredUnits.length === 0 ? (
                  <p className="text-sm text-slate-400 py-2 italic">No hay unidades disponibles</p>
                ) : filteredUnits.slice(0, 20).map(u => (
                  <button key={u.id} onClick={() => addItem(u)}
                    className="w-full text-left px-3 py-2 hover:bg-indigo-50 transition-colors flex justify-between items-center gap-4">
                    <span className="font-mono text-sm font-semibold text-indigo-600">{u.articuloCodigo}</span>
                    <span className="text-sm text-slate-700 flex-1 truncate">{u.articuloDescripcion}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {items.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No hay items. Use el boton para agregar unidades.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 tracking-tight">Codigo</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 tracking-tight">Descripcion</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 tracking-tight w-24">Cantidad</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 tracking-tight w-40">Tipo</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 tracking-tight w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map(item => (
                    <tr key={item.localId} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-mono text-sm font-semibold text-indigo-600">{item.articuloCodigo}</td>
                      <td className="px-4 py-2 text-sm text-slate-900 truncate max-w-xs">{item.articuloDescripcion}</td>
                      <td className="px-4 py-2">
                        <input type="number" min={1} value={item.cantidad}
                          onChange={e => updateItem(item.localId, 'cantidad', Math.max(1, Number(e.target.value) || 1))}
                          className="w-20 border border-slate-300 rounded-lg px-2 py-1 text-sm" />
                      </td>
                      <td className="px-4 py-2">
                        <select value={item.tipoItem} onChange={e => updateItem(item.localId, 'tipoItem', e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-2 py-1 text-sm">
                          {TIPO_ITEM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <button onClick={() => removeItem(item.localId)} className="text-sm text-red-500 hover:underline font-medium">Quitar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
