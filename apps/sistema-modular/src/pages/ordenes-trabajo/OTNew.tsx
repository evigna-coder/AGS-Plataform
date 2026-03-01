import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ordenesTrabajoService, clientesService, sistemasService, contactosService, tiposServicioService } from '../../services/firebaseService';
import type { Cliente, Sistema, ContactoCliente, TipoServicio } from '@ags/shared';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SearchableSelect } from '../../components/ui/SearchableSelect';

export const OTNew = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clienteIdFromUrl = searchParams.get('cliente');
  const sistemaIdFromUrl = searchParams.get('sistema');
  
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [contactos, setContactos] = useState<ContactoCliente[]>([]);
  const [sistemasFiltrados, setSistemasFiltrados] = useState<Sistema[]>([]);
  const [tiposServicio, setTiposServicio] = useState<TipoServicio[]>([]);
  
  const [formData, setFormData] = useState({
    otNumber: '',
    clienteId: clienteIdFromUrl || '',
    sistemaId: sistemaIdFromUrl || '',
    contactoId: '',
    tipoServicio: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Generar OT automáticamente después de cargar datos
    const initOt = async () => {
      try {
        const nextOT = await ordenesTrabajoService.getNextOtNumber();
        setFormData(prev => ({ ...prev, otNumber: nextOT }));
      } catch (error) {
        console.error('Error generando OT:', error);
      }
    };
    initOt();
  }, []);

  useEffect(() => {
    if (formData.clienteId) {
      loadContactos(formData.clienteId);
      loadSistemasCliente(formData.clienteId);
    } else {
      setContactos([]);
      setSistemasFiltrados([]);
    }
  }, [formData.clienteId]);

  useEffect(() => {
    if (formData.sistemaId) {
      prefillFromSistema(formData.sistemaId);
    }
  }, [formData.sistemaId]);

  const loadData = async () => {
    try {
      const [clientesData, sistemasData, tiposData] = await Promise.all([
        clientesService.getAll(true),
        sistemasService.getAll(),
        tiposServicioService.getAll(),
      ]);
      setClientes(clientesData);
      setSistemas(sistemasData);
      setTiposServicio(tiposData);
      
      if (clienteIdFromUrl) {
        await loadContactos(clienteIdFromUrl);
        await loadSistemasCliente(clienteIdFromUrl);
      }
      if (sistemaIdFromUrl) {
        await prefillFromSistema(sistemaIdFromUrl);
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
      alert('Error al cargar los datos');
    }
  };

  const loadContactos = async (clienteId: string) => {
    try {
      const contactosData = await contactosService.getByCliente(clienteId);
      setContactos(contactosData);
    } catch (error) {
      console.error('Error cargando contactos:', error);
    }
  };

  const loadSistemasCliente = async (clienteId: string) => {
    const sistemasCliente = sistemas.filter(s => s.clienteId === clienteId);
    setSistemasFiltrados(sistemasCliente);
  };

  const prefillFromSistema = async (sistemaId: string) => {
    const sistema = sistemas.find(s => s.id === sistemaId);
    if (!sistema) return;
    
    const cliente = clientes.find(c => c.id === sistema.clienteId);
    if (!cliente) return;
    
    // Pre-llenar datos del cliente y sistema
    // Los datos se usarán cuando se abra en reportes-ot
    console.log('Datos pre-cargados:', { cliente, sistema });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.otNumber.trim()) {
      alert('El número de OT es obligatorio');
      return;
    }
    
    // Validar formato de OT: 5 dígitos + opcional .NN
    const otRegex = /^\d{5}(?:\.\d{2})?$/;
    if (!otRegex.test(formData.otNumber)) {
      alert('Formato inválido. Use 5 dígitos, opcional .NN (ej: 25660 o 25660.02)');
      return;
    }
    
    if (!formData.clienteId) {
      alert('Debe seleccionar un cliente');
      return;
    }
    
    if (!formData.sistemaId) {
      alert('Debe seleccionar un sistema');
      return;
    }

    try {
      setLoading(true);
      
      const cliente = clientes.find(c => c.id === formData.clienteId);
      const sistema = sistemas.find(s => s.id === formData.sistemaId);
      const contacto = contactos.find(c => c.id === formData.contactoId);
      
      if (!cliente || !sistema) {
        alert('Error: Cliente o sistema no encontrado');
        return;
      }
      
      // Crear OT básica - los datos completos se editarán en reportes-ot
      const otData = {
        otNumber: formData.otNumber,
        status: 'BORRADOR' as const,
        budgets: [],
        tipoServicio: formData.tipoServicio,
        esFacturable: false,
        tieneContrato: cliente.tipoServicio === 'contrato',
        esGarantia: false,
        razonSocial: cliente.razonSocial,
        contacto: contacto?.nombre || '',
        direccion: cliente.direccion,
        localidad: cliente.localidad,
        provincia: cliente.provincia,
        sistema: sistema.nombre,
        moduloModelo: '',
        moduloDescripcion: '',
        moduloSerie: '',
        codigoInternoCliente: sistema.codigoInternoCliente,
        fechaInicio: new Date().toISOString().split('T')[0],
        fechaFin: new Date().toISOString().split('T')[0],
        horasTrabajadas: '',
        tiempoViaje: '',
        reporteTecnico: '',
        accionesTomar: '',
        articulos: [],
        emailPrincipal: contacto?.email || '',
        signatureEngineer: null,
        aclaracionEspecialista: '',
        signatureClient: null,
        aclaracionCliente: contacto?.nombre || '',
        updatedAt: new Date().toISOString(),
        clienteId: cliente.id,
        sistemaId: sistema.id,
      };
      
      await ordenesTrabajoService.create(otData);
      
      // Redirigir al módulo de reportes-ot para edición completa
      // Si reportes-ot está en otro puerto (3000), usar URL completa
      // En producción, ajustar según la configuración del servidor
      const reportesOtUrl = window.location.port === '3001' 
        ? `http://localhost:3000?reportId=${formData.otNumber}`
        : `/?reportId=${formData.otNumber}`;
      
      alert('Orden de trabajo creada exitosamente. Puede abrirla en el editor completo desde el detalle.');
      navigate(`/ordenes-trabajo/${formData.otNumber}`);
    } catch (error) {
      console.error('Error creando OT:', error);
      alert('Error al crear la orden de trabajo');
    } finally {
      setLoading(false);
    }
  };

  const generateNextOT = async () => {
    try {
      const nextOT = await ordenesTrabajoService.getNextOtNumber();
      setFormData({ ...formData, otNumber: nextOT });
    } catch (error) {
      console.error('Error generando OT:', error);
      alert('Error al generar número de OT automático');
    }
  };

  useEffect(() => {
    // Generar OT automáticamente al cargar
    generateNextOT();
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Nueva Orden de Trabajo</h2>
          <p className="text-sm text-slate-500 mt-1">Seleccione cliente y sistema para pre-cargar datos</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/ordenes-trabajo')}>
          Cancelar
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-4">Datos Básicos</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Número de OT *
                </label>
                <div className="flex gap-2">
                  <Input
                    value={formData.otNumber}
                    onChange={(e) => {
                      let value = e.target.value.replace(/[^0-9.]/g, '');
                      if (/^\d{5}$/.test(value)) {
                        value = value + '.';
                      }
                      if (!/^\d{0,5}(\.\d{0,2})?$/.test(value)) {
                        return;
                      }
                      setFormData({ ...formData, otNumber: value });
                    }}
                    placeholder="25660 o 25660.02"
                    required
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" onClick={generateNextOT} size="sm">
                    Auto
                  </Button>
                </div>
                <p className="mt-1 text-xs text-slate-500">Formato: 5 dígitos + opcional .NN</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Tipo de Servicio *
                </label>
                <SearchableSelect
                  value={formData.tipoServicio}
                  onChange={(value) => setFormData({ ...formData, tipoServicio: value })}
                  options={tiposServicio.map(t => ({ value: t.nombre, label: t.nombre }))}
                  placeholder="Seleccionar tipo de servicio..."
                  required
                  emptyMessage="No hay tipos de servicio disponibles. Gestione tipos de servicio para agregar más."
                />
                <Link to="/tipos-servicio" className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                  Gestionar tipos de servicio →
                </Link>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-4">Cliente y Equipo</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Cliente *</label>
              <SearchableSelect
                value={formData.clienteId}
                onChange={(value) => setFormData({ ...formData, clienteId: value, sistemaId: '', contactoId: '' })}
                options={clientes.map(c => ({ value: c.id, label: c.razonSocial }))}
                placeholder="Seleccionar cliente..."
                required
              />
            </div>
            
            {formData.clienteId && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Sistema / Equipo *</label>
                  <SearchableSelect
                    value={formData.sistemaId}
                    onChange={(value) => setFormData({ ...formData, sistemaId: value })}
                    options={sistemasFiltrados.map(s => ({ value: s.id, label: `${s.nombre} (${s.codigoInternoCliente})` }))}
                    placeholder="Seleccionar sistema..."
                    required
                  />
                </div>
                
                {contactos.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Contacto</label>
                    <SearchableSelect
                      value={formData.contactoId}
                      onChange={(value) => setFormData({ ...formData, contactoId: value })}
                      options={[
                        { value: '', label: 'Sin contacto específico' },
                        ...contactos.map(c => ({ value: c.id, label: `${c.nombre}${c.cargo ? ` - ${c.cargo}` : ''}` })),
                      ]}
                      placeholder="Seleccionar contacto..."
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/ordenes-trabajo')}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Creando...' : 'Crear OT y Abrir en Editor'}
          </Button>
        </div>
      </form>
    </div>
  );
};
