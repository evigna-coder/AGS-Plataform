import { useState, useMemo, useEffect, useRef } from 'react';
import { Part } from '../types';
import { GeminiService } from '../services/geminiService';
import { FirebaseService } from '../services/firebaseService';
import { SignaturePadHandle } from '../components/SignaturePad';
import { safeBtoaUnicode, uid, incrementSuffix, formatDateToDDMMYYYY } from '../services/utils';
import { calcHours, isValidTimeHHMM } from '../services/time';
import { useReportForm } from './useReportForm';
import { useOTManagement } from './useOTManagement';
import { usePDFGeneration } from './usePDFGeneration';
import { useAutosave } from './useAutosave';
import { useModal } from './useModal';
import { getProtocolTemplateForServiceType, getProtocolTemplateById } from '../utils/protocolSelector';
import { createEmptyProtocolDataForTemplate } from '../data/sampleProtocol';
import { useEntitySelectors } from './useEntitySelectors';
import type { ProtocolSelection, TableCatalogEntry, ChecklistItemAnswer } from '../types/tableCatalog';
import type { AdjuntoMeta } from '../types/instrumentos';

declare const QRCode: any;

/**
 * Tipos de servicio que habilitan el catálogo de tablas.
 */
export const CATALOG_SERVICE_TYPES = new Set([
  'Calibración',
  'Calificación de instalación',
  'Calificación de operación',
  'Calificación de software',
  'Limpieza de fuente de Iones',
  'Mantenimiento preventivo con consumibles',
  'Mantenimiento preventivo sin consumibles',
  'Mantenimiento preventivo sin consumibles, incluye limpieza de módulos',
  'Recalificación post reparación',
]);

