import { useState } from 'react';
import { auth } from '../services/authService';
import { FirebaseService } from '../services/firebaseService';
import { Part, ProtocolData } from '../types';
import { uid, incrementSuffix, findNextAvailableOT } from '../services/utils';
import { UseReportFormReturn } from './useReportForm';
import { createEmptyProtocolDataForTemplate } from '../data/sampleProtocol';
import { getProtocolTemplateForServiceType } from '../utils/protocolSelector';
import { logger } from '../utils/logger';

/** Recorta whitespace de una firma base64. Devuelve la versión trimmed como dataURL. */
function trimSignatureBase64(dataUrl: string, padding = 10): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d');
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, c.width, c.height).data;
      let top = c.height, left = c.width, bottom = 0, right = 0;
      for (let y = 0; y < c.height; y++) {
        for (let x = 0; x < c.width; x++) {
          if (imgData[(y * c.width + x) * 4 + 3] > 0) {
            if (y < top) top = y;
            if (y > bottom) bottom = y;
            if (x < left) left = x;
            if (x > right) right = x;
          }
        }
      }
      if (bottom <= top || right <= left) { resolve(dataUrl); return; }
      top = Math.max(0, top - padding);
      left = Math.max(0, left - padding);
      bottom = Math.min(c.height - 1, bottom + padding);
      right = Math.min(c.width - 1, right + padding);
      const tw = right - left + 1, th = bottom - top + 1;
      const out = document.createElement('canvas');
      out.width = tw; out.height = th;
      const oCtx = out.getContext('2d');
      if (!oCtx) { resolve(dataUrl); return; }
      oCtx.drawImage(c, left, top, tw, th, 0, 0, tw, th);
      resolve(out.toDataURL('image/png'));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

