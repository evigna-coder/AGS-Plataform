import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { RemitoServicioModal } from '../remitos/RemitoServicioModal';
import { useEditOTForm } from '../../hooks/useEditOTForm';
import { OT_ESTADO_LABELS } from '@ags/shared';
import { EditOTEstadoBar } from './EditOTEstadoBar';
import { EditOTFormFields } from './EditOTFormFields';
import { EditOTCierreTabs } from './EditOTCierreTabs';
import { OTHistorialEstados } from './OTHistorialEstados';

interface Props {
  open: boolean;
  otNumber: string;
  onClose: () => void;
  onSaved: () => void;
}

export const EditOTModal: React.FC<Props> = ({ open, otNumber, onClose, onSaved }) => {
  const h = useEditOTForm(open, otNumber, onClose, onSaved);
  // Remito de servicio desde acá (2026-08-12): antes solo estaba en la página de
  // detalle de la OT, a la que el listado no lleva — el botón quedaba invisible.
  // El remito se arma por EQUIPO y consolida las OTs de ese equipo; esta OT solo
  // aporta el contexto de arranque (cliente + equipo).
  const [showRemitoServicio, setShowRemitoServicio] = useState(false);
  const sistemaSel = h.sistemasFiltrados.find(s => s.id === h.form.sistemaId);

  const showCierreAdmin =
    h.form.estadoAdmin === 'CIERRE_ADMINISTRATIVO' || h.form.estadoAdmin === 'FINALIZADO';

  // En modo cierre el título recuerda qué OT se está cerrando:
  // "OT-30108.01 · Calificación de operación · PRUEBAS AGS" (UAT 2026-07-20).
  const title = showCierreAdmin && !h.loading
    ? [`OT-${otNumber}`, h.form.tipoServicio, h.otOriginal?.razonSocial].filter(Boolean).join(' · ')
    : `OT-${otNumber}`;

  return (
    <>
    <Modal open={open} onClose={onClose} maxWidth="xl"
      title={title}
      subtitle={h.loading ? 'Cargando...' : `${OT_ESTADO_LABELS[h.form.estadoAdmin] ?? h.form.estadoAdmin}`}
      footer={<>
        <Button variant="outline" size="sm" onClick={h.openInReportesOT}>Abrir reporte</Button>
        {/* Deshabilitado —no oculto— sin equipo: el remito de servicio se arma
            por equipo, y esconder el botón deja al usuario buscándolo. */}
        <Button
          variant="outline" size="sm"
          onClick={() => setShowRemitoServicio(true)}
          disabled={h.loading || !h.form.sistemaId}
          title={h.form.sistemaId
            ? 'Remito de servicio del equipo — permite juntar varias OTs en un mismo remito'
            : 'La OT no tiene equipo cargado: el remito de servicio se arma por equipo'}
        >
          Remito servicio
        </Button>
        {h.form.estadoAdmin === 'CIERRE_TECNICO' && !h.readOnly && (
          <Button
            size="sm"
            onClick={h.handleCierreAdminTransition}
            className="bg-cyan-600 hover:bg-cyan-700 text-white"
            disabled={h.loading || h.saving}
          >
            {h.saving ? 'Procesando...' : '→ Cierre administrativo'}
          </Button>
        )}
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
        {!showCierreAdmin && (
          <Button size="sm" onClick={h.handleSave} disabled={h.saving || h.loading || h.readOnly}>
            {h.saving ? 'Guardando...' : 'Guardar'}
          </Button>
        )}
        {showCierreAdmin && h.form.estadoAdmin !== 'FINALIZADO' && (
          <Button size="sm" onClick={h.handleSave} disabled={h.saving || h.loading}>
            {h.saving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        )}
      </>}>

      {h.loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-slate-400 text-sm">Cargando orden de trabajo...</p>
        </div>
      ) : showCierreAdmin ? (
        <EditOTCierreTabs h={h} otNumber={otNumber} />
      ) : (
        <div className="space-y-3">
          <EditOTEstadoBar form={h.form} set={h.set} readOnly={h.readOnly} />
          {/* OT sobre módulo AGS: chip con link al loaner */}
          {h.otOriginal?.loanerCodigo && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-2 py-0.5">
                Módulo AGS
              </span>
              {h.otOriginal.loanerId ? (
                <Link to={`/loaners/${h.otOriginal.loanerId}`} onClick={onClose}
                  className="text-xs font-semibold text-teal-700 hover:underline">
                  Loaner {h.otOriginal.loanerCodigo} →
                </Link>
              ) : (
                <span className="text-xs font-semibold text-slate-600">Loaner {h.otOriginal.loanerCodigo}</span>
              )}
            </div>
          )}
          <EditOTFormFields
            form={h.form} set={h.set} readOnly={h.readOnly}
            tiposServicio={h.tiposServicio} clientes={h.clientes}
            sistemasFiltrados={h.sistemasFiltrados} modulos={h.modulos}
            contactos={h.contactos} ingenieros={h.ingenieros}
            presupuestosCliente={h.presupuestosCliente}
            establecimientosFiltrados={h.establecimientosFiltrados}
            onClienteChange={h.selectCliente}
            onPresupuestoChange={h.handlePresupuestoChange}
          />
          <OTHistorialEstados historial={h.otOriginal?.estadoHistorial} />
        </div>
      )}
    </Modal>

    <RemitoServicioModal
      open={showRemitoServicio}
      onClose={() => setShowRemitoServicio(false)}
      onCreated={() => setShowRemitoServicio(false)}
      prefill={{
        clienteId: h.form.clienteId || undefined,
        clienteNombre: h.otOriginal?.razonSocial,
        establecimientoId: h.form.establecimientoId || undefined,
        sistemaId: h.form.sistemaId || undefined,
        sistemaNombre: sistemaSel?.nombre,
        sistemaCodigoInterno: h.otOriginal?.codigoInternoCliente
          || sistemaSel?.codigoInternoCliente
          || undefined,
      }}
    />
    </>
  );
};
