import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useEditOTForm } from '../../hooks/useEditOTForm';
import { OT_ESTADO_LABELS } from '@ags/shared';
import { EditOTEstadoBar } from './EditOTEstadoBar';
import { EditOTFormFields } from './EditOTFormFields';

interface Props {
  open: boolean;
  otNumber: string;
  onClose: () => void;
  onSaved: () => void;
}

export const EditOTModal: React.FC<Props> = ({ open, otNumber, onClose, onSaved }) => {
  const h = useEditOTForm(open, otNumber, onClose, onSaved);

  return (
    <Modal open={open} onClose={onClose} maxWidth="lg"
      title={`OT-${otNumber}`}
      subtitle={h.loading ? 'Cargando...' : `${OT_ESTADO_LABELS[h.form.estadoAdmin] ?? h.form.estadoAdmin}`}
      footer={<>
        <Button variant="outline" size="sm" onClick={h.openInReportesOT}>Abrir reporte</Button>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
        <Button size="sm" onClick={h.handleSave} disabled={h.saving || h.loading || h.readOnly}>
          {h.saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </>}>

      {h.loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-slate-400 text-sm">Cargando orden de trabajo...</p>
        </div>
      ) : (
        <div className="space-y-3">
          <EditOTEstadoBar form={h.form} set={h.set} readOnly={h.readOnly} />
          <EditOTFormFields
            form={h.form} set={h.set} readOnly={h.readOnly}
            tiposServicio={h.tiposServicio} clientes={h.clientes}
            sistemasFiltrados={h.sistemasFiltrados} modulos={h.modulos}
            contactos={h.contactos} ingenieros={h.ingenieros}
          />
          {/* Historial de estados */}
          {h.otOriginal?.estadoHistorial && h.otOriginal.estadoHistorial.length > 0 && (
            <div className="border-t border-slate-100 pt-2">
              <p className="text-[11px] font-medium text-slate-400 mb-1">Historial de estados</p>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                {h.otOriginal.estadoHistorial.map((hist, i) => (
                  <div key={i} className="text-[10px]">
                    <span className="text-slate-600 font-medium">{OT_ESTADO_LABELS[hist.estado] ?? hist.estado}</span>
                    <span className="text-slate-400 ml-1">{hist.fecha ? new Date(hist.fecha).toLocaleDateString('es-AR') : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
