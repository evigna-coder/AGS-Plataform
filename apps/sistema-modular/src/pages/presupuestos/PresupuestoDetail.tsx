import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { presupuestosService, clientesService, sistemasService, contactosService, categoriasPresupuestoService, condicionesPagoService } from '../../services/firebaseService';
import type { Presupuesto, Cliente, Sistema, PresupuestoItem, CategoriaPresupuesto, CondicionPago } from '@ags/shared';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SearchableSelect } from '../../components/ui/SearchableSelect';

const estadoLabels: Record<Presupuesto['estado'], string> = {
  borrador: 'Borrador',
  enviado: 'Enviado',
  en_seguimiento: 'En Seguimiento',
  pendiente_oc: 'Pendiente OC',
  aceptado: 'Aceptado',
  pendiente_certificacion: 'Pendiente Certificación',
  aguarda: 'Aguarda',
};

const estadoColors: Record<Presupuesto['estado'], string> = {
  borrador: 'bg-slate-100 text-slate-800',
  enviado: 'bg-blue-100 text-blue-800',
  en_seguimiento: 'bg-yellow-100 text-yellow-800',
  pendiente_oc: 'bg-orange-100 text-orange-800',
  aceptado: 'bg-green-100 text-green-800',
  pendiente_certificacion: 'bg-purple-100 text-purple-800',
  aguarda: 'bg-red-100 text-red-800',
};

