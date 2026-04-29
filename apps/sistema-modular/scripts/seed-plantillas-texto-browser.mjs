/**
 * Seed plantillas de textos para presupuestos — one-shot browser-based migration.
 *
 * USAGE:
 *   1. Open localhost:3001 (or production) and authenticate as admin.
 *   2. Open browser devtools console (F12 → Console).
 *   3. Run this file with node to print the inner script:
 *        node apps/sistema-modular/scripts/seed-plantillas-texto-browser.mjs
 *   4. Copy the script printed below and paste into the browser console.
 *   5. Wait for the summary log: "Created N, skipped M, total seeded".
 *
 * The script is IDEMPOTENT: re-running it skips plantillas whose (nombre, tipo)
 * combination already exists in `plantillas_texto_presupuesto`.
 *
 * Source content mirrors: packages/shared/src/utils.ts (PRESUPUESTO_TEMPLATES)
 */

const script = `
(async () => {
  const { getFirestore, collection, getDocs, addDoc, Timestamp } = await import('https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js');
  const { getApp } = await import('https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js');
  const app = getApp();
  const db = getFirestore(app);

  // ----- 1. Inline PRESUPUESTO_TEMPLATES (mirror of packages/shared/src/utils.ts) -----
  const PRESUPUESTO_TEMPLATES = {
    notasTecnicas: 'Este presupuesto incluye los gastos de viaticos para CABA y Gran Buenos Aires, hasta un radio de 90km. Para servicios realizados a mayores distancias entre el laboratorio y CABA, los viaticos estan incluidos solo si figuran detallados.\\n\\nEste presupuesto se confecciona segun la informacion proporcionada por el cliente, y no contempla gastos adicionales a los que AGS ANALITICA considera usuales.\\n\\nEl servicio detallado se prestara donde resida fisicamente el equipo al momento del envio del presupuesto, segun lo manifestado por el cliente. En caso de que la ubicacion del equipo sea distinta, el presente presupuesto no tendra validez, independientemente del envio de una Orden de Compra por parte del Cliente.',

    notasAdministrativas: 'Este presupuesto contempla el traslado de ingenieros de servicio tecnico hasta sus instalaciones.\\n\\nEn caso de haber solicitudes adicionales (estudios medicos adicionales a los rutinarios periodicos, induccion para ingreso a planta en dias especificos que por alguna razon representen gastos extras, etc.), y que estas solicitudes generen gastos adicionales, el presente presupuesto no tendra validez, y se enviara uno nuevo que lo reemplazara.',

    garantia: 'Las partes reemplazadas en una reparacion tienen una garantia de 60 dias corridos desde el momento de la instalacion, siempre que personal de AGS ANALITICA verifique un defecto en la fabricacion.\\n\\nLos consumibles utilizados NO tienen garantia, salvo falla de fabricacion detectada al momento de la instalacion por personal de AGS Analitica S.A.',

    variacionTipoCambio: 'TRANSFERENCIAS: Si el tipo de cambio DOLAR BILLETE vendedor del BNA al cierre del dia anterior al dia de la transferencia difiriera en mas de un 1% respecto del tipo de cambio DOLAR BILLETE vendedor del BNA al dia anterior al de la emision de la factura correspondiente, se debera ajustar dicho valor emitiendo nota de debito o nota de credito, segun el caso.\\n\\nTasa de interes por pago fuera de termino: 0,2% diario.',

    condicionesComerciales: 'IMPORTANTE: Si por cualquier razon, AGS ANALITICA no estuviera en condiciones de realizar un giro al exterior de manera contemporanea a la transferencia realizada por el CLIENTE, se tomara el giro realizado por el CLIENTE en moneda PESOS, independientemente de cualquier variacion que pudiera sufrir la cotizacion del dolar entre el momento de la transferencia del CLIENTE hasta el momento en que AGS ANALITICA realice el giro al exterior.\\n\\nPor esa razon, para presupuestos que incluyan partes o consumibles por un valor mayor a 1000 USD, NO realizar NINGUNA transferencia sin la autorizacion previa por parte de AGS ANALITICA.\\n\\nSolicitamos enviar: Orden de compra (de ser necesario), formulario de inscripcion AFIP e ingresos brutos.\\nCheques a la orden de AGS ANALITICA S.A. - No se aceptan cheques de terceros.',

    aceptacionPresupuesto: 'A) Su empresa trabaja con Orden de Compra? Es necesaria la misma para la posterior facturacion de este presupuesto? Enviar Orden de Compra mencionando numero de presupuesto al (011) 4524-7247 (opcion 2) o a info@agsanalitica.com\\n\\nB) Su Empresa NO trabaja con Orden de Compra o bien NO es necesaria la misma para proceder a la posterior facturacion de este presupuesto? Completar la siguiente solicitud con los datos requeridos y enviar por fax al (011) 4524-7247 (opcion 2) o a info@agsanalitica.com',

    contrato: {
      notasSobrePresupuesto: '• La firma de la presente implica la aceptacion de las condiciones generales del Servicio Prestacional de Soporte Tecnico Analitico a Clientes de AGS ANALITICA S.A.\\n• Servicios Correctivos regulados por ANEXO AT adjunto a la presente.\\n• Servicios Preventivos regulados por ANEXO MP adjunto a la presente.\\n• Servicios Regulatorios regulados por ANEXO SR adjunto a la presente.\\n• Mano de obra, asistencia telefonica y viaticos a cargo de AGS ANALITICA S.A.\\n• Consumibles a cargo de AGS ANALITICA S.A. en Mantenimientos Preventivos y Regulatorios segun anexos MP y SR respectivamente y que se adjuntan al presente.\\n• Tiempo preferencial de respuesta 24hs en equipos de control de calidad. Los llamados de aviso deben ser maximo 12hs para dar tiempo a la coordinacion.\\n\\nNOTA: Tiempo estimado de inicio de servicio: lo antes posible dentro de los 30 dias a partir de la recepcion de la Orden de Compra, de la aceptacion de este presupuesto o de la acreditacion en cuenta, sujeto a la existencia de stock de partes en fabrica y a la aprobacion de SIRA.',

      condicionesComerciales: '• Tiempo de respuesta estimado: dentro de las 72 horas desde la apertura de la orden de trabajo.\\n• Esta cotizacion no incluye otros servicios distintos de los indicados en el presente en su conjunto.\\n• El servicio que se describe en esta cotizacion se prestara donde resida fisicamente el equipo al momento de la aceptacion de la presente cotizacion.\\n• FACTURACION: MENSUAL ADELANTADA.\\n• PAGO: 15 DIAS FECHA DE FACTURA - CONTRA ENTREGA PARA PROVISION DE CONSUMIBLES Y/O PARTES(*) - LA COTIZACION SE ENTIENDE EN DOLARES ESTADOUNIDENSES. SE EMITIRA FACTURA EN DOLARES.\\n• MORA: La cuota de contrato debe pagarse en tiempo y forma segun lo pactado en el acuerdo. En caso de haber incumplimientos se procedera a la suspension de servicios hasta que la situacion se encuentre regularizada.',
    },
  };

  // ----- 2. plainToHtml: convert plain text with \\n + bullets to formatted HTML -----
  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function plainToHtml(text) {
    const lines = text.split('\\n');
    const out = [];
    let listBuffer = [];
    function flushList() {
      if (listBuffer.length > 0) {
        out.push('<ul>' + listBuffer.map(function(item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ul>');
        listBuffer = [];
      }
    }
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('\\u2022')) {
        listBuffer.push(line.substring(1).trim());
        continue;
      }
      flushList();
      if (line === '') {
        out.push('<br>');
      } else {
        out.push('<div>' + escapeHtml(line) + '</div>');
      }
    }
    flushList();
    return out.join('');
  }

  // ----- 3. Define the 8 plantillas to seed -----
  const TIPOS_BASE = ['servicio', 'partes', 'ventas', 'mixto'];
  const plantillasToSeed = [
    { nombre: 'Notas Tecnicas - Estandar',             tipo: 'notasTecnicas',           tipoPresupuestoAplica: TIPOS_BASE,    contenido: plainToHtml(PRESUPUESTO_TEMPLATES.notasTecnicas) },
    { nombre: 'Notas Administrativas - Estandar',      tipo: 'notasAdministrativas',    tipoPresupuestoAplica: TIPOS_BASE,    contenido: plainToHtml(PRESUPUESTO_TEMPLATES.notasAdministrativas) },
    { nombre: 'Garantia - Estandar',                   tipo: 'garantia',                tipoPresupuestoAplica: TIPOS_BASE,    contenido: plainToHtml(PRESUPUESTO_TEMPLATES.garantia) },
    { nombre: 'Variacion Tipo de Cambio - Estandar',   tipo: 'variacionTipoCambio',     tipoPresupuestoAplica: TIPOS_BASE,    contenido: plainToHtml(PRESUPUESTO_TEMPLATES.variacionTipoCambio) },
    { nombre: 'Condiciones Comerciales - Estandar',    tipo: 'condicionesComerciales',  tipoPresupuestoAplica: TIPOS_BASE,    contenido: plainToHtml(PRESUPUESTO_TEMPLATES.condicionesComerciales) },
    { nombre: 'Aceptacion del Presupuesto - Estandar', tipo: 'aceptacionPresupuesto',   tipoPresupuestoAplica: TIPOS_BASE,    contenido: plainToHtml(PRESUPUESTO_TEMPLATES.aceptacionPresupuesto) },
    { nombre: 'Notas sobre Presupuesto - Contrato',    tipo: 'notasTecnicas',           tipoPresupuestoAplica: ['contrato'],  contenido: plainToHtml(PRESUPUESTO_TEMPLATES.contrato.notasSobrePresupuesto) },
    { nombre: 'Condiciones Comerciales - Contrato',    tipo: 'condicionesComerciales',  tipoPresupuestoAplica: ['contrato'],  contenido: plainToHtml(PRESUPUESTO_TEMPLATES.contrato.condicionesComerciales) },
  ];

  // ----- 4. Read existing plantillas (idempotency) -----
  console.log('1. Reading existing plantillas_texto_presupuesto...');
  const snap = await getDocs(collection(db, 'plantillas_texto_presupuesto'));
  const existingKeys = new Set();
  snap.forEach(function(d) {
    const data = d.data();
    existingKeys.add((data.nombre || '') + '||' + (data.tipo || ''));
  });
  console.log('   Found ' + existingKeys.size + ' existing plantillas.');

  // ----- 5. Insert missing plantillas -----
  console.log('2. Seeding plantillas...');
  let created = 0, skipped = 0;
  for (let i = 0; i < plantillasToSeed.length; i++) {
    const p = plantillasToSeed[i];
    const key = p.nombre + '||' + p.tipo;
    if (existingKeys.has(key)) {
      console.log('   skip (exists): ' + p.nombre + ' [' + p.tipo + ']');
      skipped++;
      continue;
    }
    const payload = {
      nombre: p.nombre,
      tipo: p.tipo,
      contenido: p.contenido,
      tipoPresupuestoAplica: p.tipoPresupuestoAplica,
      esDefault: true,
      activo: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: null,
      createdByName: null,
      updatedBy: null,
      updatedByName: null,
    };
    const ref = await addDoc(collection(db, 'plantillas_texto_presupuesto'), payload);
    console.log('   created: ' + p.nombre + ' [' + p.tipo + '] id=' + ref.id);
    created++;
  }

  console.log('');
  console.log('==========================================');
  console.log('Done. Created: ' + created + '. Skipped: ' + skipped + '. Total seeded so far: ' + (created + skipped));
  console.log('==========================================');
})();
`;

console.log('=== Copia y pega este codigo en la consola del browser (F12) en localhost:3001 ===\n');
console.log(script);
