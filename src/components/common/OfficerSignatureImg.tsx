import React, { useEffect, useState } from 'react';
import { APP_SETTINGS_CHANGED_EVENT } from '../../db/storage';
import { docSignatureOn, officerSignature, setDocSignatureOn, SignatureDoc, SignatureKey } from '../../utils/officerSignatures';

const OFFICER_LABEL: Record<SignatureKey, string> = {
  headSignature: 'Kepala SPPG',
  nutritionistSignature: 'Ahli Gizi SPPG',
  fieldAssistantSignature: 'Asisten Lapangan',
};

// Semua gambar dan centang dari dokumen yang sama ikut berubah saat centangnya diubah.
// Tanpa doc = dokumen itu punya centang sendiri (slip gaji, serah terima PIC), jadi selalu tampil.
const useDocSignature = (doc?: SignatureDoc): [boolean, (on: boolean) => void] => {
  const [on, setOn] = useState(() => !doc || docSignatureOn(doc));
  useEffect(() => {
    if (!doc) return;
    const sync = () => setOn(docSignatureOn(doc));
    window.addEventListener(APP_SETTINGS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(APP_SETTINGS_CHANGED_EVENT, sync);
  }, [doc]);
  return [on, value => doc && setDocSignatureOn(doc, value)];
};

// Gambar tanda tangan petugas di dokumen cetak. Tidak dirender bila centang dokumen itu dilepas.
export const OfficerSignatureImg: React.FC<{
  doc?: SignatureDoc;
  officer: SignatureKey;
  className?: string;
  defaultVariant?: string;
}> = ({ doc, officer, className = 'h-20', defaultVariant }) => {
  const [on] = useDocSignature(doc);
  const src = on ? officerSignature(officer, defaultVariant) : undefined;
  if (!src) return null;
  return <img src={src} alt={`Tanda tangan ${OFFICER_LABEL[officer]}`} className={`${className} w-auto object-contain`} />;
};

// Centang di layar (tidak ikut tercetak) untuk memasang atau melepas tanda tangan di satu jenis dokumen.
export const DocSignatureToggle: React.FC<{ doc: SignatureDoc; className?: string }> = ({ doc, className = '' }) => {
  const [on, setOn] = useDocSignature(doc);
  return (
    <label className={`no-print print:hidden inline-flex min-h-[36px] items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer ${className}`}>
      <input
        type="checkbox"
        checked={on}
        onChange={e => setOn(e.target.checked)}
        className="w-4 h-4 rounded border-slate-300 text-emerald-700 cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-600"
      />
      Tanda tangan tercetak
      <span className="font-normal text-slate-500">(lepas bila diminta tanda tangan basah)</span>
    </label>
  );
};
