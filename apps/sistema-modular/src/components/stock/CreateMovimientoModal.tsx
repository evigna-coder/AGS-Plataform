import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import { useCreateMovimientoForm, TIPO_MOV_OPTIONS, type InitOpts } from '../../hooks/useCreateMovimientoForm';
import { useAuth } from '../../contexts/AuthContext';
import type { TipoOrigenDestino } from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  init?: InitOpts;
  /** Override del título cuando se abre desde un contexto específico (ej: "Reponer artículo al minikit"). */
  title?: string;
  subtitle?: string;
  /** Si se provee, elegir "Ingreso" en el selector redirige al modal de Cargar stock (que crea las unidades). */
  onRequestIngreso?: () => void;
}

const lbl = "block text-[11px] font-medium text-slate-500 mb-1";
const selectCls = "w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-slate-50 disabled:text-slate-500";

const TIPO_ICON: Record<TipoOrigenDestino, string> = {
  posicion: '📦', minikit: '🧰', ingeniero: '👷', proveedor: '🏭', cliente: '👤',
  consumo_ot: '🔧', baja: '🗑️', ajuste: '⚖️',
};

export const CreateMovimientoModal: React.FC<Props> = ({ open, onClose, onCreated, init = {}, title, subtitle, onRequestIngreso }) => {
  const { usuario, firebaseUser } = useAuth();
  const creadoPor = usuario?.displayName ?? usuario?.email ?? firebaseUser?.email ?? 'Admin';
  const h = useCreateMovimientoForm(open, onClose, onCreated, init, creadoPor);

  const articuloLockeado = !!init.lockArticulo;
  const tipoLockeado = !!init.lockTipo;
  const destinoLockeado = !!init.lockDestino;

  const articuloElegido = h.articulos.find(a => a.id === h.form.articuloId);

  const renderOrigenField = () => {
    if (h.slot.origen === 'ubicacion_con_stock' || h.slot.origen === 'proveedor') {
      const opts = h.origenOptions.map(o => ({
        value: o.key,
        label: `${TIPO_ICON[o.tipo]} ${o.nombre}${o.count > 0 ? ` — ${o.count} unidad${o.count !== 1 ? 'es' : ''}` : ''}`,
      }));
      return (
        <SearchableSelect
          value={h.form.origenKey}
          onChange={v => { h.set('origenKey', v); h.set('origenUnidadIds', []); }}
          options={opts}
          placeholder={
            !h.form.articuloId ? 'Primero seleccioná el artículo'
            : opts.length === 0
              ? (h.slot.origen === 'ubicacion_con_stock' ? 'Sin stock disponible' : 'Sin proveedores cargados')
              : 'Seleccionar origen...'
          }
        />
      );
    }
    return (
      <Input inputSize="sm" value={h.form.origenLibre}
        onChange={e => h.set('origenLibre', e.target.value)}
        placeholder={(h.slot.origenLibreLabel ?? 'Origen') + '...'} />
    );
  };

  const renderDestinoField = () => {
    if (destinoLockeado && init.lockDestino) {
      return (
        <div className="text-xs bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5">
          <span className="text-slate-400">{TIPO_ICON[init.lockDestino.tipo]} </span>
          <span className="text-slate-700 font-medium">{init.lockDestino.nombre}</span>
        </div>
      );
    }
    if (h.slot.destino === 'ubicacion_interna') {
      const opts = h.destinoOptions.map(o => ({
        value: o.key,
        label: o.historica ? `${TIPO_ICON[o.tipo]} ${o.nombre} · sugerido (sin stock actual)` : `${TIPO_ICON[o.tipo]} ${o.nombre}`,
      }));
      // Re-ordenar: primero las normales, después las "sugeridas" (históricas).
      opts.sort((a, b) => Number(a.label.includes('sugerido')) - Number(b.label.includes('sugerido')));
      return (
        <SearchableSelect
          value={h.form.destinoKey}
          onChange={v => h.set('destinoKey', v)}
          options={opts}
          placeholder="Seleccionar destino..."
        />
      );
    }
    return (
      <Input inputSize="sm" value={h.form.destinoLibre}
        onChange={e => h.set('destinoLibre', e.target.value)}
        placeholder={(h.slot.destinoLibreLabel ?? 'Destino') + '...'} />
    );
  };

  return (
    <Modal open={open} onClose={h.handleClose}
      title={title ?? 'Registrar movimiento'}
      subtitle={subtitle ?? 'Movimiento de stock entre ubicaciones'}
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
            <select value={h.form.tipo}
              onChange={e => {
                const v = e.target.value as typeof h.form.tipo;
                if (v === 'ingreso' && onRequestIngreso) { onRequestIngreso(); return; }
                h.set('tipo', v);
              }}
              disabled={tipoLockeado}
              className={selectCls}>
              {TIPO_MOV_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <Input inputSize="sm" label="Cantidad *" type="number"
            value={String(h.form.cantidad)}
            onChange={e => h.set('cantidad', Number(e.target.value) || 0)}
            disabled={h.form.origenUnidadIds.length > 0} />
        </div>

        <div>
          <label className={lbl}>Artículo *</label>
          {articuloLockeado && articuloElegido ? (
            <div className="text-xs bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5">
              <span className="font-mono text-teal-600 font-semibold">{articuloElegido.codigo}</span>
              <span className="text-slate-700 ml-1.5">{articuloElegido.descripcion}</span>
            </div>
          ) : (
            <SearchableSelect value={h.form.articuloId}
              onChange={v => { h.set('articuloId', v); h.set('origenKey', ''); h.set('origenUnidadIds', []); }}
              options={h.articulos.map(a => ({ value: a.id, label: `${a.codigo} — ${a.descripcion}` }))}
              placeholder="Buscar artículo..." />
          )}
        </div>

        <hr className="border-slate-100" />

        <div>
          <label className={lbl}>Origen *</label>
          {renderOrigenField()}
        </div>

        {/* Selector de unidades (solo cuando origen es ubicación con stock y hay alguna seleccionada) */}
        {h.slot.origen === 'ubicacion_con_stock' && h.form.origenKey && h.unidadesEnOrigen.length > 0 && (
          <div>
            <label className={lbl}>
              Unidades a mover ({h.form.origenUnidadIds.length} de {h.unidadesEnOrigen.length} seleccionadas)
              <span className="ml-2 text-slate-400 text-[10px]">— opcional, si no seleccionás se mueve "cualquier" {h.form.cantidad}</span>
            </label>
            <div className="border border-slate-200 rounded max-h-48 overflow-y-auto bg-white">
              {h.unidadesEnOrigen.map(u => {
                const checked = h.form.origenUnidadIds.includes(u.id);
                return (
                  <label key={u.id} className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-slate-50 border-b border-slate-50 last:border-0 ${checked ? 'bg-teal-50/60' : ''}`}>
                    <input type="checkbox" checked={checked}
                      onChange={() => {
                        const next = checked
                          ? h.form.origenUnidadIds.filter(id => id !== u.id)
                          : [...h.form.origenUnidadIds, u.id];
                        h.set('origenUnidadIds', next);
                        if (next.length > 0) h.set('cantidad', next.length);
                      }}
                      className="w-3.5 h-3.5 accent-teal-600" />
                    <span className="font-mono text-slate-700 flex-1">
                      {u.nroSerie ? `S/N: ${u.nroSerie}` : u.nroLote ? `Lote: ${u.nroLote}` : '(sin S/N ni lote)'}
                    </span>
                    <span className="text-[10px] text-slate-400 capitalize">{u.condicion.replace('_', ' ')}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <label className={lbl}>Destino *</label>
          {renderDestinoField()}
        </div>

        <hr className="border-slate-100" />

        <Input inputSize="sm" label="Observación"
          value={h.form.observaciones}
          onChange={e => h.set('observaciones', e.target.value)}
          placeholder="Detalles, motivo, referencia... (opcional)" />

        <p className="text-[10px] text-slate-400">
          Registrado por <span className="font-medium text-slate-500">{creadoPor}</span>
        </p>
      </div>
    </Modal>
  );
};
