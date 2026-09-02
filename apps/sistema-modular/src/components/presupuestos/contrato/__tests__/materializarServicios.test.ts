/**
 * materializarServiciosPorSistema (2026-09-02): una lista de servicios cargada
 * UNA vez se replica a varios equipos del contrato. Lo que se verifica acá es
 * lo que rompe el PDF si sale mal: grupos correlativos, subItems por grupo,
 * ids unicos, y los datos del equipo estampados en cada copia (incluida la
 * serie del modulo principal, que ancla el S/N del header de la card).
 */
import type { ModuloSistema, PresupuestoItem, Sistema } from '@ags/shared';
import { materializarServiciosPorSistema, nextGrupoNumber } from '../contratoItemHelpers';

let ok = 0;
let fail = 0;
function check(nombre: string, cond: boolean) {
  if (cond) { ok++; } else { fail++; console.error(`  ❌ ${nombre}`); }
}
function eq(nombre: string, a: unknown, b: unknown) {
  const igual = JSON.stringify(a) === JSON.stringify(b);
  if (!igual) console.error(`  ❌ ${nombre}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
  igual ? ok++ : fail++;
}

const sistema = (id: string, nombre: string, extra: Partial<Sistema> = {}) =>
  ({ id, nombre, ...extra }) as Sistema;

const servicio = (codigo: string, precio: number, cantidad = 1): PresupuestoItem => ({
  id: `tmp-${codigo}`,
  codigoProducto: codigo,
  descripcion: `Servicio ${codigo}`,
  cantidad,
  unidad: 'servicio',
  precioUnitario: precio,
  subtotal: cantidad * precio,
  servicioCode: codigo,
  grupo: 0,
  subItem: '',
} as PresupuestoItem);

const plantilla = [servicio('MP1', 100), servicio('MP2', 200), servicio('CO1', 50, 2)];

const equipos = [
  sistema('s1', 'HPLC 1100', { codigoInternoCliente: 'EQ-01', sector: ' Control de Calidad ' }),
  sistema('s2', 'HPLC 1260', { codigoInternoCliente: 'EQ-02' }),
  sistema('s3', 'GC 7890'),
];

const modulos = new Map<string, ModuloSistema[]>([
  ['s1', [{ id: 'm1', nombre: 'Bomba', serie: 'SN-111' } as ModuloSistema,
          { id: 'm2', nombre: 'Detector', serie: 'SN-999' } as ModuloSistema]],
  ['s2', [{ id: 'm3', nombre: 'Bomba', serie: 'SN-222' } as ModuloSistema]],
  // s3 sin modulos cargados a proposito
]);

console.log('materializarServiciosPorSistema');

const items = materializarServiciosPorSistema({
  plantilla, sistemas: equipos, modulosPorSistema: modulos, grupoBase: 1,
});

// --- Cantidad y reparto ---
eq('3 servicios x 3 equipos = 9 items', items.length, 9);
eq('3 items por equipo', equipos.map(e => items.filter(i => i.sistemaId === e.id).length), [3, 3, 3]);

// --- Grupos correlativos, uno por equipo ---
eq('grupos 1,2,3', [...new Set(items.map(i => i.grupo))], [1, 2, 3]);
eq('cada equipo en un unico grupo',
  equipos.map(e => [...new Set(items.filter(i => i.sistemaId === e.id).map(i => i.grupo))].length), [1, 1, 1]);
eq('subItems del grupo 2', items.filter(i => i.grupo === 2).map(i => i.subItem), ['2.1', '2.2', '2.3']);

// --- grupoBase respeta lo ya cargado ---
const yaCargados = [{ grupo: 1 } as PresupuestoItem, { grupo: 7 } as PresupuestoItem];
eq('nextGrupoNumber sobre items existentes', nextGrupoNumber(yaCargados), 8);
const conBase = materializarServiciosPorSistema({
  plantilla, sistemas: equipos.slice(0, 2), modulosPorSistema: modulos, grupoBase: 8,
});
eq('arranca en el grupo libre', [...new Set(conBase.map(i => i.grupo))], [8, 9]);
eq('subItem usa el grupo nuevo', conBase[0].subItem, '8.1');

// --- Ids unicos (si se repiten, React pisa filas y el borrado saca dos) ---
eq('ids unicos', new Set(items.map(i => i.id)).size, 9);
check('ningun id de la plantilla sobrevive', items.every(i => !i.id.startsWith('tmp-')));

// --- Precios y cantidades replicados tal cual ---
const g1 = items.filter(i => i.grupo === 1);
const g3 = items.filter(i => i.grupo === 3);
eq('precios iguales en todos los equipos', g1.map(i => i.precioUnitario), g3.map(i => i.precioUnitario));
eq('cantidades iguales en todos los equipos', g1.map(i => i.cantidad), g3.map(i => i.cantidad));
eq('subtotales replicados', g3.map(i => i.subtotal), [100, 200, 100]);
eq('codigos en orden de carga', g3.map(i => i.codigoProducto), ['MP1', 'MP2', 'CO1']);
check('servicioCode preservado', items.every(i => i.servicioCode === i.codigoProducto));

// --- Datos del equipo estampados ---
eq('nombre del equipo', g1[0].sistemaNombre, 'HPLC 1100');
eq('codigo interno del equipo', g1[0].sistemaCodigoInterno, 'EQ-01');
eq('sector trimmeado', g1[0].sectorNombre, 'Control de Calidad');
eq('equipo sin codigo interno queda en null', g3[0].sistemaCodigoInterno, null);
eq('equipo sin sector queda en null', g3[0].sectorNombre, null);

// --- Serie del modulo principal (ancla el S/N del header en el PDF) ---
eq('serie del primer modulo del equipo 1', g1[0].moduloSerie, 'SN-111');
eq('serie del primer modulo del equipo 2', items.find(i => i.grupo === 2)!.moduloSerie, 'SN-222');
eq('equipo sin modulos: serie null', g3[0].moduloSerie, null);
check('la serie es la misma en todos los servicios del equipo',
  g1.every(i => i.moduloSerie === 'SN-111'));

// --- Bordes ---
eq('sin equipos no genera nada',
  materializarServiciosPorSistema({ plantilla, sistemas: [], modulosPorSistema: modulos, grupoBase: 1 }).length, 0);
eq('sin servicios no genera nada',
  materializarServiciosPorSistema({ plantilla: [], sistemas: equipos, modulosPorSistema: modulos, grupoBase: 1 }).length, 0);
eq('un solo equipo se comporta como antes',
  materializarServiciosPorSistema({ plantilla, sistemas: [equipos[0]], modulosPorSistema: modulos, grupoBase: 1 })
    .map(i => i.subItem), ['1.1', '1.2', '1.3']);
check('la plantilla no se muta',
  plantilla.every(s => s.grupo === 0 && s.subItem === '' && s.id.startsWith('tmp-')));

console.log(fail === 0
  ? `✅ materializarServicios: ${ok}/${ok} OK`
  : `❌ materializarServicios: ${fail} fallaron de ${ok + fail}`);
if (fail > 0) process.exit(1);
