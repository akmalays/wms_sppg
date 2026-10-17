import React, { useEffect, useId, useRef } from 'react';
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

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1';
const BTN_BASE = `inline-flex items-center justify-center gap-1.5 px-4 min-h-[44px] sm:min-h-[34px] rounded-lg text-xs font-semibold cursor-pointer disabled:cursor-not-allowed ${FOCUS_RING}`;

const VARIANTS: Record<ConfirmVariant, { icon: string; button: string; defaultIcon: React.ReactNode; defaultConfirmText: string }> = {
  primary: {
    icon: 'bg-emerald-50 text-emerald-700',
    button: 'bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white',
    defaultIcon: <CheckCircle2 className="w-4 h-4" />,
    defaultConfirmText: 'Ya, lanjutkan',
  },
  danger: {
    icon: 'bg-rose-50 text-rose-700',
    button: 'bg-rose-700 hover:bg-rose-800 disabled:bg-slate-300 text-white',
    defaultIcon: <Trash2 className="w-4 h-4" />,
    defaultConfirmText: 'Ya, hapus',
  },
  warning: {
    icon: 'bg-amber-50 text-amber-700',
    button: 'bg-amber-700 hover:bg-amber-800 disabled:bg-slate-300 text-white',
    defaultIcon: <AlertTriangle className="w-4 h-4" />,
    defaultConfirmText: 'Ya, lanjutkan',
  },
  info: {
    icon: 'bg-slate-100 text-slate-700',
    button: 'bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white',
    defaultIcon: <HelpCircle className="w-4 h-4" />,
    defaultConfirmText: 'Konfirmasi',
  },
};

// Dialog konfirmasi standar. Bentuknya sama dengan FormDialog: kartu rounded-xl,
// muncul dari bawah di ponsel, tombol di footer. Untuk aksi berbahaya, fokus awal di tombol Batal.
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
  const titleId = useId();
  const messageId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    (variant === 'danger' ? cancelRef : confirmRef).current?.focus();
  }, [isOpen, variant]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        e.stopPropagation();
        onClose();
      }
    };
    // Capture: Escape menutup konfirmasi dulu, bukan modal di belakangnya.
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const v = VARIANTS[variant];

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        className="bg-white w-full sm:max-w-md max-h-[92vh] flex flex-col rounded-t-xl sm:rounded-xl border border-slate-200 overflow-hidden"
      >
        <div className="px-4 sm:px-5 pt-4 pb-3 flex items-start gap-3 overflow-y-auto">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${v.icon}`} aria-hidden="true">
            {icon || v.defaultIcon}
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <h2 id={titleId} className="text-sm font-semibold text-slate-900">
              {title}
            </h2>
            <div id={messageId} className="text-xs text-slate-600 mt-1 leading-relaxed whitespace-pre-line">
              {message}
            </div>

            {itemsSummary && (
              <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between items-center text-slate-700 font-semibold pb-1.5 border-b border-slate-200">
                  <span>Rincian barang</span>
                  {itemsSummary.count !== undefined && (
                    <span className="text-[11px] px-1.5 rounded-md bg-slate-200 text-slate-700">
                      {itemsSummary.count} item
                    </span>
                  )}
                </div>

                {itemsSummary.items && itemsSummary.items.length > 0 && (
                  <div className="max-h-36 overflow-y-auto divide-y divide-slate-200 text-[11px]">
                    {itemsSummary.items.map((item, idx) => (
                      <div key={idx} className="py-1.5 flex items-center justify-between">
                        <div className="truncate pr-2">
                          <span className="font-semibold text-slate-800">{item.name}</span>
                          {item.qty && (
                            <span className="text-slate-600 ml-1">
                              ({item.qty} {item.unit || ''})
                            </span>
                          )}
                          {item.supplier && (
                            <span className="block text-[10px] text-slate-600 truncate">{item.supplier}</span>
                          )}
                        </div>
                        {item.subtotal !== undefined && (
                          <span className="font-mono font-semibold text-slate-900 shrink-0 tabular-nums">
                            Rp {item.subtotal.toLocaleString('id-ID')}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {itemsSummary.totalNominal !== undefined && (
                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                    <span className="text-slate-600 font-medium">Total estimasi</span>
                    <span className="font-mono font-bold text-slate-900 text-sm tabular-nums">
                      Rp {itemsSummary.totalNominal.toLocaleString('id-ID')}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            aria-label="Tutup"
            className={`p-2 -m-1 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer disabled:opacity-40 ${FOCUS_RING}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 sm:px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className={`${BTN_BASE} flex-1 sm:flex-none text-slate-800 hover:bg-slate-200/70 disabled:opacity-50`}
          >
            {cancelText}
          </button>
          <button
            ref={confirmRef}
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className={`${BTN_BASE} flex-1 sm:flex-none ${v.button}`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {loadingText}
              </>
            ) : (
              confirmText || v.defaultConfirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
