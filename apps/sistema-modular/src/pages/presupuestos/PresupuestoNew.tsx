import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { presupuestosService, clientesService, sistemasService, contactosService, leadsService } from '../../services/firebaseService';
import type { Cliente, Sistema, ContactoCliente, OrigenPresupuesto } from '@ags/shared';
import { ORIGEN_PRESUPUESTO_LABELS } from '@ags/shared';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { useNavigateBack } from '../../hooks/useNavigateBack';

export const PresupuestoNew = () => {
  const navigate = useNavigate();
  const goBack = useNavigateBack();
  const [searchParams] = useSearchParams();
  const origenTipo = searchParams.get('origen') as OrigenPresupuesto | null;
  const origenId = searchParams.get('origenId');
  const origenRef = searchParams.get('origenRef');
  const clienteIdFromUrl = searchParams.get('cliente');
  const sistemaIdFromUrl = searchParams.get('sistema');

  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [contactos, setContactos] = useState<ContactoCliente[]>([]);
  const [sistemasFiltrados, setSistemasFiltrados] = useState<Sistema[]>([]);

  const [formData, setFormData] = useState({
    clienteId: clienteIdFromUrl || '',
    sistemaId: sistemaIdFromUrl || '',
    contactoId: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (formData.clienteId) {
      loadContactos(formData.clienteId);
      loadSistemasCliente(formData.clienteId);
    } else {
      setContactos([]);
      setSistemasFiltrados([]);
    }
  }, [formData.clienteId, sistemas]);

  const loadData = async () => {
    try {
      const [clientesData, sistemasData] = await Promise.all([
        clientesService.getAll(true),
        sistemasService.getAll(),
      ]);
      setClientes(clientesData);
      setSistemas(sistemasData);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.clienteId) {
      alert('Debe seleccionar un cliente');
      return;
    }

    try {
      setLoading(true);
      
      // Crear presupuesto básico - los items se agregarán en el detalle.
      // tipo: 'servicio' explícito — el wizard standalone crea presupuestos
      // per_incident por default. Contrato se inicia desde otro flow.
      // moneda: 'USD' por default (el editor permite cambiar a ARS/EUR/MIXTA).
      const presupuestoData = {
        numero: '',
        tipo: 'servicio' as const,
        moneda: 'USD' as const,
        clienteId: formData.clienteId,
        sistemaId: formData.sistemaId || null,
        contactoId: formData.contactoId || null,
        estado: 'borrador' as const,
        items: [],
        subtotal: 0,
        total: 0,
        ordenesCompraIds: [],
        ...(origenTipo ? { origenTipo, origenId, origenRef } : {}),
      };

      const { id: presupuestoId } = await presupuestosService.create(presupuestoData as any);

      // Vincular presupuesto al lead de origen
      if (origenTipo === 'lead' && origenId) {
        await leadsService.linkPresupuesto(origenId, presupuestoId);
      }

      alert('Presupuesto creado exitosamente');
      navigate(`/presupuestos/${presupuestoId}`);
    } catch (error) {
      console.error('Error creando presupuesto:', error);
      alert('Error al crear el presupuesto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Nuevo Presupuesto</h2>
          <p className="text-sm text-slate-500 mt-1">Seleccione cliente y sistema para crear el presupuesto</p>
        </div>
        <Button variant="outline" onClick={() => goBack()}>
          Cancelar
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {origenTipo && (
          <Card>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-slate-400">Origen:</span>
              <span className="text-xs font-medium text-slate-700">{ORIGEN_PRESUPUESTO_LABELS[origenTipo]}</span>
              {origenRef && <span className="text-xs text-slate-500">— {origenRef}</span>}
            </div>
          </Card>
        )}
        <Card>
          <h3 className="text-sm font-black text-slate-600 uppercase mb-4">Datos Básicos</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Cliente *
              </label>
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
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                    Sistema / Equipo
                  </label>
                  <SearchableSelect
                    value={formData.sistemaId}
                    onChange={(value) => setFormData({ ...formData, sistemaId: value })}
                    options={[
                      { value: '', label: 'Sin sistema específico' },
                      ...sistemasFiltrados.map(s => ({ value: s.id, label: `${s.nombre} (${s.codigoInternoCliente})` }))
                    ]}
                    placeholder="Seleccionar sistema..."
                  />
                </div>
                
                {contactos.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Contacto</label>
                    <SearchableSelect
                      value={formData.contactoId}
                      onChange={(value) => setFormData({ ...formData, contactoId: value })}
                      options={[
                        { value: '', label: 'Sin contacto específico' },
                        ...contactos.map(c => ({ value: c.id, label: `${c.nombre}${c.cargo ? ` - ${c.cargo}` : ''}` }))
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
          <Button type="button" variant="outline" onClick={() => goBack()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Creando...' : 'Crear Presupuesto'}
          </Button>
        </div>
      </form>
    </div>
  );
};
