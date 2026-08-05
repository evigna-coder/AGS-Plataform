import { useState } from 'react';

/**
 * Comentario editable inline del control semanal (2026-08-05): guarda al salir
 * del campo (blur) o con Enter. Usado por la sección 2 (comentario de soporte
 * por presupuesto) y la 3 (comentario de administración por solicitud).
 */
export function ComentarioInline({ id, valor, placeholder, onSave }: {
  id: string;
  valor: string;
  placeholder: string;
  onSave: (id: string, comentario: string) => Promise<void>;
}) {
  const [texto, setTexto] = useState(valor);
  const [guardando, setGuardando] = useState(false);
  const guardar = async () => {
    if (texto === valor) return;
    setGuardando(true);
    try { await onSave(id, texto); }
    finally { setGuardando(false); }
  };
  return (
    <input
      value={texto}
      onChange={e => setTexto(e.target.value)}
      onBlur={() => void guardar()}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      placeholder={placeholder}
      disabled={guardando}
      className="w-full border border-slate-200 rounded px-1.5 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-teal-400 disabled:opacity-50 bg-white"
    />
  );
}
