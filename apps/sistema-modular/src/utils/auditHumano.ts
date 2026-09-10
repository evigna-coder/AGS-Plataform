import type { AuditAction, AuditLogEntry } from '@ags/shared';
import {
  ESTADO_AGENDA_LABELS, ESTADO_CERTIFICACION_LABELS, ESTADO_LOANER_LABELS, ESTADO_PRESUPUESTO_LABELS,
  OT_ESTADO_LABELS, SOLICITUD_FACTURACION_ESTADO_LABELS,
} from '@ags/shared';

/**
 * Auditoría legible (2026-09-09). La pantalla mostraba nombres técnicos de
 * colección ("agendaEntries", "unidades_stock"), campos en camelCase y el
 * detalle expandido como JSON crudo. Acá vive la traducción a castellano:
 * módulo, campo, valor, entidad y la frase de lo que pasó.
 */

export const COLLECTION_LABELS: Record<string, string> = {
  clientes: 'Cliente', establecimientos: 'Establecimiento', contactos: 'Contacto',
  reportes: 'Orden de trabajo', ordenes_trabajo: 'Orden de trabajo',
  presupuestos: 'Presupuesto', leads: 'Ticket', tickets: 'Ticket',
  articulos: 'Artículo', posiciones_stock: 'Posición de stock', posicionesStock: 'Posición de stock',
  unidades_stock: 'Unidad de stock', unidades: 'Unidad de stock',
  minikits: 'Minikit', movimientos_stock: 'Movimiento de stock', movimientosStock: 'Movimiento de stock',
  remitos: 'Remito', fichas_propiedad: 'Ficha', fichas: 'Ficha', vehiculos: 'Vehículo',
  contratos: 'Contrato', dispositivos: 'Dispositivo', loaners: 'Loaner',
  agenda: 'Agenda', agendaEntries: 'Agenda', agendaNotas: 'Nota de agenda', agendaDiasAgs: 'Día AGS',
  feriados: 'Feriado', qfDocumentos: 'Documento QF', tableCatalog: 'Tabla de protocolo', tableProjects: 'Proyecto de tablas',
  tiposEquipo: 'Tipo de equipo', tipos_servicio: 'Tipo de servicio', categorias_equipo: 'Categoría de equipo',
  categorias_modulo: 'Categoría de módulo', categorias_presupuesto: 'Categoría de presupuesto',
  condiciones_pago: 'Condición de pago', conceptos_servicio: 'Concepto de servicio', marcas: 'Marca',
  proveedores: 'Proveedor', ingreso_empresas: 'Ingreso de empresa', ingresosEmpresas: 'Ingreso de empresa',
  patrones: 'Patrón', instrumentos: 'Instrumento', columnas: 'Columna',
  ordenes_compra: 'Orden de compra', ordenesCompraCliente: 'OC del cliente',
  facturacion: 'Solicitud de facturación', solicitudesFacturacion: 'Solicitud de facturación',
  facturas: 'Factura', requerimientos_compra: 'Requerimiento de compra', importaciones: 'Importación',
  pagos_exterior: 'Pago al exterior', posiciones_arancelarias: 'Posición arancelaria',
  pendientes: 'Pendiente', asignaciones: 'Asignación', certificaciones: 'Certificación',
  cierresSemanales: 'Cierre semanal', sistemas: 'Equipo', modulos: 'Módulo', usuarios: 'Usuario',
  ingenieros: 'Ingeniero', adminConfig: 'Configuración', mailQueue: 'Email', audit_log: 'Registro de auditoría',
};

