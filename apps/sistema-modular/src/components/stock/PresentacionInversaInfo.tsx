import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { articulosService } from '../../services/firebaseService';
import type { Articulo, Presentacion } from '@ags/shared';

/**
 * Vista INVERSA de presentaciones: cuando el artículo consultado ES una presentación de otro
 * (una base lo declara en sus `presentaciones`), muestra a qué base pertenece y su factor.
 * Así se ve la familia desde cualquier N° de parte sin declararla en todos (dato unidireccional).
 */
export const PresentacionInversaInfo: React.FC<{ articulo: Articulo }> = ({ articulo }) => {
  const [rel, setRel] = useState<{ base: Articulo; presentacion: Presentacion } | null>(null);

  useEffect(() => {
    let cancel = false;
    setRel(null);
    // Si el artículo ya es base (tiene presentaciones propias), no aplica la vista inversa.
    if ((articulo.presentaciones?.length ?? 0) > 0 || !articulo.codigo) return;
    articulosService.findBaseDePresentacion(articulo.codigo)
      .then(r => { if (!cancel && r && r.base.id !== articulo.id) setRel(r); })
      .catch(() => {});
    return () => { cancel = true; };
  }, [articulo.id, articulo.codigo, articulo.presentaciones?.length]);

  if (!rel) return null;
  const { base, presentacion } = rel;
  return (
    <>
      <hr className="border-[#E5E5E5]" />
      <p className="text-[9px] font-mono font-semibold text-teal-700/70 uppercase tracking-widest">
        Es presentación de
      </p>
      <div className="border border-indigo-200 bg-indigo-50/40 rounded-md px-3 py-2 text-xs text-slate-700">
        Este N° de parte es una presentación de{' '}
        <Link to={`/stock/articulos/${base.id}`} className="font-mono font-semibold text-teal-700 hover:underline">
          {base.codigo}
        </Link>{' '}
        <span className="text-slate-500">(unidad base)</span> · <span className="font-mono">×{presentacion.factor}</span>
        <span className="block text-[10px] text-slate-400 mt-0.5">
          1 × {articulo.codigo} = {presentacion.factor} unidades base. El stock vive en la base.
        </span>
      </div>
    </>
  );
};
