/**
 * Top-level clean para Firestore: elimina undefined y convierte '' → null.
 * Usar para payloads planos. Para nested usar deepCleanForFirestore.
 */
export function cleanFirestoreData<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out[k] = v === '' ? null : v;
  }
  return out as Partial<T>;
}

/**
 * Deep-clean para Firestore:
 * 1. Elimina valores undefined (JSON round-trip)
 * 2. Elimina keys vacíos "" de objetos — Firestore no acepta field names vacíos
 */
export function deepCleanForFirestore(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(deepCleanForFirestore);
  // Preserve class instances (Firestore Timestamp, Date, etc.) — only recurse plain objects
  if (Object.getPrototypeOf(obj) !== Object.prototype) return obj;
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === '') continue;
    if (value === undefined) continue;
    cleaned[key] = deepCleanForFirestore(value);
  }
  return cleaned;
}

// --- Templates default para secciones de presupuesto ---

export const PRESUPUESTO_TEMPLATES = {
  notasTecnicas: `Este presupuesto incluye los gastos de viáticos para CABA y Gran Buenos Aires, hasta un radio de 90km. Para servicios realizados a mayores distancias entre el laboratorio y CABA, los viáticos están incluidos sólo si figuran detallados.

Este presupuesto se confecciona según la información proporcionada por el cliente, y no contempla gastos adicionales a los que AGS ANALÍTICA considera usuales.

El servicio detallado se prestará donde resida físicamente el equipo al momento del envío del presupuesto, según lo manifestado por el cliente. En caso de que la ubicación del equipo sea distinta, el presente presupuesto no tendrá validez, independientemente del envío de una Orden de Compra por parte del Cliente.`,

  notasAdministrativas: `Este presupuesto contempla el traslado de ingenieros de servicio técnico hasta sus instalaciones.

En caso de haber solicitudes adicionales (estudios médicos adicionales a los rutinarios periódicos, inducción para ingreso a planta en días específicos que por alguna razón representen gastos extras, etc.), y que estas solicitudes generen gastos adicionales, el presente presupuesto no tendrá validez, y se enviará uno nuevo que lo reemplazará.`,

  garantia: `Las partes reemplazadas en una reparación tienen una garantía de 60 días corridos desde el momento de la instalación, siempre que personal de AGS ANALÍTICA verifique un defecto en la fabricación.

Los consumibles utilizados NO tienen garantía, salvo falla de fabricación detectada al momento de la instalación por personal de AGS Analítica S.A.`,

  variacionTipoCambio: `TRANSFERENCIAS: Si el tipo de cambio DÓLAR BILLETE vendedor del BNA al cierre del día anterior al día de la transferencia difiriera en más de un 1% respecto del tipo de cambio DÓLAR BILLETE vendedor del BNA al día anterior al de la emisión de la factura correspondiente, se deberá ajustar dicho valor emitiendo nota de débito o nota de crédito, según el caso.

Tasa de interés por pago fuera de término: 0,2% diario.`,

  condicionesComerciales: `IMPORTANTE: Si por cualquier razón, AGS ANALÍTICA no estuviera en condiciones de realizar un giro al exterior de manera contemporánea a la transferencia realizada por el CLIENTE, se tomará el giro realizado por el CLIENTE en moneda PESOS, independientemente de cualquier variación que pudiera sufrir la cotización del dólar entre el momento de la transferencia del CLIENTE hasta el momento en que AGS ANALÍTICA realice el giro al exterior.

Por esa razón, para presupuestos que incluyan partes o consumibles por un valor mayor a 1000 USD, NO realizar NINGUNA transferencia sin la autorización previa por parte de AGS ANALÍTICA.

Solicitamos enviar: Orden de compra (de ser necesario), formulario de inscripción AFIP e ingresos brutos.
Cheques a la orden de AGS ANALÍTICA S.A. - No se aceptan cheques de terceros.`,

  aceptacionPresupuesto: `A) Su empresa trabaja con Orden de Compra? Es necesaria la misma para la posterior facturación de este presupuesto? Enviar Orden de Compra mencionando número de presupuesto al (011) 4524-7247 (opción 2) o a info@agsanalitica.com

B) Su Empresa NO trabaja con Orden de Compra o bien NO es necesaria la misma para proceder a la posterior facturación de este presupuesto? Completar la siguiente solicitud con los datos requeridos y enviar por fax al (011) 4524-7247 (opción 2) o a info@agsanalitica.com`,

  // Templates específicos para contratos
  contrato: {
    notasSobrePresupuesto: `• La firma de la presente implica la aceptación de las condiciones generales del Servicio Prestacional de Soporte Técnico Analítico a Clientes de AGS ANALÍTICA S.A.
• Servicios Correctivos regulados por ANEXO AT adjunto a la presente.
• Servicios Preventivos regulados por ANEXO MP adjunto a la presente.
• Servicios Regulatorios regulados por ANEXO SR adjunto a la presente.
• Mano de obra, asistencia telefónica y viáticos a cargo de AGS ANALÍTICA S.A.
• Consumibles a cargo de AGS ANALÍTICA S.A. en Mantenimientos Preventivos y Regulatorios según anexos MP y SR respectivamente y que se adjuntan al presente.
• Tiempo preferencial de respuesta 24hs en equipos de control de calidad. Los llamados de aviso deben ser máximo 12hs para dar tiempo a la coordinación.

NOTA: Tiempo estimado de inicio de servicio: lo antes posible dentro de los 30 días a partir de la recepción de la Orden de Compra, de la aceptación de este presupuesto o de la acreditación en cuenta, sujeto a la existencia de stock de partes en fábrica y a la aprobación de SIRA.`,

    condicionesComerciales: `• Tiempo de respuesta estimado: dentro de las 72 horas desde la apertura de la orden de trabajo.
• Esta cotización no incluye otros servicios distintos de los indicados en el presente en su conjunto.
• El servicio que se describe en esta cotización se prestará donde resida físicamente el equipo al momento de la aceptación de la presente cotización.
• FACTURACIÓN: MENSUAL ADELANTADA.
• PAGO: 15 DÍAS FECHA DE FACTURA – CONTRA ENTREGA PARA PROVISIÓN DE CONSUMIBLES Y/O PARTES(*) - LA COTIZACIÓN SE ENTIENDE EN DÓLARES ESTADOUNIDENSES. SE EMITIRÁ FACTURA EN DÓLARES.
• MORA: La cuota de contrato debe pagarse en tiempo y forma según lo pactado en el acuerdo. En caso de haber incumplimientos se procederá a la suspensión de servicios hasta que la situación se encuentre regularizada.`,
  },
} as const;

