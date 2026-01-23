
import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';

interface SignaturePadProps {
  label: string;
  onClear: () => void;
  initialValue?: string | null;
  onEnd?: (dataUrl: string) => void; // 👈 NUEVO
}

export interface SignaturePadHandle {
  getSignature: () => string | null;
  clear: () => void;
}

const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(({ label, onClear, initialValue, onEnd }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(!!initialValue);

   const finishDrawing = () => {
  if (!isDrawing) return;

  setIsDrawing(false);

  // 👇 CLAVE: si no hubo trazo real, NO hacer nada
  if (!hasSignature) return;

  const canvas = canvasRef.current;
  if (!canvas) return;

  const dataUrl = canvas.toDataURL();
  onEnd?.(dataUrl);
};
  
  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#0f172a';

    if (initialValue) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = initialValue;
    }
  };

  useImperativeHandle(ref, () => ({
    getSignature: () => {
      if (!hasSignature) return null;
      return canvasRef.current?.toDataURL('image/png') || null;
    },
    clear: () => {
      const ctx = canvasRef.current?.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
      onClear();
      setHasSignature(false);
    }
  }));

  useEffect(() => {
    initCanvas();
    window.addEventListener('resize', initCanvas);
    return () => window.removeEventListener('resize', initCanvas);
  }, []);

  const getPos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleDown = (e: React.PointerEvent) => {
    setIsDrawing(true);
    const pos = getPos(e);
    const ctx = canvasRef.current?.getContext('2d');
    ctx?.beginPath();
    ctx?.moveTo(pos.x, pos.y);
  };

  const handleMove = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    const pos = getPos(e);
    const ctx = canvasRef.current?.getContext('2d');
    ctx?.lineTo(pos.x, pos.y);
    ctx?.stroke();
    if (!hasSignature) setHasSignature(true);
  };

const handleUp = () => {
  finishDrawing();
};

  const clear = () => {
    const ctx = canvasRef.current?.getContext('2d');
    ctx?.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
    onClear();
    setHasSignature(false);
  };

  return (
    <div className="w-full">
      {label && <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">{label}</label>}
      <div className="relative border-2 border-slate-100 rounded-[28px] bg-white overflow-hidden group shadow-inner">
        <canvas 
        ref={canvasRef} 
        onPointerDown={handleDown} 
        onPointerMove={handleMove} 
        onPointerUp={finishDrawing} 
        onPointerLeave={finishDrawing} 
        className="w-full h-[160px] block cursor-crosshair touch-none" 
      />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
           {!hasSignature && !isDrawing && <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Firmar aquí</p>}
        </div>
        <button onClick={clear} className="absolute top-4 right-4 text-[9px] font-black text-slate-300 hover:text-red-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Limpiar</button>
      </div>
      {!hasSignature && <p className="text-[9px] text-orange-500 font-bold uppercase mt-2 italic tracking-tight">REQUERIDO PARA EL REPORTE FINAL</p>}
    </div>
  );
});

export default SignaturePad;

