import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNavigation, type NavItem } from '../../components/layout/navigation';

interface Entrada {
  path: string;
  name: string;
  icon: string;
  grupo: string;
}

/**
 * Aplana el árbol de navegación (ya filtrado por permisos) a una lista de
 * destinos navegables. Los grupos sintéticos (`#comercial`) no son destino
 * pero sus hijos heredan el nombre del top-level como sección.
 */
function recolectar(node: NavItem, grupoRaiz: string | null): Entrada[] {
  const grupo = grupoRaiz ?? node.name;
  const out: Entrada[] = [];
  if (!node.path.startsWith('#')) {
    out.push({ path: node.path, name: node.name, icon: node.icon ?? '📄', grupo });
  }
  for (const child of node.children ?? []) out.push(...recolectar(child, grupo));
  return out;
}

/**
 * Pestaña nueva (2026-08-12): equivalente al "new tab" de un navegador. Se abre
 * desde el "+" de la barra de pestañas y muestra los módulos a los que el
 * usuario tiene acceso, para elegir a dónde ir sin pasar por el sidebar.
 */
export function NuevaPestanaPage() {
  const navigate = useNavigate();
  const nav = useNavigation();
  const [busqueda, setBusqueda] = useState('');

  const entradas = useMemo(() => nav.flatMap(n => recolectar(n, null)), [nav]);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return entradas;
    return entradas.filter(e =>
      e.name.toLowerCase().includes(q) || e.grupo.toLowerCase().includes(q));
  }, [entradas, busqueda]);

  // Secciones en el orden del sidebar (Map preserva el orden de inserción).
  const secciones = useMemo(() => {
    const map = new Map<string, Entrada[]>();
    for (const e of filtradas) {
      const arr = map.get(e.grupo);
      if (arr) arr.push(e); else map.set(e.grupo, [e]);
    }
    return [...map.entries()];
  }, [filtradas]);

  const irA = (path: string) => navigate(path);

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Nueva pestaña</h1>
        <p className="text-xs text-slate-500 mt-0.5">Elegí a dónde ir, o usá el menú de la izquierda.</p>

        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          onKeyDown={e => {
            // Enter con un único resultado = ir directo (comportamiento de barra
            // de direcciones: escribir y entrar sin tocar el mouse).
            if (e.key === 'Enter' && filtradas.length === 1) irA(filtradas[0].path);
          }}
          autoFocus
          placeholder="Buscar módulo…"
          className="mt-5 w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm bg-white
                     placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />

        {secciones.length === 0 ? (
          <p className="text-xs text-slate-400 mt-8 text-center">No hay módulos que coincidan con "{busqueda}".</p>
        ) : (
          <div className="mt-7 space-y-6">
            {secciones.map(([grupo, items]) => (
              <section key={grupo}>
                <h2 className="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-wide mb-2">
                  {grupo}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {items.map(e => (
                    <button
                      key={e.path}
                      onClick={() => irA(e.path)}
                      className="flex items-center gap-2.5 px-3 py-2.5 bg-white border border-slate-200 rounded-lg
                                 text-left hover:border-teal-500 hover:shadow-[0_1px_4px_rgba(0,0,0,0.06)] transition-all"
                    >
                      <span className="text-base leading-none shrink-0">{e.icon}</span>
                      <span className="text-xs text-slate-700 truncate" title={e.name}>{e.name}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
