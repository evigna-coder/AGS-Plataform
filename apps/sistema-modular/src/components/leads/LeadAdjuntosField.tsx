import { LEAD_MAX_ADJUNTOS } from '@ags/shared';

const labelClass = 'text-[11px] font-medium text-slate-400 mb-1 block';

interface Props {
  pendingFiles: File[];
  fileRef: React.RefObject<HTMLInputElement>;
  onFileChange: (files: FileList | null) => void;
  onRemove: (idx: number) => void;
}

export const LeadAdjuntosField: React.FC<Props> = ({ pendingFiles, fileRef, onFileChange, onRemove }) => (
  <div>
    <label className={labelClass}>Adjuntos ({pendingFiles.length}/{LEAD_MAX_ADJUNTOS})</label>
    <input ref={fileRef} type="file" className="hidden" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
      onChange={e => onFileChange(e.target.files)} />
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => fileRef.current?.click()}
        disabled={pendingFiles.length >= LEAD_MAX_ADJUNTOS}
        className="text-xs text-teal-600 hover:text-teal-800 font-medium disabled:text-slate-400 disabled:cursor-not-allowed">
        + Seleccionar archivos
      </button>
      {pendingFiles.length > 0 && (
        <span className="text-[10px] text-slate-400">{pendingFiles.length} archivo(s) seleccionado(s)</span>
      )}
    </div>
    {pendingFiles.length > 0 && (
      <div className="mt-1.5 space-y-1">
        {pendingFiles.map((f, i) => (
          <div key={`${f.name}-${i}`} className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 rounded px-2 py-1">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${f.type.startsWith('image/') ? 'bg-green-400' : 'bg-blue-400'}`} />
            <span className="truncate flex-1">{f.name}</span>
            <button type="button" onClick={() => onRemove(i)}
              className="text-red-400 hover:text-red-600 shrink-0">&times;</button>
          </div>
        ))}
      </div>
    )}
  </div>
);