/** camelCase / snake_case → "Palabras separadas", primera en mayúscula. */
export function humanize(k: string): string {
  const t = k.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase().trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function collectionLabel(c: string): string {
  return COLLECTION_LABELS[c] || humanize(c);
}

export const FIELD_LABELS: Record<string, string> = {
  status: 'estado', activo: 'activo', name: 'nombre', nombre: 'nombre', displayName: 'nombre',
  description: 'descripción', descripcion: 'descripción', estado: 'estado', orden: 'orden', email: 'email',
  telefono: 'teléfono', direccion: 'dirección', localidad: 'localidad', provincia: 'provincia',
  observaciones: 'observaciones', notas: 'notas', comentario: 'comentario',
  razonSocial: 'razón social', cuit: 'CUIT', requisitoFacturacion: 'requisito de facturación',
  estadoAdmin: 'estado administrativo', estadoAdminFecha: 'fecha del estado', fechaCierre: 'fecha de cierre',
  fechaCierreAdmin: 'fecha de cierre administrativo', fechaInicio: 'fecha de inicio', fechaFin: 'fecha de fin',
  fechaServicioAprox: 'fecha coordinada', ingenieroAsignadoId: 'ingeniero', ingenieroAsignadoNombre: 'ingeniero',
  clienteId: 'cliente', clienteNombre: 'cliente', establecimientoId: 'establecimiento', establecimientoNombre: 'establecimiento',
  sistemaId: 'equipo', sistemaNombre: 'equipo', sistema: 'equipo', moduloSerie: 'serie del módulo',
  budgets: 'presupuestos vinculados', tecnicos: 'técnicos asignados', tipoServicio: 'tipo de servicio',
  retenidaFacturacion: 'retenida para facturar', requisitoFacturacionPendiente: 'requisito pendiente',
  certificacionId: 'certificación', materialesParaServicio: 'materiales para el servicio',
  comentarioFacturacion: 'comentario para facturación', problemaFallaInicial: 'problema inicial',
  asignadoA: 'responsable', asignadoNombre: 'responsable', areaActual: 'área', prioridad: 'prioridad',
  proximoContacto: 'próximo contacto', motivoLlamado: 'motivo del llamado', motivoContacto: 'motivo',
  motivoOtros: 'motivo (otros)', accionPendiente: 'acción pendiente', ultimaObservacion: 'última observación',
  postas: 'historial de postas', finalizadoAt: 'fecha de finalización', derivadoPor: 'derivado por',
  fechaEnvio: 'fecha de envío', fechaAceptacion: 'fecha de aceptación', validUntil: 'válido hasta',
  validezDias: 'validez (días)', items: 'ítems', precio: 'precio', precioUnitario: 'precio unitario',
  cantidad: 'cantidad', moneda: 'moneda', subtotal: 'subtotal', total: 'total', tipoCambio: 'tipo de cambio',
  motivoAnulacion: 'motivo de anulación', anuladoPorId: 'anulado por', origenTipo: 'tipo de origen',
  origenId: 'origen', origenRef: 'referencia de origen', ordenesCompraIds: 'órdenes de compra',
  ordenCompraNumero: 'N° de OC', adjuntos: 'adjuntos', responsableId: 'responsable', responsableNombre: 'responsable',
  contactoId: 'contacto', condicionPagoId: 'condición de pago', respaldoFacturacion: 'respaldo de facturación',
  otsListasParaFacturar: 'OTs listas para facturar', otsVinculadasNumbers: 'OTs vinculadas',
  facturacionEstado: 'estado de facturación', esquemaFacturacion: 'esquema de facturación',
  notasTecnicas: 'notas técnicas', notasAdministrativas: 'notas administrativas', garantia: 'garantía',
  condicionesComerciales: 'condiciones comerciales', comentarioControlSemanal: 'comentario del control',
  montoTotal: 'monto', presupuestoNumero: 'presupuesto', presupuestoId: 'presupuesto', otNumbers: 'OTs',
  numeroFactura: 'N° de factura', fechaFactura: 'fecha de factura', comentarioControl: 'comentario del control',
  codigo: 'código', codigoArticulo: 'código de artículo', articuloId: 'artículo', articuloCodigo: 'artículo',
  articuloDescripcion: 'descripción del artículo', categorias: 'categorías', marca: 'marca', lotes: 'lotes',
  nroSerie: 'N° de serie', nroLote: 'N° de lote', ubicacion: 'ubicación', ubicacionAnterior: 'ubicación anterior',
  posicionArancelaria: 'posición arancelaria', origen: 'origen', proveedorId: 'proveedor', proveedorNombre: 'proveedor',
  stockMinimo: 'stock mínimo', unidadMedida: 'unidad de medida', reservadoParaPresupuestoNumero: 'reservado para',
  reservadoParaClienteNombre: 'reservado para (cliente)', costoUnitario: 'costo unitario',
  prestamos: 'préstamos', extracciones: 'extracciones', condicion: 'condición', serie: 'serie', derivaciones: 'derivaciones',
  enProveedor: 'en proveedor', venta: 'venta', otIds: 'OTs vinculadas', fotos: 'fotos',
  recibidas: 'documentos recibidos', solicitudesIds: 'solicitudes generadas', periodo: 'período',
  ingenieroId: 'ingeniero', ingenieroNombre: 'ingeniero', estadoAgenda: 'estado en agenda',
  quarterStart: 'bloque desde', quarterEnd: 'bloque hasta', titulo: 'título', reservaStock: 'reservado en stock',
  excluidoDelControl: 'excluido del control', software: 'software', categoriaId: 'categoría',
  configuracionGC: 'configuración GC', sector: 'sector', codigoInternoCliente: 'ID de equipo',
  tableType: 'tipo de tabla', allowClientSpec: 'permite especificación del cliente', templateRows: 'filas plantilla',
  validationRules: 'reglas de validación', sysType: 'tipo de sistema', columns: 'columnas', modelos: 'modelos',
  isDefault: 'por defecto', projectId: 'proyecto', permisos: 'permisos', rol: 'rol', role: 'rol',
  carpetaCierresSemanales: 'carpeta del cierre semanal', mailFacturacion: 'mail de facturación',
  usuarioSeguimientoId: 'usuario de seguimiento', responsablePorArea: 'responsables por área',
};

export const SKIP_FIELDS = new Set([
  'updatedAt', 'updatedBy', 'updatedByName', 'createdAt', 'createdBy', 'createdByName', 'id',
]);

export function fieldLabel(k: string): string {
  return FIELD_LABELS[k] || humanize(k).toLowerCase();
}

const ESTADOS_POR_CAMPO: Record<string, Record<string, string>> = {
  estadoAdmin: OT_ESTADO_LABELS as Record<string, string>,
  estadoAgenda: ESTADO_AGENDA_LABELS as Record<string, string>,
};
const ESTADOS_POR_COLECCION: Record<string, Record<string, string>> = {
  presupuestos: ESTADO_PRESUPUESTO_LABELS as Record<string, string>,
  solicitudesFacturacion: SOLICITUD_FACTURACION_ESTADO_LABELS as Record<string, string>,
  facturacion: SOLICITUD_FACTURACION_ESTADO_LABELS as Record<string, string>,
  loaners: ESTADO_LOANER_LABELS as Record<string, string>,
  certificaciones: ESTADO_CERTIFICACION_LABELS as Record<string, string>,
};

const esFechaIso = (s: string) => /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?/.test(s);
const fmtFecha = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split('-');
  const hora = s.length > 10 ? ` ${s.slice(11, 16)}` : '';
  return `${d}/${m}/${y}${hora}`;
};

