import { useRef, useEffect, useCallback } from 'react';
import { useSpeechToText } from '../../hooks/useSpeechToText';

interface VoiceTextareaProps {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function VoiceTextarea({ value, onChange, rows = 3, placeholder, className, autoFocus }: VoiceTextareaProps) {
  const baseTextRef = useRef(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { isListening, isSupported, toggle } = useSpeechToText({
    onResult: (transcript) => {
      const separator = baseTextRef.current && !baseTextRef.current.endsWith(' ') ? ' ' : '';
      onChange(baseTextRef.current + separator + transcript);
    },
  });

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => { autoResize(); }, [value, autoResize]);

  useEffect(() => {
    if (!isListening) {
      baseTextRef.current = value;
    }
  }, [isListening, value]);

  const defaultClass = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none';

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => { onChange(e.target.value); if (!isListening) baseTextRef.current = e.target.value; }}
        rows={rows}
        placeholder={placeholder}
        className={`${className || defaultClass} ${isListening ? 'ring-2 ring-red-400 border-red-300' : ''}`}
        style={{ paddingRight: isSupported ? '2.75rem' : undefined, overflow: 'hidden' }}
        autoFocus={autoFocus}
      />
      {isSupported && (
        <button
          type="button"
          onClick={toggle}
          title={isListening ? 'Detener grabación' : 'Dictar con voz'}
          className={`absolute right-2 top-2 w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
            isListening
              ? 'bg-red-500 text-white animate-pulse'
              : 'bg-slate-100 text-slate-500 hover:bg-teal-100 hover:text-teal-700'
          }`}
        >
          {isListening ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" />
              <path d="M19 11a1 1 0 0 0-2 0 5 5 0 0 1-10 0 1 1 0 0 0-2 0 7 7 0 0 0 6 6.93V21h-3a1 1 0 0 0 0 2h8a1 1 0 0 0 0-2h-3v-3.07A7 7 0 0 0 19 11z" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
