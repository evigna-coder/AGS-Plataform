import { Document, Page, Text, View } from '@react-pdf/renderer';
import type { DatosImpresionOT } from '../../../utils/otPrintData';
import { esTrabajoEnBench } from '../../../utils/agendaCellColor';
import { s } from './otPdfStyles';
import { OTConfiguracionSection } from './OTConfiguracionSection';

const KV = ({ k, v, strong }: { k: string; v: string; strong?: boolean }) => (
  <View style={s.kv}>
    <Text style={s.k}>{k}</Text>
    <Text style={strong ? s.vStrong : s.v}>{v}</Text>
  </View>
);

const Sec = ({ t, children }: { t: string; children: React.ReactNode }) => (
  <View style={s.block}>
    <View style={s.secHead}>
      <Text style={s.secTitle}>{t}</Text>
      <View style={s.secRule} />
    </View>
    {children}
  </View>
);

const softwareDe = (d: DatosImpresionOT): string => {
  const list = d.sistema?.softwares?.length
    ? d.sistema.softwares
    : d.sistema?.software
      ? [{ nombre: d.sistema.software, revision: d.sistema.softwareRevision }]
      : [];
  return list.map(x => `${x.nombre}${x.revision ? ` · Rev. ${x.revision}` : ''}`).join(' / ') || '—';
};

/**
 * dd/mm/aaaa. Un `YYYY-MM-DD` pelado se formatea a mano: `new Date('2026-08-14')`
 * lo parsea como medianoche UTC y en Argentina (UTC-3) imprime el dia ANTERIOR
 * — el 14 salia 13/08 en la hoja.
 */
