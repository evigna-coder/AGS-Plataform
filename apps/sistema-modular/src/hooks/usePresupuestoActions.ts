import { useState, useCallback } from 'react';
import { useTabs } from '../contexts/TabsContext';
import { presupuestosService } from '../services/firebaseService';
import type { Presupuesto, Cliente, Establecimiento, CategoriaPresupuesto, CondicionPago, ContactoEstablecimiento, ContactoCliente, PresupuestoSeccionesVisibles } from '@ags/shared';
import { MONEDA_SIMBOLO } from '@ags/shared';
import type { PresupuestoFormState, PresupuestoTotals } from './usePresupuestoEdit';
import { useConfirm } from '../components/ui/ConfirmDialog';

// NOTE: Lead sync is now handled automatically by presupuestosService.update()
// via ticketsService.syncFromPresupuesto(). No manual posta needed here.

interface UsePresupuestoActionsParams {
  presupuestoId: string;
  form: PresupuestoFormState;
  setField: (key: keyof PresupuestoFormState, value: any) => void;
  rawEstadoChange: (estado: Presupuesto['estado']) => void;
  save: () => Promise<void>;
  calculateTotals: () => PresupuestoTotals;
  cliente: Cliente | null;
  establecimiento: Establecimiento | null;
  contactos: (ContactoCliente | ContactoEstablecimiento)[];
  condicionesPago: CondicionPago[];
  categoriasPresupuesto: CategoriaPresupuesto[];
  onClose: () => void;
  onUpdated?: () => void;
}

