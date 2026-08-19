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

/**
 * Color por porcentaje del maximo: verde de 80 para arriba, ambar de 60 a 79,
 * rojo abajo. Los mismos cortes que `calcEstadoCalificacion` usa para el total,
 * asi cada fila anticipa a que estado empuja.
 */
const pct = (puntaje: number, max: number) => (max > 0 ? (puntaje / max) * 100 : 0);
const colorPista = (puntaje: number, max: number) => {
  const p = pct(puntaje, max);
  return p >= 80 ? 'bg-emerald-200' : p >= 60 ? 'bg-amber-200' : 'bg-red-200';
};
const colorTexto = (puntaje: number, max: number) => {
  const p = pct(puntaje, max);
  return p >= 80 ? 'text-emerald-700' : p >= 60 ? 'text-amber-700' : 'text-red-600';
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
            <th className="px-3 py-2 text-center text-[10px] font-medium text-slate-400 uppercase w-16">Máx</th>
            <th className="px-3 py-2 text-center text-[10px] font-medium text-slate-400 uppercase">Puntaje</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {criterios.map(c => (
            <tr key={c.id}>
              <td className="px-3 py-2 text-slate-700 cursor-help" title={CRITERIO_DESCRIPCION[c.id] || ''}>
                <span className="border-b border-dashed border-slate-300">{c.nombre}</span>
              </td>
              <td className="px-3 py-2 text-center text-slate-400 font-mono text-xs">{c.pesoMax}</td>
              {/* Barra deslizable en vez de input numerico (2026-08-19): calificar
                  es un juicio en una escala, no tipear un numero. El valor va al
                  lado y cambia de color con el porcentaje del maximo, para que se
                  lea de un golpe donde esta parado cada criterio. */}
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <input
                    type="range" min={0} max={c.pesoMax} step={1} value={c.puntaje}
                    onChange={e => onChange(c.id, Number(e.target.value))}
                    aria-label={`Puntaje de ${c.nombre}, de 0 a ${c.pesoMax}`}
                    className={`flex-1 h-1.5 rounded-full appearance-none cursor-pointer
                      ${colorPista(c.puntaje, c.pesoMax)}
                      [&::-webkit-slider-thumb]:appearance-none
                      [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
                      [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
                      [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-teal-600
                      [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-grab
                      [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5
                      [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white
                      [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-teal-600`}
                  />
                  <span className={`w-10 text-right font-mono text-sm tabular-nums font-semibold ${colorTexto(c.puntaje, c.pesoMax)}`}>
                    {c.puntaje}
                  </span>
                </div>
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
