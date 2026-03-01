import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { presupuestosService, clientesService, sistemasService, categoriasPresupuestoService, condicionesPagoService } from '../../services/firebaseService';
import type { Presupuesto, Cliente, Sistema, PresupuestoItem, CategoriaPresupuesto, CondicionPago } from '@ags/shared';
import { Button } from '../../components/ui/Button';
import { PresupuestoSidebar } from '../../components/presupuestos/PresupuestoSidebar';
import { PresupuestoItemsTable } from '../../components/presupuestos/PresupuestoItemsTable';

const estadoLabels: Record<Presupuesto['estado'], string> = {
  borrador: 'Borrador',
  enviado: 'Enviado',
  en_seguimiento: 'En Seguimiento',
  pendiente_oc: 'Pendiente OC',
  aceptado: 'Aceptado',
  pendiente_certificacion: 'Pendiente Cert.',
  aguarda: 'Aguarda',
};

const estadoColors: Record<Presupuesto['estado'], string> = {
  borrador: 'bg-slate-100 text-slate-700',
  enviado: 'bg-blue-100 text-blue-700',
  en_seguimiento: 'bg-yellow-100 text-yellow-700',
  pendiente_oc: 'bg-orange-100 text-orange-700',
  aceptado: 'bg-green-100 text-green-700',
  pendiente_certificacion: 'bg-purple-100 text-purple-700',
  aguarda: 'bg-red-100 text-red-700',
};

