import { useState } from 'react';
import type { PrevisionesGenerarReport } from '@ags/shared';
import { previsionesService } from '../../services/previsionesService';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

const Stat = ({ n, label, color }: { n: number; label: string; color: string }) => (
  <div className="rounded-lg border border-slate-200 py-2">
    <div className={`text-lg font-semibold ${color}`}>{n}</div>
    <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
  </div>
);

interface Props {
  /** Año de origen: se lee lo REALIZADO en este año y se previsiona el siguiente. */
  anioOrigen: number;
  onDone?: () => void;
}

/**
 * Corre el batch de previsiones y muestra el reporte. Idempotente: se puede correr
 * las veces que haga falta mientras se termina de cargar la agenda del año.
 * Mismo estilo de reporte que "Sincronizar con Biblioteca" (QF).
 */
export const GenerarPrevisionesButton: React.FC<Props> = ({ anioOrigen, onDone }) => {
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<PrevisionesGenerarReport | null>(null);

  const run = async () => {
    setRunning(true);
    try {
      setReport(await previsionesService.generar(anioOrigen));
      onDone?.();
    } catch (err) {
      console.error('[GenerarPrevisiones]', err);
      alert('Error al generar las previsiones');
    } finally {
      setRunning(false);
    }
  };

  const sinNovedades = report
    && report.creadas === 0 && report.actualizadas === 0
    && report.respetadas === 0 && report.salteadas.length === 0;

  return (
    <>
      <Button size="sm" onClick={run} disabled={running}
        title={`Lee los servicios completados de ${anioOrigen} y reserva el mismo lugar en ${anioOrigen + 1}`}>
        {running ? 'Generando…' : `Generar previsiones ${anioOrigen + 1}`}
      </Button>
      {report && (
        <Modal open onClose={() => setReport(null)} maxWidth="sm"
          title={`Previsiones ${report.anioDestino}`}
          subtitle={`Desde los servicios completados en ${report.anioOrigen} con recurrencia anual`}
          minimizable={false}
          footer={<Button size="sm" onClick={() => setReport(null)}>Cerrar</Button>}>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat n={report.creadas} label="Creadas" color="text-teal-700" />
              <Stat n={report.actualizadas} label="Actualizadas" color="text-blue-700" />
              <Stat n={report.respetadas} label="Respetadas" color="text-slate-500" />
            </div>
            {report.respetadas > 0 && (
              <p className="text-[11px] text-slate-500">
                "Respetadas" = previsiones ya reprogramadas, convertidas o descartadas a mano.
                El generador no las toca.
              </p>
            )}
            {report.salteadas.length > 0 && (
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wide text-amber-600 mb-1">
                  Salteadas ({report.salteadas.length})
                </p>
                <div className="max-h-40 overflow-y-auto rounded-md border border-amber-100 bg-amber-50/50 divide-y divide-amber-100">
                  {report.salteadas.map((s, i) => (
                    <div key={i} className="px-2 py-1 text-[11px] flex justify-between gap-2">
                      <span className="font-mono text-slate-600 truncate">{s.valor}</span>
                      <span className="text-amber-700 shrink-0">{s.motivo}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {sinNovedades && (
              <p className="text-xs text-slate-400 text-center">
                No hay servicios completados con recurrencia anual en {report.anioOrigen}.
              </p>
            )}
          </div>
        </Modal>
      )}
    </>
  );
};
