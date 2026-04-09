import { useState, useEffect } from 'react';
import type { ContactoEstablecimiento } from '@ags/shared';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { SearchableSelect } from '../ui/SearchableSelect';
import { sectoresCatalogService, type SectorCatalog } from '../../services/catalogService';

const emptyContactoForm = {
  nombre: '',
  cargo: '',
  sector: '',
  telefono: '',
  interno: '',
  email: '',
  esPrincipal: false,
};

export type ContactoFormData = typeof emptyContactoForm;

interface ContactosSectionProps {
  contactos: ContactoEstablecimiento[];
  showModal: boolean;
  editingContacto: ContactoEstablecimiento | null;
  contactoForm: ContactoFormData;
  onOpenNew: () => void;
  onOpenEdit: (c: ContactoEstablecimiento) => void;
  onDelete: (contactoId: string) => void;
  onSave: () => void;
  onClose: () => void;
  setContactoForm: (data: ContactoFormData) => void;
  /** Sectores del establecimiento — usados como opciones en el selector de sector del contacto */
  establecimientoSectores?: string[];
}

export { emptyContactoForm };

export const ContactosSection = ({
  contactos, showModal, editingContacto, contactoForm,
  onOpenNew, onOpenEdit, onDelete, onSave, onClose, setContactoForm,
  establecimientoSectores = [],
}: ContactosSectionProps) => {
  const [sectorCatalog, setSectorCatalog] = useState<SectorCatalog[]>([]);

  useEffect(() => {
    if (showModal) {
      sectoresCatalogService.getAll().then(setSectorCatalog).catch(() => {});
    }
  }, [showModal]);

  // Merge: establecimiento sectores + catálogo global + valor actual del form
  const sectorOptions = Array.from(new Set([
    ...establecimientoSectores,
    ...sectorCatalog.map(s => s.nombre),
    ...(contactoForm.sector ? [contactoForm.sector] : []),
  ])).sort().map(name => ({ value: name, label: name }));

  return (
  <>
    <Card compact>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase">Contactos</h3>
        <Button size="sm" onClick={onOpenNew}>+ Agregar</Button>
      </div>
      {contactos.length === 0 ? (
        <p className="text-slate-400 text-xs py-3">Sin contactos registrados.</p>
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
                  {c.cargo}{c.sector ? ` · ${c.sector}` : ''} · {c.email} · {c.telefono}{c.interno ? ` (Int: ${c.interno})` : ''}
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0 ml-2">
                <Button variant="ghost" size="sm" onClick={() => onOpenEdit(c)}>Editar</Button>
                <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => onDelete(c.id)}>Eliminar</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>

    {/* Modal contacto */}
    <Modal
      open={showModal}
      onClose={onClose}
      title={editingContacto ? 'Editar contacto' : 'Nuevo contacto'}
      maxWidth="sm"
      minimizable={false}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={onSave}>{editingContacto ? 'Guardar' : 'Agregar'}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input
          inputSize="sm"
          label="Nombre *"
          value={contactoForm.nombre}
          onChange={e => setContactoForm({ ...contactoForm, nombre: e.target.value })}
          required
        />
        <Input
          inputSize="sm"
          label="Cargo"
          value={contactoForm.cargo}
          onChange={e => setContactoForm({ ...contactoForm, cargo: e.target.value })}
        />
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-0.5">Sector</label>
          <SearchableSelect
            value={contactoForm.sector}
            onChange={v => setContactoForm({ ...contactoForm, sector: v })}
            options={sectorOptions}
            placeholder="Seleccionar sector..."
            creatable
            createLabel="Crear sector"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-0.5">Telefono *</label>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Input
                inputSize="sm"
                value={contactoForm.telefono}
                onChange={e => setContactoForm({ ...contactoForm, telefono: e.target.value })}
                placeholder="Telefono"
                required
              />
            </div>
            <Input
              inputSize="sm"
              value={contactoForm.interno}
              onChange={e => setContactoForm({ ...contactoForm, interno: e.target.value })}
              placeholder="Int."
            />
          </div>
        </div>
        <Input
          inputSize="sm"
          label="Email *"
          type="email"
          value={contactoForm.email}
          onChange={e => setContactoForm({ ...contactoForm, email: e.target.value })}
          required
        />
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={contactoForm.esPrincipal}
            onChange={e => setContactoForm({ ...contactoForm, esPrincipal: e.target.checked })}
            className="w-3.5 h-3.5"
          />
          <span className="text-xs text-slate-600">Contacto principal</span>
        </label>
      </div>
    </Modal>
  </>
  );
};
