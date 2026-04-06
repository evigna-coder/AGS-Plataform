import React from 'react';
import { useTabs } from '../../contexts/TabsContext';
import { Button } from '../ui/Button';
import type { Presupuesto } from '@ags/shared';
import { ESTADO_PRESUPUESTO_LABELS, ESTADO_PRESUPUESTO_COLORS } from '@ags/shared';

interface Props {
  presupuestoId: string;
  numero: string;
  estado: Presupuesto['estado'];
  clienteRazonSocial: string;
  saving: boolean;
  generatingPDF: boolean;
  deleting: boolean;
  onMinimize?: () => void;
  onClose: () => void;
  onPreviewPDF: () => void;
  onDownloadPDF: () => void;
  onEnviar: () => void;
  onDelete: () => void;
}

export const PresupuestoHeaderBar: React.FC<Props> = ({
  presupuestoId, numero, estado, clienteRazonSocial,
  saving, generatingPDF, deleting,
  onMinimize, onClose, onPreviewPDF, onDownloadPDF, onEnviar, onDelete,
}) => {
  const { navigateInActiveTab } = useTabs();

  return (
    <div className="-mx-5 -mt-4 px-5 pb-3 mb-4 border-b border-slate-100">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-slate-900 tracking-tight">{numero || 'Presupuesto'}</span>
          <span className="text-xs text-slate-400">·</span>
          <span className="text-xs text-slate-600 truncate max-w-[200px]">{clienteRazonSocial}</span>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_PRESUPUESTO_COLORS[estado]}`}>
            {ESTADO_PRESUPUESTO_LABELS[estado]}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {saving && <span className="text-[10px] text-slate-400">Guardando...</span>}
          {generatingPDF && <span className="text-[10px] text-teal-500">Generando PDF...</span>}
          {onMinimize && (
            <Button variant="ghost" size="sm" onClick={onMinimize} title="Minimizar">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
              </svg>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onPreviewPDF} disabled={generatingPDF} title="Vista previa PDF">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          </Button>
          <Button variant="ghost" size="sm" onClick={onDownloadPDF} disabled={generatingPDF} title="Descargar PDF">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          </Button>
          {estado !== 'anulado' && estado !== 'finalizado' && (
            <Button variant="outline" size="sm" onClick={onEnviar}>
              {estado === 'borrador' ? 'Enviar' : 'Reenviar'}
            </Button>
          )}
          {estado === 'aceptado' && (
            <Button variant="outline" size="sm" onClick={() => { onClose(); navigateInActiveTab(`/ordenes-trabajo/nuevo?presupuestoId=${presupuestoId}`); }}>Crear OT</Button>
          )}
          <Button variant="ghost" size="sm" onClick={onDelete} disabled={deleting} title="Eliminar presupuesto"
            className="text-red-400 hover:text-red-600 hover:bg-red-50">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </Button>
        </div>
      </div>
    </div>
  );
};
