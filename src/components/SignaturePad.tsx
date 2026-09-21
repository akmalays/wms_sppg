import React, { useRef, useState, useEffect } from 'react';
import { Eraser, Check, PenTool } from 'lucide-react';

interface SignaturePadProps {
  label: string;
  signatoryName: string;
  initialValue?: string;
  onSave: (signatureData: string) => void;
  readOnly?: boolean;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  label,
  signatoryName,
  initialValue,
  onSave,
  readOnly = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [savedValue, setSavedValue] = useState<string>(initialValue || '');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set display vs pixel resolution
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;

    if (initialValue && initialValue.startsWith('data:image')) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        setHasDrawn(true);
      };
      img.src = initialValue;
    }
  }, [initialValue]);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (readOnly) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || readOnly) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing || readOnly) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setSavedValue(dataUrl);
    onSave(dataUrl);
  };

  const clearSignature = () => {
    if (readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    setSavedValue('');
    onSave('');
  };

  const handleQuickConfirm = () => {
    const timestamp = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const textSignature = `TERVERIFIKASI: ${signatoryName} (${timestamp})`;
    setSavedValue(textSignature);
    onSave(textSignature);
  };

  return (
    <div className="flex flex-col border border-slate-200 rounded-lg p-3 bg-white">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <PenTool className="w-3.5 h-3.5 text-emerald-600" />
          <span>{label}</span>
        </div>
        <span className="text-[11px] text-slate-500 font-medium truncate max-w-[140px]">
          {signatoryName || 'Belum dipilih'}
        </span>
      </div>

      {savedValue && !savedValue.startsWith('data:image') ? (
        <div className="h-28 flex flex-col items-center justify-center bg-emerald-50/70 border border-emerald-200 border-dashed rounded text-center p-2">
          <Check className="w-6 h-6 text-emerald-600 mb-1" />
          <p className="text-xs font-semibold text-emerald-900">{savedValue}</p>
          <p className="text-[10px] text-emerald-700 mt-0.5">Tanda tangan elektronik terkonfirmasi</p>
          {!readOnly && (
            <button
              type="button"
              onClick={clearSignature}
              className="mt-2 text-[11px] text-rose-600 hover:text-rose-700 underline font-medium"
            >
              Ganti Tanda Tangan
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className={`w-full h-28 border border-slate-200 rounded bg-slate-50/50 touch-none ${
              readOnly ? 'cursor-not-allowed opacity-80' : 'cursor-crosshair'
            }`}
          />
          {!hasDrawn && !readOnly && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-400 text-xs italic">
              Tanda tangan di area ini (Touch / Mouse)
            </div>
          )}
        </div>
      )}

      {!readOnly && !savedValue.startsWith('TERVERIFIKASI') && (
        <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100">
          <button
            type="button"
            onClick={clearSignature}
            disabled={!hasDrawn}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-rose-600 disabled:opacity-40 disabled:hover:text-slate-500 transition-colors"
          >
            <Eraser className="w-3 h-3" />
            Hapus
          </button>
          <button
            type="button"
            onClick={handleQuickConfirm}
            className="text-[11px] font-medium text-emerald-700 hover:text-emerald-800 hover:underline"
          >
            Gunakan Verifikasi Nama Cepat
          </button>
        </div>
      )}
    </div>
  );
};