export function useAppLogic(
  reportIdFromUrl: string | null,
  isModoFirma: boolean,
  shouldShare: boolean,
) {
  // Hook de formulario - centraliza todos los estados del formulario
  const reportForm = useReportForm(reportIdFromUrl || '');
  const {
    formState,
    setters,
    readOnly: readOnlyByStatus,
    reportState,
    hasUserInteracted,
    hasInitialized,
    markUserInteracted
  } = reportForm;

  // Extender readOnly: bloquear formulario si no hay OT activa (usuario canceló creación o no ingresó número)
  // El campo OT queda habilitado aparte (usa readOnlyByStatus) para poder ingresar un nuevo número
  const readOnly = readOnlyByStatus || !formState.otNumber;

  // Desestructurar estados para facilitar el uso
  const {
    otNumber, otInput, status, clientConfirmed, budgets, tipoServicio,
    esFacturable, tieneContrato, esGarantia, razonSocial, contacto,
    direccion, localidad, provincia, emailPrincipal, sistema,
    moduloModelo, moduloMarca, moduloDescripcion, moduloSerie, codigoInternoCliente,
    fechaInicio, fechaFin, horaInicio, horaFin, horasTrabajadas, tiempoViaje, reporteTecnico,
    accionesTomar, articulos, signatureEngineer, aclaracionEspecialista,
    signatureClient, aclaracionCliente, protocolTemplateId, protocolData, protocolSelections,
    instrumentosSeleccionados
  } = formState;

  /** Plantilla actual: por id guardado o por tipo de servicio (para fallback) */
  const protocolTemplate =
    getProtocolTemplateById(protocolTemplateId) ?? getProtocolTemplateForServiceType(tipoServicio);

  // Estados locales para las fechas en formato DD/MM/AAAA (solo presentación)
  const [fechaInicioDisplay, setFechaInicioDisplay] = useState(
    fechaInicio ? formatDateToDDMMYYYY(fechaInicio) : ''
  );
  const [fechaFinDisplay, setFechaFinDisplay] = useState(
    fechaFin ? formatDateToDDMMYYYY(fechaFin) : ''
  );

  // Sincronizar visual cuando la fecha ISO cambia desde fuera (carga OT, duplicado, nuevo reporte)
  useEffect(() => {
    setFechaInicioDisplay(fechaInicio ? formatDateToDDMMYYYY(fechaInicio) : '');
  }, [fechaInicio]);

  useEffect(() => {
    setFechaFinDisplay(fechaFin ? formatDateToDDMMYYYY(fechaFin) : '');
  }, [fechaFin]);

  const [manualHoras, setManualHoras] = useState(false);

  // Auto-calcular horas trabajadas cuando manualHoras es false y las cuatro fechas/horas son válidas
  useEffect(() => {
    if (manualHoras) return;
    if (!fechaInicio || !fechaFin || !horaInicio || !horaFin) return;
    if (!isValidTimeHHMM(horaInicio) || !isValidTimeHHMM(horaFin)) return;
    const hours = calcHours(fechaInicio, horaInicio, fechaFin, horaFin);
    setHorasTrabajadas(String(hours));
  }, [fechaInicio, horaInicio, fechaFin, horaFin, manualHoras]);

  // Todas las tablas publicadas (para lookup de headerTitle/footerQF en el PDF)
  const [allPublishedTables, setAllPublishedTables] = useState<TableCatalogEntry[]>([]);
  // Proyectos (para headerTitle/footerQF a nivel proyecto)
  const [allProjects, setAllProjects] = useState<{ id: string; headerTitle?: string | null; footerQF?: string | null }[]>([]);
  useEffect(() => {
    let cancelled = false;
    firebase.getPublishedTables().then(tables => { if (!cancelled) setAllPublishedTables(tables); }).catch(() => {});
    firebase.getProjects().then(projs => { if (!cancelled) setAllProjects(projs); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Tablas sugeridas automáticamente según el tipo de servicio (pre-tildadas en el selector)
  const [suggestedTables, setSuggestedTables] = useState<TableCatalogEntry[]>([]);

  useEffect(() => {
    if (!CATALOG_SERVICE_TYPES.has(tipoServicio) || readOnly) {
      setSuggestedTables([]);
      return;
    }
    let cancelled = false;
    const loadTables = async () => {
      try {
        // Traer todas las tablas publicadas (sin filtrar por sysType en Firebase)
        // y filtrar localmente por modelos y tipoServicio
        const allTables = await firebase.getPublishedTables();
        if (cancelled) return;
        const sistemaLower = sistema.toLowerCase().trim();
        // Tablas sin tipoServicio asignado aparecen siempre; las demás solo si coinciden
        // Tablas sin modelos asignados aparecen siempre; las demás solo si algún modelo coincide (case-insensitive)
        const matchingTables = allTables.filter(t =>
          (!t.tipoServicio || t.tipoServicio.length === 0 || t.tipoServicio.includes(tipoServicio))
          && (!t.modelos || t.modelos.length === 0 || t.modelos.some(m => m.toLowerCase().trim() === sistemaLower))
        );
        setSuggestedTables(matchingTables.sort((a, b) => (a.orden || 999) - (b.orden || 999)));
      } catch (err) {
        console.error('Error auto-cargando tablas del catálogo:', err);
      }
    };
    loadTables();
    return () => { cancelled = true; };
  }, [tipoServicio, sistema]);

  // Adjuntos: viven en colección separada /adjuntos (no en reportState)
  const [adjuntos, setAdjuntos] = useState<AdjuntoMeta[]>([]);
  useEffect(() => {
    if (!otNumber) { setAdjuntos([]); return; }
    let cancelled = false;
    firebase.getAdjuntosByOT(otNumber).then(data => {
      if (!cancelled) setAdjuntos(data);
    }).catch(err => console.error('Error cargando adjuntos:', err));
    return () => { cancelled = true; };
  }, [otNumber]);

  // Desestructurar setters para facilitar el uso
  const {
    setOtNumber, setOtInput, setStatus, setClientConfirmed, setBudgets,
    setTipoServicio, setEsFacturable, setTieneContrato, setEsGarantia,
    setRazonSocial, setContacto, setDireccion, setLocalidad, setProvincia,
    setEmailPrincipal, setSistema, setModuloModelo, setModuloMarca, setModuloDescripcion,
    setModuloSerie, setCodigoInternoCliente, setFechaInicio, setFechaFin,
    setHoraInicio, setHoraFin, setHorasTrabajadas, setTiempoViaje, setReporteTecnico, setAccionesTomar,
    setArticulos, setSignatureEngineer, setAclaracionEspecialista,
    setSignatureClient, setAclaracionCliente, setProtocolTemplateId, setProtocolData,
    setProtocolSelections, setInstrumentosSeleccionados
  } = setters;

  // Handlers para tablas dinámicas del catálogo
  const handleCatalogCellChange = (tableId: string, rowId: string, colKey: string, value: string) => {
    setProtocolSelections(prev =>
      prev.map(s =>
        s.tableId !== tableId ? s : {
          ...s,
          filledData: {
            ...s.filledData,
            [rowId]: { ...(s.filledData[rowId] ?? {}), [colKey]: value }
          }
        }
      )
    );
  };

  const handleCatalogObservaciones = (tableId: string, value: string) => {
    setProtocolSelections(
      protocolSelections.map(s => s.tableId !== tableId ? s : { ...s, observaciones: value })
    );
  };

  const handleCatalogResultado = (tableId: string, resultado: ProtocolSelection['resultado']) => {
    setProtocolSelections(
      protocolSelections.map(s => s.tableId !== tableId ? s : { ...s, resultado })
    );
  };

  const handleCatalogToggleClientSpec = (tableId: string, enabled: boolean) => {
    setProtocolSelections(
      protocolSelections.map(s => s.tableId !== tableId ? s : { ...s, clientSpecEnabled: enabled })
    );
  };

  const handleRemoveCatalogTable = (tableId: string) => {
    setProtocolSelections(protocolSelections.filter(s => s.tableId !== tableId));
  };

  const handleAddRow = (tableId: string) => {
    setProtocolSelections(prev =>
      prev.map(s => {
        if (s.tableId !== tableId) return s;
        const newRowId = `extra_${Date.now()}`;
        const emptyRow: Record<string, string> = {};
        for (const col of s.tableSnapshot.columns) {
          emptyRow[col.key] = '';
        }
        return {
          ...s,
          tableSnapshot: {
            ...s.tableSnapshot,
            templateRows: [...s.tableSnapshot.templateRows, { rowId: newRowId, cells: {} }],
          },
          filledData: { ...s.filledData, [newRowId]: emptyRow },
        };
      })
    );
  };

  const handleRemoveRow = (tableId: string, rowId: string) => {
    setProtocolSelections(prev =>
      prev.map(s => {
        if (s.tableId !== tableId) return s;
        const { [rowId]: _, ...restFilled } = s.filledData;
        return {
          ...s,
          tableSnapshot: {
            ...s.tableSnapshot,
            templateRows: s.tableSnapshot.templateRows.filter(r => r.rowId !== rowId),
          },
          filledData: restFilled,
        };
      })
    );
  };

  const handleHeaderDataChange = (tableId: string, fieldId: string, value: string) => {
    setProtocolSelections(prev =>
      prev.map(s =>
        s.tableId !== tableId ? s : {
          ...s,
          headerData: { ...(s.headerData ?? {}), [fieldId]: value },
        }
      )
    );
  };

  const handleChecklistAnswer = (tableId: string, itemId: string, answer: ChecklistItemAnswer) => {
    setProtocolSelections(prev =>
      prev.map(s =>
        s.tableId !== tableId ? s : {
          ...s,
          checklistData: { ...(s.checklistData ?? {}), [itemId]: answer },
        }
      )
    );
  };

  const handleToggleChecklistSection = (tableId: string, itemId: string, isNA: boolean) => {
    setProtocolSelections(prev =>
      prev.map(s => {
        if (s.tableId !== tableId) return s;
        const current = s.collapsedSections ?? [];
        return {
          ...s,
          collapsedSections: isNA
            ? [...current.filter(id => id !== itemId), itemId]
            : current.filter(id => id !== itemId),
        };
      })
    );
  };

  const baseInputClass =
  'bg-white text-slate-900 appearance-none ' +
  'focus:bg-white focus:text-slate-900 ' +
  'disabled:bg-slate-100 disabled:text-slate-400 ' +
  '[&:-webkit-autofill]:bg-white ' +
  '[&:-webkit-autofill]:shadow-[0_0_0_1000px_white_inset] ' +
  '[&:-webkit-autofill]:text-slate-900';

  const clientPadRef = useRef<SignaturePadHandle>(null);
  const engineerPadRef = useRef<SignaturePadHandle>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  const [loadingAI, setLoadingAI] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  const gemini = useMemo(() => new GeminiService(), []);
  const firebase = useMemo(() => new FirebaseService(), []);
  const entitySelectors = useEntitySelectors(firebase, setters);

  // Hook de modales para reemplazar alert() y confirm()
  const modal = useModal();

  // Hook de gestión de OTs
  const otManagement = useOTManagement(reportForm, firebase, otInput);
  const {
    loadOT,
    createNewOT,
    newReport: newReportFromHook,
    duplicateOT,
    modals: { showNewOtModal, setShowNewOtModal, pendingOt, setPendingOt }
  } = otManagement;
  
  // Wrapper para newReport que pasa showConfirm
  const newReport = () => {
    newReportFromHook(modal.showConfirm);
  };

  // Auto-cargar reporte cuando se abre con ?reportId=XXX
  const autoLoadedRef = useRef(false);
  useEffect(() => {
    if (reportIdFromUrl && !autoLoadedRef.current) {
      autoLoadedRef.current = true;
      loadOT(reportIdFromUrl).catch(err => {
        console.error('Error auto-cargando reporte:', err);
      });
    }
  }, [reportIdFromUrl, loadOT]);

  // Intentar vincular con DB al cargar una OT existente
  const prevOtRef = useRef<string>('');
  useEffect(() => {
    if (otNumber && otNumber !== prevOtRef.current && hasInitialized.current && razonSocial) {
      entitySelectors.tryMatchExistingData(razonSocial, {
        direccion,
        sistema,
        moduloModelo,
      }).catch(() => {});
    }
    prevOtRef.current = otNumber;
  }, [otNumber]);

  // Reset selecciones al crear nuevo reporte
  useEffect(() => {
    if (!otNumber) entitySelectors.reset();
  }, [otNumber]);

  // Limpiar PDF cacheado cuando cambia de reporte
  useEffect(() => {
    setGeneratedPdfBlob(null);
  }, [otNumber]);

  const isLockedByClient = readOnly && status === 'BORRADOR';

  // Validación antes de confirmar firma o finalizar
  const validateBeforeClientConfirm = () => {
    // Verificar firma del especialista (puede estar en el estado o en el pad)
    const engineerSignature = signatureEngineer || engineerPadRef.current?.getSignature();
    
    const requiredFields = [
      razonSocial,
      contacto,
      direccion,
      localidad,
      provincia,
      sistema,
      fechaInicio,
      fechaFin,
      horasTrabajadas,
      reporteTecnico,
      // accionesTomar removido - puede quedar vacío
      aclaracionCliente,
      aclaracionEspecialista,
      engineerSignature // Validar la firma del especialista
    ];

    const hasEmpty = requiredFields.some(
      v => v === null || v === undefined || String(v).trim() === ''
    );

    if (hasEmpty) {
      modal.showAlert({
        title: 'Validación Requerida',
        message: 'No se puede confirmar la firma.\n\nTodos los campos del reporte y la firma del especialista son obligatorios.',
        type: 'warning'
      });
      return false;
    }

    if (!manualHoras && fechaInicio && fechaFin && horaInicio && horaFin &&
        isValidTimeHHMM(horaInicio) && isValidTimeHHMM(horaFin)) {
      const hours = calcHours(fechaInicio, horaInicio, fechaFin, horaFin);
      if (hours <= 0) {
        modal.showAlert({
          title: 'Horas inválidas',
          message: 'La hora de fin debe ser posterior a la hora de inicio. Corrija las fechas/horas o marque "Editar horas manualmente" y ingrese la cantidad.',
          type: 'warning'
        });
        return false;
      }
    }

    return true;
  };

  // Hook de generación de PDF (después de validateBeforeClientConfirm)
  const pdfGeneration = usePDFGeneration(
    reportForm,
    firebase,
    otNumber,
    isModoFirma,
    clientPadRef,
    engineerPadRef,
    validateBeforeClientConfirm,
    modal.showAlert,
    instrumentosSeleccionados,
    adjuntos,
  );
  const {
    generatePDFBlob: generatePDFBlobFromHook,
    handleFinalSubmit: handleFinalSubmitFromHook,
    confirmClientAndFinalize: confirmClientAndFinalizeFromHook,
    isGenerating,
    isPreviewMode,
    pdfBlob: generatedPdfBlob,
    setIsPreviewMode,
    setPdfBlob: setGeneratedPdfBlob
  } = pdfGeneration;

  // Hook de autosave - guarda automáticamente con debounce
  useAutosave({
    reportState,
    otNumber,
    status,
    firebase,
    hasInitialized,
    hasUserInteracted,
    isModoFirma,
    isPreviewMode,
    debounceMs: 700
  });

  useEffect(() => {
    if (showQRModal && qrRef.current) {
      const state = {
        ot: otNumber,
        rs: razonSocial,
        ts: Date.now()
      };
      
      const base64 = safeBtoaUnicode(JSON.stringify(state));
      const url = `${window.location.origin}${window.location.pathname}?modo=firma&reportId=${otNumber}&data=${base64}`;
      
      qrRef.current.innerHTML = ''; 
      new QRCode(qrRef.current, {
        text: url,
        width: 150,
        height: 150,
        colorDark: "#0f172a",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
      });
    }
  }, [showQRModal, otNumber, razonSocial]);

  // Auto-compartir cuando se carga con parámetro share=true
  useEffect(() => {
    if (shouldShare && !isModoFirma && otNumber) {
      // Esperar un momento para que el PDF container esté listo y los datos carguen
      const timer = setTimeout(() => {
        if (hasInitialized.current) {
          shareReportPDF();
          // Limpiar el parámetro de la URL
          const url = new URL(window.location.href);
          url.searchParams.delete('share');
          window.history.replaceState({}, '', url.toString());
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [shouldShare, isModoFirma, otNumber]);

  const handleGenerateRemoteSign = () => {
    setShowQRModal(true);
  };

  // Función para cargar/validar OT al salir del campo (onBlur)
  // Funciones de gestión de OT ahora vienen del hook useOTManagement
  const confirmLoadOt = async () => {
    try {
      await loadOT(otInput);
    } catch (error: any) {
      modal.showAlert({
        title: 'Error',
        message: error.message || 'Error al cargar la OT. Intente nuevamente.',
        type: 'error'
      });
    }
  };

  const confirmCreateNewOt = () => {
    createNewOT(pendingOt);
  };

  // Función para generar PDF como Blob (wrapper del hook)
  const generatePDFBlob = generatePDFBlobFromHook;

  // Función para finalizar y descargar PDF (wrapper del hook)
  const handleFinalSubmit = handleFinalSubmitFromHook;

  // Función para descargar PDF directamente
  const downloadPDF = async (otParam?: string) => {
    try {
      const otToUse = otParam || otNumber;
      if (!otToUse) {
        modal.showAlert({
          title: 'Error',
          message: 'No hay número de OT disponible',
          type: 'error'
        });
        return;
      }

      console.log("Preparando PDF para descargar...");
      const filename = `${otToUse}_Reporte_AGS.pdf`;

      // Siempre regenerar el PDF para evitar descargar un reporte stale
      console.log("Generando PDF como Blob...");
      const pdfBlob = await generatePDFBlob();

      // Crear enlace de descarga
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      modal.showAlert({
        title: 'Éxito',
        message: 'PDF descargado correctamente',
        type: 'success'
      });
    } catch (error) {
      console.error("Error al descargar PDF:", error);
      modal.showAlert({
        title: 'Error',
        message: 'Error al descargar el PDF. Intente nuevamente.',
        type: 'error'
      });
    }
  };

  // Función para compartir PDF
  const shareReportPDF = async (otParam?: string) => {
    const otToUse = otParam || otNumber;
    
    // Si estamos en modo móvil, redirigir a la vista principal para compartir
    if (isModoFirma) {
      const url = new URL(window.location.href);
      url.searchParams.delete('modo');
      url.searchParams.set('share', 'true'); // Indicar que debe compartir al cargar
      window.location.href = url.toString();
      return;
    }
    
    setIsSharing(true);
    try {
      console.log("Preparando documento para compartir...");
      const filename = `${otToUse}_Reporte_AGS.pdf`;
      
      // Siempre regenerar el PDF para evitar compartir un reporte stale
      console.log("Generando PDF como Blob...");
      const pdfBlob = await generatePDFBlob();

      // Detectar si es dispositivo móvil
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      // En móviles, intentar Web Share API directamente
      if (isMobile && navigator.share && navigator.canShare) {
        const file = new File([pdfBlob], filename, { type: 'application/pdf' });
        
        if (navigator.canShare({ files: [file] })) {
          try {
            console.log("Compartiendo con Web Share API...");
            await navigator.share({
              files: [file],
              title: `Reporte ${otToUse}`,
              text: `Reporte OT ${otToUse}`
            });
            console.log("Compartido exitosamente");
            setIsSharing(false);
            return;
          } catch (shareError: any) {
            // Si el usuario cancela, solo detener sin error
            if (shareError.name === 'AbortError') {
              console.log("Usuario canceló el compartir");
              setIsSharing(false);
              return;
            }
            console.log("Web Share API falló, usando fallback:", shareError);
          }
        }
      }

      // Fallback: Intentar subir a Firebase Storage
      try {
        console.log("Subiendo a Firebase Storage...");
        const url = await firebase.uploadReportBlob(otToUse, pdfBlob, filename);
        console.log("URL generada:", url);
        setShareUrl(url);
        setShowShareModal(true);
      } catch (uploadError) {
        console.error("Error al subir a Storage:", uploadError);
        // Fallback final: Descargar
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        modal.showAlert({
          title: 'Advertencia',
          message: 'PDF descargado. No se pudo compartir ni subir a la nube.',
          type: 'warning'
        });
      }
    } catch (error) {
      console.error("Error al generar/compartir PDF:", error);
      modal.showAlert({
        title: 'Error',
        message: 'Error al preparar el documento para compartir. Intente nuevamente.',
        type: 'error'
      });
    } finally {
      setIsSharing(false);
    }
  };

  const totalHs = useMemo(() => {
    const h = Number(horasTrabajadas) || 0;
    const t = Number(tiempoViaje) || 0;
    return (h + t).toFixed(1);
  }, [horasTrabajadas, tiempoViaje]);

  const addPart = () => {
    setArticulos([...articulos, { id: uid(), codigo: '', descripcion: '', cantidad: 1, origen: '' }]);
  };

  const updatePart = (id: string, fieldOrBulk: keyof Part | Partial<Part>, value?: any) => {
    setArticulos(prev => prev.map(p => {
      if (p.id !== id) return p;
      if (typeof fieldOrBulk === 'object') return { ...p, ...fieldOrBulk };
      return { ...p, [fieldOrBulk]: value };
    }));
  };

  const removePart = (id: string) => {
    setArticulos(articulos.filter(p => p.id !== id));
  };

  const addBudget = () => {
    setBudgets([...budgets, '']);
  };

  const updateBudget = (index: number, value: string) => {
    const updated = [...budgets];
    updated[index] = value.substring(0, 15);
    setBudgets(updated);
  };

  const removeBudget = (index: number) => {
    if (budgets.length > 1) {
      setBudgets(budgets.filter((_, i) => i !== index));
    } else {
      setBudgets(['']);
    }
  };

  const handleOptimizeReport = async () => {
    setLoadingAI(true);
    const optimized = await gemini.optimizeTechnicalReport(reporteTecnico);
    setReporteTecnico(optimized);
    setLoadingAI(false);
  };

  
  const handleReview = () => {
    if (!validateBeforeClientConfirm()) {
      return;
    }
    
    const cSig = clientPadRef.current?.getSignature();
    if (cSig) setSignatureClient(cSig);
    
    const eSig = engineerPadRef.current?.getSignature();
    if (eSig) setSignatureEngineer(eSig);

    setIsPreviewMode(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Funciones de gestión de OT ahora vienen del hook useOTManagement
  // Wrapper para mantener compatibilidad con el código existente
  const duplicateOt = async (options: {
    copyClientEquipment: boolean;
    copyBudgets: boolean;
    copyObservations: boolean;
    copyReportTecnico: boolean;
    newOtSuffix: string;
  }) => {
    try {
      const newOt = await duplicateOT({
        copyClientEquipment: options.copyClientEquipment,
        copyBudgets: options.copyBudgets,
        copyObservations: options.copyObservations,
        copyReportTecnico: options.copyReportTecnico,
        newOtSuffix: options.newOtSuffix
      });
      setShowDuplicateModal(false);
      
      // Esperar un momento para que React actualice el estado antes de mostrar el alert
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Verificar el estado después de duplicar
      console.log('🔍 Estado después de duplicar:', { status, readOnly, otNumber: newOt });
      
      if (newOt) {
        modal.showAlert({
          title: 'OT Creada',
          message: `Nueva OT creada: ${newOt} — revise y edite`,
          type: 'success'
        });
      }
    } catch (error: any) {
      modal.showAlert({
        title: 'Error',
        message: error.message || 'Error al duplicar la OT. Intente nuevamente.',
        type: 'error'
      });
    }
  };

  // Confirmar firma del cliente, finalizar reporte y generar PDF (wrapper del hook)
  const confirmClientAndFinalize = confirmClientAndFinalizeFromHook;

  const fullDireccion = `${direccion}${localidad ? `, ${localidad}` : ''}${provincia ? `, ${provincia}` : ''}`;


  return {
    // Form
    reportForm,
    formState,
    setters,
    readOnlyByStatus,
    readOnly,
    reportState,
    hasUserInteracted,
    hasInitialized,
    markUserInteracted,
    // Destructured form state
    otNumber, otInput, status, clientConfirmed, budgets, tipoServicio,
    esFacturable, tieneContrato, esGarantia, razonSocial, contacto,
    direccion, localidad, provincia, emailPrincipal, sistema,
    moduloModelo, moduloMarca, moduloDescripcion, moduloSerie, codigoInternoCliente,
    fechaInicio, fechaFin, horaInicio, horaFin, horasTrabajadas, tiempoViaje,
    reporteTecnico, accionesTomar, articulos,
    signatureEngineer, aclaracionEspecialista,
    signatureClient, aclaracionCliente,
    protocolTemplateId, protocolData, protocolSelections,
    instrumentosSeleccionados,
    // Protocol
    protocolTemplate,
    // Date display
    fechaInicioDisplay, setFechaInicioDisplay,
    fechaFinDisplay, setFechaFinDisplay,
    manualHoras, setManualHoras,
    // Published tables & projects
    allPublishedTables, allProjects,
    suggestedTables, setSuggestedTables,
    // Adjuntos
    adjuntos, setAdjuntos,
    // Destructured setters
    setOtNumber, setOtInput, setStatus, setClientConfirmed, setBudgets,
    setTipoServicio, setEsFacturable, setTieneContrato, setEsGarantia,
    setRazonSocial, setContacto, setDireccion, setLocalidad, setProvincia,
    setEmailPrincipal, setSistema, setModuloModelo, setModuloMarca, setModuloDescripcion,
    setModuloSerie, setCodigoInternoCliente, setFechaInicio, setFechaFin,
    setHoraInicio, setHoraFin, setHorasTrabajadas, setTiempoViaje,
    setReporteTecnico, setAccionesTomar,
    setArticulos, setSignatureEngineer, setAclaracionEspecialista,
    setSignatureClient, setAclaracionCliente, setProtocolTemplateId, setProtocolData,
    setProtocolSelections, setInstrumentosSeleccionados,
    // Catalog handlers
    handleCatalogCellChange, handleCatalogObservaciones, handleCatalogResultado,
    handleCatalogToggleClientSpec, handleRemoveCatalogTable,
    handleAddRow, handleRemoveRow, handleHeaderDataChange,
    handleChecklistAnswer, handleToggleChecklistSection,
    // Refs
    clientPadRef, engineerPadRef, qrRef,
    // UI state
    loadingAI, showQRModal, setShowQRModal,
    showDuplicateModal, setShowDuplicateModal,
    isSharing, shareUrl, showShareModal, setShowShareModal,
    // Services
    gemini, firebase, entitySelectors, modal,
    // OT management
    otManagement, loadOT, newReport, confirmLoadOt, confirmCreateNewOt,
    showNewOtModal: otManagement.modals.showNewOtModal,
    setShowNewOtModal: otManagement.modals.setShowNewOtModal,
    pendingOt: otManagement.modals.pendingOt,
    setPendingOt: otManagement.modals.setPendingOt,
    // PDF
    generatePDFBlob, handleFinalSubmit, confirmClientAndFinalize,
    isGenerating, isPreviewMode, generatedPdfBlob, setIsPreviewMode, setGeneratedPdfBlob,
    // Computed
    baseInputClass, totalHs, fullDireccion,
    isLockedByClient,
    // Actions
    addPart, updatePart, removePart,
    addBudget, updateBudget, removeBudget,
    handleOptimizeReport, handleReview,
    handleGenerateRemoteSign,
    downloadPDF, shareReportPDF,
    duplicateOt,
    // Constants
    CATALOG_SERVICE_TYPES,
  };
}