/** Un valor de un campo, en castellano y corto. */
export function valorLegible(campo: string, valor: unknown, coleccion?: string): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (typeof valor === 'number') return valor.toLocaleString('es-AR', { maximumFractionDigits: 2 });
  if (typeof valor === 'string') {
    const mapa = ESTADOS_POR_CAMPO[campo] ?? (campo === 'estado' && coleccion ? ESTADOS_POR_COLECCION[coleccion] : undefined);
    if (mapa?.[valor]) return mapa[valor];
    if (esFechaIso(valor)) return fmtFecha(valor);
    return valor.length > 160 ? `${valor.slice(0, 157)}…` : valor;
  }
  if (typeof valor === 'object' && valor && typeof (valor as { toDate?: unknown }).toDate === 'function') {
    return fmtFecha((valor as { toDate: () => Date }).toDate().toISOString());
  }
  if (valor && typeof valor === 'object' && 'seconds' in (valor as object) && typeof (valor as { seconds: unknown }).seconds === 'number') {
    return fmtFecha(new Date((valor as { seconds: number }).seconds * 1000).toISOString());
  }
  if (Array.isArray(valor)) {
    if (valor.length === 0) return 'ninguno';
    const simples = valor.filter(x => typeof x === 'string' || typeof x === 'number');
    if (simples.length === valor.length) return valor.slice(0, 6).join(', ') + (valor.length > 6 ? ` (+${valor.length - 6})` : '');
    return `${valor.length} ${valor.length === 1 ? 'elemento' : 'elementos'}`;
  }
  if (typeof valor === 'object') {
    const o = valor as Record<string, unknown>;
    const nombre = o.referenciaNombre ?? o.nombre ?? o.descripcion ?? o.numero ?? o.codigo ?? o.razonSocial;
    if (typeof nombre === 'string') return nombre;
    const claves = Object.keys(o).filter(k => !SKIP_FIELDS.has(k));
    return claves.length ? `{${claves.slice(0, 4).map(fieldLabel).join(', ')}${claves.length > 4 ? ', …' : ''}}` : '{}';
  }
  return String(valor);
}

