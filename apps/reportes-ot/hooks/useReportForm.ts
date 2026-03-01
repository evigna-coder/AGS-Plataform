import { useState, useMemo, useRef } from 'react';
import { Part, type ProtocolData } from '../types';
import type { ProtocolSelection } from '../types/tableCatalog';
import type { InstrumentoPatronOption } from '../types/instrumentos';

export interface ReportFormState {
  // OT y estado general
  otNumber: string;
  otInput: string;
  status: 'BORRADOR' | 'FINALIZADO';
  clientConfirmed: boolean;

  // Servicio
  budgets: string[];
  tipoServicio: string;
  esFacturable: boolean;
  tieneContrato: boolean;
  esGarantia: boolean;

  // Cliente
  razonSocial: string;
  contacto: string;
  direccion: string;
  localidad: string;
  provincia: string;
  emailPrincipal: string;

  // Equipo
  sistema: string;
  moduloModelo: string;
  moduloDescripcion: string;
  moduloSerie: string;
  codigoInternoCliente: string;

  // Fechas y tiempos
  fechaInicio: string;
  fechaFin: string;
  horaInicio: string;
  horaFin: string;
  horasTrabajadas: string;
  tiempoViaje: string;

  // Reporte
  reporteTecnico: string;
  accionesTomar: string;
  articulos: Part[];

  // Firmas
  signatureEngineer: string | null;
  aclaracionEspecialista: string;
  signatureClient: string | null;
  aclaracionCliente: string;

  // Protocolo estático (anexo HPLC legacy)
  protocolTemplateId: string | null;
  protocolData: ProtocolData | null;

  // Tablas dinámicas del catálogo
  protocolSelections: ProtocolSelection[];

  // Instrumentos/patrones utilizados
  instrumentosSeleccionados: InstrumentoPatronOption[];
}

export interface ReportState {
  otNumber: string;
  budgets: string[];
  tipoServicio: string;
  esFacturable: boolean;
  tieneContrato: boolean;
  esGarantia: boolean;
  razonSocial: string;
  contacto: string;
  direccion: string;
  localidad: string;
  provincia: string;
  sistema: string;
  moduloModelo: string;
  moduloDescripcion: string;
  moduloSerie: string;
  codigoInternoCliente: string;
  fechaInicio: string;
  fechaFin: string;
  horaInicio: string;
  horaFin: string;
  horasTrabajadas: string;
  tiempoViaje: string;
  reporteTecnico: string;
  accionesTomar: string;
  articulos: Part[];
  emailPrincipal: string;
  signatureEngineer: string | null;
  aclaracionEspecialista: string;
  signatureClient: string | null;
  aclaracionCliente: string;
  protocolTemplateId: string | null;
  protocolData: ProtocolData | null;
  protocolSelections: ProtocolSelection[];
  instrumentosSeleccionados: InstrumentoPatronOption[];
}

export interface UseReportFormReturn {
  // Estados del formulario
  formState: ReportFormState;

  // Setters individuales
  setters: {
    setOtNumber: (value: string) => void;
    setOtInput: (value: string) => void;
    setStatus: (value: 'BORRADOR' | 'FINALIZADO') => void;
    setClientConfirmed: (value: boolean) => void;
    setBudgets: (value: string[]) => void;
    setTipoServicio: (value: string) => void;
    setEsFacturable: (value: boolean) => void;
    setTieneContrato: (value: boolean) => void;
    setEsGarantia: (value: boolean) => void;
    setRazonSocial: (value: string) => void;
    setContacto: (value: string) => void;
    setDireccion: (value: string) => void;
    setLocalidad: (value: string) => void;
    setProvincia: (value: string) => void;
    setEmailPrincipal: (value: string) => void;
    setSistema: (value: string) => void;
    setModuloModelo: (value: string) => void;
    setModuloDescripcion: (value: string) => void;
    setModuloSerie: (value: string) => void;
    setCodigoInternoCliente: (value: string) => void;
    setFechaInicio: (value: string) => void;
    setFechaFin: (value: string) => void;
    setHoraInicio: (value: string) => void;
    setHoraFin: (value: string) => void;
    setHorasTrabajadas: (value: string) => void;
    setTiempoViaje: (value: string) => void;
    setReporteTecnico: (value: string) => void;
    setAccionesTomar: (value: string) => void;
    setArticulos: (value: Part[]) => void;
    setSignatureEngineer: (value: string | null) => void;
    setAclaracionEspecialista: (value: string) => void;
    setSignatureClient: (value: string | null) => void;
    setAclaracionCliente: (value: string) => void;
    setProtocolTemplateId: (value: string | null) => void;
    setProtocolData: (value: ProtocolData | null) => void;
    setProtocolSelections: (value: ProtocolSelection[]) => void;
    setInstrumentosSeleccionados: (value: InstrumentoPatronOption[]) => void;
  };

  // Computed
  readOnly: boolean;
  reportState: ReportState;

  // Refs
  hasUserInteracted: React.MutableRefObject<boolean>;
  hasInitialized: React.MutableRefObject<boolean>;

  // Helpers
  markUserInteracted: () => void;
}

