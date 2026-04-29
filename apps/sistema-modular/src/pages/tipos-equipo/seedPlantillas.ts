// (Phase 4 / ANXC-04) Las plantillas seed NO marcan requiereAnexoConsumibles por default.
// El flag es opcional en TipoEquipoServicio; el operador lo tilda caso por caso desde la UI
// de plantillas (`/presupuestos/tipos-equipo`). Marcar default=true generaría falsos positivos
// al cargar el seed (anexos disparados sin haberlos modelado en consumiblesPorModulo).
import { tiposEquipoService } from '../../services/tiposEquipoService';
import type { TipoEquipoPlantilla } from '@ags/shared';

type PlantillaSeed = Omit<TipoEquipoPlantilla, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Plantillas iniciales derivadas del PDF real de contrato (CATCN0016R15C - Catalent).
 * Cubre los tipos de equipo más comunes del parque de AGS Analítica.
 * El usuario puede editarlas libremente después de cargarlas.
 */
const gen = () => crypto.randomUUID();

// Servicios estándar para HPLC (reutilizados en 1100, 1200, 1260)
const hplcServicios = (suffix: string) => [
  { id: gen(), orden: 10, servicioCode: `MP1_CN_${suffix}B`, descripcion: `Mantenimiento Preventivo - HPLC ${suffix} Con ALS`, cantidadDefault: 1, tipo: 'mantenimiento' as const, precioDefault: null },
  { id: gen(), orden: 11, servicioCode: `MP3_SN_${suffix}B`, descripcion: `Mantenimiento Preventivo sin consumibles - HPLC ${suffix}`, cantidadDefault: 1, tipo: 'mantenimiento' as const, precioDefault: null },
  { id: gen(), orden: 20, servicioCode: `SR2_CN_${suffix}`, descripcion: `Validación HPLC ${suffix}`, cantidadDefault: 1, tipo: 'regulatorio' as const, precioDefault: null },
  { id: gen(), orden: 21, servicioCode: `SR3_CN_${suffix}`, descripcion: `Recalificación post-reparación HPLC ${suffix}`, cantidadDefault: 0, tipo: 'regulatorio' as const, precioDefault: null },
];

