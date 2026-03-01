import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useInstrumentos } from '../../hooks/useInstrumentos';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { CreateInstrumentoModal } from '../../components/instrumentos/CreateInstrumentoModal';
import {
  CATEGORIA_INSTRUMENTO_LABELS,
  CATEGORIA_PATRON_LABELS,
  calcularEstadoCertificado,
  type CategoriaInstrumento,
  type CategoriaPatron,
  type EstadoCertificado,
  type InstrumentoPatron,
} from '@ags/shared';

const ESTADO_BADGE: Record<EstadoCertificado, { label: string; cls: string }> = {
  vigente: { label: 'Vigente', cls: 'bg-green-100 text-green-800' },
  por_vencer: { label: 'Por vencer', cls: 'bg-amber-100 text-amber-800' },
  vencido: { label: 'Vencido', cls: 'bg-red-100 text-red-800' },
  sin_certificado: { label: 'Sin cert.', cls: 'bg-slate-100 text-slate-500' },
};

const ALL_CAT_LABELS: Record<string, string> = { ...CATEGORIA_INSTRUMENTO_LABELS, ...CATEGORIA_PATRON_LABELS };
const CATS_INSTRUMENTO = Object.entries(CATEGORIA_INSTRUMENTO_LABELS) as [CategoriaInstrumento, string][];
const CATS_PATRON = Object.entries(CATEGORIA_PATRON_LABELS) as [CategoriaPatron, string][];

export const InstrumentosListPage = () => {
  const { instrumentos, loading, error, listInstrumentos, deactivateInstrumento } = useInstrumentos();
  const [filterTipo, setFilterTipo] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const reload = () => {
    listInstrumentos({
      tipo: (filterTipo as 'instrumento' | 'patron') || undefined,
      categoria: (filterCategoria as CategoriaInstrumento | CategoriaPatron) || undefined,
      activoOnly: !showInactive,
    });
  };

  useEffect(() => { reload(); }, [filterTipo, filterCategoria, showInactive]);

  const filtered = filterEstado
    ? instrumentos.filter(i => calcularEstadoCertificado(i.certificadoVencimiento) === filterEstado)
    : instrumentos;

  const vencidos = instrumentos.filter(i => calcularEstadoCertificado(i.certificadoVencimiento) === 'vencido');
  const porVencer = instrumentos.filter(i => calcularEstadoCertificado(i.certificadoVencimiento) === 'por_vencer');

  const handleDeactivate = async (inst: InstrumentoPatron) => {
    if (!confirm(`¿Desactivar "${inst.nombre}"?`)) return;
    try {
      await deactivateInstrumento(inst.id);
      reload();
    } catch {
      alert('Error al desactivar el instrumento');
    }
  };

  return (
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col bg-slate-50">
      <PageHeader
        title="Instrumentos y Patrones"
        subtitle="Gestionar instrumentos, patrones y sus certificados de calibración"
        count={filtered.length}
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)}>+ Nuevo instrumento</Button>
        }
      >
        <div className="space-y-2">
          {(vencidos.length > 0 || porVencer.length > 0) && (
            <div className="flex gap-2 flex-wrap">
              {vencidos.length > 0 && (
                <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded px-2 py-1">
                  <span className="text-red-700 text-[11px] font-medium">
                    {vencidos.length} cert. vencido(s)
                  </span>
                </div>
              )}
              {porVencer.length > 0 && (
                <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                  <span className="text-amber-700 text-[11px] font-medium">
                    {porVencer.length} cert. por vencer (30d)
                  </span>
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <select value={filterTipo} onChange={e => { setFilterTipo(e.target.value); setFilterCategoria(''); }}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700">
              <option value="">Tipo: Todos</option>
              <option value="instrumento">Instrumento</option>
              <option value="patron">Patrón</option>
            </select>
            <select value={filterCategoria} onChange={e => setFilterCategoria(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700">
              <option value="">Categoría: Todas</option>
              {(filterTipo === 'patron' ? CATS_PATRON : filterTipo === 'instrumento' ? CATS_INSTRUMENTO : [...CATS_INSTRUMENTO, ...CATS_PATRON]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700">
              <option value="">Estado cert.: Todos</option>
              <option value="vigente">Vigente</option>
              <option value="por_vencer">Por vencer</option>
              <option value="vencido">Vencido</option>
              <option value="sin_certificado">Sin certificado</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
              <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)}
                className="w-3.5 h-3.5 accent-indigo-600" />
              Inactivos
            </label>
            <Button variant="ghost" size="sm"
              onClick={() => { setFilterTipo(''); setFilterCategoria(''); setFilterEstado(''); setShowInactive(false); }}>
              Limpiar
            </Button>
          </div>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-12"><p className="text-slate-400">Cargando...</p></div>
        ) : error ? (
          <Card><p className="text-red-600 text-sm">{error}</p></Card>
        ) : filtered.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-400">No hay instrumentos que coincidan con los filtros.</p>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Identificación', 'Tipo', 'Marca / Modelo', 'Serie', 'Categorías', 'Certificado', 'Vencimiento', 'Estado', 'Acciones'].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(inst => {
                    const estado = calcularEstadoCertificado(inst.certificadoVencimiento);
                    const badge = ESTADO_BADGE[estado];
                    return (
                      <tr key={inst.id} className={`hover:bg-slate-50 ${!inst.activo ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-2 text-xs font-medium text-slate-900">{inst.nombre}</td>
                        <td className="px-4 py-2 text-xs text-slate-600 capitalize">{inst.tipo}</td>
                        <td className="px-4 py-2 text-xs text-slate-600">
                          {[inst.marca, inst.modelo].filter(Boolean).join(' / ') || '—'}
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-600 font-mono">{inst.serie || '—'}</td>
                        <td className="px-4 py-2">
                          <div className="flex gap-1 flex-wrap">
                            {inst.categorias.map(c => (
                              <span key={c} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium">
                                {ALL_CAT_LABELS[c] || c}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-xs">
                          {inst.certificadoUrl ? (
                            <a href={inst.certificadoUrl} target="_blank" rel="noopener noreferrer"
                              className="text-blue-600 hover:underline font-medium">
                              {inst.certificadoNombre || 'Ver PDF'}
                            </a>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-600">{inst.certificadoVencimiento || '—'}</td>
                        <td className="px-4 py-2">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex gap-3">
                            <Link to={`/instrumentos/${inst.id}/editar`}>
                              <button className="text-blue-600 hover:underline font-medium text-xs">Editar</button>
                            </Link>
                            {inst.activo && (
                              <button onClick={() => handleDeactivate(inst)}
                                className="text-red-600 hover:underline font-medium text-xs">Desactivar</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <CreateInstrumentoModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={reload} />
    </div>
  );
};
