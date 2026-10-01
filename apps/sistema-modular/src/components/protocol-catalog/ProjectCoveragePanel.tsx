import { useEffect, useMemo, useState } from 'react';
import type { TableCatalogEntry, TableProject } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { CoverageRowItem } from './CoverageRowItem';
import type { CatalogGroup } from '../../hooks/useCoverageCatalog';
import {
  computeCoverage, planCoverageUpdates, coverageKey, majorityOn, type CoverageField, type CoverageRow,
} from '../../utils/tableCatalogCoverage';
import { notify } from '../../utils/notify';

interface Props {
  open: boolean;
  onClose: () => void;
  project: TableProject | null;
  tables: TableCatalogEntry[];
  field: CoverageField;
  groups: CatalogGroup[];
  /** Escribe en las tablas y guarda en el proyecto los valores que quedan cubiertos por todas. */
  onApply: (updates: { id: string; values: string[] }[], projectValues: string[]) => Promise<void>;
}

const TITLES: Record<CoverageField, { title: string; noun: string }> = {
  modelos: { title: 'Modelos del proyecto', noun: 'modelos' },
  tipoServicio: { title: 'Servicios del proyecto', noun: 'servicios' },
};

/**
 * Panel de cobertura: muestra, para cada modelo (o servicio), cuántas tablas del
 * proyecto lo tienen. Las discrepancias quedan en ámbar con la tabla que falta.
 * Tildar = en todas las tablas; destildar = en ninguna. Nada se escribe hasta "Aplicar".
 */
