import React from 'react';
import type { TipoEquipoComponente, TipoEquipoServicio, TipoServicioPlantilla } from '@ags/shared';
import { TIPO_SERVICIO_PLANTILLA_LABELS } from '@ags/shared';

const th = 'px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-500 text-left';
const td = 'px-2 py-1';
const input = 'w-full border border-slate-200 rounded px-1.5 py-1 text-xs focus:ring-1 focus:ring-teal-400 focus:border-teal-400';

// ---------- Componentes (S/L) editor ----------
export const ComponentesEditor: React.FC<{
  componentes: TipoEquipoComponente[];
  onChange: (c: TipoEquipoComponente[]) => void;
}> = ({ componentes, onChange }) => {
  const update = (id: string, field: keyof TipoEquipoComponente, value: any) => {
    onChange(componentes.map(c => c.id === id ? { ...c, [field]: value } : c));
  };
  const add = () => {
    const nextOrden = componentes.length > 0 ? Math.max(...componentes.map(c => c.orden)) + 1 : 2;
    onChange([...componentes, { id: crypto.randomUUID(), orden: nextOrden, codigo: '', descripcion: '', servicioCode: '' }]);
  };
  const remove = (id: string) => onChange(componentes.filter(c => c.id !== id));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
          Componentes S/L <span className="text-slate-400 font-normal">(trazabilidad, sin cargo)</span>
        </h4>
        <button type="button" onClick={add} className="text-[11px] text-teal-700 hover:text-teal-900 font-medium">+ Agregar componente</button>
      </div>
      {componentes.length === 0 ? (
        <p className="text-[11px] text-slate-400 italic px-2">Sin componentes. Los sistemas suelen incluir módulos hijos que se listan con CANT = S/L.</p>
      ) : (
        <table className="w-full border border-slate-200 rounded overflow-hidden">
          <thead className="bg-slate-50">
            <tr>
              <th className={`${th} w-14`}>Orden</th>
              <th className={`${th} w-28`}>Código</th>
              <th className={th}>Descripción</th>
              <th className={`${th} w-32`}>Cód. Servicio</th>
              <th className={`${th} w-8`}></th>
            </tr>
          </thead>
          <tbody>
            {componentes.map(c => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className={td}><input type="number" className={input} value={c.orden} onChange={e => update(c.id, 'orden', parseInt(e.target.value) || 0)} /></td>
                <td className={td}><input className={input} value={c.codigo} onChange={e => update(c.id, 'codigo', e.target.value)} placeholder="G1322A" /></td>
                <td className={td}><input className={input} value={c.descripcion} onChange={e => update(c.id, 'descripcion', e.target.value)} placeholder="Desgasificador Estándar - HPLC 1100" /></td>
                <td className={td}><input className={input} value={c.servicioCode || ''} onChange={e => update(c.id, 'servicioCode', e.target.value || null)} placeholder="AT1_DEG_11A" /></td>
                <td className={td}>
                  <button type="button" onClick={() => remove(c.id)} className="text-red-500 hover:text-red-700 text-xs">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

// ---------- Servicios editor ----------
export const ServiciosEditor: React.FC<{
  servicios: TipoEquipoServicio[];
  onChange: (s: TipoEquipoServicio[]) => void;
}> = ({ servicios, onChange }) => {
  const update = (id: string, field: keyof TipoEquipoServicio, value: any) => {
    onChange(servicios.map(s => s.id === id ? { ...s, [field]: value } : s));
  };
  const add = () => {
    const nextOrden = servicios.length > 0 ? Math.max(...servicios.map(s => s.orden)) + 1 : 10;
    onChange([...servicios, { id: crypto.randomUUID(), orden: nextOrden, servicioCode: '', descripcion: '', cantidadDefault: 1, tipo: 'mantenimiento', precioDefault: null }]);
  };
  const remove = (id: string) => onChange(servicios.filter(s => s.id !== id));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
          Servicios <span className="text-slate-400 font-normal">(con precio, sugerencia al cotizar)</span>
        </h4>
        <button type="button" onClick={add} className="text-[11px] text-teal-700 hover:text-teal-900 font-medium">+ Agregar servicio</button>
      </div>
      {servicios.length === 0 ? (
        <p className="text-[11px] text-slate-400 italic px-2">Sin servicios. Agregue mantenimientos, regulatorios o consumibles estándar para este tipo.</p>
      ) : (
        <table className="w-full border border-slate-200 rounded overflow-hidden">
          <thead className="bg-slate-50">
            <tr>
              <th className={`${th} w-14`}>Orden</th>
              <th className={`${th} w-32`}>Cód. Servicio</th>
              <th className={th}>Descripción</th>
              <th className={`${th} w-16`}>Cant.</th>
              <th className={`${th} w-32`}>Tipo</th>
              {/* Tilde si este servicio dispara la generación de un PDF anexo de consumibles al cotizar */}
              <th className={`${th} w-16 text-center`} title="Servicios con anexo de consumibles disparan la generación de PDF anexo al cotizar">Anexo</th>
              <th className={`${th} w-24`}>Precio def.</th>
              <th className={`${th} w-8`}></th>
            </tr>
          </thead>
          <tbody>
            {servicios.map(s => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className={td}><input type="number" className={input} value={s.orden} onChange={e => update(s.id, 'orden', parseInt(e.target.value) || 0)} /></td>
                <td className={td}><input className={input} value={s.servicioCode} onChange={e => update(s.id, 'servicioCode', e.target.value)} placeholder="MP1_CN_11B" /></td>
                <td className={td}><input className={input} value={s.descripcion} onChange={e => update(s.id, 'descripcion', e.target.value)} placeholder="Mantenimiento Preventivo - HPLC 1100 Con ALS" /></td>
                <td className={td}><input type="number" className={input} value={s.cantidadDefault} onChange={e => update(s.id, 'cantidadDefault', parseInt(e.target.value) || 0)} /></td>
                <td className={td}>
                  <select className={input} value={s.tipo} onChange={e => update(s.id, 'tipo', e.target.value as TipoServicioPlantilla)}>
                    {Object.entries(TIPO_SERVICIO_PLANTILLA_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </td>
                <td className={`${td} text-center`}>
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 text-teal-700 rounded border-slate-300 focus:ring-1 focus:ring-teal-400"
                    checked={s.requiereAnexoConsumibles ?? false}
                    onChange={e => update(s.id, 'requiereAnexoConsumibles', e.target.checked)}
                  />
                </td>
                <td className={td}><input type="number" step="0.01" className={input} value={s.precioDefault ?? ''} onChange={e => update(s.id, 'precioDefault', e.target.value ? parseFloat(e.target.value) : null)} placeholder="—" /></td>
                <td className={td}>
                  <button type="button" onClick={() => remove(s.id)} className="text-red-500 hover:text-red-700 text-xs">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
