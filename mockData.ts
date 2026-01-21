
import { Customer, Equipment } from './types';

export const MOCK_CUSTOMERS: Customer[] = [
  {
    id: 'C1',
    razonSocial: 'Laboratorios Farmacéuticos S.A.',
    contacto: 'Ing. María López',
    telefono: '+54 11 4567-8900',
    email: 'm.lopez@labfarma.com',
    direccion: 'Av. Corrientes 1234, CABA'
  },
  {
    id: 'C2',
    razonSocial: 'Instituto de Química Avanzada',
    contacto: 'Dr. Roberto Gómez',
    telefono: '+54 351 987-6543',
    email: 'rgomez@iqa.edu.ar',
    direccion: 'Ciudad Universitaria, Córdoba'
  },
  {
    id: 'C3',
    razonSocial: 'BioTech Solutions',
    contacto: 'Lic. Ana Pires',
    telefono: '+54 11 5555-4444',
    email: 'apires@biotech.com.ar',
    direccion: 'Parque Industrial Pilar, Lote 45'
  }
];

export const MOCK_EQUIPMENT: Equipment[] = [
  {
    id: 'E1',
    modelo: 'HPLC 1260 Infinity II',
    marca: 'Agilent',
    nroSerie: 'SG-1260-MAIN-01',
    configuracion: 'Sistema Cuaternario Completo',
    customerId: 'C1',
    modules: [
      { id: 'M1', descripcion: 'Bomba Cuaternaria', modelo: 'G1311B', nroSerie: 'BOMB-X9988' },
      { id: 'M2', descripcion: 'Inyector Automático', modelo: 'G1367A', nroSerie: 'INJ-Y7766' },
      { id: 'M3', descripcion: 'Detector de Arreglo de Diodos', modelo: 'G4212B', nroSerie: 'DET-Z5544' }
    ]
  },
  {
    id: 'E2',
    modelo: 'Nexera X2',
    marca: 'Shimadzu',
    nroSerie: 'UHPLC-2023-001',
    configuracion: 'Detector PDA, Columna C18 150mm, Auto-sampler',
    customerId: 'C1',
    modules: [
      { id: 'M4', descripcion: 'Bomba de alta presión', modelo: 'LC-30AD', nroSerie: 'SN-002233' },
      { id: 'M5', descripcion: 'Detector de Fluorescencia', modelo: 'RF-20A', nroSerie: 'SN-445566' }
    ]
  },
  {
    id: 'E3',
    modelo: 'DMA 4500 M',
    marca: 'Anton Paar',
    nroSerie: 'DEN-889922',
    configuracion: 'Celda de medición de alta precisión, Control de T° automático',
    customerId: 'C2'
  }
];
