// Run with: pnpm --filter @ags/sistema-modular test:planificacion-insumos
import assert from 'node:assert/strict';
import type { Articulo, Contrato, PerfilConsumo } from '@ags/shared';
import {
  consumoPorServicio, ingresosPrevistos, mesesDesde, planificarInsumos,
  type EntradaMotor, type SistemaPlan,
} from '../planificacionInsumos.js';

const perfil = (id: string, criterio: PerfilConsumo['criterio'], items: Array<[string, number, boolean?]>): PerfilConsumo => ({
  id, nombre: id, criterio, activo: true,
  items: items.map(([articuloId, cantidadPorServicio, porPuerto]) => ({ articuloId, articuloCodigo: articuloId, cantidadPorServicio, porPuerto: porPuerto ?? null })),
  createdAt: '', updatedAt: '',
});
const art = (id: string, stockMinimo = 0): Articulo => ({ id, codigo: id, descripcion: id, stockMinimo, planificable: true } as unknown as Articulo);

const hplc: SistemaPlan = { id: 'S1', nombre: 'HPLC 1260', categoriaId: 'catL', activo: true, clienteNombre: 'Lab A' };
const gc: SistemaPlan = {
  id: 'S2', nombre: 'Cromatógrafo gaseoso 7890', categoriaId: 'catG', activo: true,
  configuracionGC: { puertoInyeccionFront: 'SSL', puertoInyeccionBack: 'SSL', detectorFront: 'FID', detectorBack: 'SCD' },
};
const modulos = [
  { sistemaId: 'S1', nombre: 'G1311B', descripcion: 'Bomba cuaternaria' },
  { sistemaId: 'S1', nombre: 'Inyector', descripcion: 'G1367E ALS' },
  { sistemaId: 'S1', nombre: 'G1314F', descripcion: 'VWD' },
  { sistemaId: 'S2', nombre: 'GC 7890B', marca: 'Agilent' },
];
const perfiles = [
  perfil('bomba', { ambito: 'modulo', codigoModulo: 'G1311' }, [['SELLO', 2]]),
  perfil('inyector', { ambito: 'modulo', codigoModulo: 'G1367' }, [['ROTOR', 1]]),
  perfil('gc-agilent', { ambito: 'gc', marca: 'Agilent' }, [['LINER', 1, true], ['SEPTA', 5, true]]),
  perfil('gc-scd', { ambito: 'gc', detector: 'SCD' }, [['CERAMICA', 1]]),
  perfil('gc-npd', { ambito: 'gc', detector: 'NPD' }, [['BEAD', 1]]),
  perfil('todo-hplc', { ambito: 'categoria', categoriaId: 'catL' }, [['FILTRO', 1]]),
];

// ── consumoPorServicio ───────────────────────────────────────────────────────
{
  const r = consumoPorServicio(hplc, modulos.filter(m => m.sistemaId === 'S1'), perfiles);
  assert.equal(r.consumo.get('SELLO'), 2, 'bomba por prefijo del nombre del módulo');
  assert.equal(r.consumo.get('ROTOR'), 1, 'inyector por código en la descripción');
  assert.equal(r.consumo.get('FILTRO'), 1, 'perfil de categoría aditivo');
  assert.equal(r.consumo.has('LINER'), false, 'un HPLC no consume perfiles GC');
  assert.deepEqual(r.perfiles.sort(), ['bomba', 'inyector', 'todo-hplc']);
}
{
  const r = consumoPorServicio(gc, modulos.filter(m => m.sistemaId === 'S2'), perfiles);
  assert.equal(r.consumo.get('LINER'), 2, 'liners × 2 puertos de inyección');
  assert.equal(r.consumo.get('SEPTA'), 10, 'septa 5 × 2 puertos');
  assert.equal(r.consumo.get('CERAMICA'), 1, 'detector SCD presente (back)');
  assert.equal(r.consumo.has('BEAD'), false, 'sin NPD no aplica');
}
{
  // Dos bombas iguales consumen el doble.
  const r = consumoPorServicio(hplc, [{ sistemaId: 'S1', nombre: 'G1311A' }, { sistemaId: 'S1', nombre: 'G1311B' }], perfiles);
  assert.equal(r.consumo.get('SELLO'), 4);
}

// ── mesesDesde ──────────────────────────────────────────────────────────────
assert.deepEqual(mesesDesde('2026-11-15', 3), ['2026-11', '2026-12', '2027-01']);

