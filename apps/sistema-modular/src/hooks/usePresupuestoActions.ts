import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { presupuestosService, leadsService } from '../services/firebaseService';
import { useAuth } from '../contexts/AuthContext';
import type { Presupuesto, Cliente, Establecimiento, CategoriaPresupuesto, CondicionPago, ContactoEstablecimiento, ContactoCliente, LeadEstado, PresupuestoSeccionesVisibles } from '@ags/shared';
import { MONEDA_SIMBOLO } from '@ags/shared';
import type { PresupuestoFormState, PresupuestoTotals } from './usePresupuestoEdit';

/** Presupuesto estados that should generate a posta on the lead timeline */
const LEAD_POSTA_MESSAGES: Partial<Record<Presupuesto['estado'], string>> = {
  enviado: 'Presupuesto enviado',
  aceptado: 'Presupuesto aceptado',
  autorizado: 'Presupuesto autorizado',
  rechazado: 'Presupuesto rechazado',
};

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
  const navigate = useNavigate();
  const { usuario } = useAuth();

  const [showRevision, setShowRevision] = useState(false);
  const [revisionHistory, setRevisionHistory] = useState<Presupuesto[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [showAdjuntos, setShowAdjuntos] = useState(false);
  const [showCondiciones, setShowCondiciones] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const addLeadPosta = useCallback((newEstado: Presupuesto['estado']) => {
    if (form.origenTipo !== 'lead' || !form.origenId || !usuario) return;
    const message = LEAD_POSTA_MESSAGES[newEstado];
    if (!message) return;
    const posta = {
      id: crypto.randomUUID(),
      fecha: new Date().toISOString(),
      deUsuarioId: usuario.id,
      deUsuarioNombre: usuario.displayName,
      aUsuarioId: usuario.id,
      aUsuarioNombre: usuario.displayName,
      comentario: `${message}: ${form.numero}`,
      estadoAnterior: form.estado as LeadEstado,
      estadoNuevo: form.estado as LeadEstado,
    };
    leadsService.agregarComentario(form.origenId, posta).catch(err =>
      console.error('Error agregando posta al lead:', err)
    );
  }, [form.origenTipo, form.origenId, form.numero, form.estado, usuario]);

  const handleEstadoChange = useCallback((newEstado: Presupuesto['estado']) => {
    rawEstadoChange(newEstado);
    addLeadPosta(newEstado);
  }, [rawEstadoChange, addLeadPosta]);

  const sym = MONEDA_SIMBOLO[form.moneda] || '$';
  const fmtMoney = (n: number) => `${sym} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

  const handleSave = async () => {
    await save();
    onUpdated?.();
  };

  const handleRevisionCreated = (newId: string) => {
    setShowRevision(false);
    onClose();
    onUpdated?.();
    navigate(`/presupuestos/${newId}`);
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

  const handleSuggestAutorizado = () => {
    if (form.estado !== 'autorizado' && confirm('Se adjuntó una orden de compra. ¿Cambiar estado a "Autorizado"?')) {
      handleEstadoChange('autorizado');
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
    if (!confirm(`¿Eliminar permanentemente ${form.numero}? Esta acción no se puede deshacer.`)) return;
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
    // Handlers
    handleEstadoChange,
    handleSave, handleEnviar, handleDelete,
    handleDownloadPDF, handlePreviewPDF,
    handleRevisionCreated, loadRevisionHistory,
    handleSuggestAutorizado,
    handleSeccionToggle, handleCondicionValueChange,
    // Helpers
    fmtMoney,
  };
}
