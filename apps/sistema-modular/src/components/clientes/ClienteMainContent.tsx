import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { Cliente, Sistema, CategoriaEquipo, Establecimiento, ModuloSistema } from '@ags/shared';
import { modulosService } from '../../services/firebaseService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface ClienteMainContentProps {
  clienteId: string;
  cliente: Cliente;
  sistemas: Sistema[];
  establecimientos: Establecimiento[];
  categorias: CategoriaEquipo[];
  editing: boolean;
  formData: any;
  setFormData: (data: any) => void;
}

const ChevronRight = () => (
  <svg className="w-4 h-4 text-slate-300 shrink-0 ml-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

const ChevronDown = ({ open }: { open: boolean }) => (
  <svg className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
  </svg>
);

const SistemaExpandable = ({ sistema, establecimientos, categorias }: {
  sistema: Sistema;
  establecimientos: Establecimiento[];
  categorias: CategoriaEquipo[];
}) => {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [modulos, setModulos] = useState<ModuloSistema[]>([]);
  const [loadingModulos, setLoadingModulos] = useState(false);

  const categoria = categorias.find(c => c.id === sistema.categoriaId);
  const est = sistema.establecimientoId
    ? establecimientos.find(e => e.id === sistema.establecimientoId)
    : null;

  useEffect(() => {
    if (!open || modulos.length > 0) return;
    setLoadingModulos(true);
    modulosService.getBySistema(sistema.id).then(m => {
      setModulos(m);
      setLoadingModulos(false);
    });
  }, [open, sistema.id]);

  return (
    <div className="bg-slate-50 rounded-lg border border-slate-100">
      <div className="flex items-center">
        <button
          onClick={() => setOpen(!open)}
          className="flex-1 flex justify-between items-center px-3 py-2 hover:bg-slate-100 transition-colors rounded-lg text-left"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium text-slate-900 truncate">{sistema.nombre}</p>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${sistema.activo ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                {sistema.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <div className="flex gap-2 text-[11px] text-slate-400 truncate">
              {est && <span>{est.nombre}</span>}
              {categoria && <span>· {categoria.nombre}</span>}
              {sistema.codigoInternoCliente && <span>· {sistema.codigoInternoCliente}</span>}
            </div>
          </div>
          <ChevronDown open={open} />
        </button>
        <Link
          to={`/equipos/${sistema.id}`}
          state={{ from: pathname }}
          className="shrink-0 px-2 py-2 text-[10px] font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded mr-1"
          title="Ver detalle del sistema"
        >
          Ver
        </Link>
      </div>

      {open && (
        <div className="px-3 pb-2.5">
          {loadingModulos ? (
            <p className="text-[11px] text-slate-400 py-2">Cargando módulos...</p>
          ) : modulos.length === 0 ? (
            <p className="text-[11px] text-slate-400 py-2">Sin módulos registrados</p>
          ) : (
            <table className="w-full mt-1">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left text-[10px] font-medium text-slate-400 py-1 pr-2">Código</th>
                  <th className="text-left text-[10px] font-medium text-slate-400 py-1 pr-2">Descripción</th>
                  <th className="text-left text-[10px] font-medium text-slate-400 py-1 pr-2">Serie</th>
                  <th className="text-left text-[10px] font-medium text-slate-400 py-1 pr-2">Firmware</th>
                  <th className="text-left text-[10px] font-medium text-slate-400 py-1">Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {modulos.map(m => (
                  <tr key={m.id} className="border-b border-slate-100 last:border-0">
                    <td className="text-[11px] font-mono text-slate-700 py-1.5 pr-2 whitespace-nowrap">{m.nombre || '—'}</td>
                    <td className="text-[11px] text-slate-600 py-1.5 pr-2 truncate max-w-[180px]" title={m.descripcion}>{m.descripcion || '—'}</td>
                    <td className="text-[11px] font-mono text-slate-600 py-1.5 pr-2 whitespace-nowrap">{m.serie || '—'}</td>
                    <td className="text-[11px] text-slate-600 py-1.5 pr-2 whitespace-nowrap">{m.firmware || '—'}</td>
                    <td className="text-[11px] text-slate-500 py-1.5 truncate max-w-[150px]" title={m.observaciones}>{m.observaciones || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export const ClienteMainContent = ({
  clienteId, cliente, sistemas, establecimientos, categorias, editing, formData, setFormData,
}: ClienteMainContentProps) => {
  const { pathname } = useLocation();
  // Deduplicar sistemas por ID (pueden venir duplicados por consultas legacy)
  const uniqueSistemas = sistemas.filter((s, i, arr) => arr.findIndex(x => x.id === s.id) === i);

  return (
    <div className="flex-1 min-w-0 space-y-4">
      {/* Establecimientos */}
      <Card compact>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase">Establecimientos</h3>
          <div className="flex gap-2">
            <Link to={`/establecimientos/nuevo?cliente=${clienteId}`} state={{ from: pathname }}>
              <Button variant="outline" size="sm">+ Agregar</Button>
            </Link>
            <Link to={`/establecimientos?cliente=${clienteId}`}>
              <Button variant="ghost" size="sm">Ver todos</Button>
            </Link>
          </div>
        </div>
        {establecimientos.length > 0 ? (
          <div className="space-y-1.5">
            {establecimientos.map((est) => (
              <Link
                key={est.id}
                to={`/establecimientos/${est.id}`}
                state={{ from: pathname }}
                className="flex justify-between items-center px-3 py-2 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-900 truncate">{est.nombre}</p>
                  <p className="text-[11px] text-slate-400 truncate">{est.direccion}, {est.localidad}</p>
                </div>
                <ChevronRight />
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-slate-400 text-xs mb-2">Sin establecimientos</p>
            <Link to={`/establecimientos/nuevo?cliente=${clienteId}`} state={{ from: pathname }}>
              <Button variant="outline" size="sm">+ Agregar</Button>
            </Link>
          </div>
        )}
      </Card>

      {/* Sistemas / Equipos — expandibles con módulos */}
      <Card compact>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase">Sistemas / Equipos</h3>
          <div className="flex gap-2">
            <Link to={`/equipos/nuevo?cliente=${clienteId}`} state={{ from: pathname }}>
              <Button variant="outline" size="sm">+ Agregar</Button>
            </Link>
            <Link to={`/equipos?cliente=${clienteId}`}>
              <Button variant="ghost" size="sm">Ver todos</Button>
            </Link>
          </div>
        </div>
        {uniqueSistemas.length > 0 ? (
          <div className="space-y-1.5">
            {uniqueSistemas.map((sistema) => (
              <SistemaExpandable
                key={sistema.id}
                sistema={sistema}
                establecimientos={establecimientos}
                categorias={categorias}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-slate-400 text-xs mb-2">Sin sistemas registrados</p>
            <Link to={`/equipos/nuevo?cliente=${clienteId}`} state={{ from: pathname }}>
              <Button variant="outline" size="sm">+ Agregar</Button>
            </Link>
          </div>
        )}
      </Card>

      {/* Notas */}
      <Card compact>
        <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3">Notas</h3>
        {editing ? (
          <textarea
            value={formData?.notas || ''}
            onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
            rows={3}
            className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
            placeholder="Notas internas sobre este cliente..."
          />
        ) : (
          <p className="text-xs text-slate-600 whitespace-pre-wrap">
            {cliente.notas || 'Sin notas'}
          </p>
        )}
      </Card>
    </div>
  );
};