export const PLANTILLAS_INICIALES: PlantillaSeed[] = [
  {
    nombre: 'HPLC 1100',
    descripcion: 'Cromatógrafo Agilent 1100 Series',
    activo: true,
    componentes: [
      { id: gen(), orden: 2, codigo: 'G1322A', descripcion: 'Desgasificador Estándar - HPLC 1100', servicioCode: 'AT1_DEG_11A' },
      { id: gen(), orden: 3, codigo: 'G1312A', descripcion: 'Bomba Binaria - HPLC 1100', servicioCode: 'AT1_BIN_11' },
      { id: gen(), orden: 4, codigo: 'G1311A', descripcion: 'Bomba Cuaternaria - HPLC 1100', servicioCode: 'AT1_CUA_11' },
      { id: gen(), orden: 5, codigo: 'G1313A', descripcion: 'Inyector Automático ALS - HPLC 1100', servicioCode: 'AT1_ALS_11A' },
      { id: gen(), orden: 6, codigo: 'G1316A', descripcion: 'Compartimiento de Columnas S/SV - HPLC 1100', servicioCode: 'AT1_TCC_11A' },
      { id: gen(), orden: 7, codigo: 'G1315A', descripcion: 'Detector DAD - HPLC 1100', servicioCode: 'AT1_DAD_11' },
      { id: gen(), orden: 8, codigo: 'G1314A', descripcion: 'Detector VWD - HPLC 1100', servicioCode: 'AT1_VWD_11' },
    ],
    servicios: hplcServicios('11'),
  },
  {
    nombre: 'HPLC 1200',
    descripcion: 'Cromatógrafo Agilent 1200 Series',
    activo: true,
    componentes: [
      { id: gen(), orden: 2, codigo: 'G1322A', descripcion: 'Desgasificador - HPLC 1200', servicioCode: 'AT1_DEG_12B' },
      { id: gen(), orden: 3, codigo: 'G1311A', descripcion: 'Bomba Cuaternaria - HPLC 1200', servicioCode: 'AT1_CUA_12' },
      { id: gen(), orden: 4, codigo: 'G1312B', descripcion: 'Bomba Binaria - HPLC 1200', servicioCode: 'AT1_BIN_12' },
      { id: gen(), orden: 5, codigo: 'G1329A', descripcion: 'Inyector Automático Termostatizado ALS - HPLC 1200', servicioCode: 'AT1_ALS_12B' },
      { id: gen(), orden: 6, codigo: 'G1330B', descripcion: 'Módulo de Termostatizacion ALS - HPLC 1200', servicioCode: 'AT1_THM_12' },
      { id: gen(), orden: 7, codigo: 'G1316A', descripcion: 'Compartimiento de Columnas S/SV - HPLC 1200', servicioCode: 'AT1_TCC_12A' },
      { id: gen(), orden: 8, codigo: 'G1315D', descripcion: 'Detector DAD - HPLC 1200', servicioCode: 'AT1_DAD_12' },
    ],
    servicios: hplcServicios('12'),
  },
  {
    nombre: 'HPLC 1260 Infinity',
    descripcion: 'Cromatógrafo Agilent 1260 Infinity',
    activo: true,
    componentes: [
      { id: gen(), orden: 2, codigo: 'G1311B', descripcion: 'Bomba Cuaternaria - HPLC 1260', servicioCode: 'AT1_CUA_60' },
      { id: gen(), orden: 3, codigo: 'G1329B', descripcion: 'Inyector Automático Termostatizado ALS - HPLC 1260', servicioCode: 'AT1_ALS_60B' },
      { id: gen(), orden: 4, codigo: 'G1330B', descripcion: 'Módulo de Termostatizacion ALS - HPLC 1260', servicioCode: 'AT1_THM_60' },
      { id: gen(), orden: 5, codigo: 'G7116A', descripcion: 'Compartimiento de Columnas S/SV - HPLC 1260', servicioCode: 'AT1_TCC_60A' },
      { id: gen(), orden: 6, codigo: 'G1314F', descripcion: 'Detector VWD - HPLC 1260', servicioCode: 'AT1_VWD_60' },
      { id: gen(), orden: 7, codigo: 'G7162A', descripcion: 'Detector RID - HPLC 1260', servicioCode: 'AT1_RID_60' },
    ],
    servicios: hplcServicios('60'),
  },
  {
    nombre: 'UV/VIS 8453',
    descripcion: 'Espectrofotómetro Agilent UV/Vis 8453',
    activo: true,
    componentes: [
      { id: gen(), orden: 2, codigo: 'N/D', descripcion: 'Software Chemstation', servicioCode: 'AT1_EZC_01' },
    ],
    servicios: [
      { id: gen(), orden: 10, servicioCode: 'MP1_CN_53', descripcion: 'Mantenimiento Preventivo Espectrofotómetro - UV/VIS 8453', cantidadDefault: 2, tipo: 'mantenimiento', precioDefault: null },
      { id: gen(), orden: 20, servicioCode: 'SR2_CN_53', descripcion: 'Validación Espectrofotómetro', cantidadDefault: 2, tipo: 'regulatorio', precioDefault: null },
      { id: gen(), orden: 21, servicioCode: 'SR3_CN_53', descripcion: 'Recalificación post-reparación - UV/VIS 8453', cantidadDefault: 0, tipo: 'regulatorio', precioDefault: null },
    ],
  },
  {
    nombre: 'UV/VIS G6860A',
    descripcion: 'Espectrofotómetro Agilent UV/Vis G6860A (Cary)',
    activo: true,
    componentes: [
      { id: gen(), orden: 2, codigo: 'N/D', descripcion: 'Software Chemstation', servicioCode: 'AT1_EZC_01' },
    ],
    servicios: [
      { id: gen(), orden: 10, servicioCode: 'MP1_CN_68', descripcion: 'Mantenimiento Preventivo Espectrofotómetro - UV/VIS G6860A', cantidadDefault: 2, tipo: 'mantenimiento', precioDefault: null },
      { id: gen(), orden: 20, servicioCode: 'SR2_CN_68', descripcion: 'Validación Espectrofotómetro', cantidadDefault: 2, tipo: 'regulatorio', precioDefault: null },
      { id: gen(), orden: 21, servicioCode: 'SR3_CN_68', descripcion: 'Recalificación post-reparación - UV/VIS G6860A', cantidadDefault: 0, tipo: 'regulatorio', precioDefault: null },
    ],
  },
  {
    nombre: 'GC 6890',
    descripcion: 'Cromatógrafo de Gases Agilent 6890',
    activo: true,
    componentes: [
      { id: gen(), orden: 2, codigo: 'PDI SSL', descripcion: 'Puerto de Inyección - SSL', servicioCode: 'AT1_PDI_SSL' },
      { id: gen(), orden: 3, codigo: 'DET FID', descripcion: 'Detector FID', servicioCode: 'AT1_DET_FID' },
      { id: gen(), orden: 4, codigo: 'G2613A', descripcion: 'Módulo Inyector Automático 7683B', servicioCode: 'AT1_INA_03' },
      { id: gen(), orden: 5, codigo: 'G1512A', descripcion: 'Controlador HP 7673B', servicioCode: 'AT1_CON_02' },
      { id: gen(), orden: 6, codigo: 'G2614A', descripcion: 'Bandeja de 100 viales', servicioCode: 'AT1_100_02' },
    ],
    servicios: [
      { id: gen(), orden: 10, servicioCode: 'MP1_CN_68', descripcion: 'Mantenimiento Preventivo - GC 6890', cantidadDefault: 2, tipo: 'mantenimiento', precioDefault: null },
      { id: gen(), orden: 20, servicioCode: 'SR2_CN_68', descripcion: 'Validación GC 6890', cantidadDefault: 1, tipo: 'regulatorio', precioDefault: null },
      { id: gen(), orden: 21, servicioCode: 'SR3_CN_68', descripcion: 'Recalificación post-reparación GC 6890', cantidadDefault: 0, tipo: 'regulatorio', precioDefault: null },
    ],
  },
  {
    nombre: 'GC 8890A',
    descripcion: 'Cromatógrafo de Gases Agilent 8890A',
    activo: true,
    componentes: [
      { id: gen(), orden: 2, codigo: 'PDI SSL', descripcion: 'Puerto de Inyección - SSL', servicioCode: 'AT1_PDI_SSL' },
      { id: gen(), orden: 3, codigo: 'DET FID', descripcion: 'Detector FID', servicioCode: 'AT1_DET_FID' },
      { id: gen(), orden: 4, codigo: 'G4567A', descripcion: 'Módulo Inyector Automático G4567A', servicioCode: 'AT1_INA_03' },
      { id: gen(), orden: 5, codigo: 'G4556-64009', descripcion: 'Muestrador HSS 7697A', servicioCode: 'AT1_HSS_02' },
    ],
    servicios: [
      { id: gen(), orden: 10, servicioCode: 'MP1_CN_88', descripcion: 'Mantenimiento Preventivo - GC 8890', cantidadDefault: 2, tipo: 'mantenimiento', precioDefault: null },
      { id: gen(), orden: 11, servicioCode: 'MP3_SC_88', descripcion: 'Mantenimiento Preventivo sin consumibles HSS 7697A', cantidadDefault: 2, tipo: 'mantenimiento', precioDefault: null },
      { id: gen(), orden: 20, servicioCode: 'SR2_CN_88', descripcion: 'Validación GC 8890 - HSS', cantidadDefault: 1, tipo: 'regulatorio', precioDefault: null },
      { id: gen(), orden: 21, servicioCode: 'SR3_CN_88', descripcion: 'Recalificación post-reparación GC 8890-HSS', cantidadDefault: 0, tipo: 'regulatorio', precioDefault: null },
    ],
  },
];

/** Crea todas las plantillas iniciales en Firestore. Devuelve la cantidad creada. */
export async function seedPlantillasIniciales(): Promise<number> {
  let count = 0;
  for (const plantilla of PLANTILLAS_INICIALES) {
    await tiposEquipoService.create(plantilla);
    count++;
  }
  return count;
}
