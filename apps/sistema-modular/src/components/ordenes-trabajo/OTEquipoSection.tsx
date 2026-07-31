import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import { OTLoanerPicker } from './OTLoanerPicker';
import type { useCreateOTForm } from '../../hooks/useCreateOTForm';

const lbl = 'block text-[11px] font-medium text-slate-500 mb-0.5';

interface Props {
  h: ReturnType<typeof useCreateOTForm>;
}

/**
 * Bloque "sobre qué se trabaja" del modal de creación de OT. Tres modos:
 * - Sistema/Módulo del cliente (default).
 * - OT sobre módulo AGS (loaner) — reemplaza el selector por la cascada de loaners.
 * - Equipo no listado / sin equipo (2026-07-31): capacitaciones (dirigidas a
 *   personas) y ventas concretadas (equipo aún sin definir) avanzan con texto
 *   libre opcional; vacío = OT sin equipo.
 */
export const OTEquipoSection: React.FC<Props> = ({ h }) => (
  <>
    {/* OT sobre módulo AGS (loaner): reemplaza el selector de equipo/sistema */}
    <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
      <input type="checkbox" checked={h.otSobreLoaner}
        onChange={e => h.setOtSobreLoaner(e.target.checked)}
        className="rounded border-slate-300" />
      OT sobre módulo AGS (loaner)
    </label>

    {h.otSobreLoaner ? (
      <OTLoanerPicker
        loanerId={h.loanerSeleccionado?.id ?? ''}
        onSelect={h.selectLoaner} />
    ) : h.equipoNoListado ? (
      <div>
        <label className={lbl}>Equipo (texto libre)</label>
        <Input value={h.form.equipoManualNombre}
          onChange={e => h.set('equipoManualNombre', e.target.value)}
          inputSize="sm" placeholder="Ej: equipo vendido, pendiente de configuración" />
        <p className="mt-1 text-[10px] text-slate-500">
          Dejalo vacío si el servicio no es sobre un equipo (ej. capacitación a un grupo de personas).
        </p>
      </div>
    ) : (
      /* Sistema + Módulo */
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Sistema / Equipo</label>
          <SearchableSelect value={h.form.sistemaId}
            onChange={v => h.set('sistemaId', v)}
            options={[
              { value: '', label: 'Sin sistema' },
              ...h.sistemasFiltrados.map(s => ({
                value: s.id,
                label: `${s.nombre}${s.codigoInternoCliente ? ` (${s.codigoInternoCliente})` : ''}`,
              })),
            ]}
            placeholder={h.form.clienteId ? 'Seleccionar...' : 'Seleccione cliente primero'} />
        </div>
        <div>
          <label className={lbl}>Modulo</label>
          <SearchableSelect value={h.form.moduloId}
            onChange={v => h.set('moduloId', v)}
            options={[
              { value: '', label: h.modulos.length === 0 ? 'Sin modulos' : 'Sistema completo' },
              ...h.modulos.map(m => ({
                value: m.id,
                label: `${m.nombre}${m.descripcion ? ` — ${m.descripcion}` : ''}${m.serie ? ` (${m.serie})` : ''}`,
              })),
            ]}
            placeholder={h.form.sistemaId ? 'Seleccionar...' : 'Seleccione sistema primero'}
            disabled={!h.form.sistemaId || h.modulos.length === 0} />
        </div>
      </div>
    )}

    {!h.otSobreLoaner && (
      <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
        <input type="checkbox" checked={h.equipoNoListado}
          onChange={e => h.setEquipoNoListado(e.target.checked)}
          className="rounded border-slate-300" />
        El equipo no está en el listado / OT sin equipo (capacitación, venta concretada, etc.)
      </label>
    )}
  </>
);
