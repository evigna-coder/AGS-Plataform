import React from 'react';
import type { ProtocolSelection, ChecklistItem, ChecklistItemAnswer } from '../types/tableCatalog';

interface Props {
  selection: ProtocolSelection;
  readOnly?: boolean;
  isPrint?: boolean;
  onChangeData: (tableId: string, itemId: string, answer: ChecklistItemAnswer) => void;
  onChangeObservaciones?: (tableId: string, value: string) => void;
  onChangeResultado?: (tableId: string, value: ProtocolSelection['resultado']) => void;
  onToggleSection?: (tableId: string, itemId: string, isNA: boolean) => void;
  onRemove?: (tableId: string) => void;
  onDuplicateSection?: (sectionItemId: string) => void;
  onRemoveSection?: (sectionItemId: string) => void;
  /** Datos de la OT para inyectar en ítems con showDate / showSignatures */
  signatureClient?: string | null;
  signatureEngineer?: string | null;
  aclaracionCliente?: string;
  aclaracionEspecialista?: string;
  fechaInicio?: string;
  fechaFin?: string;
}

const RESULTADO_COLORS = {
  CONFORME: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  NO_CONFORME: 'bg-red-100 text-red-800 border-red-300',
  PENDIENTE: 'bg-amber-100 text-amber-800 border-amber-300',
};

const RESULTADO_LABELS = {
  CONFORME: 'Conforme',
  NO_CONFORME: 'No Conforme',
  PENDIENTE: 'Pendiente',
};

// ─── Helper: detectar si un ítem está dentro de una sección N/A ───────────────
function buildNASet(items: ChecklistItem[], collapsedSections: string[]): Set<string> {
  const collapsed = new Set(collapsedSections);
  const naItems = new Set<string>();
  let naUntilDepth: number | null = null;

  for (const item of items) {
    // Si encontramos una sección al mismo nivel o superior, resetear el bloque NA
    if (naUntilDepth !== null && item.depth <= naUntilDepth) {
      naUntilDepth = null;
    }
    if (collapsed.has(item.itemId)) {
      naUntilDepth = item.depth;
      naItems.add(item.itemId);
    } else if (naUntilDepth !== null && item.depth > naUntilDepth) {
      naItems.add(item.itemId);
    }
  }
  return naItems;
}

