import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ordenesCompraService, proveedoresService } from '../../services/firebaseService';
import type { ItemOC, TipoOC, Proveedor } from '@ags/shared';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

type Moneda = 'ARS' | 'USD' | 'EUR';

export const OCEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);

  // Form state
  const [tipo, setTipo] = useState<TipoOC>('nacional');
  const [proveedorId, setProveedorId] = useState('');
  const [proveedorNombre, setProveedorNombre] = useState('');
  const [moneda, setMoneda] = useState<Moneda>('USD');
  const [proformaNumero, setProformaNumero] = useState('');
  const [fechaProforma, setFechaProforma] = useState('');
  const [condicionesPago, setCondicionesPago] = useState('');
  const [fechaEntregaEstimada, setFechaEntregaEstimada] = useState('');
  const [notas, setNotas] = useState('');
  const [items, setItems] = useState<ItemOC[]>([]);

  useEffect(() => { loadInitialData(); }, [id]);

  const loadInitialData = async () => {
    try {
      const provData = await proveedoresService.getAll();
      setProveedores(provData);
      if (isEdit) {
        setLoading(true);
        const oc = await ordenesCompraService.getById(id!);
        if (!oc) { alert('OC no encontrada'); navigate('/stock/ordenes-compra'); return; }
        setTipo(oc.tipo);
        setProveedorId(oc.proveedorId);
        setProveedorNombre(oc.proveedorNombre);
        setMoneda(oc.moneda);
        setProformaNumero(oc.proformaNumero || '');
        setFechaProforma(oc.fechaProforma ? oc.fechaProforma.split('T')[0] : '');
        setCondicionesPago(oc.condicionesPago || '');
        setFechaEntregaEstimada(oc.fechaEntregaEstimada ? oc.fechaEntregaEstimada.split('T')[0] : '');
        setNotas(oc.notas || '');
        setItems(oc.items || []);
      }
    } catch (err) {
      console.error('Error cargando datos:', err);
      alert('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleProveedorChange = (provId: string) => {
    setProveedorId(provId);
    const prov = proveedores.find(p => p.id === provId);
    setProveedorNombre(prov?.nombre || '');
  };

  const addItem = () => {
    setItems(prev => [...prev, {
      id: crypto.randomUUID(), descripcion: '', cantidad: 1, cantidadRecibida: 0,
      unidadMedida: 'unidad', precioUnitario: null, moneda: null, notas: null,
      articuloId: null, articuloCodigo: null, requerimientoId: null,
    }]);
  };

  const updateItem = (itemId: string, field: keyof ItemOC, value: any) => {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, [field]: value } : i));
  };

  const removeItem = (itemId: string) => {
    setItems(prev => prev.filter(i => i.id !== itemId));
  };

  const calcSubtotal = () => items.reduce((s, i) => s + (i.cantidad * (i.precioUnitario || 0)), 0);
  const calcTotal = () => calcSubtotal();

  const handleSave = async () => {
    if (!proveedorId) { alert('Seleccione un proveedor'); return; }
    if (items.length === 0) { alert('Agregue al menos un item'); return; }
    setSaving(true);
    try {
      const payload = {
        tipo, proveedorId, proveedorNombre, moneda, items,
        subtotal: calcSubtotal(), impuestos: null, total: calcTotal(),
        estado: 'borrador' as const,
        proformaNumero: proformaNumero || null,
        fechaProforma: fechaProforma || null,
        condicionesPago: condicionesPago || null,
        fechaEntregaEstimada: fechaEntregaEstimada || null,
        notas: notas || null,
        proformaUrl: null, proformaNombre: null,
        presupuestoIds: [], fechaRecepcion: null, importacionId: null,
        archivoUrl: null, archivoNombre: null,
      };
      if (isEdit) {
        await ordenesCompraService.update(id!, payload);
        navigate(`/stock/ordenes-compra/${id}`);
      } else {
        const newId = await ordenesCompraService.create(payload);
        navigate(`/stock/ordenes-compra/${newId}`);
      }
    } catch (err) {
      console.error('Error guardando OC:', err);
      alert('Error al guardar la orden de compra');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando...</p></div>;
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="shrink-0 bg-white border-b border-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.06)] z-10 px-5 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
            {isEdit ? 'Editar Orden de Compra' : 'Nueva Orden de Compra'}
          </h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/stock/ordenes-compra')}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <Card title="Datos generales" compact>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-0.5">Tipo</label>
              <select value={tipo} onChange={e => setTipo(e.target.value as TipoOC)}
                className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="nacional">Nacional</option>
                <option value="importacion">Importacion</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-0.5">Proveedor</label>
              <select value={proveedorId} onChange={e => handleProveedorChange(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Seleccionar proveedor...</option>
                {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-0.5">Moneda</label>
              <select value={moneda} onChange={e => setMoneda(e.target.value as Moneda)}
                className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <Input inputSize="sm" label="Proforma N." value={proformaNumero} onChange={e => setProformaNumero(e.target.value)} />
            <Input inputSize="sm" label="Fecha proforma" type="date" value={fechaProforma} onChange={e => setFechaProforma(e.target.value)} />
            <Input inputSize="sm" label="Fecha entrega estimada" type="date" value={fechaEntregaEstimada} onChange={e => setFechaEntregaEstimada(e.target.value)} />
            <div className="col-span-2">
              <Input inputSize="sm" label="Condiciones de pago" value={condicionesPago} onChange={e => setCondicionesPago(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] font-medium text-slate-400 mb-0.5">Notas</label>
              <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
                className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        </Card>

        <Card title="Items" compact actions={<Button size="sm" variant="outline" onClick={addItem}>+ Agregar item</Button>}>
          {items.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">No hay items. Haga clic en "+ Agregar item".</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">#</th>
                    <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Descripcion</th>
                    <th className="px-3 py-2 text-right text-[11px] font-medium text-slate-400 tracking-wider w-24">Cantidad</th>
                    <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider w-28">Unidad</th>
                    <th className="px-3 py-2 text-right text-[11px] font-medium text-slate-400 tracking-wider w-28">Precio unit.</th>
                    <th className="px-3 py-2 text-right text-[11px] font-medium text-slate-400 tracking-wider w-28">Subtotal</th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, idx) => (
                    <tr key={item.id}>
                      <td className="px-3 py-1.5 text-xs text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-1.5">
                        <input value={item.descripcion} onChange={e => updateItem(item.id, 'descripcion', e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Descripcion del item" />
                      </td>
                      <td className="px-3 py-1.5">
                        <input type="number" min={1} value={item.cantidad} onChange={e => updateItem(item.id, 'cantidad', Number(e.target.value))}
                          className="w-full text-xs text-right border border-slate-200 rounded px-2 py-1 tabular-nums focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                      </td>
                      <td className="px-3 py-1.5">
                        <input value={item.unidadMedida} onChange={e => updateItem(item.id, 'unidadMedida', e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                      </td>
                      <td className="px-3 py-1.5">
                        <input type="number" min={0} step={0.01} value={item.precioUnitario ?? ''} onChange={e => updateItem(item.id, 'precioUnitario', e.target.value ? Number(e.target.value) : null)}
                          className="w-full text-xs text-right border border-slate-200 rounded px-2 py-1 tabular-nums focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                      </td>
                      <td className="px-3 py-1.5 text-xs text-right text-slate-700 tabular-nums">
                        {(item.cantidad * (item.precioUnitario || 0)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-1.5">
                        <button onClick={() => removeItem(item.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200">
                    <td colSpan={5} className="px-3 py-2 text-xs font-medium text-slate-700 text-right">Total</td>
                    <td className="px-3 py-2 text-xs font-semibold text-slate-900 text-right tabular-nums">
                      {calcTotal().toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
