import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import { sistemasService, clientesService, establecimientosService, categoriasEquipoService } from '../../services/firebaseService';
import type { Cliente, Establecimiento, CategoriaEquipo } from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export const CreateEquipoModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [categorias, setCategorias] = useState<CategoriaEquipo[]>([]);
  const [estFiltrados, setEstFiltrados] = useState<Establecimiento[]>([]);

  const [form, setForm] = useState({
    clienteId: '', establecimientoId: '', categoriaId: '',
    nombre: '', nombreManual: '', software: '', codigoInternoCliente: '',
  });

  useEffect(() => {
    if (!open) return;
    Promise.all([
      clientesService.getAll(true), establecimientosService.getAll(), categoriasEquipoService.getAll(),
    ]).then(([c, e, cat]) => {
      setClientes(c); setEstablecimientos(e); setCategorias(cat);
    });
  }, [open]);

  useEffect(() => {
    if (form.clienteId) {
      setEstFiltrados(establecimientos.filter(e => e.clienteCuit === form.clienteId));
    } else {
      setEstFiltrados([]);
    }
  }, [form.clienteId, establecimientos]);

  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const selectedCategoria = categorias.find(c => c.id === form.categoriaId);
  const hasModelos = selectedCategoria && Array.isArray(selectedCategoria.modelos) && selectedCategoria.modelos.length > 0;

  const handleClose = () => {
    onClose();
    setForm({ clienteId: '', establecimientoId: '', categoriaId: '', nombre: '', nombreManual: '', software: '', codigoInternoCliente: '' });
  };

  const handleSave = async () => {
    if (!form.establecimientoId) { alert('Seleccione un establecimiento'); return; }
    if (!form.categoriaId) { alert('Seleccione una categoria'); return; }
    const finalNombre = form.nombre === '__otro__' ? form.nombreManual.trim() : form.nombre;
    if (!finalNombre) { alert('El nombre es obligatorio'); return; }

    setSaving(true);
    try {
      const sistemaId = await sistemasService.create({
        establecimientoId: form.establecimientoId,
        clienteId: form.clienteId || null,
        categoriaId: form.categoriaId,
        nombre: finalNombre,
        software: form.software.trim() || null,
        codigoInternoCliente: form.codigoInternoCliente.trim() || `PROV-${Date.now().toString(36).toUpperCase()}`,
        activo: true,
        ubicaciones: [],
        otIds: [],
      });
      handleClose();
      onCreated();
      navigate(`/equipos/${sistemaId}`);
    } catch { alert('Error al crear el sistema'); }
    finally { setSaving(false); }
  };

  const lbl = "block text-[11px] font-medium text-slate-500 mb-1";

  return (
    <Modal open={open} onClose={handleClose} title="Nuevo sistema / equipo"
      subtitle="Seleccione cliente, establecimiento y categoria"
      footer={<>
        <Button variant="outline" size="sm" onClick={handleClose}>Cancelar</Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Creando...' : 'Crear sistema'}
        </Button>
      </>}>
      <div className="space-y-4">
        <div>
          <label className={lbl}>Cliente *</label>
          <SearchableSelect value={form.clienteId}
            onChange={v => { set('clienteId', v); set('establecimientoId', ''); }}
            options={clientes.map(c => ({ value: c.id, label: c.razonSocial }))}
            placeholder="Seleccionar cliente..." />
        </div>

        {form.clienteId && (
          <div>
            <label className={lbl}>Establecimiento *</label>
            <SearchableSelect value={form.establecimientoId}
              onChange={v => set('establecimientoId', v)}
              options={estFiltrados.map(e => ({ value: e.id, label: `${e.nombre} — ${e.localidad}` }))}
              placeholder="Seleccionar establecimiento..." />
          </div>
        )}

        <hr className="border-slate-100" />

        <div>
          <label className={lbl}>Categoria *</label>
          <SearchableSelect value={form.categoriaId}
            onChange={v => { set('categoriaId', v); set('nombre', ''); set('nombreManual', ''); }}
            options={categorias.map(c => ({ value: c.id, label: c.nombre }))}
            placeholder="Seleccionar categoria..." />
        </div>

        {form.categoriaId && (
          <>
            {hasModelos ? (
              <div>
                <label className={lbl}>Modelo / Nombre *</label>
                <SearchableSelect value={form.nombre}
                  onChange={v => set('nombre', v)}
                  options={[
                    ...selectedCategoria!.modelos.map((m: any) => ({ value: typeof m === 'string' ? m : m.nombre, label: typeof m === 'string' ? m : m.nombre })),
                    { value: '__otro__', label: 'Otro (ingresar manualmente)' },
                  ]}
                  placeholder="Seleccionar modelo..." />
                {form.nombre === '__otro__' && (
                  <div className="mt-2">
                    <Input inputSize="sm" label="Nombre manual *" value={form.nombreManual}
                      onChange={e => set('nombreManual', e.target.value)} placeholder="Nombre del sistema..." />
                  </div>
                )}
              </div>
            ) : (
              <Input inputSize="sm" label="Nombre *" value={form.nombre}
                onChange={e => set('nombre', e.target.value)} placeholder="Nombre del sistema..." />
            )}
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input inputSize="sm" label="Codigo interno cliente" value={form.codigoInternoCliente}
            onChange={e => set('codigoInternoCliente', e.target.value)} placeholder="Ej: HPLC-01 (auto si vacio)" />
          <Input inputSize="sm" label="Software" value={form.software}
            onChange={e => set('software', e.target.value)} placeholder="Ej: OpenLab CDS" />
        </div>
      </div>
    </Modal>
  );
};