// ─── Renderizado de un ítem ───────────────────────────────────────────────────
function ChecklistItemRow({
  item,
  answer,
  isNA,
  readOnly,
  isPrint,
  onAnswer,
  onCheckAll,
  allCheckedForSection,
  onDuplicateSection,
  onRemoveSection,
  signatureClient,
  signatureEngineer,
  aclaracionCliente,
  aclaracionEspecialista,
  fechaInicio,
  fechaFin,
}: {
  item: ChecklistItem;
  answer: ChecklistItemAnswer | undefined;
  isNA: boolean;
  readOnly: boolean;
  isPrint: boolean;
  onAnswer: (a: ChecklistItemAnswer) => void;
  onCheckAll?: (sectionItemId: string, check: boolean) => void;
  allCheckedForSection?: (sectionItemId: string) => boolean;
  onDuplicateSection?: (sectionItemId: string) => void;
  onRemoveSection?: (sectionItemId: string) => void;
  signatureClient?: string | null;
  signatureEngineer?: string | null;
  aclaracionCliente?: string;
  aclaracionEspecialista?: string;
  fechaInicio?: string;
  fechaFin?: string;
}) {
  const indent = item.depth * 16;
  const disabled = readOnly || isNA;

  // ── embedded_table ──────────────────────────────────────────────────────────
  if (item.itemType === 'embedded_table') {
    const cols = item.embeddedColumns ?? [];
    const rows = item.embeddedRows ?? [];
    if (cols.length === 0) return null;
    const answerCells = (answer as { itemType: 'embedded_table'; cells: Record<string, string>[] } | undefined)?.cells ?? [];

    const getCellValue = (ri: number, colKey: string) => {
      if (answerCells[ri]?.[colKey] !== undefined && answerCells[ri][colKey] !== '') return answerCells[ri][colKey];
      return rows[ri]?.[colKey] ?? '';
    };

    const updateTableCell = (ri: number, colKey: string, value: string) => {
      const newCells = [...answerCells];
      while (newCells.length <= ri) newCells.push({});
      newCells[ri] = { ...newCells[ri], [colKey]: value };
      onAnswer({ itemType: 'embedded_table', cells: newCells });
    };

    // Calcular grupos para header agrupado (2 filas de thead)
    const hasGroups = cols.some(c => c.group);
    type HeaderGroup = { type: 'group'; name: string; span: number } | { type: 'solo'; colIdx: number };
    const groupRow: HeaderGroup[] = [];
    if (hasGroups) {
      let i = 0;
      while (i < cols.length) {
        const col = cols[i];
        if (col.group) {
          let span = 1;
          while (i + span < cols.length && cols[i + span].group === col.group) span++;
          groupRow.push({ type: 'group', name: col.group, span });
          i += span;
        } else {
          groupRow.push({ type: 'solo', colIdx: i });
          i++;
        }
      }
    }

    const thBase = `px-3 py-2 font-bold text-center border ${isPrint ? 'border-slate-400 bg-slate-100 text-slate-800' : 'border-slate-300 bg-slate-50 text-slate-700'}`;
    const tdBase = `px-3 py-3 text-center border ${isPrint ? 'border-slate-400 text-slate-700' : 'border-slate-300 text-slate-700'}`;
    const tdRowHeader = `px-3 py-3 text-left font-semibold border ${isPrint ? 'border-slate-400 bg-slate-50 text-slate-800' : 'border-slate-300 bg-slate-50/50 text-slate-800'}`;

    return (
      <div className={`py-2.5 ${isPrint ? '' : 'px-3'}`} style={{ paddingLeft: `${indent + 8}px` }}>
        {item.label && (item.showLabel !== false) && (
          <p className={`text-xs font-semibold mb-2 ${isNA ? 'line-through text-slate-400' : 'text-slate-800'}`}>
            {item.numberPrefix && <span className="font-mono text-slate-400 mr-1.5">{item.numberPrefix}</span>}
            {item.label}
          </p>
        )}
        <table className={`w-full text-xs border-collapse ${isNA ? 'opacity-40' : ''}`}>
          <thead>
            {hasGroups ? (
              <>
                {/* Fila 1: grupos + columnas sin grupo (con rowSpan=2) */}
                <tr>
                  {groupRow.map((g, gi) =>
                    g.type === 'group'
                      ? <th key={`g-${gi}`} colSpan={g.span} className={thBase}>{g.name}</th>
                      : <th key={`g-${gi}`} rowSpan={2} className={thBase}>{cols[g.colIdx].label}</th>
                  )}
                </tr>
                {/* Fila 2: sub-columnas de cada grupo */}
                <tr>
                  {cols.filter(c => c.group).map(col => (
                    <th key={col.key} className={thBase}>{col.label}</th>
                  ))}
                </tr>
              </>
            ) : (
              <tr>
                {cols.map(col => (
                  <th key={col.key} className={thBase}>{col.label}</th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {cols.map(col => {
                  const cellVal = getCellValue(ri, col.key);
                  const hasOptions = col.options && col.options.length > 0;

                  // Row header: siempre texto bold a la izquierda
                  if (col.isRowHeader) {
                    return <td key={col.key} className={tdRowHeader}>{cellVal || '\u00A0'}</td>;
                  }

                  // Radio buttons
                  if (hasOptions && col.displayAs === 'radio') {
                    return (
                      <td key={col.key} className={`px-2 py-2 border ${isPrint ? 'border-slate-400' : 'border-slate-300'}`}>
                        <div className="flex items-center justify-center gap-3 flex-wrap">
                          {col.options!.map(opt => (
                            <label key={opt} className={`flex items-center gap-1 text-xs cursor-pointer whitespace-nowrap ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
                              <input
                                type="radio"
                                name={`radio-${col.key}-${ri}`}
                                checked={cellVal === opt}
                                disabled={disabled}
                                onChange={() => updateTableCell(ri, col.key, opt)}
                                className="accent-teal-600"
                              />
                              <span className={`${cellVal === opt ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>{opt}</span>
                            </label>
                          ))}
                        </div>
                      </td>
                    );
                  }

                  // Selector (dropdown)
                  if (hasOptions) {
                    if (isPrint || readOnly) {
                      return <td key={col.key} className={tdBase}>{cellVal || '\u00A0'}</td>;
                    }
                    return (
                      <td key={col.key} className="px-1 py-1 text-center border border-slate-300">
                        <select
                          className="w-full text-xs bg-white border border-slate-200 rounded px-2 py-1.5 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:cursor-not-allowed"
                          value={cellVal}
                          disabled={disabled}
                          onChange={e => updateTableCell(ri, col.key, e.target.value)}
                        >
                          <option value="">Seleccionar...</option>
                          {col.options!.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      </td>
                    );
                  }

                  // Texto normal — editable
                  if (isPrint || readOnly || disabled) {
                    return <td key={col.key} className={tdBase}>{cellVal || '\u00A0'}</td>;
                  }
                  return (
                    <td key={col.key} className="px-1 py-1 border border-slate-300">
                      <input
                        type="text"
                        value={cellVal}
                        onChange={e => updateTableCell(ri, col.key, e.target.value)}
                        onFocus={e => e.target.select()}
                        className="w-full text-xs text-center bg-white border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Cabeceras (depth 0): divider con acciones
  if (item.depth === 0) {
    return (
      <div className="w-full bg-slate-50 border-y border-slate-200 flex items-center justify-between px-3 py-1.5 mt-2">
        <span className="text-[10px] font-bold text-slate-800 tracking-wide">{item.label}</span>
        {!isPrint && !readOnly && (
          <div className="flex items-center gap-3">
            {onCheckAll && (() => {
              const allDone = allCheckedForSection?.(item.itemId) ?? false;
              return (
                <button
                  type="button"
                  onClick={() => onCheckAll(item.itemId, !allDone)}
                  className={`text-[9px] font-semibold uppercase tracking-wide transition-colors ${allDone ? 'text-red-400 hover:text-red-600' : 'text-teal-600 hover:text-teal-800'}`}
                >
                  {allDone ? 'Destildar todas' : 'Tildar todas'}
                </button>
              );
            })()}
            {onDuplicateSection && (
              <button
                type="button"
                onClick={() => onDuplicateSection(item.itemId)}
                className="text-[9px] font-semibold text-slate-400 hover:text-teal-600 transition-colors"
                title="Duplicar sección"
              >
                + Duplicar
              </button>
            )}
            {onRemoveSection && item.itemId.includes('_dup_') && (
              <button
                type="button"
                onClick={() => onRemoveSection(item.itemId)}
                className="text-[9px] font-semibold text-slate-400 hover:text-red-500 transition-colors"
                title="Quitar sección duplicada"
              >
                × Quitar
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  const isInline = item.itemType === 'value_input';
  const labelEl = (
    <span className={`text-xs leading-snug ${isNA ? 'line-through text-slate-400' : 'text-slate-800'} ${isInline ? 'shrink-0' : 'flex-1'}`}>
      {item.numberPrefix && (
        <span className="font-mono text-slate-400 mr-1.5">{item.numberPrefix}</span>
      )}
      {item.label}
    </span>
  );

  // ── selector ──────────────────────────────────────────────────────────────
  if (item.itemType === 'selector') {
    const selected = (answer as { itemType: 'selector'; selected: string } | undefined)?.selected ?? '';
    if (isPrint) {
      return (
        <div className="flex items-center gap-2 py-1 px-3 bg-slate-50 border-b border-slate-200" style={{ paddingLeft: `${indent + 8}px` }}>
          {labelEl}
          <span className="text-[11px] font-bold text-indigo-700">{selected || '—'}</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 py-1.5 px-2 bg-slate-50/50" style={{ paddingLeft: `${indent + 8}px` }}>
        {labelEl}
        <select
          value={selected}
          disabled={disabled}
          onChange={e => onAnswer({ itemType: 'selector', selected: e.target.value })}
          className="text-[11px] border border-slate-300 rounded px-2 py-1 bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed"
        >
          <option value="">Seleccionar...</option>
          {(item.selectorOptions ?? []).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    );
  }

  // ── checkbox ────────────────────────────────────────────────────────────────
  if (item.itemType === 'checkbox') {
    const cbAnswer = answer as { itemType: 'checkbox'; checked: boolean; linkedValue?: string } | undefined;
    const checked = cbAnswer?.checked ?? false;
    const linkedValue = cbAnswer?.linkedValue ?? '';
    const hasLabel = !!item.label;
    const hasLinked = !!(item.showLinkedValue ?? item.linkedValueLabel);
    const hasDate = !!item.showDate;
    const hasSig = !!item.showSignatures;
    const wantClient = item.showSignatures === 'both' || item.showSignatures === 'client';
    const wantEngineer = item.showSignatures === 'both' || item.showSignatures === 'engineer';

    // Formatear fecha en texto largo: "27 de marzo de 2026"
    const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const fmtDate = (raw?: string) => {
      if (!raw) return null;
      const d = new Date(raw);
      if (isNaN(d.getTime())) return raw;
      return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
    };

    // Construir bloques de fecha según configuración
    const dateBlocks: { label: string; value: string | null }[] = [];
    if (hasDate) {
      const customLabel = item.dateLabel;
      if (item.showDate === 'inicio' || item.showDate === 'both') {
        dateBlocks.push({
          label: item.showDate === 'both' ? 'Fecha de realización' : (customLabel || 'Fecha de realización'),
          value: fmtDate(fechaInicio),
        });
      }
      if (item.showDate === 'fin' || item.showDate === 'both') {
        dateBlocks.push({
          label: item.showDate === 'both' ? 'Fecha de finalización' : (customLabel || 'Fecha de finalización'),
          value: fmtDate(fechaFin),
        });
      }
    }

    // Bloque reutilizable de firma (mismo estilo que CatalogSignaturesView)
    const sigBlock = (sig: string | null | undefined, name: string, roleLabel: string, print: boolean) => (
      <div className="flex-1 flex flex-col items-center">
        <div className={`h-32 w-full border-b ${print ? 'border-slate-900' : 'border-slate-400'} relative`}>
          {sig && <img src={sig} className="absolute inset-0 w-full h-full object-contain object-bottom p-1" alt={roleLabel} />}
        </div>
        <p className={`font-bold text-[11px] mt-1 text-center leading-none ${print ? '' : 'text-slate-700'}`}>{name}</p>
        <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">{roleLabel}</p>
      </div>
    );

    // Bloque de fecha como columna alineada con firmas (misma estructura que sigBlock)
    const dateColumn = (db: { label: string; value: string | null }, print: boolean) => {
      const cleanLabel = db.label.replace(/:+$/, '');
      return (
        <div className="flex-1 flex flex-col items-center">
          <div className={`h-32 w-full border-b ${print ? 'border-slate-900' : 'border-slate-400'} flex items-end justify-center pb-1`}>
            <p className={`text-[11px] ${print ? 'text-slate-800' : 'text-slate-700'} text-center`}>
              {db.value || (print ? '__ de ______ de ____' : '—')}
            </p>
          </div>
          <p className={`font-bold text-[11px] mt-1 text-center leading-none ${print ? '' : 'text-slate-700'}`}>{cleanLabel}</p>
        </div>
      );
    };

    // ── Solo fecha/firmas (sin label) → renderizar como bloque alineado ──
    if (!hasLabel && (hasDate || hasSig)) {
      if (isPrint) {
        return (
          <div className="pt-5 pb-2 px-4">
            <div className="flex items-start gap-10">
              {dateBlocks.map((db, i) => <React.Fragment key={`d${i}`}>{dateColumn(db, true)}</React.Fragment>)}
              {wantClient && sigBlock(signatureClient, aclaracionCliente || 'Cliente', 'Firma del cliente', true)}
              {wantEngineer && sigBlock(signatureEngineer, aclaracionEspecialista || 'Especialista AGS', 'Firma del ing. de soporte técnico', true)}
            </div>
          </div>
        );
      }
      // Modo edición — preview solo lectura
      return (
        <div className="pt-5 pb-1.5 px-4">
          <div className="flex items-start gap-10">
            {dateBlocks.map((db, i) => <React.Fragment key={`d${i}`}>{dateColumn(db, false)}</React.Fragment>)}
            {wantClient && sigBlock(signatureClient, aclaracionCliente || 'Cliente', 'Firma del cliente', false)}
            {wantEngineer && sigBlock(signatureEngineer, aclaracionEspecialista || 'Especialista AGS', 'Firma del ing. de soporte técnico', false)}
          </div>
        </div>
      );
    }

    // ── Checkbox con label (+ fecha/firmas opcionales debajo) ──
    const showValueNow = hasLinked && (checked || item.alwaysShowValue);
    const valueInline = showValueNow && !item.linkedValueLabel;

    if (isPrint) {
      return (
        <div className="py-0.5" style={{ paddingLeft: `${indent + 8}px` }}>
          <div className="flex items-start gap-2.5">
            <span className={`shrink-0 mt-px w-[14px] h-[14px] border-2 rounded-sm flex items-center justify-center ${
              isNA ? 'border-slate-300 bg-slate-100' : checked ? 'border-slate-700 bg-slate-700' : 'border-slate-400 bg-white'
            }`}>
              {isNA ? <span className="text-[9px] text-slate-400 font-bold leading-none">—</span>
                : checked ? <span className="text-[10px] text-white font-bold leading-none">✓</span>
                : null}
            </span>
            {valueInline ? (
              <span className={`text-xs leading-snug ${isNA ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                {item.numberPrefix && <span className="font-mono text-slate-400 mr-1.5">{item.numberPrefix}</span>}
                {item.label}{' '}
                <span className="font-mono border-b border-slate-400">{linkedValue || '___'}</span>
                {item.linkedValueUnit && <span className="text-[10px] text-slate-500 ml-0.5">{item.linkedValueUnit}</span>}
              </span>
            ) : (
              <>
                {labelEl}
                {showValueNow && (
                  <span className="text-[11px] text-slate-600 shrink-0">
                    <span className="text-slate-400">{item.linkedValueLabel}: </span>
                    <span className="font-mono border-b border-slate-400">{linkedValue || '___'}</span>
                    {item.linkedValueUnit && <span className="text-[10px] text-slate-500 ml-0.5">{item.linkedValueUnit}</span>}
                  </span>
                )}
              </>
            )}
          </div>
          {/* Fecha + firmas debajo, alineados en fila */}
          {(hasDate || hasSig) && (
            <div className="mt-5">
              <div className="flex items-start gap-10">
                {dateBlocks.map((db, i) => <React.Fragment key={`d${i}`}>{dateColumn(db, true)}</React.Fragment>)}
                {wantClient && sigBlock(signatureClient, aclaracionCliente || 'Cliente', 'Firma del cliente', true)}
                {wantEngineer && sigBlock(signatureEngineer, aclaracionEspecialista || 'Especialista AGS', 'Firma del ing. de soporte técnico', true)}
              </div>
            </div>
          )}
        </div>
      );
    }
    return (
      <div className="py-1 px-2" style={{ paddingLeft: `${indent + 8}px` }}>
        <div className="flex items-start gap-2.5">
          <label className={`flex items-start gap-2.5 cursor-pointer hover:bg-slate-50 rounded text-slate-800 ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
            <input
              type="checkbox"
              className="mt-0.5 shrink-0 w-4 h-4 accent-slate-700 rounded"
              checked={checked}
              disabled={disabled}
              onChange={e => onAnswer({ itemType: 'checkbox', checked: e.target.checked, linkedValue })}
            />
            {labelEl}
          </label>
          {showValueNow && (
            <div className="flex items-center gap-1 shrink-0">
              {item.linkedValueLabel && <span className="text-[10px] text-slate-500">{item.linkedValueLabel}:</span>}
              <input
                type="text"
                className="text-xs bg-transparent border-b border-slate-300 outline-none w-16 text-center disabled:cursor-not-allowed"
                value={linkedValue}
                disabled={disabled}
                placeholder="___"
                onChange={e => onAnswer({ itemType: 'checkbox', checked: checked || !!item.alwaysShowValue, linkedValue: e.target.value })}
              />
              {item.linkedValueUnit && <span className="text-[10px] text-slate-400">{item.linkedValueUnit}</span>}
            </div>
          )}
        </div>
        {/* Fecha + firmas debajo, alineados en fila */}
        {(hasDate || hasSig) && (
          <div className="mt-5">
            <div className="flex items-start gap-10">
              {dateBlocks.map((db, i) => <React.Fragment key={`d${i}`}>{dateColumn(db, false)}</React.Fragment>)}
              {wantClient && sigBlock(signatureClient, aclaracionCliente || 'Cliente', 'Firma del cliente', false)}
              {wantEngineer && sigBlock(signatureEngineer, aclaracionEspecialista || 'Especialista AGS', 'Firma del ing. de soporte técnico', false)}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── value_input ──────────────────────────────────────────────────────────────
  if (item.itemType === 'value_input') {
    const value = (answer as { itemType: 'value_input'; value: string } | undefined)?.value ?? '';
    if (isPrint) {
      return (
        <div className="flex items-center gap-2 py-0.5" style={{ paddingLeft: `${indent + 8}px` }}>
          {labelEl}
          <span className="text-[11px] font-mono border-b border-slate-400 min-w-[60px] text-center">
            {isNA ? 'N/A' : value || '___'}
          </span>
          {item.unit && <span className="text-[10px] text-slate-500">{item.unit}</span>}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1 py-1 px-2" style={{ paddingLeft: `${indent + 8}px` }}>
        {labelEl}
        <input
          type="text"
          className="text-[11px] bg-transparent border-none outline-none border-b border-slate-300 w-24 shrink-0 disabled:cursor-not-allowed"
          value={isNA ? '' : value}
          disabled={disabled}
          placeholder={isNA ? 'N/A' : '___'}
          onChange={e => onAnswer({ itemType: 'value_input', value: e.target.value })}
        />
        {item.unit && <span className="text-[10px] text-slate-400 select-none pointer-events-none">{item.unit}</span>}
      </div>
    );
  }

  // ── pass_fail ────────────────────────────────────────────────────────────────
  if (item.itemType === 'pass_fail') {
    const result = (answer as { itemType: 'pass_fail'; result: string } | undefined)?.result ?? '';
    if (isPrint) {
      const label = isNA ? 'N/A' : result === 'CUMPLE' ? 'Cumple' : result === 'NO_CUMPLE' ? 'No cumple' : '—';
      return (
        <div className="flex items-center gap-1 py-0.5 border-b border-slate-100"
          style={{ paddingLeft: `${indent + 8}px` }}>
          {labelEl}
          <span className={`text-[11px] font-bold shrink-0 ${result === 'CUMPLE' ? 'text-emerald-700' : result === 'NO_CUMPLE' ? 'text-red-700' : 'text-slate-400'}`}>
            {label}
          </span>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-between gap-2 py-1 px-2" style={{ paddingLeft: `${indent + 8}px` }}>
        {labelEl}
        {isNA ? (
          <span className="text-[10px] text-slate-400 italic shrink-0">N/A</span>
        ) : (
          <div className="flex rounded border border-slate-200 overflow-hidden shrink-0">
            {(['CUMPLE', 'NO_CUMPLE', 'NA'] as const).map(opt => (
              <button
                key={opt}
                disabled={readOnly}
                onClick={() => onAnswer({ itemType: 'pass_fail', result: opt })}
                className={`text-[10px] px-2 py-1 font-medium transition-colors disabled:cursor-not-allowed
                  ${result === opt
                    ? opt === 'CUMPLE' ? 'bg-emerald-600 text-white' : opt === 'NO_CUMPLE' ? 'bg-red-600 text-white' : 'bg-slate-500 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                  } border-r border-slate-200 last:border-r-0`}
              >
                {opt === 'CUMPLE' ? 'Cumple' : opt === 'NO_CUMPLE' ? 'No cumple' : 'N/A'}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ─── Componente principal ─────────────────────────────────────────────────────
export const CatalogChecklistView: React.FC<Props> = ({
  selection,
  readOnly = false,
  isPrint = false,
  onChangeData,
  onChangeObservaciones,
  onChangeResultado,
  onToggleSection,
  onRemove,
  onDuplicateSection,
  onRemoveSection,
  signatureClient,
  signatureEngineer,
  aclaracionCliente,
  aclaracionEspecialista,
  fechaInicio,
  fechaFin,
}) => {
  const { tableSnapshot, checklistData = {}, collapsedSections = [] } = selection;
  const items = tableSnapshot.checklistItems ?? [];
  const naSet = buildNASet(items, collapsedSections);

  const handleAnswer = (itemId: string, answer: ChecklistItemAnswer) => {
    onChangeData(selection.tableId, itemId, answer);
  };

  /** Obtener los items checkbox de una sección */
  const getSectionCheckboxes = (sectionItemId: string) => {
    const sectionIdx = items.findIndex(i => i.itemId === sectionItemId);
    if (sectionIdx === -1) return [];
    const result: ChecklistItem[] = [];
    for (let i = sectionIdx + 1; i < items.length; i++) {
      if (items[i].depth === 0) break;
      if (naSet.has(items[i].itemId)) continue;
      if (items[i].itemType === 'checkbox') result.push(items[i]);
    }
    return result;
  };

  /** Verificar si todas las checkboxes de una sección están tildadas */
  const isAllChecked = (sectionItemId: string): boolean => {
    const cbs = getSectionCheckboxes(sectionItemId);
    if (cbs.length === 0) return false;
    return cbs.every(cb => {
      const a = checklistData[cb.itemId] as { itemType: 'checkbox'; checked: boolean } | undefined;
      return a?.checked === true;
    });
  };

  /** Tildar/destildar todas las checkboxes de una sección */
  const handleCheckAll = (sectionItemId: string, check: boolean) => {
    const cbs = getSectionCheckboxes(sectionItemId);
    for (const cb of cbs) {
      const existing = checklistData[cb.itemId] as { itemType: 'checkbox'; checked: boolean; linkedValue?: string } | undefined;
      onChangeData(selection.tableId, cb.itemId, { itemType: 'checkbox', checked: check, linkedValue: existing?.linkedValue ?? '' });
    }
  };

  /** Tildar/destildar TODAS las checkboxes de toda la tabla */
  const allCheckboxes = items.filter(i => i.itemType === 'checkbox' && !naSet.has(i.itemId));
  const allGlobalChecked = allCheckboxes.length > 0 && allCheckboxes.every(cb => {
    const a = checklistData[cb.itemId] as { itemType: 'checkbox'; checked: boolean } | undefined;
    return a?.checked === true;
  });
  const handleCheckAllGlobal = (check: boolean) => {
    for (const cb of allCheckboxes) {
      const existing = checklistData[cb.itemId] as { itemType: 'checkbox'; checked: boolean; linkedValue?: string } | undefined;
      onChangeData(selection.tableId, cb.itemId, { itemType: 'checkbox', checked: check, linkedValue: existing?.linkedValue ?? '' });
    }
  };

  const showTitle = tableSnapshot.showTitle ?? true;

  return (
    <div className={`border border-slate-200 rounded-xl overflow-hidden ${isPrint ? 'mb-4' : ''}`}>
      {/* Cabecera */}
      {(showTitle || (!readOnly && !isPrint)) && (
        <div className={`flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200 ${!showTitle && !isPrint ? 'py-1' : ''}`}>
          {showTitle && (
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-800 tracking-tight">{tableSnapshot.name}</span>
            </div>
          )}
          {!showTitle && <div />}
          <div className="flex items-center gap-3">
            {!readOnly && !isPrint && allCheckboxes.length > 0 && (
              <button
                onClick={() => handleCheckAllGlobal(!allGlobalChecked)}
                className={`text-[10px] font-semibold uppercase tracking-wide transition-colors ${allGlobalChecked ? 'text-red-400 hover:text-red-600' : 'text-teal-600 hover:text-teal-800'}`}
              >
                {allGlobalChecked ? 'Destildar todas' : 'Tildar todas'}
              </button>
            )}
            {!readOnly && !isPrint && onRemove && (
              <button onClick={() => onRemove(selection.tableId)}
                className="text-slate-400 hover:text-slate-700 text-xs">× Quitar</button>
            )}
          </div>
        </div>
      )}

      {/* Cuerpo — ítems del checklist */}
      <div className={`bg-white ${isPrint ? '' : 'divide-y divide-slate-50'}`}>
        {items.map(item => {
          // visibleWhen: ocultar según condición de selector o checkbox
          if (item.visibleWhen) {
            if ('checkboxItemId' in item.visibleWhen) {
              // Condición de checkbox: visible cuando el estado del checkbox coincide con whenChecked
              const cbAnswer = checklistData[item.visibleWhen.checkboxItemId] as
                { itemType: 'checkbox'; checked: boolean } | undefined;
              const isChecked = cbAnswer?.checked ?? false;
              if (isChecked !== item.visibleWhen.whenChecked) return null;
            } else {
              // Condición de selector (legacy + nuevo)
              const selectorAnswer = checklistData[item.visibleWhen.selectorItemId] as
                { itemType: 'selector'; selected: string } | undefined;
              const selectorValue = selectorAnswer?.selected ?? '';
              const allowed = (item.visibleWhen as any).values ?? [(item.visibleWhen as any).value];
              if (!allowed.includes(selectorValue)) return null;
            }
          }

          const isNA = naSet.has(item.itemId);
          const answer = checklistData[item.itemId];

          // Sección con N/A toggle (solo modo edición)
          const showNAToggle = !isPrint && !readOnly && item.canBeNA && item.depth >= 1;
          const isCollapsed = collapsedSections.includes(item.itemId);

          if (item.depth === 0) {
            return (
              <ChecklistItemRow
                key={item.itemId} item={item} answer={answer}
                isNA={isNA} readOnly={readOnly} isPrint={isPrint}
                onAnswer={a => handleAnswer(item.itemId, a)}
                onCheckAll={handleCheckAll}
                allCheckedForSection={isAllChecked}
                onDuplicateSection={onDuplicateSection}
                onRemoveSection={onRemoveSection}
                signatureClient={signatureClient} signatureEngineer={signatureEngineer}
                aclaracionCliente={aclaracionCliente} aclaracionEspecialista={aclaracionEspecialista}
                fechaInicio={fechaInicio} fechaFin={fechaFin}
              />
            );
          }

          return (
            <div key={item.itemId} className={`relative ${item.depth >= 3 ? 'border-l-2 border-slate-200 ml-[32px]' : ''}`}>
              {showNAToggle && (
                <div className="absolute right-2 top-1 z-10">
                  <label className="flex items-center gap-1 text-[9px] text-slate-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="w-3 h-3 accent-slate-400"
                      checked={isCollapsed}
                      onChange={e => onToggleSection?.(selection.tableId, item.itemId, e.target.checked)}
                    />
                    No aplica
                  </label>
                </div>
              )}
              <ChecklistItemRow
                item={item} answer={answer}
                isNA={isNA} readOnly={readOnly} isPrint={isPrint}
                onAnswer={a => handleAnswer(item.itemId, a)}
                signatureClient={signatureClient} signatureEngineer={signatureEngineer}
                aclaracionCliente={aclaracionCliente} aclaracionEspecialista={aclaracionEspecialista}
                fechaInicio={fechaInicio} fechaFin={fechaFin}
              />
            </div>
          );
        })}

        {items.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-6 italic">Sin ítems en este checklist.</p>
        )}
      </div>

      {/* Footer — Observaciones (solo si hay contenido en print, siempre editable fuera de print) */}
      {!isPrint ? (
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200">
          <div className="flex items-start gap-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase shrink-0 mt-1">Obs.</span>
            <textarea
              className="flex-1 text-[11px] border border-slate-200 rounded p-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:cursor-not-allowed"
              rows={2}
              value={selection.observaciones ?? ''}
              disabled={readOnly}
              placeholder="Observaciones opcionales..."
              onChange={e => onChangeObservaciones?.(selection.tableId, e.target.value)}
            />
          </div>
        </div>
      ) : (
        selection.observaciones && (
          <div className="px-4 py-2 border-t border-slate-200 text-[10px] text-slate-700">
            <span className="font-bold">Observaciones: </span>{selection.observaciones}
          </div>
        )
      )}
    </div>
  );
};
