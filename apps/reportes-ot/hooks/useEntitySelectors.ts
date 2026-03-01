import { useState, useCallback, useEffect, useRef } from 'react';
import type { FirebaseService } from '../services/firebaseService';
import type {
  ClienteOption, EstablecimientoOption, ContactoOption,
  SistemaOption, ModuloOption, SelectOption,
} from '../types/entities';

interface FormSetters {
  setRazonSocial: (v: string) => void;
  setContacto: (v: string) => void;
  setEmailPrincipal: (v: string) => void;
  setDireccion: (v: string) => void;
  setLocalidad: (v: string) => void;
  setProvincia: (v: string) => void;
  setSistema: (v: string) => void;
  setCodigoInternoCliente: (v: string) => void;
  setModuloModelo: (v: string) => void;
  setModuloDescripcion: (v: string) => void;
  setModuloSerie: (v: string) => void;
}

type ManualFields = 'cliente' | 'sistema';

export function useEntitySelectors(firebase: FirebaseService, setters: FormSetters) {
  // ── IDs de selección (transitorios, no se persisten) ──
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [establecimientoId, setEstablecimientoId] = useState<string | null>(null);
  const [sistemaId, setSistemaId] = useState<string | null>(null);
  const [moduloId, setModuloId] = useState<string | null>(null);

  // ── Datos cargados ──
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [establecimientos, setEstablecimientos] = useState<EstablecimientoOption[]>([]);
  const [contactos, setContactos] = useState<ContactoOption[]>([]);
  const [sistemas, setSistemas] = useState<SistemaOption[]>([]);
  const [modulos, setModulos] = useState<ModuloOption[]>([]);

  // ── Loading ──
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [loadingEstablecimientos, setLoadingEstablecimientos] = useState(false);
  const [loadingSistemas, setLoadingSistemas] = useState(false);
  const [loadingModulos, setLoadingModulos] = useState(false);

  // ── Modo manual ──
  const [manualMode, setManualMode] = useState<Record<ManualFields, boolean>>({
    cliente: false,
    sistema: false,
  });

  const clientesLoaded = useRef(false);

  // ── Cargar clientes una sola vez ──
  const loadClientes = useCallback(async () => {
    if (clientesLoaded.current) return;
    setLoadingClientes(true);
    try {
      const data = await firebase.getClientes();
      setClientes(data);
      clientesLoaded.current = true;
    } finally {
      setLoadingClientes(false);
    }
  }, [firebase]);

  useEffect(() => { loadClientes(); }, [loadClientes]);

  // ── Opciones formateadas para SmartSelect ──
  const clienteOptions: SelectOption[] = clientes.map(c => ({
    value: c.id,
    label: c.cuit ? `${c.razonSocial} (${c.cuit})` : c.razonSocial,
  }));

  const establecimientoOptions: SelectOption[] = establecimientos.map(e => ({
    value: e.id, label: e.nombre,
  }));

  const contactoOptions: SelectOption[] = contactos.map(c => ({
    value: c.id,
    label: c.esPrincipal ? `${c.nombre} (principal)` : c.nombre,
  }));

  const sistemaOptions: SelectOption[] = sistemas.map(s => ({
    value: s.id, label: s.nombre,
  }));

  const moduloOptions: SelectOption[] = modulos.map(m => ({
    value: m.id, label: m.nombre + (m.serie ? ` — S/N ${m.serie}` : ''),
  }));

  // ── Acciones de selección ──

  const selectCliente = useCallback(async (id: string) => {
    const cliente = clientes.find(c => c.id === id);
    if (!cliente) return;

    setClienteId(id);
    setters.setRazonSocial(cliente.razonSocial);

    // Limpiar downstream
    setEstablecimientoId(null);
    setSistemaId(null);
    setModuloId(null);
    setEstablecimientos([]);
    setContactos([]);
    setSistemas([]);
    setModulos([]);
    setters.setContacto('');
    setters.setEmailPrincipal('');
    setters.setDireccion('');
    setters.setLocalidad('');
    setters.setProvincia('');
    setters.setSistema('');
    setters.setCodigoInternoCliente('');
    setters.setModuloModelo('');
    setters.setModuloDescripcion('');
    setters.setModuloSerie('');

    // Cargar establecimientos
    setLoadingEstablecimientos(true);
    try {
      const estabs = await firebase.getEstablecimientosByCliente(id);
      setEstablecimientos(estabs);
      // Auto-select si hay solo uno
      if (estabs.length === 1) {
        selectEstablecimiento(estabs[0].id, estabs);
      }
    } finally {
      setLoadingEstablecimientos(false);
    }
  }, [clientes, firebase, setters]);

  const selectEstablecimiento = useCallback(async (
    id: string,
    estabsOverride?: EstablecimientoOption[],
  ) => {
    const list = estabsOverride || establecimientos;
    const estab = list.find(e => e.id === id);
    if (!estab) return;

    setEstablecimientoId(id);
    setters.setDireccion(estab.direccion || '');
    setters.setLocalidad(estab.localidad || '');
    setters.setProvincia(estab.provincia || '');

    // Limpiar downstream equipo
    setSistemaId(null);
    setModuloId(null);
    setSistemas([]);
    setModulos([]);
    setters.setSistema('');
    setters.setCodigoInternoCliente('');
    setters.setModuloModelo('');
    setters.setModuloDescripcion('');
    setters.setModuloSerie('');

    // Cargar contactos y sistemas en paralelo
    const [conts, syss] = await Promise.all([
      firebase.getContactosByEstablecimiento(id),
      (setLoadingSistemas(true), firebase.getSistemasByEstablecimiento(id)),
    ]);

    setContactos(conts);
    setSistemas(syss);
    setLoadingSistemas(false);

    // Auto-select contacto principal
    const principal = conts.find(c => c.esPrincipal);
    if (principal) {
      setters.setContacto(principal.nombre);
      setters.setEmailPrincipal(principal.email || '');
    }

    // Auto-select sistema si hay solo uno
    if (syss.length === 1) {
      selectSistema(syss[0].id, syss);
    }
  }, [establecimientos, firebase, setters]);

  const selectContacto = useCallback((id: string) => {
    const c = contactos.find(ct => ct.id === id);
    if (!c) return;
    setters.setContacto(c.nombre);
    setters.setEmailPrincipal(c.email || '');
  }, [contactos, setters]);

  const selectSistema = useCallback(async (
    id: string,
    sysOverride?: SistemaOption[],
  ) => {
    const list = sysOverride || sistemas;
    const sys = list.find(s => s.id === id);
    if (!sys) return;

    setSistemaId(id);
    setters.setSistema(sys.nombre);
    setters.setCodigoInternoCliente(sys.codigoInternoCliente || '');

    // Limpiar módulo
    setModuloId(null);
    setModulos([]);
    setters.setModuloModelo('');
    setters.setModuloDescripcion('');
    setters.setModuloSerie('');

    // Cargar módulos
    setLoadingModulos(true);
    try {
      const mods = await firebase.getModulosBySistema(id);
      setModulos(mods);
      if (mods.length === 1) selectModulo(mods[0].id, mods);
    } finally {
      setLoadingModulos(false);
    }
  }, [sistemas, firebase, setters]);

  const selectModulo = useCallback((id: string, modsOverride?: ModuloOption[]) => {
    const list = modsOverride || modulos;
    const mod = list.find(m => m.id === id);
    if (!mod) return;
    setModuloId(id);
    setters.setModuloModelo(mod.nombre || '');
    setters.setModuloDescripcion(mod.descripcion || '');
    setters.setModuloSerie(mod.serie || '');
  }, [modulos, setters]);

  // ── Toggle modo manual ──
  const toggleManualMode = useCallback((field: ManualFields) => {
    setManualMode(prev => ({ ...prev, [field]: !prev[field] }));
  }, []);

  // ── Intentar match con datos existentes (al cargar OT) ──
  const tryMatchExistingData = useCallback(async (razonSocial: string) => {
    if (!razonSocial.trim()) return;

    // Asegurar que los clientes estén cargados
    let clientesList = clientes;
    if (clientesList.length === 0) {
      setLoadingClientes(true);
      try {
        clientesList = await firebase.getClientes();
        setClientes(clientesList);
        clientesLoaded.current = true;
      } finally {
        setLoadingClientes(false);
      }
    }

    // Buscar match exacto por razonSocial
    const match = clientesList.find(
      c => c.razonSocial.toLowerCase().trim() === razonSocial.toLowerCase().trim()
    );

    if (match) {
      setClienteId(match.id);
      // Cargar establecimientos sin limpiar campos (ya están hydrated)
      const estabs = await firebase.getEstablecimientosByCliente(match.id);
      setEstablecimientos(estabs);
    } else {
      // No match → modo manual
      setManualMode(prev => ({ ...prev, cliente: true }));
    }
  }, [clientes, firebase]);

  // ── Reset completo (para nuevo reporte) ──
  const reset = useCallback(() => {
    setClienteId(null);
    setEstablecimientoId(null);
    setSistemaId(null);
    setModuloId(null);
    setEstablecimientos([]);
    setContactos([]);
    setSistemas([]);
    setModulos([]);
    setManualMode({ cliente: false, sistema: false });
  }, []);

  return {
    // IDs
    clienteId, establecimientoId, sistemaId, moduloId,
    // Opciones para SmartSelect
    clienteOptions, establecimientoOptions, contactoOptions,
    sistemaOptions, moduloOptions,
    // Loading
    loadingClientes, loadingEstablecimientos, loadingSistemas, loadingModulos,
    // Modo manual
    manualMode, toggleManualMode,
    // Acciones
    selectCliente, selectEstablecimiento, selectContacto,
    selectSistema, selectModulo,
    // Utilidades
    tryMatchExistingData, reset,
  };
}
