
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
  const savedSignatureRef = useRef<string | null>(initialValue || null); // Guardar firma para restaurar después de scroll

   const finishDrawing = () => {
  if (!isDrawing) return;

  setIsDrawing(false);

  // 👇 CLAVE: si no hubo trazo real, NO hacer nada
  if (!hasSignature) return;

  const canvas = canvasRef.current;
  if (!canvas) return;

  const dataUrl = canvas.toDataURL();
  savedSignatureRef.current = dataUrl; // Guardar firma actual
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

    // Restaurar firma guardada (ya sea initialValue o la firma actual)
    const signatureToRestore = savedSignatureRef.current || initialValue;
    if (signatureToRestore) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        setHasSignature(true);
      };
      img.src = signatureToRestore;
    }
  };

  useImperativeHandle(ref, () => ({
    getSignature: () => {
      // Si hay firma guardada, devolverla; si no, intentar obtenerla del canvas
      if (savedSignatureRef.current) {
        return savedSignatureRef.current;
      }
      if (!hasSignature) return null;
      const canvas = canvasRef.current;
      if (canvas) {
        const dataUrl = canvas.toDataURL('image/png');
        savedSignatureRef.current = dataUrl; // Guardar para futuras referencias
        return dataUrl;
      }
      return null;
    },
    clear: () => {
      const ctx = canvasRef.current?.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
      savedSignatureRef.current = null; // Limpiar firma guardada
      onClear();
      setHasSignature(false);
    }
  }));

  useEffect(() => {
    initCanvas();
    
    // Observar cuando el canvas vuelve al viewport para restaurar la firma
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && savedSignatureRef.current) {
          // Si el canvas vuelve al viewport y tenemos una firma guardada, restaurarla
          const canvas = canvasRef.current;
          if (canvas && savedSignatureRef.current) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              // Reinicializar canvas con las dimensiones correctas
              const dpr = window.devicePixelRatio || 1;
              const rect = canvas.getBoundingClientRect();
              canvas.width = rect.width * dpr;
              canvas.height = rect.height * dpr;
              ctx.scale(dpr, dpr);
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.lineWidth = 2.5;
              ctx.strokeStyle = '#0f172a';
              
              // Restaurar la firma guardada
              const img = new Image();
              img.onload = () => {
                ctx.drawImage(img, 0, 0, rect.width, rect.height);
                setHasSignature(true);
              };
              img.src = savedSignatureRef.current;
            }
          }
        }
      });
    }, { threshold: 0.1 });
    
    const canvas = canvasRef.current;
    if (canvas) {
      observer.observe(canvas);
    }
    
    // Manejar resize de forma que preserve la firma
    const handleResize = () => {
      if (savedSignatureRef.current) {
        initCanvas(); // initCanvas ya restaura savedSignatureRef.current
      } else {
        initCanvas();
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (canvas) {
        observer.unobserve(canvas);
      }
    };
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
    if (!hasSignature) {
      setHasSignature(true);
    }
    // Guardar firma actualizada mientras se dibuja (guardar inmediatamente para evitar pérdida al hacer scroll)
    const canvas = canvasRef.current;
    if (canvas && hasSignature) {
      // Guardar inmediatamente para preservar la firma si el usuario hace scroll
      savedSignatureRef.current = canvas.toDataURL();
    }
  };

const handleUp = () => {
  finishDrawing();
};

  const clear = () => {
    const ctx = canvasRef.current?.getContext('2d');
    ctx?.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
    savedSignatureRef.current = null; // Limpiar firma guardada
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

