import React, { useEffect, useMemo, useRef, useState } from 'react';
import { warehouseDb, APP_SETTINGS_CHANGED_EVENT, DEFAULT_SIGNER_NAMES, DocumentSigners, SignerRole } from '../db/storage';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Select } from './common/Select';
import { SignatureField } from './common/SignatureField';
import { BTN_PRIMARY, BTN_SECONDARY, FIELD_LABEL, FOCUS_RING } from './common/FormDialog';
import { SIGNER_ROLES, defaultSignatureFor } from '../utils/documentSigners';

// Dokumen yang mencetak nama/tanda tangan tiap jabatan, supaya jelas apa saja yang ikut berubah.
const USED_IN: Record<SignerRole, string[]> = {
  KEPALA_SPPG: [
    'Nota PO', 'PO harian', 'Purchase Request', 'Rekap porsi', 'Opname stok', 'Pengeluaran harian', 'Absensi',
    'Laporan tugas', 'Permintaan bahan', 'Bukti belanja', 'Serah terima dana PIC', 'Rekap slip gaji',
    'Surat jalan & berita acara',
  ],
  AHLI_GIZI: ['Surat jalan'],
  ASLAP: ['PO harian', 'Rekap porsi', 'Log limbah', 'Rekap limbah', 'SOP gudang', 'Surat jalan'],
  AKUNTAN: [
    'Purchase Request', 'Opname stok', 'Pengeluaran harian', 'Log limbah', 'Rekap limbah', 'SOP gudang',
    'Serah terima dana PIC', 'Slip gaji', 'Kuitansi',
  ],
  KOORDINATOR: ['Absensi'],
};

export const DocumentSignersModule: React.FC = () => {
  const { currentUser, can } = useAuth();
  const toast = useToast();
  const canEdit = can('MANAGE_USERS');
  const [saved, setSaved] = useState<DocumentSigners>(() => warehouseDb.getDocumentSigners());
  const [draft, setDraft] = useState<DocumentSigners>(saved);
  const [dataVersion, setDataVersion] = useState(0);
  const isDirty = JSON.stringify(draft) !== JSON.stringify(saved);

  // Data dari cloud/perangkat lain: isian yang sedang diubah dibiarkan, yang belum diubah ikut diperbarui.
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;
  useEffect(() => {
    const reload = () => {
      const next = warehouseDb.getDocumentSigners();
      setSaved(next);
      if (!isDirtyRef.current) setDraft(next);
      setDataVersion(v => v + 1);
    };
    window.addEventListener(APP_SETTINGS_CHANGED_EVENT, reload);
    window.addEventListener('sppg_warehouse_sync', reload);
    return () => {
      window.removeEventListener(APP_SETTINGS_CHANGED_EVENT, reload);
      window.removeEventListener('sppg_warehouse_sync', reload);
    };
  }, []);

  const activeEmployees = useMemo(
    () => warehouseDb.getEmployees().filter(e => e.status === 'AKTIF').sort((a, b) => a.name.localeCompare(b.name, 'id')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dataVersion]
  );

  const update = (role: SignerRole, patch: { name?: string; signature?: string }) =>
    setDraft(prev => {
      const entry = { ...prev[role], ...patch };
      if (!entry.name) delete entry.name;
      return { ...prev, [role]: entry };
    });

  const handleSave = () => {
    warehouseDb.saveDocumentSigners(draft, currentUser || undefined);
    setSaved(draft);
    toast.success('Nama dan tanda tangan dipakai di dokumen cetak berikutnya.', 'Penanda tangan disimpan');
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Penanda Tangan</h1>
          <p className="text-xs text-slate-600 mt-0.5 max-w-2xl">
            Nama dan tanda tangan di sini dipakai semua dokumen cetak. Apakah tanda tangan dicetak diatur di masing-masing
            dokumen lewat centang "Tanda tangan tercetak".
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2 shrink-0">
            {isDirty && (
              <button type="button" onClick={() => setDraft(saved)} className={BTN_SECONDARY}>
                Batalkan perubahan
              </button>
            )}
            <button type="button" onClick={handleSave} disabled={!isDirty} className={`${BTN_PRIMARY} disabled:opacity-50 disabled:cursor-not-allowed`}>
              Simpan
            </button>
          </div>
        )}
      </div>

      {!canEdit && (
        <p role="note" className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-700">
          Hanya Superadmin dan Kepala SPPG yang bisa mengubah penanda tangan.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {SIGNER_ROLES.map(({ role, title }) => {
          const entry = draft[role] || {};
          const employeeName = warehouseDb.getSignerNameFromEmployees(role);
          const effectiveName = entry.name || employeeName || DEFAULT_SIGNER_NAMES[role] || '';
          const defaultSig = defaultSignatureFor(role, effectiveName);
          const signature = entry.signature !== undefined ? entry.signature : defaultSig;
          const isCustomName = !!entry.name && !activeEmployees.some(e => e.name === entry.name);
          const used = USED_IN[role];
          return (
            <section key={role} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <h2 className="text-sm font-bold text-slate-900">{title}</h2>

              <div>
                <label htmlFor={`signer-${role}`} className={FIELD_LABEL}>Nama</label>
                <Select
                  id={`signer-${role}`}
                  className="w-full"
                  value={entry.name || ''}
                  disabled={!canEdit}
                  onChange={e => update(role, { name: e.target.value })}
                >
                  <option value="">
                    {employeeName ? `Ikuti data Karyawan: ${employeeName}` : `Belum ada di data Karyawan: ${effectiveName || 'kosong'}`}
                  </option>
                  {isCustomName && <option value={entry.name}>{entry.name}</option>}
                  {activeEmployees.map(e => (
                    <option key={e.id} value={e.name}>{e.name} ({e.position})</option>
                  ))}
                </Select>
              </div>

              <div>
                <p className={FIELD_LABEL}>Tanda tangan</p>
                {canEdit ? (
                  <SignatureField role={title} value={signature} onChange={v => update(role, { signature: v })} />
                ) : (
                  <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
                    {signature ? (
                      <img src={signature} alt={`Tanda tangan ${title}`} className="h-20 max-w-full object-contain" />
                    ) : (
                      <span className="text-[11px] text-slate-500">Belum ada tanda tangan.</span>
                    )}
                  </div>
                )}
                {entry.signature === undefined && defaultSig && (
                  <p className="mt-1 text-[11px] text-slate-500">Tanda tangan bawaan {effectiveName}.</p>
                )}
                {canEdit && entry.signature !== undefined && defaultSig && (
                  <button
                    type="button"
                    onClick={() => setDraft(prev => ({ ...prev, [role]: { ...prev[role], signature: undefined } }))}
                    className={`mt-1 min-h-[32px] text-[11px] font-semibold text-emerald-800 hover:underline cursor-pointer rounded-md ${FOCUS_RING}`}
                  >
                    Pakai tanda tangan bawaan {effectiveName}
                  </button>
                )}
              </div>

              <p className="text-[11px] text-slate-600">
                <span className="font-semibold text-slate-700">Dipakai di:</span> {used.join(', ')}.
              </p>
            </section>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-500">
        Gambar paling rapi dari foto tanda tangan di kertas putih (PNG latar transparan lebih baik), maks. 500 KB.
      </p>
    </div>
  );
};
