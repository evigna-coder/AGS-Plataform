import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { presupuestosService, clientesService, sistemasService, categoriasPresupuestoService, condicionesPagoService, conceptosServicioService } from '../../services/firebaseService';
import type { Presupuesto, Cliente, Sistema, PresupuestoItem, CategoriaPresupuesto, CondicionPago, ConceptoServicio, TipoPresupuesto, MonedaPresupuesto, AdjuntoPresupuesto } from '@ags/shared';
import { ESTADO_PRESUPUESTO_LABELS, ESTADO_PRESUPUESTO_COLORS } from '@ags/shared';
import { Button } from '../../components/ui/Button';
import { CrearPostaModal } from '../../components/postas/CrearPostaModal';
import { PresupuestoSidebar } from '../../components/presupuestos/PresupuestoSidebar';
import { PresupuestoItemsTable } from '../../components/presupuestos/PresupuestoItemsTable';
import { PresupuestoAdjuntosSection } from '../../components/presupuestos/PresupuestoAdjuntosSection';

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
  const [conceptosServicio, setConceptosServicio] = useState<ConceptoServicio[]>([]);

  // Editable state
  const [numero, setNumero] = useState('');
  const [estado, setEstado] = useState<Presupuesto['estado']>('borrador');
  const [tipo, setTipo] = useState<TipoPresupuesto>('servicio');
  const [moneda, setMoneda] = useState<MonedaPresupuesto>('USD');
  const [origenTipo, setOrigenTipo] = useState<string | null>(null);
  const [origenId, setOrigenId] = useState<string | null>(null);
  const [origenRef, setOrigenRef] = useState<string | null>(null);
  const [items, setItems] = useState<PresupuestoItem[]>([]);
  const [tipoCambio, setTipoCambio] = useState<number | undefined>();
  const [condicionPagoId, setCondicionPagoId] = useState<string | undefined>();
  const [notasTecnicas, setNotasTecnicas] = useState('');
  const [condicionesComerciales, setCondicionesComerciales] = useState('');
  const [validezDias, setValidezDias] = useState(15);
  const [validUntil, setValidUntil] = useState('');
  const [fechaEnvio, setFechaEnvio] = useState('');
  const [adjuntos, setAdjuntos] = useState<AdjuntoPresupuesto[]>([]);
  const [showCrearPosta, setShowCrearPosta] = useState(false);

  // Autosave
  const hasUserInteracted = useRef(false);
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { if (id) loadData(); }, [id]);

  const loadData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [presupuestoData, categoriasData, condicionesData, conceptosData] = await Promise.all([
        presupuestosService.getById(id),
        categoriasPresupuestoService.getAll(),
        condicionesPagoService.getAll(),
        conceptosServicioService.getAll(),
      ]);
      if (!presupuestoData) {
        alert('Presupuesto no encontrado');
        navigate('/presupuestos');
        return;
      }
      setNumero(presupuestoData.numero);
      setEstado(presupuestoData.estado);
      setTipo(presupuestoData.tipo || 'servicio');
      setMoneda(presupuestoData.moneda || 'USD');
      setOrigenTipo(presupuestoData.origenTipo || null);
      setOrigenId(presupuestoData.origenId || null);
      setOrigenRef(presupuestoData.origenRef || null);
      setItems(presupuestoData.items || []);
      setTipoCambio(presupuestoData.tipoCambio);
      setCondicionPagoId(presupuestoData.condicionPagoId);
      setNotasTecnicas(presupuestoData.notasTecnicas || '');
      setCondicionesComerciales(presupuestoData.condicionesComerciales || '');
      setValidezDias(presupuestoData.validezDias ?? 15);
      setValidUntil(presupuestoData.validUntil ? presupuestoData.validUntil.split('T')[0] : '');
      setFechaEnvio(presupuestoData.fechaEnvio ? presupuestoData.fechaEnvio.split('T')[0] : '');
      setAdjuntos(presupuestoData.adjuntos || []);

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
      setConceptosServicio(conceptosData);
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
  }, [estado, tipo, moneda, items, tipoCambio, condicionPagoId, notasTecnicas, condicionesComerciales, validezDias, validUntil, fechaEnvio, adjuntos, id, loading]);

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
        estado, tipo, moneda, items,
        subtotal: totals.subtotal, total: totals.total,
        tipoCambio: tipoCambio || null,
        condicionPagoId: condicionPagoId || null,
        notasTecnicas: notasTecnicas || null,
        condicionesComerciales: condicionesComerciales || null,
        validezDias,
        validUntil: validUntil || null,
        fechaEnvio: fechaEnvioToSave || null,
        adjuntos,
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

  const handleAddAdjunto = (adjunto: AdjuntoPresupuesto) => {
    setAdjuntos(prev => [...prev, adjunto]);
    markUserInteracted();
  };

  const handleRemoveAdjunto = (adjId: string) => {
    setAdjuntos(prev => prev.filter(a => a.id !== adjId));
    markUserInteracted();
  };

  const handleSuggestAutorizado = () => {
    if (estado !== 'autorizado' && confirm('Se adjunto una orden de compra. Cambiar estado a "Autorizado"?')) {
      setEstado('autorizado');
      markUserInteracted();
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando presupuesto...</p></div>;
  }

  const totals = calculateTotals();

  return (
    <div className="h-full flex flex-col bg-slate-50">
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
                <h2 className="text-lg font-semibold text-slate-900 tracking-tight">{numero || 'Presupuesto'}</h2>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_PRESUPUESTO_COLORS[estado]}`}>
                  {ESTADO_PRESUPUESTO_LABELS[estado]}
                </span>
              </div>
              <p className="text-xs text-slate-400">{cliente?.razonSocial || ''}{sistema ? ` · ${sistema.nombre}` : ''}</p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            {saving && <span className="text-[11px] text-slate-400">Guardando...</span>}
            <Button variant="outline" size="sm" onClick={() => setShowCrearPosta(true)}>Crear posta</Button>
            {estado === 'autorizado' && (
              <Button variant="outline" size="sm" onClick={() => navigate(`/ordenes-trabajo/nuevo?presupuestoId=${id}`)}>Crear OT</Button>
            )}
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
            tipo={tipo}
            moneda={moneda}
            cliente={cliente}
            sistema={sistema}
            origenTipo={origenTipo}
            origenId={origenId}
            origenRef={origenRef}
            totals={totals}
            tipoCambio={tipoCambio}
            condicionPagoId={condicionPagoId}
            condicionesPago={condicionesPago}
            validezDias={validezDias}
            validUntil={validUntil}
            fechaEnvio={fechaEnvio}
            onEstadoChange={handleEstadoChange}
            onTipoChange={(v) => { setTipo(v); markUserInteracted(); }}
            onMonedaChange={(v) => { setMoneda(v); markUserInteracted(); }}
            onTipoCambioChange={(v) => { setTipoCambio(v); markUserInteracted(); }}
            onCondicionPagoIdChange={(v) => { setCondicionPagoId(v); markUserInteracted(); }}
            onValidezDiasChange={(v) => { setValidezDias(v); markUserInteracted(); }}
            onValidUntilChange={(v) => { setValidUntil(v); markUserInteracted(); }}
            onFechaEnvioChange={(v) => { setFechaEnvio(v); markUserInteracted(); }}
          />
          <div className="flex-1 min-w-0 space-y-4">
            <PresupuestoItemsTable
              items={items}
              categoriasPresupuesto={categoriasPresupuesto}
              conceptosServicio={conceptosServicio}
              moneda={moneda}
              totals={totals}
              notasTecnicas={notasTecnicas}
              condicionesComerciales={condicionesComerciales}
              onAddItem={addItem}
              onUpdateItem={updateItem}
              onRemoveItem={removeItem}
              onNotasTecnicasChange={(v) => { setNotasTecnicas(v); markUserInteracted(); }}
              onCondicionesChange={(v) => { setCondicionesComerciales(v); markUserInteracted(); }}
              calculateItemTaxes={calculateItemTaxes}
            />
            {id && (
              <PresupuestoAdjuntosSection
                presupuestoId={id}
                adjuntos={adjuntos}
                onAdd={handleAddAdjunto}
                onRemove={handleRemoveAdjunto}
                onSuggestAutorizado={handleSuggestAutorizado}
              />
            )}
          </div>
        </div>
      </div>
      {showCrearPosta && id && (
        <CrearPostaModal
          tipoEntidad="presupuesto"
          entidadId={id}
          entidadNumero={numero}
          entidadDescripcion={`${cliente?.razonSocial || 'Presupuesto'}${sistema ? ` · ${sistema.nombre}` : ''}`}
          categoriaDefault="administracion"
          onClose={() => setShowCrearPosta(false)}
        />
      )}
    </div>
  );
};
