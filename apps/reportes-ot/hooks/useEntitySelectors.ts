import { useState, useCallback, useEffect, useRef } from 'react';
import type { FirebaseService } from '../services/firebaseService';
import type {
  ClienteOption, EstablecimientoOption, ContactoOption,
  SistemaOption, ModuloOption, SelectOption,
} from '../types/entities';

interface FormSetters {
  setRazonSocial: (v: string) => void;
  setContacto: (v: string) => void;
  setSector: (v: string) => void;
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

export function useEntitySelectors(
  firebase: FirebaseService,
  setters: FormSetters,
  /**
   * Marca al usuario como "interactuó". Necesario porque los SmartSelect llaman
   * a estos select* con un string (no eventos DOM), y el autosave depende del
   * `hasUserInteracted` global. Sin esto, una selección de contacto/cliente/equipo
   * que no se siga de tipear en otro input se pierde silenciosamente.
   */
  markUserInteracted?: () => void,
) {
  // ── IDs de selección (transitorios, no se persisten) ──
  const [clienteId, setClienteId] = useState<string | null>(null);
  // Ref espejo del clienteId — los callbacks (selectEstablecimiento) leen acá
  // para evitar stale closure: cuando selectCliente() auto-dispara
  // selectEstablecimiento() para un cliente con 1 solo establecimiento, el
  // setClienteId aún no se commiteó en el closure capturado al renderizar.
  const clienteIdRef = useRef<string | null>(null);
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
    value: m.id,
    label: [
      m.nombre,
      m.descripcion,
      m.serie ? `S/N ${m.serie}` : null,
    ].filter(Boolean).join(' — '),
  }));

  // ── Acciones de selección ──

  const selectCliente = useCallback(async (id: string) => {
    const cliente = clientes.find(c => c.id === id);
    if (!cliente) return;

    setClienteId(id);
    clienteIdRef.current = id;
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
    markUserInteracted?.();
  }, [clientes, firebase, setters, markUserInteracted]);

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

    // Cargar contactos y sistemas en paralelo. Pasamos clienteId (vía ref para
    // evitar stale closure) para mergear datos legacy: contactos en
    // /clientes/{id}/contactos y sistemas vinculados por clienteCuit/clienteId
    // sin establecimientoId.
    const cliId = clienteIdRef.current ?? undefined;
    setLoadingSistemas(true);
    const [conts, syss] = await Promise.all([
      firebase.getContactosByEstablecimiento(id, cliId),
      firebase.getSistemasByEstablecimiento(id, cliId),
    ]);
    setLoadingSistemas(false);

    setAllContactos(conts);
    setAllSistemas(syss);

    // Contactos no se filtran por sector (paridad con sistema-modular Tickets / Edit OT).
    setContactos(conts);
    const principal = conts.find(c => c.esPrincipal);
    if (principal) {
      setters.setContacto(principal.nombre);
      setters.setEmailPrincipal(principal.email || '');
    }

    // Sistemas: si no hay sectores, mostrar todo y auto-seleccionar si hay uno solo.
    // Si hay sectores, esperar selección de sector para filtrar sistemas.
    if (estabSectores.length === 0) {
      setSistemas(syss);
      if (syss.length === 1) {
        selectSistema(syss[0].id, syss);
      }
    }
    markUserInteracted?.();
  }, [establecimientos, firebase, setters, markUserInteracted]);

  const selectSector = useCallback((sector: string) => {
    setSelectedSector(sector);
    setters.setSector(sector);

    // Limpiar solo downstream del equipo. El contacto NO se limpia: los
    // contactos no se filtran por sector (paridad con sistema-modular).
    setSistemaId(null);
    setModuloId(null);
    setModulos([]);
    setters.setSistema('');
    setters.setCodigoInternoCliente('');
    setters.setModuloModelo('');
    setters.setModuloMarca('');
    setters.setModuloDescripcion('');
    setters.setModuloSerie('');

    // Filtrar sistemas por sector. Incluimos también los que no tienen sector
    // definido (legacy data sin migrar) — sin esto, sistemas viejos quedan
    // invisibles para cualquier sector elegido.
    const isUnassigned = (val: any) => val == null || val === '';
    const filteredSistemas = allSistemas.filter(s => s.sector === sector || isUnassigned(s.sector));
    setSistemas(filteredSistemas);

    // Auto-select sistema si hay solo uno en el sector
    if (filteredSistemas.length === 1) {
      selectSistema(filteredSistemas[0].id, filteredSistemas);
    }
    markUserInteracted?.();
  }, [allSistemas, setters, markUserInteracted]);

  const selectContacto = useCallback((id: string) => {
    const c = contactos.find(ct => ct.id === id);
    if (!c) return;
    setContactoId(id);
    setters.setContacto(c.nombre);
    setters.setEmailPrincipal(c.email || '');
    markUserInteracted?.();
  }, [contactos, setters, markUserInteracted]);

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
    markUserInteracted?.();
  }, [sistemas, firebase, setters, markUserInteracted]);

  const selectModulo = useCallback((id: string, modsOverride?: ModuloOption[]) => {
    const list = modsOverride || modulos;
    const mod = list.find(m => m.id === id);
    if (!mod) return;
    setModuloId(id);
    setters.setModuloModelo(mod.nombre || '');
    setters.setModuloMarca(mod.marca || '');
    setters.setModuloDescripcion(mod.descripcion || '');
    setters.setModuloSerie(mod.serie || '');
    markUserInteracted?.();
  }, [modulos, setters, markUserInteracted]);

  // ── Toggle modo manual ──
  const toggleManualMode = useCallback((field: ManualFields) => {
    setManualMode(prev => ({ ...prev, [field]: !prev[field] }));
  }, []);

  // ── Intentar match con datos existentes (al cargar OT) ──
  // Reconstruye la cadena de selección sin limpiar los campos del formulario
  const tryMatchExistingData = useCallback(async (
    razonSocial: string,
    formData?: {
      direccion?: string;
      sistema?: string;
      codigoInternoCliente?: string;
      moduloModelo?: string;
      moduloSerie?: string;
      moduloDescripcion?: string;
      moduloMarca?: string;
      contacto?: string;
    },
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
    clienteIdRef.current = match.id;
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

    // Cargar contactos y sistemas (pasamos clienteId para merge legacy)
    const [conts, syss] = await Promise.all([
      firebase.getContactosByEstablecimiento(estabMatch.id, match.id),
      firebase.getSistemasByEstablecimiento(estabMatch.id, match.id),
    ]);
    setAllContactos(conts);
    setAllSistemas(syss);

    // Helper para buscar sistema: primero por nombre + código interno, luego solo nombre
    const sistemaTarget = formData.sistema?.toLowerCase().trim() || '';
    const codigoTarget = formData.codigoInternoCliente?.toLowerCase().trim() || '';
    const findSistema = (list: typeof syss) =>
      (codigoTarget && list.find(s =>
        s.nombre.toLowerCase().trim() === sistemaTarget &&
        (s.codigoInternoCliente?.toLowerCase().trim() || '') === codigoTarget
      )) ||
      list.find(s => s.nombre.toLowerCase().trim() === sistemaTarget);

    // Sistemas: filtrar por sector del sistema si hay sectores; si no, mostrar todo.
    // Contactos: no se filtran por sector (paridad con sistema-modular).
    let visibleSistemas = syss;
    if (estabSectores.length > 0 && formData.sistema) {
      const sysForSector = findSistema(syss);
      if (sysForSector?.sector) {
        setSelectedSector(sysForSector.sector);
        setters.setSector(sysForSector.sector);
        visibleSistemas = syss.filter(s => s.sector === sysForSector.sector);
      }
    }
    setContactos(conts);
    setSistemas(visibleSistemas);

    // Intentar match del contacto guardado contra la lista del establecimiento.
    // Sin esto, al recargar una OT el dropdown queda en placeholder aunque
    // `contacto` esté persistido — el componente cree que no hay selección.
    // Si no matchea (contacto tipeado a mano), contactoId queda null y la UI
    // cae en modo manual implícito para mostrar el nombre cargado.
    if (formData.contacto) {
      const contactoTarget = formData.contacto.toLowerCase().trim();
      const contactoMatch = conts.find(
        c => c.nombre.toLowerCase().trim() === contactoTarget
      );
      if (contactoMatch) {
        setContactoId(contactoMatch.id);
      }
    }

    // Intentar match del sistema
    if (!formData.sistema) return;
    const sysMatch = findSistema(visibleSistemas);
    if (!sysMatch) return;

    setSistemaId(sysMatch.id);

    // Cargar módulos
    const mods = await firebase.getModulosBySistema(sysMatch.id);
    setModulos(mods);

    // Intentar match del módulo (por nombre + serie para desambiguar duplicados)
    if (!formData.moduloModelo) return;
    const nombreTarget = formData.moduloModelo.toLowerCase().trim();
    const serieTarget = formData.moduloSerie?.toLowerCase().trim() || '';
    const modMatch =
      // Primero intentar match exacto por nombre + serie
      mods.find(m =>
        m.nombre?.toLowerCase().trim() === nombreTarget &&
        (m.serie?.toLowerCase().trim() || '') === serieTarget
      ) ||
      // Fallback: match solo por nombre (si no hay serie o no matchea)
      mods.find(m => m.nombre?.toLowerCase().trim() === nombreTarget);
    if (modMatch) {
      setModuloId(modMatch.id);
      // Backfill: si el snapshot del reporte tiene los campos descriptivos vacíos
      // (típicamente porque la OT se finalizó antes de que cargaran esos datos
      // en sistema-modular), los rellenamos desde el módulo live. Solo si están
      // vacíos en el reporte — no pisamos texto que el técnico haya cargado a mano.
      if (!formData.moduloDescripcion?.trim() && modMatch.descripcion) {
        setters.setModuloDescripcion(modMatch.descripcion);
      }
      if (!formData.moduloMarca?.trim() && modMatch.marca) {
        setters.setModuloMarca(modMatch.marca);
      }
    }
  }, [clientes, firebase, setters]);

  // ── Reset completo (para nuevo reporte) ──
  const reset = useCallback(() => {
    setClienteId(null);
    clienteIdRef.current = null;
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

  // ── Derivados del cliente seleccionado ──
  const clienteRequiereTrazabilidad =
    !!clienteId && !!clientes.find(c => c.id === clienteId)?.requiereTrazabilidad;

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
    // Derivados
    clienteRequiereTrazabilidad,
    // Utilidades
    tryMatchExistingData, reset,
  };
}
