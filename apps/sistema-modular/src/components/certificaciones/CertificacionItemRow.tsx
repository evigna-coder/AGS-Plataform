import type { ItemCertificacion, ParteCertificada, WorkOrder } from '@ags/shared';

const celda = 'w-full border border-slate-200 rounded px-1.5 py-1 text-[11px] disabled:bg-slate-50 disabled:text-slate-400';

interface Props {
  ot: WorkOrder;
  linea: ItemCertificacion | undefined;
  on: boolean;
  onToggle: () => void;
  onEditar: (campo: keyof ItemCertificacion, v: string) => void;
  onPartes: (partes: ParteCertificada[]) => void;
}

/**
 * Una línea del resumen de certificación, editable (2026-09-07: sumó el ID
 * del equipo y las partes involucradas). Todo lo que se escribe acá es lo
 * que ve el cliente; no toca la OT.
 */
export function CertificacionItemRow({ ot, linea, on, onToggle, onEditar, onPartes }: Props) {
  const partes = linea?.partes ?? [];
  const setParte = (i: number, patch: Partial<ParteCertificada>) =>
    onPartes(partes.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return (
    <div className={`px-2.5 py-2 ${on ? '' : 'opacity-45'}`}>
      <div className="flex items-start gap-2.5">
        <input type="checkbox" checked={on} onChange={onToggle}
          className="w-3.5 h-3.5 accent-teal-600 shrink-0 mt-1.5" />
        <span className="font-mono text-[11px] font-semibold text-teal-700 shrink-0 w-20 mt-1.5">
          {ot.otNumber}
        </span>
        {/* Editable: lo que va en el resumen se redacta para quien
            lo firma, no se copia crudo del sistema. */}
        <div className="flex-1 grid grid-cols-[1fr_5.5rem_1fr] gap-1.5">
          <input value={linea?.equipo ?? ''} disabled={!on}
            onChange={e => onEditar('equipo', e.target.value)}
            placeholder="Equipo" className={celda} />
          <input value={linea?.equipoId ?? ''} disabled={!on}
            onChange={e => onEditar('equipoId', e.target.value)}
            placeholder="ID equipo" title="ID del equipo para el cliente (código interno de la carátula)"
            className={`${celda} font-mono`} />
          <input value={linea?.descripcionServicio ?? ''} disabled={!on}
            onChange={e => onEditar('descripcionServicio', e.target.value)}
            placeholder="Servicio realizado" className={celda} />
        </div>
        <input value={linea?.fechaServicio ?? ''} disabled={!on} type="date"
          onChange={e => onEditar('fechaServicio', e.target.value)}
          className={`${celda} w-32 shrink-0`} />
      </div>
      {/* Partes: precargadas con los consumos de la OT, declarables a mano. */}
      <div className="ml-[6.4rem] mt-1 space-y-1">
        {partes.map((p, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400 w-8 shrink-0">Parte</span>
            <input value={p.codigo} disabled={!on} placeholder="N° de parte"
              onChange={e => setParte(i, { codigo: e.target.value })}
              className={`${celda} font-mono w-32 shrink-0`} />
            <input value={p.descripcion} disabled={!on} placeholder="Descripción"
              onChange={e => setParte(i, { descripcion: e.target.value })}
              className={`${celda} flex-1`} />
            <input type="number" min={0} step="any" value={p.cantidad || ''} disabled={!on}
              onChange={e => setParte(i, { cantidad: Number(e.target.value) || 0 })}
              className={`${celda} w-16 shrink-0 text-right tabular-nums`} />
            <button type="button" disabled={!on} onClick={() => onPartes(partes.filter((_, j) => j !== i))}
              className="text-red-400 hover:text-red-600 text-sm px-1 disabled:opacity-40" title="Quitar parte">×</button>
          </div>
        ))}
        <button type="button" disabled={!on}
          onClick={() => onPartes([...partes, { codigo: '', descripcion: '', cantidad: 1 }])}
          className="text-[10px] text-teal-600 hover:underline disabled:opacity-40">
          + Declarar parte
        </button>
      </div>
    </div>
  );
}
