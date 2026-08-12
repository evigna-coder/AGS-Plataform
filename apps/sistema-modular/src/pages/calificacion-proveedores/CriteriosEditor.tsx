import type { CriterioEvaluacion, EstadoCalificacion } from '@ags/shared';

const CRITERIO_DESCRIPCION: Record<string, string> = {
  conformidad: 'El producto/trabajo recibido cumple con las especificaciones técnicas y condiciones solicitadas.',
  plazo: 'La entrega se realizó dentro del plazo acordado. Penalizar proporcionalmente por días de atraso.',
  cantidad: 'La cantidad recibida coincide con la cantidad solicitada. Sin faltantes ni excedentes.',
  documentacion: 'Incluye remito, certificado de análisis (CoA), MSDS, factura y toda documentación requerida.',
  embalaje: 'El producto llegó correctamente embalado, sin daños ni contaminación.',
  respuesta: 'Tiempo desde la solicitud hasta la respuesta/despacho efectivo por parte del proveedor.',
  precio: 'El precio facturado coincide con el cotizado. Sin recargos no pactados.',
  tiempo_proveedor: 'Cuánto tiempo estuvo la pieza en el proveedor. Penalizar demoras injustificadas.',
};

interface Props {
  criterios: CriterioEvaluacion[];
  puntajeTotal: number;
  estado: EstadoCalificacion;
  onChange: (id: string, puntaje: number) => void;
}

/** Tabla editable de criterios de una calificación (extraída de CalificacionModal). */
export function CriteriosEditor({ criterios, puntajeTotal, estado, onChange }: Props) {
  const estadoColor = estado === 'aprobado' ? 'bg-emerald-100 text-emerald-700'
    : estado === 'condicional' ? 'bg-amber-100 text-amber-700'
    : 'bg-red-100 text-red-700';
  const estadoLabel = estado === 'aprobado' ? 'Aprobado' : estado === 'condicional' ? 'Condicional' : 'No aprobado';
  const pesoTotal = criterios.reduce((sum, c) => sum + c.pesoMax, 0);

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left text-[10px] font-medium text-slate-400 uppercase">Criterio</th>
            <th className="px-3 py-2 text-center text-[10px] font-medium text-slate-400 uppercase w-20">Máx</th>
            <th className="px-3 py-2 text-center text-[10px] font-medium text-slate-400 uppercase w-28">Puntaje</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {criterios.map(c => (
            <tr key={c.id}>
              <td className="px-3 py-2 text-slate-700 cursor-help" title={CRITERIO_DESCRIPCION[c.id] || ''}>
                <span className="border-b border-dashed border-slate-300">{c.nombre}</span>
              </td>
              <td className="px-3 py-2 text-center text-slate-400 font-mono text-xs">{c.pesoMax}</td>
              <td className="px-3 py-2 text-center">
                <input type="number" min={0} max={c.pesoMax} value={c.puntaje}
                  onChange={e => onChange(c.id, Number(e.target.value) || 0)}
                  className="w-16 border border-slate-300 rounded px-2 py-1 text-center text-sm font-mono" />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-slate-50 border-t border-slate-200">
          <tr>
            <td className="px-3 py-2 font-bold text-slate-700">Total</td>
            <td className="px-3 py-2 text-center font-mono text-xs text-slate-400">{pesoTotal}</td>
            <td className="px-3 py-2 text-center">
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap ${estadoColor}`}>
                {puntajeTotal} — {estadoLabel}
              </span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
