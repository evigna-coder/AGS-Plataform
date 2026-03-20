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
  setModuloMarca: (v: string) => void;
  setModuloDescripcion: (v: string) => void;
  setModuloSerie: (v: string) => void;
}

type ManualFields = 'cliente' | 'sistema';

export function useEntitySelectors(firebase: FirebaseService, setters: FormSetters) {
  // ── IDs de selección (transitorios, no se persisten) ──
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [establecimientoId, setEstablecimientoId] = useState<string | null>(null);
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [sistemaId, setSistemaId] = useState<string | null>(null);
  const [moduloId, setModuloId] = useState<string | null>(null);
  const [contactoId, setContactoId] = useState<string | null>(null);

  // ── Datos cargados ──
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [establecimientos, setEstablecimientos] = useState<EstablecimientoOption[]>([]);
  const [sectores, setSectores] = useState<string[]>([]);
  const [allContactos, setAllContactos] = useState<ContactoOption[]>([]);
  const [contactos, setContactos] = useState<ContactoOption[]>([]);
  const [allSistemas, setAllSistemas] = useState<SistemaOption[]>([]);
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

  const sectorOptions: SelectOption[] = sectores.map(s => ({
    value: s, label: s,
  }));

  const contactoOptions: SelectOption[] = contactos.map(c => ({
    value: c.id,
    label: c.esPrincipal ? `${c.nombre} (principal)` : c.nombre,
  }));

  const sistemaOptions: SelectOption[] = sistemas.map(s => ({
    value: s.id,
    label: s.codigoInternoCliente
      ? `${s.codigoInternoCliente} (${s.nombre})`
      : s.nombre,
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
    setSelectedSector(null);
    setSistemaId(null);
    setModuloId(null);
    setEstablecimientos([]);
    setSectores([]);
    setAllContactos([]);
    setContactos([]);
    setAllSistemas([]);
    setSistemas([]);
    setModulos([]);
    setContactoId(null);
    setters.setContacto('');
    setters.setEmailPrincipal('');
    setters.setDireccion('');
    setters.setLocalidad('');
    setters.setProvincia('');
    setters.setSistema('');
    setters.setCodigoInternoCliente('');
    setters.setModuloModelo('');
    setters.setModuloMarca('');
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

    // Limpiar downstream
    setSelectedSector(null);
    setSistemaId(null);
    setModuloId(null);
    setSistemas([]);
    setAllSistemas([]);
    setModulos([]);
    setContactos([]);
    setAllContactos([]);
    setContactoId(null);
    setters.setContacto('');
    setters.setEmailPrincipal('');
    setters.setSistema('');
    setters.setCodigoInternoCliente('');
    setters.setModuloModelo('');
    setters.setModuloMarca('');
    setters.setModuloDescripcion('');
    setters.setModuloSerie('');

    // Extraer sectores del establecimiento
    const estabSectores = estab.sectores?.filter(Boolean) || [];
    setSectores(estabSectores);

    // Cargar contactos y sistemas en paralelo
    setLoadingSistemas(true);
    const [conts, syss] = await Promise.all([
      firebase.getContactosByEstablecimiento(id),
      firebase.getSistemasByEstablecimiento(id),
    ]);
    setLoadingSistemas(false);

    setAllContactos(conts);
    setAllSistemas(syss);

    // Si no hay sectores, mostrar todo directamente (flujo sin filtro)
    if (estabSectores.length === 0) {
      setContactos(conts);
      setSistemas(syss);

      const principal = conts.find(c => c.esPrincipal);
      if (principal) {
        setters.setContacto(principal.nombre);
        setters.setEmailPrincipal(principal.email || '');
      }

      if (syss.length === 1) {
        selectSistema(syss[0].id, syss);
      }
    }
    // Si hay sectores, esperar selección de sector para filtrar
  }, [establecimientos, firebase, setters]);

  const selectSector = useCallback((sector: string) => {
    setSelectedSector(sector);

    // Limpiar downstream
    setSistemaId(null);
    setModuloId(null);
    setModulos([]);
    setContactoId(null);
    setters.setContacto('');
    setters.setEmailPrincipal('');
    setters.setSistema('');
    setters.setCodigoInternoCliente('');
    setters.setModuloModelo('');
    setters.setModuloMarca('');
    setters.setModuloDescripcion('');
    setters.setModuloSerie('');

    // Filtrar contactos y sistemas por sector
    const filteredContactos = allContactos.filter(c => c.sector === sector);
    const filteredSistemas = allSistemas.filter(s => s.sector === sector);
    setContactos(filteredContactos);
    setSistemas(filteredSistemas);

    // Auto-select contacto principal del sector
    const principal = filteredContactos.find(c => c.esPrincipal);
    if (principal) {
      setters.setContacto(principal.nombre);
      setters.setEmailPrincipal(principal.email || '');
    }

    // Auto-select sistema si hay solo uno en el sector
    if (filteredSistemas.length === 1) {
      selectSistema(filteredSistemas[0].id, filteredSistemas);
    }
  }, [allContactos, allSistemas, setters]);

  const selectContacto = useCallback((id: string) => {
    const c = contactos.find(ct => ct.id === id);
    if (!c) return;
    setContactoId(id);
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
    setters.setModuloMarca('');
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
    setters.setModuloMarca(mod.marca || '');
    setters.setModuloDescripcion(mod.descripcion || '');
    setters.setModuloSerie(mod.serie || '');
  }, [modulos, setters]);

  // ── Toggle modo manual ──
  const toggleManualMode = useCallback((field: ManualFields) => {
    setManualMode(prev => ({ ...prev, [field]: !prev[field] }));
  }, []);

  // ── Intentar match con datos existentes (al cargar OT) ──
  // Reconstruye la cadena de selección sin limpiar los campos del formulario
  const tryMatchExistingData = useCallback(async (
    razonSocial: string,
    formData?: { direccion?: string; sistema?: string; moduloModelo?: string },
  ) => {
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

    if (!match) {
      setManualMode(prev => ({ ...prev, cliente: true }));
      return;
    }

    setClienteId(match.id);
    const estabs = await firebase.getEstablecimientosByCliente(match.id);
    setEstablecimientos(estabs);

    // Intentar match del establecimiento por dirección
    if (!formData?.direccion || estabs.length === 0) return;
    const estabMatch = estabs.find(
      e => e.direccion?.toLowerCase().trim() === formData.direccion!.toLowerCase().trim()
    ) || (estabs.length === 1 ? estabs[0] : null);
    if (!estabMatch) return;

    setEstablecimientoId(estabMatch.id);
    const estabSectores = estabMatch.sectores?.filter(Boolean) || [];
    setSectores(estabSectores);

    // Cargar contactos y sistemas
    const [conts, syss] = await Promise.all([
      firebase.getContactosByEstablecimiento(estabMatch.id),
      firebase.getSistemasByEstablecimiento(estabMatch.id),
    ]);
    setAllContactos(conts);
    setAllSistemas(syss);

    // Si hay sectores, filtrar por sector del sistema; si no, mostrar todo
    let visibleSistemas = syss;
    let visibleContactos = conts;
    if (estabSectores.length > 0 && formData.sistema) {
      const sysMatch = syss.find(
        s => s.nombre.toLowerCase().trim() === formData.sistema!.toLowerCase().trim()
      );
      if (sysMatch?.sector) {
        setSelectedSector(sysMatch.sector);
        visibleSistemas = syss.filter(s => s.sector === sysMatch.sector);
        visibleContactos = conts.filter(c => c.sector === sysMatch.sector);
      }
    }
    setContactos(visibleContactos);
    setSistemas(visibleSistemas);

    // Intentar match del sistema
    if (!formData.sistema) return;
    const sysMatch = visibleSistemas.find(
      s => s.nombre.toLowerCase().trim() === formData.sistema!.toLowerCase().trim()
    );
    if (!sysMatch) return;

    setSistemaId(sysMatch.id);

    // Cargar módulos
    const mods = await firebase.getModulosBySistema(sysMatch.id);
    setModulos(mods);

    // Intentar match del módulo
    if (!formData.moduloModelo) return;
    const modMatch = mods.find(
      m => m.nombre?.toLowerCase().trim() === formData.moduloModelo!.toLowerCase().trim()
    );
    if (modMatch) {
      setModuloId(modMatch.id);
    }
  }, [clientes, firebase]);

  // ── Reset completo (para nuevo reporte) ──
  const reset = useCallback(() => {
    setClienteId(null);
    setEstablecimientoId(null);
    setSelectedSector(null);
    setSistemaId(null);
    setModuloId(null);
    setEstablecimientos([]);
    setSectores([]);
    setAllContactos([]);
    setContactos([]);
    setAllSistemas([]);
    setSistemas([]);
    setModulos([]);
    setManualMode({ cliente: false, sistema: false });
  }, []);

  return {
    // IDs
    clienteId, establecimientoId, selectedSector, sistemaId, moduloId, contactoId,
    // Opciones para SmartSelect
    clienteOptions, establecimientoOptions, sectorOptions,
    contactoOptions, contactos, sistemaOptions, moduloOptions,
    // Loading
    loadingClientes, loadingEstablecimientos, loadingSistemas, loadingModulos,
    // Modo manual
    manualMode, toggleManualMode,
    // Acciones
    selectCliente, selectEstablecimiento, selectSector,
    selectContacto, selectSistema, selectModulo,
    // Utilidades
    tryMatchExistingData, reset,
  };
}
