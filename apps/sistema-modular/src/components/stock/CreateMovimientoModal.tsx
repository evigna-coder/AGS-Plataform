import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import { useCreateMovimientoForm, TIPO_MOV_OPTIONS, ORIGEN_DESTINO_OPTIONS } from '../../hooks/useCreateMovimientoForm';
import type { TipoOrigenDestino } from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const lbl = "block text-[11px] font-medium text-slate-500 mb-1";
const selectCls = "w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500";

export const CreateMovimientoModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const h = useCreateMovimientoForm(open, onClose, onCreated);

  const renderLocationField = (prefix: 'origen' | 'destino', tipo: TipoOrigenDestino) => {
    if (h.needsEntitySelect(tipo)) {
      const entities = h.getEntitiesForType(tipo);
      return (
        <div>
          <label className={lbl}>{prefix === 'origen' ? 'Origen' : 'Destino'}</label>
          <SearchableSelect
            value={h.form[`${prefix}Id` as 'origenId' | 'destinoId']}
            onChange={v => h.handleEntitySelect(prefix, v, tipo)}
            options={entities.map(e => ({ value: e.id, label: e.nombre }))}
            placeholder={`Seleccionar ${ORIGEN_DESTINO_OPTIONS.find(o => o.value === tipo)?.label ?? ''}...`}
          />
        </div>
      );
    }
    if (tipo === 'consumo_ot') {
      return (
        <Input inputSize="sm" label={prefix === 'origen' ? 'OT Origen' : 'OT Destino'}
          value={h.form[`${prefix}Nombre` as 'origenNombre' | 'destinoNombre']}
          onChange={e => h.set(`${prefix}Nombre`, e.target.value)}
          placeholder="Numero de OT..." />
      );
    }
    if (tipo === 'cliente') {
      return (
        <Input inputSize="sm" label="Cliente"
          value={h.form[`${prefix}Nombre` as 'origenNombre' | 'destinoNombre']}
          onChange={e => h.set(`${prefix}Nombre`, e.target.value)}
          placeholder="Nombre del cliente..." />
      );
    }
    return null;
  };

  return (
    <Modal open={open} onClose={h.handleClose} title="Registrar movimiento"
      subtitle="Registre un ingreso, egreso, transferencia o ajuste de stock"
      footer={<>
        <Button variant="outline" size="sm" onClick={h.handleClose}>Cancelar</Button>
        <Button size="sm" onClick={h.handleSave} disabled={h.saving}>
          {h.saving ? 'Guardando...' : 'Registrar'}
        </Button>
      </>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Tipo de movimiento *</label>
            <select value={h.form.tipo} onChange={e => h.set('tipo', e.target.value)} className={selectCls}>
              {TIPO_MOV_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <Input inputSize="sm" label="Cantidad *" type="number" value={String(h.form.cantidad)}
            onChange={e => h.set('cantidad', Number(e.target.value) || 0)} />
        </div>

        <div>
          <label className={lbl}>Articulo *</label>
          <SearchableSelect value={h.form.articuloId} onChange={v => { h.set('articuloId', v); h.set('unidadId', ''); }}
            options={h.articulos.map(a => ({ value: a.id, label: `${a.codigo} — ${a.descripcion}` }))}
            placeholder="Buscar articulo..." />
        </div>

        {h.form.articuloId && h.unidades.length > 0 && (
          <div>
            <label className={lbl}>Unidad (S/N o lote)</label>
            <SearchableSelect value={h.form.unidadId} onChange={v => h.set('unidadId', v)}
              options={[
                { value: '', label: 'Sin unidad especifica' },
                ...h.unidades.map(u => ({
                  value: u.id,
                  label: `${u.nroSerie || u.nroLote || 'S/N'} — ${u.estado} (${u.ubicacion.referenciaNombre})`,
                })),
              ]}
              placeholder="Seleccionar unidad..." />
          </div>
        )}

        <hr className="border-slate-100" />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Tipo origen</label>
            <select value={h.form.origenTipo} onChange={e => { h.set('origenTipo', e.target.value); h.set('origenId', ''); h.set('origenNombre', ''); }} className={selectCls}>
              {ORIGEN_DESTINO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {renderLocationField('origen', h.form.origenTipo)}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Tipo destino</label>
            <select value={h.form.destinoTipo} onChange={e => { h.set('destinoTipo', e.target.value); h.set('destinoId', ''); h.set('destinoNombre', ''); }} className={selectCls}>
              {ORIGEN_DESTINO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {renderLocationField('destino', h.form.destinoTipo)}
        </div>

        <hr className="border-slate-100" />

        <div className="grid grid-cols-2 gap-3">
          <Input inputSize="sm" label="Creado por *" value={h.form.creadoPor}
            onChange={e => h.set('creadoPor', e.target.value)} placeholder="Nombre del operador..." />
          <Input inputSize="sm" label="Motivo" value={h.form.motivo}
            onChange={e => h.set('motivo', e.target.value)} placeholder="Motivo del movimiento..." />
        </div>
      </div>
    </Modal>
  );
};
