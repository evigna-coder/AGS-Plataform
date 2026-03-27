import { SearchableSelect } from '../ui/SearchableSelect';
import type { Cliente, Establecimiento, Sistema, ContactoEstablecimiento } from '@ags/shared';
import type { PresupuestoFormState } from '../../hooks/useCreatePresupuestoForm';

const lbl = "block text-[10px] font-mono font-medium text-slate-500 mb-1 uppercase tracking-wide";

interface Props {
  form: PresupuestoFormState;
  setForm: React.Dispatch<React.SetStateAction<PresupuestoFormState>>;
  clientes: Cliente[];
  establecimientos: Establecimiento[];
  sistemasFiltrados: Sistema[];
  contactos: ContactoEstablecimiento[];
}

export const PresupuestoFormCliente: React.FC<Props> = ({
  form, setForm, clientes, establecimientos, sistemasFiltrados, contactos,
}) => (
  <>
    <div className="grid grid-cols-4 gap-2.5">
      <div>
        <label className={lbl}>Cliente *</label>
        <SearchableSelect value={form.clienteId} onChange={v => setForm(prev => ({ ...prev, clienteId: v, establecimientoId: '', sistemaId: '', contactoId: '' }))}
          options={clientes.map(c => ({ value: c.id, label: c.razonSocial }))} placeholder="Seleccionar cliente..." />
      </div>
      {form.clienteId && establecimientos.length > 0 && (
        <div>
          <label className={lbl}>Establecimiento</label>
          <SearchableSelect value={form.establecimientoId} onChange={v => setForm(prev => ({ ...prev, establecimientoId: v, sistemaId: '', contactoId: '' }))}
            options={[{ value: '', label: 'Sin establecimiento' }, ...establecimientos.map(e => ({ value: e.id, label: `${e.nombre}${e.localidad ? ` — ${e.localidad}` : ''}` }))]}
            placeholder="Seleccionar..." />
        </div>
      )}
      {form.clienteId && (
        <>
          <div>
            <label className={lbl}>Sistema/Equipo</label>
            <SearchableSelect value={form.sistemaId} onChange={v => setForm(prev => ({ ...prev, sistemaId: v }))}
              options={[
                { value: '', label: 'Sin sistema' },
                ...(form.tipo === 'contrato' && sistemasFiltrados.length > 0 ? [{ value: '__ALL_SISTEMAS__', label: 'Todos los sistemas/equipos' }] : []),
                ...sistemasFiltrados.map(s => ({ value: s.id, label: `${s.nombre}${s.codigoInternoCliente ? ` (${s.codigoInternoCliente})` : ''}` })),
              ]}
              placeholder="Seleccionar..." />
          </div>
          <div>
            <label className={lbl}>Contacto</label>
            <SearchableSelect value={form.contactoId} onChange={v => setForm(prev => ({ ...prev, contactoId: v }))}
              options={[
                { value: '', label: 'Sin contacto' },
                ...contactos.map(c => ({ value: c.id, label: `${c.nombre}${c.cargo ? ` — ${c.cargo}` : ''}` })),
              ]}
              placeholder="Seleccionar contacto..." />
          </div>
        </>
      )}
    </div>
    {form.sistemaId === '__ALL_SISTEMAS__' && sistemasFiltrados.length > 0 && (
      <p className="text-[11px] text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded-lg">
        Al crear, los items se replicaran para cada uno de los {sistemasFiltrados.length} sistemas/equipos, detallando sus modulos.
      </p>
    )}
  </>
);