export function ProjectCoveragePanel({ open, onClose, project, tables, field, groups, onApply }: Props) {
  const [pending, setPending] = useState<Map<string, { value: string; on: boolean }>>(new Map());
  const [search, setSearch] = useState('');
  const [soloDiscrepancias, setSoloDiscrepancias] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verCatalogo, setVerCatalogo] = useState(false);

  useEffect(() => { if (open) { setPending(new Map()); setSearch(''); setVerCatalogo(false); } }, [open]);

  const catalog = useMemo(() => groups.flatMap(g => g.values), [groups]);
  const cov = useMemo(() => computeCoverage(tables, field, catalog), [tables, field, catalog]);
  const total = cov.withList.length > 0 ? cov.withList.length : cov.appliesToAll.length;
  const byKey = useMemo(() => new Map(cov.rows.map(r => [coverageKey(r.value), r])), [cov]);

  const toggle = (row: CoverageRow) => setPending(prev => {
    const next = new Map(prev);
    const k = coverageKey(row.value);
    // Parcial sin tocar: el primer clic resuelve por mayoría (1 de 23 → quitar; 22 de 23 → agregar).
    const target = next.has(k) ? !next.get(k)!.on : row.status === 'partial' ? majorityOn(row) : row.status !== 'full';
    // Volver al estado original = sin cambio pendiente.
    if ((target && row.status === 'full') || (!target && row.status === 'none')) next.delete(k);
    else next.set(k, { value: row.value, on: target });
    return next;
  });

  const igualar = () => setPending(prev => {
    const next = new Map(prev);
    for (const r of cov.rows) if (r.status === 'partial') next.set(coverageKey(r.value), { value: r.value, on: majorityOn(r) });
    return next;
  });

  const q = search.trim().toLowerCase();
  const visible = (r: CoverageRow) =>
    (!q || r.value.toLowerCase().includes(q)) && (!soloDiscrepancias || r.status === 'partial' || !r.inCatalog);
  // Primero lo que el proyecto usa (discrepancias arriba); el resto del catálogo, plegado.
  const enUso = (r: CoverageRow) => r.coveredBy.length > 0 || pending.get(coverageKey(r.value))?.on === true;
  const RANK = { partial: 0, full: 1, none: 2 } as const;
  const usados = cov.rows.filter(enUso).sort((a, b) => RANK[a.status] - RANK[b.status] || a.value.localeCompare(b.value));
  const catalogoLibre = groups
    .map(g => ({ label: g.label, rows: g.values.map(v => byKey.get(coverageKey(v))).filter((r): r is CoverageRow => !!r && !enUso(r)) }))
    .filter(g => g.rows.length > 0);
  const libres = catalogoLibre.reduce((n, g) => n + g.rows.length, 0);
  const mostrarCatalogo = verCatalogo || !!q;
  const sections = [
    { label: 'En este proyecto', rows: usados },
    ...(mostrarCatalogo ? catalogoLibre : []),
  ].map(s => ({ ...s, rows: s.rows.filter(visible) })).filter(s => s.rows.length > 0);

  const updates = useMemo(() => planCoverageUpdates(tables, field, pending), [tables, field, pending]);

  const aplicar = async () => {
    setSaving(true);
    try {
      // Valores que quedan en TODAS las tablas tras aplicar = referencia del proyecto.
      const projectValues = cov.rows
        .filter(r => { const p = pending.get(coverageKey(r.value)); return p ? p.on : r.status === 'full'; })
        .map(r => r.value);
      await onApply(updates, projectValues);
      notify.success(`Se actualizaron ${updates.length} tabla(s)`);
      onClose();
    } catch {
      notify.error('No se pudieron aplicar los cambios');
    } finally { setSaving(false); }
  };

  const { title, noun } = TITLES[field];
  return (
    <Modal open={open} onClose={onClose} title={title} subtitle={project?.name} maxWidth="lg"
      footer={<>
        <span className="mr-auto text-xs text-slate-500">
          {pending.size === 0 ? 'Sin cambios' : `${pending.size} cambio(s) · ${updates.length} tabla(s) a modificar`}
        </span>
        <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button onClick={aplicar} disabled={saving || updates.length === 0} estado={saving ? 'guardando' : 'idle'}>Aplicar</Button>
      </>}>
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Buscar ${noun}...`} inputSize="sm" />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" checked={soloDiscrepancias} onChange={e => setSoloDiscrepancias(e.target.checked)} className="accent-teal-600" />
            Solo discrepancias
          </label>
          {cov.partialCount > 0 && (
            <Button size="sm" variant="secondary" onClick={igualar}>Resolver {cov.partialCount} por mayoría</Button>
          )}
        </div>

        <div className={`text-xs rounded-md px-3 py-2 ${cov.partialCount > 0 ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>
          {cov.partialCount > 0
            ? `${cov.partialCount === 1 ? `1 ${noun.replace(/s$/, '')} no está` : `${cov.partialCount} ${noun} no están`} en todas las tablas. "Resolver por mayoría" agrega los que tiene la mayoría y quita los que tienen pocas; podés ajustar uno por uno antes de aplicar.`
            : `Las ${cov.withList.length} tablas con lista tienen los mismos ${noun}.`}
          {cov.appliesToAll.length > 0 && cov.withList.length > 0 && (
            <span className="block mt-1 text-slate-600">
              {cov.appliesToAll.length} tabla(s) sin lista aplican a todos los {noun} y no se modifican desde acá.
            </span>
          )}
          {cov.withList.length === 0 && (
            <span className="block mt-1 text-slate-600">
              Hoy ninguna tabla tiene {noun} asignados: aplican a todos. Si tildás alguno, todas quedan restringidas a lo elegido.
            </span>
          )}
        </div>

        <div className="max-h-[52vh] overflow-y-auto pr-1 space-y-3">
          {sections.length === 0 && <p className="text-xs text-slate-400 py-6 text-center">Nada para mostrar con ese filtro.</p>}
          {sections.map(s => (
            <div key={s.label}>
              <p className="text-[10px] font-mono uppercase tracking-wide text-slate-400 mb-1">{s.label}</p>
              <div className="space-y-0.5">
                {s.rows.map(r => (
                  <CoverageRowItem key={r.value} row={r} total={total}
                    pending={pending.get(coverageKey(r.value))?.on} onToggle={() => toggle(r)} />
                ))}
              </div>
            </div>
          ))}
          {!mostrarCatalogo && libres > 0 && !soloDiscrepancias && (
            <button type="button" onClick={() => setVerCatalogo(true)}
              className="text-xs font-medium text-teal-700 hover:text-teal-900">
              + Agregar otros {noun} del catálogo ({libres})
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
