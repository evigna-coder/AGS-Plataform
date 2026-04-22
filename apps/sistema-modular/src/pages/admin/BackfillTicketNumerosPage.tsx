import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { leadsService } from '../../services/leadsService';

export default function BackfillTicketNumerosPage() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ total: number; yaNumerados: number; asignados: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!confirm('Asignar números TKT-00001... a todos los tickets sin numero. ¿Continuar?')) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await leadsService.backfillTicketNumeros();
      setResult(res);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-serif text-slate-800 mb-1">Backfill numeración de tickets</h1>
      <p className="text-xs text-slate-500 mb-6">
        Asigna numero correlativo TKT-00001, TKT-00002, ... a los tickets existentes sin numero, ordenados por fecha de creación. Idempotente: no reasigna los que ya tienen numero.
      </p>

      <Card>
        <div className="p-5 space-y-4">
          <Button onClick={run} disabled={running}>
            {running ? 'Procesando...' : 'Ejecutar backfill'}
          </Button>

          {result && (
            <div className="text-xs font-mono text-slate-700 bg-slate-50 border border-slate-200 rounded p-3 space-y-1">
              <div>Total de tickets: {result.total}</div>
              <div>Ya numerados: {result.yaNumerados}</div>
              <div className="text-teal-700">Numeros asignados: {result.asignados}</div>
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
