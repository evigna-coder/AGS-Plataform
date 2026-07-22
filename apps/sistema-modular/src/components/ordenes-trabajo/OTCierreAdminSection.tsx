import { useState } from 'react';
import type { CierreAdministrativo, OTEstadoAdmin, Part, PatronSeleccionado } from '@ags/shared';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { CierreStockSelector } from './CierreStockSelector';
import { CierreMaterialesBlock } from './CierreMaterialesBlock';
import { CierrePDFPreview } from './CierrePDFPreview';
import { CierreFacturacionWizard } from './CierreFacturacionWizard';
import { CierrePatronesConsumidosSection } from './CierrePatronesConsumidosSection';
import { useOTFinalizable } from '../../hooks/useOTFinalizable';

const sec = 'text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3';
const lbl = 'text-[11px] font-medium text-slate-400 mb-0.5 block';
const inp = 'w-full border rounded-lg px-2.5 py-1 text-xs bg-white border-slate-300 disabled:bg-slate-100 disabled:text-slate-400';
const chk = 'w-3.5 h-3.5 accent-teal-600';

interface Props {
  cierreAdmin: CierreAdministrativo;
  onChange: (field: keyof CierreAdministrativo, value: any) => void;
  onConfirmarCierre: () => void;
  onReabrirOT?: () => void;
  horasTrabajadas: string;
  tiempoViaje: string;
  articulos: Part[];
  readOnly: boolean;
  estadoAdmin: OTEstadoAdmin;
  razonSocial?: string;
  tipoServicio?: string;
  ingenieroNombre?: string | null;
  otNumber?: string;
  budgets?: string[];
  clienteId?: string;
  clienteNombre?: string;
  patronesSeleccionados?: PatronSeleccionado[];
  onPatronesConsumidosConfirmados?: () => void;
  hidePdfPreview?: boolean; // true cuando el preview vive en otra pestaña (EditOTCierreTabs)
  /** Carga de materiales durante el cierre (UAT 2026-07-15: reporte sin items no tenía salida). */
  onAddPart?: (prefill?: { codigo: string; descripcion: string }) => void;
  onUpdatePart?: (id: string, field: keyof Part, value: any) => void;
  onRemovePart?: (id: string) => void;
}