export interface CambioLegible { campo: string; antes: string | null; despues: string; }

/** Los campos que cambiaron, ya traducidos. Sin `before` (la mayoría de los updates) solo muestra el después. */
export function cambiosLegibles(e: AuditLogEntry): CambioLegible[] {
  const after = e.changes?.after ?? {};
  const before = e.changes?.before ?? null;
  return Object.keys(after)
    .filter(k => !SKIP_FIELDS.has(k))
    .map(k => ({
      campo: fieldLabel(k),
      antes: before ? valorLegible(k, before[k], e.collection) : null,
      despues: valorLegible(k, after[k], e.collection),
    }))
    .filter(c => c.antes === null || c.antes !== c.despues);
}

/** Etiqueta de la entidad: la guardada, o derivada del documento cambiado. */
export function entityLabelDe(e: AuditLogEntry): string {
  if (e.entityLabel) return e.entityLabel;
  const a = (e.changes?.after ?? e.changes?.before ?? {}) as Record<string, unknown>;
  const pick = (...ks: string[]) => ks.map(k => a[k]).find(v => typeof v === 'string' && v) as string | undefined;
  if (e.collection === 'reportes' || e.collection === 'ordenes_trabajo') return `OT ${pick('otNumber') ?? e.documentId}`;
  if (e.collection === 'agendaEntries') return pick('otNumber') ? `OT ${pick('otNumber')}` : '';
  if (e.collection === 'cierresSemanales') return `Semana del ${fmtFecha(e.documentId)}`;
  const n = pick('numero', 'otNumber', 'codigo', 'razonSocial', 'nombre', 'displayName', 'presupuestoNumero', 'articuloCodigo', 'descripcion');
  return n ?? '';
}

export const ACTION_LABELS: Record<AuditAction, string> = {
  create: 'Creación', update: 'Modificación', delete: 'Eliminación', business_event: 'Evento',
};

const EVENT_LABELS: Record<string, string> = {
  'cliente.desactivado': 'Dio de baja al cliente', 'cliente.reactivado': 'Reactivó al cliente',
  'ot.estado_cambiado': 'Cambió estado de la OT', 'ot.cerrada': 'Cerró administrativamente la OT',
  'presupuesto.enviado': 'Envió el presupuesto', 'presupuesto.aceptado': 'Aceptó el presupuesto',
  'presupuesto.rechazado': 'Rechazó el presupuesto', 'presupuesto.revision_creada': 'Creó una revisión del presupuesto',
  'presupuesto.factura_solicitada': 'Solicitó factura del presupuesto',
  'ticket.derivado': 'Derivó el ticket', 'ticket.reasignado': 'Reasignó el ticket',
  'ticket.accion_completada': 'Completó la acción del ticket', 'ticket.finalizado': 'Finalizó el ticket',
  'ticket.reabierto': 'Reabrió el ticket', 'stock.movimiento_creado': 'Registró movimiento de stock',
  'articulo.dado_de_baja': 'Dio de baja al artículo',
};

/** Título de la fila: "Modificó presupuesto". */
export function tituloAccion(e: AuditLogEntry): string {
  if (e.action === 'business_event') return EVENT_LABELS[e.eventName || ''] || humanize(e.eventName || 'evento');
  const verbo = { create: 'Creó', update: 'Modificó', delete: 'Eliminó' }[e.action] ?? '';
  return `${verbo} ${collectionLabel(e.collection).toLowerCase()}`;
}