// ── planificarInsumos ───────────────────────────────────────────────────────
const base: EntradaMotor = {
  hoy: '2026-10-05', horizonteMeses: 2,
  articulos: [art('SELLO', 2), art('ROTOR'), art('FILTRO'), art('LINER'), art('SEPTA'), art('CERAMICA')],
  perfiles, sistemas: [hplc, gc], modulos,
  categorias: [{ id: 'catL', nombre: 'Cromatógrafos líquidos' }, { id: 'catG', nombre: 'Cromatógrafos gaseosos' }],
  ots: [
    // Agendada en octubre (aparece en agenda y como pendiente: se cuenta UNA vez).
    { otNumber: '30001.01', tipoServicio: 'Mantenimiento preventivo', fecha: '2026-10-20', sistemaId: 'S1', estadoAdmin: 'ASIGNADA' },
    // Pendiente con fecha en noviembre, sin agenda.
    { otNumber: '30002.01', tipoServicio: 'Mantenimiento Preventivo', fecha: '2026-11-03', sistemaId: 'S2', estadoAdmin: 'CREADA' },
    // Correctivo: no cuenta.
    { otNumber: '30003.01', tipoServicio: 'Correctivo', fecha: '2026-10-10', sistemaId: 'S1', estadoAdmin: 'CREADA' },
    // Cancelada: no cuenta.
    { otNumber: '30004.01', tipoServicio: 'Mantenimiento preventivo', fecha: '2026-10-11', sistemaId: 'S1', estadoAdmin: 'CANCELADA' },
    // Año anterior, octubre: 3 preventivos HPLC realizados (2 con equipo, 1 vieja por texto).
    { otNumber: '20001.01', tipoServicio: 'Mantenimiento preventivo', fecha: '2025-10-02', sistemaId: 'S1', estadoAdmin: 'FINALIZADO' },
    { otNumber: '20002.01', tipoServicio: 'Mantenimiento preventivo', fecha: '2025-10-15', sistemaId: 'S1', estadoAdmin: 'CIERRE_ADMINISTRATIVO' },
    { otNumber: '20003', tipoServicio: 'Mantenimiento preventivo', fecha: '2025-10-20', sistemaTexto: 'HPLC 1100', status: 'FINALIZADO' },
  ],
  agenda: [{ otNumber: '30001.01', fechaInicio: '2026-10-20', estadoAgenda: 'confirmado' }],
  contratos: [],
  disponible: new Map([['SELLO', 3], ['FILTRO', 10], ['LINER', 1]]),
  ingresos: [
    { articuloId: 'SELLO', cantidad: 2, fecha: '2026-11-10', origen: 'oc', referencia: 'OC-1' },
    { articuloId: 'ROTOR', cantidad: 1, fecha: null, origen: 'oc', referencia: 'OC-2' },
  ],
};
{
  const r = planificarInsumos(base);
  assert.deepEqual(r.meses, ['2026-10', '2026-11']);
  const fila = (id: string) => r.filas.find(f => f.articuloId === id)!;

  // Octubre HPLC: 1 concreto (agendado) vs 3 del año anterior → 2 extra con perfil promedio (S1 es el único HPLC: 2 sellos).
  const sello = fila('SELLO');
  assert.equal(sello.meses[0].demanda, 2 + 2 * 2, 'octubre: agendado (2) + 2 extra del año anterior (2 c/u)');
  assert.equal(sello.meses[0].servicios.filter(s => s.origen === 'agenda').length, 1);
  assert.equal(sello.meses[0].servicios.filter(s => s.origen === 'pendiente').length, 0, 'la OT agendada no se duplica como pendiente');
  assert.equal(sello.meses[0].servicios.find(s => s.origen === 'anio_anterior')?.cantidad, 2);
  assert.equal(sello.meses[0].stockFin, 3 - 6);
  assert.equal(sello.meses[1].ingresos, 2, 'la OC de noviembre entra en noviembre');
  assert.equal(sello.meses[1].stockFin, -3 + 2);
  assert.equal(sello.comprar, 3, 'faltante máximo del horizonte');
  assert.equal(sello.mesQuiebre, '2026-10');

  // Rotor: OC sin fecha entra en el primer mes y se marca.
  const rotor = fila('ROTOR');
  assert.equal(rotor.meses[0].ingresos, 1);
  assert.equal(rotor.ingresosSinFecha, 1);

  // GC pendiente en noviembre: liners × 2 puertos.
  const liner = fila('LINER');
  assert.equal(liner.meses[0].demanda, 0);
  assert.equal(liner.meses[1].demanda, 2);
  assert.equal(liner.meses[1].servicios[0].origen, 'pendiente');
  assert.equal(liner.meses[1].stockFin, 1 - 2);
  assert.equal(liner.comprar, 1);
  assert.equal(r.equiposSinPerfil.length, 0);
}

