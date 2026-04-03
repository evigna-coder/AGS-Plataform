import { useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';

/** Recorta el espacio en blanco alrededor de los trazos del canvas */
function trimCanvas(canvas: HTMLCanvasElement, padding = 10): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const { width, height } = canvas;
  const imgData = ctx.getImageData(0, 0, width, height).data;
  let top = height, left = width, bottom = 0, right = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = imgData[(y * width + x) * 4 + 3];
      if (alpha > 0) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  if (bottom <= top || right <= left) return canvas; // vacío
  top = Math.max(0, top - padding);
  left = Math.max(0, left - padding);
  bottom = Math.min(height - 1, bottom + padding);
  right = Math.min(width - 1, right + padding);
  const trimW = right - left + 1;
  const trimH = bottom - top + 1;
  const trimmed = document.createElement('canvas');
  trimmed.width = trimW;
  trimmed.height = trimH;
  const tCtx = trimmed.getContext('2d');
  if (!tCtx) return canvas;
  tCtx.drawImage(canvas, left, top, trimW, trimH, 0, 0, trimW, trimH);
  return trimmed;
}

export interface SignaturePadHandle {
  getDataURL(): string;
  isEmpty(): boolean;
  clear(): void;
}

interface SignaturePadProps {
  disabled?: boolean;
  className?: string;
  /** Clase de altura Tailwind. Default: 'h-40' */
  height?: string;
}

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  ({ disabled = false, className = '', height = 'h-40' }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const empty = useRef(true);

    const getCtx = () => canvasRef.current?.getContext('2d') ?? null;

    const resize = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      const ctx = getCtx();
      if (ctx) {
        ctx.scale(ratio, ratio);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
      empty.current = true;
    }, []);

    useEffect(() => {
      resize();
      window.addEventListener('resize', resize);
      return () => window.removeEventListener('resize', resize);
    }, [resize]);

    useImperativeHandle(ref, () => ({
      getDataURL() {
        const canvas = canvasRef.current;
        if (!canvas) return '';
        return trimCanvas(canvas).toDataURL('image/png');
      },
      isEmpty() { return empty.current; },
      clear() {
        const canvas = canvasRef.current;
        const ctx = getCtx();
        if (canvas && ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          empty.current = true;
        }
      },
    }));

    const pos = (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      if ('touches' in e) {
        return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
      }
      return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
    };

    const start = (e: React.MouseEvent | React.TouchEvent) => {
      if (disabled) return;
      e.preventDefault();
      drawing.current = true;
      empty.current = false;
      const ctx = getCtx();
      if (ctx) { const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
    };

    const move = (e: React.MouseEvent | React.TouchEvent) => {
      if (!drawing.current || disabled) return;
      e.preventDefault();
      const ctx = getCtx();
      if (ctx) { const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); }
    };

    const end = () => { drawing.current = false; };

    return (
      <canvas
        ref={canvasRef}
        className={`w-full ${height} border border-slate-300 rounded-xl bg-white touch-none ${
          disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-crosshair'
        } ${className}`}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
    );
  },
);

SignaturePad.displayName = 'SignaturePad';
