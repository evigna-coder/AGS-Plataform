import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';
import { presupuestosService, clientesService, sistemasService, contactosService } from '../../services/firebaseService';
import type { Cliente, Sistema, ContactoCliente, Presupuesto } from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
}

export const CreatePresupuestoModal: React.FC<Props> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [contactos, setContactos] = useState<ContactoCliente[]>([]);
  const [sistemasFiltrados, setSistemasFiltrados] = useState<Sistema[]>([]);
  const [form, setForm] = useState({ clienteId: '', sistemaId: '', contactoId: '' });

  useEffect(() => {
    if (!open) return;
    Promise.all([clientesService.getAll(true), sistemasService.getAll()])
      .then(([c, s]) => { setClientes(c); setSistemas(s); });
  }, [open]);

  useEffect(() => {
    if (form.clienteId) {
      contactosService.getByCliente(form.clienteId).then(setContactos).catch(() => setContactos([]));
      setSistemasFiltrados(sistemas.filter(s => s.clienteId === form.clienteId));
    } else {
      setContactos([]); setSistemasFiltrados([]);
    }
  }, [form.clienteId, sistemas]);

  const handleClose = () => { onClose(); setForm({ clienteId: '', sistemaId: '', contactoId: '' }); };

  const handleSave = async () => {
    if (!form.clienteId) { alert('Debe seleccionar un cliente'); return; }
    try {
      setSaving(true);
      const data: Omit<Presupuesto, 'id' | 'createdAt' | 'updatedAt'> = {
        numero: '', clienteId: form.clienteId, sistemaId: form.sistemaId || null,
        contactoId: form.contactoId || null, estado: 'borrador', items: [],
        subtotal: 0, total: 0, ordenesCompraIds: [],
      };
      const presupuestoId = await presupuestosService.create(data);
      handleClose();
      navigate(`/presupuestos/${presupuestoId}`);
    } catch { alert('Error al crear el presupuesto'); }
    finally { setSaving(false); }
  };

  const lbl = "block text-[11px] font-medium text-slate-600 mb-1";

  return (
    <Modal open={open} onClose={handleClose} title="Nuevo Presupuesto" subtitle="Seleccione cliente y sistema"
      footer={<>
        <Button variant="outline" size="sm" onClick={handleClose}>Cancelar</Button>
        <Button size="sm" onClick={handleSave} disabled={saving || !form.clienteId}>
          {saving ? 'Creando...' : 'Crear Presupuesto'}
        </Button>
      </>}>
      <div className="space-y-4">
        <div>
          <label className={lbl}>Cliente *</label>
          <SearchableSelect value={form.clienteId}
            onChange={v => setForm({ clienteId: v, sistemaId: '', contactoId: '' })}
            options={clientes.map(c => ({ value: c.id, label: c.razonSocial }))}
            placeholder="Seleccionar cliente..." required />
        </div>
        {form.clienteId && (
          <>
            <div>
              <label className={lbl}>Sistema / Equipo</label>
              <SearchableSelect value={form.sistemaId}
                onChange={v => setForm({ ...form, sistemaId: v })}
                options={[{ value: '', label: 'Sin sistema específico' }, ...sistemasFiltrados.map(s => ({ value: s.id, label: `${s.nombre} (${s.codigoInternoCliente})` }))]}
                placeholder="Seleccionar sistema..." />
            </div>
            {contactos.length > 0 && (
              <div>
                <label className={lbl}>Contacto</label>
                <SearchableSelect value={form.contactoId}
                  onChange={v => setForm({ ...form, contactoId: v })}
                  options={[{ value: '', label: 'Sin contacto específico' }, ...contactos.map(c => ({ value: c.id, label: `${c.nombre}${c.cargo ? ` - ${c.cargo}` : ''}` }))]}
                  placeholder="Seleccionar contacto..." />
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};
