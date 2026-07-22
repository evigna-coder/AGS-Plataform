import { useState } from 'react';
import type { useEditOTForm } from '../../hooks/useEditOTForm';
import { EditOTEstadoBar } from './EditOTEstadoBar';
import { EditOTFormFields } from './EditOTFormFields';
import { OTCierreAdminSection } from './OTCierreAdminSection';
import { CierrePDFPreview } from './CierrePDFPreview';
import { OTHistorialEstados } from './OTHistorialEstados';

type TabId = 'cierre' | 'reporte' | 'datos';

const TABS: { id: TabId; label: string }[] = [
  { id: 'cierre', label: 'Cierre' },
  { id: 'reporte', label: 'Reporte y adjuntos' },
  { id: 'datos', label: 'Datos de la OT' },
];

interface Props {
  h: ReturnType<typeof useEditOTForm>;
  otNumber: string;
}

/**
 * Cuerpo del EditOTModal en modo CIERRE ADMINISTRATIVO / FINALIZADO
 * (UAT 2026-07-20: el cierre arrancaba al fondo de una hoja larguísima).
 *
 * - "Cierre" (default): OTCierreAdminSection sin el preview de PDF.
 * - "Reporte y adjuntos": CierrePDFPreview (reporte técnico + anexar documentos).
 *   Se monta LAZY la primera vez que se abre la pestaña — recién ahí corren
 *   resolveReportePdf y la lectura de documentosAdicionales — y después queda
 *   montado (hidden) para no re-consultar al volver.
 * - "Datos de la OT": el formulario completo de la OT, editable igual que antes
 *   (presupuesto/OC/contacto se corrigen durante el cierre).
 *
 * Las pestañas Cierre y Datos quedan siempre montadas (hidden vía CSS): el estado
 * vive en useEditOTForm y desmontarlas re-dispararía los fetch de subcomponentes
 * (patrones consumidos, wizard de facturación).
 */
export const EditOTCierreTabs: React.FC<Props> = ({ h, otNumber }) => {
  const [tab, setTab] = useState<TabId>('cierre');
  const [reporteMounted, setReporteMounted] = useState(false);

  const activate = (t: TabId) => {
    if (t === 'reporte') setReporteMounted(true);
    setTab(t);
  };

  const tabCls = (t: TabId) =>
    `px-4 py-2 text-xs font-mono font-medium uppercase tracking-wider border-b-2 transition-colors ${
      tab === t
        ? 'border-teal-600 text-teal-700'
        : 'border-transparent text-slate-400 hover:text-slate-600'
    }`;

  return (
    <div className="space-y-3">
      <div className="flex border-b border-slate-200">
        {TABS.map(t => (
          <button key={t.id} type="button" className={tabCls(t.id)} onClick={() => activate(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Cierre ── */}
      <div className={tab === 'cierre' ? 'space-y-3' : 'hidden'}>
        <OTCierreAdminSection
          cierreAdmin={h.form.cierreAdmin}
          onChange={h.handleCierreChange}
          onConfirmarCierre={h.handleConfirmarCierre}
          onReabrirOT={h.handleReabrirOT}
          horasTrabajadas={h.form.horasTrabajadas}
          tiempoViaje={h.form.tiempoViaje}
          articulos={h.form.articulos}
          readOnly={h.readOnly}
          estadoAdmin={h.form.estadoAdmin}
          razonSocial={h.otOriginal?.razonSocial}
          tipoServicio={h.form.tipoServicio}
          ingenieroNombre={h.otOriginal?.ingenieroAsignadoNombre}
          otNumber={otNumber}
          budgets={h.otOriginal?.budgets}
          clienteId={h.form.clienteId}
          clienteNombre={h.otOriginal?.razonSocial}
          patronesSeleccionados={h.form.patronesSeleccionados}
          hidePdfPreview
          onAddPart={prefill => h.set('articulos', [...h.form.articulos, {
            id: `part-${Date.now()}`, codigo: prefill?.codigo || '', descripcion: prefill?.descripcion || '',
            cantidad: 1, origen: prefill ? 'stock' : '',
          }])}
          onUpdatePart={(id, field, value) => h.set('articulos',
            h.form.articulos.map(p => p.id === id ? { ...p, [field]: value } : p))}
          onRemovePart={id => h.set('articulos', h.form.articulos.filter(p => p.id !== id))}
        />
      </div>

      {/* ── Reporte y adjuntos (lazy) ── */}
      <div className={tab === 'reporte' ? '' : 'hidden'}>
        {reporteMounted && <CierrePDFPreview otNumber={otNumber} />}
      </div>

      {/* ── Datos de la OT ── */}
      <div className={tab === 'datos' ? 'space-y-3' : 'hidden'}>
        <EditOTEstadoBar form={h.form} set={h.set} readOnly={h.readOnly} />
        <EditOTFormFields
          form={h.form} set={h.set} readOnly={h.readOnly}
          tiposServicio={h.tiposServicio} clientes={h.clientes}
          sistemasFiltrados={h.sistemasFiltrados} modulos={h.modulos}
          contactos={h.contactos} ingenieros={h.ingenieros}
          presupuestosCliente={h.presupuestosCliente}
        />
        <OTHistorialEstados historial={h.otOriginal?.estadoHistorial} />
      </div>
    </div>
  );
};