export function usePresupuestoActions({
  presupuestoId, form, setField, rawEstadoChange, save, calculateTotals,
  cliente, establecimiento, contactos, condicionesPago, categoriasPresupuesto,
  onClose, onUpdated,
}: UsePresupuestoActionsParams) {
  const confirm = useConfirm();
  const { navigateInActiveTab } = useTabs();

  const [showRevision, setShowRevision] = useState(false);
  const [revisionHistory, setRevisionHistory] = useState<Presupuesto[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [showAdjuntos, setShowAdjuntos] = useState(false);
  const [showCondiciones, setShowCondiciones] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showFacturacion, setShowFacturacion] = useState(false);

  // Lead sync happens automatically via presupuestosService.update() → syncFromPresupuesto()
  const handleEstadoChange = useCallback((newEstado: Presupuesto['estado']) => {
    rawEstadoChange(newEstado);
  }, [rawEstadoChange]);

  const sym = MONEDA_SIMBOLO[form.moneda] || '$';
  const fmtMoney = (n: number) => `${sym} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

  const handleSave = async () => {
    await save();
    onUpdated?.();
    onClose();
  };

  const handleRevisionCreated = (newId: string) => {
    setShowRevision(false);
    onClose();
    onUpdated?.();
    navigateInActiveTab(`/presupuestos/${newId}`);
  };

  const loadRevisionHistory = async () => {
    if (!form.numero) return;
    try {
      const history = await presupuestosService.getRevisionHistory(form.numero);
      setRevisionHistory(history);
      setShowHistory(true);
    } catch (e) {
      console.error('Error cargando historial:', e);
    }
  };

  const handleSuggestAutorizado = async () => {
    // Regla 2026-04-22: adjuntar OC = aceptación automática, sin confirmación.
    // El save del edit modal persiste el cambio; presupuestosService.update
    // delega a aceptarConRequerimientos al transicionar a aceptado.
    if (form.estado !== 'aceptado') {
      handleEstadoChange('aceptado');
    }
  };

  const handleEnviar = async () => {
    handleEstadoChange('enviado');
    await save();
    onUpdated?.();
    const contacto = contactos.find(c => c.id === form.contactoId);
    const email = contacto?.email;
    if (email) {
      const subject = encodeURIComponent(`Presupuesto ${form.numero} - AGS`);
      const body = encodeURIComponent(`Estimado/a ${contacto.nombre},\n\nAdjunto presupuesto ${form.numero} para su revisión.\n\nSaludos cordiales,\nAGS`);
      window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_self');
    }
  };

  const buildPDFParams = useCallback(() => {
    const condPago = condicionesPago.find(c => c.id === form.condicionPagoId) || null;
    const contacto = contactos.find(c => c.id === form.contactoId) || null;
    const totalsCalc = calculateTotals();
    const presupuestoData: Presupuesto = {
      id: presupuestoId,
      numero: form.numero,
      tipo: form.tipo,
      moneda: form.moneda,
      clienteId: form.clienteId,
      establecimientoId: form.establecimientoId,
      sistemaId: form.sistemaId,
      contactoId: form.contactoId,
      origenTipo: form.origenTipo as any,
      origenId: form.origenId,
      origenRef: form.origenRef,
      estado: form.estado,
      items: form.items,
      subtotal: totalsCalc.subtotal,
      total: totalsCalc.total,
      tipoCambio: form.tipoCambio,
      condicionPagoId: form.condicionPagoId,
      ordenesCompraIds: [],
      adjuntos: form.adjuntos,
      notasTecnicas: form.notasTecnicas || null,
      notasAdministrativas: form.notasAdministrativas || null,
      garantia: form.garantia || null,
      variacionTipoCambio: form.variacionTipoCambio || null,
      condicionesComerciales: form.condicionesComerciales || null,
      aceptacionPresupuesto: form.aceptacionPresupuesto || null,
      seccionesVisibles: form.seccionesVisibles,
      validezDias: form.validezDias,
      validUntil: form.validUntil,
      fechaEnvio: form.fechaEnvio,
      proximoContacto: form.proximoContacto || null,
      responsableId: form.responsableId || null,
      responsableNombre: form.responsableNombre || null,
      // Contrato (2026-08-04): estos campos faltaban y el PDF salía sin cuotas,
      // sin vigencia y con el flag de ocultar precios ignorado.
      cuotas: form.cuotas,
      cantidadCuotas: form.cantidadCuotas,
      cantidadCuotasPorMoneda: form.cantidadCuotasPorMoneda,
      contratoFechaInicio: form.contratoFechaInicio,
      contratoFechaFin: form.contratoFechaFin,
      ocultarPreciosItems: form.ocultarPreciosItems,
      notasComplementarias: form.notasComplementarias,
      createdAt: form.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return {
      presupuesto: presupuestoData,
      cliente,
      establecimiento,
      contacto: contacto as any,
      condicionPago: condPago,
      categorias: categoriasPresupuesto,
    };
  }, [form, presupuestoId, cliente, establecimiento, contactos, condicionesPago, categoriasPresupuesto, calculateTotals]);

  const handleDownloadPDF = async () => {
    setGeneratingPDF(true);
    try {
      const { downloadPresupuestoPDF } = await import('../components/presupuestos/pdf');
      await downloadPresupuestoPDF(buildPDFParams());
    } catch (err) {
      console.error('Error generando PDF:', err);
      alert('Error al generar el PDF');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handlePreviewPDF = async () => {
    setGeneratingPDF(true);
    try {
      const { previewPresupuestoPDF } = await import('../components/presupuestos/pdf');
      await previewPresupuestoPDF(buildPDFParams());
    } catch (err) {
      console.error('Error generando preview:', err);
      alert('Error al generar la vista previa');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleDelete = async () => {
    // Guard OTs vinculadas (2026-08-26, caso P1-005072-01): se eliminó un ppto
    // con 3 OTs vinculadas sin que nada lo señalara. Casi siempre es un error
    // — el aviso enumera las OTs y exige una confirmación consciente. Se lee
    // fresco del doc: el form puede no reflejar vínculos agregados después.
    //
    // 2026-08-31: el aviso también enumera lo que el delete hace con stock y
    // compras — antes pasaba en silencio y el residuo (req comprometido que
    // queda vivo) desorientaba. Todo best-effort: si una lectura falla, el
    // renglón no aparece pero el confirm sale igual.
    let otsVinculadas: string[] = [];
    let reqsComprometidos: { numero?: string | null; ordenCompraNumero?: string | null }[] = [];
    let reservadas = 0;
    try {
      const { requerimientosService } = await import('../services/importacionesService');
      const { reservasService } = await import('../services/stockService');
      const [fresh, reqs, reservas] = await Promise.all([
        presupuestosService.getById(presupuestoId),
        requerimientosService.getByPresupuesto(presupuestoId).catch(() => []),
        reservasService.getByPresupuesto(presupuestoId).catch(() => []),
      ]);
      otsVinculadas = fresh?.otsVinculadasNumbers ?? [];
      reqsComprometidos = reqs.filter(r => r.estado === 'en_compra' || r.estado === 'comprado');
      reservadas = reservas.reduce((acc, u) => acc + (u.cantidad ?? 1), 0);
    } catch { /* si no se puede leer, cae al confirm simple */ }
    const renglones: string[] = [];
    if (otsVinculadas.length > 0) {
      renglones.push(
        '⚠ Tiene ' + otsVinculadas.length + ' orden(es) de trabajo vinculada(s):\n'
        + otsVinculadas.map(n => '   • OT ' + n).join('\n')
        + '\nEliminarlo las deja sin presupuesto — en la mayoría de los casos esto es un error. '
        + 'Si lo que buscás es que no se facture, anulalo en lugar de eliminarlo.',
      );
    }
    if (reservadas > 0) {
      renglones.push(`⚠ Tiene ${reservadas} unidad(es) de stock reservada(s): se van a LIBERAR y la entrega pendiente desaparece de la cola.`);
    }
    if (reqsComprometidos.length > 0) {
      renglones.push(
        '⚠ Tiene compra(s) ya comprometida(s) que NO se eliminan (se administran desde su OC):\n'
        + reqsComprometidos.map(r => `   • ${r.numero ?? 'REQ'}${r.ordenCompraNumero ? ` — OC ${r.ordenCompraNumero}` : ''}`).join('\n'),
      );
    }
    const aviso = renglones.length > 0
      ? renglones.join('\n\n') + '\n\n¿Eliminar permanentemente ' + form.numero + ' igual? Esta acción no se puede deshacer.'
      : `¿Eliminar permanentemente ${form.numero}? Esta acción no se puede deshacer.`;
    if (!await confirm(aviso)) return;
    try {
      setDeleting(true);
      await presupuestosService.hardDelete(presupuestoId);
      onClose();
      onUpdated?.();
    } catch (err) {
      console.error('Error eliminando presupuesto:', err);
      alert('Error al eliminar el presupuesto');
    } finally {
      setDeleting(false);
    }
  };

  const handleSeccionToggle = (key: keyof PresupuestoSeccionesVisibles, visible: boolean) => {
    setField('seccionesVisibles', { ...form.seccionesVisibles, [key]: visible });
  };

  const handleCondicionValueChange = (key: keyof PresupuestoSeccionesVisibles, value: string) => {
    setField(key as any, value);
  };

  return {
    // State
    showRevision, setShowRevision,
    revisionHistory, showHistory, setShowHistory,
    deleting, generatingPDF,
    showAdjuntos, setShowAdjuntos,
    showCondiciones, setShowCondiciones,
    showFacturacion, setShowFacturacion,
    // Handlers
    handleEstadoChange,
    handleSave, handleEnviar, handleDelete,
    handleDownloadPDF, handlePreviewPDF,
    handleRevisionCreated, loadRevisionHistory,
    handleSuggestAutorizado,
    handleSeccionToggle, handleCondicionValueChange,
    // Helpers
    fmtMoney,
    buildPDFParams,
  };
}
