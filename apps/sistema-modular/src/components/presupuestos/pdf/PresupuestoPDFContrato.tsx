import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { baseStyles, COLORS } from './pdfStyles';
import './pdfFonts';
import type { PresupuestoPDFData } from './PresupuestoPDFEstandar';
import { agruparPorSistema } from './pdfUtils';

const S = baseStyles;

// Estilos específicos para contrato
const cs = StyleSheet.create({
  headerBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  bannerTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.primary,
    textAlign: 'center',
  },
  bannerSubtitle: {
    fontSize: 7,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  twoColRow: {
    flexDirection: 'row',
    marginBottom: 10,
    gap: 15,
  },
  colLeft: {
    width: '50%',
  },
  colRight: {
    width: '50%',
  },
  infoBlock: {
    borderWidth: 0.5,
    borderColor: COLORS.border,
    padding: 6,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 1.5,
  },
  infoLabel: {
    fontSize: 7,
    fontWeight: 600,
    color: COLORS.primary,
    width: 75,
  },
  infoValue: {
    fontSize: 7,
    color: COLORS.text,
    flex: 1,
  },
  // Grupo de sistema
  sistemaHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.sectionBg,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginTop: 8,
    marginBottom: 0,
  },
  sistemaHeaderText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: COLORS.primary,
    flex: 1,
  },
  // Módulos informativos
  modulosInfoBlock: {
    backgroundColor: '#f8fafc',
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderTopWidth: 0,
    paddingVertical: 3,
    paddingHorizontal: 6,
    marginBottom: 2,
  },
  moduloInfoRow: {
    flexDirection: 'row' as const,
    paddingVertical: 1.5,
    borderBottomWidth: 0.3,
    borderBottomColor: '#e2e8f0',
  },
  moduloInfoColName: {
    fontSize: 6.5,
    color: COLORS.text,
    width: '22%',
  },
  moduloInfoColDesc: {
    fontSize: 6.5,
    color: COLORS.textMuted,
    width: '30%',
  },
  moduloInfoColSerie: {
    fontSize: 6.5,
    color: COLORS.text,
    width: '28%',
  },
  moduloInfoColMarca: {
    fontSize: 6.5,
    color: COLORS.textMuted,
    width: '20%',
  },
  // Tabla contrato
  contratoTableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.headerBg,
    minHeight: 18,
    alignItems: 'center',
  },
  contratoHeaderCell: {
    fontSize: 6.5,
    fontWeight: 'bold',
    color: COLORS.headerText,
    paddingVertical: 3,
    paddingHorizontal: 3,
    textAlign: 'center',
  },
  contratoRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    minHeight: 15,
    alignItems: 'center',
  },
  contratoCell: {
    fontSize: 6.5,
    color: COLORS.text,
    paddingVertical: 2,
    paddingHorizontal: 3,
  },
  // Subtotal grupo
  grupoTotalRow: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginBottom: 2,
    borderWidth: 0.5,
    borderColor: COLORS.border,
  },
  grupoTotalLabel: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: COLORS.primary,
    flex: 1,
  },
  grupoTotalValue: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: COLORS.primary,
    textAlign: 'right',
    width: 100,
  },
  // Total general
  totalGeneralRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.headerBg,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 6,
    marginBottom: 8,
  },
  totalGeneralLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: COLORS.headerText,
    flex: 1,
  },
  totalGeneralValue: {
    fontSize: 9,
    fontWeight: 'bold',
    color: COLORS.headerText,
    textAlign: 'right',
    width: 120,
  },
  // Notas contrato
  notasBox: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    padding: 10,
    marginBottom: 12,
  },
  notasTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 6,
    textDecoration: 'underline',
  },
  notasBullet: {
    fontSize: 7,
    color: COLORS.text,
    lineHeight: 1.5,
    marginBottom: 2,
    paddingLeft: 8,
  },
});

// Columnas del contrato
const contratoCols = {
  item: '5%',
  equipo: '14%',
  serie: '11%',
  id: '10%',
  servicio: '10%',
  cant: '5%',
  descripcion: '30%',
  precio: '15%',
};

