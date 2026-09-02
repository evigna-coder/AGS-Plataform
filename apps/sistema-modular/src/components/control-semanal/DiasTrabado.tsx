/**
 * Antigüedad de una fila del control semanal (2026-09-02, pedido dirección).
 *
 * El control contestaba QUÉ está pendiente; con esto contesta HACE CUÁNTO, que
 * es lo que permite ordenar la foto por gravedad. El color escala solo: hasta
 * dos semanas es ruido normal, de ahí en más es un problema.
 */
export function DiasTrabado({ dias, desdeQue }: { dias: number | null; desdeQue: string | null }) {
  if (dias === null) {
    return <span className="text-slate-300 text-[10px]">—</span>;
  }
  const tono = dias >= 30
    ? 'bg-red-100 text-red-700'
    : dias >= 14
      ? 'bg-amber-100 text-amber-700'
      : 'bg-slate-100 text-slate-500';
  return (
    <span
      title={desdeQue ? `Desde ${desdeQue}` : undefined}
      className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-mono font-semibold tabular-nums ${tono}`}
    >
      {dias} d
    </span>
  );
}
