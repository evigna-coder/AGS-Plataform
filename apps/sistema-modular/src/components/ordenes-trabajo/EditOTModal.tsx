import { Link } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
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

  const showCierreAdmin =
    h.form.estadoAdmin === 'CIERRE_ADMINISTRATIVO' || h.form.estadoAdmin === 'FINALIZADO';

  // En modo cierre el título recuerda qué OT se está cerrando:
  // "OT-30108.01 · Calificación de operación · PRUEBAS AGS" (UAT 2026-07-20).
  const title = showCierreAdmin && !h.loading
    ? [`OT-${otNumber}`, h.form.tipoServicio, h.otOriginal?.razonSocial].filter(Boolean).join(' · ')
    : `OT-${otNumber}`;

  return (
    <Modal open={open} onClose={onClose} maxWidth="xl"
      title={title}
      subtitle={h.loading ? 'Cargando...' : `${OT_ESTADO_LABELS[h.form.estadoAdmin] ?? h.form.estadoAdmin}`}
      footer={<>
        <Button variant="outline" size="sm" onClick={h.openInReportesOT}>Abrir reporte</Button>
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
          />
          <OTHistorialEstados historial={h.otOriginal?.estadoHistorial} />
        </div>
      )}
    </Modal>
  );
};
