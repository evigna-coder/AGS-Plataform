import { useOTList } from '../hooks/useOTList';
import { OTCard } from '../components/ordenes-trabajo/OTCard';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';

export default function ReportesPage() {
  const { ots, loading } = useOTList();
  const finalizados = ots.filter(ot => ot.status === 'FINALIZADO');

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Reportes de Servicio"
        subtitle={loading ? '...' : `${finalizados.length} reportes`}
      />
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : finalizados.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm font-medium text-slate-600">Sin reportes finalizados</p>
            <p className="text-xs text-slate-400 mt-1">Los reportes aparecen aquí una vez que se finalizan.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {finalizados.map(ot => <OTCard key={ot.otNumber} ot={ot} />)}
          </div>
        )}
      </div>
    </div>
  );
}
