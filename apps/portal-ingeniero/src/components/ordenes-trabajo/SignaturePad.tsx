import { useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';

export interface SignaturePadHandle {
  getDataURL(): string;
  isEmpty(): boolean;
  clear(): void;
}

interface SignaturePadProps {
  disabled?: boolean;
  className?: string;
}

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  ({ disabled = false, className = '' }, ref) => {
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
        return canvasRef.current?.toDataURL('image/png') ?? '';
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
        className={`w-full h-28 border border-slate-300 rounded-xl bg-white touch-none ${
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
