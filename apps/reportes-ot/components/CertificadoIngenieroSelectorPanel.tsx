import React, { useState, useEffect } from 'react';
import { FirebaseService } from '../services/firebaseService';
import type { CertificadoIngeniero } from '../types/instrumentos';

interface Props {
  firebase: FirebaseService;
  ingenieroId: string | null;
  ingenieroNombre: string;
  selected: CertificadoIngeniero[];
  onApply: (selected: CertificadoIngeniero[]) => void;
  readOnly?: boolean;
}

export const CertificadoIngenieroSelectorPanel: React.FC<Props> = ({
  firebase,
  ingenieroId,
  ingenieroNombre,
  selected,
  onApply,
  readOnly = false,
}) => {
  const [available, setAvailable] = useState<CertificadoIngeniero[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ingenieroId) { setAvailable([]); return; }
    setLoading(true);
    firebase.getCertificadosIngeniero(ingenieroId)
      .then(setAvailable)
      .catch(() => setAvailable([]))
      .finally(() => setLoading(false));
  }, [ingenieroId, firebase]);

  if (!ingenieroId) {
    return <p className="text-xs text-slate-400 italic py-2">Seleccione un ingeniero para ver certificados disponibles.</p>;
  }

  if (loading) {
    return <p className="text-xs text-slate-400 py-2">Cargando certificados...</p>;
  }

  if (available.length === 0) {
    return <p className="text-xs text-slate-400 italic py-2">No hay certificados registrados para {ingenieroNombre}.</p>;
  }

  const selectedIds = new Set(selected.map(c => c.id));

  const toggle = (cert: CertificadoIngeniero) => {
    if (readOnly) return;
    if (selectedIds.has(cert.id)) {
      onApply(selected.filter(c => c.id !== cert.id));
    } else {
      onApply([...selected, cert]);
    }
  };

  return (
    <div className="space-y-1 mt-1">
      {available.map(cert => (
        <label
          key={cert.id}
          className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-slate-50 transition-colors ${readOnly ? 'opacity-60 cursor-default' : ''}`}
        >
          <input
            type="checkbox"
            checked={selectedIds.has(cert.id)}
            disabled={readOnly}
            onChange={() => toggle(cert)}
            className="w-3.5 h-3.5 accent-teal-600"
          />
          <div className="min-w-0 flex-1">
            <span className="text-xs text-slate-700">{cert.descripcion}</span>
            {cert.fechaVencimiento && (
              <span className="text-[10px] text-slate-400 ml-2">
                Vence: {new Date(cert.fechaVencimiento).toLocaleDateString('es-AR')}
              </span>
            )}
          </div>
        </label>
      ))}
    </div>
  );
};
