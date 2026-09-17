import type { ComponenteRequerimiento } from '@ags/shared';

interface Props {
  componentes: ComponenteRequerimiento[] | null | undefined;
  onChange: (componentes: ComponenteRequerimiento[] | null) => void;
}

const inp = 'text-[10px] border border-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-teal-500';

/**
 * Desglose de un ítem de la OC, editable (2026-09-16). El desglose nace de los
 * sub-ítems del presupuesto y trae renglones que son para el cliente —mano de
 * obra, instalación— y no le interesan al proveedor: acá se sacan o se
 * corrigen antes de enviar la OC. Sin renglones se guarda null.
 */
export function OCItemComponentesEditor({ componentes, onChange }: Props) {
  const lista = componentes ?? [];
  const set = (i: number, patch: Partial<ComponenteRequerimiento>) =>
    onChange(lista.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const quitar = (i: number) => {
    const out = lista.filter((_, j) => j !== i);
    onChange(out.length > 0 ? out : null);
  };
  const agregar = () => onChange([...lista, { codigo: null, descripcion: '', cantidad: 1 }]);

  return (
    <div className="mt-1 border-l-2 border-slate-100 pl-2 space-y-0.5">
      {lista.map((c, i) => (
        <div key={i} className="flex items-center gap-1">
          <input type="number" min={1} value={c.cantidad} title="Cantidad"
            onChange={e => set(i, { cantidad: Math.max(1, Number(e.target.value) || 1) })}
            className={`${inp} w-10 text-right tabular-nums`} />
          <input value={c.codigo ?? ''} placeholder="código" title="Código"
            onChange={e => set(i, { codigo: e.target.value.trim() || null })}
            className={`${inp} w-24 font-mono`} />
          <input value={c.descripcion} placeholder="descripción" title="Descripción"
            onChange={e => set(i, { descripcion: e.target.value })}
            className={`${inp} flex-1`} />
          <button type="button" onClick={() => quitar(i)} title="Quitar este renglón del desglose"
            className="text-[11px] text-slate-400 hover:text-red-600 px-1">✕</button>
        </div>
      ))}
      <button type="button" onClick={agregar} className="text-[10px] text-teal-700 hover:underline">
        {lista.length > 0 ? '+ renglón del desglose' : '+ agregar desglose'}
      </button>
    </div>
  );
}
