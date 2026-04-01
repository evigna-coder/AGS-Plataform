
import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef, useCallback } from 'react';

interface SignaturePadProps {
  label: string;
  onClear: () => void;
  initialValue?: string | null;
  onEnd?: (dataUrl: string) => void;
}

export interface SignaturePadHandle {
  getSignature: () => string | null;
  clear: () => void;
}

const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(({ label, onClear, initialValue, onEnd }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Usar refs para estado de dibujo (evita re-renders que causan layout shifts)
  const drawingRef = useRef(false);
  const hasDrawnRef = useRef(!!initialValue);
  // State solo para UI que necesita re-render
  const [hasSignature, setHasSignature] = useState(!!initialValue);
  const savedSignatureRef = useRef<string | null>(initialValue || null);
  // Guard: prevenir que el IntersectionObserver interfiera durante/después del dibujo
  const skipObserverUntilRef = useRef(0);

  const setupCtx = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#0f172a';
    return ctx;
  }, []);

  const restoreSignature = useCallback((canvas: HTMLCanvasElement, dataUrl: string) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, rect.width, rect.height);
    };
    img.src = dataUrl;
  }, []);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setupCtx(canvas);
    const signatureToRestore = savedSignatureRef.current || initialValue;
    if (signatureToRestore) {
      restoreSignature(canvas, signatureToRestore);
      hasDrawnRef.current = true;
      setHasSignature(true);
    }
  }, [initialValue, setupCtx, restoreSignature]);

  useImperativeHandle(ref, () => ({
    getSignature: () => {
      if (!hasDrawnRef.current) return null;
      const canvas = canvasRef.current;
      if (canvas) return canvas.toDataURL('image/png');
      return savedSignatureRef.current;
    },
    clear: () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
      savedSignatureRef.current = null;
      hasDrawnRef.current = false;
      setHasSignature(false);
      onClear();
    }
  }));

  useEffect(() => {
    initCanvas();

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        // No restaurar si estamos dibujando o acabamos de terminar
        if (Date.now() < skipObserverUntilRef.current) return;
        if (drawingRef.current) return;
        if (entry.isIntersecting && savedSignatureRef.current) {
          const canvas = canvasRef.current;
          if (!canvas) return;
          setupCtx(canvas);
          restoreSignature(canvas, savedSignatureRef.current);
        }
      });
    }, { threshold: 0.1 });

    const canvas = canvasRef.current;
    if (canvas) {
      observer.observe(canvas);
    }

    // Prevenir zoom del navegador en el área de firma
    const preventZoom = (e: TouchEvent) => { e.preventDefault(); };
    if (canvas) {
      canvas.addEventListener('touchstart', preventZoom, { passive: false });
      canvas.addEventListener('touchmove', preventZoom, { passive: false });
    }

    const handleResize = () => initCanvas();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (canvas) {
        observer.unobserve(canvas);
        canvas.removeEventListener('touchstart', preventZoom);
        canvas.removeEventListener('touchmove', preventZoom);
      }
    };
  }, [initCanvas, setupCtx, restoreSignature]);

  const getPos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleDown = (e: React.PointerEvent) => {
    e.preventDefault();
    skipObserverUntilRef.current = Date.now() + 4000;
    drawingRef.current = true;
    const pos = getPos(e);
    const ctx = canvasRef.current?.getContext('2d');
    ctx?.beginPath();
    ctx?.moveTo(pos.x, pos.y);
  };

  const handleMove = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const pos = getPos(e);
    const ctx = canvasRef.current?.getContext('2d');
    ctx?.lineTo(pos.x, pos.y);
    ctx?.stroke();
    if (!hasDrawnRef.current) {
      hasDrawnRef.current = true;
      setHasSignature(true);
    }
  };

  const finishDrawing = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    skipObserverUntilRef.current = Date.now() + 2000;

    if (!hasDrawnRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    savedSignatureRef.current = canvas.toDataURL('image/png');
    onEnd?.(canvas.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    savedSignatureRef.current = null;
    hasDrawnRef.current = false;
    setHasSignature(false);
    onClear();
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        {label && <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>}
        {hasSignature && (
          <button onClick={clear} className="text-[9px] font-black text-red-400 hover:text-red-600 uppercase tracking-widest transition-colors px-2 py-1">
            Limpiar firma
          </button>
        )}
      </div>
      <div className="relative border-2 border-slate-100 rounded-[28px] bg-white overflow-hidden shadow-inner touch-none">
        <canvas
          ref={canvasRef}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={finishDrawing}
          onPointerLeave={finishDrawing}
          className="w-full h-[160px] block cursor-crosshair touch-none"
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Firmar aquí</p>
          </div>
        )}
      </div>
      {!hasSignature && <p className="text-[9px] text-orange-500 font-bold uppercase mt-2 italic tracking-tight">REQUERIDO PARA EL REPORTE FINAL</p>}
    </div>
  );
});

export default SignaturePad;