/**
 * Convierte un número a texto en español para montos en presupuestos.
 * Ej: 57734.97 → "CINCUENTA Y SIETE MIL SETECIENTOS TREINTA Y CUATRO CON 97/100"
 */
export function numberToWords(n: number, moneda: string = 'USD'): string {
  const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE',
    'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE'];
  const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA',
    'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS',
    'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  const monedaTexto: Record<string, { singular: string; plural: string }> = {
    USD: { singular: 'DOLAR', plural: 'DOLARES' },
    ARS: { singular: 'PESO', plural: 'PESOS' },
    EUR: { singular: 'EURO', plural: 'EUROS' },
  };

  if (n === 0) return `CERO ${monedaTexto[moneda].plural}`;

  const entero = Math.floor(Math.abs(n));
  const decimales = Math.round((Math.abs(n) - entero) * 100);

  function convertirGrupo(num: number): string {
    if (num === 0) return '';
    if (num === 100) return 'CIEN';
    if (num < 10) return unidades[num];
    if (num <= 20) return especiales[num - 10];
    if (num < 30) return num === 20 ? 'VEINTE' : 'VEINTI' + unidades[num - 20];
    if (num < 100) {
      const d = Math.floor(num / 10);
      const u = num % 10;
      return u === 0 ? decenas[d] : `${decenas[d]} Y ${unidades[u]}`;
    }
    const c = Math.floor(num / 100);
    const resto = num % 100;
    return resto === 0 ? (num === 100 ? 'CIEN' : centenas[c]) : `${centenas[c]} ${convertirGrupo(resto)}`;
  }

  function convertir(num: number): string {
    if (num === 0) return '';
    if (num < 1000) return convertirGrupo(num);
    if (num < 1000000) {
      const miles = Math.floor(num / 1000);
      const resto = num % 1000;
      const milesTexto = miles === 1 ? 'MIL' : `${convertirGrupo(miles)} MIL`;
      return resto === 0 ? milesTexto : `${milesTexto} ${convertirGrupo(resto)}`;
    }
    const millones = Math.floor(num / 1000000);
    const resto = num % 1000000;
    const millTexto = millones === 1 ? 'UN MILLON' : `${convertir(millones)} MILLONES`;
    return resto === 0 ? millTexto : `${millTexto} ${convertir(resto)}`;
  }

  const parteEntera = convertir(entero);
  const monedaLabel = entero === 1 ? monedaTexto[moneda].singular : monedaTexto[moneda].plural;
  const centavosTexto = decimales > 0 ? ` CON ${String(decimales).padStart(2, '0')}/100` : '';

  return `Son ${parteEntera} ${monedaLabel}${centavosTexto}.`;
}

