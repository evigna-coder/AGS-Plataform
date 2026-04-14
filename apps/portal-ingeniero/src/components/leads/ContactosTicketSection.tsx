import { useEffect, useState } from 'react';
import type { ContactoTicket, ContactoCliente } from '@ags/shared';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { SearchableSelect } from '../ui/SearchableSelect';
import { clientesService } from '../../services/firebaseService';

const emptyForm: Omit<ContactoTicket, 'id'> = {
  nombre: '', cargo: '', sector: '', telefono: '', interno: '', email: '', esPrincipal: false,
};

interface Props {
  contactos: ContactoTicket[];
  clienteId: string | null;
  onChange: (contactos: ContactoTicket[]) => void;
  readOnly?: boolean;
}

const newId = () => `ct-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

export function ContactosTicketSection({ contactos, clienteId, onChange, readOnly }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ContactoTicket | null>(null);
  const [form, setForm] = useState<Omit<ContactoTicket, 'id'>>(emptyForm);
  const [clienteContactos, setClienteContactos] = useState<ContactoCliente[]>([]);

  useEffect(() => {
    if (!showModal || !clienteId) { setClienteContactos([]); return; }
    let active = true;
    clientesService.getContactos(clienteId)
      .then(list => { if (active) setClienteContactos(list); })
      .catch(() => { if (active) setClienteContactos([]); });
    return () => { active = false; };
  }, [showModal, clienteId]);

  const handlePickFromCliente = (nombre: string) => {
    const match = clienteContactos.find(c => c.nombre === nombre);
    if (match) {
      setForm(prev => ({
        ...prev,
        nombre: match.nombre,
        cargo: match.cargo || prev.cargo,
        sector: match.sector || prev.sector,
        telefono: match.telefono || prev.telefono,
        interno: match.interno || prev.interno,
        email: match.email || prev.email,
      }));
    } else {
      setForm(prev => ({ ...prev, nombre }));
    }
  };

  const openNew = () => { setEditing(null); setForm({ ...emptyForm, esPrincipal: contactos.length === 0 }); setShowModal(true); };
  const openEdit = (c: ContactoTicket) => {
    setEditing(c);
    setForm({
      nombre: c.nombre, cargo: c.cargo ?? '', sector: c.sector ?? '',
      telefono: c.telefono ?? '', interno: c.interno ?? '', email: c.email ?? '',
      esPrincipal: c.esPrincipal,
    });
    setShowModal(true);
  };
  const close = () => { setShowModal(false); setEditing(null); setForm(emptyForm); };

  const applyPrincipal = (list: ContactoTicket[], principalId: string | null): ContactoTicket[] => {
    if (!principalId) return list;
    return list.map(c => ({ ...c, esPrincipal: c.id === principalId }));
  };

  const handleSave = () => {
    if (!form.nombre.trim()) return;
    const cleaned: Omit<ContactoTicket, 'id'> = {
      nombre: form.nombre.trim(),
      cargo: form.cargo?.trim() || undefined,
      sector: form.sector?.trim() || undefined,
      telefono: form.telefono?.trim() || undefined,
      interno: form.interno?.trim() || undefined,
      email: form.email?.trim() || undefined,
      esPrincipal: form.esPrincipal,
    };
    let next: ContactoTicket[];
    if (editing) {
      next = contactos.map(c => c.id === editing.id ? { ...cleaned, id: editing.id } : c);
    } else {
      next = [...contactos, { ...cleaned, id: newId() }];
    }
    if (cleaned.esPrincipal) {
      const target = editing?.id ?? next[next.length - 1].id;
      next = applyPrincipal(next, target);
    } else if (!next.some(c => c.esPrincipal) && next.length > 0) {
      next = applyPrincipal(next, next[0].id);
    }
    onChange(next);
    close();
  };

  const handleDelete = (id: string) => {
    if (!confirm('¿Eliminar este contacto?')) return;
    let next = contactos.filter(c => c.id !== id);
    if (!next.some(c => c.esPrincipal) && next.length > 0) {
      next = applyPrincipal(next, next[0].id);
    }
    onChange(next);
  };

  return (
    <>
      <Card>
        <div className="p-3 md:p-4">
          <div className="flex justify-between items-center mb-2 md:mb-3">
            <h3 className="text-[11px] font-medium text-slate-400">Contactos</h3>
            {!readOnly && <Button size="sm" onClick={openNew}>+ Agregar</Button>}
          </div>
          {contactos.length === 0 ? (
            <p className="text-slate-400 text-xs py-2">Sin contactos registrados.</p>
          ) : (
            <div className="space-y-1.5">
              {contactos.map(c => (
                <div key={c.id} className="flex justify-between items-start gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-medium text-slate-900 truncate">{c.nombre}</p>
                      {c.esPrincipal && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700">Principal</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 break-words">
                      {[c.cargo, c.sector, c.email, c.telefono && (c.interno ? `${c.telefono} (Int: ${c.interno})` : c.telefono)]
                        .filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  {!readOnly && (
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>Editar</Button>
                      <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDelete(c.id)}>Eliminar</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Modal
        open={showModal}
        onClose={close}
        title={editing ? 'Editar contacto' : 'Nuevo contacto'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={close}>Cancelar</Button>
            <Button size="sm" onClick={handleSave}>{editing ? 'Guardar' : 'Agregar'}</Button>
          </div>
        }
      >
        <div className="space-y-3">
          {!editing && clienteId ? (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
              <SearchableSelect
                value={form.nombre}
                onChange={handlePickFromCliente}
                options={clienteContactos.map(c => ({ value: c.nombre, label: `${c.nombre}${c.cargo ? ` — ${c.cargo}` : ''}` }))}
                placeholder="Buscar contacto del cliente o escribir nuevo..."
                creatable
                createLabel="Nuevo contacto"
                emptyMessage="Sin contactos en el cliente — escribí uno nuevo"
              />
            </div>
          ) : (
            <Input label="Nombre *" value={form.nombre}
              onChange={e => setForm({ ...form, nombre: e.target.value })} required />
          )}
          <div className="grid grid-cols-2 gap-2">
            <Input label="Cargo" value={form.cargo ?? ''}
              onChange={e => setForm({ ...form, cargo: e.target.value })} />
            <Input label="Sector" value={form.sector ?? ''}
              onChange={e => setForm({ ...form, sector: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Input label="Teléfono" value={form.telefono ?? ''}
                onChange={e => setForm({ ...form, telefono: e.target.value })} />
            </div>
            <Input label="Int." value={form.interno ?? ''}
              onChange={e => setForm({ ...form, interno: e.target.value })} />
          </div>
          <Input label="Email" type="email" value={form.email ?? ''}
            onChange={e => setForm({ ...form, email: e.target.value })} />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.esPrincipal}
              onChange={e => setForm({ ...form, esPrincipal: e.target.checked })}
              className="w-4 h-4" />
            <span className="text-sm text-slate-700">Contacto principal</span>
          </label>
        </div>
      </Modal>
    </>
  );
}
