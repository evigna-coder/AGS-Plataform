import { useState } from 'react';
import { auth } from '../services/authService';
import { FirebaseService } from '../services/firebaseService';
import { Part } from '../types';
import { uid, incrementSuffix, findNextAvailableOT } from '../services/utils';
import { UseReportFormReturn } from './useReportForm';
import { createEmptyProtocolDataForTemplate } from '../data/sampleProtocol';
import { getProtocolTemplateForServiceType } from '../utils/protocolSelector';

export interface DuplicateOptions {
  copyClientEquipment: boolean;
  copyBudgets: boolean;
  copyObservations: boolean;
  copyReportTecnico: boolean;
  newOtSuffix: string;
}

export interface UseOTManagementReturn {
  // Funciones
  loadOT: (otValue: string) => Promise<void>;
  createNewOT: (otValue: string) => void;
  newReport: (showConfirmModal: (options: { title?: string; message: string; onConfirm: () => void; onCancel?: () => void; confirmText?: string; cancelText?: string; confirmType?: 'info' | 'warning' | 'error' | 'success' }) => Promise<boolean>) => Promise<void>;
  duplicateOT: (options: DuplicateOptions) => Promise<string>;
  
  // Estados de modales
  modals: {
    showNewOtModal: boolean;
    setShowNewOtModal: (show: boolean) => void;
    pendingOt: string;
    setPendingOt: (ot: string) => void;
  };
}


