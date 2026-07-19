import type { Sistema, ModuloSistema, WorkOrder } from '@ags/shared';
import { useOTVinculos } from '../../hooks/useOTVinculos';
import { useKitIngeniero } from '../../hooks/useKitIngeniero';
import { EquipoCard, TareasPendientesCard, ConfiguracionCard } from './detalle/EquipoSection';
import { PresupuestoOCCard, MaterialesCard, ProblemaCard } from './detalle/VinculosSection';
import { KitIngenieroCard } from './detalle/KitSection';

interface Props {
  ot: WorkOrder & { problemaFallaInicial?: string };
  sistema: Sistema | null;
  modulos: ModuloSistema[];
}

/**
 * Tab "Detalle" de la OT — rediseño mix A+B (mockup docs/design/mis-ot-mobile.html):
 * tarjetas globo #F8FAFC con filas label-mono | valor. En pantallas anchas usa la
 * grilla de 2 columnas de la variante A (Configuración a ancho completo).
 */
export default function OTDetalleTab({ ot, sistema, modulos }: Props) {
  const { pendientes, presupuestos, materiales, reservas } = useOTVinculos(ot);
  const kit = useKitIngeniero(ot.ingenieroAsignadoId);

  return (
    <div className="grid gap-3 lg:grid-cols-2 items-start">
      <div className="space-y-3">
        <EquipoCard ot={ot} sistema={sistema} />
        <TareasPendientesCard pendientes={pendientes} />
        <ProblemaCard ot={ot} />
      </div>
      <div className="space-y-3">
        <PresupuestoOCCard ot={ot} presupuestos={presupuestos} />
        <MaterialesCard materiales={materiales} reservas={reservas} declarados={ot.materialesParaServicio} />
        <KitIngenieroCard items={kit.items} loading={kit.loading} />
      </div>
      <div className="lg:col-span-2">
        <ConfiguracionCard modulos={modulos} />
      </div>
    </div>
  );
}
