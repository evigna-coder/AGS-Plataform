import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ordenesTrabajoService, clientesService, sistemasService, tiposServicioService, modulosService, contactosService } from '../../services/firebaseService';
import type { WorkOrder, Cliente, Sistema, TipoServicio, ModuloSistema, Part, ContactoCliente } from '@ags/shared';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SearchableSelect } from '../../components/ui/SearchableSelect';

export const OTDetail = () => {
  const { otNumber } = useParams<{ otNumber: string }>();
  const navigate = useNavigate();
  
  // Estados de datos relacionados
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [sistema, setSistema] = useState<Sistema | null>(null);
  const [modulo, setModulo] = useState<ModuloSistema | null>(null);
  const [items, setItems] = useState<WorkOrder[]>([]);
  const [tiposServicio, setTiposServicio] = useState<TipoServicio[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Listas para SearchableSelect
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [sistemasFiltrados, setSistemasFiltrados] = useState<Sistema[]>([]);
  const [modulos, setModulos] = useState<ModuloSistema[]>([]);
  const [modulosFiltrados, setModulosFiltrados] = useState<ModuloSistema[]>([]);
  const [contactos, setContactos] = useState<ContactoCliente[]>([]);
  
  // Estados editables - todos los campos de la OT
  const [razonSocial, setRazonSocial] = useState('');
  const [contacto, setContacto] = useState('');
  const [direccion, setDireccion] = useState('');
  const [localidad, setLocalidad] = useState('');
  const [provincia, setProvincia] = useState('');
  const [emailPrincipal, setEmailPrincipal] = useState('');
  const [sistemaNombre, setSistemaNombre] = useState('');
  const [codigoInternoCliente, setCodigoInternoCliente] = useState('');
  const [moduloModelo, setModuloModelo] = useState('');
  const [moduloDescripcion, setModuloDescripcion] = useState('');
  const [moduloSerie, setModuloSerie] = useState('');
  const [tipoServicio, setTipoServicio] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [horasTrabajadas, setHorasTrabajadas] = useState('');
  const [tiempoViaje, setTiempoViaje] = useState('');
  const [reporteTecnico, setReporteTecnico] = useState('');
  const [accionesTomar, setAccionesTomar] = useState('');
  const [articulos, setArticulos] = useState<Part[]>([]);
  const [budgets, setBudgets] = useState<string[]>(['']);
  const [esFacturable, setEsFacturable] = useState(false);
  const [tieneContrato, setTieneContrato] = useState(false);
  const [esGarantia, setEsGarantia] = useState(false);
  const [status, setStatus] = useState<'BORRADOR' | 'FINALIZADO'>('BORRADOR');
  const [aclaracionCliente, setAclaracionCliente] = useState('');
  const [aclaracionEspecialista, setAclaracionEspecialista] = useState('');
  
  // Nuevos campos
  const [materialesParaServicio, setMaterialesParaServicio] = useState('');
  const [problemaFallaInicial, setProblemaFallaInicial] = useState('');
  
  // Referencias para IDs relacionados
  const [clienteId, setClienteId] = useState<string | undefined>();
  const [sistemaId, setSistemaId] = useState<string | undefined>();
  const [moduloId, setModuloId] = useState<string | undefined>();
  
  // Control de autosave
  const hasUserInteracted = useRef(false);
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Modal de nuevo item
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [newItemData, setNewItemData] = useState({
    necesitaPresupuesto: false,
    clienteConfiable: false,
    tieneContrato: false,
    tipoServicio: '',
    descripcion: '',
  });

  useEffect(() => {
    if (otNumber) {
      loadData();
    }
  }, [otNumber]);

  // Actualizar sistemas filtrados cuando cambia clienteId
  useEffect(() => {
    if (clienteId) {
      const sistemasCliente = sistemas.filter(s => s.clienteId === clienteId);
      setSistemasFiltrados(sistemasCliente);
      
      // Cargar contactos del cliente
      contactosService.getByCliente(clienteId).then(contactosData => {
        setContactos(contactosData);
      }).catch(error => {
        console.error('Error cargando contactos:', error);
      });
    } else {
      setSistemasFiltrados([]);
      setContactos([]);
    }
  }, [clienteId, sistemas]);

  // Actualizar módulos filtrados cuando cambia sistemaId
  useEffect(() => {
    if (sistemaId) {
      modulosService.getBySistema(sistemaId).then(modulosData => {
        setModulos(modulosData);
        setModulosFiltrados(modulosData);
      }).catch(error => {
        console.error('Error cargando módulos:', error);
      });
    } else {
      setModulosFiltrados([]);
    }
  }, [sistemaId]);

  const loadData = async () => {
    if (!otNumber) return;
    try {
      setLoading(true);
      const otData = await ordenesTrabajoService.getByOtNumber(otNumber);
      if (!otData) {
        alert('Orden de trabajo no encontrada');
        navigate('/ordenes-trabajo');
        return;
      }
      
      // Cargar todos los campos editables
      setRazonSocial(otData.razonSocial || '');
      setContacto(otData.contacto || '');
      setDireccion(otData.direccion || '');
      setLocalidad(otData.localidad || '');
      setProvincia(otData.provincia || '');
      setEmailPrincipal(otData.emailPrincipal || '');
      setSistemaNombre(otData.sistema || '');
      setCodigoInternoCliente(otData.codigoInternoCliente || '');
      setModuloModelo(otData.moduloModelo || '');
      setModuloDescripcion(otData.moduloDescripcion || '');
      setModuloSerie(otData.moduloSerie || '');
      setTipoServicio(otData.tipoServicio || '');
      setFechaInicio(otData.fechaInicio || '');
      setFechaFin(otData.fechaFin || '');
      setHorasTrabajadas(otData.horasTrabajadas || '');
      setTiempoViaje(otData.tiempoViaje || '');
      setReporteTecnico(otData.reporteTecnico || '');
      setAccionesTomar(otData.accionesTomar || '');
      setArticulos(otData.articulos || []);
      setBudgets(otData.budgets && otData.budgets.length > 0 ? otData.budgets : ['']);
      setEsFacturable(otData.esFacturable || false);
      setTieneContrato(otData.tieneContrato || false);
      setEsGarantia(otData.esGarantia || false);
      setStatus(otData.status || 'BORRADOR');
      setAclaracionCliente(otData.aclaracionCliente || '');
      setAclaracionEspecialista(otData.aclaracionEspecialista || '');
      setMaterialesParaServicio(otData.materialesParaServicio || '');
      setProblemaFallaInicial(otData.problemaFallaInicial || '');
      setClienteId(otData.clienteId);
      setSistemaId(otData.sistemaId);
      setModuloId(otData.moduloId);
      
      // Cargar datos relacionados
      if (otData.clienteId) {
        const clienteData = await clientesService.getById(otData.clienteId);
        setCliente(clienteData);
      }
      if (otData.sistemaId) {
        const sistemaData = await sistemasService.getById(otData.sistemaId);
        setSistema(sistemaData);
        
        if (otData.moduloId && sistemaData) {
          try {
            const moduloData = await modulosService.getById(otData.sistemaId, otData.moduloId);
            setModulo(moduloData);
          } catch (error) {
            console.error('Error cargando módulo:', error);
          }
        }
      }
      
      // Cargar items si es OT padre
      if (otNumber && !otNumber.includes('.')) {
        const itemsData = await ordenesTrabajoService.getItemsByOtPadre(otNumber);
        setItems(itemsData);
      }
      
      // Cargar tipos de servicio
      const tiposData = await tiposServicioService.getAll();
      setTiposServicio(tiposData);
      
      // Cargar listas para SearchableSelect
      const [clientesData, sistemasData] = await Promise.all([
        clientesService.getAll(true),
        sistemasService.getAll(),
      ]);
      setClientes(clientesData);
      setSistemas(sistemasData);
      
      // Filtrar sistemas por cliente si hay clienteId
      if (otData.clienteId) {
        const sistemasCliente = sistemasData.filter(s => s.clienteId === otData.clienteId);
        setSistemasFiltrados(sistemasCliente);
        
        // Cargar contactos del cliente
        try {
          const contactosData = await contactosService.getByCliente(otData.clienteId);
          setContactos(contactosData);
        } catch (error) {
          console.error('Error cargando contactos:', error);
        }
      }
      
      // Cargar módulos del sistema si hay sistemaId
      if (otData.sistemaId) {
        try {
          const modulosData = await modulosService.getBySistema(otData.sistemaId);
          setModulos(modulosData);
          setModulosFiltrados(modulosData);
        } catch (error) {
          console.error('Error cargando módulos:', error);
        }
      }
      
      hasUserInteracted.current = false;
    } catch (error) {
      console.error('Error cargando datos:', error);
      alert('Error al cargar la orden de trabajo');
    } finally {
      setLoading(false);
    }
  };

  // Autosave con debounce
  useEffect(() => {
    if (!hasUserInteracted.current || !otNumber || loading) return;
    
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
  }, [
    razonSocial, contacto, direccion, localidad, provincia, emailPrincipal,
    sistemaNombre, codigoInternoCliente, moduloModelo, moduloDescripcion, moduloSerie,
    tipoServicio, fechaInicio, fechaFin, horasTrabajadas, tiempoViaje,
    reporteTecnico, accionesTomar, articulos, budgets, esFacturable, tieneContrato, esGarantia,
    aclaracionCliente, aclaracionEspecialista, materialesParaServicio, problemaFallaInicial,
    clienteId || '', sistemaId || '', moduloId || '' // Normalizar undefined a string vacío para mantener tamaño constante
  ]);

  const handleSave = async () => {
    if (!otNumber) return;
    
    try {
      setSaving(true);
      // Helper para limpiar undefined (Firestore no acepta undefined)
      const cleanValue = (value: any) => {
        if (value === undefined) return null;
        if (value === '') return null;
        return value;
      };
      
      const updateData: Partial<WorkOrder> = {
        razonSocial: cleanValue(razonSocial),
        contacto: cleanValue(contacto),
        direccion: cleanValue(direccion),
        localidad: cleanValue(localidad),
        provincia: cleanValue(provincia),
        emailPrincipal: cleanValue(emailPrincipal),
        sistema: cleanValue(sistemaNombre),
        codigoInternoCliente: cleanValue(codigoInternoCliente),
        moduloModelo: cleanValue(moduloModelo),
        moduloDescripcion: cleanValue(moduloDescripcion),
        moduloSerie: cleanValue(moduloSerie),
        tipoServicio: cleanValue(tipoServicio),
        fechaInicio: cleanValue(fechaInicio),
        fechaFin: cleanValue(fechaFin),
        horasTrabajadas: cleanValue(horasTrabajadas),
        tiempoViaje: cleanValue(tiempoViaje),
        reporteTecnico: cleanValue(reporteTecnico),
        accionesTomar: cleanValue(accionesTomar),
        articulos,
        budgets: budgets.filter(b => b.trim() !== ''),
        esFacturable,
        tieneContrato,
        esGarantia,
        status,
        aclaracionCliente: cleanValue(aclaracionCliente),
        aclaracionEspecialista: cleanValue(aclaracionEspecialista),
        materialesParaServicio: cleanValue(materialesParaServicio),
        problemaFallaInicial: cleanValue(problemaFallaInicial),
        clienteId: cleanValue(clienteId),
        sistemaId: cleanValue(sistemaId),
        moduloId: cleanValue(moduloId),
      };
      
      await ordenesTrabajoService.update(otNumber, updateData);
      console.log('✅ OT guardada automáticamente');
    } catch (error) {
      console.error('Error guardando OT:', error);
      alert('Error al guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!otNumber) return;
    
    const confirmar = window.confirm(`¿Está seguro de que desea eliminar la OT ${otNumber}?`);
    if (!confirmar) return;
    
    try {
      setSaving(true);
      await ordenesTrabajoService.delete(otNumber);
      alert('OT eliminada exitosamente');
      navigate('/ordenes-trabajo');
    } catch (error) {
      console.error('Error eliminando OT:', error);
      alert('Error al eliminar la OT');
    } finally {
      setSaving(false);
    }
  };

  const markUserInteracted = () => {
    if (!hasUserInteracted.current) {
      hasUserInteracted.current = true;
    }
  };

  // Funciones para gestionar materiales
  const addPart = () => {
    setArticulos([...articulos, { id: `part-${Date.now()}`, codigo: '', descripcion: '', cantidad: 1, origen: '' }]);
    markUserInteracted();
  };

  const updatePart = (id: string, field: keyof Part, value: any) => {
    setArticulos(articulos.map(p => p.id === id ? { ...p, [field]: value } : p));
    markUserInteracted();
  };

  const removePart = (id: string) => {
    setArticulos(articulos.filter(p => p.id !== id));
    markUserInteracted();
  };

  // Funciones para gestionar presupuestos
  const addBudget = () => {
    setBudgets([...budgets, '']);
    markUserInteracted();
  };

  const updateBudget = (index: number, value: string) => {
    const updated = [...budgets];
    updated[index] = value.substring(0, 15);
    setBudgets(updated);
    markUserInteracted();
  };

  const removeBudget = (index: number) => {
    if (budgets.length > 1) {
      setBudgets(budgets.filter((_, i) => i !== index));
    } else {
      setBudgets(['']);
    }
    markUserInteracted();
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('es-AR');
    } catch {
      return dateString;
    }
  };

  const openInReportesOT = (otNum?: string) => {
    const otToOpen = otNum || otNumber;
    if (otToOpen) {
      const reportesOtUrl = `http://localhost:3000?reportId=${otToOpen}`;
      
      console.log('[OTDetail] Intentando abrir editor:', reportesOtUrl);
      console.log('[OTDetail] electronAPI disponible:', typeof window !== 'undefined' && !!(window as any).electronAPI);
      console.log('[OTDetail] openWindow disponible:', typeof window !== 'undefined' && !!(window as any).electronAPI?.openWindow);
      
      if (typeof window !== 'undefined' && (window as any).electronAPI?.openWindow) {
        console.log('[OTDetail] Usando electronAPI.openWindow');
        (window as any).electronAPI.openWindow(reportesOtUrl);
      } else if (typeof window !== 'undefined' && (window as any).electronAPI?.openExternal) {
        console.log('[OTDetail] Usando electronAPI.openExternal como fallback');
        (window as any).electronAPI.openExternal(reportesOtUrl);
      } else {
        console.log('[OTDetail] Usando window.open como fallback final');
        window.open(reportesOtUrl, '_blank');
      }
    }
  };

  const handleCreateNewItem = async () => {
    if (!otNumber || !cliente) {
      alert('Error: No se puede crear item sin OT padre o cliente');
      return;
    }
    
    if (!newItemData.tipoServicio.trim()) {
      alert('El tipo de servicio es obligatorio');
      return;
    }

    try {
      const nextItemNumber = await ordenesTrabajoService.getNextItemNumber(otNumber);
      
      const itemData: any = {
        otNumber: nextItemNumber,
        status: 'BORRADOR' as const,
        budgets: [],
        tipoServicio: newItemData.tipoServicio,
        esFacturable: newItemData.necesitaPresupuesto,
        tieneContrato: newItemData.tieneContrato || cliente.tipoServicio === 'contrato',
        esGarantia: false,
        razonSocial,
        contacto,
        direccion,
        localidad,
        provincia,
        sistema: sistemaNombre,
        moduloModelo: moduloModelo || '',
        moduloDescripcion: moduloDescripcion || '',
        moduloSerie: moduloSerie || '',
        codigoInternoCliente,
        fechaInicio: new Date().toISOString().split('T')[0],
        fechaFin: new Date().toISOString().split('T')[0],
        horasTrabajadas: '',
        tiempoViaje: '',
        reporteTecnico: newItemData.descripcion || '',
        accionesTomar: '',
        articulos: [],
        emailPrincipal: emailPrincipal || '',
        signatureEngineer: null,
        aclaracionEspecialista: '',
        signatureClient: null,
        aclaracionCliente: aclaracionCliente || '',
        materialesParaServicio: materialesParaServicio || '',
        problemaFallaInicial: problemaFallaInicial || '',
        updatedAt: new Date().toISOString(),
      };
      
      // Helper para limpiar undefined
      const cleanValue = (value: any) => {
        if (value === undefined) return null;
        if (value === '') return null;
        return value;
      };
      
      itemData.clienteId = cleanValue(clienteId);
      itemData.sistemaId = cleanValue(sistemaId);
      itemData.moduloId = cleanValue(moduloId);
      
      await ordenesTrabajoService.create(itemData);
      alert(`Item ${nextItemNumber} creado exitosamente`);
      setShowNewItemModal(false);
      setNewItemData({ necesitaPresupuesto: false, clienteConfiable: false, tieneContrato: false, tipoServicio: '', descripcion: '' });
      await loadData();
    } catch (error) {
      console.error('Error creando item:', error);
      alert('Error al crear el item');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-400">Cargando orden de trabajo...</p>
      </div>
    );
  }

  const readOnly = status === 'FINALIZADO';
  const totalHs = (Number(horasTrabajadas) || 0) + (Number(tiempoViaje) || 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-32">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-blue-700 uppercase tracking-tight">OT-{otNumber}</h2>
          <p className="text-sm text-slate-500 mt-1">Editor completo de orden de trabajo</p>
        </div>
        <div className="flex gap-2 items-center">
          {saving && (
            <span className="text-xs text-slate-500">Guardando...</span>
          )}
          <Button variant="outline" onClick={() => navigate('/ordenes-trabajo')}>
            Volver
          </Button>
          {!readOnly && (
            <Button 
              variant="outline" 
              onClick={handleDelete} 
              disabled={saving}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              Eliminar OT
            </Button>
          )}
          {!otNumber?.includes('.') && (
            <Button onClick={() => setShowNewItemModal(true)}>
              + Nuevo Item
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>

      {/* Estado */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${
              status === 'FINALIZADO'
                ? 'bg-green-100 text-green-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {status}
            </span>
            {!readOnly && (
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as 'BORRADOR' | 'FINALIZADO');
                  markUserInteracted();
                }}
                className="border rounded-lg px-2 py-1 text-sm"
              >
                <option value="BORRADOR">BORRADOR</option>
                <option value="FINALIZADO">FINALIZADO</option>
              </select>
            )}
          </div>
          <div className="text-sm text-slate-500">
            Total Horas: <span className="font-bold">{totalHs.toFixed(1)}h</span>
          </div>
        </div>
      </Card>

      {/* Datos del Cliente - EDITABLE */}
      <Card>
        <h3 className="text-sm font-black text-slate-600 uppercase mb-4">Datos del Cliente</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Cliente</label>
            <SearchableSelect
              value={clienteId || ''}
              onChange={(value) => {
                const clienteSeleccionado = clientes.find(c => c.id === value);
                if (clienteSeleccionado) {
                  setClienteId(value);
                  setRazonSocial(clienteSeleccionado.razonSocial);
                  setDireccion(clienteSeleccionado.direccion);
                  setLocalidad(clienteSeleccionado.localidad);
                  setProvincia(clienteSeleccionado.provincia);
                  setSistemaId(undefined);
                  setModuloId(undefined);
                  setSistemaNombre('');
                  setModuloModelo('');
                  setModuloDescripcion('');
                  setModuloSerie('');
                  markUserInteracted();
                }
              }}
              options={clientes.map(c => ({ value: c.id, label: c.razonSocial }))}
              placeholder="Seleccionar cliente..."
              disabled={readOnly}
            />
            {clienteId && razonSocial && (
              <p className="text-xs text-slate-600 mt-1 font-bold">{razonSocial}</p>
            )}
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Contacto</label>
            <SearchableSelect
              value={contactos.find(c => c.nombre === contacto)?.id || ''}
              onChange={(value) => {
                const contactoSeleccionado = contactos.find(c => c.id === value);
                if (contactoSeleccionado) {
                  setContacto(contactoSeleccionado.nombre);
                  setEmailPrincipal(contactoSeleccionado.email || '');
                  markUserInteracted();
                }
              }}
              options={[
                { value: '', label: 'Sin contacto específico' },
                ...contactos.map(c => ({ value: c.id, label: `${c.nombre}${c.cargo ? ` - ${c.cargo}` : ''}` }))
              ]}
              placeholder="Seleccionar contacto..."
              disabled={readOnly || !clienteId}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Dirección</label>
            <input
              type="text"
              value={direccion}
              onChange={(e) => { setDireccion(e.target.value); markUserInteracted(); }}
              disabled={readOnly}
              placeholder="Calle y número"
              className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white border-slate-300 disabled:bg-slate-100 disabled:text-slate-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Localidad</label>
              <input
                type="text"
                value={localidad}
                onChange={(e) => { setLocalidad(e.target.value); markUserInteracted(); }}
                disabled={readOnly}
                placeholder="Localidad"
                className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white border-slate-300 disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Provincia</label>
              <input
                type="text"
                value={provincia}
                onChange={(e) => { setProvincia(e.target.value); markUserInteracted(); }}
                disabled={readOnly}
                placeholder="Provincia"
                className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white border-slate-300 disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Email</label>
            <input
              type="email"
              value={emailPrincipal}
              onChange={(e) => { setEmailPrincipal(e.target.value); markUserInteracted(); }}
              disabled={readOnly}
              placeholder="correo@ejemplo.com"
              className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white border-slate-300 disabled:bg-slate-100 disabled:text-slate-400"
            />
          </div>
          {cliente && (
            <div className="flex items-end">
              <Link to={`/clientes/${cliente.id}`} className="text-blue-600 hover:underline text-xs font-bold">
                Ver cliente completo →
              </Link>
            </div>
          )}
        </div>
      </Card>

      {/* Presupuestos - EDITABLE */}
      <Card>
        <div className="flex justify-between items-center mb-1">
          <label className="text-sm font-black text-slate-600 uppercase">Presupuestos</label>
          {!readOnly && (
            <button
              onClick={addBudget}
              className="text-blue-600 font-black text-xs uppercase hover:underline"
            >
              + Presup.
            </button>
          )}
        </div>
        <div className="space-y-2">
          {budgets.map((b, idx) => (
            <div key={idx} className="flex gap-1">
              <input
                value={b}
                maxLength={15}
                disabled={readOnly}
                onChange={e => updateBudget(idx, e.target.value)}
                placeholder="PRE-0000"
                className="w-full border rounded px-2 py-1 text-xs font-bold bg-white border-slate-300 disabled:bg-slate-100 disabled:text-slate-400"
              />
              {!readOnly && budgets.length > 1 && (
                <button
                  onClick={() => removeBudget(idx)}
                  className="text-red-400 hover:text-red-600"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Datos del Sistema y Módulo - EDITABLE */}
      <Card>
        <h3 className="text-sm font-black text-slate-600 uppercase mb-4">Datos del Sistema y Módulo</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Sistema</label>
              <SearchableSelect
                value={sistemaId || ''}
                onChange={(value) => {
                  const sistemaSeleccionado = sistemasFiltrados.find(s => s.id === value);
                  if (sistemaSeleccionado) {
                    setSistemaId(value);
                    setSistemaNombre(sistemaSeleccionado.nombre);
                    setCodigoInternoCliente(sistemaSeleccionado.codigoInternoCliente);
                    setModuloId(undefined);
                    markUserInteracted();
                  }
                }}
                options={sistemasFiltrados.map(s => ({ value: s.id, label: `${s.nombre} (${s.codigoInternoCliente})` }))}
                placeholder="Seleccionar sistema..."
                disabled={readOnly || !clienteId}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Código Interno</label>
              <input
                type="text"
                value={codigoInternoCliente}
                onChange={(e) => { setCodigoInternoCliente(e.target.value); markUserInteracted(); }}
                disabled={readOnly}
                placeholder="Código interno del cliente"
                className="w-full border rounded-lg px-3 py-1.5 text-sm font-mono bg-white border-slate-300 disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>
          </div>
          {sistema && sistema.software && (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Software del Sistema</label>
              <p className="text-sm text-slate-600">{sistema.software}</p>
            </div>
          )}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Módulo</label>
            <SearchableSelect
              value={moduloId || ''}
              onChange={(value) => {
                const moduloSeleccionado = modulosFiltrados.find(m => m.id === value);
                if (moduloSeleccionado) {
                  setModuloId(value);
                  setModuloModelo(moduloSeleccionado.nombre || '');
                  setModuloDescripcion(moduloSeleccionado.descripcion || '');
                  setModuloSerie(moduloSeleccionado.serie || '');
                  markUserInteracted();
                }
              }}
              options={[
                { value: '', label: 'Sin módulo específico' },
                ...modulosFiltrados.map(m => ({ 
                  value: m.id, 
                  label: `${m.nombre || 'Sin nombre'}${m.serie ? ` - S/N: ${m.serie}` : ''}` 
                }))
              ]}
              placeholder="Seleccionar módulo..."
              disabled={readOnly || !sistemaId}
            />
          </div>
          {moduloId && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Módulo - Modelo</label>
                <input
                  type="text"
                  value={moduloModelo}
                  onChange={(e) => { setModuloModelo(e.target.value); markUserInteracted(); }}
                  disabled={readOnly}
                  placeholder="Modelo"
                  className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white border-slate-300 disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Módulo - Descripción</label>
                <input
                  type="text"
                  value={moduloDescripcion}
                  onChange={(e) => { setModuloDescripcion(e.target.value); markUserInteracted(); }}
                  disabled={readOnly}
                  placeholder="Descripción"
                  className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white border-slate-300 disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Módulo - Serie</label>
                <input
                  type="text"
                  value={moduloSerie}
                  onChange={(e) => { setModuloSerie(e.target.value); markUserInteracted(); }}
                  disabled={readOnly}
                  placeholder="S/N o Serie"
                  className="w-full border rounded-lg px-3 py-1.5 text-sm font-mono bg-white border-slate-300 disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>
            </div>
          )}
          {modulo?.firmware && (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Versión / Firmware</label>
              <p className="text-sm text-slate-600 font-mono">{modulo.firmware}</p>
            </div>
          )}
          {sistema && (
            <div>
              <Link to={`/equipos/${sistema.id}`} className="text-blue-600 hover:underline text-xs font-bold">
                Ver sistema completo →
              </Link>
            </div>
          )}
        </div>
      </Card>

      {/* Información de la OT - EDITABLE */}
      <Card>
        <h3 className="text-sm font-black text-slate-600 uppercase mb-4">Información de la OT</h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Tipo de Servicio</label>
            <SearchableSelect
              value={tipoServicio}
              onChange={(value) => { setTipoServicio(value); markUserInteracted(); }}
              options={tiposServicio.map(t => ({ value: t.nombre, label: t.nombre }))}
              placeholder="Seleccionar tipo de servicio..."
              disabled={readOnly}
            />
            <Link to="/tipos-servicio" className="text-xs text-blue-600 hover:underline mt-1 inline-block">
              Gestionar tipos de servicio →
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Inicio</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => { setFechaInicio(e.target.value); markUserInteracted(); }}
                disabled={readOnly}
                className="w-full border rounded-lg px-3 py-1.5 text-xs bg-white border-slate-300 disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Fin</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => { setFechaFin(e.target.value); markUserInteracted(); }}
                disabled={readOnly}
                className="w-full border rounded-lg px-3 py-1.5 text-xs bg-white border-slate-300 disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Hs Lab</label>
              <input
                type="text"
                value={horasTrabajadas}
                onChange={(e) => { setHorasTrabajadas(e.target.value); markUserInteracted(); }}
                disabled={readOnly}
                placeholder="0.0"
                className="w-full border rounded-lg px-3 py-1.5 text-xs bg-white border-slate-300 disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Hs Trasl</label>
              <input
                type="text"
                value={tiempoViaje}
                onChange={(e) => { setTiempoViaje(e.target.value); markUserInteracted(); }}
                disabled={readOnly}
                placeholder="0.0"
                className="w-full border rounded-lg px-3 py-1.5 text-xs bg-white border-slate-300 disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={esFacturable}
                onChange={(e) => { setEsFacturable(e.target.checked); markUserInteracted(); }}
                disabled={readOnly}
                className="w-4 h-4"
              />
              <span className="text-sm text-slate-700">Facturable</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={tieneContrato}
                onChange={(e) => { setTieneContrato(e.target.checked); markUserInteracted(); }}
                disabled={readOnly}
                className="w-4 h-4"
              />
              <span className="text-sm text-slate-700">Contrato</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={esGarantia}
                onChange={(e) => { setEsGarantia(e.target.checked); markUserInteracted(); }}
                disabled={readOnly}
                className="w-4 h-4"
              />
              <span className="text-sm text-slate-700">Garantía</span>
            </label>
          </div>
        </div>
      </Card>

      {/* Problema / Falla Inicial - EDITABLE */}
      <Card>
        <div className="flex justify-between items-end mb-1">
          <label className="text-sm font-black text-slate-600 uppercase">Problema / Falla Inicial</label>
        </div>
        <textarea
          value={problemaFallaInicial}
          onChange={(e) => { setProblemaFallaInicial(e.target.value); markUserInteracted(); }}
          rows={3}
          disabled={readOnly}
          placeholder="Describa el problema o falla inicial que dio origen a esta OT..."
          className="w-full border rounded-xl px-4 py-3 text-sm outline-none bg-white border-slate-200 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
        />
      </Card>

      {/* Reporte Técnico - EDITABLE */}
      <Card>
        <div className="flex justify-between items-end mb-1">
          <label className="text-sm font-black text-slate-600 uppercase">Informe Técnico</label>
        </div>
        <textarea
          value={reporteTecnico}
          onChange={(e) => { setReporteTecnico(e.target.value); markUserInteracted(); }}
          rows={6}
          disabled={readOnly}
          placeholder="Describa detalladamente el servicio técnico realizado..."
          className="w-full border rounded-xl px-4 py-3 text-sm outline-none bg-white border-slate-200 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
        />
      </Card>

      {/* Materiales para el Servicio - EDITABLE */}
      <Card>
        <div className="flex justify-between items-end mb-1">
          <label className="text-sm font-black text-slate-600 uppercase">Materiales para el Servicio</label>
        </div>
        <textarea
          value={materialesParaServicio}
          onChange={(e) => { setMaterialesParaServicio(e.target.value); markUserInteracted(); }}
          rows={3}
          disabled={readOnly}
          placeholder="Describa los materiales necesarios para realizar el servicio..."
          className="w-full border rounded-xl px-4 py-3 text-sm outline-none bg-white border-slate-200 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
        />
      </Card>

      {/* Materiales / Repuestos - EDITABLE */}
      <Card>
        <div className="flex justify-between items-center mb-1">
          <label className="text-sm font-black text-slate-600 uppercase">Materiales / Repuestos</label>
          {!readOnly && (
            <button
              onClick={addPart}
              className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest bg-white text-slate-700 border border-slate-300"
            >
              + Item
            </button>
          )}
        </div>
        {articulos.length > 0 ? (
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 font-black text-slate-400 uppercase text-[9px]">
                <tr>
                  <th className="px-4 py-2 text-left w-32">Código</th>
                  <th className="px-4 py-2 text-left">Descripción</th>
                  <th className="px-4 py-2 text-center w-16">Cant.</th>
                  <th className="px-4 py-2 text-left w-28">Origen</th>
                  {!readOnly && <th className="w-10"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {articulos.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-1.5">
                      <input
                        value={p.codigo}
                        maxLength={18}
                        disabled={readOnly}
                        onChange={e => updatePart(p.id, 'codigo', e.target.value)}
                        className="w-full outline-none bg-transparent disabled:text-slate-400"
                      />
                    </td>
                    <td className="px-4 py-1.5">
                      <input
                        value={p.descripcion}
                        maxLength={90}
                        disabled={readOnly}
                        onChange={e => updatePart(p.id, 'descripcion', e.target.value)}
                        className="w-full outline-none bg-transparent disabled:text-slate-400"
                      />
                    </td>
                    <td className="px-4 py-1.5">
                      <input
                        type="number"
                        min="0"
                        value={p.cantidad}
                        disabled={readOnly}
                        onChange={e => updatePart(p.id, 'cantidad', Number(e.target.value) || 0)}
                        className="w-full outline-none text-center bg-transparent disabled:text-slate-400"
                      />
                    </td>
                    <td className="px-4 py-1.5">
                      <input
                        value={p.origen}
                        maxLength={12}
                        disabled={readOnly}
                        onChange={e => updatePart(p.id, 'origen', e.target.value)}
                        className="w-full outline-none bg-transparent disabled:text-slate-400"
                      />
                    </td>
                    {!readOnly && (
                      <td className="text-center">
                        <button
                          onClick={() => removePart(p.id)}
                          className="font-bold text-red-400 hover:text-red-600"
                        >
                          ×
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-400 italic py-4 text-center">No hay materiales registrados</p>
        )}
      </Card>

      {/* Observaciones / Acciones a Tomar - EDITABLE */}
      <Card>
        <label className="text-sm font-black text-slate-600 uppercase block mb-1">OBSERVACIONES / ACCIONES A TOMAR</label>
        <textarea
          value={accionesTomar}
          onChange={(e) => { setAccionesTomar(e.target.value); markUserInteracted(); }}
          rows={5}
          disabled={readOnly}
          placeholder="Recomendaciones o trabajos pendientes..."
          className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm bg-white focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
        />
      </Card>

      {/* Items de esta OT */}
      {!otNumber?.includes('.') && items.length > 0 && (
        <Card>
          <h3 className="text-sm font-black text-slate-600 uppercase mb-4">Items de esta OT</h3>
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.otNumber}
                className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100"
              >
                <div>
                  <Link to={`/ordenes-trabajo/${item.otNumber}`} className="font-black text-blue-700 uppercase hover:underline">
                    OT-{item.otNumber}
                  </Link>
                  <p className="text-xs text-slate-600 mt-1">{item.tipoServicio}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                    item.status === 'FINALIZADO'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {item.status}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/ordenes-trabajo/${item.otNumber}`)}
                  >
                    Ver
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Modal para crear nuevo item */}
      {showNewItemModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-black text-slate-900 uppercase mb-4">
              Crear Nuevo Item para OT-{otNumber}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Tipo de Servicio *
                </label>
                <SearchableSelect
                  value={newItemData.tipoServicio}
                  onChange={(value) => setNewItemData({ ...newItemData, tipoServicio: value })}
                  options={tiposServicio.map(t => ({ value: t.nombre, label: t.nombre }))}
                  placeholder="Seleccionar tipo de servicio..."
                  required
                />
                <Link to="/tipos-servicio" className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                  Gestionar tipos de servicio →
                </Link>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Descripción del Trabajo
                </label>
                <textarea
                  value={newItemData.descripcion}
                  onChange={(e) => setNewItemData({ ...newItemData, descripcion: e.target.value })}
                  rows={4}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="Describa brevemente el trabajo a realizar en este item..."
                />
              </div>

              <div className="border-t pt-4 space-y-3">
                <p className="text-xs font-bold text-slate-600 uppercase mb-2">Evaluación para Apertura de Item</p>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newItemData.necesitaPresupuesto}
                    onChange={(e) => setNewItemData({ ...newItemData, necesitaPresupuesto: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-slate-700">¿Requiere nuevo presupuesto?</span>
                </label>

                {cliente && (
                  <>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newItemData.clienteConfiable}
                        onChange={(e) => setNewItemData({ ...newItemData, clienteConfiable: e.target.checked })}
                        className="w-4 h-4"
                        disabled={cliente.pagaEnTiempo === true}
                      />
                      <span className="text-sm text-slate-700">
                        Cliente confiable (paga en tiempo)
                        {cliente.pagaEnTiempo && <span className="text-green-600 ml-2">✓ Ya verificado</span>}
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newItemData.tieneContrato || cliente.tipoServicio === 'contrato'}
                        onChange={(e) => setNewItemData({ ...newItemData, tieneContrato: e.target.checked })}
                        className="w-4 h-4"
                        disabled={cliente.tipoServicio === 'contrato'}
                      />
                      <span className="text-sm text-slate-700">
                        Cliente con contrato
                        {cliente.tipoServicio === 'contrato' && <span className="text-green-600 ml-2">✓ Tiene contrato</span>}
                      </span>
                    </label>
                  </>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowNewItemModal(false);
                  setNewItemData({ necesitaPresupuesto: false, clienteConfiable: false, tieneContrato: false, tipoServicio: '', descripcion: '' });
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleCreateNewItem}>
                Crear Item
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