function ContratoHeader({ data }: { data: PresupuestoPDFData }) {
  const { presupuesto, cliente, establecimiento, contacto } = data;

  return (
    <View>
      {/* Banner superior */}
      <View style={cs.headerBanner}>
        <Image src={data.logoSrc} style={{ width: 100, height: 'auto' }} />
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={cs.bannerTitle}>PRESUPUESTO DE CONTRATO</Text>
          <Text style={{ fontSize: 8, color: COLORS.primary, marginTop: 1 }}>X</Text>
          <Text style={cs.bannerSubtitle}>DOCUMENTO NO VÁLIDO COMO FACTURA</Text>
        </View>
        <Image src={data.isoLogoSrc} style={{ width: 50, height: 'auto' }} />
      </View>

      {/* Dos columnas: AGS + Metadata | Cliente */}
      <View style={cs.twoColRow}>
        {/* Columna izquierda: datos AGS */}
        <View style={cs.colLeft}>
          <View style={cs.infoBlock}>
            <Text style={{ fontSize: 7.5, fontWeight: 'bold', color: COLORS.text, marginBottom: 3 }}>
              AGS ANALÍTICA S.A.
            </Text>
            <Text style={{ fontSize: 6.5, color: COLORS.textMuted, marginBottom: 1 }}>
              C.U.I.T. 30-70861861-2
            </Text>
            <Text style={{ fontSize: 6.5, color: COLORS.textMuted, marginBottom: 1 }}>
              I.Brutos CM 901-073399-2
            </Text>
            <Text style={{ fontSize: 6.5, color: COLORS.textMuted, marginBottom: 1 }}>
              I.V.A. Responsable Inscripto
            </Text>
            <Text style={{ fontSize: 6.5, color: COLORS.textMuted, marginBottom: 1 }}>
              Bauness 2351 1°C
            </Text>
            <Text style={{ fontSize: 6.5, color: COLORS.textMuted, marginBottom: 1 }}>
              C1431DNT - Ciudad de Buenos Aires
            </Text>
            <Text style={{ fontSize: 6.5, color: COLORS.textMuted, marginBottom: 1 }}>
              Tel: (011) 45-247-247 (45-AGS-AGS)
            </Text>
            <Text style={{ fontSize: 6.5, color: COLORS.textMuted }}>
              e-mail: info@agsanalitica.com
            </Text>
          </View>
        </View>

        {/* Columna derecha: metadata + cliente */}
        <View style={cs.colRight}>
          {/* Metadata presupuesto */}
          <View style={{ marginBottom: 6 }}>
            <View style={cs.infoRow}>
              <Text style={[cs.infoLabel, { fontWeight: 'bold' }]}>Fecha:</Text>
              <Text style={cs.infoValue}>{formatDateContrato(presupuesto.createdAt)}</Text>
            </View>
            <View style={cs.infoRow}>
              <Text style={[cs.infoLabel, { fontWeight: 'bold' }]}>N° de Presupuesto:</Text>
              <Text style={[cs.infoValue, { fontWeight: 'bold' }]}>{presupuesto.numero}</Text>
            </View>
            <View style={cs.infoRow}>
              <Text style={cs.infoLabel}>Oferta válida por:</Text>
              <Text style={cs.infoValue}>{presupuesto.validezDias || 15} días</Text>
            </View>
            <View style={cs.infoRow}>
              <Text style={cs.infoLabel}>Presupuesto:</Text>
              <Text style={cs.infoValue}>{presupuesto.responsableNombre || '-'}</Text>
            </View>
          </View>

          {/* Datos cliente */}
          <View style={cs.infoBlock}>
            <View style={cs.infoRow}>
              <Text style={cs.infoLabel}>Cliente:</Text>
              <Text style={[cs.infoValue, { fontWeight: 'bold' }]}>
                {cliente?.razonSocial || '-'}
              </Text>
            </View>
            <View style={cs.infoRow}>
              <Text style={cs.infoLabel}>Attn:</Text>
              <Text style={cs.infoValue}>{contacto?.nombre || '-'}</Text>
            </View>
            <View style={cs.infoRow}>
              <Text style={cs.infoLabel}>Sector:</Text>
              <Text style={cs.infoValue}>{contacto?.sector || '-'}</Text>
            </View>
            <View style={cs.infoRow}>
              <Text style={cs.infoLabel}>Dirección:</Text>
              <Text style={cs.infoValue}>{establecimiento?.direccion || '-'}</Text>
            </View>
            <View style={cs.infoRow}>
              <Text style={cs.infoLabel}>Localidad:</Text>
              <Text style={cs.infoValue}>
                {[establecimiento?.codigoPostal, establecimiento?.localidad].filter(Boolean).join(' - ') || '-'}
              </Text>
            </View>
            <View style={cs.infoRow}>
              <Text style={cs.infoLabel}>Provincia:</Text>
              <Text style={cs.infoValue}>{establecimiento?.provincia || '-'}</Text>
            </View>
            <View style={cs.infoRow}>
              <Text style={cs.infoLabel}>Teléfono:</Text>
              <Text style={cs.infoValue}>{contacto?.telefono || '-'}</Text>
            </View>
            <View style={cs.infoRow}>
              <Text style={cs.infoLabel}>e-mail:</Text>
              <Text style={cs.infoValue}>{contacto?.email || '-'}</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function formatDateContrato(dateValue: any): string {
  if (!dateValue) return '-';
  try {
    // Handle Firestore Timestamp objects
    const d = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
    if (isNaN(d.getTime())) return '-';
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${d.getDate()}-${meses[d.getMonth()]}-${d.getFullYear()}`;
  } catch {
    return '-';
  }
}

function ContratoItemsTable({ data }: { data: PresupuestoPDFData }) {
  const grupos = agruparPorSistema(data.presupuesto.items);
  const moneda = data.presupuesto.moneda;

  return (
    <View style={S.table}>
      {/* Header global de tabla */}
      <View style={cs.contratoTableHeader}>
        <Text style={[cs.contratoHeaderCell, { width: contratoCols.item }]}>ITEM</Text>
        <Text style={[cs.contratoHeaderCell, { width: contratoCols.equipo, textAlign: 'left' }]}>EQUIPO</Text>
        <Text style={[cs.contratoHeaderCell, { width: contratoCols.serie }]}>Nro. de Serie</Text>
        <Text style={[cs.contratoHeaderCell, { width: contratoCols.id }]}>ID</Text>
        <Text style={[cs.contratoHeaderCell, { width: contratoCols.servicio }]}>SERVICIO</Text>
        <Text style={[cs.contratoHeaderCell, { width: contratoCols.cant }]}>CANT</Text>
        <Text style={[cs.contratoHeaderCell, { width: contratoCols.descripcion, textAlign: 'left' }]}>DESCRIPCIÓN</Text>
        <Text style={[cs.contratoHeaderCell, { width: contratoCols.precio }]}>PRECIO ANUAL {moneda}</Text>
      </View>

      {/* Grupos por sistema */}
      {grupos.map((grupo) => (
        <View key={grupo.grupo} wrap={false}>
          {/* Nombre del sistema */}
          <View style={cs.sistemaHeader}>
            <Text style={cs.sistemaHeaderText}>
              {grupo.grupo}. {grupo.sistemaNombre?.toUpperCase()}
            </Text>
          </View>

          {/* Items (ID equipo, servicio, precio) */}
          {grupo.items.map((item, i) => (
            <View key={item.id} style={[cs.contratoRow, i % 2 === 1 ? { backgroundColor: COLORS.rowAlt } : {}]} wrap={false}>
              <Text style={[cs.contratoCell, { width: contratoCols.item, textAlign: 'center' }]}>
                {item.subItem || `${grupo.grupo}.${i + 1}`}
              </Text>
              <Text style={[cs.contratoCell, { width: contratoCols.equipo }]}>
                {item.moduloNombre || item.sistemaNombre || '-'}
              </Text>
              <Text style={[cs.contratoCell, { width: contratoCols.serie, fontSize: 6 }]}>
                {item.moduloSerie || '-'}
              </Text>
              <Text style={[cs.contratoCell, { width: contratoCols.id, fontSize: 6 }]}>
                {item.sistemaCodigoInterno || item.codigoProducto || '-'}
              </Text>
              <Text style={[cs.contratoCell, { width: contratoCols.servicio, fontSize: 6 }]}>
                {item.servicioCode || item.codigoProducto || '-'}
              </Text>
              <Text style={[cs.contratoCell, { width: contratoCols.cant, textAlign: 'center' }]}>
                {item.cantidad}
              </Text>
              <Text style={[cs.contratoCell, { width: contratoCols.descripcion }]}>
                {item.descripcion}
              </Text>
              <Text style={[cs.contratoCell, { width: contratoCols.precio, textAlign: 'right' }]}>
                {item.esBonificacion ? 'Bonif.' : item.subtotal?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          ))}

          {/* Servicios (mantenimiento, validación, recalificación, bonificación) */}
          {grupo.servicios.map((item, i) => (
            <View key={item.id} style={[cs.contratoRow, { backgroundColor: COLORS.rowAlt }]} wrap={false}>
              <Text style={[cs.contratoCell, { width: contratoCols.item, textAlign: 'center' }]}>
                {item.subItem || `${grupo.grupo}.${20 + i * 10}`}
              </Text>
              <Text style={[cs.contratoCell, { width: contratoCols.equipo }]}>
                {item.moduloNombre || ''}
              </Text>
              <Text style={[cs.contratoCell, { width: contratoCols.serie, fontSize: 6 }]}>
                {item.moduloSerie || ''}
              </Text>
              <Text style={[cs.contratoCell, { width: contratoCols.id, fontSize: 6 }]}>
                {item.sistemaCodigoInterno || item.codigoProducto || ''}
              </Text>
              <Text style={[cs.contratoCell, { width: contratoCols.servicio, fontSize: 6 }]}>
                {item.servicioCode || item.codigoProducto || '-'}
              </Text>
              <Text style={[cs.contratoCell, { width: contratoCols.cant, textAlign: 'center' }]}>
                {item.cantidad || ''}
              </Text>
              <Text style={[cs.contratoCell, { width: contratoCols.descripcion }]}>
                {item.descripcion}
              </Text>
              <Text style={[cs.contratoCell, { width: contratoCols.precio, textAlign: 'right', fontWeight: 600 }]}>
                {item.subtotal?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          ))}

          {/* Módulos informativos del sistema */}
          {(() => {
            const sid = grupo.items[0]?.sistemaId || grupo.servicios[0]?.sistemaId;
            const mods = sid && data.modulosBySistema?.[sid];
            if (!mods || mods.length === 0) return null;
            return (
              <View style={cs.modulosInfoBlock}>
                <View style={cs.moduloInfoRow}>
                  <Text style={[cs.moduloInfoColName, { fontWeight: 'bold' }]}>Módulo</Text>
                  <Text style={[cs.moduloInfoColDesc, { fontWeight: 'bold' }]}>Descripción</Text>
                  <Text style={[cs.moduloInfoColSerie, { fontWeight: 'bold' }]}>Nro. de Serie</Text>
                  <Text style={[cs.moduloInfoColMarca, { fontWeight: 'bold' }]}>Marca</Text>
                </View>
                {mods.map((m) => (
                  <View key={m.id} style={cs.moduloInfoRow}>
                    <Text style={cs.moduloInfoColName}>{m.nombre || '-'}</Text>
                    <Text style={cs.moduloInfoColDesc}>{m.descripcion || '-'}</Text>
                    <Text style={cs.moduloInfoColSerie}>{m.serie || '-'}</Text>
                    <Text style={cs.moduloInfoColMarca}>{m.marca || '-'}</Text>
                  </View>
                ))}
              </View>
            );
          })()}

          {/* Total grupo */}
          <View style={cs.grupoTotalRow}>
            <Text style={cs.grupoTotalLabel}>TOTAL ANUAL</Text>
            <Text style={cs.grupoTotalValue}>
              {grupo.totalGrupo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </View>
      ))}

      {/* Total general */}
      <View style={cs.totalGeneralRow}>
        <Text style={cs.totalGeneralLabel}>
          VALOR TOTAL ANUAL SIN IVA
        </Text>
        <Text style={cs.totalGeneralValue}>
          {data.presupuesto.subtotal?.toLocaleString('es-AR', { minimumFractionDigits: 2 })} {data.presupuesto.moneda}
        </Text>
      </View>

      {/* Monto en letras */}
      <Text style={S.monedaLetras}>{data.montoEnLetras}</Text>
    </View>
  );
}

function ContratoCondiciones({ data }: { data: PresupuestoPDFData }) {
  const { presupuesto } = data;
  const secciones = presupuesto.seccionesVisibles || {};

  const sections: { key: string; title: string; content: string | null | undefined }[] = [
    { key: 'notasTecnicas', title: 'NOTAS SOBRE ESTE PRESUPUESTO', content: presupuesto.notasTecnicas },
    { key: 'condicionesComerciales', title: 'CONDICIONES COMERCIALES', content: presupuesto.condicionesComerciales },
    { key: 'garantia', title: 'GARANTÍA', content: presupuesto.garantia },
    { key: 'variacionTipoCambio', title: 'NOTA SOBRE LA VARIACIÓN DEL TIPO DE CAMBIO', content: presupuesto.variacionTipoCambio },
    { key: 'notasAdministrativas', title: 'NOTAS ADMINISTRATIVAS', content: presupuesto.notasAdministrativas },
    { key: 'aceptacionPresupuesto', title: 'ACEPTACIÓN DEL PRESUPUESTO', content: presupuesto.aceptacionPresupuesto },
  ];

  const visibleSections = sections.filter(s => {
    const isVisible = secciones[s.key as keyof typeof secciones] !== false;
    return isVisible && s.content;
  });

  return (
    <View>
      {visibleSections.map((section) => (
        <View key={section.key} style={cs.notasBox} wrap={false}>
          <Text style={cs.notasTitle}>{section.title}</Text>
          <Text style={{ fontSize: 7, color: COLORS.text, lineHeight: 1.5 }}>
            {section.content}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ContratoAceptacion({ data }: { data: PresupuestoPDFData }) {
  return (
    <View wrap={false}>
      <View style={{
        borderWidth: 1,
        borderColor: COLORS.primary,
        padding: 10,
        marginBottom: 15,
      }}>
        <Text style={{ fontSize: 7.5, fontWeight: 'bold', color: COLORS.primary, marginBottom: 6 }}>
          ACEPTACIÓN DEL PRESUPUESTO
        </Text>
        <Text style={{ fontSize: 7, color: COLORS.text, marginBottom: 4 }}>
          Enviar Orden de Compra mencionando número de presupuesto y completar la siguiente solicitud con los datos requeridos:
        </Text>
        <Text style={{ fontSize: 8, fontWeight: 600, color: COLORS.text, marginBottom: 10 }}>
          Acepto el presente Presupuesto N° {data.presupuesto.numero}
        </Text>

        {/* Campos firma */}
        <View style={{ flexDirection: 'row', gap: 20, marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 7, color: COLORS.primary, marginBottom: 2 }}>Fecha:</Text>
            <View style={{ borderBottomWidth: 1, borderBottomColor: COLORS.text, height: 20 }} />
          </View>
          <View style={{ flex: 2 }}>
            <Text style={{ fontSize: 7, color: COLORS.primary, marginBottom: 2 }}>Firma y Aclaración:</Text>
            <View style={{ borderBottomWidth: 1, borderBottomColor: COLORS.text, height: 20 }} />
          </View>
        </View>
      </View>
    </View>
  );
}

function ContratoFooter({ presupuesto }: { presupuesto: { numero: string } }) {
  return (
    <View style={S.footer} fixed>
      <Text style={S.footerLeft}>Archivo: Presupuesto de Contrato</Text>
      <Text style={S.footerCenter}>{presupuesto.numero}</Text>
      <Text
        style={S.footerRight}
        render={({ pageNumber, totalPages }) => `HOJA ${pageNumber} DE ${totalPages}`}
      />
    </View>
  );
}

export function PresupuestoPDFContrato({ data }: { data: PresupuestoPDFData }) {
  return (
    <Document
      title={`Presupuesto de Contrato ${data.presupuesto.numero}`}
      author="AGS Analítica S.A."
      subject="Presupuesto de Contrato"
    >
      {/* Páginas de items */}
      <Page size="A4" style={S.page}>
        <ContratoHeader data={data} />
        <ContratoItemsTable data={data} />
        <ContratoFooter presupuesto={data.presupuesto} />
      </Page>

      {/* Página de condiciones */}
      <Page size="A4" style={S.page}>
        <View style={cs.headerBanner}>
          <Image src={data.logoSrc} style={{ width: 80, height: 'auto' }} />
          <Text style={{ fontSize: 9, fontWeight: 'bold', color: COLORS.primary }}>
            DOCUMENTO NO VÁLIDO COMO FACTURA
          </Text>
        </View>
        <ContratoCondiciones data={data} />
        <ContratoAceptacion data={data} />
        <ContratoFooter presupuesto={data.presupuesto} />
      </Page>
    </Document>
  );
}
