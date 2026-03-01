import { Link } from 'react-router-dom';
import type { Cliente, Sistema, TipoServicio, ModuloSistema, ContactoCliente } from '@ags/shared';
import { Card } from '../ui/Card';
import { SearchableSelect } from '../ui/SearchableSelect';

const lbl = 'text-[11px] font-medium text-slate-400 mb-0.5 block';
const sec = 'text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3';
const inp = 'w-full border rounded-lg px-2.5 py-1 text-xs bg-white border-slate-300 disabled:bg-slate-100 disabled:text-slate-400';

export interface OTInfoSidebarProps {
  readOnly: boolean;
  clienteId?: string; clientes: Cliente[]; cliente: Cliente | null;
  contacto: string; contactos: ContactoCliente[];
  emailPrincipal: string; direccion: string; localidad: string; provincia: string;
  onClienteChange: (id: string) => void;
  onContactoChange: (id: string) => void;
  onFieldChange: (field: string, value: string) => void;
  sistemaId?: string; sistemasFiltrados: Sistema[]; sistema: Sistema | null;
  codigoInternoCliente: string;
  moduloId?: string; modulosFiltrados: ModuloSistema[]; modulo: ModuloSistema | null;
  moduloModelo: string; moduloDescripcion: string; moduloSerie: string;
  onSistemaChange: (id: string) => void;
  onModuloChange: (id: string) => void;
  tipoServicio: string; tiposServicio: TipoServicio[];
  fechaInicio: string; fechaFin: string;
  horasTrabajadas: string; tiempoViaje: string;
  esFacturable: boolean; tieneContrato: boolean; esGarantia: boolean;
  onCheckboxChange: (field: string, checked: boolean) => void;
  budgets: string[];
  onAddBudget: () => void;
  onUpdateBudget: (idx: number, val: string) => void;
  onRemoveBudget: (idx: number) => void;
}

