import { useState } from 'react';
import type { ContactoTicket } from '@ags/shared';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { contactosService } from '../../services/firebaseService';

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

export const ContactosTicketSection = ({ contactos, clienteId, onChange, readOnly }: Props) => {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ContactoTicket | null>(null);
  const [form, setForm] = useState<Omit<ContactoTicket, 'id'>>(emptyForm);
  const [importing, setImporting] = useState(false);

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
    // Garantiza un único principal. Si el contacto editado/agregado es principal, destacarlo.
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

  const handleImport = async () => {
    if (!clienteId) return;
    setImporting(true);
    try {
      const fromCliente = await contactosService.getByCliente(clienteId);
      const seenEmails = new Set(contactos.map(c => c.email?.toLowerCase()).filter(Boolean));
      const seenNombres = new Set(contactos.map(c => c.nombre.toLowerCase().trim()));
      const nuevos: ContactoTicket[] = fromCliente
        .filter(c => {
          const em = c.email?.toLowerCase();
          if (em && seenEmails.has(em)) return false;
          return !seenNombres.has(c.nombre.toLowerCase().trim());
        })
        .map(c => ({
          id: newId(),
          nombre: c.nombre || '(Sin nombre)',
          cargo: c.cargo || undefined,
          sector: c.sector || undefined,
          telefono: c.telefono || undefined,
          interno: c.interno || undefined,
          email: c.email || undefined,
          esPrincipal: false,
        }));
      if (nuevos.length === 0) { alert('No hay contactos nuevos para importar.'); return; }
      let next = [...contactos, ...nuevos];
      if (!next.some(c => c.esPrincipal)) next = applyPrincipal(next, next[0].id);
      onChange(next);
    } catch (err) {
      console.error('Error importando contactos:', err);
      alert('Error al importar contactos');
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <Card>
        <div className="p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-[11px] font-medium text-slate-400">Contactos</h3>
            {!readOnly && (
              <div className="flex gap-1.5">
                {clienteId && (
                  <Button size="sm" variant="outline" onClick={handleImport} disabled={importing}>
                    {importing ? 'Importando...' : 'Importar desde cliente'}
                  </Button>
                )}
                <Button size="sm" onClick={openNew}>+ Agregar</Button>
              </div>
            )}
          </div>
          {contactos.length === 0 ? (
            <p className="text-slate-400 text-xs py-2">Sin contactos registrados.</p>
          ) : (
            <div className="space-y-1.5">
              {contactos.map(c => (
                <div key={c.id} className="flex justify-between items-center px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-slate-900 truncate">{c.nombre}</p>
                      {c.esPrincipal && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700">Principal</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {[c.cargo, c.sector, c.email, c.telefono && (c.interno ? `${c.telefono} (Int: ${c.interno})` : c.telefono)]
                        .filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  {!readOnly && (
                    <div className="flex gap-1.5 shrink-0 ml-2">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>Editar</Button>
                      <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(c.id)}>Eliminar</Button>
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
        maxWidth="sm"
        minimizable={false}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={close}>Cancelar</Button>
            <Button size="sm" onClick={handleSave}>{editing ? 'Guardar' : 'Agregar'}</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input inputSize="sm" label="Nombre *" value={form.nombre}
            onChange={e => setForm({ ...form, nombre: e.target.value })} required />
          <div className="grid grid-cols-2 gap-2">
            <Input inputSize="sm" label="Cargo" value={form.cargo ?? ''}
              onChange={e => setForm({ ...form, cargo: e.target.value })} />
            <Input inputSize="sm" label="Sector" value={form.sector ?? ''}
              onChange={e => setForm({ ...form, sector: e.target.value })} />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-0.5">Teléfono</label>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Input inputSize="sm" value={form.telefono ?? ''}
                  onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="Teléfono" />
              </div>
              <Input inputSize="sm" value={form.interno ?? ''}
                onChange={e => setForm({ ...form, interno: e.target.value })} placeholder="Int." />
            </div>
          </div>
          <Input inputSize="sm" label="Email" type="email" value={form.email ?? ''}
            onChange={e => setForm({ ...form, email: e.target.value })} />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.esPrincipal}
              onChange={e => setForm({ ...form, esPrincipal: e.target.checked })}
              className="w-3.5 h-3.5" />
            <span className="text-xs text-slate-600">Contacto principal</span>
          </label>
        </div>
      </Modal>
    </>
  );
};
