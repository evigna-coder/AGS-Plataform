import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { clientesService, contactosService } from '../../services/firebaseService';
import type { CondicionIva, CondicionPago, TipoServicioCliente, ContactoCliente } from '@ags/shared';

export const ClienteNew = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    razonSocial: '',
    cuit: '',
    pais: 'Argentina',
    direccion: '',
    localidad: '',
    provincia: '',
    codigoPostal: '',
    rubro: '',
    condicionIva: '' as CondicionIva | '',
    ingresosBrutos: '',
    convenioMultilateral: false,
    infoPagos: '',
    pagaEnTiempo: false,
    sueleDemorarse: false,
    condicionPago: '' as CondicionPago | '',
    tipoServicio: '' as TipoServicioCliente | '',
    notas: '',
    activo: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [contactos, setContactos] = useState<Omit<ContactoCliente, 'id'>[]>([]);
  const [showContactoModal, setShowContactoModal] = useState(false);
  const [editingContactoIndex, setEditingContactoIndex] = useState<number | null>(null);
  const [contactoForm, setContactoForm] = useState({
    nombre: '',
    cargo: '',
    sector: '',
    telefono: '',
    interno: '',
    email: '',
    esPrincipal: false,
  });

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.razonSocial.trim()) {
      newErrors.razonSocial = 'La razón social es obligatoria';
    }
    if (!formData.direccion.trim()) {
      newErrors.direccion = 'La dirección es obligatoria';
    }
    if (!formData.localidad.trim()) {
      newErrors.localidad = 'La localidad es obligatoria';
    }
    if (!formData.provincia.trim()) {
      newErrors.provincia = 'La provincia es obligatoria';
    }
    if (!formData.rubro.trim()) {
      newErrors.rubro = 'El rubro es obligatorio';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }

    try {
      setLoading(true);
      
      // Helper para limpiar campos vacíos y evitar undefined en Firestore
      const cleanValue = (value: any): any => {
        if (value === '' || value === null || value === undefined) {
          return null; // Firestore acepta null pero no undefined
        }
        return value;
      };
      
      const clienteData: any = {
        razonSocial: formData.razonSocial,
        pais: formData.pais,
        direccion: formData.direccion,
        localidad: formData.localidad,
        provincia: formData.provincia,
        rubro: formData.rubro,
        convenioMultilateral: formData.convenioMultilateral,
        pagaEnTiempo: formData.pagaEnTiempo,
        sueleDemorarse: formData.sueleDemorarse,
        activo: formData.activo,
        contactos: [],
      };
      
      // Agregar campos opcionales solo si tienen valor
      if (formData.cuit?.trim()) clienteData.cuit = formData.cuit.trim();
      if (formData.codigoPostal?.trim()) clienteData.codigoPostal = formData.codigoPostal.trim();
      if (formData.condicionIva) clienteData.condicionIva = formData.condicionIva;
      if (formData.ingresosBrutos?.trim()) clienteData.ingresosBrutos = formData.ingresosBrutos.trim();
      if (formData.infoPagos?.trim()) clienteData.infoPagos = formData.infoPagos.trim();
      if (formData.condicionPago) clienteData.condicionPago = formData.condicionPago;
      if (formData.tipoServicio) clienteData.tipoServicio = formData.tipoServicio;
      if (formData.notas?.trim()) clienteData.notas = formData.notas.trim();
      
      const clienteId = await clientesService.create(clienteData);
      
      // Guardar contactos si hay alguno
      if (contactos.length > 0) {
        for (const contacto of contactos) {
          await contactosService.create(clienteId, contacto);
        }
      }
      
      alert('Cliente creado exitosamente');
      navigate(`/clientes/${clienteId}`);
    } catch (error) {
      console.error('Error creando cliente:', error);
      alert('Error al crear el cliente');
    } finally {
      setLoading(false);
    }
  };

  const handleAddContacto = () => {
    if (!contactoForm.nombre.trim() || !contactoForm.telefono.trim() || !contactoForm.email.trim()) {
      alert('Por favor complete los campos obligatorios: Nombre, Teléfono y Email');
      return;
    }
    
    if (editingContactoIndex !== null) {
      // Editar contacto existente
      const updated = [...contactos];
      updated[editingContactoIndex] = contactoForm;
      setContactos(updated);
      setEditingContactoIndex(null);
    } else {
      // Agregar nuevo contacto
      setContactos([...contactos, contactoForm]);
    }
    
    setContactoForm({ nombre: '', cargo: '', sector: '', telefono: '', interno: '', email: '', esPrincipal: false });
    setShowContactoModal(false);
  };

  const handleEditContacto = (index: number) => {
    setEditingContactoIndex(index);
    setContactoForm(contactos[index]);
    setShowContactoModal(true);
  };

  const handleDeleteContacto = (index: number) => {
    if (confirm('¿Está seguro de eliminar este contacto?')) {
      setContactos(contactos.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Nuevo Cliente</h2>
          <p className="text-sm text-slate-500 mt-1">Complete los datos del cliente</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/clientes')}>
          Cancelar
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Datos Básicos */}
        <Card>
          <h3 className="text-sm font-black text-slate-600 uppercase mb-4">Datos Básicos</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Razón Social *
              </label>
              <Input
                value={formData.razonSocial}
                onChange={(e) => setFormData({ ...formData, razonSocial: e.target.value })}
                error={errors.razonSocial}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">CUIT</label>
              <Input
                value={formData.cuit}
                onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">País</label>
              <Input
                value={formData.pais}
                onChange={(e) => setFormData({ ...formData, pais: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Rubro *</label>
              <Input
                value={formData.rubro}
                onChange={(e) => setFormData({ ...formData, rubro: e.target.value })}
                error={errors.rubro}
                required
              />
            </div>
          </div>
        </Card>

        {/* Dirección */}
        <Card>
          <h3 className="text-sm font-black text-slate-600 uppercase mb-4">Dirección</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Dirección *</label>
              <Input
                value={formData.direccion}
                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                error={errors.direccion}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Localidad *</label>
              <Input
                value={formData.localidad}
                onChange={(e) => setFormData({ ...formData, localidad: e.target.value })}
                error={errors.localidad}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Provincia *</label>
              <Input
                value={formData.provincia}
                onChange={(e) => setFormData({ ...formData, provincia: e.target.value })}
                error={errors.provincia}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Código Postal</label>
              <Input
                value={formData.codigoPostal}
                onChange={(e) => setFormData({ ...formData, codigoPostal: e.target.value })}
              />
            </div>
          </div>
        </Card>

        {/* Fiscal / IVA */}
        <Card>
          <h3 className="text-sm font-black text-slate-600 uppercase mb-4">Fiscal / IVA</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Condición IVA</label>
              <SearchableSelect
                value={formData.condicionIva}
                onChange={(value) => setFormData({ ...formData, condicionIva: value as CondicionIva | '' })}
                options={[
                  { value: 'monotributo', label: 'Monotributo' },
                  { value: 'responsable_inscripto', label: 'Responsable Inscripto' },
                  { value: 'exento', label: 'Exento' },
                  { value: 'consumidor_final', label: 'Consumidor Final' },
                  { value: 'otro', label: 'Otro' },
                ]}
                placeholder="Seleccionar..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Ingresos Brutos</label>
              <Input
                value={formData.ingresosBrutos}
                onChange={(e) => setFormData({ ...formData, ingresosBrutos: e.target.value })}
              />
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.convenioMultilateral}
                  onChange={(e) => setFormData({ ...formData, convenioMultilateral: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-xs font-bold text-slate-600 uppercase">Convenio Multilateral</span>
              </label>
            </div>
          </div>
        </Card>

        {/* Tipo de Servicio */}
        <Card>
          <h3 className="text-sm font-black text-slate-600 uppercase mb-4">Tipo de Servicio</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Condición *</label>
              <SearchableSelect
                value={formData.tipoServicio}
                onChange={(value) => setFormData({ ...formData, tipoServicio: value as TipoServicioCliente | '' })}
                options={[
                  { value: 'contrato', label: 'Contrato' },
                  { value: 'per_incident', label: 'Per Incident' },
                ]}
                placeholder="Seleccionar..."
                required
              />
              <p className="mt-1 text-xs text-slate-500">
                <strong>Contrato:</strong> Tiempo de respuesta según contrato. OTs no requieren aceptación de presupuesto.<br />
                <strong>Per Incident:</strong> Tiempo de respuesta estándar. OTs requieren aceptación de presupuesto.
              </p>
            </div>
          </div>
        </Card>

        {/* Pagos */}
        <Card>
          <h3 className="text-sm font-black text-slate-600 uppercase mb-4">Información de Pagos</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Información sobre Pagos</label>
              <textarea
                value={formData.infoPagos}
                onChange={(e) => setFormData({ ...formData, infoPagos: e.target.value })}
                rows={3}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.pagaEnTiempo}
                    onChange={(e) => setFormData({ ...formData, pagaEnTiempo: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-xs font-bold text-slate-600 uppercase">Paga en Tiempo</span>
                </label>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.sueleDemorarse}
                    onChange={(e) => setFormData({ ...formData, sueleDemorarse: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-xs font-bold text-slate-600 uppercase">Suele Demorarse</span>
                </label>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Condición de Pago</label>
                <SearchableSelect
                  value={formData.condicionPago}
                  onChange={(value) => setFormData({ ...formData, condicionPago: value as CondicionPago | '' })}
                  options={[
                    { value: 'contado', label: 'Contado' },
                    { value: 'pago_anticipado', label: 'Pago Anticipado' },
                    { value: '30_dias', label: '30 Días' },
                    { value: '60_dias', label: '60 Días' },
                    { value: '90_dias', label: '90 Días' },
                    { value: 'otro', label: 'Otro' },
                  ]}
                  placeholder="Seleccionar..."
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Contactos - Sección visible para agregar contactos durante la creación */}
        <Card className="bg-purple-50 border-2 border-purple-400 shadow-xl">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h3 className="text-xl font-black text-purple-900 uppercase mb-2">Contactos del Cliente</h3>
              <p className="text-sm text-slate-700 font-medium">Agrega los contactos del cliente. Cada contacto puede tener su propio sector.</p>
            </div>
            <Button
              type="button"
              onClick={() => {
                setEditingContactoIndex(null);
                setContactoForm({ nombre: '', cargo: '', sector: '', telefono: '', interno: '', email: '', esPrincipal: false });
                setShowContactoModal(true);
              }}
              className="ml-4 bg-purple-600 hover:bg-purple-700 text-white"
            >
              + Agregar Contacto
            </Button>
          </div>
          {contactos.length > 0 ? (
            <div className="space-y-2">
              {contactos.map((contacto, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center p-3 bg-white rounded-lg border border-slate-200"
                >
                  <div>
                    <p className="font-bold text-slate-900">{contacto.nombre}</p>
                    <p className="text-xs text-slate-600">{contacto.cargo}{contacto.sector ? ` • ${contacto.sector}` : ''}</p>
                    <p className="text-xs text-slate-500">
                    {contacto.email} | {contacto.telefono}
                    {contacto.interno && ` (Int: ${contacto.interno})`}
                  </p>
                    {contacto.esPrincipal && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-bold">
                        Principal
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditContacto(index)}
                      className="text-blue-600 hover:underline text-xs font-bold uppercase"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteContacto(index)}
                      className="text-red-600 hover:underline text-xs font-bold uppercase"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 bg-white rounded-lg border-2 border-dashed border-purple-300">
              <p className="text-slate-500 text-sm mb-3">No hay contactos agregados aún</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingContactoIndex(null);
                  setContactoForm({ nombre: '', cargo: '', sector: '', telefono: '', interno: '', email: '', esPrincipal: false });
                  setShowContactoModal(true);
                }}
              >
                + Agregar Primer Contacto
              </Button>
            </div>
          )}
        </Card>

        {/* Notas */}
        <Card>
          <h3 className="text-sm font-black text-slate-600 uppercase mb-4">Notas</h3>
          <textarea
            value={formData.notas}
            onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
            rows={4}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Notas internas sobre el cliente..."
          />
        </Card>

        {/* Botones */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/clientes')}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Guardando...' : 'Crear Cliente'}
          </Button>
        </div>
      </form>

      {/* Modal Contacto */}
      {showContactoModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <h3 className="text-lg font-black text-slate-900 uppercase mb-4">
              {editingContactoIndex !== null ? 'Editar Contacto' : 'Nuevo Contacto'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Nombre *</label>
                <Input
                  value={contactoForm.nombre}
                  onChange={(e) => setContactoForm({ ...contactoForm, nombre: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Cargo</label>
                <Input
                  value={contactoForm.cargo}
                  onChange={(e) => setContactoForm({ ...contactoForm, cargo: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Sector</label>
                <Input
                  value={contactoForm.sector}
                  onChange={(e) => setContactoForm({ ...contactoForm, sector: e.target.value })}
                  placeholder="Laboratorio, Control de Calidad, Compras..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Teléfono *</label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Input
                      value={contactoForm.telefono}
                      onChange={(e) => setContactoForm({ ...contactoForm, telefono: e.target.value })}
                      placeholder="Teléfono"
                      required
                    />
                  </div>
                  <div>
                    <Input
                      value={contactoForm.interno}
                      onChange={(e) => setContactoForm({ ...contactoForm, interno: e.target.value })}
                      placeholder="Interno"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Email *</label>
                <Input
                  type="email"
                  value={contactoForm.email}
                  onChange={(e) => setContactoForm({ ...contactoForm, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={contactoForm.esPrincipal}
                    onChange={(e) => setContactoForm({ ...contactoForm, esPrincipal: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-xs font-bold text-slate-600 uppercase">Contacto Principal</span>
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowContactoModal(false);
                  setEditingContactoIndex(null);
                  setContactoForm({ nombre: '', cargo: '', sector: '', telefono: '', interno: '', email: '', esPrincipal: false });
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleAddContacto}>
                {editingContactoIndex !== null ? 'Actualizar' : 'Agregar'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
