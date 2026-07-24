import { useState } from 'react';
import type { QFSyncReport } from '@ags/shared';
import { tableCatalogService } from '../../services/catalogService';
import { qfDocumentosService } from '../../services/qfDocumentosService';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

const Stat = ({ n, label, color }: { n: number; label: string; color: string }) => (
  <div className="rounded-lg border border-slate-200 py-2">
    <div className={`text-lg font-semibold ${color}`}>{n}</div>
    <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
  </div>
);

const ListBlock = ({ title, items }: { title: string; items: string[] }) => (
  <div>
    <p className="text-[11px] font-mono uppercase tracking-wide text-slate-400 mb-1">{title} ({items.length})</p>
    <div className="flex flex-wrap gap-1">
      {items.map(n => <span key={n} className="text-[11px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{n}</span>)}
    </div>
  </div>
);

/**
 * Sincroniza Documentos QF desde la Biblioteca de tablas: lee los proyectos, parsea el
 * `footerQF` de cada carátula y crea/bumpea el QF correspondiente. Idempotente; no pisa
 * los datos editados a mano (solo crea faltantes y sube versiones). Muestra un reporte.
 */
export function SincronizarBibliotecaButton() {
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<QFSyncReport | null>(null);

  const run = async () => {
    setRunning(true);
    try {
      // El N° QF vive en la tabla de CARÁTULA (tableType 'cover'), partido en
      // coverQF / coverRevision / coverFecha — no en el proyecto.
      const tablas = await tableCatalogService.getAll();
      const items = tablas
        .filter(t => t.tableType === 'cover')
        .map(t => ({
          coverQF: t.coverQF,
          coverRevision: t.coverRevision,
          coverFecha: t.coverFecha,
          nombre: t.name,
          sistema: t.sysType,
        }));
      setReport(await qfDocumentosService.sincronizarDesdeBiblioteca(items));
    } catch (err) {
      console.error('[SincronizarBiblioteca]', err);
      alert('Error al sincronizar con la Biblioteca de tablas');
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={run} disabled={running}>
        {running ? 'Sincronizando…' : 'Sincronizar con Biblioteca'}
      </Button>
      {report && (
        <Modal open onClose={() => setReport(null)} maxWidth="sm"
          title="Sincronización con Biblioteca"
          subtitle="Desde el N° QF y la Revisión del pie de cada carátula"
          footer={<Button size="sm" onClick={() => setReport(null)}>Cerrar</Button>}>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat n={report.creados.length} label="Creados" color="text-teal-700" />
              <Stat n={report.actualizados.length} label="Actualizados" color="text-blue-700" />
              <Stat n={report.sinCambios} label="Sin cambios" color="text-slate-500" />
            </div>
            {report.creados.length > 0 && <ListBlock title="Nuevos" items={report.creados} />}
            {report.actualizados.length > 0 && <ListBlock title="Nueva versión" items={report.actualizados} />}
            {report.salteados.length > 0 && (
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wide text-amber-600 mb-1">Salteados ({report.salteados.length})</p>
                <div className="max-h-40 overflow-y-auto rounded-md border border-amber-100 bg-amber-50/50 divide-y divide-amber-100">
                  {report.salteados.map((s, i) => (
                    <div key={i} className="px-2 py-1 text-[11px] flex justify-between gap-2">
                      <span className="font-mono text-slate-600 truncate">{s.valor}</span>
                      <span className="text-amber-700 shrink-0">{s.motivo}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {report.creados.length === 0 && report.actualizados.length === 0 && report.salteados.length === 0 && (
              <p className="text-xs text-slate-400 text-center">Todo al día — nada para crear ni actualizar.</p>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
