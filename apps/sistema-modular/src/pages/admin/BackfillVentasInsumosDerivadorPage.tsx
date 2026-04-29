import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { leadsService, usuariosService } from '../../services/firebaseService';
import type { UsuarioAGS } from '@ags/shared';

type Result = Awaited<ReturnType<typeof leadsService.backfillVentasInsumosDerivador>>;

export default function BackfillVentasInsumosDerivadorPage() {
  const [running, setRunning] = useState(false);
  const [preview, setPreview] = useState<Result | null>(null);
  const [applied, setApplied] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioAGS[]>([]);

  useEffect(() => {
    usuariosService.getAll().then(setUsuarios).catch(() => {});
  }, []);

  const resolveName = (id: string): string => {
    const u = usuarios.find(x => x.id === id);
    return u?.displayName || u?.email || id;
  };

  const runPreview = async () => {
    setRunning(true);
    setError(null);
    setApplied(null);
    setPreview(null);
    try {
      const res = await leadsService.backfillVentasInsumosDerivador({ dryRun: true });
      setPreview(res);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setRunning(false);
    }
  };

  const apply = async () => {
    if (!preview) return;
    if (!confirm(
      `Stampear ventasInsumosCreadoPor en ${preview.asignados} ticket(s). ` +
      'Idempotente (no toca tickets ya stampeados). ¿Continuar?'
    )) return;
    setRunning(true);
    setError(null);
    try {
      const res = await leadsService.backfillVentasInsumosDerivador({ dryRun: false });
      setApplied(res);
      setPreview(null);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setRunning(false);
    }
  };

  const result = applied || preview;
  const isPreview = !applied && !!preview;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-serif text-slate-800 mb-1">Backfill derivador venta de insumos</h1>
      <p className="text-xs text-slate-500 mb-6">
        Recorre tickets con <code className="bg-slate-100 px-1 rounded">motivoLlamado=ventas_insumos</code> y stamp{' '}
        <code className="bg-slate-100 px-1 rounded">ventasInsumosCreadoPor</code> vacío. Heurística: primera posta cuyo{' '}
        <code className="bg-slate-100 px-1 rounded">deUsuarioId</code> no sea el creador ni 'system' — esa persona suele ser quien
        reclasificó el motivo al derivar. Fallback al <code className="bg-slate-100 px-1 rounded">createdBy</code> (ticket nacido
        como venta de insumos). Idempotente. Existe porque el path <code className="bg-slate-100 px-1 rounded">derivar()</code> no
        stampeaba antes del fix; los tickets convertidos a venta de insumos vía derivación quedaron con derivador apuntando al
        creador en el reporte.
      </p>

      <Card>
        <div className="p-5 space-y-4">
          <div className="flex gap-2">
            <Button onClick={runPreview} disabled={running} variant="secondary">
              {running && !preview ? 'Procesando...' : 'Vista previa (dry-run)'}
            </Button>
            <Button onClick={apply} disabled={running || !preview || preview.asignados === 0}>
              {running && preview ? 'Aplicando...' : `Aplicar${preview ? ` (${preview.asignados})` : ''}`}
            </Button>
          </div>

          {result && (
            <div className="text-xs font-mono text-slate-700 bg-slate-50 border border-slate-200 rounded p-3 space-y-1">
              <div className="font-semibold text-slate-600">
                {isPreview ? 'Vista previa — sin cambios escritos' : 'Cambios aplicados'}
              </div>
              <div>Total tickets venta de insumos: {result.total}</div>
              <div>Ya stampeados (skip): {result.yaStampeados}</div>
              <div className="text-teal-700">{isPreview ? 'A asignar' : 'Asignados'}: {result.asignados}</div>
              {result.sinDatos > 0 && <div className="text-amber-700">Sin datos para resolver: {result.sinDatos}</div>}
            </div>
          )}

          {result && result.detalle.length > 0 && (
            <div className="text-xs">
              <div className="font-semibold text-slate-700 mb-2">
                Detalle ({result.detalle.length} ticket{result.detalle.length === 1 ? '' : 's'})
              </div>
              <div className="border border-slate-200 rounded overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-100 text-slate-600 font-mono text-[10px] uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-3 py-1.5">Número</th>
                      <th className="text-left px-3 py-1.5">Razón social</th>
                      <th className="text-left px-3 py-1.5">Derivador propuesto</th>
                      <th className="text-left px-3 py-1.5">Fuente</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700">
                    {result.detalle.map((t, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-3 py-1.5 font-mono">{t.numero}</td>
                        <td className="px-3 py-1.5 truncate max-w-[200px]">{t.razonSocial}</td>
                        <td className="px-3 py-1.5">{resolveName(t.derivadorId)}</td>
                        <td className="px-3 py-1.5">
                          <span className={
                            t.fuente === 'posta'
                              ? 'text-teal-700'
                              : 'text-amber-700'
                          }>
                            {t.fuente === 'posta' ? '1ª posta no-creador' : 'createdBy (fallback)'}
                          </span>
                        </td>
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