const fecha = (iso?: string | null) => {
  if (!iso) return '—';
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.slice(0, 10));
  if (soloFecha) return `${soloFecha[3]}/${soloFecha[2]}/${soloFecha[1]}`;
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime())
    ? iso
    : `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
};

/**
 * Hoja imprimible de la OT — el trabajo A REALIZAR, no el reporte de lo hecho
 * (2026-08-14).
 *
 * Acompaña al modulo en el banco de trabajo: por eso la configuracion del
 * sistema con el modulo intervenido destacado es la seccion central, y por eso
 * todo el diseño esta pensado para blanco y negro.
 *
 * El reporte tecnico del servicio lo sigue generando `reportes-ot`; esto es
 * otra cosa y no lo reemplaza.
 */
export function OTPrintablePDF({ d }: { d: DatosImpresionOT }) {
  const { ot, cliente, establecimiento, sistema, presupuesto } = d;
  const domicilio = [
    establecimiento?.direccion || cliente?.direccionFiscal || cliente?.direccion,
    establecimiento?.localidad || cliente?.localidad,
    establecimiento?.provincia || cliente?.provincia,
  ].filter(Boolean).join(', ') || '—';
  const ocs = [...(ot.ordenesCompra ?? []), ...(ot.ordenCompra ? [ot.ordenCompra] : [])]
    .filter((v, i, a) => v && a.indexOf(v) === i);
  const condicion = [
    ot.esSinCargo ? 'Sin cargo' : ot.esFacturable ? 'Facturable' : 'No facturable',
    ot.tieneContrato ? 'con contrato' : 'sin contrato',
    ot.esGarantia ? 'en garantia' : null,
  ].filter(Boolean).join(' · ');

  return (
    <Document title={`OT-${ot.otNumber}`}>
      <Page size="A4" style={s.page}>
        <View style={s.header} fixed>
          <View style={s.headLeft}>
            <Text style={s.otNum}>OT-{ot.otNumber}</Text>
            <View style={s.chip}><Text style={s.chipTxt}>{d.estadoLabel.toUpperCase()}</Text></View>
          </View>
          <View style={s.headRight}>
            <Text style={s.marca}>AGS ANALITICA · ORDEN DE TRABAJO</Text>
            <Text style={s.emitida}>{ot.tipoServicio || 'Servicio tecnico'}</Text>
          </View>
        </View>

        <View style={s.cols}>
          <View style={s.colA}>
            <Sec t="CLIENTE">
              <KV k="Razon social" v={cliente?.razonSocial || ot.razonSocial || '—'} strong />
              <KV k="Establecimiento" v={establecimiento?.nombre || '—'} />
              <KV k="Domicilio" v={domicilio} />
              <KV k="Contacto" v={ot.contacto || '—'} />
            </Sec>
            <Sec t="EQUIPO">
              <KV k="Sistema" v={sistema?.nombre || ot.sistema || '—'} strong />
              <KV k="ID AGS" v={sistema?.agsVisibleId || '—'} />
              <KV k="Software" v={softwareDe(d)} />
              <KV k="Cod. cliente" v={sistema?.codigoInternoCliente || ot.codigoInternoCliente || '—'} />
              <KV k="Sector" v={sistema?.sector || ot.sector || '—'} />
              {sistema?.observaciones ? <Text style={s.obs}>{sistema.observaciones}</Text> : null}
            </Sec>
          </View>

          <View style={s.colB}>
            {/* SERVICIO va en la columna derecha para EQUILIBRAR las dos
                (2026-08-14): con el detalle tecnico movido abajo, la izquierda
                quedaba mucho mas larga y empujaba todo a una segunda pagina. */}
            <Sec t="SERVICIO">
              <KV k="Tipo" v={ot.tipoServicio || '—'} />
              <KV k="Ingeniero" v={ot.ingenieroAsignadoNombre || '—'} />
              <KV k="Fecha asignada" v={fecha(ot.fechaServicioAprox || ot.fechaInicio)} />
            </Sec>
            <Sec t="COMERCIAL">
              <KV k="Presupuesto" v={ot.budgets?.join(' · ') || '—'} />
              <KV k="Estado ppto" v={presupuesto?.estado?.replace(/_/g, ' ') || '—'} />
              <KV k="OC cliente" v={ocs.join(' · ') || '—'} />
              <KV k="Condicion" v={condicion} />
            </Sec>
            {ot.comentarioFacturacion ? (
              <Sec t="CONDICIONES DEL TRABAJO">
                <View style={s.caja}><Text style={s.cajaTxt}>{ot.comentarioFacturacion}</Text></View>
              </Sec>
            ) : null}
          </View>
        </View>

        <OTConfiguracionSection
          modulos={d.modulos}
          moduloEnBenchId={d.moduloEnBenchId}
          moduloModelo={[ot.moduloModelo, ot.moduloDescripcion].filter(Boolean).join(' ')}
          moduloSerie={ot.moduloSerie}
          esBench={esTrabajoEnBench(ot.tipoServicio)}
        />

        {/* Detalle tecnico a ancho completo y abajo (2026-08-14): apretado en la
            columna derecha se leia en un renglon de 250 pt, y es el texto mas
            largo de la hoja. El recuadro tiene alto minimo para que el bloque
            exista aunque el texto sea corto. */}
        <View style={{ marginTop: 16 }}>
          <View style={s.secHead}>
            <Text style={s.secTitle}>DETALLE TECNICO</Text>
            <View style={s.secRule} />
          </View>
          <View style={s.detalle}>
            {ot.problemaFallaInicial ? (
              <Text style={s.detalleTxt}>{ot.problemaFallaInicial}</Text>
            ) : (
              <Text style={s.detalleVacio}>Sin detalle tecnico cargado en la OT.</Text>
            )}
          </View>
        </View>

        {(d.materiales.length > 0 || ot.materialesParaServicio) && (
          <View style={{ marginTop: 16 }}>
            <View style={s.secHead}>
              <Text style={s.secTitle}>MATERIALES ASIGNADOS AL SERVICIO</Text>
              <View style={s.secRule} />
            </View>
            {ot.materialesParaServicio ? (
              <Text style={{ ...s.cajaTxt, marginBottom: 4 }}>{ot.materialesParaServicio}</Text>
            ) : null}
            {d.materiales.length > 0 && (
              <>
                <View style={s.tblHead}>
                  <Text style={{ ...s.th, width: 34 }}>CANT</Text>
                  <Text style={{ ...s.th, width: 110 }}>CODIGO</Text>
                  <Text style={{ ...s.th, flex: 1 }}>DESCRIPCION</Text>
                </View>
                {d.materiales.map((m, i) => (
                  <View key={i} style={s.tblRow} wrap={false}>
                    <Text style={{ fontSize: 8.5, width: 34, fontWeight: 'bold' }}>{m.cantidad}</Text>
                    <Text style={{ fontSize: 8, width: 110 }}>{m.codigo}</Text>
                    <Text style={{ fontSize: 8.5, flex: 1 }}>{m.descripcion}</Text>
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        {d.tareas.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <View style={s.secHead}>
              <Text style={s.secTitle}>TAREAS A REALIZAR</Text>
              <View style={s.secRule} />
            </View>
            {d.tareas.map((t, i) => (
              <View key={i} style={{ ...s.tarea, borderTopWidth: i ? 0 : 1 }} wrap={false}>
                <View style={s.casillero} />
                <Text style={s.tareaNum}>{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.tareaTxt}>{t.descripcion}</Text>
                  {t.detalle ? <Text style={s.tareaDet}>{t.detalle}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={s.pie} fixed>
          <Text style={s.pieTxt}>Llevar esta hoja al servicio · alcance segun {ot.budgets?.[0] || 'la OT'}</Text>
          <Text style={s.pieTxt} render={({ pageNumber, totalPages }) =>
            `OT-${ot.otNumber} · ${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
