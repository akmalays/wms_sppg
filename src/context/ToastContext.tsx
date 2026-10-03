import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  showToast: (message: string, type?: ToastType, title?: string, duration?: number) => void;
  success: (message: string, title?: string, duration?: number) => void;
  error: (message: string, title?: string, duration?: number) => void;
  warning: (message: string, title?: string, duration?: number) => void;
  info: (message: string, title?: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', title?: string, duration: number = 4000) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newToast: ToastItem = { id, type, title, message, duration };

      setToasts(prev => [...prev.slice(-4), newToast]); // keep max 5 toasts

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback(
    (message: string, title?: string, duration?: number) => {
      showToast(message, 'success', title, duration);
    },
    [showToast]
  );

  const error = useCallback(
    (message: string, title?: string, duration?: number) => {
      showToast(message, 'error', title, duration);
    },
    [showToast]
  );

  const warning = useCallback(
    (message: string, title?: string, duration?: number) => {
      showToast(message, 'warning', title, duration);
    },
    [showToast]
  );

  const info = useCallback(
    (message: string, title?: string, duration?: number) => {
      showToast(message, 'info', title, duration);
    },
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, success, error, warning, info, removeToast }}>
      {children}
      <ToasterContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
};

// ============================================================================
// Toaster Container & Individual Toast Component
// ============================================================================

const ToasterContainer: React.FC<{ toasts: ToastItem[]; onRemove: (id: string) => void }> = ({
  toasts,
  onRemove,
}) => {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-5 right-5 z-[99999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-3 sm:px-0"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map(toast => (
        <ToastCard key={toast.id} toast={toast} onRemove={() => onRemove(toast.id)} />
      ))}
    </div>
  );
};

const ToastCard: React.FC<{ toast: ToastItem; onRemove: () => void }> = ({ toast, onRemove }) => {
  const styles = {
    success: {
      bg: 'bg-emerald-50 border-emerald-200 text-emerald-950',
      iconBg: 'bg-emerald-100 text-emerald-700',
      progressBar: 'bg-emerald-500',
      Icon: CheckCircle2,
      defaultTitle: 'Berhasil',
    },
    error: {
      bg: 'bg-rose-50 border-rose-200 text-rose-950',
      iconBg: 'bg-rose-100 text-rose-700',
      progressBar: 'bg-rose-500',
      Icon: AlertCircle,
      defaultTitle: 'Terjadi Kesalahan',
    },
    warning: {
      bg: 'bg-amber-50 border-amber-200 text-amber-950',
      iconBg: 'bg-amber-100 text-amber-700',
      progressBar: 'bg-amber-500',
      Icon: AlertTriangle,
      defaultTitle: 'Perhatian',
    },
    info: {
      bg: 'bg-slate-50 border-slate-200 text-slate-900',
      iconBg: 'bg-slate-200 text-slate-700',
      progressBar: 'bg-slate-600',
      Icon: Info,
      defaultTitle: 'Informasi',
    },
  }[toast.type];

  const IconComponent = styles.Icon;

  return (
    <div
      className={`pointer-events-auto w-full rounded-2xl border shadow-xl p-3.5 flex items-start gap-3 relative overflow-hidden transition-all duration-200 animate-in fade-in slide-in-from-top-4 ${styles.bg}`}
      role="alert"
    >
      {/* Icon */}
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${styles.iconBg}`}>
        <IconComponent className="w-4 h-4" />
      </div>

      {/* Message content */}
      <div className="flex-1 min-w-0 pr-2">
        <h4 className="text-xs font-bold leading-tight">
          {toast.title || styles.defaultTitle}
        </h4>
        <p className="text-xs text-slate-600 mt-0.5 leading-relaxed break-words">
          {toast.message}
        </p>
      </div>

      {/* Dismiss button */}
      <button
        type="button"
        onClick={onRemove}
        className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer shrink-0"
        aria-label="Tutup notifikasi"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Progress timer indicator */}
      {toast.duration && toast.duration > 0 && (
        <div
          className={`absolute bottom-0 left-0 right-0 h-0.5 ${styles.progressBar} opacity-40 animate-out`}
          style={{
            animation: `shrink-progress ${toast.duration}ms linear forwards`,
          }}
        />
      )}
    </div>
  );
};
