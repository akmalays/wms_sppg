import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { ConfirmationModal, ConfirmVariant } from '../components/common/ConfirmationModal';

export interface ConfirmOptions {
  title: string;
  message?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | undefined>(undefined);

// Pengganti window.confirm: `if (!(await confirm({ title: 'Hapus X?', variant: 'danger' }))) return;`
export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>(opts => {
    // Dialog sebelumnya yang belum dijawab dianggap batal.
    resolveRef.current?.(false);
    setOptions(opts);
    return new Promise<boolean>(resolve => {
      resolveRef.current = resolve;
    });
  }, []);

  const settle = useCallback((ok: boolean) => {
    resolveRef.current?.(ok);
    resolveRef.current = null;
    setOptions(null);
  }, []);

  const handleClose = useCallback(() => settle(false), [settle]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmationModal
        isOpen={options !== null}
        onClose={handleClose}
        onConfirm={() => settle(true)}
        title={options?.title ?? ''}
        message={options?.message ?? ''}
        confirmText={options?.confirmText}
        cancelText={options?.cancelText}
        variant={options?.variant}
      />
    </ConfirmContext.Provider>
  );
};

export const useConfirm = (): ConfirmFn => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider');
  return ctx;
};
