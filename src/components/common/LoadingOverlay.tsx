import React from 'react';
import { Loader2 } from 'lucide-react';

export interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  submessage?: string;
  backdrop?: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isLoading,
  message = 'Memproses data...',
  submessage,
  backdrop = true,
}) => {
  if (!isLoading) return null;

  return (
    <div
      className={`fixed inset-0 z-[99999] flex items-center justify-center p-4 transition-all duration-200 animate-in fade-in ${
        backdrop ? 'bg-slate-900/60 backdrop-blur-xs' : 'bg-transparent'
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-sm w-full text-center flex flex-col items-center animate-in zoom-in-95 duration-150">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3.5 ring-8 ring-emerald-50/50">
          <Loader2 className="w-7 h-7 animate-spin" />
        </div>
        <h4 className="text-sm font-bold text-slate-900 leading-snug">
          {message}
        </h4>
        {submessage && (
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            {submessage}
          </p>
        )}
        <div className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
          <span>Mohon tunggu sebentar...</span>
        </div>
      </div>
    </div>
  );
};
