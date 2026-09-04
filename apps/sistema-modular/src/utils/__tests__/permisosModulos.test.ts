/**
 * Permisos por pantalla (2026-09-04): los overrides viejos se expanden sin
 * perder acceso, los nuevos se respetan tal cual, y cada ruta cae en el
 * módulo de su prefijo MÁS largo.
 */
import {
  ALL_MODULOS, MODULO_LABELS, MODULO_GROUPS, ROLE_DEFAULTS, RUTA_MODULO,
  expandLegacyModulos, getModuloFromPath, PERMISOS_VERSION,
} from '@ags/shared';

let ok = 0;
let fail = 0;
const check = (nombre: string, cond: boolean, detalle = '') => {
  if (cond) ok++;
  else { fail++; console.error(`  ✗ ${nombre} ${detalle}`); }
};

// Override viejo: 'stock-operacion' → todas sus pantallas; QF se suma solo.
const viejo = expandLegacyModulos(['clientes', 'stock-operacion', 'facturacion']);
check('viejo: stock-operacion expande a remitos', viejo.includes('stock-remitos'));
check('viejo: facturacion trae sus sub-pantallas', viejo.includes('pendientes-documentacion') && viejo.includes('cuotas-por-facturar'));
check('viejo: qf-documentos se suma', viejo.includes('qf-documentos'));
check('viejo: no quedan ids gruesos', !(viejo as string[]).includes('stock-operacion'));

// Override nuevo: lo que dice, dice.
const nuevo = expandLegacyModulos(['facturacion', 'stock-remitos'], PERMISOS_VERSION);
check('nuevo: facturacion NO arrastra sub-pantallas', !nuevo.includes('pendientes-documentacion'));
check('nuevo: no suma qf', !nuevo.includes('qf-documentos'));
check('nuevo: un id grueso colado igual se expande', expandLegacyModulos(['stock'], PERMISOS_VERSION).includes('stock-articulos'));

// Cobertura: labels y grupos cubren todos los módulos, una vez cada uno.
check('labels completos', ALL_MODULOS.every(m => !!MODULO_LABELS[m]));
const enGrupos = MODULO_GROUPS.flatMap(g => g.modulos);
check('grupos cubren todo', ALL_MODULOS.every(m => enGrupos.includes(m)),
  `faltan: ${ALL_MODULOS.filter(m => !enGrupos.includes(m)).join(', ')}`);
check('grupos sin repetidos', new Set(enGrupos).size === enGrupos.length);
check('admin tiene todo', ROLE_DEFAULTS.admin.modulos.length === ALL_MODULOS.length);
check('roles solo con ids vigentes', Object.values(ROLE_DEFAULTS).every(r => r.modulos.every(m => (ALL_MODULOS as readonly string[]).includes(m))));
check('rutas apuntan a ids vigentes', Object.values(RUTA_MODULO).every(m => (ALL_MODULOS as readonly string[]).includes(m)));

// Prefijo más largo.
check('faltantes gana a minikits', getModuloFromPath('/stock/minikits/faltantes') === 'stock-minikits-faltantes');
check('detalle de minikit sigue en minikits', getModuloFromPath('/stock/minikits/abc123') === 'stock-minikits');
check('historial de asignaciones', getModuloFromPath('/stock/asignaciones/historial') === 'stock-asignaciones-historial');
check('pendientes de documentacion', getModuloFromPath('/facturacion/pendientes-documentacion') === 'pendientes-documentacion');
check('facturacion raiz', getModuloFromPath('/facturacion') === 'facturacion');

console.log(fail === 0
  ? `✅ permisosModulos: ${ok}/${ok} OK`
  : `❌ permisosModulos: ${fail} fallaron de ${ok + fail}`);
if (fail > 0) process.exit(1);