export const OTInfoSidebar: React.FC<OTInfoSidebarProps> = ({
  readOnly, clienteId, clientes, cliente, contacto, contactos,
  emailPrincipal, direccion, localidad, provincia,
  onClienteChange, onContactoChange, onFieldChange,
  sistemaId, sistemasFiltrados, sistema, codigoInternoCliente,
  moduloId, modulosFiltrados, modulo, moduloModelo, moduloDescripcion, moduloSerie,
  onSistemaChange, onModuloChange,
  tipoServicio, tiposServicio, fechaInicio, fechaFin,
  horasTrabajadas, tiempoViaje, esFacturable, tieneContrato, esGarantia,
  onCheckboxChange, budgets, onAddBudget, onUpdateBudget, onRemoveBudget,
}) => {
  const totalHs = (Number(horasTrabajadas) || 0) + (Number(tiempoViaje) || 0);
  const F = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => onFieldChange(field, e.target.value);

  return (
    <div className="w-72 shrink-0 space-y-4">
      {/* Client */}
      <Card compact>
        <p className={sec}>Cliente</p>
        <div className="space-y-2">
          <div>
            <span className={lbl}>Razon Social</span>
            <SearchableSelect value={clienteId || ''} onChange={onClienteChange} options={clientes.map(c => ({ value: c.id, label: c.razonSocial }))} placeholder="Seleccionar..." disabled={readOnly} />
          </div>
          <div>
            <span className={lbl}>Contacto</span>
            <SearchableSelect value={contactos.find(c => c.nombre === contacto)?.id || ''} onChange={onContactoChange} options={[{ value: '', label: 'Sin contacto' }, ...contactos.map(c => ({ value: c.id, label: `${c.nombre}${c.cargo ? ` - ${c.cargo}` : ''}` }))]} placeholder="Seleccionar..." disabled={readOnly || !clienteId} />
          </div>
          <div>
            <span className={lbl}>Email</span>
            <input type="email" value={emailPrincipal} onChange={F('emailPrincipal')} disabled={readOnly} placeholder="correo@ejemplo.com" className={inp} />
          </div>
          <div>
            <span className={lbl}>Direccion</span>
            <input type="text" value={direccion} onChange={F('direccion')} disabled={readOnly} className={inp} />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <span className={lbl}>Localidad</span>
              <input type="text" value={localidad} onChange={F('localidad')} disabled={readOnly} className={inp} />
            </div>
            <div>
              <span className={lbl}>Provincia</span>
              <input type="text" value={provincia} onChange={F('provincia')} disabled={readOnly} className={inp} />
            </div>
          </div>
          {cliente && <Link to={`/clientes/${cliente.id}`} className="text-[11px] text-indigo-600 hover:underline">Ver cliente completo</Link>}
        </div>
      </Card>

      {/* System & Module */}
      <Card compact>
        <p className={sec}>Sistema / Modulo</p>
        <div className="space-y-2">
          <div>
            <span className={lbl}>Sistema</span>
            <SearchableSelect value={sistemaId || ''} onChange={onSistemaChange} options={sistemasFiltrados.map(s => ({ value: s.id, label: `${s.nombre} (${s.codigoInternoCliente})` }))} placeholder="Seleccionar..." disabled={readOnly || !clienteId} />
          </div>
          <div>
            <span className={lbl}>Codigo Interno</span>
            <input type="text" value={codigoInternoCliente} onChange={F('codigoInternoCliente')} disabled={readOnly} className={`${inp} font-mono`} />
          </div>
          {sistema?.software && <div><span className={lbl}>Software</span><p className="text-xs text-slate-700">{sistema.software}</p></div>}
          <div>
            <span className={lbl}>Modulo</span>
            <SearchableSelect value={moduloId || ''} onChange={onModuloChange} options={[{ value: '', label: 'Sin modulo' }, ...modulosFiltrados.map(m => ({ value: m.id, label: `${m.nombre || 'Sin nombre'}${m.serie ? ` - S/N: ${m.serie}` : ''}` }))]} placeholder="Seleccionar..." disabled={readOnly || !sistemaId} />
          </div>
          {moduloId && (
            <>
              <div><span className={lbl}>Modelo</span><input type="text" value={moduloModelo} onChange={F('moduloModelo')} disabled={readOnly} className={inp} /></div>
              <div><span className={lbl}>Descripcion</span><input type="text" value={moduloDescripcion} onChange={F('moduloDescripcion')} disabled={readOnly} className={inp} /></div>
              <div><span className={lbl}>Serie</span><input type="text" value={moduloSerie} onChange={F('moduloSerie')} disabled={readOnly} className={`${inp} font-mono`} /></div>
            </>
          )}
          {modulo?.firmware && <div><span className={lbl}>Firmware</span><p className="text-xs text-slate-700 font-mono">{modulo.firmware}</p></div>}
          {sistema && <Link to={`/equipos/${sistema.id}`} className="text-[11px] text-indigo-600 hover:underline">Ver sistema completo</Link>}
        </div>
      </Card>

      {/* Service info */}
      <Card compact>
        <p className={sec}>Servicio</p>
        <div className="space-y-2">
          <div>
            <span className={lbl}>Tipo de servicio</span>
            <SearchableSelect value={tipoServicio} onChange={v => onFieldChange('tipoServicio', v)} options={tiposServicio.map(t => ({ value: t.nombre, label: t.nombre }))} placeholder="Seleccionar..." disabled={readOnly} />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div><span className={lbl}>Inicio</span><input type="date" value={fechaInicio} onChange={F('fechaInicio')} disabled={readOnly} className={inp} /></div>
            <div><span className={lbl}>Fin</span><input type="date" value={fechaFin} onChange={F('fechaFin')} disabled={readOnly} className={inp} /></div>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <div><span className={lbl}>Hs Lab</span><input type="text" value={horasTrabajadas} onChange={F('horasTrabajadas')} disabled={readOnly} placeholder="0.0" className={inp} /></div>
            <div><span className={lbl}>Hs Trasl</span><input type="text" value={tiempoViaje} onChange={F('tiempoViaje')} disabled={readOnly} placeholder="0.0" className={inp} /></div>
            <div><span className={lbl}>Total</span><p className="text-xs font-semibold text-slate-800 py-1">{totalHs.toFixed(1)}h</p></div>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
            {[['esFacturable', esFacturable, 'Facturable'], ['tieneContrato', tieneContrato, 'Contrato'], ['esGarantia', esGarantia, 'Garantia']] .map(([field, checked, text]) => (
              <label key={field as string} className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={checked as boolean} onChange={e => onCheckboxChange(field as string, e.target.checked)} disabled={readOnly} className="w-3.5 h-3.5" />
                <span className="text-[11px] text-slate-600">{text as string}</span>
              </label>
            ))}
          </div>
        </div>
      </Card>

      {/* Budgets */}
      <Card compact>
        <div className="flex justify-between items-center mb-2">
          <p className={`${sec} !mb-0`}>Presupuestos</p>
          {!readOnly && <button onClick={onAddBudget} className="text-[11px] font-medium text-indigo-600 hover:underline">+ Agregar</button>}
        </div>
        <div className="space-y-1.5">
          {budgets.map((b, idx) => (
            <div key={idx} className="flex gap-1">
              <input value={b} maxLength={15} disabled={readOnly} onChange={e => onUpdateBudget(idx, e.target.value)} placeholder="PRE-0000" className={`${inp} font-mono`} />
              {!readOnly && budgets.length > 1 && <button onClick={() => onRemoveBudget(idx)} className="text-red-400 hover:text-red-600 text-xs px-1">x</button>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