export const useReportForm = (initialOtNumber: string = ''): UseReportFormReturn => {
  // Estados del formulario
  const [otNumber, setOtNumber] = useState(initialOtNumber);
  const [budgets, setBudgets] = useState<string[]>(['']);
  const [tipoServicio, setTipoServicio] = useState('Visita de diagnóstico / reparación');
  const [esFacturable, setEsFacturable] = useState(false);
  const [tieneContrato, setTieneContrato] = useState(false);
  const [esGarantia, setEsGarantia] = useState(false);
  const [razonSocial, setRazonSocial] = useState('');
  const [contacto, setContacto] = useState('');
  const [direccion, setDireccion] = useState('');
  const [localidad, setLocalidad] = useState('');
  const [provincia, setProvincia] = useState('');
  const [sistema, setSistema] = useState('');
  const [moduloModelo, setModuloModelo] = useState('');
  const [moduloDescripcion, setModuloDescripcion] = useState('');
  const [moduloSerie, setModuloSerie] = useState('');
  const [codigoInternoCliente, setCodigoInternoCliente] = useState('');
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().split('T')[0]);
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0]);
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFin, setHoraFin] = useState('');
  const [horasTrabajadas, setHorasTrabajadas] = useState('');
  const [tiempoViaje, setTiempoViaje] = useState('');
  const [reporteTecnico, setReporteTecnico] = useState('');
  const [accionesTomar, setAccionesTomar] = useState('');
  const [articulos, setArticulos] = useState<Part[]>([]);
  const [emailPrincipal, setEmailPrincipal] = useState('');
  const [signatureEngineer, setSignatureEngineer] = useState<string | null>(null);
  const [aclaracionEspecialista, setAclaracionEspecialista] = useState('');
  const [signatureClient, setSignatureClient] = useState<string | null>(null);
  const [aclaracionCliente, setAclaracionCliente] = useState('');
  const [protocolTemplateId, setProtocolTemplateId] = useState<string | null>(null);
  const [protocolData, setProtocolData] = useState<ProtocolData | null>(null);
  const [protocolSelections, setProtocolSelections] = useState<ProtocolSelection[]>([]);
  const [instrumentosSeleccionados, setInstrumentosSeleccionados] = useState<InstrumentoPatronOption[]>([]);
  const [otInput, setOtInput] = useState(initialOtNumber);
  const [status, setStatus] = useState<'BORRADOR' | 'FINALIZADO'>('BORRADOR');
  const [clientConfirmed, setClientConfirmed] = useState(false);

  // Flag global readOnly: deshabilita edición solo cuando el reporte está finalizado
  const readOnly = status === 'FINALIZADO';

  // Refs
  const hasUserInteracted = useRef(false);
  const hasInitialized = useRef(false);

  const markUserInteracted = () => {
    if (!hasUserInteracted.current) {
      hasUserInteracted.current = true;
      console.log("👤 Usuario comenzó a editar");
    }
  };

  // reportState memoizado (incluye protocolSelections para autosave)
  const reportState = useMemo(() => ({
    otNumber, budgets, tipoServicio, esFacturable, tieneContrato, esGarantia,
    razonSocial, contacto, direccion, localidad, provincia, sistema,
    moduloModelo, moduloDescripcion, moduloSerie, codigoInternoCliente,
    fechaInicio, fechaFin, horaInicio, horaFin, horasTrabajadas, tiempoViaje, reporteTecnico,
    accionesTomar, articulos, emailPrincipal, signatureEngineer,
    aclaracionEspecialista, signatureClient, aclaracionCliente,
    protocolTemplateId, protocolData, protocolSelections,
    instrumentosSeleccionados
  }), [
    otNumber, budgets, tipoServicio, esFacturable, tieneContrato, esGarantia,
    razonSocial, contacto, direccion, localidad, provincia, sistema,
    moduloModelo, moduloDescripcion, moduloSerie, codigoInternoCliente,
    fechaInicio, fechaFin, horaInicio, horaFin, horasTrabajadas, tiempoViaje, reporteTecnico,
    accionesTomar, articulos, emailPrincipal, signatureEngineer,
    aclaracionEspecialista, signatureClient, aclaracionCliente,
    protocolTemplateId, protocolData, protocolSelections,
    instrumentosSeleccionados
  ]);

  const formState: ReportFormState = {
    otNumber,
    otInput,
    status,
    clientConfirmed,
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
    emailPrincipal,
    sistema,
    moduloModelo,
    moduloDescripcion,
    moduloSerie,
    codigoInternoCliente,
    fechaInicio,
    fechaFin,
    horaInicio,
    horaFin,
    horasTrabajadas,
    tiempoViaje,
    reporteTecnico,
    accionesTomar,
    articulos,
    signatureEngineer,
    aclaracionEspecialista,
    signatureClient,
    aclaracionCliente,
    protocolTemplateId,
    protocolData,
    protocolSelections,
    instrumentosSeleccionados
  };

  return {
    formState,
    setters: {
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
      setAclaracionEspecialista,
      setSignatureClient,
      setAclaracionCliente,
      setProtocolTemplateId,
      setProtocolData,
      setProtocolSelections,
      setInstrumentosSeleccionados
    },
    readOnly,
    reportState,
    hasUserInteracted,
    hasInitialized,
    markUserInteracted
  };
};
