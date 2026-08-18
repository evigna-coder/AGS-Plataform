import { Text, View } from '@react-pdf/renderer';
import type { ModuloSistema } from '@ags/shared';
import { s } from './otPdfStyles';

interface Props {
  modulos: ModuloSistema[];
  moduloEnBenchId: string | null;
  /** Fallback cuando no se pudo casar el modulo con la configuracion. */
  moduloModelo?: string;
  moduloSerie?: string;
  /**
   * `true` solo si el tipo de servicio ES trabajo/reparacion en bench
   * (2026-08-14). Antes el recuadro decia "EN BENCH" siempre, y la mayoria de
   * las OT son bench pero no todas: en una visita a planta el equipo no esta en
   * el taller y el cartel mentia.
   */
  esBench: boolean;
}

const texto = (m: ModuloSistema) => [m.marca, m.descripcion].filter(Boolean).join(' ') || '—';
const serieFw = (m: ModuloSistema) =>
  [m.serie ? `S/N ${m.serie}` : null, m.firmware ? `FW ${m.firmware}` : null]
    .filter(Boolean).join(' · ') || '—';

/**
 * Configuracion del sistema: el modulo que esta en BENCH destacado y el resto
 * en dos columnas (2026-08-14).
 *
 * Es el motivo de existir de esta hoja: acompaña al modulo en el banco de
 * trabajo para que cualquiera lo empareje con su OT y su cliente sin abrir el
 * sistema. El destacado no usa color —la hoja se imprime en blanco y negro—:
 * borde negro de 2 pt, fondo apenas gris y un chip negro pleno.
 */
export function OTConfiguracionSection({ modulos, moduloEnBenchId, moduloModelo, moduloSerie, esBench }: Props) {
  const bench = modulos.find(m => m.id === moduloEnBenchId) ?? null;
  const resto = modulos.filter(m => m.id !== moduloEnBenchId);
  const filas: ModuloSistema[][] = [];
  for (let i = 0; i < resto.length; i += 2) filas.push(resto.slice(i, i + 2));

  return (
    <View style={{ marginTop: 8 }}>
      <View style={s.secHead}>
        <Text style={s.secTitle}>CONFIGURACION DEL SISTEMA</Text>
        <View style={s.secRule} />
      </View>

      {/* Sin match contra la configuracion se imprime lo que la OT declara, en
          el mismo recuadro: peor que no marcar nada seria marcar el equivocado. */}
      <View style={s.benchBox}>
        <View style={s.benchMarker}>
          {/* Sin glifos decorativos: el ▶ que tenia el diseño no existe en
              Inter y salia impreso como ¶. El peso lo hace el chip negro. */}
          <View style={s.benchChip}>
            <Text style={s.benchChipTxt}>{esBench ? 'EN BENCH' : 'ESTE MODULO'}</Text>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.benchRol}>
            {(bench?.nombre || 'MODULO INTERVENIDO').toUpperCase()}
          </Text>
          <Text style={s.benchDesc}>{bench ? texto(bench) : (moduloModelo || '—')}</Text>
          <View style={s.benchSerie}>
            <Text style={s.benchSn}>
              {bench?.serie ? `S/N ${bench.serie}` : moduloSerie ? `S/N ${moduloSerie}` : 'SIN N° DE SERIE'}
            </Text>
            {bench?.firmware ? <Text style={s.benchFw}>FW {bench.firmware}</Text> : null}
          </View>
        </View>
      </View>

      {filas.map((fila, i) => (
        <View key={i} style={s.modRow} wrap={false}>
          {fila.map(m => (
            <View key={m.id} style={s.modCell}>
              <Text style={s.modRol}>{(m.nombre || '—').toUpperCase()}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.modDesc}>{texto(m)}</Text>
                <Text style={s.modSerie}>{serieFw(m)}</Text>
              </View>
            </View>
          ))}
          {fila.length === 1 && <View style={{ flex: 1 }} />}
        </View>
      ))}

      {modulos.length === 0 && (
        <Text style={{ fontSize: 7.5, color: '#94A3B8', marginTop: 4 }}>
          El sistema no tiene modulos cargados en el catalogo.
        </Text>
      )}
    </View>
  );
}
