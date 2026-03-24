import { useRef, useCallback, useEffect, useState } from 'react';

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

const FONT_SIZES = [
  { label: '10', value: '1' },
  { label: '12', value: '2' },
  { label: '14', value: '3' },
  { label: '16', value: '4' },
  { label: '20', value: '5' },
  { label: '24', value: '6' },
];

type BtnId = 'bold' | 'italic' | 'underline' | 'insertUnorderedList' | 'insertOrderedList';

const TOOLBAR_BUTTONS: { id: BtnId; label: string; title: string; className?: string }[] = [
  { id: 'bold', label: 'B', title: 'Negrita (Ctrl+B)', className: 'font-bold' },
  { id: 'italic', label: 'I', title: 'Cursiva (Ctrl+I)', className: 'italic' },
  { id: 'underline', label: 'U', title: 'Subrayado (Ctrl+U)', className: 'underline' },
  { id: 'insertUnorderedList', label: '• Lista', title: 'Lista con viñetas' },
  { id: 'insertOrderedList', label: '1. Lista', title: 'Lista numerada' },
];

export function RichTextEditor({ value, onChange, placeholder, minHeight = 200 }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());

  // Sync external value into editor only when it actually differs
  useEffect(() => {
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    const el = editorRef.current;
    if (el && el.innerHTML !== value) {
      el.innerHTML = value;
    }
  }, [value]);

  const emitChange = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    isInternalChange.current = true;
    const html = el.innerHTML;
    // Treat empty editor content as empty string
    const cleaned = html === '<br>' || html === '<div><br></div>' ? '' : html;
    onChange(cleaned);
  }, [onChange]);

  const exec = useCallback((command: string, val?: string) => {
    document.execCommand(command, false, val);
    editorRef.current?.focus();
    emitChange();
    updateActiveFormats();
  }, [emitChange]);

  const updateActiveFormats = useCallback(() => {
    const formats = new Set<string>();
    if (document.queryCommandState('bold')) formats.add('bold');
    if (document.queryCommandState('italic')) formats.add('italic');
    if (document.queryCommandState('underline')) formats.add('underline');
    if (document.queryCommandState('insertUnorderedList')) formats.add('insertUnorderedList');
    if (document.queryCommandState('insertOrderedList')) formats.add('insertOrderedList');
    setActiveFormats(formats);
  }, []);

  const handleInput = useCallback(() => {
    emitChange();
    updateActiveFormats();
  }, [emitChange, updateActiveFormats]);

  const handleKeyUp = useCallback(() => {
    updateActiveFormats();
  }, [updateActiveFormats]);

  const handleMouseUp = useCallback(() => {
    updateActiveFormats();
  }, [updateActiveFormats]);

  const showPlaceholder = !value || value === '<br>' || value === '<div><br></div>';

  return (
    <div className="border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-slate-50 border-b border-slate-200 flex-wrap">
        {TOOLBAR_BUTTONS.map(btn => (
          <button
            key={btn.id}
            type="button"
            onMouseDown={e => { e.preventDefault(); exec(btn.id); }}
            title={btn.title}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              activeFormats.has(btn.id)
                ? 'bg-teal-100 text-teal-700'
                : 'text-slate-600 hover:bg-slate-200'
            } ${btn.className ?? ''}`}
          >
            {btn.label}
          </button>
        ))}

        <div className="w-px h-5 bg-slate-300 mx-1" />

        {/* Font size */}
        <select
          onChange={e => { if (e.target.value) exec('fontSize', e.target.value); }}
          onMouseDown={e => e.stopPropagation()}
          className="text-xs border border-slate-300 rounded px-1.5 py-1 bg-white text-slate-600 cursor-pointer"
          defaultValue=""
          title="Tamaño de letra"
        >
          <option value="" disabled>Tamaño</option>
          {FONT_SIZES.map(s => (
            <option key={s.value} value={s.value}>{s.label}px</option>
          ))}
        </select>
      </div>

      {/* Editable area */}
      <div className="relative">
        {showPlaceholder && placeholder && (
          <div className="absolute inset-0 px-3 py-2 text-sm text-slate-400 pointer-events-none select-none">
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyUp={handleKeyUp}
          onMouseUp={handleMouseUp}
          className="px-3 py-2 text-sm leading-relaxed outline-none"
          style={{ minHeight }}
        />
      </div>
    </div>
  );
}
