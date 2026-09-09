import { collection, getDocs, getFirestore, query, where } from 'firebase/firestore';
import './firebaseService'; // inicializa la app de Firebase

export interface ReservaStockOT {
  presupuestoNumero: string;
  cantidad: number;
  codigo: string | null;
  descripcion: string;
  nroSerie: string | null;
  nroLote: string | null;
}

/**
 * Unidades reservadas en stock para los presupuestos de la OT (2026-09-09).
 * El ingeniero tiene que saber qué le apartaron ANTES de ir al cliente; hasta
 * ahora ese dato vivía solo en el back-office. Solo lectura, best-effort.
 */
export async function getReservasStockParaPresupuestos(numeros: string[]): Promise<ReservaStockOT[]> {
  const nums = [...new Set(numeros.map(n => n.trim()).filter(Boolean))].slice(0, 10);
  if (nums.length === 0) return [];
  const db = getFirestore();
  const pres = await getDocs(query(collection(db, 'presupuestos'), where('numero', 'in', nums)));
  const out: ReservaStockOT[] = [];
  for (const p of pres.docs) {
    const uq = await getDocs(query(collection(db, 'unidades'),
      where('reservadoParaPresupuestoId', '==', p.id), where('estado', '==', 'reservado')));
    for (const u of uq.docs) {
      const d = u.data();
      out.push({
        presupuestoNumero: d.reservadoParaPresupuestoNumero ?? p.data().numero ?? '',
        cantidad: d.cantidad ?? 1,
        codigo: d.articuloCodigo ?? null,
        descripcion: d.articuloDescripcion ?? '',
        nroSerie: d.nroSerie ?? null,
        nroLote: d.nroLote ?? null,
      });
    }
  }
  return out;
}
