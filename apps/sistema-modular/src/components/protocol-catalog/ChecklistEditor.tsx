import { useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import type { TableCatalogEntry, ChecklistItem, ChecklistItemType } from '@ags/shared';
import { ImportChecklistPdfDialog } from './ImportChecklistPdfDialog';
import { EmbeddedTableEditor } from './EmbeddedTableEditor';

interface Props {
  entry: TableCatalogEntry;
  onChange: (entry: TableCatalogEntry) => void;
}

const DEPTH_LABELS: Record<number, string> = {
  0: 'Cabecera',
  1: 'Sección',
  2: 'Sub-sección',
  3: 'Sub-sub-sección',
};

const TYPE_LABELS: Record<ChecklistItemType, string> = {
  checkbox: 'Checkbox',
  value_input: 'Campo valor',
  pass_fail: 'Cumple/No cumple',
  selector: 'Selector',
  embedded_table: 'Tabla embebida',
};

const DEPTH_COLORS: Record<number, string> = {
  0: 'bg-slate-800 text-white',
  1: 'bg-slate-200 text-slate-800',
  2: 'bg-slate-100 text-slate-600',
  3: 'bg-slate-50 text-slate-500',
};

function newItem(): ChecklistItem {
  return {
    itemId: crypto.randomUUID(),
    label: '',
    itemType: 'checkbox',
    depth: 1,
    unit: null,
    canBeNA: false,
    numberPrefix: null,
    selectorOptions: null,
    visibleWhen: null,
  };
}

// ─── Formulario de ítem inline ────────────────────────────────────────────────
interface ItemFormProps {
  item: ChecklistItem;
  allItems: ChecklistItem[];
  onSave: (item: ChecklistItem) => void;
  onCancel: () => void;
}

const ItemForm = ({ item, allItems, onSave, onCancel }: ItemFormProps) => {
  const [d, setD] = useState<ChecklistItem>(item);
  const [optionInput, setOptionInput] = useState('');

  // Selectores y checkboxes disponibles para visibleWhen (excluir el item actual)
  const availableSelectors = allItems.filter(
    it => it.itemType === 'selector' && it.itemId !== d.itemId && it.selectorOptions?.length
  );
  const availableCheckboxes = allItems.filter(
    it => it.itemType === 'checkbox' && it.itemId !== d.itemId && it.label.trim()
  );
  const hasConditionSources = availableSelectors.length > 0 || availableCheckboxes.length > 0;

  const addOption = () => {
    const val = optionInput.trim();
    if (!val) return;
    const current = d.selectorOptions ?? [];
    if (!current.includes(val)) {
      setD({ ...d, selectorOptions: [...current, val] });
    }
    setOptionInput('');
  };

  const removeOption = (opt: string) => {
    setD({ ...d, selectorOptions: (d.selectorOptions ?? []).filter(o => o !== opt) });
  };

  return (
    <div className="border border-slate-900 rounded-lg p-3 space-y-2 bg-slate-50 mt-2">
      <div className="grid grid-cols-2 gap-2">
        <Input
          placeholder="Texto del ítem"
          value={d.label}
          onChange={e => setD({ ...d, label: e.target.value })}
          autoFocus
        />
        <Input
          placeholder="Prefijo (ej: 3.2.a)"
          value={d.numberPrefix ?? ''}
          onChange={e => setD({ ...d, numberPrefix: e.target.value || null })}
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <select
          value={d.itemType}
          onChange={e => {
            const newType = e.target.value as ChecklistItemType;
            setD({
              ...d,
              itemType: newType,
              selectorOptions: newType === 'selector' ? (d.selectorOptions ?? []) : null,
              embeddedColumns: newType === 'embedded_table' ? (d.embeddedColumns ?? []) : null,
              embeddedRows: newType === 'embedded_table' ? (d.embeddedRows ?? []) : null,
            });
          }}
          className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
        >
          <option value="checkbox">Checkbox</option>
          <option value="value_input">Campo valor</option>
          <option value="pass_fail">Cumple / No cumple</option>
          <option value="selector">Selector</option>
          <option value="embedded_table">Tabla informacional</option>
        </select>
        <select
          value={d.depth}
          onChange={e => setD({ ...d, depth: Number(e.target.value) as ChecklistItem['depth'] })}
          className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
        >
          <option value={0}>0 — Cabecera</option>
          <option value={1}>1 — Sección</option>
          <option value={2}>2 — Sub-sección</option>
          <option value={3}>3 — Sub-sub-sección</option>
        </select>
        {d.itemType === 'value_input' ? (
          <Input
            placeholder="Unidad (ej: bar, hs.)"
            value={d.unit ?? ''}
            onChange={e => setD({ ...d, unit: e.target.value || null })}
          />
        ) : (
          <div />
        )}
      </div>

      {/* Opciones del selector */}
      {d.itemType === 'selector' && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-slate-500">Opciones del selector:</p>
          <div className="flex flex-wrap gap-1.5">
            {(d.selectorOptions ?? []).map(opt => (
              <span key={opt} className="flex items-center gap-1 text-[11px] bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">
                {opt}
                <button onClick={() => removeOption(opt)} className="text-teal-400 hover:text-teal-700 font-bold">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-1.5">
            <Input
              placeholder="Nueva opción..."
              value={optionInput}
              onChange={e => setOptionInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }}
              className="flex-1"
            />
            <Button size="sm" variant="outline" onClick={addOption} disabled={!optionInput.trim()}>+</Button>
          </div>
        </div>
      )}

      {/* Campo vinculado al checkbox */}
      {d.itemType === 'checkbox' && (
        <div className="space-y-1.5 pt-1 border-t border-slate-200">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={!!d.linkedValueLabel}
              onChange={e => {
                if (e.target.checked) {
                  setD({ ...d, linkedValueLabel: 'Cantidad', linkedValueUnit: null });
                } else {
                  setD({ ...d, linkedValueLabel: null, linkedValueUnit: null });
                }
              }}
              className="accent-teal-600"
            />
            Al tildar, mostrar campo de valor
          </label>
          {d.linkedValueLabel && (
            <div className="grid grid-cols-2 gap-2 pl-6">
              <Input
                placeholder="Etiqueta (ej: Cantidad)"
                value={d.linkedValueLabel}
                onChange={e => setD({ ...d, linkedValueLabel: e.target.value || null })}
              />
              <Input
                placeholder="Unidad (ej: unid.)"
                value={d.linkedValueUnit ?? ''}
                onChange={e => setD({ ...d, linkedValueUnit: e.target.value || null })}
              />
            </div>
          )}
        </div>
      )}

      {/* Tabla informacional embebida */}
      {d.itemType === 'embedded_table' && (
        <EmbeddedTableEditor
          columns={d.embeddedColumns ?? []}
          rows={d.embeddedRows ?? []}
          onChange={(cols, rows) => setD({ ...d, embeddedColumns: cols, embeddedRows: rows })}
        />
      )}

      {/* Condición de visibilidad */}
      {hasConditionSources && d.itemType !== 'selector' && (
        <div className="space-y-1.5 pt-1 border-t border-slate-200">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={!!d.visibleWhen}
                onChange={e => {
                  if (e.target.checked) {
                    // Default: primer selector si hay, sino primer checkbox
                    if (availableSelectors.length > 0) {
                      const first = availableSelectors[0];
                      setD({ ...d, visibleWhen: { selectorItemId: first.itemId, values: [first.selectorOptions![0]] } });
                    } else {
                      const first = availableCheckboxes[0];
                      setD({ ...d, visibleWhen: { checkboxItemId: first.itemId, whenChecked: false } });
                    }
                  } else {
                    setD({ ...d, visibleWhen: null });
                  }
                }}
                className="accent-teal-600"
              />
              Visible solo si...
            </label>
          </div>
          {d.visibleWhen && (() => {
            const isCheckboxCondition = 'checkboxItemId' in d.visibleWhen!;
            const conditionType = isCheckboxCondition ? 'checkbox' : 'selector';

            return (
              <div className="pl-6 space-y-1.5">
                {/* Tipo de condición */}
                {availableSelectors.length > 0 && availableCheckboxes.length > 0 && (
                  <div className="flex gap-2">
                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 cursor-pointer">
                      <input type="radio" checked={conditionType === 'selector'} onChange={() => {
                        const first = availableSelectors[0];
                        setD({ ...d, visibleWhen: { selectorItemId: first.itemId, values: [first.selectorOptions![0]] } });
                      }} className="accent-teal-600" />
                      Según selector
                    </label>
                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 cursor-pointer">
                      <input type="radio" checked={conditionType === 'checkbox'} onChange={() => {
                        const first = availableCheckboxes[0];
                        setD({ ...d, visibleWhen: { checkboxItemId: first.itemId, whenChecked: false } });
                      }} className="accent-teal-600" />
                      Según checkbox
                    </label>
                  </div>
                )}

                {/* Selector condition */}
                {conditionType === 'selector' && 'selectorItemId' in d.visibleWhen! && (() => {
                  const vw = d.visibleWhen as { selectorItemId: string; values: string[] };
                  const selectedSelector = availableSelectors.find(s => s.itemId === vw.selectorItemId);
                  const selectorOpts = selectedSelector?.selectorOptions ?? [];
                  const toggleValue = (val: string) => {
                    const next = vw.values.includes(val) ? vw.values.filter(v => v !== val) : [...vw.values, val];
                    if (next.length > 0) setD({ ...d, visibleWhen: { ...vw, values: next } });
                  };
                  return (
                    <>
                      <select
                        value={vw.selectorItemId}
                        onChange={e => {
                          const sel = availableSelectors.find(s => s.itemId === e.target.value);
                          setD({ ...d, visibleWhen: { selectorItemId: e.target.value, values: sel?.selectorOptions?.slice(0, 1) ?? [] } });
                        }}
                        className="text-[11px] border border-slate-300 rounded px-1.5 py-1 bg-white"
                      >
                        {availableSelectors.map(s => (
                          <option key={s.itemId} value={s.itemId}>{s.label || '(sin nombre)'}</option>
                        ))}
                      </select>
                      <div className="flex flex-wrap gap-1.5">
                        {selectorOpts.map(opt => {
                          const isSelected = vw.values.includes(opt);
                          return (
                            <label key={opt} className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg border cursor-pointer transition-colors ${
                              isSelected ? 'border-teal-300 bg-teal-50 text-teal-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                            }`}>
                              <input type="checkbox" checked={isSelected} onChange={() => toggleValue(opt)} className="w-3 h-3 accent-teal-600" />
                              {opt}
                            </label>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}

                {/* Checkbox condition */}
                {conditionType === 'checkbox' && 'checkboxItemId' in d.visibleWhen! && (() => {
                  const vw = d.visibleWhen as { checkboxItemId: string; whenChecked: boolean };
                  return (
                    <>
                      <select
                        value={vw.checkboxItemId}
                        onChange={e => setD({ ...d, visibleWhen: { ...vw, checkboxItemId: e.target.value } })}
                        className="text-[11px] border border-slate-300 rounded px-1.5 py-1 bg-white"
                      >
                        {availableCheckboxes.map(cb => (
                          <option key={cb.itemId} value={cb.itemId}>{cb.label || '(sin nombre)'}</option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <label className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg border cursor-pointer transition-colors ${
                          !vw.whenChecked ? 'border-teal-300 bg-teal-50 text-teal-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                        }`}>
                          <input type="radio" checked={!vw.whenChecked} onChange={() => setD({ ...d, visibleWhen: { ...vw, whenChecked: false } })} className="accent-teal-600" />
                          No tildado (visible si aplica)
                        </label>
                        <label className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg border cursor-pointer transition-colors ${
                          vw.whenChecked ? 'border-teal-300 bg-teal-50 text-teal-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                        }`}>
                          <input type="radio" checked={vw.whenChecked} onChange={() => setD({ ...d, visibleWhen: { ...vw, whenChecked: true } })} className="accent-teal-600" />
                          Tildado
                        </label>
                      </div>
                    </>
                  );
                })()}
              </div>
            );
          })()}
        </div>
      )}

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase cursor-pointer">
          <input
            type="checkbox"
            checked={d.canBeNA ?? false}
            onChange={e => setD({ ...d, canBeNA: e.target.checked })}
            className="accent-blue-600"
          />
          Puede marcarse "No Aplica"
        </label>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button size="sm" onClick={() => onSave(d)} disabled={d.itemType !== 'embedded_table' && !d.label.trim()}>Guardar</Button>
        </div>
      </div>
    </div>
  );
};

// ─── Botón "+" entre ítems (visible al hover) ────────────────────────────────
const InsertButton = ({ onClick }: { onClick: () => void }) => (
  <div
    className="group relative h-2 flex items-center justify-center -my-0.5 cursor-pointer"
    onClick={onClick}
  >
    <div className="absolute inset-x-0 h-px bg-teal-300 opacity-0 group-hover:opacity-100 transition-opacity" />
    <button className="relative z-10 w-5 h-5 rounded-full bg-teal-500 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shadow-sm">
      +
    </button>
  </div>
);

// ─── Componente principal ─────────────────────────────────────────────────────
export const ChecklistEditor = ({ entry, onChange }: Props) => {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [insertAtIdx, setInsertAtIdx] = useState<number | null>(null);
  const [showImport, setShowImport] = useState(false);

  const items = entry.checklistItems ?? [];
  const upd = (newItems: ChecklistItem[]) => onChange({ ...entry, checklistItems: newItems });
  const isEditing = editingIdx !== null || adding || insertAtIdx !== null;

  const startInsert = (idx: number) => {
    setEditingIdx(null);
    setAdding(false);
    setInsertAtIdx(idx);
  };

  const saveItem = (item: ChecklistItem) => {
    if (editingIdx !== null) {
      const next = [...items]; next[editingIdx] = item;
      upd(next); setEditingIdx(null);
    } else if (insertAtIdx !== null) {
      const next = [...items];
      next.splice(insertAtIdx + 1, 0, item);
      upd(next); setInsertAtIdx(null);
    } else {
      upd([...items, item]); setAdding(false);
    }
  };

  const deleteItem = (idx: number) => upd(items.filter((_, i) => i !== idx));

  const duplicateItem = (idx: number) => {
    const next = [...items];
    const clone = { ...items[idx], itemId: crypto.randomUUID() };
    next.splice(idx + 1, 0, clone);
    upd(next);
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    const next = [...items];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    upd(next);
  };

  // Resolver nombre del ítem referenciado en visibleWhen
  const getItemLabel = (itemId: string) => {
    const it = items.find(i => i.itemId === itemId);
    return it?.label || '???';
  };

  return (
    <Card className="border-2 border-slate-900">
      {/* Wrapper scrollable — sticky toolbar vive dentro */}
      <div className="max-h-[70vh] overflow-y-auto -mx-6 px-6">
        {/* Toolbar sticky */}
        <div className="flex items-center justify-between py-2 sticky top-0 z-10 bg-white border-b border-slate-100 -mx-6 px-6">
          <span className="text-xs text-slate-500">{items.length} ítems en el checklist</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowImport(true)}>
              Importar desde PDF
            </Button>
            {!isEditing && (
              <Button size="sm" onClick={() => { setEditingIdx(null); setInsertAtIdx(null); setAdding(true); }}>
                + Agregar ítem
              </Button>
            )}
          </div>
        </div>

        {/* Lista de ítems */}
        <div className="space-y-1 pt-3 overflow-hidden">
        {/* Insertar antes del primer ítem */}
        {items.length > 0 && !isEditing && <InsertButton onClick={() => startInsert(-1)} />}
        {insertAtIdx === -1 && (
          <ItemForm item={newItem()} allItems={items} onSave={saveItem} onCancel={() => setInsertAtIdx(null)} />
        )}

        {items.map((item, i) => (
          <div key={item.itemId}>
            {editingIdx === i ? (
              <ItemForm item={item} allItems={items} onSave={saveItem} onCancel={() => setEditingIdx(null)} />
            ) : (
              <div
                className={`flex items-center p-2 rounded-lg border border-slate-200 ${
                  item.depth === 0 ? 'border-slate-400' : ''
                } ${item.visibleWhen ? 'border-l-2 border-l-teal-400' : ''}`}
                style={{ paddingLeft: `${(item.depth + 1) * 12}px` }}
              >
                {/* Left: badge + prefix + label — all shrinkable */}
                <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden mr-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap ${
                    item.itemType === 'selector' ? 'bg-teal-600 text-white'
                    : item.itemType === 'embedded_table' ? 'bg-blue-600 text-white'
                    : DEPTH_COLORS[item.depth]
                  }`}>
                    {item.itemType === 'selector' ? 'Selector' : item.itemType === 'embedded_table' ? 'Tabla' : DEPTH_LABELS[item.depth]}
                  </span>
                  {item.numberPrefix && (
                    <span className="text-xs font-mono text-slate-400 shrink-0 whitespace-nowrap max-w-[80px] truncate" title={item.numberPrefix}>
                      {item.numberPrefix}
                    </span>
                  )}
                  <span
                    className={`text-xs truncate ${item.depth === 0 ? 'font-bold text-slate-900 uppercase' : 'text-slate-700'}`}
                    title={item.label}
                  >
                    {item.label || <span className="italic text-slate-400">(sin texto)</span>}
                  </span>
                  {/* Opciones del selector inline */}
                  {item.itemType === 'selector' && item.selectorOptions && item.selectorOptions.length > 0 && (
                    <span className="text-[10px] text-teal-500 shrink-0 truncate max-w-[200px]" title={item.selectorOptions.join(', ')}>
                      [{item.selectorOptions.join(', ')}]
                    </span>
                  )}
                  {/* Info de tabla embebida */}
                  {item.itemType === 'embedded_table' && item.embeddedColumns && (
                    <span className="text-[10px] text-blue-500 shrink-0">
                      {item.embeddedColumns.length} cols, {(item.embeddedRows ?? []).length} filas
                    </span>
                  )}
                  {/* Badge de condición */}
                  {item.visibleWhen && (
                    <span className="text-[9px] text-teal-500 bg-teal-50 px-1.5 py-px rounded shrink-0" title={
                      'checkboxItemId' in item.visibleWhen
                        ? `Visible cuando "${getItemLabel(item.visibleWhen.checkboxItemId)}" ${item.visibleWhen.whenChecked ? 'tildado' : 'no tildado'}`
                        : `Visible cuando "${getItemLabel(item.visibleWhen.selectorItemId)}" = ${item.visibleWhen.values.join(' | ')}`
                    }>
                      {'checkboxItemId' in item.visibleWhen
                        ? `si ${item.visibleWhen.whenChecked ? '✓' : '☐'} ${getItemLabel(item.visibleWhen.checkboxItemId).slice(0, 20)}`
                        : `si ${item.visibleWhen.values.join(' | ')}`
                      }
                    </span>
                  )}
                </div>
                {/* Right: metadata + actions — fixed, never shrink */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {item.itemType !== 'selector' && (
                    <span className="text-[10px] text-slate-400">{TYPE_LABELS[item.itemType]}</span>
                  )}
                  {item.unit && <span className="text-[10px] text-blue-500">{item.unit}</span>}
                  {item.linkedValueLabel && <span className="text-[10px] text-orange-500" title={`Al tildar: ${item.linkedValueLabel}${item.linkedValueUnit ? ` (${item.linkedValueUnit})` : ''}`}>+valor</span>}
                  {item.canBeNA && <span className="text-[10px] text-amber-600">N/A</span>}
                  <button onClick={() => moveItem(i, -1)} disabled={i === 0}
                    className="text-slate-400 hover:text-slate-700 disabled:opacity-20 text-xs px-1">▲</button>
                  <button onClick={() => moveItem(i, 1)} disabled={i === items.length - 1}
                    className="text-slate-400 hover:text-slate-700 disabled:opacity-20 text-xs px-1">▼</button>
                  <button onClick={() => duplicateItem(i)}
                    className="text-slate-500 hover:text-slate-700 text-xs font-bold px-1">Dup</button>
                  <button onClick={() => { setAdding(false); setInsertAtIdx(null); setEditingIdx(i); }}
                    className="text-blue-600 text-xs font-bold px-1">Editar</button>
                  <button onClick={() => deleteItem(i)}
                    className="text-red-600 text-xs font-bold px-1">×</button>
                </div>
              </div>
            )}

            {/* Insertar después de este ítem */}
            {!isEditing && <InsertButton onClick={() => startInsert(i)} />}
            {insertAtIdx === i && (
              <ItemForm item={newItem()} allItems={items} onSave={saveItem} onCancel={() => setInsertAtIdx(null)} />
            )}
          </div>
        ))}
      </div>

      {/* Formulario de nuevo ítem (al final) */}
      {adding && (
        <ItemForm item={newItem()} allItems={items} onSave={saveItem} onCancel={() => setAdding(false)} />
      )}

      {items.length === 0 && !adding && (
        <p className="text-xs text-slate-400 text-center py-6 italic">
          Sin ítems — agregá uno o importá desde PDF.
        </p>
      )}

      {/* Botón agregar al final de la lista */}
      {items.length > 0 && !isEditing && (
        <div className="pt-3 pb-1 flex justify-center">
          <Button size="sm" onClick={() => { setEditingIdx(null); setInsertAtIdx(null); setAdding(true); }}>
            + Agregar ítem
          </Button>
        </div>
      )}
      </div>{/* /scrollable wrapper */}

      {/* Dialog de importación */}
      {showImport && (
        <ImportChecklistPdfDialog
          onClose={() => setShowImport(false)}
          onImport={importedItems => {
            upd([...items, ...importedItems]);
            setShowImport(false);
          }}
        />
      )}
    </Card>
  );
};
