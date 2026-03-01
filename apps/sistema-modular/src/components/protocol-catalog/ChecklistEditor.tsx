import { useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import type { TableCatalogEntry, ChecklistItem, ChecklistItemType } from '@ags/shared';
import { ImportChecklistPdfDialog } from './ImportChecklistPdfDialog';

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
  };
}

// ─── Formulario de ítem inline ────────────────────────────────────────────────
interface ItemFormProps {
  item: ChecklistItem;
  onSave: (item: ChecklistItem) => void;
  onCancel: () => void;
}

const ItemForm = ({ item, onSave, onCancel }: ItemFormProps) => {
  const [d, setD] = useState<ChecklistItem>(item);
  return (
    <div className="border border-slate-900 rounded-lg p-3 space-y-2 bg-slate-50 mt-2">
      <div className="grid grid-cols-2 gap-2">
        <Input
          placeholder="Texto del ítem"
          value={d.label}
          onChange={e => setD({ ...d, label: e.target.value })}
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
          onChange={e => setD({ ...d, itemType: e.target.value as ChecklistItemType })}
          className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
        >
          <option value="checkbox">Checkbox</option>
          <option value="value_input">Campo valor</option>
          <option value="pass_fail">Cumple / No cumple</option>
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
          <Button size="sm" onClick={() => onSave(d)} disabled={!d.label.trim()}>Guardar</Button>
        </div>
      </div>
    </div>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────
export const ChecklistEditor = ({ entry, onChange }: Props) => {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const items = entry.checklistItems ?? [];
  const upd = (newItems: ChecklistItem[]) => onChange({ ...entry, checklistItems: newItems });

  const saveItem = (item: ChecklistItem) => {
    if (editingIdx !== null) {
      const next = [...items]; next[editingIdx] = item;
      upd(next); setEditingIdx(null);
    } else {
      upd([...items, item]); setAdding(false);
    }
  };

  const deleteItem = (idx: number) => upd(items.filter((_, i) => i !== idx));

  const moveItem = (idx: number, dir: -1 | 1) => {
    const next = [...items];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    upd(next);
  };

  return (
    <Card className="border-2 border-slate-900">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-slate-500">{items.length} ítems en el checklist</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowImport(true)}>
            Importar desde PDF
          </Button>
          {!adding && editingIdx === null && (
            <Button size="sm" onClick={() => setAdding(true)}>+ Agregar ítem</Button>
          )}
        </div>
      </div>

      {/* Lista de ítems */}
      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={item.itemId}>
            {editingIdx === i ? (
              <ItemForm item={item} onSave={saveItem} onCancel={() => setEditingIdx(null)} />
            ) : (
              <div
                className={`flex items-center gap-2 p-2 rounded-lg border border-slate-200 ${
                  item.depth === 0 ? 'border-slate-400' : ''
                }`}
                style={{ paddingLeft: `${(item.depth + 1) * 12}px` }}
              >
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${DEPTH_COLORS[item.depth]}`}>
                  {DEPTH_LABELS[item.depth]}
                </span>
                <span className="text-xs font-mono text-slate-400 shrink-0">{item.numberPrefix}</span>
                <span className={`flex-1 text-xs truncate ${item.depth === 0 ? 'font-bold text-slate-900 uppercase' : 'text-slate-700'}`}>
                  {item.label || <span className="italic text-slate-400">(sin texto)</span>}
                </span>
                <span className="text-[10px] text-slate-400 shrink-0">{TYPE_LABELS[item.itemType]}</span>
                {item.unit && <span className="text-[10px] text-blue-500 shrink-0">{item.unit}</span>}
                {item.canBeNA && <span className="text-[10px] text-amber-600 shrink-0">N/A</span>}
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => moveItem(i, -1)} disabled={i === 0}
                    className="text-slate-400 hover:text-slate-700 disabled:opacity-20 text-xs px-1">▲</button>
                  <button onClick={() => moveItem(i, 1)} disabled={i === items.length - 1}
                    className="text-slate-400 hover:text-slate-700 disabled:opacity-20 text-xs px-1">▼</button>
                  <button onClick={() => { setAdding(false); setEditingIdx(i); }}
                    className="text-blue-600 text-xs font-bold px-1">Editar</button>
                  <button onClick={() => deleteItem(i)}
                    className="text-red-600 text-xs font-bold px-1">×</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Formulario de nuevo ítem */}
      {adding && (
        <ItemForm item={newItem()} onSave={saveItem} onCancel={() => setAdding(false)} />
      )}

      {items.length === 0 && !adding && (
        <p className="text-xs text-slate-400 text-center py-6 italic">
          Sin ítems — agregá uno o importá desde PDF.
        </p>
      )}

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