interface DuplicateNewState {
  fechaInicio: string;
  fechaFin: string;
  horaInicio: string;
  horaFin: string;
  horasTrabajadas: string;
  tiempoViaje: string;
  signatureClient: null;
  signatureEngineer: null;
  clientConfirmed: boolean;
  status: 'BORRADOR';
  updatedAt: string;
  razonSocial: string;
  contacto: string;
  direccion: string;
  localidad: string;
  provincia: string;
  sistema: string;
  moduloModelo: string;
  moduloMarca: string;
  moduloDescripcion: string;
  moduloSerie: string;
  codigoInternoCliente: string;
  emailPrincipal: string;
  budgets: string[];
  accionesTomar: string;
  reporteTecnico: string;
  protocolTemplateId: string | null;
  protocolData: ProtocolData | null;
  articulos: Part[];
}

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
    moduloMarca,
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
    setModuloMarca,
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
        const trimmed = await trimSignatureBase64(firma.firmaBase64);
        setSignatureEngineer(trimmed);
        setAclaracionEspecialista(firma.nombreAclaracion);
      }
    } catch (e) {
      logger.warn('No se pudo pre-cargar firma del ingeniero:', e);
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

    logger.debug("📥 CARGA OT solicitada:", v);
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
        setModuloMarca(data.moduloMarca || '');
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
        logger.debug("✅ OT cargada desde Firebase:", v);

        // Pre-cargar firma del ingeniero si el reporte es BORRADOR y no tiene firma
        if (loadedStatus === 'BORRADOR' && !data.signatureEngineer) {
          void prefillFirma();
        }
      } else {
        // 🟡 NO EXISTE → mostrar modal de confirmación
        logger.debug("⚠️ OT no encontrada, solicitando confirmación...");
        setPendingOt(v);
        setShowNewOtModal(true);
        hasInitialized.current = true; // Desbloquear para que futuras cargas funcionen
        return;
      }
    } catch (error) {
      logger.error("❌ Error al cargar OT:", error);
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
    logger.debug("✅ Nueva OT creada:", v);

    // Pre-cargar firma del ingeniero en nueva OT (fire-and-forget)
    void prefillFirma();
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
    setModuloMarca('');
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
          logger.debug(`⚠️ OT ${newOt} ya existe y está FINALIZADA. Buscando siguiente OT disponible...`);
          newOt = await findNextAvailableOT(otNumber, firebase);
          logger.debug(`✅ OT disponible encontrada: ${newOt}`);
        } else {
          // Si existe pero está en BORRADOR, está disponible para editar
          logger.debug(`ℹ️ OT ${newOt} ya existe pero está en BORRADOR, se puede editar`);
        }
      }
    } catch (error) {
      logger.warn(`Error al verificar OT ${newOt}, continuando con la creación:`, error);
      // Si hay error al verificar, continuar con la OT sugerida
    }
    
    const today = new Date().toISOString().split('T')[0];

    // Resolver protocolo esperado
    const expectedTemplateDup = getProtocolTemplateForServiceType(tipoServicio);
    let dupProtocolTemplateId: string | null = null;
    let dupProtocolData: ProtocolData | null = null;
    if (expectedTemplateDup) {
      dupProtocolTemplateId = expectedTemplateDup.id;
      dupProtocolData = (protocolTemplateId === expectedTemplateDup.id && protocolData != null)
        ? protocolData
        : createEmptyProtocolDataForTemplate(expectedTemplateDup);
    }

    // Construir estado completo de una vez
    const newState: DuplicateNewState = {
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
      updatedAt: new Date().toISOString(),
      razonSocial: options.copyClientEquipment ? razonSocial : '',
      contacto: options.copyClientEquipment ? contacto : '',
      direccion: options.copyClientEquipment ? direccion : '',
      localidad: options.copyClientEquipment ? localidad : '',
      provincia: options.copyClientEquipment ? provincia : '',
      sistema: options.copyClientEquipment ? sistema : '',
      moduloModelo: options.copyClientEquipment ? moduloModelo : '',
      moduloMarca: options.copyClientEquipment ? moduloMarca : '',
      moduloDescripcion: options.copyClientEquipment ? moduloDescripcion : '',
      moduloSerie: options.copyClientEquipment ? moduloSerie : '',
      codigoInternoCliente: options.copyClientEquipment ? codigoInternoCliente : '',
      emailPrincipal: options.copyClientEquipment ? emailPrincipal : '',
      budgets: options.copyBudgets ? [...budgets] : [''],
      accionesTomar: options.copyObservations ? accionesTomar : '',
      reporteTecnico: options.copyReportTecnico ? reporteTecnico : '',
      protocolTemplateId: dupProtocolTemplateId,
      protocolData: dupProtocolData,
      articulos: options.copyBudgets ? articulos.map(p => ({ ...p, id: uid() })) : [],
    };

    // Aplicar estados al formulario
    // IMPORTANTE: Establecer status primero para que readOnly se calcule correctamente
    setStatus('BORRADOR');
    setClientConfirmed(false);

    logger.debug('🔄 Duplicando OT - Estableciendo status a BORRADOR');

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
    setModuloMarca(newState.moduloMarca);
    setModuloDescripcion(newState.moduloDescripcion);
    setModuloSerie(newState.moduloSerie);
    setCodigoInternoCliente(newState.codigoInternoCliente);
    setFechaInicio(newState.fechaInicio);
    setFechaFin(newState.fechaFin);
    setHoraInicio(newState.horaInicio);
    setHoraFin(newState.horaFin);
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
    setProtocolSelections([]);
    setInstrumentosSeleccionados([]);

    // Habilitar autosave DESPUÉS de establecer todos los estados
    hasUserInteracted.current = true;
    hasInitialized.current = false;

    logger.debug('✅ Estados establecidos, guardando en Firestore con status BORRADOR');

    // Pre-crear documento en Firestore (usa el objeto local, no depende del estado React)
    try {
      const dataToSave = {
        ...newState,
        otNumber: newOt,
        tipoServicio,
        esFacturable,
        tieneContrato,
        esGarantia,
        status: 'BORRADOR' as const,
      };
      logger.debug('📝 Guardando OT duplicada:', { ot: newOt, status: dataToSave.status });
      await firebase.saveReport(newOt, dataToSave);
      logger.debug('✅ OT duplicada guardada exitosamente');
      hasInitialized.current = true;
    } catch (err) {
      logger.error("Error pre-creando OT duplicada:", err);
      hasInitialized.current = true;
    }

    // Pre-cargar firma del ingeniero en OT duplicada (fire-and-forget)
    void prefillFirma();

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
