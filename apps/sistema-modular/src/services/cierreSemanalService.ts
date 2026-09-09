import { collection, doc, getDoc, getDocs, orderBy, query, Timestamp } from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';
import type { CierreSemanal, CierreSemanalDatos, CierreSemanalResumen } from '@ags/shared';
import { db, storage, uploadBytes, createBatch, batchAudit, deepCleanForFirestore, getCreateTrace } from './firebase';

const COL = 'cierresSemanales';
const PATH = (semanaInicio: string) => `cierres-semanales/cierre-semanal-${semanaInicio}.pdf`;

function mapDoc(id: string, data: Record<string, unknown>): CierreSemanal {
  return {
    ...(data as unknown as CierreSemanal),
    id,
    generadoAt: (data.generadoAt as { toDate?: () => Date })?.toDate?.().toISOString() ?? String(data.generadoAt ?? ''),
  };
}

/**
 * Cierres semanales congelados (2026-09-09, pedido dirección): una foto por
 * semana —lunes a domingo—, con su PDF en Storage. El doc se identifica por
 * el lunes de la semana, así "existe o no" es una lectura directa.
 */
export const cierreSemanalService = {
  async getAll(): Promise<CierreSemanal[]> {
    const snap = await getDocs(query(collection(db, COL), orderBy('semanaInicio', 'desc')));
    return snap.docs.map(d => mapDoc(d.id, d.data()));
  },

  async getBySemana(semanaInicio: string): Promise<CierreSemanal | null> {
    const snap = await getDoc(doc(db, COL, semanaInicio));
    return snap.exists() ? mapDoc(snap.id, snap.data()) : null;
  },

  /** URL fresca del PDF (Storage rota el token si el archivo se sobrescribe). */
  async urlPdf(cierre: CierreSemanal): Promise<string> {
    return getDownloadURL(ref(storage, cierre.pdfPath));
  },

  /**
   * Guarda la foto y su PDF. `reemplazar=false` respeta un cierre existente
   * (es lo que usa la generación automática de los miércoles); el botón manual
   * pasa `true` para regenerar sobre el mismo doc.
   */
  async guardar(input: {
    semanaInicio: string;
    semanaFin: string;
    datos: CierreSemanalDatos;
    resumen: CierreSemanalResumen;
    pdf: Blob;
    actor?: { uid: string; nombre?: string | null } | null;
    reemplazar?: boolean;
  }): Promise<{ cierre: CierreSemanal; yaExistia: boolean }> {
    const previo = await this.getBySemana(input.semanaInicio);
    if (previo && !input.reemplazar) return { cierre: previo, yaExistia: true };
    const pdfPath = PATH(input.semanaInicio);
    await uploadBytes(ref(storage, pdfPath), input.pdf, { contentType: 'application/pdf' });
    const pdfUrl = await getDownloadURL(ref(storage, pdfPath));
    const payload = deepCleanForFirestore({
      semanaInicio: input.semanaInicio,
      semanaFin: input.semanaFin,
      generadoAt: Timestamp.now(),
      generadoPor: input.actor?.uid ?? null,
      generadoPorNombre: input.actor?.nombre ?? null,
      pdfPath,
      pdfUrl,
      resumen: input.resumen,
      datos: input.datos,
      ...getCreateTrace(),
    });
    const batch = createBatch();
    batch.set(doc(db, COL, input.semanaInicio), payload);
    batchAudit(batch, { action: previo ? 'update' : 'create', collection: COL, documentId: input.semanaInicio, after: payload });
    await batch.commit();
    const cierre = await this.getBySemana(input.semanaInicio);
    return { cierre: cierre!, yaExistia: false };
  },
};
