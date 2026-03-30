import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { clientesService, sistemasService, categoriasEquipoService, establecimientosService } from '../../services/firebaseService';
import type { Cliente, Sistema, CategoriaEquipo, Establecimiento } from '@ags/shared';
import { Button } from '../../components/ui/Button';
import { ClienteInfoSidebar } from '../../components/clientes/ClienteInfoSidebar';
import { ClienteMainContent } from '../../components/clientes/ClienteMainContent';
import { useNavigateBack } from '../../hooks/useNavigateBack';

export const ClienteDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const goBack = useNavigateBack();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [categorias, setCategorias] = useState<CategoriaEquipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<any>(null);

  // Real-time subscription for the cliente document
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const unsub = clientesService.subscribeById(id, (clienteData) => {
      if (clienteData) {
        setCliente(clienteData);
        if (!editing) {
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
            requiereTrazabilidad: clienteData.requiereTrazabilidad || false,
            notas: clienteData.notas || '',
            activo: clienteData.activo,
          });
        }
      } else {
        alert('Cliente no encontrado');
        navigate('/clientes');
      }
      setLoading(false);
    }, (err) => {
      console.error('Error cargando cliente:', err);
      alert('Error al cargar el cliente');
      setLoading(false);
    });
    return () => unsub();
  }, [id]);

  // One-shot reference loads (sistemas, establecimientos, categorias)
  useEffect(() => {
    if (!id) return;
    const loadRefs = async () => {
      try {
        const [sistemasData, establecimientosData, categoriasData] = await Promise.all([
          sistemasService.getAll({ clienteCuit: id, activosOnly: false }),
          establecimientosService.getByCliente(id),
          categoriasEquipoService.getAll(),
        ]);
        setSistemas(sistemasData);
        setEstablecimientos(establecimientosData);
        setCategorias(categoriasData);
      } catch (error) {
        console.error('Error cargando referencias:', error);
      }
    };
    loadRefs();
  }, [id]);

  const loadCliente = async () => {
    // Kept for onRefresh callback in child components (triggers ref reload)
    if (!id) return;
    try {
      const [sistemasData, establecimientosData] = await Promise.all([
        sistemasService.getAll({ clienteCuit: id, activosOnly: false }),
        establecimientosService.getByCliente(id),
      ]);
      setSistemas(sistemasData);
      setEstablecimientos(establecimientosData);
    } catch (error) {
      console.error('Error recargando referencias:', error);
    }
  };

  const handleSave = async () => {
    if (!id || !formData) return;
    try {
      setSaving(true);
      const clienteData: any = {
        razonSocial: formData.razonSocial,
        pais: formData.pais,
        rubro: formData.rubro,
        convenioMultilateral: formData.convenioMultilateral || false,
        requiereTrazabilidad: formData.requiereTrazabilidad || false,
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
      // Subscription will auto-update the cliente state
      setEditing(false);
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
        <Link to="/clientes" className="text-teal-600 hover:underline mt-2 inline-block text-sm">
          Volver a Clientes
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Compact header */}
      <div className="shrink-0 bg-white border-b border-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.06)] z-10 px-5 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => goBack()} className="text-slate-400 hover:text-slate-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <div>
              <h2 className="text-base font-semibold text-slate-900 tracking-tight">{cliente.razonSocial}</h2>
              <p className="text-xs text-slate-400">
                CUIT: {cliente.cuit || '—'} · {cliente.rubro}
                {' · '}
                <span className={cliente.activo ? 'text-green-600' : 'text-slate-400'}>
                  {cliente.activo ? 'Activo' : 'Inactivo'}
                </span>
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {!editing ? (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                Editar
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2-column body */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="flex gap-5">
          <ClienteInfoSidebar
            cliente={cliente}
            editing={editing}
            formData={formData}
            setFormData={setFormData}
          />
          <ClienteMainContent
            clienteId={id!}
            cliente={cliente}
            sistemas={sistemas}
            establecimientos={establecimientos}
            categorias={categorias}
            editing={editing}
            formData={formData}
            setFormData={setFormData}
            onRefresh={loadCliente}
          />
        </div>
      </div>
    </div>
  );
};