/**
 * Sufijos societarios típicos en razones sociales argentinas.
 * Se quitan al normalizar para matchear clientes con nombres casi iguales
 * ("DSM-Firmenich" ≡ "DSM Firmenich S.A.").
 */
const CORP_SUFFIXES = [
  'sociedad anonima',
  'sociedad anónima',
  'saic', 's a i c',
  'saci', 's a c i',
  'sac', 's a c',
  'sca', 's c a',
  'sas', 's a s',
  'srl', 's r l',
  'sa', 's a',
  'sh', 's h',
  'sc', 's c',
  'ltda',
  'limitada',
  'e hijos',
  'hnos', 'hermanos',
  'y cia', 'y compania', 'y compañia', 'y compañía',
  'cia', 'compania', 'compañia', 'compañía',
];

/**
 * Normaliza razón social para matching:
 *   - lowercase
 *   - sin acentos
 *   - sin puntuación (quedan letras, dígitos y espacios)
 *   - sin sufijos societarios al final
 *   - whitespace colapsado
 *
 * Diseñada para ser idempotente y reproducible en el script .mjs (no depende de features TS-only).
 */
export function normalizeRazonSocial(s: string | null | undefined): string {
  if (!s || typeof s !== 'string') return '';
  let out = s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Quitar sufijos societarios al final, en iteraciones — "foo s a i c" → "foo" (no "foo sa" antes de "saic").
  let changed = true;
  while (changed) {
    changed = false;
    for (const suf of CORP_SUFFIXES) {
      if (out === suf) { out = ''; changed = true; break; }
      if (out.endsWith(' ' + suf)) {
        out = out.slice(0, -suf.length - 1).trim();
        changed = true;
        break;
      }
    }
  }
  return out;
}

/**
 * Busca candidatos de cliente para un razón social tipeado.
 * Orden de criterios (se devuelven los de mejor criterio disponible):
 *   1. match exacto normalizado (ignora acentos, puntuación, sufijos)
 *   2. fallback: substring — el razón social del cliente contiene el tipeado o viceversa
 *
 * Devuelve TODOS los candidatos que matcheen con el mejor criterio encontrado; el caller decide:
 *   - 0 candidatos → no matchea
 *   - 1 candidato → match automático
 *   - 2+ candidatos → ambiguo (UI de revisión)
 */
export function findClienteCandidatesByRazonSocial<T extends { razonSocial: string }>(
  typed: string,
  clientes: T[],
): T[] {
  const key = normalizeRazonSocial(typed);
  if (!key) return [];
  const exact = clientes.filter(c => normalizeRazonSocial(c.razonSocial) === key);
  if (exact.length > 0) return exact;
  return clientes.filter(c => {
    const n = normalizeRazonSocial(c.razonSocial);
    if (!n) return false;
    return n.includes(key) || key.includes(n);
  });
}