export const OTCierreAdminSection: React.FC<Props> = ({
  cierreAdmin, onChange, onConfirmarCierre, onReabrirOT,
  horasTrabajadas, tiempoViaje, articulos, readOnly, estadoAdmin,
  razonSocial, tipoServicio, ingenieroNombre,
  otNumber, budgets, clienteId, clienteNombre,
  patronesSeleccionados, onPatronesConsumidosConfirmados, hidePdfPreview,
  onAddPart, onUpdatePart, onRemovePart,
}) => {
  const isClosed = estadoAdmin === 'FINALIZADO';
  const disabled = readOnly || isClosed;
  const [showPreview, setShowPreview] = useState(false);
  const finalizable = useOTFinalizable(estadoAdmin, budgets);

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
        <CierreMaterialesBlock
          articulos={articulos}
          cierreAdmin={cierreAdmin}
          disabled={disabled}
          onChange={onChange}
          onAddPart={onAddPart}
          onUpdatePart={onUpdatePart}
          onRemovePart={onRemovePart}
          tienePresupuestos={!!budgets && budgets.length > 0}
        />

        {/* Notas de cierre */}
        <div>
          <span className={lbl}>Notas de cierre</span>
          <textarea
            value={cierreAdmin.notasCierre || ''} disabled={disabled}
            onChange={e => onChange('notasCierre', e.target.value)}
            rows={3} placeholder="Observaciones del cierre administrativo..."
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none bg-white focus:ring-1 focus:ring-teal-500 disabled:bg-slate-100 disabled:text-slate-400"
          />
        </div>

        {/* Patrones consumidos (BOM-05) — sub-component cargado siempre que haya otNumber.
           Internamente decide loading/read-only/editable y skip cuando no hay BOM. */}
        {otNumber && (
          <CierrePatronesConsumidosSection
            otNumber={otNumber}
            patronesSeleccionados={patronesSeleccionados ?? []}
            onConfirmed={onPatronesConsumidosConfirmados}
          />
        )}

        {/* Stock origin selector */}
        {articulos.length > 0 && (
          <CierreStockSelector
            articulos={articulos}
            selections={cierreAdmin.stockSelections || []}
            onChange={sels => onChange('stockSelections', sels)}
            disabled={disabled}
          />
        )}

        {/* PDF Preview */}
        {otNumber && !hidePdfPreview && <CierrePDFPreview otNumber={otNumber} />}

        {/* Facturacion wizard */}
        {otNumber && budgets && budgets.length > 0 && clienteId && (
          <CierreFacturacionWizard
            otNumber={otNumber}
            budgets={budgets}
            clienteId={clienteId}
            clienteNombre={clienteNombre || ''}
            onSolicitudCreated={id => onChange('solicitudFacturacionId', id)}
          />
        )}

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

        {/* Preview confirmación finalización */}
        {showPreview && !isClosed && (
          <div className="border border-amber-300 rounded-lg p-3 bg-amber-50/60 space-y-1.5">
            <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider">¿Finalizar OT?</p>
            <div className="text-xs text-slate-600 space-y-0.5">
              <p><span className="text-slate-400">Cliente:</span> {razonSocial || '—'}</p>
              <p><span className="text-slate-400">Servicio:</span> {tipoServicio || '—'}</p>
              <p><span className="text-slate-400">Ingeniero:</span> {ingenieroNombre || 'Sin asignar'}</p>
              <p><span className="text-slate-400">Hs Lab:</span> {hsLabFinal.toFixed(1)}h | <span className="text-slate-400">Hs Viaje:</span> {hsViajeFinal.toFixed(1)}h | <span className="text-slate-400">Total:</span> {(hsLabFinal + hsViajeFinal).toFixed(1)}h</p>
              <p><span className="text-slate-400">Partes:</span> {articulos.length} items {cierreAdmin.stockDeducido ? '(stock deducido)' : '(stock NO deducido)'}</p>
              {cierreAdmin.notasCierre && <p><span className="text-slate-400">Notas:</span> {cierreAdmin.notasCierre}</p>}
            </div>
            <p className="text-[10px] text-amber-700 italic">Esta acción es terminal — la OT no podrá editarse después de finalizar.</p>
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => setShowPreview(false)} className="flex-1">Cancelar</Button>
              <Button size="sm" onClick={() => { setShowPreview(false); onConfirmarCierre(); }} className="flex-1">Sí, finalizar OT</Button>
            </div>
          </div>
        )}

        {/* Botón Finalizar OT */}
        {!isClosed && !showPreview && (
          <div className="border-t border-cyan-200 pt-3">
            <Button
              size="sm"
              disabled={disabled || finalizable.loading || !finalizable.puedeFinalizarse}
              title={finalizable.razon ?? undefined}
              onClick={() => {
                if (!cierreAdmin.horasConfirmadas) { alert('Debe confirmar las horas trabajadas'); return; }
                if (!cierreAdmin.partesConfirmadas && articulos.length > 0) { alert('Debe confirmar los materiales/repuestos'); return; }
                setShowPreview(true);
              }}
              className="w-full"
            >
              {finalizable.loading ? 'Verificando facturación...' : 'Finalizar OT'}
            </Button>
            {finalizable.razon ? (
              <p className="text-[10px] text-amber-600 text-center mt-1">{finalizable.razon}</p>
            ) : (
              <p className="text-[10px] text-slate-400 text-center mt-1">
                Acción terminal — se pedirá confirmación
              </p>
            )}
          </div>
        )}

        {/* Reabrir OT */}
        {isClosed && onReabrirOT && (
          <div className="border-t border-cyan-200 pt-3">
            <Button size="sm" variant="outline" onClick={onReabrirOT} className="w-full text-amber-600 border-amber-300 hover:bg-amber-50">
              Reabrir OT (volver a Cierre Administrativo)
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
};