export const useOTManagement = (
  reportForm: UseReportFormReturn,
  firebase: FirebaseService,
  otInput: string
): UseOTManagementReturn => {
  const [showNewOtModal, setShowNewOtModal] = useState(false);
  const [pendingOt, setPendingOt] = useState<string>('');

  const {
    formState,
    setters,
    hasUserInteracted,
    hasInitialized
  } = reportForm;

  const {
    otNumber,
    budgets,
    tipoServicio,
    esFacturable,
    tieneContrato,
    esGarantia,
    razonSocial,
    contacto,
    direccion,
    localidad,
    provincia,
    sistema,
    moduloModelo,
    moduloDescripcion,
    moduloSerie,
    codigoInternoCliente,
    emailPrincipal,
    reporteTecnico,
    accionesTomar,
    articulos,
    protocolTemplateId,
    protocolData,
    protocolSelections
  } = formState;

  const {
    setOtNumber,
    setOtInput,
    setStatus,
    setClientConfirmed,
    setBudgets,
    setTipoServicio,
    setEsFacturable,
    setTieneContrato,
    setEsGarantia,
    setRazonSocial,
    setContacto,
    setDireccion,
    setLocalidad,
    setProvincia,
    setEmailPrincipal,
    setSistema,
    setModuloModelo,
    setModuloDescripcion,
    setModuloSerie,
    setCodigoInternoCliente,
    setFechaInicio,
    setFechaFin,
    setHoraInicio,
    setHoraFin,
    setHorasTrabajadas,
    setTiempoViaje,
    setReporteTecnico,
    setAccionesTomar,
    setArticulos,
    setSignatureEngineer,
    setSignatureClient,
    setAclaracionEspecialista,
    setAclaracionCliente,
    setProtocolTemplateId,
    setProtocolData,
    setProtocolSelections,
    setInstrumentosSeleccionados
  } = setters;

  /** Pre-carga la firma del usuario autenticado si el reporte no tiene firma */
  const prefillFirma = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser?.uid) return;
      const firma = await firebase.getUserFirma(currentUser.uid);
      if (firma) {
        setSignatureEngineer(firma.firmaBase64);
        setAclaracionEspecialista(firma.nombreAclaracion);
      }
    } catch (e) {
      console.warn('No se pudo pre-cargar firma del ingeniero:', e);
    }
  };

  // Cargar OT desde Firebase
  const loadOT = async (otValue: string) => {
    const v = otValue.trim();
    const regex = /^\d{5}(?:\.\d{2})?$/;
    
    if (!v) return;
    
    // Validar formato
    if (!regex.test(v)) {
      // El alert será manejado por el componente que llama a loadOT
      throw new Error("Formato inválido. Use 5 dígitos, opcional .NN (ej: 25660 o 25660.02)");
    }

    // Si ya es la OT actual, no hacer nada
    if (v === otNumber) {
      return;
    }

    console.log("📥 CARGA OT solicitada:", v);
    hasInitialized.current = false; // Bloquear autosave mientras buscamos

    try {
      const data = await firebase.getReport(v);
      
      if (data) {
        // 🟢 EXISTE → rehidratar
        setOtNumber(data.otNumber || v);
        setBudgets(data.budgets || ['']);
        setTipoServicio(data.tipoServicio || 'Visita de diagnóstico / reparación');
        setEsFacturable(!!data.esFacturable);
        setTieneContrato(!!data.tieneContrato);
        setEsGarantia(!!data.esGarantia);
        setRazonSocial(data.razonSocial || '');
        setContacto(data.contacto || '');
        setDireccion(data.direccion || '');
        setLocalidad(data.localidad || '');
        setProvincia(data.provincia || '');
        setSistema(data.sistema || '');
        setModuloModelo(data.moduloModelo || '');
        setModuloDescripcion(data.moduloDescripcion || '');
        setModuloSerie(data.moduloSerie || '');
        setCodigoInternoCliente(data.codigoInternoCliente || '');
        setFechaInicio(data.fechaInicio || new Date().toISOString().split('T')[0]);
        setFechaFin(data.fechaFin || new Date().toISOString().split('T')[0]);
        setHoraInicio(data.horaInicio || '');
        setHoraFin(data.horaFin || '');
        setHorasTrabajadas(data.horasTrabajadas || '');
        setTiempoViaje(data.tiempoViaje || '');
        setReporteTecnico(data.reporteTecnico || '');
        setAccionesTomar(data.accionesTomar || '');
        const articulosData = (data.articulos || []).map((p: Part) => ({
          ...p,
          id: p.id || uid()
        }));
        setArticulos(articulosData);
        setEmailPrincipal(data.emailPrincipal || '');
        setSignatureEngineer(data.signatureEngineer || null);
        setSignatureClient(data.signatureClient || null);
        setAclaracionCliente(data.aclaracionCliente || '');
        setAclaracionEspecialista(data.aclaracionEspecialista || '');
        // Tablas dinámicas del catálogo
        setProtocolSelections(data.protocolSelections || []);
        // Instrumentos/patrones seleccionados
        setInstrumentosSeleccionados(data.instrumentosSeleccionados || []);
        // Plantilla esperada según tipo de servicio; si no hay protocolo para este tipo, limpiar
        const expectedTemplate = getProtocolTemplateForServiceType(data.tipoServicio ?? null);
        if (!expectedTemplate) {
          setProtocolTemplateId(null);
          setProtocolData(null);
        } else if (
          data.protocolTemplateId === expectedTemplate.id &&
          data.protocolData != null
        ) {
          setProtocolTemplateId(expectedTemplate.id);
          setProtocolData(data.protocolData);
        } else {
          setProtocolTemplateId(expectedTemplate.id);
          setProtocolData(createEmptyProtocolDataForTemplate(expectedTemplate));
        }
        const loadedStatus = data.status || 'BORRADOR';
        setStatus(loadedStatus);
        // Solo establecer clientConfirmed si el estado es FINALIZADO
        // Si es BORRADOR, aunque tenga firma, no debe estar confirmado
        setClientConfirmed(loadedStatus === 'FINALIZADO');
        hasUserInteracted.current = true;
        console.log("✅ OT cargada desde Firebase:", v);

        // Pre-cargar firma del ingeniero si el reporte es BORRADOR y no tiene firma
        if (loadedStatus === 'BORRADOR' && !data.signatureEngineer) {
          prefillFirma();
        }
      } else {
        // 🟡 NO EXISTE → mostrar modal de confirmación
        console.log("⚠️ OT no encontrada, solicitando confirmación...");
        setPendingOt(v);
        setShowNewOtModal(true);
        return; // No habilitar autosave todavía
      }
    } catch (error) {
      console.error("❌ Error al cargar OT:", error);
      // El alert será manejado por el componente que llama a loadOT
      throw error;
    }

    // 🔓 habilitamos autosave solo si se cargó correctamente
    hasInitialized.current = true;
  };

  // Confirmar creación de nueva OT
  const createNewOT = (otValue: string) => {
    const v = otValue;
    setOtNumber(v);
    setStatus('BORRADOR');
    const template = getProtocolTemplateForServiceType(tipoServicio);
    if (!template) {
      setProtocolTemplateId(null);
      setProtocolData(null);
    } else {
      setProtocolTemplateId(template.id);
      setProtocolData(createEmptyProtocolDataForTemplate(template));
    }
    setProtocolSelections([]);
    setInstrumentosSeleccionados([]);
    setShowNewOtModal(false);
    setPendingOt('');
    hasInitialized.current = true;
    hasUserInteracted.current = true;
    console.log("✅ Nueva OT creada:", v);

    // Pre-cargar firma del ingeniero en nueva OT
    prefillFirma();
  };

  // Nuevo reporte - limpia formulario
  const newReport = async (showConfirmModal: (options: { title?: string; message: string; onConfirm: () => void; onCancel?: () => void; confirmText?: string; cancelText?: string; confirmType?: 'info' | 'warning' | 'error' | 'success' }) => Promise<boolean>) => {
    if (hasUserInteracted.current && otNumber) {
      const confirmar = await showConfirmModal({
        title: 'Confirmar',
        message: 'Está a punto de abandonar el reporte actual, ¿está seguro?',
        onConfirm: () => {}, // Función vacía, solo necesitamos el resultado del Promise
        confirmText: 'Sí, crear nuevo',
        cancelText: 'Cancelar',
        confirmType: 'warning'
      });
      if (!confirmar) return;
    }

    const today = new Date().toISOString().split('T')[0];

    // Dejar OT en blanco - el usuario debe ingresar un número válido (5 dígitos + opcional .NN)
    setOtInput('');
    setOtNumber('');
    setBudgets(['']);
    setTipoServicio('Visita de diagnóstico / reparación');
    setEsFacturable(false);
    setTieneContrato(false);
    setEsGarantia(false);
    setRazonSocial('');
    setContacto('');
    setDireccion('');
    setLocalidad('');
    setProvincia('');
    setSistema('');
    setModuloModelo('');
    setModuloDescripcion('');
    setModuloSerie('');
    setCodigoInternoCliente('');
    setFechaInicio(today);
    setFechaFin(today);
    setHoraInicio('');
    setHoraFin('');
    setHorasTrabajadas('');
    setTiempoViaje('');
    setReporteTecnico('');
    setAccionesTomar('');
    setArticulos([]);
    setEmailPrincipal('');
    setSignatureEngineer(null);
    setSignatureClient(null);
    setAclaracionEspecialista('');
    setAclaracionCliente('');
    const templateNewReport = getProtocolTemplateForServiceType('Visita de diagnóstico / reparación');
    if (!templateNewReport) {
      setProtocolTemplateId(null);
      setProtocolData(null);
    } else {
      setProtocolTemplateId(templateNewReport.id);
      setProtocolData(createEmptyProtocolDataForTemplate(templateNewReport));
    }
    setProtocolSelections([]);
    setInstrumentosSeleccionados([]);
    setClientConfirmed(false);
    setStatus('BORRADOR');

    // IMPORTANTE: Deshabilitar autosave cuando se limpia el formulario
    // porque no hay OT válida para guardar
    hasUserInteracted.current = false;
    hasInitialized.current = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Duplicar OT
  const duplicateOT = async (options: DuplicateOptions) => {
    // Verificar que la OT sugerida esté disponible antes de crear
    let newOt = options.newOtSuffix || incrementSuffix(otNumber);
    
    // Verificar si la OT ya existe y está finalizada
    try {
      const existingReport = await firebase.getReport(newOt);
      if (existingReport) {
        if (existingReport.status === 'FINALIZADO') {
          // Si está finalizada, buscar la siguiente disponible
          console.log(`⚠️ OT ${newOt} ya existe y está FINALIZADA. Buscando siguiente OT disponible...`);
          newOt = await findNextAvailableOT(otNumber, firebase);
          console.log(`✅ OT disponible encontrada: ${newOt}`);
        } else {
          // Si existe pero está en BORRADOR, está disponible para editar
          console.log(`ℹ️ OT ${newOt} ya existe pero está en BORRADOR, se puede editar`);
        }
      }
    } catch (error) {
      console.warn(`Error al verificar OT ${newOt}, continuando con la creación:`, error);
      // Si hay error al verificar, continuar con la OT sugerida
    }
    
    const today = new Date().toISOString().split('T')[0];

    const newState: any = {
      fechaInicio: today,
      fechaFin: today,
      horaInicio: '',
      horaFin: '',
      horasTrabajadas: '',
      tiempoViaje: '',
      signatureClient: null,
      signatureEngineer: null,
      clientConfirmed: false,
      status: 'BORRADOR',
      updatedAt: new Date().toISOString()
    };

    if (options.copyClientEquipment) {
      newState.razonSocial = razonSocial;
      newState.contacto = contacto;
      newState.direccion = direccion;
      newState.localidad = localidad;
      newState.provincia = provincia;
      newState.sistema = sistema;
      newState.moduloModelo = moduloModelo;
      newState.moduloDescripcion = moduloDescripcion;
      newState.moduloSerie = moduloSerie;
      newState.codigoInternoCliente = codigoInternoCliente;
      newState.emailPrincipal = emailPrincipal;
    } else {
      newState.razonSocial = '';
      newState.contacto = '';
      newState.direccion = '';
      newState.localidad = '';
      newState.provincia = '';
      newState.sistema = '';
      newState.moduloModelo = '';
      newState.moduloDescripcion = '';
      newState.moduloSerie = '';
      newState.codigoInternoCliente = '';
      newState.emailPrincipal = '';
    }

    if (options.copyBudgets) {
      newState.budgets = [...budgets];
    } else {
      newState.budgets = [''];
    }

    if (options.copyObservations) {
      newState.accionesTomar = accionesTomar;
    } else {
      newState.accionesTomar = '';
    }

    if (options.copyReportTecnico) {
      newState.reporteTecnico = reporteTecnico;
    } else {
      newState.reporteTecnico = '';
    }

    const expectedTemplateDup = getProtocolTemplateForServiceType(tipoServicio);
    if (!expectedTemplateDup) {
      newState.protocolTemplateId = null;
      newState.protocolData = null;
    } else if (
      protocolTemplateId === expectedTemplateDup.id &&
      protocolData != null
    ) {
      newState.protocolTemplateId = expectedTemplateDup.id;
      newState.protocolData = protocolData;
    } else {
      newState.protocolTemplateId = expectedTemplateDup.id;
      newState.protocolData = createEmptyProtocolDataForTemplate(expectedTemplateDup);
    }

    // Artículos: copiar solo si se copian budgets
    if (options.copyBudgets) {
      newState.articulos = articulos.map(p => ({ ...p, id: uid() }));
    } else {
      newState.articulos = [];
    }

    // Aplicar estados
    // IMPORTANTE: Establecer status primero para que readOnly se calcule correctamente
    setStatus('BORRADOR');
    setClientConfirmed(false);
    
    console.log('🔄 Duplicando OT - Estableciendo status a BORRADOR');
    
    // Establecer el resto de los estados
    setOtInput(newOt);
    setOtNumber(newOt);
    setBudgets(newState.budgets);
    setTipoServicio(tipoServicio);
    setEsFacturable(esFacturable);
    setTieneContrato(tieneContrato);
    setEsGarantia(esGarantia);
    setRazonSocial(newState.razonSocial);
    setContacto(newState.contacto);
    setDireccion(newState.direccion);
    setLocalidad(newState.localidad);
    setProvincia(newState.provincia);
    setSistema(newState.sistema);
    setModuloModelo(newState.moduloModelo);
    setModuloDescripcion(newState.moduloDescripcion);
    setModuloSerie(newState.moduloSerie);
    setCodigoInternoCliente(newState.codigoInternoCliente);
    setFechaInicio(newState.fechaInicio);
    setFechaFin(newState.fechaFin);
    setHoraInicio(newState.horaInicio || '');
    setHoraFin(newState.horaFin || '');
    setHorasTrabajadas(newState.horasTrabajadas);
    setTiempoViaje(newState.tiempoViaje);
    setReporteTecnico(newState.reporteTecnico);
    setAccionesTomar(newState.accionesTomar);
    setArticulos(newState.articulos);
    setEmailPrincipal(newState.emailPrincipal);
    setSignatureEngineer(null);
    setSignatureClient(null);
    setAclaracionEspecialista('');
    setAclaracionCliente('');
    setProtocolTemplateId(newState.protocolTemplateId);
    setProtocolData(newState.protocolData);
    setProtocolSelections([]); // Nueva OT duplicada arranca sin tablas dinámicas seleccionadas
    setInstrumentosSeleccionados([]); // Instrumentos arrancan vacíos en duplicado

    // IMPORTANTE: Habilitar autosave DESPUÉS de que se establezcan todos los estados
    // Esto evita que el autosave intente guardar antes de que los datos estén listos
    hasUserInteracted.current = true;
    hasInitialized.current = false; // Deshabilitar temporalmente para evitar autosave inmediato
    
    // Esperar un momento para que React actualice el estado antes de guardar
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('✅ Estados establecidos, guardando en Firestore con status BORRADOR');
    
    // Pre-crear documento en Firestore
    try {
      const dataToSave = {
        ...newState,
        otNumber: newOt,
        tipoServicio,
        esFacturable,
        tieneContrato,
        esGarantia,
        status: 'BORRADOR' // Asegurar explícitamente que el status sea BORRADOR
      };
      console.log('📝 Guardando OT duplicada:', { ot: newOt, status: dataToSave.status });
      await firebase.saveReport(newOt, dataToSave);
      console.log('✅ OT duplicada guardada exitosamente');
      // Solo habilitar autosave después de que se guarde exitosamente
      hasInitialized.current = true;
    } catch (err) {
      console.error("Error pre-creando OT duplicada:", err);
      // Aún así habilitar autosave para que intente guardar después
      hasInitialized.current = true;
    }

    // Pre-cargar firma del ingeniero en OT duplicada
    prefillFirma();

    window.scrollTo({ top: 0, behavior: 'smooth' });
    return newOt; // Retornar la OT creada para mostrar el mensaje
  };

  return {
    loadOT,
    createNewOT,
    newReport,
    duplicateOT,
    modals: {
      showNewOtModal,
      setShowNewOtModal,
      pendingOt,
      setPendingOt
    }
  };
};
