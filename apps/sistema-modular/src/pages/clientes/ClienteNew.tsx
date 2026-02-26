import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { clientesService } from '../../services/firebaseService';
import type { CondicionIva } from '@ags/shared';

export const ClienteNew = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    razonSocial: '',
    cuit: '',
    pais: 'Argentina',
    direccionFiscal: '',
    localidadFiscal: '',
    provinciaFiscal: '',
    codigoPostalFiscal: '',
    rubro: '',
    condicionIva: '' as CondicionIva | '',
    ingresosBrutos: '',
    convenioMultilateral: false,
    notas: '',
    activo: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.razonSocial.trim()) newErrors.razonSocial = 'La razón social es obligatoria';
    if (!formData.rubro.trim()) newErrors.rubro = 'El rubro es obligatorio';
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
        rubro: formData.rubro,
        convenioMultilateral: formData.convenioMultilateral,
        activo: formData.activo,
      };
      if (formData.cuit?.trim()) clienteData.cuit = formData.cuit.trim();
      else clienteData.cuit = null;
      if (formData.direccionFiscal?.trim()) clienteData.direccionFiscal = formData.direccionFiscal.trim();
      if (formData.localidadFiscal?.trim()) clienteData.localidadFiscal = formData.localidadFiscal.trim();
      if (formData.provinciaFiscal?.trim()) clienteData.provinciaFiscal = formData.provinciaFiscal.trim();
      if (formData.codigoPostalFiscal?.trim()) clienteData.codigoPostalFiscal = formData.codigoPostalFiscal.trim();
      if (formData.condicionIva) clienteData.condicionIva = formData.condicionIva;
      if (formData.ingresosBrutos?.trim()) clienteData.ingresosBrutos = formData.ingresosBrutos.trim();
      if (formData.notas?.trim()) clienteData.notas = formData.notas.trim();
      const clienteId = await clientesService.create(clienteData);
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
                placeholder="Con o sin guiones; se normaliza al guardar"
              />
              <p className="text-xs text-slate-500 mt-1">Si no tiene CUIT, el cliente se creará con ID temporal (LEGACY). Puede completarlo después editando.</p>
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

        {/* Domicilio fiscal (opcional) */}
        <Card>
          <h3 className="text-sm font-black text-slate-600 uppercase mb-4">Domicilio fiscal (opcional)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Dirección</label>
              <Input
                value={formData.direccionFiscal}
                onChange={(e) => setFormData({ ...formData, direccionFiscal: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Localidad</label>
              <Input
                value={formData.localidadFiscal}
                onChange={(e) => setFormData({ ...formData, localidadFiscal: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Provincia</label>
              <Input
                value={formData.provinciaFiscal}
                onChange={(e) => setFormData({ ...formData, provinciaFiscal: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Código postal</label>
              <Input
                value={formData.codigoPostalFiscal}
                onChange={(e) => setFormData({ ...formData, codigoPostalFiscal: e.target.value })}
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
