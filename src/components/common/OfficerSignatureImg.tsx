import React, { useEffect, useState } from 'react';
import { APP_SETTINGS_CHANGED_EVENT, SignerRole, warehouseDb } from '../../db/storage';
import { docSignatureOn, setDocSignatureOn, SIGNER_ROLES, signerSignature, SignatureDoc } from '../../utils/documentSigners';

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

// Dua kata pertama cukup: penulisan gelar dan nama belakang sering berbeda antar dokumen ("Ramdhan, S.Pd" / "Ramadhan, S.Pd.").
const sameName = (a: string, b: string) => {
  const head = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').slice(0, 2).join(' ');
  return head(a) !== '' && head(a) === head(b);
};

// Gambar tanda tangan petugas di dokumen cetak. Tidak dirender bila centang dokumen itu dilepas.
// `forName`: nama yang tercetak di bawahnya bila bisa berbeda dari penanda tangan saat ini (penyetuju
// tersimpan di dokumen, nama yang diketik ulang); tanda tangan hanya muncul bila namanya sama.
export const OfficerSignatureImg: React.FC<{
  doc?: SignatureDoc;
  officer: SignerRole;
  className?: string;
  defaultVariant?: string;
  forName?: string;
}> = ({ doc, officer, className = 'h-20', defaultVariant, forName }) => {
  const [on] = useDocSignature(doc);
  const nameMatches = forName === undefined || sameName(forName, warehouseDb.getSignerName(officer));
  const src = on && nameMatches ? signerSignature(officer, defaultVariant) : undefined;
  if (!src) return null;
  return <img src={src} alt={`Tanda tangan ${SIGNER_ROLES.find(r => r.role === officer)?.title || officer}`} className={`${className} w-auto object-contain`} />;
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
