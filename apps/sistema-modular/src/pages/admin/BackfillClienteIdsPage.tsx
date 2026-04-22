import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { leadsService } from '../../services/leadsService';
import { clientesService } from '../../services/clientesService';

type Result = { total: number; matched: number; ambiguous: number; unmatched: number; skipped: number };

export default function BackfillClienteIdsPage() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!confirm('Re-matchear clienteId para tickets sin cliente vinculado. Los ambiguos quedan en /admin/revision-clienteid para resolución manual. ¿Continuar?')) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const clientes = await clientesService.getAll();
      const res = await leadsService.backfillClienteIds(clientes);
      setResult(res);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-serif text-slate-800 mb-1">Backfill clienteId de tickets</h1>
      <p className="text-xs text-slate-500 mb-6">
        Escanea tickets con <code>clienteId</code> vacío y los matchea con clientes existentes por razón social normalizada (ignora acentos, puntuación y sufijos societarios). Un candidato único se asigna directo; múltiples candidatos quedan en la lista de revisión. Idempotente.
      </p>

      <Card>
        <div className="p-5 space-y-4">
          <Button onClick={run} disabled={running}>
            {running ? 'Procesando...' : 'Ejecutar backfill'}
          </Button>

          {result && (
            <div className="text-xs font-mono text-slate-700 bg-slate-50 border border-slate-200 rounded p-3 space-y-1">
              <div>Tickets sin clienteId: {result.total}</div>
              <div className="text-teal-700">Matcheados (1 candidato): {result.matched}</div>
              <div className="text-amber-700">Ambiguos (2+ candidatos): {result.ambiguous}</div>
              <div className="text-slate-500">Sin coincidencia: {result.unmatched}</div>
              <div className="text-slate-400">Descartados previamente: {result.skipped}</div>
              {(result.ambiguous > 0 || result.unmatched > 0) && (
                <div className="pt-2 mt-2 border-t border-slate-200">
                  <Link to="/admin/revision-clienteid" className="text-teal-600 hover:text-teal-800 font-sans">
                    Ir a revisión manual →
                  </Link>
                </div>
              )}
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
