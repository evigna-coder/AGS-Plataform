import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ordenesTrabajoService, fichasService, leadsService, presupuestosService } from '../services/firebaseService';
import { presupuestosVivosDeHermanas } from '../utils/presupuestosVivosOT';
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
      const ahoraIso = new Date().toISOString();
      // El item HEREDA el establecimiento de la OT (2026-08-09). El payload
      // copiaba clienteId/sistemaId/moduloId pero NO establecimientoId, asi que
      // cada item creado con "+ Item" nacia sin establecimiento. De ese campo
      // depende la marca de INTERIOR de la agenda: la OT 30019.02 quedaba en
      // `tentativo` mientras sus hermanas del mismo cliente iban a interior.
      const otActual = await ordenesTrabajoService.getByOtNumber(otNumber).catch(() => null);

      // Los presupuestos VIVOS del trabajo acompañan al item nuevo (2026-08-08).
      // El ppto nace en un item (ej. el .02, pedido de partes desde el portal) y
      // el trabajo sigue por la importación, la instalación y las pruebas: recién
      // se factura varios items después. Antes el item nuevo nacía con
      // `budgets: []` y había que re-vincularlo a mano en cada uno — si alguien
      // se olvidaba, el ppto quedaba colgado en el item que ya se cerró.
      let budgetsHeredados: string[] = [];
      try {
        const padre = otNumber.split('.')[0];
        const [hermanas, presupuestos] = await Promise.all([
          ordenesTrabajoService.getItemsByOtPadre(padre),
          presupuestosService.getAll(),
        ]);
        budgetsHeredados = presupuestosVivosDeHermanas(hermanas, presupuestos);
      } catch (err) {
        // Best-effort: sin el arrastre el item se crea igual y se vincula a mano.
        console.warn('[handleCreateNewItem] no se pudieron heredar presupuestos:', err);
      }

      await ordenesTrabajoService.create({
        otNumber: nextNum, status: 'BORRADOR', budgets: budgetsHeredados,
        // Estado inicial explícito (2026-08-06): sin esto el item quedaba sin
        // estadoAdmin en Firestore (los filtros por estado no lo veían).
        estadoAdmin: 'CREADA', estadoAdminFecha: ahoraIso,
        estadoHistorial: [{ estado: 'CREADA', fecha: ahoraIso }],
        tipoServicio: newItemData.tipoServicio,
        esFacturable: newItemData.necesitaPresupuesto,
        tieneContrato: newItemData.tieneContrato || cliente?.tipoServicio === 'contrato',
        // Hereda la GARANTIA del trabajo: estaba hardcodeado en false y no hay
        // campo en el modal, asi que un item de una OT en garantia nacia facturable.
        esGarantia: otActual?.esGarantia ?? false,
        razonSocial: form.razonSocial, contacto: form.contacto,
        sector: form.sector,
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
        // ── Contexto que el item HEREDA del trabajo (2026-08-09) ──────────────
        // El payload copiaba cliente/sistema/modulo y nada mas: cada item creado
        // con "+ Item" nacia sin establecimiento (rompia la marca de INTERIOR de
        // la agenda y el domicilio de entrega de los remitos), sin contrato, sin
        // OC del cliente y desvinculado del ticket de origen.
        establecimientoId: otActual?.establecimientoId || null,
        tipoOT: otActual?.tipoOT ?? 'servicio',
        contratoId: otActual?.contratoId ?? null,
        loanerId: otActual?.loanerId ?? null,
        leadId: otActual?.leadId ?? null,
        presupuestoOrigenId: otActual?.presupuestoOrigenId ?? null,
        ordenCompra: otActual?.ordenCompra ?? null,
        ordenesCompra: otActual?.ordenesCompra ?? [],
        moduloMarca: otActual?.moduloMarca ?? null,
      } as any);

      // El item nuevo pasa a ser la OT activa del presupuesto; los anteriores
      // conservan la referencia (la OT siempre muestra a qué ppto corresponde).
      if (budgetsHeredados.length > 0) {
        await ordenesTrabajoService.vincularPresupuestosAlItem(budgetsHeredados, nextNum)
          .catch(err => console.error('[handleCreateNewItem] vincular presupuestos falló:', err));
      }

      alert(budgetsHeredados.length > 0
        ? `Item ${nextNum} creado con los presupuestos del trabajo: ${budgetsHeredados.join(', ')}`
        : `Item ${nextNum} creado exitosamente`);
      setShowNewItemModal(false);
      setNewItemData({ necesitaPresupuesto: false, clienteConfiable: false, tieneContrato: false, tipoServicio: '', descripcion: '' });
      if (otNumber && !otNumber.includes('.')) {
        setItems(await ordenesTrabajoService.getItemsByOtPadre(otNumber));
      }
    } catch (err) {
      console.error('Error creando item OT:', err);
      alert(err instanceof Error ? err.message : 'Error al crear el item');
    }
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
        estado: 'presupuesto_pendiente',
        postas: [],
        asignadoA: null,
        asignadoNombre: null,
        derivadoPor: null,
        areaActual: 'ventas',
        accionPendiente: 'Generar presupuesto',
        presupuestosIds: [],
        otIds: [otNumber],
        adjuntos: [],
        prioridad: 'normal',
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
