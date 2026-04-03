import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import type { PosicionStock } from '@ags/shared';
import type { InventarioItem } from '../../hooks/useInventarioIngeniero';

interface Props {
  item: InventarioItem;
  saving: boolean;
  depositos: PosicionStock[];
  onDevolver: (item: InventarioItem) => void;
  onConsumir: (item: InventarioItem) => void;
  onReponer: (item: InventarioItem, cantidad: number, depotId: string, depotNombre: string) => Promise<boolean>;
  onReasignarCliente: () => void;
  onTransferir: () => void;
}

export const InventarioItemRow = ({ item, saving, depositos, onDevolver, onConsumir, onReponer, onReasignarCliente, onTransferir }: Props) => {
  const codigo = item.articuloCodigo || item.minikitCodigo || item.loanerCodigo || item.vehiculoPatente || '';
  const desc = item.articuloDescripcion || item.instrumentoNombre || item.dispositivoDescripcion || item.minikitCodigo || '';
  const remaining = item.cantidad - item.cantidadDevuelta - item.cantidadConsumida;
  const canAct = remaining > 0;
  const [reponiendo, setReponiendo] = useState(false);
  const [cantidadReponer, setCantidadReponer] = useState(1);
  const [depotSeleccionado, setDepotSeleccionado] = useState<PosicionStock | null>(null);

  return (
    <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="font-mono text-[11px] text-teal-700 font-semibold shrink-0">{codigo}</span>
        <span className="text-xs text-slate-700 truncate">{desc}</span>
        <span className="text-[10px] bg-slate-200 text-slate-600 px-1 py-0.5 rounded shrink-0">{item.tipo}</span>
        {item.permanente && <span className="text-[10px] bg-purple-50 text-purple-700 px-1 py-0.5 rounded shrink-0">Perm</span>}
        {item.clienteNombre && <span className="text-[10px] text-slate-400 shrink-0">→ {item.clienteNombre}</span>}
        <Link to={`/stock/asignaciones/${item.asignacionId}`} className="text-teal-500 hover:underline font-mono text-[10px] shrink-0 ml-auto">
          {item.asignacionNumero}
        </Link>
      </div>
      {canAct && (
        <div className="flex gap-1 shrink-0 ml-3 items-center">
          <ActionBtn label="Devolver" onClick={() => onDevolver(item)} disabled={saving} />
          {!item.permanente && <ActionBtn label="Consumir" onClick={() => onConsumir(item)} disabled={saving} />}
          <ActionBtn label="Cliente" onClick={onReasignarCliente} disabled={saving} />
          <ActionBtn label="Transferir" onClick={onTransferir} disabled={saving} />
          {item.tipo === 'minikit' && (
            reponiendo ? (
              <div className="flex items-center gap-1">
                <SearchableSelect
                  options={depositos.map(d => ({ value: d.id, label: d.nombre }))}
                  value={depotSeleccionado?.id ?? ''}
                  onChange={val => setDepotSeleccionado(depositos.find(d => d.id === val) ?? null)}
                  placeholder="Origen..."
                />
                <input type="number" min={1} value={cantidadReponer}
                  onChange={e => setCantidadReponer(Number(e.target.value))}
                  className="border border-slate-200 rounded px-1 py-0.5 text-xs w-14 text-right" />
                <button
                  onClick={async () => {
                    if (!depotSeleccionado) return;
                    const ok = await onReponer(item, cantidadReponer, depotSeleccionado.id, depotSeleccionado.nombre);
                    if (ok) { setReponiendo(false); setCantidadReponer(1); setDepotSeleccionado(null); }
                  }}
                  disabled={!depotSeleccionado || cantidadReponer <= 0 || saving}
                  className="text-[10px] font-medium text-teal-600 hover:text-teal-800 px-1.5 py-0.5 rounded hover:bg-teal-50 disabled:opacity-40">
                  OK
                </button>
                <button onClick={() => { setReponiendo(false); setCantidadReponer(1); setDepotSeleccionado(null); }}
                  className="text-[10px] text-slate-400 hover:text-slate-600 px-1 py-0.5">x</button>
              </div>
            ) : (
              <ActionBtn label="Reponer" onClick={() => setReponiendo(true)} disabled={saving} />
            )
          )}
        </div>
      )}
    </div>
  );
};

const ActionBtn = ({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) => (
  <button onClick={onClick} disabled={disabled}
    className="px-2 py-0.5 text-[10px] font-medium rounded border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40 transition-colors">
    {label}
  </button>
);
