import type { CierreAdministrativo, Part } from '@ags/shared';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

const sec = 'text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3';
const lbl = 'text-[11px] font-medium text-slate-400 mb-0.5 block';
const inp = 'w-full border rounded-lg px-2.5 py-1 text-xs bg-white border-slate-300 disabled:bg-slate-100 disabled:text-slate-400';
const chk = 'w-3.5 h-3.5 accent-indigo-600';

interface Props {
  cierreAdmin: CierreAdministrativo;
  onChange: (field: keyof CierreAdministrativo, value: any) => void;
  onConfirmarCierre: () => void;
  horasTrabajadas: string;
  tiempoViaje: string;
  articulos: Part[];
  readOnly: boolean;
  estadoAdmin: string;
}

export const OTCierreAdminSection: React.FC<Props> = ({
  cierreAdmin, onChange, onConfirmarCierre,
  horasTrabajadas, tiempoViaje, articulos, readOnly, estadoAdmin,
}) => {
  const isClosed = estadoAdmin === 'FINALIZADO';
  const disabled = readOnly || isClosed;

  const hsLabOriginal = Number(horasTrabajadas) || 0;
  const hsViajeOriginal = Number(tiempoViaje) || 0;
  const hsLabAjust = cierreAdmin.horasLabAjustadas ?? '';
  const hsViajeAjust = cierreAdmin.horasViajeAjustadas ?? '';
  const hsLabFinal = hsLabAjust !== '' ? Number(hsLabAjust) || 0 : hsLabOriginal;
  const hsViajeFinal = hsViajeAjust !== '' ? Number(hsViajeAjust) || 0 : hsViajeOriginal;

  return (
    <Card compact className="border-cyan-200 bg-cyan-50/30">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-cyan-500" />
        <p className={`${sec} !mb-0`}>Cierre administrativo</p>
        {isClosed && cierreAdmin.fechaCierreAdmin && (
          <span className="text-[10px] text-slate-400 ml-auto">
            Cerrada {new Date(cierreAdmin.fechaCierreAdmin).toLocaleDateString('es-AR')}
          </span>
        )}
      </div>

      <div className="space-y-4">
        {/* Horas */}
        <div>
          <span className={lbl}>Confirmacion de horas</span>
          <div className="grid grid-cols-3 gap-2 mt-1">
            <div>
              <span className="text-[10px] text-slate-400 block">Lab (reporte)</span>
              <p className="text-xs text-slate-600 font-mono">{hsLabOriginal.toFixed(1)}h</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Viaje (reporte)</span>
              <p className="text-xs text-slate-600 font-mono">{hsViajeOriginal.toFixed(1)}h</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Total final</span>
              <p className="text-xs font-semibold text-slate-800 font-mono">{(hsLabFinal + hsViajeFinal).toFixed(1)}h</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <span className="text-[10px] text-slate-400 block">Lab ajustadas</span>
              <input
                type="text" value={hsLabAjust} disabled={disabled}
                onChange={e => onChange('horasLabAjustadas', e.target.value)}
                placeholder={hsLabOriginal.toFixed(1)} className={inp}
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Viaje ajustadas</span>
              <input
                type="text" value={hsViajeAjust} disabled={disabled}
                onChange={e => onChange('horasViajeAjustadas', e.target.value)}
                placeholder={hsViajeOriginal.toFixed(1)} className={inp}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 mt-2 cursor-pointer">
            <input type="checkbox" checked={cierreAdmin.horasConfirmadas} disabled={disabled}
              onChange={e => onChange('horasConfirmadas', e.target.checked)} className={chk} />
            <span className="text-xs text-slate-700">Horas confirmadas</span>
          </label>
        </div>

        {/* Partes / Stock */}
        <div>
          <span className={lbl}>Materiales / Repuestos ({articulos.length})</span>
          {articulos.length > 0 ? (
            <div className="border rounded-lg overflow-hidden mt-1">
              <table className="w-full">
                <thead className="bg-white/60">
                  <tr>
                    <th className="text-[10px] font-medium text-slate-400 py-1.5 px-2 text-left">Codigo</th>
                    <th className="text-[10px] font-medium text-slate-400 py-1.5 px-2 text-left">Descripcion</th>
                    <th className="text-[10px] font-medium text-slate-400 py-1.5 px-2 text-center w-12">Cant.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {articulos.map(p => (
                    <tr key={p.id} className="bg-white/40">
                      <td className="px-2 py-1 text-xs text-slate-600 font-mono">{p.codigo || '-'}</td>
                      <td className="px-2 py-1 text-xs text-slate-600">{p.descripcion || '-'}</td>
                      <td className="px-2 py-1 text-xs text-slate-600 text-center">{p.cantidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic mt-1">Sin materiales registrados</p>
          )}
          <div className="flex flex-col gap-1.5 mt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={cierreAdmin.partesConfirmadas} disabled={disabled || articulos.length === 0}
                onChange={e => onChange('partesConfirmadas', e.target.checked)} className={chk} />
              <span className="text-xs text-slate-700">Partes confirmadas</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={cierreAdmin.stockDeducido} disabled={disabled}
                onChange={e => onChange('stockDeducido', e.target.checked)} className={chk} />
              <span className="text-xs text-slate-700">Stock deducido</span>
            </label>
          </div>
        </div>

        {/* Notas de cierre */}
        <div>
          <span className={lbl}>Notas de cierre</span>
          <textarea
            value={cierreAdmin.notasCierre || ''} disabled={disabled}
            onChange={e => onChange('notasCierre', e.target.value)}
            rows={3} placeholder="Observaciones del cierre administrativo..."
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none bg-white focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
          />
        </div>

        {/* Aviso a administración */}
        {cierreAdmin.avisoAdminEnviado && (
          <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
            <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <p className="text-xs text-green-700 font-medium">Aviso enviado a administracion</p>
              {cierreAdmin.avisoAdminFecha && (
                <p className="text-[10px] text-green-600">
                  {new Date(cierreAdmin.avisoAdminFecha).toLocaleString('es-AR')}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Botón confirmar */}
        {!isClosed && (
          <div className="border-t border-cyan-200 pt-3">
            <Button size="sm" onClick={onConfirmarCierre} className="w-full">
              Confirmar cierre y avisar a administracion
            </Button>
            <p className="text-[10px] text-slate-400 text-center mt-1">
              Se enviara un aviso por mail a administracion para la facturacion y la OT pasara a Finalizado
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};
