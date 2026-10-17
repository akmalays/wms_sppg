import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

export const FIELD_INPUT =
  'w-full px-2.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-xs text-slate-900 disabled:bg-slate-100 disabled:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600';
export const FIELD_LABEL = 'block text-xs font-medium text-slate-700 mb-1';
export const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1';
export const BTN_PRIMARY = `inline-flex items-center justify-center gap-1.5 px-4 min-h-[44px] sm:min-h-[34px] rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-semibold cursor-pointer ${FOCUS_RING}`;
export const BTN_SECONDARY = `inline-flex whitespace-nowrap items-center justify-center gap-1.5 px-3 min-h-[44px] sm:min-h-[32px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-medium cursor-pointer ${FOCUS_RING}`;

interface FormDialogProps {
  title: string;
  description?: React.ReactNode;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  submitLabel: string;
  submitDisabled?: boolean;
  error?: string;
  children: React.ReactNode;
}

// Dialog formulir: tertutup dengan Escape, fokus ke isian pertama, muncul dari bawah di ponsel.
export const FormDialog: React.FC<FormDialogProps> = ({
  title,
  description,
  onClose,
  onSubmit,
  submitLabel,
  submitDisabled,
  error,
  children,
}) => {
  const titleId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Sekali saat dibuka; onClose lewat ref agar fokus tidak melompat setiap render.
  useEffect(() => {
    bodyRef.current?.querySelector<HTMLElement>('input:not([disabled]), select, textarea')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white w-full sm:max-w-md max-h-[92vh] flex flex-col rounded-t-xl sm:rounded-xl border border-slate-200 overflow-hidden"
      >
        <div className="px-4 sm:px-5 py-3 border-b border-slate-200 flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-sm font-semibold text-slate-900">
              {title}
            </h2>
            {description && <div className="text-[11px] text-slate-600 mt-0.5">{description}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className={`p-2 -m-1 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer ${FOCUS_RING}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex-1 flex flex-col min-h-0">
          <div ref={bodyRef} className="px-4 sm:px-5 py-4 overflow-y-auto flex-1 space-y-3">
            {error && (
              <p role="alert" className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900">
                {error}
              </p>
            )}
            {children}
          </div>
          <div className="px-4 sm:px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
            <button type="button" onClick={onClose} className={`${BTN_SECONDARY} flex-1 sm:flex-none border-transparent bg-transparent hover:bg-slate-200/70`}>
              Batal
            </button>
            <button type="submit" disabled={submitDisabled} className={`${BTN_PRIMARY} flex-1 sm:flex-none`}>
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const Feedback: React.FC<{ type: 'success' | 'error'; text: string; onClose: () => void }> = ({ type, text, onClose }) => (
  <div
    role="status"
    className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs ${
      type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
    }`}
  >
    <span className="flex-1">{text}</span>
    <button type="button" onClick={onClose} aria-label="Tutup pesan" className={`-m-1 p-1 rounded cursor-pointer ${FOCUS_RING}`}>
      <X className="w-4 h-4" />
    </button>
  </div>
);
