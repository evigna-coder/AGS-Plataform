import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Part } from '../types';
import { FirebaseService } from '../services/firebaseService';

interface ArticuloCatalog {
  id: string;
  codigo: string;
  descripcion: string;
}

interface ServiceReportSectionProps {
  readOnly: boolean;
  tipoServicio: string;
  onTipoServicioChange: (value: string) => void;
  reporteTecnico: string;
  setReporteTecnico: (v: string) => void;
  loadingAI: boolean;
  onOptimizeReport: () => void;
  articulos: Part[];
  onAddPart: () => void;
  onUpdatePart: (id: string, field: keyof Part, value: any) => void;
  onRemovePart: (id: string) => void;
}

/* ── Autocomplete para código de artículo ── */
const ArticuloAutocomplete: React.FC<{
  value: string;
  readOnly: boolean;
  catalog: ArticuloCatalog[];
  onSelect: (art: ArticuloCatalog) => void;
  onChange: (val: string) => void;
}> = ({ value, readOnly, catalog, onSelect, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Sync external value
  useEffect(() => { setSearch(value); }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = search.length >= 2
    ? catalog.filter(a =>
        a.codigo.toLowerCase().includes(search.toLowerCase()) ||
        a.descripcion.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 10)
    : [];

  const selectItem = (art: ArticuloCatalog) => {
    onSelect(art);
    setSearch(art.codigo);
    setOpen(false);
    setHighlightIdx(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = highlightIdx < filtered.length - 1 ? highlightIdx + 1 : 0;
      setHighlightIdx(next);
      listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = highlightIdx > 0 ? highlightIdx - 1 : filtered.length - 1;
      setHighlightIdx(next);
      listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && highlightIdx >= 0) {
      e.preventDefault();
      selectItem(filtered[highlightIdx]);
    } else if (e.key === 'Tab' && highlightIdx >= 0) {
      e.preventDefault();
      selectItem(filtered[highlightIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setHighlightIdx(-1);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        value={search}
        disabled={readOnly}
        onChange={e => {
          setSearch(e.target.value);
          onChange(e.target.value);
          setOpen(e.target.value.length >= 2);
          setHighlightIdx(-1);
        }}
        onFocus={() => { if (search.length >= 2 && filtered.length > 0) setOpen(true); }}
        onKeyDown={handleKeyDown}
        placeholder="Código..."
        className={`w-full outline-none text-xs ${readOnly ? 'bg-transparent text-slate-400 cursor-not-allowed' : ''}`}
      />
      {open && filtered.length > 0 && (
        <div ref={listRef} className="absolute z-[9999] left-0 bottom-full mb-1 min-w-[380px] bg-white border border-slate-300 rounded-md shadow-xl max-h-[280px] overflow-y-auto">
          {filtered.map((a, i) => (
            <button
              key={a.id}
              type="button"
              className={`w-full text-left px-3 py-1.5 text-[11px] border-b border-slate-100 last:border-0 flex gap-3 items-baseline
                ${i === highlightIdx ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
              onMouseEnter={() => setHighlightIdx(i)}
              onClick={() => selectItem(a)}
            >
              <span className="font-bold text-slate-800 whitespace-nowrap shrink-0">{a.codigo}</span>
              <span className="text-slate-500">{a.descripcion}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const ServiceReportSection: React.FC<ServiceReportSectionProps> = ({
  readOnly, tipoServicio, onTipoServicioChange,
  reporteTecnico, setReporteTecnico, loadingAI, onOptimizeReport,
  articulos, onAddPart, onUpdatePart, onRemovePart,
}) => {
  const [catalog, setCatalog] = useState<ArticuloCatalog[]>([]);

  // Load catalog once
  useEffect(() => {
    const svc = new FirebaseService();
    svc.getArticulos().then(setCatalog);
  }, []);

  const handleSelectArticulo = useCallback((partId: string, art: ArticuloCatalog) => {
    onUpdatePart(partId, { codigo: art.codigo, descripcion: art.descripcion, stockArticuloId: art.id } as any);
  }, [onUpdatePart]);

  return (
    <div className="space-y-6">
      <section className="no-print">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
          Tipo de Servicio
        </label>

        <select
          value={tipoServicio}
          onChange={e => {
            if (readOnly) return;
            onTipoServicioChange(e.target.value);
          }}
          disabled={readOnly}
          className={`w-full border rounded-xl px-4 py-2.5 text-sm bg-white outline-none
            ${
              readOnly
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
                : 'border-slate-200 focus:ring-1 focus:ring-blue-500'
            }
          `}
        >
          <option>Calibración</option>
          <option>Calificación de instalación</option>
          <option>Calificación de operación</option>
          <option>Calificación de software</option>
          <option>Capacitación</option>
          <option>Cortesía</option>
          <option>Desinstalación</option>
          <option>Instalación</option>
          <option>Limpieza de fuente de Iones</option>
          <option>Mantenimiento preventivo con consumibles</option>
          <option>Mantenimiento preventivo sin consumibles</option>
          <option>Mantenimiento preventivo sin consumibles, incluye limpieza de módulos</option>
          <option>Otros</option>
          <option>Recalificación post reparación</option>
          <option>Reparación en bench</option>
          <option>Trabajo en bench</option>
          <option>Visita de diagnóstico / reparación</option>
        </select>
      </section>

      <section>
        <div className="flex justify-between items-end mb-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Informe Técnico
          </label>

          <button
            onClick={() => {
              if (readOnly) return;
              onOptimizeReport();
            }}
            disabled={loadingAI || readOnly}
            className={`no-print text-[9px] font-black uppercase
              ${
                readOnly
                  ? 'text-slate-400 cursor-not-allowed'
                  : 'text-blue-600 hover:underline'
              }
            `}
          >
            {loadingAI ? 'Optimizando...' : 'IA Optimizar'}
          </button>
        </div>

        <textarea
          value={reporteTecnico}
          onChange={e => setReporteTecnico(e.target.value)}
          rows={6}
          disabled={readOnly}
          placeholder="Describa detalladamente el servicio técnico realizado..."
          className={`w-full border rounded-xl px-4 py-3 text-sm outline-none
            ${
              readOnly
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
                : 'bg-white border-slate-200 focus:ring-1 focus:ring-blue-500'
            }
          `}
        />
      </section>

      <section>
        <div className="flex justify-between items-center mb-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Materiales / Repuestos
          </label>

          <button
            onClick={() => {
              if (readOnly) return;
              onAddPart();
            }}
            disabled={readOnly}
            className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest appearance-none
              ${
                readOnly
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  : 'bg-white text-slate-700 border border-slate-300'
              }
            `}
          >
            + Item
          </button>
        </div>

        <div
          className={`border rounded-xl overflow-visible shadow-sm
            ${
              readOnly
                ? 'border-slate-200 bg-slate-50'
                : 'border-slate-100'
            }
          `}
        >
          <table className="w-full text-xs">
            <thead className="bg-slate-50 font-black text-slate-400 uppercase text-[9px]">
              <tr>
                <th className="px-4 py-2 text-left w-32">Código</th>
                <th className="px-4 py-2 text-left">Descripción</th>
                <th className="px-4 py-2 text-center w-20">Cant.</th>
                <th className="px-4 py-2 text-left w-28">Origen</th>
                <th className="w-10"></th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {articulos.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-1.5">
                    {readOnly ? (
                      <span className="text-xs text-slate-400">{p.codigo}</span>
                    ) : (
                      <ArticuloAutocomplete
                        value={p.codigo}
                        readOnly={readOnly}
                        catalog={catalog}
                        onSelect={(art) => handleSelectArticulo(p.id, art)}
                        onChange={(val) => {
                          onUpdatePart(p.id, 'codigo', val);
                          // Clear stockArticuloId if typing manually
                          if (p.stockArticuloId) {
                            onUpdatePart(p.id, 'stockArticuloId', null);
                          }
                        }}
                      />
                    )}
                  </td>

                  <td className="px-4 py-1.5">
                    <input
                      value={p.descripcion}
                      maxLength={120}
                      disabled={readOnly}
                      onChange={e => onUpdatePart(p.id, 'descripcion', e.target.value)}
                      className={`w-full outline-none
                        ${readOnly ? 'bg-transparent text-slate-400 cursor-not-allowed' : ''}
                      `}
                    />
                  </td>

                  <td className="px-4 py-1.5">
                    <input
                      type="number"
                      min="0"
                      value={p.cantidad}
                      maxLength={5}
                      disabled={readOnly}
                      onChange={e => onUpdatePart(p.id, 'cantidad', Number(e.target.value) || 0)}
                      className={`w-full outline-none text-center
                        ${readOnly ? 'bg-transparent text-slate-400 cursor-not-allowed' : ''}
                      `}
                    />
                  </td>

                  <td className="px-4 py-1.5">
                    <input
                      value={p.origen}
                      maxLength={12}
                      disabled={readOnly}
                      onChange={e => onUpdatePart(p.id, 'origen', e.target.value)}
                      className={`w-full outline-none
                        ${readOnly ? 'bg-transparent text-slate-400 cursor-not-allowed' : ''}
                      `}
                    />
                  </td>

                  <td className="text-center">
                    <button
                      onClick={() => {
                        if (readOnly) return;
                        onRemovePart(p.id);
                      }}
                      disabled={readOnly}
                      className={`font-bold transition-colors
                        ${
                          readOnly
                            ? 'text-slate-300 cursor-not-allowed'
                            : 'text-red-400 hover:text-red-600'
                        }
                      `}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
