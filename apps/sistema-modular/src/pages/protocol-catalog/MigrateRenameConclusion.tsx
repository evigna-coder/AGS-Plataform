import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { TableCatalogEntry, TableProject, TableCatalogColumn, TableCatalogRule } from '@ags/shared';
import { tableProjectsService, tableCatalogService } from '../../services/catalogService';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

const TARGET_PROJECT_NAMES = [
  'Calificación + RQ HPLC 1100-1260',
  'Calificación de operación HPLC 1260/1290',
  'Recalificación 1260/1290',
  'Recalificación HPLC 1100/1260 inf.',
];

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const isConclusionLabel = (label: string) => {
  const n = normalize(label);
  return n === 'conclusion' || n === 'conclusiones';
};

const replaceConclusionInText = (text: string) =>
  text
    .replace(/Conclusiones/g, 'Resultados')
    .replace(/Conclusi[oó]n/g, 'Resultado')
    .replace(/conclusiones/g, 'resultados')
    .replace(/conclusi[oó]n/g, 'resultado');

interface TableChange {
  table: TableCatalogEntry;
  columnChanges: { key: string; oldLabel: string }[];
  ruleChanges: { ruleId: string; oldDesc: string; newDesc: string }[];
}

export const MigrateRenameConclusion = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matchedProjects, setMatchedProjects] = useState<TableProject[]>([]);
  const [missingProjects, setMissingProjects] = useState<string[]>([]);
  const [plan, setPlan] = useState<TableChange[]>([]);
  const [applying, setApplying] = useState(false);
  const [appliedCount, setAppliedCount] = useState<number | null>(null);
  const [applyErrors, setApplyErrors] = useState<{ tableName: string; error: string }[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [projects, allTables] = await Promise.all([
          tableProjectsService.getAll(),
          tableCatalogService.getAll(),
        ]);

        const matched: TableProject[] = [];
        const missing: string[] = [];
        for (const targetName of TARGET_PROJECT_NAMES) {
          const found = projects.find(p => normalize(p.name) === normalize(targetName));
          if (found) matched.push(found);
          else missing.push(targetName);
        }

        const matchedIds = new Set(matched.map(p => p.id));
        const targetTables = allTables.filter(t => t.projectId && matchedIds.has(t.projectId));

        const changes: TableChange[] = [];
        for (const table of targetTables) {
          const columnChanges = table.columns
            .filter(c => isConclusionLabel(c.label))
            .map(c => ({ key: c.key, oldLabel: c.label }));

          const ruleChanges = (table.validationRules ?? [])
            .filter(r => r.description && /conclusi[oó]n/i.test(r.description))
            .map(r => ({
              ruleId: r.ruleId,
              oldDesc: r.description ?? '',
              newDesc: replaceConclusionInText(r.description ?? ''),
            }));

          if (columnChanges.length > 0 || ruleChanges.length > 0) {
            changes.push({ table, columnChanges, ruleChanges });
          }
        }

        setMatchedProjects(matched);
        setMissingProjects(missing);
        setPlan(changes);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
        setLoading(false);
      }
    })();
  }, []);

  const apply = async () => {
    if (!confirm(`¿Aplicar los cambios a ${plan.length} tabla(s)? Esta operación no se puede deshacer automáticamente.`)) return;
    setApplying(true);
    setApplyErrors([]);
    let success = 0;
    const errors: { tableName: string; error: string }[] = [];

    for (const { table } of plan) {
      try {
        const updatedColumns: TableCatalogColumn[] = table.columns.map(c =>
          isConclusionLabel(c.label) ? { ...c, label: 'Resultado' } : c
        );
        const updatedRules: TableCatalogRule[] = (table.validationRules ?? []).map(r =>
          r.description ? { ...r, description: replaceConclusionInText(r.description) } : r
        );
        await tableCatalogService.save({
          ...table,
          columns: updatedColumns,
          validationRules: updatedRules,
        });
        success++;
      } catch (err) {
        errors.push({
          tableName: table.name,
          error: err instanceof Error ? err.message : 'Error desconocido',
        });
      }
    }

    setAppliedCount(success);
    setApplyErrors(errors);
    setApplying(false);
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Analizando tablas…</div>;
  if (error) return <div className="p-8 text-red-600 font-bold">Error: {error}</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-900">Migración: Conclusión → Resultado</h1>
        <Link to="/table-catalog" className="text-sm text-teal-700 hover:underline">← Volver</Link>
      </div>

      <Card className="p-4 space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Proyectos encontrados</h2>
        {matchedProjects.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {matchedProjects.map(p => (
              <li key={p.id} className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span className="font-medium">{p.name}</span>
                <span className="text-slate-400 text-xs">({p.id})</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Ninguno encontrado.</p>
        )}
        {missingProjects.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-100">
            <p className="text-xs font-bold text-amber-700 mb-1">No encontrados:</p>
            <ul className="space-y-0.5 text-xs text-amber-600">
              {missingProjects.map(n => <li key={n}>✗ {n}</li>)}
            </ul>
          </div>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Cambios a aplicar ({plan.length} tabla{plan.length !== 1 ? 's' : ''})
          </h2>
          {appliedCount === null && plan.length > 0 && (
            <Button onClick={apply} disabled={applying}>
              {applying ? 'Aplicando…' : `Aplicar a ${plan.length} tabla(s)`}
            </Button>
          )}
        </div>

        {plan.length === 0 ? (
          <p className="text-sm text-slate-500">No hay cambios pendientes.</p>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {plan.map(({ table, columnChanges, ruleChanges }) => (
              <div key={table.id} className="border border-slate-200 rounded-md p-3 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-800">{table.name}</span>
                  <span className="text-slate-400">{table.status}</span>
                </div>
                {columnChanges.length > 0 && (
                  <div className="mt-1">
                    <span className="text-slate-500 font-medium">Columnas:</span>
                    <ul className="ml-3 space-y-0.5">
                      {columnChanges.map(c => (
                        <li key={c.key} className="font-mono text-[11px]">
                          <span className="text-red-600 line-through">{c.oldLabel}</span>
                          <span className="text-slate-400"> → </span>
                          <span className="text-green-700 font-bold">Resultado</span>
                          <span className="text-slate-400"> (key: {c.key})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {ruleChanges.length > 0 && (
                  <div className="mt-1">
                    <span className="text-slate-500 font-medium">Reglas (descripción):</span>
                    <ul className="ml-3 space-y-0.5">
                      {ruleChanges.map(r => (
                        <li key={r.ruleId} className="text-[11px]">
                          <div className="text-red-600 line-through">{r.oldDesc}</div>
                          <div className="text-green-700">{r.newDesc}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {appliedCount !== null && (
        <Card className="p-4 space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Resultado</h2>
          <p className="text-sm">
            <span className="text-green-700 font-bold">{appliedCount}</span> tabla(s) actualizada(s) con éxito.
          </p>
          {applyErrors.length > 0 && (
            <div>
              <p className="text-xs font-bold text-red-700 mb-1">Errores ({applyErrors.length}):</p>
              <ul className="text-xs text-red-600 space-y-0.5">
                {applyErrors.map((e, i) => (
                  <li key={i}>• {e.tableName}: {e.error}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
