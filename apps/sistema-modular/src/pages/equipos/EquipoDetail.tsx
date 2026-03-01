import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  sistemasService, modulosService, categoriasEquipoService,
  categoriasModuloService, clientesService, establecimientosService,
} from '../../services/firebaseService';
import type {
  Sistema, ModuloSistema, CategoriaEquipo, CategoriaModulo,
  Cliente, Establecimiento,
} from '@ags/shared';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EquipoInfoSidebar } from '../../components/equipos/EquipoInfoSidebar';
import { ModulosList, type ModuloFormData } from '../../components/equipos/ModulosList';

export const EquipoDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [sistema, setSistema] = useState<Sistema | null>(null);
  const [establecimiento, setEstablecimiento] = useState<Establecimiento | null>(null);
  const [modulos, setModulos] = useState<ModuloSistema[]>([]);
  const [categorias, setCategorias] = useState<CategoriaEquipo[]>([]);
  const [categoriasModulos, setCategoriasModulos] = useState<CategoriaModulo[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<any>(null);

  useEffect(() => { if (id) loadData(); }, [id]);

  const loadData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [sistemaData, modulosData, cats, catsMod, clientesData] = await Promise.all([
        sistemasService.getById(id),
        modulosService.getBySistema(id),
        categoriasEquipoService.getAll(),
        categoriasModuloService.getAll(),
        clientesService.getAll(true),
      ]);
      if (!sistemaData) { alert('Sistema no encontrado'); navigate('/equipos'); return; }

      setSistema(sistemaData);
      let est: Establecimiento | null = null;
      if (sistemaData.establecimientoId) {
        est = await establecimientosService.getById(sistemaData.establecimientoId);
        setEstablecimiento(est);
      } else { setEstablecimiento(null); }

      const clienteCuit = est?.clienteCuit ?? sistemaData.clienteId ?? '';
      setEstablecimientos(clienteCuit ? await establecimientosService.getByCliente(clienteCuit) : []);

      setFormData({
        clienteId: clienteCuit,
        establecimientoId: sistemaData.establecimientoId || '',
        categoriaId: sistemaData.categoriaId,
        nombre: sistemaData.nombre,
        codigoInternoCliente: sistemaData.codigoInternoCliente,
        software: sistemaData.software || '',
        observaciones: sistemaData.observaciones || '',
        configuracionGC: sistemaData.configuracionGC ?? {},
        activo: sistemaData.activo,
      });

      setModulos(modulosData);
      setCategorias(cats);
      setCategoriasModulos(catsMod);
      setClientes(clientesData);
    } catch (error) {
      console.error('Error cargando datos:', error);
      alert('Error al cargar los datos');
    } finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!id || !formData) return;
    try {
      setSaving(true);
      const { descripcion, ...dataToSave } = formData;
      await sistemasService.update(id, {
        ...dataToSave,
        establecimientoId: formData.establecimientoId || undefined,
        clienteId: formData.clienteId || undefined,
      });
      await loadData();
      setEditing(false);
      alert('Sistema actualizado exitosamente');
    } catch (error) {
      console.error('Error guardando sistema:', error);
      alert('Error al guardar el sistema');
    } finally { setSaving(false); }
  };

  const handleSaveModulo = async (form: ModuloFormData, editingId?: string) => {
    if (!id) return;
    let nombreFinal = form.nombre;
    let descripcionFinal = form.descripcion;
    if (form.categoriaModuloId && form.modeloCodigo) {
      const cat = categoriasModulos.find(c => c.id === form.categoriaModuloId);
      const modelo = cat?.modelos.find(m => m.codigo === form.modeloCodigo);
      if (modelo) { nombreFinal = modelo.codigo; descripcionFinal = modelo.descripcion; }
    }
    if (!nombreFinal.trim()) { alert('Por favor seleccione un modelo o ingrese el nombre del modulo'); return; }

    const clean = (v: any) => (v === '' || v == null ? null : v);
    const data = {
      nombre: nombreFinal,
      descripcion: clean(descripcionFinal),
      serie: clean(form.serie),
      firmware: clean(form.firmware),
      observaciones: clean(form.observaciones),
      ubicaciones: [],
      otIds: [],
    };
    try {
      if (editingId) {
        await modulosService.update(id, editingId, data);
        alert('Modulo actualizado exitosamente');
      } else {
        await modulosService.create(id, data);
        alert('Modulo agregado exitosamente');
      }
      await loadData();
    } catch (error) {
      console.error('Error guardando modulo:', error);
      alert('Error al guardar el modulo. Verifique la consola para mas detalles.');
    }
  };

  const handleDeleteModulo = async (moduloId: string) => {
    if (!id) return;
    if (!confirm('Esta seguro de eliminar este modulo?')) return;
    try {
      await modulosService.delete(id, moduloId);
      await loadData();
    } catch (error) {
      console.error('Error eliminando modulo:', error);
      alert('Error al eliminar el modulo');
    }
  };

  if (loading) return <div className="flex items-center justify-center py-12"><p className="text-slate-400 text-sm">Cargando sistema...</p></div>;
  if (!sistema) return (
    <div className="text-center py-12">
      <p className="text-slate-400 text-sm">Sistema no encontrado</p>
      <Link to="/equipos" className="text-indigo-600 hover:underline mt-2 inline-block text-xs">Volver a Equipos</Link>
    </div>
  );

  const cliente = clientes.find(c => c.id === (establecimiento?.clienteCuit ?? sistema.clienteId));
  const categoria = categorias.find(c => c.id === sistema.categoriaId);

  return (
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col bg-slate-50">
      {/* ---- Sticky header ---- */}
      <div className="shrink-0 bg-white border-b border-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.06)] z-10 px-5 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate('/equipos')} className="text-slate-400 hover:text-slate-600 shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold tracking-tight text-slate-900 truncate">{sistema.nombre}</h1>
                {sistema.activo ? (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">Activo</span>
                ) : (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">Inactivo</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {cliente?.razonSocial}{establecimiento && ` / ${establecimiento.nombre}`}{categoria && ` / ${categoria.nombre}`}
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {!editing ? (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Editar</Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => { setEditing(false); loadData(); }}>Cancelar</Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ---- 2-column body ---- */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="flex gap-5">
          {/* Sidebar */}
          <EquipoInfoSidebar
            sistema={sistema}
            cliente={cliente}
            establecimiento={establecimiento}
            categoria={categoria}
            editing={editing}
            formData={formData}
            setFormData={setFormData}
            clientes={clientes}
            establecimientos={establecimientos}
            setEstablecimientos={setEstablecimientos}
            categorias={categorias}
            loadEstablecimientos={(cid) => establecimientosService.getByCliente(cid)}
          />

          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-4">
            <ModulosList
              sistemaId={id!}
              modulos={modulos}
              categoriasModulos={categoriasModulos}
              onSave={handleSaveModulo}
              onDelete={handleDeleteModulo}
            />

            {/* Ubicaciones placeholder */}
            <Card compact>
              <p className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-2">Ubicaciones</p>
              <p className="text-xs text-slate-400">Historial de ubicaciones (proximamente)</p>
            </Card>

            {/* OT history placeholder */}
            <Card compact>
              <p className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-2">Ordenes de Trabajo</p>
              <p className="text-xs text-slate-400">
                {sistema.otIds && sistema.otIds.length > 0
                  ? `${sistema.otIds.length} OT(s) vinculada(s)`
                  : 'No hay OTs vinculadas'}
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
