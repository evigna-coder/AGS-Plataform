
export interface Module {
  id: string;
  modelo: string;
  descripcion: string;
  nroSerie: string;
}

export interface Customer {
  id: string;
  razonSocial: string;
  contacto: string;
  telefono: string;
  email: string;
  direccion: string;
}

export interface Equipment {
  id: string;
  modelo: string;
  marca: string;
  nroSerie: string;
  configuracion: string;
  customerId: string;
  modules?: Module[];
}

export interface Part {
  id: string;
  codigo: string;
  descripcion: string;
  nroSerie?: string;
  cantidad: number;
  origen: string;
}

export interface ServiceReport {
  id: string;
  otNumber: string;
  budgetNumber: string;
  fechaInicio: string;
  fechaFin: string;
  horasTrabajadas: string;
  tiempoViaje: string;
  customerId: string;
  equipmentId: string;
  reporteTecnico: string;
  articulos: Part[];
  accionesTomar: string;
  esFacturable: boolean;
  tieneContrato: boolean;
}
