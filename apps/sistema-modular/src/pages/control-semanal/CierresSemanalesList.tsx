import { useEffect, useState } from 'react';
import type { CierreSemanal } from '@ags/shared';
import { cierreSemanalService } from '../../services/cierreSemanalService';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import { useDeclareParent } from '../../hooks/useDeclareParent';
import { abrirPdfCierre, generarPdfCierreSemanal, nombreArchivoCierre } from '../../utils/cierreSemanalPdf';
import { abrirVentanaParaPdf } from '../../utils/ventanaPdf';
import { notify } from '../../utils/notify';

const fecha = (iso: string) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');
const th = 'px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';

/**
 * Cierres semanales congelados (2026-09-09): la foto de cada semana y su PDF,
 * para dirección. El PDF se abre regenerándolo de la foto guardada, así no
 * depende del token de Storage ni de la PC que lo generó.
 */
export function CierresSemanalesList() {
  useDeclareParent('/control-semanal');
  const goBack = useNavigateBack();
  const [cierres, setCierres] = useState<CierreSemanal[]>([]);
  const [loading, setLoading] = useState(true);
  const [abriendo, setAbriendo] = useState<string | null>(null);

  useEffect(() => {
    cierreSemanalService.getAll().then(setCierres).catch(err => {
      console.error('[CierresSemanalesList]', err); notify.error('No se pudieron cargar los cierres');
    }).finally(() => setLoading(false));
  }, []);

  const abrir = async (c: CierreSemanal) => {
    const ventana = window.electronAPI?.saveTempAndOpen ? null : abrirVentanaParaPdf(nombreArchivoCierre(c.semanaInicio));
    setAbriendo(c.id);
    try {
      const blob = await generarPdfCierreSemanal(c);
      await abrirPdfCierre(blob, nombreArchivoCierre(c.semanaInicio), ventana);
    } catch (err) {
      ventana?.close();
      notify.error(err instanceof Error ? err.message : 'No se pudo abrir el PDF');
    } finally { setAbriendo(null); }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader title="Cierres semanales" subtitle="Fotos congeladas del control semanal, una por semana (lunes a domingo)"
        actions={<Button size="sm" variant="secondary" onClick={() => goBack()}>Volver al control</Button>} />
      <div className="flex-1 min-h-0 overflow-auto p-5">
        {loading ? <LoadingState message="Cargando cierres…" /> : cierres.length === 0 ? (
          <EmptyState message="Todavía no hay cierres congelados" hint="Se generan solos el miércoles al abrir el control semanal, o con el botón Congelar semana." />
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200"><tr>
                <th className={th}>Semana</th><th className={th}>Generado</th><th className={th}>Por</th>
                <th className={`${th} text-right`}>OTs</th><th className={`${th} text-right`}>Sin realizar</th>
                <th className={`${th} text-right`}>Sin cierre admin</th><th className={`${th} text-right`}>Listos sin aviso</th>
                <th className={`${th} text-right`}>Sin facturar</th><th className={th}></th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {cierres.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-xs font-medium text-slate-800 whitespace-nowrap">{fecha(c.semanaInicio)} al {fecha(c.semanaFin)}</td>
                    <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{fecha(c.generadoAt)}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{c.generadoPorNombre || '—'}</td>
                    <td className="px-3 py-2 text-xs text-right tabular-nums">{c.resumen.agendadas}</td>
                    <td className={`px-3 py-2 text-xs text-right tabular-nums ${c.resumen.sinRealizar ? 'text-red-600 font-semibold' : ''}`}>{c.resumen.sinRealizar}</td>
                    <td className={`px-3 py-2 text-xs text-right tabular-nums ${c.resumen.sinCierreAdmin ? 'text-amber-600 font-semibold' : ''}`}>{c.resumen.sinCierreAdmin}</td>
                    <td className="px-3 py-2 text-xs text-right tabular-nums">{c.resumen.listosSinAviso}</td>
                    <td className="px-3 py-2 text-xs text-right tabular-nums">{c.resumen.sinFacturar}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <Button size="sm" variant="outline" onClick={() => void abrir(c)} disabled={abriendo === c.id}>
                        {abriendo === c.id ? 'Abriendo…' : 'Ver PDF'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
