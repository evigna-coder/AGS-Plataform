import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { clientesService } from '../../services/firebaseService';
import type { CondicionIva, CondicionPago, TipoServicioCliente } from '@ags/shared';

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
    telefono: '',
    email: '',
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
    if (!formData.telefono.trim()) {
      newErrors.telefono = 'El teléfono es obligatorio';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'El email es obligatorio';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email inválido';
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
      const clienteId = await clientesService.create({
        razonSocial: formData.razonSocial,
        cuit: formData.cuit || undefined,
        pais: formData.pais,
        direccion: formData.direccion,
        localidad: formData.localidad,
        provincia: formData.provincia,
        codigoPostal: formData.codigoPostal || undefined,
        rubro: formData.rubro,
        telefono: formData.telefono,
        email: formData.email,
        condicionIva: formData.condicionIva || undefined,
        ingresosBrutos: formData.ingresosBrutos || undefined,
        convenioMultilateral: formData.convenioMultilateral,
        infoPagos: formData.infoPagos || undefined,
        pagaEnTiempo: formData.pagaEnTiempo,
        sueleDemorarse: formData.sueleDemorarse,
        condicionPago: formData.condicionPago || undefined,
        tipoServicio: formData.tipoServicio || undefined,
        notas: formData.notas || undefined,
        activo: formData.activo,
        contactos: [],
      });
      
      alert('Cliente creado exitosamente');
      navigate(`/clientes/${clienteId}`);
    } catch (error) {
      console.error('Error creando cliente:', error);
      alert('Error al crear el cliente');
    } finally {
      setLoading(false);
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

        {/* Contacto */}
        <Card>
          <h3 className="text-sm font-black text-slate-600 uppercase mb-4">Contacto</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Teléfono *</label>
              <Input
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                error={errors.telefono}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Email *</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                error={errors.email}
                required
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
              <select
                value={formData.condicionIva}
                onChange={(e) => setFormData({ ...formData, condicionIva: e.target.value as CondicionIva | '' })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Seleccionar...</option>
                <option value="monotributo">Monotributo</option>
                <option value="responsable_inscripto">Responsable Inscripto</option>
                <option value="exento">Exento</option>
                <option value="consumidor_final">Consumidor Final</option>
                <option value="otro">Otro</option>
              </select>
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
              <select
                value={formData.tipoServicio}
                onChange={(e) => setFormData({ ...formData, tipoServicio: e.target.value as TipoServicioCliente | '' })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                required
              >
                <option value="">Seleccionar...</option>
                <option value="contrato">Contrato</option>
                <option value="per_incident">Per Incident</option>
              </select>
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
                <select
                  value={formData.condicionPago}
                  onChange={(e) => setFormData({ ...formData, condicionPago: e.target.value as CondicionPago | '' })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Seleccionar...</option>
                  <option value="contado">Contado</option>
                  <option value="pago_anticipado">Pago Anticipado</option>
                  <option value="30_dias">30 Días</option>
                  <option value="60_dias">60 Días</option>
                  <option value="90_dias">90 Días</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
            </div>
          </div>
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
    </div>
  );
};
