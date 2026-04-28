import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { leadsService } from '../../services/leadsService';
import { TICKET_AREA_LABELS } from '@ags/shared';
import type { TicketArea } from '@ags/shared';

type Result = Awaited<ReturnType<typeof leadsService.backfillResponsablesPorArea>>;

export default function BackfillResponsablesPage() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!confirm(
      'Asignar responsable por defecto a tickets abiertos con área pero sin asignado, ' +
      'según la config de /admin/config-flujos. ¿Continuar?'
    )) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await leadsService.backfillResponsablesPorArea();
      setResult(res);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-serif text-slate-800 mb-1">Backfill responsables por área</h1>
      <p className="text-xs text-slate-500 mb-6">
        Recorre todos los tickets abiertos con <code className="bg-slate-100 px-1 rounded">areaActual</code> y sin{' '}
        <code className="bg-slate-100 px-1 rounded">asignadoA</code>. Para cada uno, busca el responsable por defecto del área en{' '}
        <code className="bg-slate-100 px-1 rounded">adminConfig/flujos.responsablePorArea</code> y lo asigna. Idempotente:
        no toca tickets que ya tengan asignado, ni finalizados, ni los del área sistema. Si el área no tiene default
        configurado o el usuario no está activo, el ticket queda como está.
      </p>

      <Card>
        <div className="p-5 space-y-4">
          <Button onClick={run} disabled={running}>
            {running ? 'Procesando...' : 'Ejecutar backfill'}
          </Button>

          {result && (
            <div className="text-xs font-mono text-slate-700 bg-slate-50 border border-slate-200 rounded p-3 space-y-1">
              <div>Total tickets: {result.total}</div>
              <div className="text-teal-700 font-semibold">Asignados: {result.asignados}</div>
              <div className="pt-1 mt-1 border-t border-slate-200 text-slate-500">Skipped:</div>
              <div className="pl-3">Ya con asignado: {result.skippedConAsignado}</div>
              <div className="pl-3">Sin área: {result.skippedSinArea}</div>
              <div className="pl-3">Finalizados/No concretados: {result.skippedFinalizados}</div>
              <div className="pl-3">Área sistema: {result.skippedAreaSistema}</div>
              <div className="pl-3">Sin default configurado: {result.skippedSinDefault}</div>
              <div className="pl-3">Usuario default inactivo o inexistente: {result.skippedUsuarioInactivo}</div>
            </div>
          )}

          {result && result.detalleAsignados.length > 0 && (
            <div className="text-xs">
              <div className="font-semibold text-slate-700 mb-2">Detalle de tickets asignados</div>
              <div className="border border-slate-200 rounded overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-100 text-slate-600 font-mono text-[10px] uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-3 py-1.5">Número</th>
                      <th className="text-left px-3 py-1.5">Razón social</th>
                      <th className="text-left px-3 py-1.5">Área</th>
                      <th className="text-left px-3 py-1.5">Asignado a</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700">
                    {result.detalleAsignados.map((t, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-3 py-1.5 font-mono">{t.numero}</td>
                        <td className="px-3 py-1.5 truncate max-w-[180px]">{t.razonSocial}</td>
                        <td className="px-3 py-1.5">{TICKET_AREA_LABELS[t.area as TicketArea] ?? t.area}</td>
                        <td className="px-3 py-1.5">{t.asignadoNombre}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-3">
              Error: {error}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
