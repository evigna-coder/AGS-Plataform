import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { clientesService, sistemasService, categoriasEquipoService, establecimientosService } from '../../services/firebaseService';
import type { Cliente, CondicionIva, Sistema, CategoriaEquipo, Establecimiento } from '@ags/shared';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export const ClienteDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [categorias, setCategorias] = useState<CategoriaEquipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<any>(null);

  useEffect(() => {
    if (id) loadCliente();
  }, [id]);

  const loadCliente = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [clienteData, sistemasData, establecimientosData, categoriasData] = await Promise.all([
        clientesService.getById(id),
        sistemasService.getAll({ clienteCuit: id, activosOnly: false }),
        establecimientosService.getByCliente(id),
        categoriasEquipoService.getAll(),
      ]);
      if (clienteData) {
        setCliente(clienteData);
        setEstablecimientos(establecimientosData);
        setFormData({
          razonSocial: clienteData.razonSocial,
          cuit: clienteData.cuit || '',
          pais: clienteData.pais,
          direccionFiscal: clienteData.direccionFiscal ?? clienteData.direccion ?? '',
          localidadFiscal: clienteData.localidadFiscal ?? clienteData.localidad ?? '',
          provinciaFiscal: clienteData.provinciaFiscal ?? clienteData.provincia ?? '',
          codigoPostalFiscal: clienteData.codigoPostalFiscal ?? clienteData.codigoPostal ?? '',
          rubro: clienteData.rubro,
          condicionIva: clienteData.condicionIva || '',
          ingresosBrutos: clienteData.ingresosBrutos || '',
          convenioMultilateral: clienteData.convenioMultilateral || false,
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
      
      // Limpiar campos vacíos para evitar undefined en Firestore
      const clienteData: any = {
        razonSocial: formData.razonSocial,
        pais: formData.pais,
        rubro: formData.rubro,
        convenioMultilateral: formData.convenioMultilateral || false,
        activo: formData.activo,
      };
      if (formData.cuit?.trim()) clienteData.cuit = formData.cuit.trim();
      if (formData.direccionFiscal?.trim()) clienteData.direccionFiscal = formData.direccionFiscal.trim();
      if (formData.localidadFiscal?.trim()) clienteData.localidadFiscal = formData.localidadFiscal.trim();
      if (formData.provinciaFiscal?.trim()) clienteData.provinciaFiscal = formData.provinciaFiscal.trim();
      if (formData.codigoPostalFiscal?.trim()) clienteData.codigoPostalFiscal = formData.codigoPostalFiscal.trim();
      if (formData.condicionIva) clienteData.condicionIva = formData.condicionIva;
      if (formData.ingresosBrutos?.trim()) clienteData.ingresosBrutos = formData.ingresosBrutos.trim();
      if (formData.notas?.trim()) clienteData.notas = formData.notas.trim();
      
      await clientesService.update(id, clienteData);
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

      {/* Domicilio fiscal (opcional) */}
      <Card>
        <h3 className="text-sm font-black text-slate-600 uppercase mb-4">Domicilio fiscal</h3>
        {editing ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Dirección</label>
              <Input
                value={formData.direccionFiscal ?? ''}
                onChange={(e) => setFormData({ ...formData, direccionFiscal: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Localidad</label>
              <Input
                value={formData.localidadFiscal ?? ''}
                onChange={(e) => setFormData({ ...formData, localidadFiscal: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Provincia</label>
              <Input
                value={formData.provinciaFiscal ?? ''}
                onChange={(e) => setFormData({ ...formData, provinciaFiscal: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Código Postal</label>
              <Input
                value={formData.codigoPostalFiscal ?? ''}
                onChange={(e) => setFormData({ ...formData, codigoPostalFiscal: e.target.value })}
              />
            </div>
          </div>
        ) : (
          <p className="text-slate-600">
            {(cliente as any).direccionFiscal ?? (cliente as any).direccion
              ? `${(cliente as any).direccionFiscal ?? (cliente as any).direccion}, ${(cliente as any).localidadFiscal ?? (cliente as any).localidad ?? ''}, ${(cliente as any).provinciaFiscal ?? (cliente as any).provincia ?? ''}${(cliente as any).codigoPostalFiscal || (cliente as any).codigoPostal ? ` (${(cliente as any).codigoPostalFiscal ?? (cliente as any).codigoPostal})` : ''}`
              : '—'}
          </p>
        )}
      </Card>

      {/* Fiscal / IVA - Solo lectura */}
      {(cliente as any).condicionIva && (
        <Card>
          <h3 className="text-sm font-black text-slate-600 uppercase mb-4">Fiscal</h3>
          <div className="text-sm">
            <p className="text-slate-400 text-xs uppercase font-bold mb-1">Condición IVA</p>
            <p className="text-slate-600">{(cliente as any).condicionIva}</p>
          </div>
        </Card>
      )}

      {/* Establecimientos */}
      <Card className="border-2 border-amber-200 bg-amber-50/30">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-black text-slate-900 uppercase">Establecimientos</h3>
          <div className="flex gap-2">
            <Link to={`/establecimientos/nuevo?cliente=${id}`}>
              <Button variant="outline">+ Agregar Establecimiento</Button>
            </Link>
            <Link to={`/establecimientos?cliente=${id}`}>
              <Button variant="outline">Ver Todos</Button>
            </Link>
          </div>
        </div>
        {establecimientos.length > 0 ? (
          <div className="space-y-2">
            {establecimientos.map((est) => (
              <div
                key={est.id}
                className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100"
              >
                <div>
                  <p className="font-black text-slate-900 uppercase">{est.nombre}</p>
                  <p className="text-xs text-slate-500">{est.direccion}, {est.localidad}, {est.provincia}</p>
                </div>
                <Link to={`/establecimientos/${est.id}`}>
                  <Button variant="outline" size="sm">Ver</Button>
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-slate-400 text-sm mb-2">No hay establecimientos. Agregue uno para luego asignar sistemas/equipos.</p>
            <Link to={`/establecimientos/nuevo?cliente=${id}`}>
              <Button variant="outline" size="sm">+ Agregar Establecimiento</Button>
            </Link>
          </div>
        )}
      </Card>

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
              const establecimiento = sistema.establecimientoId ? establecimientos.find(e => e.id === sistema.establecimientoId) : null;
              return (
                <div
                  key={sistema.id}
                  className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100"
                >
                  <div>
                    <p className="font-black text-slate-900 uppercase">{sistema.nombre}</p>
                    <div className="flex gap-3 mt-1 text-xs text-slate-500">
                      {establecimiento && <span>• {establecimiento.nombre}</span>}
                      {categoria && <span>{categoria.nombre}</span>}
                      {sistema.codigoInternoCliente && <span>• Código: {sistema.codigoInternoCliente}</span>}
                      {sistema.software && <span>• Software: {sistema.software}</span>}
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
            <p className="text-slate-400 text-sm mb-2">No hay sistemas registrados. Cree un establecimiento y luego agregue sistemas.</p>
            <Link to={`/equipos/nuevo?cliente=${id}`}>
              <Button variant="outline" size="sm">Agregar Sistema</Button>
            </Link>
          </div>
        )}
      </Card>

      </div>
  );
};
