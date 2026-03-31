import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ordenesTrabajoService, fichasService, leadsService } from '../services/firebaseService';
import type { WorkOrder, Cliente } from '@ags/shared';
import type { OTFormState } from './useOTFormState';

interface UseOTActionsParams {
  otNumber?: string;
  form: OTFormState;
  cliente: Cliente | null;
  setField: <K extends keyof OTFormState>(field: K, value: OTFormState[K]) => void;
  markInteracted: () => void;
  setItems: (items: WorkOrder[]) => void;
}

export function useOTActions({ otNumber, form, cliente, setField, markInteracted, setItems }: UseOTActionsParams) {
  const navigate = useNavigate();

  // New item modal
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [newItemData, setNewItemData] = useState({
    necesitaPresupuesto: false, clienteConfiable: false, tieneContrato: false, tipoServicio: '', descripcion: '',
  });

  // Create lead state
  const [creatingLead, setCreatingLead] = useState(false);

  // ---- External actions ----
  const openInReportesOT = useCallback((otNum?: string) => {
    const n = otNum || otNumber;
    if (!n) return;
    const url = `http://localhost:3000?reportId=${n}`;
    if ((window as any).electronAPI?.openWindow) (window as any).electronAPI.openWindow(url);
    else if ((window as any).electronAPI?.openExternal) (window as any).electronAPI.openExternal(url);
    else window.open(url, '_blank');
  }, [otNumber]);

  // ---- Status change with ficha sync ----
  const handleStatusChange = useCallback(async (val: string) => {
    const newStatus = val as 'BORRADOR' | 'FINALIZADO';
    setField('status', newStatus);
    markInteracted();

    if (newStatus === 'FINALIZADO' && otNumber) {
      try {
        const fichas = await fichasService.getByOtNumber(otNumber);
        for (const ficha of fichas) {
          if (ficha.estado === 'entregado') continue;
          await fichasService.addHistorial(ficha.id, {
            fecha: new Date().toISOString(), estadoAnterior: ficha.estado, estadoNuevo: ficha.estado,
            nota: `OT ${otNumber} finalizada`, otNumber,
            reporteTecnico: form.reporteTecnico || null, creadoPor: 'admin',
          });
        }
      } catch (err) { console.error('Error actualizando fichas vinculadas:', err); }
    }
  }, [otNumber, form.reporteTecnico, setField, markInteracted]);

  // ---- Create new item ----
  const handleCreateNewItem = useCallback(async () => {
    if (!otNumber || !cliente) { alert('Error: No se puede crear item sin OT padre o cliente'); return; }
    if (!newItemData.tipoServicio.trim()) { alert('El tipo de servicio es obligatorio'); return; }
    try {
      const nextNum = await ordenesTrabajoService.getNextItemNumber(otNumber);
      await ordenesTrabajoService.create({
        otNumber: nextNum, status: 'BORRADOR', budgets: [],
        tipoServicio: newItemData.tipoServicio,
        esFacturable: newItemData.necesitaPresupuesto,
        tieneContrato: newItemData.tieneContrato || cliente?.tipoServicio === 'contrato',
        esGarantia: false, razonSocial: form.razonSocial, contacto: form.contacto,
        direccion: form.direccion, localidad: form.localidad, provincia: form.provincia,
        sistema: form.sistemaNombre, moduloModelo: form.moduloModelo,
        moduloDescripcion: form.moduloDescripcion, moduloSerie: form.moduloSerie,
        codigoInternoCliente: form.codigoInternoCliente,
        fechaInicio: new Date().toISOString().split('T')[0],
        fechaFin: new Date().toISOString().split('T')[0],
        horasTrabajadas: '', tiempoViaje: '',
        reporteTecnico: newItemData.descripcion || '', accionesTomar: '', articulos: [],
        emailPrincipal: form.emailPrincipal || '',
        signatureEngineer: null, aclaracionEspecialista: '',
        signatureClient: null, aclaracionCliente: form.aclaracionCliente || '',
        materialesParaServicio: form.materialesParaServicio || '',
        problemaFallaInicial: form.problemaFallaInicial || '',
        updatedAt: new Date().toISOString(),
        clienteId: form.clienteId || null, sistemaId: form.sistemaId || null,
        moduloId: form.moduloId || null,
      } as any);
      alert(`Item ${nextNum} creado exitosamente`);
      setShowNewItemModal(false);
      setNewItemData({ necesitaPresupuesto: false, clienteConfiable: false, tieneContrato: false, tipoServicio: '', descripcion: '' });
      if (otNumber && !otNumber.includes('.')) {
        setItems(await ordenesTrabajoService.getItemsByOtPadre(otNumber));
      }
    } catch { alert('Error al crear el item'); }
  }, [otNumber, cliente, newItemData, form, setItems]);

  // ---- Create lead from OT ----
  const handleCreateLeadFromOT = useCallback(async () => {
    if (!otNumber) return;
    try {
      setCreatingLead(true);
      const leadId = await leadsService.create({
        clienteId: form.clienteId || null,
        contactoId: null,
        razonSocial: form.razonSocial || '',
        contacto: form.contacto || '',
        email: form.emailPrincipal || '',
        telefono: '',
        motivoLlamado: 'ventas_equipos',
        motivoContacto: `Presupuesto pendiente — generado desde OT-${otNumber}`,
        descripcion: `Presupuesto pendiente para ${form.razonSocial || 'cliente'} originado en OT-${otNumber}. Sistema: ${form.sistemaNombre || 'N/A'}. Tipo de servicio: ${form.tipoServicio || 'N/A'}.`,
        sistemaId: form.sistemaId || null,
        moduloId: form.moduloId || null,
        estado: 'en_presupuesto',
        postas: [],
        asignadoA: null,
        asignadoNombre: null,
        derivadoPor: null,
        areaActual: 'ventas',
        accionPendiente: 'Generar presupuesto',
        presupuestosIds: [],
        otIds: [otNumber],
        adjuntos: [],
        prioridad: 'media',
        proximoContacto: null,
        valorEstimado: null,
        finalizadoAt: null,
      });

      await leadsService.linkOT(leadId, otNumber);
      setField('leadId', leadId);
      markInteracted();
      alert(`Lead creado exitosamente. Se vinculo a la OT-${otNumber}.`);
      navigate(`/leads/${leadId}`);
    } catch (err) {
      console.error('Error creando lead desde OT:', err);
      alert('Error al crear el lead');
    } finally {
      setCreatingLead(false);
    }
  }, [otNumber, form, setField, markInteracted, navigate]);

  return {
    openInReportesOT, handleStatusChange,
    showNewItemModal, setShowNewItemModal, newItemData, setNewItemData, handleCreateNewItem,
    handleCreateLeadFromOT, creatingLead,
  };
}
