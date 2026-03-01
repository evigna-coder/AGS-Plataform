// Tipos espejo mínimos para selectores de entidades desde Firestore
// Patrón: mismo que types/tableCatalog.ts — solo campos usados por los selectores

export interface ClienteOption {
  id: string;
  razonSocial: string;
  cuit?: string | null;
}

export interface EstablecimientoOption {
  id: string;
  clienteCuit: string;
  nombre: string;
  direccion: string;
  localidad: string;
  provincia: string;
}

export interface ContactoOption {
  id: string;
  nombre: string;
  email: string;
  esPrincipal: boolean;
}

export interface SistemaOption {
  id: string;
  establecimientoId: string;
  nombre: string;
  codigoInternoCliente: string;
}

export interface ModuloOption {
  id: string;
  sistemaId: string;
  nombre: string;
  descripcion?: string;
  serie?: string;
}

export interface SelectOption {
  value: string;
  label: string;
}
