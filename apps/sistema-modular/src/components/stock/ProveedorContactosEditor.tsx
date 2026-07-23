import type { ContactoProveedor } from '@ags/shared';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

interface Props {
  contactos: ContactoProveedor[];
  onChange: (contactos: ContactoProveedor[]) => void;
}

/** Fila vacía lista para editar (id ya asignado). */
export const emptyContacto = (): ContactoProveedor => ({
  id: crypto.randomUUID(), nombre: '', email: '', telefono: '', rol: '',
});

/**
 * Normaliza los contactos para persistir: descarta filas sin nombre ni email,
 * recorta strings y usa `null` en vacíos (nunca `undefined` → Firestore-safe).
 */
export function normalizeContactos(contactos: ContactoProveedor[]): ContactoProveedor[] {
  return contactos
    .filter(c => (c.nombre?.trim() || c.email?.trim()))
    .map(c => ({
      id: c.id || crypto.randomUUID(),
      nombre: c.nombre?.trim() || null,
      email: c.email?.trim() || null,
      telefono: c.telefono?.trim() || null,
      rol: c.rol?.trim() || null,
    }));
}

/**
 * Editor de contactos adicionales de un proveedor. Filas repetibles
 * (nombre / email / teléfono / rol). Reutilizado por el alta y la edición.
 */
export const ProveedorContactosEditor: React.FC<Props> = ({ contactos, onChange }) => {
  const update = (id: string, key: keyof ContactoProveedor, value: string) =>
    onChange(contactos.map(c => (c.id === id ? { ...c, [key]: value } : c)));

  const remove = (id: string) => onChange(contactos.filter(c => c.id !== id));

  const add = () => onChange([...contactos, emptyContacto()]);

  return (
    <div className="space-y-2">
      {contactos.length === 0 && (
        <p className="text-[11px] text-slate-400">Sin contactos adicionales.</p>
      )}
      {contactos.map(c => (
        <div key={c.id} className="grid grid-cols-12 gap-2 items-end border border-slate-200 rounded-lg p-2">
          <div className="col-span-3">
            <Input inputSize="sm" label="Nombre" value={c.nombre ?? ''} onChange={e => update(c.id, 'nombre', e.target.value)} placeholder="Nombre" />
          </div>
          <div className="col-span-4">
            <Input inputSize="sm" label="Email" value={c.email ?? ''} onChange={e => update(c.id, 'email', e.target.value)} placeholder="email@proveedor.com" />
          </div>
          <div className="col-span-2">
            <Input inputSize="sm" label="Telefono" value={c.telefono ?? ''} onChange={e => update(c.id, 'telefono', e.target.value)} placeholder="+54 ..." />
          </div>
          <div className="col-span-2">
            <Input inputSize="sm" label="Rol" value={c.rol ?? ''} onChange={e => update(c.id, 'rol', e.target.value)} placeholder="Ventas..." />
          </div>
          <div className="col-span-1 flex justify-end">
            <button type="button" onClick={() => remove(c.id)}
              className="text-slate-400 hover:text-red-600 text-xs px-1.5 py-1.5" title="Quitar contacto">
              ✕
            </button>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add}>+ Agregar contacto</Button>
    </div>
  );
};
