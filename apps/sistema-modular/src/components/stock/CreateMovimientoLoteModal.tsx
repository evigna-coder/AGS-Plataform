import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import { useMovimientoLoteForm, TIPO_LOTE_OPTIONS, type TipoLote } from '../../hooks/useMovimientoLoteForm';
import { MovimientoLoteLineas } from './MovimientoLoteLineas';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  /** Elegir "Ingreso" delega al modal de "Ingresar stock" (que crea las unidades). */
  onRequestIngreso?: () => void;
}

const lbl = 'block text-[11px] font-medium text-slate-500 mb-1';
const selectCls = 'w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500';

/**
 * "Registrar movimiento" en LOTE: varios artículos en un mismo movimiento
 * (transferencia / egreso / consumo). Ingreso multi-artículo → "Ingresar stock".
 * Ajuste → por unidad (botón "Ajustar" en Unidades / Artículo).
 */
export const CreateMovimientoLoteModal: React.FC<Props> = ({ open, onClose, onCreated, onRequestIngreso }) => {
  const { usuario, firebaseUser } = useAuth();
  const creadoPor = usuario?.displayName ?? usuario?.email ?? firebaseUser?.email ?? 'Admin';
  const h = useMovimientoLoteForm(open, onClose, onCreated, creadoPor);

  return (
    <Modal open={open} onClose={h.handleClose}
      title="Registrar movimiento"
      subtitle="Uno o varios artículos en el mismo movimiento"
      maxWidth="lg"
      footer={<>
        <Button variant="outline" size="sm" onClick={h.handleClose}>Cancelar</Button>
        <Button size="sm" onClick={h.handleSave} disabled={h.saving || h.lineas.length === 0}>
          {h.saving ? 'Guardando...' : `Registrar (${h.totalUnidades} u.)`}
        </Button>
      </>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Tipo de movimiento *</label>
            <select value={h.tipo}
              onChange={e => {
                const v = e.target.value;
                if (v === 'ingreso' && onRequestIngreso) { onRequestIngreso(); return; }
                h.setTipo(v as TipoLote);
              }}
              className={selectCls}>
              {TIPO_LOTE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              {onRequestIngreso && <option value="ingreso">Ingreso (usar "Ingresar stock")…</option>}
            </select>
          </div>
          <div>
            <label className={lbl}>{h.destinoCfg.label} *</label>
            {h.destinoCfg.mode === 'ubicacion' ? (
              <SearchableSelect value={h.destinoKey} onChange={h.setDestinoKey}
                options={h.locationOptions.map(o => ({ value: o.key, label: o.nombre }))}
                placeholder="Seleccionar destino..." />
            ) : (
              <Input inputSize="sm" value={h.destinoLibre}
                onChange={e => h.setDestinoLibre(e.target.value)}
                placeholder={h.destinoCfg.label + '...'} />
            )}
          </div>
        </div>

        <div>
          <label className={lbl}>Origen *</label>
          <SearchableSelect value={h.origenKey} onChange={h.setOrigenKey}
            options={h.locationOptions.map(o => ({ value: o.key, label: o.nombre }))}
            placeholder="¿Desde qué ubicación salen los artículos?" />
        </div>

        <hr className="border-slate-100" />

        <MovimientoLoteLineas h={h} />

        <hr className="border-slate-100" />

        <Input inputSize="sm" label="Observación"
          value={h.observaciones}
          onChange={e => h.setObservaciones(e.target.value)}
          placeholder="Motivo, referencia... (opcional)" />
        <p className="text-[10px] text-slate-400">
          Registrado por <span className="font-medium text-slate-500">{creadoPor}</span>
        </p>
      </div>
    </Modal>
  );
};
