import { View, Text, Image } from '@react-pdf/renderer';
import type { PresupuestoItem, PresupuestoSubItem } from '@ags/shared';
import { COLORS } from '../pdfStyles';

interface BloqueDetalle {
  numero: string;   // "1.3"
  sub: PresupuestoSubItem;
}

/** Junta los sub-ítems con detalle largo o fotos, en orden de aparición. */
export function collectBloquesDetalle(items: PresupuestoItem[]): BloqueDetalle[] {
  const out: BloqueDetalle[] = [];
  items.forEach((item, i) => {
    (item.subItems || []).forEach((sub, j) => {
      if (sub.detalleLargo || (sub.fotos && sub.fotos.length > 0)) {
        out.push({ numero: `${i + 1}.${j + 1}`, sub });
      }
    });
  });
  return out;
}

/** Texto multilínea respetando saltos de línea (un <Text> por línea). */
function MultilineText({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <Text key={i} style={{ fontSize: 7.5, color: COLORS.text, lineHeight: 1.5 }}>
          {line || ' '}
        </Text>
      ))}
    </>
  );
}

function BloqueConfig({ bloque, fotosDataUrls }: { bloque: BloqueDetalle; fotosDataUrls: Record<string, string> }) {
  const { numero, sub } = bloque;
  const fotos = (sub.fotos || []).map(url => fotosDataUrls[url]).filter(Boolean);
  return (
    <View style={{ flexDirection: 'row', marginBottom: 12, borderWidth: 0.5, borderColor: COLORS.border, borderRadius: 4 }}>
      {/* Columna izquierda: Item | Producto + fotos */}
      <View style={{ width: 130, padding: 8, backgroundColor: COLORS.cardBg, borderTopLeftRadius: 4, borderBottomLeftRadius: 4 }}>
        <Text style={{ fontSize: 6.5, fontWeight: 'bold', color: COLORS.textMuted, letterSpacing: 0.5, marginBottom: 2 }}>ITEM {numero}</Text>
        <Text style={{ fontSize: 9, fontWeight: 'bold', color: COLORS.primary, marginBottom: 2 }}>{sub.codigo || '—'}</Text>
        {sub.descripcion ? (
          <Text style={{ fontSize: 7, color: COLORS.textMuted, marginBottom: 4 }}>{sub.descripcion}</Text>
        ) : null}
        {fotos.map((dataUrl, i) => (
          <Image key={i} src={dataUrl} style={{ width: 110, marginTop: 6, borderRadius: 2 }} />
        ))}
      </View>
      {/* Columna derecha: detalle largo multilínea */}
      <View style={{ flex: 1, padding: 8 }}>
        {sub.detalleLargo ? <MultilineText text={sub.detalleLargo} /> : null}
      </View>
    </View>
  );
}

/**
 * Sección "Detalles de Configuración" del PDF de Equipos (páginas 2+): un
 * bloque por sub-ítem con detalle largo — [Item | Producto + foto] a la
 * izquierda, texto de configuración a la derecha (modelo JAS170-C).
 */
export function PDFEquiposConfigDetalles({ items, fotosDataUrls }: {
  items: PresupuestoItem[];
  fotosDataUrls: Record<string, string>;
}) {
  const bloques = collectBloquesDetalle(items);
  if (bloques.length === 0) return null;
  return (
    <View>
      <Text style={{ fontSize: 11, fontWeight: 'bold', color: COLORS.primary, marginBottom: 8, letterSpacing: 0.3 }}>
        Detalles de Configuración
      </Text>
      {bloques.map(b => (
        <BloqueConfig key={b.sub.id} bloque={b} fotosDataUrls={fotosDataUrls} />
      ))}
    </View>
  );
}
