import { useState } from 'react';
import type { Presupuesto, Sistema, ModuloSistema, WorkOrder } from '@ags/shared';
import { useOTVinculos, type PresupuestoVinculado } from '../../hooks/useOTVinculos';
import { misOTService, type MisOTDoc } from '../../services/misOTService';
import SolicitarPresupuestoModal from './SolicitarPresupuestoModal';
import { useKitIngeniero } from '../../hooks/useKitIngeniero';
import { EquipoCard, TareasPendientesCard, ConfiguracionCard } from './detalle/EquipoSection';
import { PresupuestoOCCard, MaterialesCard, ProblemaCard, FacturacionCard } from './detalle/VinculosSection';
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
  // Edición de un presupuesto en borrador desde el portal (2026-09-10): se
  // trae el documento completo (la tarjeta solo tiene número/estado) y se
  // abre el mismo modal del alta precargado.
  const [refreshKey, setRefreshKey] = useState(0);
  const [editando, setEditando] = useState<Presupuesto | null>(null);
  const { pendientes, presupuestos, materiales, reservas } = useOTVinculos(ot, refreshKey);
  const kit = useKitIngeniero(ot.ingenieroAsignadoId);

  const abrirEdicion = (p: PresupuestoVinculado) => {
    misOTService.getPresupuestoByNumero(p.numero)
      .then(pres => { if (pres) setEditando(pres); })
      .catch(err => console.error('[OTDetalleTab] presupuesto para editar:', err));
  };

  return (
    <div className="grid gap-3 lg:grid-cols-2 items-start">
      <div className="space-y-3">
        <EquipoCard ot={ot} sistema={sistema} />
        <TareasPendientesCard pendientes={pendientes} />
        <ProblemaCard ot={ot} />
      </div>
      <div className="space-y-3">
        <PresupuestoOCCard ot={ot} presupuestos={presupuestos} onEditar={abrirEdicion} />
        {/* Pegado a Presupuesto/OC: las dos responden "qué se le cobra al
            cliente por esto", y se leen juntas. */}
        <FacturacionCard ot={ot} />
        <MaterialesCard materiales={materiales} reservas={reservas} declarados={ot.materialesParaServicio} />
        <KitIngenieroCard items={kit.items} loading={kit.loading} />
      </div>
      <div className="lg:col-span-2">
        <ConfiguracionCard modulos={modulos} />
      </div>
      {editando && (
        <SolicitarPresupuestoModal
          open
          onClose={() => setEditando(null)}
          ot={ot as MisOTDoc}
          sistema={sistema}
          presupuesto={editando}
          onSaved={() => setRefreshKey(k => k + 1)}
        />
      )}
    </div>
  );
}
