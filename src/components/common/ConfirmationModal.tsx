import React, { useEffect } from 'react';
import { HelpCircle, AlertTriangle, Trash2, CheckCircle2, Loader2, X } from 'lucide-react';

export type ConfirmVariant = 'primary' | 'danger' | 'warning' | 'info';

export interface ConfirmationItemSummary {
  count?: number;
  totalNominal?: number;
  items?: Array<{
    name: string;
    qty?: string | number;
    unit?: string;
    subtotal?: number;
    category?: string;
    supplier?: string;
  }>;
}

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  icon?: React.ReactNode;
  isLoading?: boolean;
  loadingText?: string;
  itemsSummary?: ConfirmationItemSummary;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText = 'Batal',
  variant = 'primary',
  icon,
  isLoading = false,
  loadingText = 'Memproses...',
  itemsSummary,
}) => {
  // Accessibility: Close on Escape key if not loading
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const config = {
    primary: {
      iconBg: 'bg-emerald-100 text-emerald-700',
      iconBorder: 'ring-emerald-50',
      confirmBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20',
      defaultIcon: <CheckCircle2 className="w-6 h-6" />,
      defaultConfirmText: 'Ya, Lanjutkan',
    },
    danger: {
      iconBg: 'bg-rose-100 text-rose-700',
      iconBorder: 'ring-rose-50',
      confirmBtn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20',
      defaultIcon: <Trash2 className="w-6 h-6" />,
      defaultConfirmText: 'Ya, Hapus',
    },
    warning: {
      iconBg: 'bg-amber-100 text-amber-700',
      iconBorder: 'ring-amber-50',
      confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20',
      defaultIcon: <AlertTriangle className="w-6 h-6" />,
      defaultConfirmText: 'Ya, Lanjutkan',
    },
    info: {
      iconBg: 'bg-blue-100 text-blue-700',
      iconBorder: 'ring-blue-50',
      confirmBtn: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20',
      defaultIcon: <HelpCircle className="w-6 h-6" />,
      defaultConfirmText: 'Konfirmasi',
    },
  }[variant];

  const displayConfirmText = confirmText || config.defaultConfirmText;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header bar with close button */}
        <div className="px-5 pt-4 pb-2 flex items-center justify-end">
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content body */}
        <div className="px-6 pb-6 text-center overflow-y-auto">
          {/* Icon badge */}
          <div
            className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4 ring-8 ${config.iconBg} ${config.iconBorder}`}
          >
            {icon || config.defaultIcon}
          </div>

          {/* Title */}
          <h3 className="text-base font-bold text-slate-900 leading-snug">
            {title}
          </h3>

          {/* Message */}
          <div className="text-xs text-slate-600 mt-1.5 leading-relaxed">
            {message}
          </div>

          {/* Optional items summary box */}
          {itemsSummary && (
            <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs space-y-2">
              <div className="flex justify-between items-center text-slate-700 font-semibold pb-1.5 border-b border-slate-200/80">
                <span>Rincian Barang</span>
                {itemsSummary.count !== undefined && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                    {itemsSummary.count} Item
                  </span>
                )}
              </div>

              {itemsSummary.items && itemsSummary.items.length > 0 && (
                <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 text-[11px]">
                  {itemsSummary.items.map((item, idx) => (
                    <div key={idx} className="py-1.5 flex items-center justify-between">
                      <div className="truncate pr-2">
                        <span className="font-semibold text-slate-800">{item.name}</span>
                        {item.qty && (
                          <span className="text-slate-400 ml-1">
                            ({item.qty} {item.unit || ''})
                          </span>
                        )}
                        {item.supplier && (
                          <span className="block text-[10px] text-slate-400 truncate">
                            {item.supplier}
                          </span>
                        )}
                      </div>
                      {item.subtotal !== undefined && (
                        <span className="font-mono font-bold text-slate-900 shrink-0">
                          Rp {item.subtotal.toLocaleString('id-ID')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {itemsSummary.totalNominal !== undefined && (
                <div className="pt-2 border-t border-slate-200/80 flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Total Estimasi:</span>
                  <span className="font-mono font-bold text-emerald-700 text-sm">
                    Rp {itemsSummary.totalNominal.toLocaleString('id-ID')}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              disabled={isLoading}
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={onConfirm}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${config.confirmBtn}`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{loadingText}</span>
                </>
              ) : (
                <span>{displayConfirmText}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