const v = (x: unknown) => (x === null || x === undefined || x === '' ? '' : typeof x === 'object' ? '' : String(x));

/** Frase corta con lo que pasó, para la columna Detalle. */
export function describirAccion(e: AuditLogEntry): string {
  const label = entityLabelDe(e);
  const d = e.details || {};
  if (e.action === 'business_event') {
    switch (e.eventName || '') {
      case 'cliente.desactivado': return `dio de baja al cliente ${label}`;
      case 'cliente.reactivado': return `reactivó al cliente ${label}`;
      case 'ot.estado_cambiado': {
        const from = valorLegible('estadoAdmin', d.from); const to = valorLegible('estadoAdmin', d.to);
        return `cambió estado de la ${label}${from !== '—' && to !== '—' ? ` de ${from} a ${to}` : to !== '—' ? ` a ${to}` : ''}`;
      }
      case 'ot.cerrada': return `cerró administrativamente la ${label}${v(d.notas) ? ` (${v(d.notas)})` : ''}`;
      case 'presupuesto.enviado': return `envió el ${label}`;
      case 'presupuesto.aceptado': {
        const reqs = Number(d.requerimientosCreados ?? 0);
        return `aceptó el ${label}${reqs > 0 ? ` (generó ${reqs} requerimiento${reqs === 1 ? '' : 's'} de compra)` : ''}`;
      }
      case 'presupuesto.rechazado': return `rechazó el ${label}`;
      case 'presupuesto.revision_creada':
        return `creó revisión ${v(d.nuevoNumero) || label}${v(d.anuladoNumero) ? ` (anuló ${v(d.anuladoNumero)})` : ''}${v(d.motivo) ? ` — motivo: ${v(d.motivo)}` : ''}`;
      case 'ticket.derivado': return ['derivó el ticket', label, v(d.aNombre) ? `a ${v(d.aNombre)}` : '', v(d.area) ? `(área: ${v(d.area)})` : ''].filter(Boolean).join(' ');
      case 'ticket.reasignado': return `reasignó el ticket ${label}${v(d.aNombre) ? ` a ${v(d.aNombre)}` : ''}`;
      case 'ticket.accion_completada': return `completó acción del ticket ${label}`;
      case 'ticket.finalizado': return `finalizó el ticket ${label}${v(d.comentario) ? ` (${v(d.comentario)})` : ''}`;
      case 'ticket.reabierto': return `reabrió el ticket ${label}`;
      case 'stock.movimiento_creado': {
        const cantidad = Number(d.cantidad ?? 0);
        return [`registró ${v(d.tipo) || 'movimiento'}`, cantidad ? `de ${cantidad} unidad${cantidad === 1 ? '' : 'es'}` : '', v(d.articuloCodigo) || v(d.articuloId) ? `del artículo ${v(d.articuloCodigo) || v(d.articuloId)}` : ''].filter(Boolean).join(' ');
      }
      case 'articulo.dado_de_baja': return `dio de baja al artículo ${label}`;
      default: return `${humanize(e.eventName || 'evento').toLowerCase()}${label ? ` en ${label}` : ''}`;
    }
  }
  const modulo = collectionLabel(e.collection).toLowerCase();
  if (e.action === 'create') return `creó ${modulo}${label ? ` ${label}` : ''}`;
  if (e.action === 'delete') return `eliminó ${modulo}${label ? ` ${label}` : ''}`;
  const cambios = cambiosLegibles(e);
  if (cambios.length === 0) return `modificó ${modulo}${label ? ` ${label}` : ''}`;
  // Un solo campo: decir el valor nuevo. Varios: enumerarlos.
  if (cambios.length === 1) return `${cambios[0].campo}: ${cambios[0].antes && cambios[0].antes !== '—' ? `${cambios[0].antes} → ` : ''}${cambios[0].despues}`;
  return `cambió ${cambios.map(c => c.campo).slice(0, 4).join(', ')}${cambios.length > 4 ? ` y ${cambios.length - 4} más` : ''}`;
}