export const PresupuestoDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Datos relacionados
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [sistema, setSistema] = useState<Sistema | null>(null);
  const [categoriasPresupuesto, setCategoriasPresupuesto] = useState<CategoriaPresupuesto[]>([]);
  const [condicionesPago, setCondicionesPago] = useState<CondicionPago[]>([]);
  
  // Estados editables
  const [numero, setNumero] = useState('');
  const [estado, setEstado] = useState<Presupuesto['estado']>('borrador');
  const [items, setItems] = useState<PresupuestoItem[]>([]);
  const [tipoCambio, setTipoCambio] = useState<number | undefined>();
  const [condicionPagoId, setCondicionPagoId] = useState<string | undefined>();
  const [notasTecnicas, setNotasTecnicas] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [fechaEnvio, setFechaEnvio] = useState('');
  
  // Control de autosave
  const hasUserInteracted = useRef(false);
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Modal para nuevo item
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [newItem, setNewItem] = useState<Partial<PresupuestoItem>>({
    descripcion: '',
    cantidad: 1,
    unidad: 'unidad',
    precioUnitario: 0,
    categoriaPresupuestoId: undefined,
  });

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [presupuestoData, categoriasData, condicionesData] = await Promise.all([
        presupuestosService.getById(id),
        categoriasPresupuestoService.getAll(),
        condicionesPagoService.getAll(),
      ]);
      
      if (!presupuestoData) {
        alert('Presupuesto no encontrado');
        navigate('/presupuestos');
        return;
      }
      
      // Cargar estados editables
      setNumero(presupuestoData.numero);
      setEstado(presupuestoData.estado);
      setItems(presupuestoData.items || []);
      setTipoCambio(presupuestoData.tipoCambio);
      setCondicionPagoId(presupuestoData.condicionPagoId);
      setNotasTecnicas(presupuestoData.notasTecnicas || '');
      setValidUntil(presupuestoData.validUntil ? presupuestoData.validUntil.split('T')[0] : '');
      setFechaEnvio(presupuestoData.fechaEnvio ? presupuestoData.fechaEnvio.split('T')[0] : '');

      // Cargar datos relacionados
      if (presupuestoData.clienteId) {
        const clienteData = await clientesService.getById(presupuestoData.clienteId);
        setCliente(clienteData);
      }
      if (presupuestoData.sistemaId) {
        const sistemaData = await sistemasService.getById(presupuestoData.sistemaId);
        setSistema(sistemaData);
      }
      
      setCategoriasPresupuesto(categoriasData);
      setCondicionesPago(condicionesData);
      
      hasUserInteracted.current = false;
    } catch (error) {
      console.error('Error cargando presupuesto:', error);
      alert('Error al cargar el presupuesto');
    } finally {
      setLoading(false);
    }
  };

  // Autosave con debounce
  useEffect(() => {
    if (!hasUserInteracted.current || !id || loading) return;
    
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }
    
    autosaveTimeoutRef.current = setTimeout(async () => {
      await handleSave();
    }, 1000);
    
    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [estado, items, tipoCambio, condicionPagoId, notasTecnicas, validUntil, fechaEnvio, id, loading]);

  // Calcular impuestos por item según su categoría
  const calculateItemTaxes = (item: PresupuestoItem) => {
    if (!item.categoriaPresupuestoId) {
      return { iva: 0, ganancias: 0, iibb: 0, totalImpuestos: 0 };
    }
    
    const categoria = categoriasPresupuesto.find(c => c.id === item.categoriaPresupuestoId);
    if (!categoria) {
      return { iva: 0, ganancias: 0, iibb: 0, totalImpuestos: 0 };
    }
    
    const subtotal = item.subtotal || 0;
    let iva = 0;
    let ganancias = 0;
    let iibb = 0;
    
    // Calcular IVA
    if (categoria.incluyeIva && categoria.porcentajeIva) {
      if (categoria.ivaReduccion && categoria.porcentajeIvaReduccion) {
        iva = subtotal * (categoria.porcentajeIvaReduccion / 100);
      } else {
        iva = subtotal * (categoria.porcentajeIva / 100);
      }
    }
    
    // Calcular Ganancias (sobre subtotal + IVA)
    if (categoria.incluyeGanancias && categoria.porcentajeGanancias) {
      ganancias = (subtotal + iva) * (categoria.porcentajeGanancias / 100);
    }
    
    // Calcular IIBB (sobre subtotal + IVA)
    if (categoria.incluyeIIBB && categoria.porcentajeIIBB) {
      iibb = (subtotal + iva) * (categoria.porcentajeIIBB / 100);
    }
    
    return {
      iva,
      ganancias,
      iibb,
      totalImpuestos: iva + ganancias + iibb,
    };
  };

  // Calcular totales del presupuesto
  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    
    let totalIva = 0;
    let totalGanancias = 0;
    let totalIIBB = 0;
    
    items.forEach(item => {
      const taxes = calculateItemTaxes(item);
      totalIva += taxes.iva;
      totalGanancias += taxes.ganancias;
      totalIIBB += taxes.iibb;
    });
    
    const totalImpuestos = totalIva + totalGanancias + totalIIBB;
    const total = subtotal + totalImpuestos;
    
    return {
      subtotal,
      iva: totalIva,
      ganancias: totalGanancias,
      iibb: totalIIBB,
      totalImpuestos,
      total,
    };
  };

  const handleSave = async () => {
    if (!id) return;
    
    try {
      setSaving(true);
      
      // Calcular subtotal y total con impuestos
      const totals = calculateTotals();
      
      // Si el estado cambia a "enviado" y no hay fechaEnvio, establecerla automáticamente
      let fechaEnvioToSave = fechaEnvio;
      if (estado === 'enviado' && !fechaEnvio) {
        fechaEnvioToSave = new Date().toISOString().split('T')[0];
        setFechaEnvio(fechaEnvioToSave);
      }
      
      const updateData: Partial<Presupuesto> = {
        estado,
        items,
        subtotal: totals.subtotal,
        total: totals.total,
        tipoCambio: tipoCambio || undefined,
        condicionPagoId: condicionPagoId || undefined,
        notasTecnicas: notasTecnicas || undefined,
        validUntil: validUntil || undefined,
        fechaEnvio: fechaEnvioToSave || undefined,
      };
      
      await presupuestosService.update(id, updateData);
      console.log('✅ Presupuesto guardado automáticamente');
    } catch (error) {
      console.error('Error guardando presupuesto:', error);
      alert('Error al guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  const markUserInteracted = () => {
    if (!hasUserInteracted.current) {
      hasUserInteracted.current = true;
    }
  };

  // Funciones para gestionar items
  const addItem = () => {
    setShowNewItemModal(true);
    setNewItem({
      descripcion: '',
      cantidad: 1,
      unidad: 'unidad',
      precioUnitario: 0,
      categoriaPresupuestoId: undefined,
    });
  };

  const handleAddItem = () => {
    if (!newItem.descripcion || !newItem.cantidad || !newItem.precioUnitario) {
      alert('Complete descripción, cantidad y precio unitario');
      return;
    }
    
    const subtotal = (newItem.cantidad || 0) * (newItem.precioUnitario || 0);
    const item: PresupuestoItem = {
      id: `item-${Date.now()}`,
      descripcion: newItem.descripcion,
      cantidad: newItem.cantidad || 1,
      unidad: newItem.unidad || 'unidad',
      precioUnitario: newItem.precioUnitario || 0,
      categoriaPresupuestoId: newItem.categoriaPresupuestoId,
      subtotal,
    };
    
    setItems([...items, item]);
    setShowNewItemModal(false);
    markUserInteracted();
  };

  const updateItem = (itemId: string, field: keyof PresupuestoItem, value: any) => {
    const updated = items.map(item => {
      if (item.id === itemId) {
        const updatedItem = { ...item, [field]: value };
        // Recalcular subtotal si cambia cantidad o precio
        if (field === 'cantidad' || field === 'precioUnitario') {
          updatedItem.subtotal = updatedItem.cantidad * updatedItem.precioUnitario;
        }
        return updatedItem;
      }
      return item;
    });
    setItems(updated);
    markUserInteracted();
  };

  const removeItem = (itemId: string) => {
    setItems(items.filter(item => item.id !== itemId));
    markUserInteracted();
  };

  const handleEstadoChange = (newEstado: Presupuesto['estado']) => {
    setEstado(newEstado);
    // Si cambia a "enviado" y no hay fechaEnvio, establecerla automáticamente
    if (newEstado === 'enviado' && !fechaEnvio) {
      setFechaEnvio(new Date().toISOString().split('T')[0]);
    }
    markUserInteracted();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-400">Cargando presupuesto...</p>
      </div>
    );
  }

  const totals = calculateTotals();
  const condicionPagoSeleccionada = condicionesPago.find(c => c.id === condicionPagoId);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-32">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-blue-700 uppercase tracking-tight">
            {numero || 'Nuevo Presupuesto'}
          </h2>
          <p className="text-sm text-slate-500 mt-1">Editor completo de presupuesto</p>
        </div>
        <div className="flex gap-2 items-center">
          {saving && (
            <span className="text-xs text-slate-500">Guardando...</span>
          )}
          <Button variant="outline" onClick={() => navigate('/presupuestos')}>
            Volver
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>

      {/* Estado y Totales */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${estadoColors[estado]}`}>
              {estadoLabels[estado]}
            </span>
            <SearchableSelect
              value={estado}
              onChange={(value) => handleEstadoChange(value as Presupuesto['estado'])}
              options={Object.entries(estadoLabels).map(([value, label]) => ({ value, label }))}
              placeholder="Seleccionar estado..."
            />
          </div>
        </div>
        
        {/* Desglose de Totales */}
        <div className="border-t pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-500 uppercase font-bold mb-1">Subtotal</p>
              <p className="text-lg font-black text-slate-900">
                ${totals.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            {totals.iva > 0 && (
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold mb-1">IVA</p>
                <p className="text-lg font-bold text-slate-700">
                  ${totals.iva.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            )}
            {totals.ganancias > 0 && (
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold mb-1">Ganancias</p>
                <p className="text-lg font-bold text-slate-700">
                  ${totals.ganancias.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            )}
            {totals.iibb > 0 && (
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold mb-1">IIBB</p>
                <p className="text-lg font-bold text-slate-700">
                  ${totals.iibb.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            )}
          </div>
          <div className="mt-4 pt-4 border-t">
            <div className="flex justify-between items-center">
              <p className="text-sm text-slate-500 uppercase font-bold">Total</p>
              <p className="text-2xl font-black text-blue-700">
                ${totals.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            {condicionPagoSeleccionada && (
              <p className="text-xs text-slate-500 mt-2">
                Condición de pago: <span className="font-bold">{condicionPagoSeleccionada.nombre}</span>
                {condicionPagoSeleccionada.dias > 0 && (
                  <span className="ml-2">({condicionPagoSeleccionada.dias} días desde factura)</span>
                )}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Información del Cliente y Sistema */}
      <Card>
        <h3 className="text-sm font-black text-slate-600 uppercase mb-4">Información del Presupuesto</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Cliente</label>
            <p className="text-sm font-bold text-slate-900">{cliente?.razonSocial || 'Cliente no encontrado'}</p>
            {cliente && (
              <Link to={`/clientes/${cliente.id}`} className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                Ver cliente completo →
              </Link>
            )}
          </div>
          {sistema && (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Sistema</label>
              <p className="text-sm text-slate-700">{sistema.nombre}</p>
              <Link to={`/equipos/${sistema.id}`} className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                Ver sistema completo →
              </Link>
            </div>
          )}
        </div>
      </Card>

      {/* Items del Presupuesto */}
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-black text-slate-600 uppercase">Items del Presupuesto</h3>
          <Button onClick={addItem} size="sm">
            + Agregar Item
          </Button>
        </div>
        
        {items.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-400">No hay items en el presupuesto</p>
            <Button className="mt-4" onClick={addItem} size="sm">
              Agregar primer item
            </Button>
          </div>
        ) : (
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 font-black text-slate-400 uppercase text-[9px]">
                <tr>
                  <th className="px-4 py-2 text-left">Descripción</th>
                  <th className="px-4 py-2 text-center w-20">Cant.</th>
                  <th className="px-4 py-2 text-left w-24">Unidad</th>
                  <th className="px-4 py-2 text-right w-28">P. Unit.</th>
                  <th className="px-4 py-2 text-right w-28">Subtotal</th>
                  <th className="px-4 py-2 text-left w-32">Categoría</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-1.5">
                      <input
                        value={item.descripcion}
                        onChange={e => updateItem(item.id, 'descripcion', e.target.value)}
                        className="w-full outline-none bg-transparent"
                        placeholder="Descripción del item..."
                      />
                    </td>
                    <td className="px-4 py-1.5">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.cantidad}
                        onChange={e => updateItem(item.id, 'cantidad', Number(e.target.value) || 0)}
                        className="w-full outline-none text-center bg-transparent"
                      />
                    </td>
                    <td className="px-4 py-1.5">
                      <input
                        value={item.unidad}
                        onChange={e => updateItem(item.id, 'unidad', e.target.value)}
                        className="w-full outline-none bg-transparent"
                        placeholder="unidad"
                      />
                    </td>
                    <td className="px-4 py-1.5">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.precioUnitario}
                        onChange={e => updateItem(item.id, 'precioUnitario', Number(e.target.value) || 0)}
                        className="w-full outline-none text-right bg-transparent"
                      />
                    </td>
                    <td className="px-4 py-1.5 text-right font-bold">
                      ${item.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-1.5">
                      <SearchableSelect
                        value={item.categoriaPresupuestoId || ''}
                        onChange={(value) => updateItem(item.id, 'categoriaPresupuestoId', value || undefined)}
                        options={[
                          { value: '', label: 'Sin categoría' },
                          ...categoriasPresupuesto.filter(c => c.activo).map(c => ({ value: c.id, label: c.nombre }))
                        ]}
                        placeholder="Categoría..."
                      />
                      {item.categoriaPresupuestoId && (() => {
                        const categoria = categoriasPresupuesto.find(c => c.id === item.categoriaPresupuestoId);
                        const taxes = calculateItemTaxes(item);
                        if (categoria && taxes.totalImpuestos > 0) {
                          return (
                            <div className="text-[9px] text-slate-500 mt-0.5">
                              Imp: ${taxes.totalImpuestos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </td>
                    <td className="text-center">
                      <button
                        onClick={() => removeItem(item.id)}
                        className="font-bold text-red-400 hover:text-red-600"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td colSpan={4} className="px-4 py-2 text-right font-black text-sm">
                    SUBTOTAL:
                  </td>
                  <td className="px-4 py-2 text-right font-black text-lg">
                    ${totals.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </td>
                  <td colSpan={2}></td>
                </tr>
                {totals.iva > 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-2 text-right font-bold text-xs text-slate-600">
                      IVA:
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-sm text-slate-700">
                      ${totals.iva.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                )}
                {totals.ganancias > 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-2 text-right font-bold text-xs text-slate-600">
                      GANANCIAS:
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-sm text-slate-700">
                      ${totals.ganancias.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                )}
                {totals.iibb > 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-2 text-right font-bold text-xs text-slate-600">
                      IIBB:
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-sm text-slate-700">
                      ${totals.iibb.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                )}
                <tr className="bg-blue-50">
                  <td colSpan={4} className="px-4 py-2 text-right font-black text-base text-blue-900">
                    TOTAL:
                  </td>
                  <td className="px-4 py-2 text-right font-black text-xl text-blue-700">
                    ${totals.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* Campos adicionales */}
      <Card>
        <h3 className="text-sm font-black text-slate-600 uppercase mb-4">Información Adicional</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Tipo de Cambio</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={tipoCambio || ''}
                onChange={(e) => { setTipoCambio(e.target.value ? Number(e.target.value) : undefined); markUserInteracted(); }}
                placeholder="Ej: 1.0"
                className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white border-slate-300"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Condición de Pago</label>
              <SearchableSelect
                value={condicionPagoId || ''}
                onChange={(value) => { setCondicionPagoId(value || undefined); markUserInteracted(); }}
                options={[
                  { value: '', label: 'Sin condición específica' },
                  ...condicionesPago.filter(c => c.activo).map(c => ({ 
                    value: c.id, 
                    label: `${c.nombre}${c.dias > 0 ? ` (${c.dias} días)` : ' (Contado)'}` 
                  }))
                ]}
                placeholder="Seleccionar condición..."
              />
              <Link to="/presupuestos/condiciones-pago" className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                Gestionar condiciones →
              </Link>
              {condicionPagoSeleccionada && condicionPagoSeleccionada.descripcion && (
                <p className="text-xs text-slate-500 mt-1 italic">{condicionPagoSeleccionada.descripcion}</p>
              )}
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Válido Hasta</label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => { setValidUntil(e.target.value); markUserInteracted(); }}
                className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white border-slate-300"
              />
            </div>
          </div>
          {estado === 'enviado' && (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Fecha de Envío</label>
              <input
                type="date"
                value={fechaEnvio}
                onChange={(e) => { setFechaEnvio(e.target.value); markUserInteracted(); }}
                className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white border-slate-300"
              />
            </div>
          )}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Notas Técnicas</label>
            <textarea
              value={notasTecnicas}
              onChange={(e) => { setNotasTecnicas(e.target.value); markUserInteracted(); }}
              rows={4}
              placeholder="Notas técnicas, observaciones, condiciones especiales..."
              className="w-full border rounded-xl px-4 py-3 text-sm outline-none bg-white border-slate-200 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </Card>

      {/* Modal para agregar nuevo item */}
      {showNewItemModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-black text-slate-900 uppercase mb-4">Agregar Item al Presupuesto</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Descripción *</label>
                <textarea
                  value={newItem.descripcion}
                  onChange={(e) => setNewItem({ ...newItem, descripcion: e.target.value })}
                  rows={3}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="Descripción detallada del item..."
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Cantidad *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newItem.cantidad || ''}
                    onChange={(e) => setNewItem({ ...newItem, cantidad: Number(e.target.value) || 0 })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Unidad</label>
                  <input
                    value={newItem.unidad || 'unidad'}
                    onChange={(e) => setNewItem({ ...newItem, unidad: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="unidad, hora, servicio..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Precio Unitario *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newItem.precioUnitario || ''}
                    onChange={(e) => setNewItem({ ...newItem, precioUnitario: Number(e.target.value) || 0 })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Categoría (para reglas tributarias)</label>
                <SearchableSelect
                  value={newItem.categoriaPresupuestoId || ''}
                  onChange={(value) => setNewItem({ ...newItem, categoriaPresupuestoId: value || undefined })}
                  options={[
                    { value: '', label: 'Sin categoría' },
                    ...categoriasPresupuesto.filter(c => c.activo).map(c => ({ value: c.id, label: c.nombre }))
                  ]}
                  placeholder="Seleccionar categoría..."
                />
                <Link to="/presupuestos/categorias" className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                  Gestionar categorías →
                </Link>
                {newItem.categoriaPresupuestoId && (() => {
                  const categoria = categoriasPresupuesto.find(c => c.id === newItem.categoriaPresupuestoId);
                  if (categoria) {
                    const subtotal = (newItem.cantidad || 0) * (newItem.precioUnitario || 0);
                    let iva = 0;
                    let ganancias = 0;
                    let iibb = 0;
                    
                    if (categoria.incluyeIva && categoria.porcentajeIva) {
                      if (categoria.ivaReduccion && categoria.porcentajeIvaReduccion) {
                        iva = subtotal * (categoria.porcentajeIvaReduccion / 100);
                      } else {
                        iva = subtotal * (categoria.porcentajeIva / 100);
                      }
                    }
                    if (categoria.incluyeGanancias && categoria.porcentajeGanancias) {
                      ganancias = (subtotal + iva) * (categoria.porcentajeGanancias / 100);
                    }
                    if (categoria.incluyeIIBB && categoria.porcentajeIIBB) {
                      iibb = (subtotal + iva) * (categoria.porcentajeIIBB / 100);
                    }
                    
                    const totalImpuestos = iva + ganancias + iibb;
                    const total = subtotal + totalImpuestos;
                    
                    return (
                      <div className="mt-2 bg-blue-50 p-3 rounded-lg text-xs">
                        <p className="font-bold text-slate-700 mb-1">Cálculo con categoría "{categoria.nombre}":</p>
                        <div className="space-y-0.5">
                          <p>Subtotal: ${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                          {iva > 0 && <p>IVA ({categoria.ivaReduccion && categoria.porcentajeIvaReduccion ? categoria.porcentajeIvaReduccion : categoria.porcentajeIva}%): ${iva.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>}
                          {ganancias > 0 && <p>Ganancias ({categoria.porcentajeGanancias}%): ${ganancias.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>}
                          {iibb > 0 && <p>IIBB ({categoria.porcentajeIIBB}%): ${iibb.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>}
                          <p className="font-bold text-blue-700 mt-1">Total: ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
              {newItem.cantidad && newItem.precioUnitario && !newItem.categoriaPresupuestoId && (
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-sm font-bold text-slate-700">
                    Subtotal: ${((newItem.cantidad || 0) * (newItem.precioUnitario || 0)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Seleccione una categoría para ver el cálculo con impuestos</p>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowNewItemModal(false)}
              >
                Cancelar
              </Button>
              <Button onClick={handleAddItem}>
                Agregar Item
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
