import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import type { Cliente, Sistema, TipoServicio, ContactoCliente, ModuloSistema, Ingeniero } from '@ags/shared';
import type { EditOTFormState } from '../../hooks/useEditOTForm';

const lbl = 'block text-[11px] font-medium text-slate-500 mb-0.5';
const selectClass = 'w-full border border-slate-300 rounded-lg px-2 py-1 text-xs focus:ring-1 focus:ring-teal-400 focus:border-teal-400';

interface Props {
  form: EditOTFormState;
  set: (key: string, value: any) => void;
  readOnly: boolean;
  tiposServicio: TipoServicio[];
  clientes: Cliente[];
  sistemasFiltrados: Sistema[];
  modulos: ModuloSistema[];
  contactos: ContactoCliente[];
  ingenieros: Ingeniero[];
}

export const EditOTFormFields: React.FC<Props> = ({
  form, set, readOnly, tiposServicio, clientes, sistemasFiltrados, modulos, contactos, ingenieros,
}) => (
  <>
    {/* Tipo de Servicio */}
    <div>
      <label className={lbl}>Tipo de servicio *</label>
      <SearchableSelect value={form.tipoServicio}
        onChange={v => set('tipoServicio', v)}
        options={tiposServicio.map(t => ({ value: t.nombre, label: t.nombre }))}
        placeholder="Seleccionar tipo..." disabled={readOnly} />
    </div>

    {/* Cliente */}
    <div>
      <label className={lbl}>Cliente *</label>
      <SearchableSelect value={form.clienteId}
        onChange={v => { set('clienteId', v); set('sistemaId', ''); set('moduloId', ''); set('contactoId', ''); }}
        options={clientes.map(c => ({ value: c.id, label: c.razonSocial }))}
        placeholder="Seleccionar cliente..." disabled={readOnly} />
    </div>

    {/* Sistema + Módulo */}
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className={lbl}>Sistema / Equipo</label>
        <SearchableSelect value={form.sistemaId}
          onChange={v => { set('sistemaId', v); set('moduloId', ''); }}
          options={[
            { value: '', label: 'Sin sistema' },
            ...sistemasFiltrados.map(s => ({
              value: s.id,
              label: `${s.nombre}${s.codigoInternoCliente ? ` (${s.codigoInternoCliente})` : ''}`,
            })),
          ]}
          placeholder={form.clienteId ? 'Seleccionar...' : 'Seleccione cliente primero'}
          disabled={readOnly} />
      </div>
      <div>
        <label className={lbl}>Módulo</label>
        <select value={form.moduloId} onChange={e => set('moduloId', e.target.value)}
          className={selectClass} disabled={readOnly || !form.sistemaId || modulos.length === 0}>
          <option value="">{modulos.length === 0 ? 'Sin módulos' : 'Sistema completo'}</option>
          {modulos.map(m => (
            <option key={m.id} value={m.id}>{m.nombre}{m.serie ? ` (${m.serie})` : ''}</option>
          ))}
        </select>
      </div>
    </div>

    {/* Contacto + Ingeniero */}
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className={lbl}>Contacto</label>
        <select value={form.contactoId} onChange={e => set('contactoId', e.target.value)}
          className={selectClass} disabled={readOnly || contactos.length === 0}>
          <option value="">Sin contacto</option>
          {contactos.map(c => (
            <option key={c.id} value={c.id}>{c.nombre}{c.cargo ? ` — ${c.cargo}` : ''}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={`${lbl}${form.estadoAdmin !== 'CREADA' && !form.ingenieroId ? ' text-amber-600' : ''}`}>
          Ingeniero asignado{form.estadoAdmin !== 'CREADA' ? ' *' : ''}
        </label>
        <select value={form.ingenieroId} onChange={e => {
            set('ingenieroId', e.target.value);
            if (e.target.value && form.estadoAdmin === 'CREADA') set('estadoAdmin', 'ASIGNADA');
          }}
          className={`${selectClass}${form.estadoAdmin !== 'CREADA' && !form.ingenieroId ? ' ring-1 ring-amber-400 border-amber-400' : ''}`} disabled={readOnly}>
          <option value="">Sin asignar</option>
          {ingenieros.map(u => (
            <option key={u.id} value={u.usuarioId || u.id}>{u.nombre}</option>
          ))}
        </select>
      </div>
    </div>

    {/* Presupuesto + OC + Fecha servicio */}
    <div className="grid grid-cols-3 gap-3">
      <div>
        <div className="flex items-center justify-between mb-0.5">
          <label className="text-[11px] font-medium text-slate-500">Presupuesto</label>
          {!readOnly && form.presupuestos.length < 5 && (
            <button onClick={() => set('presupuestos', [...form.presupuestos, ''])}
              className="text-[10px] text-teal-600 hover:underline">+</button>
          )}
        </div>
        {form.presupuestos.map((b, idx) => (
          <div key={idx} className="flex gap-1 mb-1">
            <Input value={b}
              onChange={e => {
                const u = [...form.presupuestos];
                u[idx] = e.target.value.substring(0, 15);
                set('presupuestos', u);
              }}
              inputSize="sm" placeholder="PRE-XXXX" disabled={readOnly} />
            {!readOnly && form.presupuestos.length > 1 && (
              <button onClick={() => set('presupuestos', form.presupuestos.filter((_, i) => i !== idx))}
                className="text-red-400 hover:text-red-600 text-xs px-1">x</button>
            )}
          </div>
        ))}
      </div>
      <div>
        <label className={lbl}>Orden de compra</label>
        <Input value={form.ordenCompra} onChange={e => set('ordenCompra', e.target.value)}
          inputSize="sm" placeholder="OC cliente" disabled={readOnly} />
      </div>
      <div>
        <label className={lbl}>Fecha aprox. servicio</label>
        <input type="date" value={form.fechaServicioAprox}
          onChange={e => set('fechaServicioAprox', e.target.value)}
          className={selectClass} disabled={readOnly} />
      </div>
    </div>

    {/* Falla inicial */}
    <div>
      <label className={lbl}>Problema / Falla inicial</label>
      <textarea value={form.problemaFallaInicial}
        onChange={e => set('problemaFallaInicial', e.target.value)}
        rows={2} placeholder="Descripción del problema o motivo de la OT..."
        disabled={readOnly}
        className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs resize-none focus:ring-1 focus:ring-teal-400 focus:border-teal-400 disabled:bg-slate-100 disabled:text-slate-400" />
    </div>
  </>
);