export const PresupuestoDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Related data
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [sistema, setSistema] = useState<Sistema | null>(null);
  const [categoriasPresupuesto, setCategoriasPresupuesto] = useState<CategoriaPresupuesto[]>([]);
  const [condicionesPago, setCondicionesPago] = useState<CondicionPago[]>([]);

  // Editable state
  const [numero, setNumero] = useState('');
  const [estado, setEstado] = useState<Presupuesto['estado']>('borrador');
  const [items, setItems] = useState<PresupuestoItem[]>([]);
  const [tipoCambio, setTipoCambio] = useState<number | undefined>();
  const [condicionPagoId, setCondicionPagoId] = useState<string | undefined>();
  const [notasTecnicas, setNotasTecnicas] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [fechaEnvio, setFechaEnvio] = useState('');

  // Autosave
  const hasUserInteracted = useRef(false);
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { if (id) loadData(); }, [id]);

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
      setNumero(presupuestoData.numero);
      setEstado(presupuestoData.estado);
      setItems(presupuestoData.items || []);
      setTipoCambio(presupuestoData.tipoCambio);
      setCondicionPagoId(presupuestoData.condicionPagoId);
      setNotasTecnicas(presupuestoData.notasTecnicas || '');
      setValidUntil(presupuestoData.validUntil ? presupuestoData.validUntil.split('T')[0] : '');
      setFechaEnvio(presupuestoData.fechaEnvio ? presupuestoData.fechaEnvio.split('T')[0] : '');

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

  // Autosave debounce
  useEffect(() => {
    if (!hasUserInteracted.current || !id || loading) return;
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    autosaveTimeoutRef.current = setTimeout(() => handleSave(), 1000);
    return () => { if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current); };
  }, [estado, items, tipoCambio, condicionPagoId, notasTecnicas, validUntil, fechaEnvio, id, loading]);

  const calculateItemTaxes = (item: PresupuestoItem) => {
    const cat = categoriasPresupuesto.find(c => c.id === item.categoriaPresupuestoId);
    if (!cat) return { iva: 0, ganancias: 0, iibb: 0, totalImpuestos: 0 };
    const sub = item.subtotal || 0;
    let iva = 0, ganancias = 0, iibb = 0;
    if (cat.incluyeIva && cat.porcentajeIva) {
      iva = cat.ivaReduccion && cat.porcentajeIvaReduccion
        ? sub * (cat.porcentajeIvaReduccion / 100)
        : sub * (cat.porcentajeIva / 100);
    }
    if (cat.incluyeGanancias && cat.porcentajeGanancias) ganancias = (sub + iva) * (cat.porcentajeGanancias / 100);
    if (cat.incluyeIIBB && cat.porcentajeIIBB) iibb = (sub + iva) * (cat.porcentajeIIBB / 100);
    return { iva, ganancias, iibb, totalImpuestos: iva + ganancias + iibb };
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((s, i) => s + (i.subtotal || 0), 0);
    let totalIva = 0, totalGanancias = 0, totalIIBB = 0;
    items.forEach(i => { const t = calculateItemTaxes(i); totalIva += t.iva; totalGanancias += t.ganancias; totalIIBB += t.iibb; });
    const totalImpuestos = totalIva + totalGanancias + totalIIBB;
    return { subtotal, iva: totalIva, ganancias: totalGanancias, iibb: totalIIBB, totalImpuestos, total: subtotal + totalImpuestos };
  };

  const handleSave = async () => {
    if (!id) return;
    try {
      setSaving(true);
      const totals = calculateTotals();
      let fechaEnvioToSave = fechaEnvio;
      if (estado === 'enviado' && !fechaEnvio) {
        fechaEnvioToSave = new Date().toISOString().split('T')[0];
        setFechaEnvio(fechaEnvioToSave);
      }
      await presupuestosService.update(id, {
        estado, items, subtotal: totals.subtotal, total: totals.total,
        tipoCambio: tipoCambio || undefined, condicionPagoId: condicionPagoId || undefined,
        notasTecnicas: notasTecnicas || undefined, validUntil: validUntil || undefined,
        fechaEnvio: fechaEnvioToSave || undefined,
      });
      console.log('Presupuesto guardado');
    } catch (error) {
      console.error('Error guardando presupuesto:', error);
      alert('Error al guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  const markUserInteracted = () => { if (!hasUserInteracted.current) hasUserInteracted.current = true; };

  const handleEstadoChange = (newEstado: Presupuesto['estado']) => {
    setEstado(newEstado);
    if (newEstado === 'enviado' && !fechaEnvio) setFechaEnvio(new Date().toISOString().split('T')[0]);
    markUserInteracted();
  };

  const updateItem = (itemId: string, field: keyof PresupuestoItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const updated = { ...item, [field]: value };
      if (field === 'cantidad' || field === 'precioUnitario') updated.subtotal = updated.cantidad * updated.precioUnitario;
      return updated;
    }));
    markUserInteracted();
  };

  const addItem = (item: PresupuestoItem) => { setItems(prev => [...prev, item]); markUserInteracted(); };
  const removeItem = (itemId: string) => { setItems(prev => prev.filter(i => i.id !== itemId)); markUserInteracted(); };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando presupuesto...</p></div>;
  }

  const totals = calculateTotals();

  return (
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col bg-slate-50">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.06)] z-10 px-5 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/presupuestos')} className="text-slate-400 hover:text-slate-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900 tracking-tight">{numero || 'Presupuesto'}</h2>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${estadoColors[estado]}`}>
                  {estadoLabels[estado]}
                </span>
              </div>
              <p className="text-xs text-slate-400">{cliente?.razonSocial || ''}{sistema ? ` · ${sistema.nombre}` : ''}</p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            {saving && <span className="text-[11px] text-slate-400">Guardando...</span>}
            <Button variant="outline" size="sm" onClick={() => navigate('/presupuestos')}>Volver</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
          </div>
        </div>
      </div>

      {/* 2-column body */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="flex gap-5">
          <PresupuestoSidebar
            estado={estado}
            cliente={cliente}
            sistema={sistema}
            totals={totals}
            tipoCambio={tipoCambio}
            condicionPagoId={condicionPagoId}
            condicionesPago={condicionesPago}
            validUntil={validUntil}
            fechaEnvio={fechaEnvio}
            onEstadoChange={handleEstadoChange}
            onTipoCambioChange={(v) => { setTipoCambio(v); markUserInteracted(); }}
            onCondicionPagoIdChange={(v) => { setCondicionPagoId(v); markUserInteracted(); }}
            onValidUntilChange={(v) => { setValidUntil(v); markUserInteracted(); }}
            onFechaEnvioChange={(v) => { setFechaEnvio(v); markUserInteracted(); }}
          />
          <PresupuestoItemsTable
            items={items}
            categoriasPresupuesto={categoriasPresupuesto}
            totals={totals}
            notasTecnicas={notasTecnicas}
            onAddItem={addItem}
            onUpdateItem={updateItem}
            onRemoveItem={removeItem}
            onNotasTecnicasChange={(v) => { setNotasTecnicas(v); markUserInteracted(); }}
            calculateItemTaxes={calculateItemTaxes}
          />
        </div>
      </div>
    </div>
  );
};
