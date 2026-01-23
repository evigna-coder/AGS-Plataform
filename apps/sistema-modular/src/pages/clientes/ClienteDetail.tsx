import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { clientesService, contactosService, sistemasService, categoriasEquipoService } from '../../services/firebaseService';
import type { Cliente, ContactoCliente, CondicionIva, CondicionPago, TipoServicioCliente, Sistema, CategoriaEquipo } from '@ags/shared';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export const ClienteDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [categorias, setCategorias] = useState<CategoriaEquipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<any>(null);
  const [showContactoModal, setShowContactoModal] = useState(false);
  const [editingContacto, setEditingContacto] = useState<ContactoCliente | null>(null);
  const [contactoForm, setContactoForm] = useState({
    nombre: '',
    cargo: '',
    sector: '',
    telefono: '',
    email: '',
    esPrincipal: false,
  });

  useEffect(() => {
    if (id) loadCliente();
  }, [id]);

  const loadCliente = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [clienteData, sistemasData, categoriasData] = await Promise.all([
        clientesService.getById(id),
        sistemasService.getAll({ clienteId: id, activosOnly: false }),
        categoriasEquipoService.getAll(),
      ]);
      if (clienteData) {
        setCliente(clienteData);
        setFormData({
          razonSocial: clienteData.razonSocial,
          cuit: clienteData.cuit || '',
          pais: clienteData.pais,
          direccion: clienteData.direccion,
          localidad: clienteData.localidad,
          provincia: clienteData.provincia,
          codigoPostal: clienteData.codigoPostal || '',
          rubro: clienteData.rubro,
          telefono: clienteData.telefono,
          email: clienteData.email,
          condicionIva: clienteData.condicionIva || '',
          ingresosBrutos: clienteData.ingresosBrutos || '',
          convenioMultilateral: clienteData.convenioMultilateral || false,
          infoPagos: clienteData.infoPagos || '',
          pagaEnTiempo: clienteData.pagaEnTiempo || false,
          sueleDemorarse: clienteData.sueleDemorarse || false,
          condicionPago: clienteData.condicionPago || '',
          notas: clienteData.notas || '',
          activo: clienteData.activo,
        });
        setSistemas(sistemasData);
        setCategorias(categoriasData);
      } else {
        alert('Cliente no encontrado');
        navigate('/clientes');
      }
    } catch (error) {
      console.error('Error cargando cliente:', error);
      alert('Error al cargar el cliente');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!id || !formData) return;
    try {
      setSaving(true);
      await clientesService.update(id, formData);
      await loadCliente();
      setEditing(false);
      alert('Cliente actualizado exitosamente');
    } catch (error) {
      console.error('Error guardando cliente:', error);
      alert('Error al guardar el cliente');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveContacto = async () => {
    if (!id) return;
    
    // Validación básica
    if (!contactoForm.nombre.trim() || !contactoForm.telefono.trim() || !contactoForm.email.trim()) {
      alert('Por favor complete los campos obligatorios: Nombre, Teléfono y Email');
      return;
    }
    
    try {
      if (editingContacto) {
        await contactosService.update(id, editingContacto.id, contactoForm);
        alert('Contacto actualizado exitosamente');
      } else {
        await contactosService.create(id, contactoForm);
        alert('Contacto agregado exitosamente');
      }
      await loadCliente();
      setShowContactoModal(false);
      setEditingContacto(null);
      setContactoForm({ nombre: '', cargo: '', sector: '', telefono: '', email: '', esPrincipal: false });
    } catch (error) {
      console.error('Error guardando contacto:', error);
      alert('Error al guardar el contacto. Verifique la consola para más detalles.');
    }
  };

  const handleDeleteContacto = async (contactoId: string) => {
    if (!id) return;
    if (!confirm('¿Está seguro de eliminar este contacto?')) return;
    try {
      await contactosService.delete(id, contactoId);
      await loadCliente();
    } catch (error) {
      console.error('Error eliminando contacto:', error);
      alert('Error al eliminar el contacto');
    }
  };

  const handleEditContacto = (contacto: ContactoCliente) => {
    setEditingContacto(contacto);
    setContactoForm({
      nombre: contacto.nombre,
      cargo: contacto.cargo,
      sector: contacto.sector || '',
      telefono: contacto.telefono,
      email: contacto.email,
      esPrincipal: contacto.esPrincipal,
    });
    setShowContactoModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-400">Cargando cliente...</p>
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Cliente no encontrado</p>
        <Link to="/clientes" className="text-blue-600 hover:underline mt-2 inline-block">
          Volver a Clientes
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
            {cliente.razonSocial}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {cliente.activo ? (
              <span className="text-green-600 font-bold">● Activo</span>
            ) : (
              <span className="text-slate-400 font-bold">● Inactivo</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {!editing && (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>
                Editar
              </Button>
              <Button variant="outline" onClick={() => navigate('/clientes')}>
                Volver
              </Button>
            </>
          )}
          {editing && (
            <>
              <Button variant="outline" onClick={() => { setEditing(false); loadCliente(); }}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Datos Básicos */}
      <Card>
        <h3 className="text-sm font-black text-slate-600 uppercase mb-4">Datos Básicos</h3>
        {editing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Razón Social *</label>
              <Input
                value={formData.razonSocial}
                onChange={(e) => setFormData({ ...formData, razonSocial: e.target.value })}
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
                required
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-400 text-xs uppercase font-bold mb-1">Razón Social</p>
              <p className="font-bold text-slate-900">{cliente.razonSocial}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs uppercase font-bold mb-1">CUIT</p>
              <p className="font-mono text-slate-600">{cliente.cuit || '-'}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs uppercase font-bold mb-1">Rubro</p>
              <p className="text-slate-600">{cliente.rubro}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs uppercase font-bold mb-1">País</p>
              <p className="text-slate-600">{cliente.pais}</p>
            </div>
          </div>
        )}
      </Card>

      {/* Dirección */}
      <Card>
        <h3 className="text-sm font-black text-slate-600 uppercase mb-4">Dirección</h3>
        {editing ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Dirección *</label>
              <Input
                value={formData.direccion}
                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Localidad *</label>
              <Input
                value={formData.localidad}
                onChange={(e) => setFormData({ ...formData, localidad: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Provincia *</label>
              <Input
                value={formData.provincia}
                onChange={(e) => setFormData({ ...formData, provincia: e.target.value })}
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
        ) : (
          <p className="text-slate-600">
            {cliente.direccion}, {cliente.localidad}, {cliente.provincia}
            {cliente.codigoPostal && ` (${cliente.codigoPostal})`}
          </p>
        )}
      </Card>

      {/* Contacto Principal */}
      <Card>
        <h3 className="text-sm font-black text-slate-600 uppercase mb-4">Contacto Principal</h3>
        {editing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Teléfono *</label>
              <Input
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Email *</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-400 text-xs uppercase font-bold mb-1">Teléfono</p>
              <p className="text-slate-600">{cliente.telefono}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs uppercase font-bold mb-1">Email</p>
              <p className="text-slate-600">{cliente.email}</p>
            </div>
          </div>
        )}
      </Card>

      {/* Contactos */}
      <Card className="border-2 border-purple-200 bg-purple-50/30">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-black text-slate-900 uppercase mb-2">Contactos del Cliente</h3>
            <p className="text-sm text-slate-600">Puedes agregar múltiples contactos. Cada contacto puede tener su propio sector.</p>
          </div>
          <Button
            onClick={() => {
              setEditingContacto(null);
              setContactoForm({ nombre: '', cargo: '', sector: '', telefono: '', email: '', esPrincipal: false });
              setShowContactoModal(true);
            }}
            className="ml-4"
          >
            + Agregar Contacto
          </Button>
        </div>
        {cliente.contactos && cliente.contactos.length > 0 ? (
          <div className="space-y-2">
            {cliente.contactos.map((contacto) => (
              <div
                key={contacto.id}
                className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200"
              >
                <div>
                  <p className="font-bold text-slate-900">{contacto.nombre}</p>
                  <p className="text-xs text-slate-600">{contacto.cargo}{contacto.sector ? ` • ${contacto.sector}` : ''}</p>
                  <p className="text-xs text-slate-500">{contacto.email} | {contacto.telefono}</p>
                  {contacto.esPrincipal && (
                    <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-bold">
                      Principal
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditContacto(contacto)}
                    className="text-blue-600 hover:underline text-xs font-bold uppercase"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDeleteContacto(contacto.id)}
                    className="text-red-600 hover:underline text-xs font-bold uppercase"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-white rounded-lg border-2 border-dashed border-slate-300">
            <p className="text-slate-400 text-sm mb-3">No hay contactos registrados</p>
            <Button
              variant="outline"
              onClick={() => {
                setEditingContacto(null);
                setContactoForm({ nombre: '', cargo: '', sector: '', telefono: '', email: '', esPrincipal: false });
                setShowContactoModal(true);
              }}
            >
              + Agregar Primer Contacto
            </Button>
          </div>
        )}
      </Card>

      {/* Tipo de Servicio */}
      <Card>
        <h3 className="text-sm font-black text-slate-600 uppercase mb-4">Tipo de Servicio</h3>
        {editing ? (
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
        ) : (
          <div className="text-sm">
            {cliente.tipoServicio ? (
              <>
                <p className="text-slate-400 text-xs uppercase font-bold mb-1">Condición</p>
                <p className="font-bold text-slate-900 uppercase">
                  {cliente.tipoServicio === 'contrato' ? 'Contrato' : 'Per Incident'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {cliente.tipoServicio === 'contrato' 
                    ? 'Tiempo de respuesta según contrato. OTs no requieren aceptación de presupuesto.'
                    : 'Tiempo de respuesta estándar. OTs requieren aceptación de presupuesto.'}
                </p>
              </>
            ) : (
              <p className="text-slate-400 text-sm">No especificado</p>
            )}
          </div>
        )}
      </Card>

      {/* Fiscal / IVA y Pagos - Solo lectura por ahora */}
      {(cliente.condicionIva || cliente.infoPagos) && (
        <Card>
          <h3 className="text-sm font-black text-slate-600 uppercase mb-4">Fiscal / Pagos</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {cliente.condicionIva && (
              <div>
                <p className="text-slate-400 text-xs uppercase font-bold mb-1">Condición IVA</p>
                <p className="text-slate-600">{cliente.condicionIva}</p>
              </div>
            )}
            {cliente.condicionPago && (
              <div>
                <p className="text-slate-400 text-xs uppercase font-bold mb-1">Condición de Pago</p>
                <p className="text-slate-600">{cliente.condicionPago}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Sistemas del Cliente */}
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-black text-slate-600 uppercase">Sistemas / Equipos</h3>
          <div className="flex gap-2">
            <Link to={`/equipos/nuevo?cliente=${id}`}>
              <Button variant="outline">+ Agregar Sistema</Button>
            </Link>
            <Link to={`/equipos?cliente=${id}`}>
              <Button variant="outline">Ver Todos</Button>
            </Link>
          </div>
        </div>
        {sistemas.length > 0 ? (
          <div className="space-y-2">
            {sistemas.map((sistema) => {
              const categoria = categorias.find(c => c.id === sistema.categoriaId);
              return (
                <div
                  key={sistema.id}
                  className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100"
                >
                  <div>
                    <p className="font-black text-slate-900 uppercase">{sistema.nombre}</p>
                    <p className="text-xs text-slate-600">{sistema.descripcion}</p>
                    <div className="flex gap-3 mt-1 text-xs text-slate-500">
                      {categoria && <span>{categoria.nombre}</span>}
                      {sistema.codigoInternoCliente && <span>• Código: {sistema.codigoInternoCliente}</span>}
                      <span className={sistema.activo ? 'text-green-600 font-bold' : 'text-slate-400'}>
                        {sistema.activo ? '● Activo' : '● Inactivo'}
                      </span>
                    </div>
                  </div>
                  <Link to={`/equipos/${sistema.id}`}>
                    <Button variant="outline" size="sm">Ver</Button>
                  </Link>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-slate-400 text-sm mb-2">No hay sistemas registrados para este cliente</p>
            <Link to={`/equipos/nuevo?cliente=${id}`}>
              <Button variant="outline" size="sm">Agregar Primer Sistema</Button>
            </Link>
          </div>
        )}
      </Card>

      {/* Modal Contacto */}
      {showContactoModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <h3 className="text-lg font-black text-slate-900 uppercase mb-4">
              {editingContacto ? 'Editar Contacto' : 'Nuevo Contacto'}
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
                <Input
                  value={contactoForm.telefono}
                  onChange={(e) => setContactoForm({ ...contactoForm, telefono: e.target.value })}
                  required
                />
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
                  setEditingContacto(null);
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleSaveContacto}>
                Guardar
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