// Contrato: 2 preventivos/año por equipo, año de contrato desde 2026-03-01, 1 ya hecho → 1 restante
// repartido en los meses que quedan (oct..feb = 5 meses → 0.2 por mes).
{
  const contrato = {
    id: 'C1', numero: 'CT-1', estado: 'activo', fechaInicio: '2026-03-01', fechaFin: '2028-02-28', sistemaIds: ['S1'],
    serviciosIncluidos: [{ tipoServicioId: 'x', tipoServicioNombre: 'Mantenimiento preventivo', cantidadAnualPorEquipo: 2 }],
  } as unknown as Contrato;
  const r = planificarInsumos({
    ...base, horizonteMeses: 3, agenda: [], contratos: [contrato],
    ots: [{ otNumber: '30010.01', tipoServicio: 'Mantenimiento preventivo', fecha: '2026-05-10', sistemaId: 'S1', estadoAdmin: 'FINALIZADO' }],
  });
  const sello = r.filas.find(f => f.articuloId === 'SELLO')!;
  const porMes = sello.meses.map(m => Math.round(m.demanda * 100) / 100);
  assert.deepEqual(porMes, [0.4, 0.4, 0.4], '1 restante / 5 meses × 2 sellos');
  assert.equal(sello.meses[0].servicios[0].origen, 'contrato');
  assert.equal(sello.meses[0].servicios[0].otNumber, 'CT-1');
}
// Contrato con cupo ya cubierto por una OT agendada dentro del horizonte → no suma fracciones.
{
  const contrato = {
    id: 'C2', numero: 'CT-2', estado: 'activo', fechaInicio: '2026-01-01', fechaFin: '2026-12-31', sistemaIds: ['S1'],
    serviciosIncluidos: [{ tipoServicioId: 'x', tipoServicioNombre: 'Mantenimiento preventivo', cantidadAnualPorEquipo: 1 }],
  } as unknown as Contrato;
  const r = planificarInsumos({
    ...base, contratos: [contrato],
    ots: [{ otNumber: '30020.01', tipoServicio: 'Mantenimiento preventivo', fecha: '2026-11-15', sistemaId: 'S1', estadoAdmin: 'ASIGNADA' }],
    agenda: [{ otNumber: '30020.01', fechaInicio: '2026-11-15', estadoAgenda: 'tentativo' }],
  });
  const sello = r.filas.find(f => f.articuloId === 'SELLO')!;
  assert.equal(sello.meses[0].demanda, 0);
  assert.equal(sello.meses[1].demanda, 2);
  assert.equal(sello.meses[1].servicios.length, 1, 'solo la OT agendada, sin fracción de contrato');
}
// Equipo con servicio previsto y sin perfil → reportado.
{
  const r = planificarInsumos({
    ...base, perfiles: perfiles.filter(p => p.criterio.ambito !== 'gc'),
  });
  assert.deepEqual(r.equiposSinPerfil.map(e => e.sistemaId), ['S2']);
}

// ── ingresosPrevistos: importación resta de su OC ───────────────────────────
{
  const r = ingresosPrevistos(
    [{ id: 'oc1', numero: 'OC-1', estado: 'enviada_proveedor', fechaEntregaEstimada: '2026-12-01',
       items: [{ articuloId: 'SELLO', cantidad: 10, cantidadRecibida: 0 }, { articuloId: 'OTRO', cantidad: 5, cantidadRecibida: 0 }] },
     { id: 'oc2', numero: 'OC-2', estado: 'borrador', items: [{ articuloId: 'SELLO', cantidad: 99, cantidadRecibida: 0 }] }],
    [{ id: 'i1', numero: 'IMP-1', estado: 'en_transito', ordenCompraId: 'oc1', fechaEstimadaArribo: '2026-10-20',
       items: [{ articuloId: 'SELLO', cantidadPedida: 4, cantidadRecibida: 0, presentacion: { codigoParte: 'x', factor: 1 } }] }],
    new Set(['SELLO']),
  );
  assert.deepEqual(r.map(i => [i.origen, i.cantidad, i.fecha]), [['importacion', 4, '2026-10-20'], ['oc', 6, '2026-12-01']]);
}
// Presentación: la cantidad de la OC se pasa a unidad base.
{
  const r = ingresosPrevistos(
    [{ id: 'oc1', numero: 'OC-1', estado: 'embarcada', fechaEntregaEstimada: null,
       items: [{ articuloId: 'SEPTA', cantidad: 2, cantidadRecibida: 0, presentacion: { codigoParte: 'pack50', factor: 50 } }] }],
    [], new Set(['SEPTA']),
  );
  assert.deepEqual(r.map(i => [i.cantidad, i.fecha]), [[100, null]]);
}

console.log('✅ planificacionInsumos: OK');
