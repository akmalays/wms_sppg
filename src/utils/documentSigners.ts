// Versi rapat: goresan sama dengan 'ttd rizky.png' tanpa ruang kosong di sekelilingnya, jadi tercetak lebih besar.
import ttdRizkyImg from '../assets/ttd rizky rapat.png';
import ttdEnoImg from '../assets/ttd eno.png';
import ttdToniImg from '../assets/ttd toni.png';
import ttdAlfianaImg from '../assets/ttd alfiana.png';
import { warehouseDb, SignerRole } from '../db/storage';

// Nama & tanda tangan penanda tangan diatur di Data > Penanda Tangan dan dipakai semua dokumen cetak.
export const SIGNER_ROLES: { role: SignerRole; title: string }[] = [
  { role: 'KEPALA_SPPG', title: 'Kepala SPPG Malang Tumpang Jeru' },
  { role: 'AHLI_GIZI', title: 'Ahli Gizi SPPG Malang Tumpang Jeru' },
  { role: 'ASLAP', title: 'Asisten Lapangan SPPG Malang Tumpang Jeru' },
  { role: 'AKUNTAN', title: 'Akuntan SPPG Malang Tumpang Jeru' },
  { role: 'KOORDINATOR', title: 'Koordinator Operasional SPPG Malang Tumpang Jeru' },
];

// Tanda tangan bawaan hanya dipakai selama penanda tangannya masih orang yang sama, agar tidak tercetak
// di atas nama orang lain. Dicocokkan lewat potongan nama karena penulisan gelar di data karyawan berbeda-beda.
// URL aset tidak disimpan karena hash-nya berubah tiap build.
const DEFAULT_SIGNATURES: Partial<Record<SignerRole, { img: string; owner: RegExp }>> = {
  KEPALA_SPPG: { img: ttdRizkyImg, owner: /rizky\s+iman/i },
  AHLI_GIZI: { img: ttdEnoImg, owner: /eno\s+shafira/i },
  ASLAP: { img: ttdToniImg, owner: /fathoni/i },
  AKUNTAN: { img: ttdAlfianaImg, owner: /alfiana/i },
};

/** Gambar tanda tangan bawaan untuk nama ini, atau undefined bila namanya bukan pemilik tanda tangan bawaan. */
export const defaultSignatureFor = (role: SignerRole, name: string): string | undefined => {
  const def = DEFAULT_SIGNATURES[role];
  return def && def.owner.test(name) ? def.img : undefined;
};

/**
 * Gambar tanda tangan untuk dokumen cetak, atau undefined bila belum ada / sengaja dihapus.
 * `defaultVariant` mengganti gambar bawaan dengan potongan lain yang lebih pas di dokumen itu;
 * gambar unggahan sendiri tetap dipakai apa adanya.
 */
export const signerSignature = (role: SignerRole, defaultVariant?: string): string | undefined => {
  const saved = warehouseDb.getDocumentSigners()[role]?.signature;
  if (saved !== undefined) return saved || undefined;
  const def = defaultSignatureFor(role, warehouseDb.getSignerName(role));
  return def && defaultVariant ? defaultVariant : def;
};

// Pilihan "Tanda tangan tercetak" per jenis dokumen; dilepas bila dokumen itu diminta bertanda tangan basah.
const SETTING_DOC_SIGNATURES = 'print_doc_signatures';

export type SignatureDoc =
  | 'po-nota'
  | 'po-harian'
  | 'rekap-porsi'
  | 'purchase-request'
  | 'opname'
  | 'pengeluaran-harian'
  | 'absensi'
  | 'laporan-tugas'
  | 'permintaan-bahan'
  | 'bukti-belanja'
  | 'rekap-limbah'
  | 'log-limbah'
  | 'sop-gudang';

export const docSignatureOn = (doc: SignatureDoc): boolean =>
  warehouseDb.getAppSetting<Partial<Record<SignatureDoc, boolean>>>(SETTING_DOC_SIGNATURES, {})[doc] ?? true;

export const setDocSignatureOn = (doc: SignatureDoc, on: boolean) => {
  const current = warehouseDb.getAppSetting<Partial<Record<SignatureDoc, boolean>>>(SETTING_DOC_SIGNATURES, {});
  warehouseDb.saveAppSetting(SETTING_DOC_SIGNATURES, { ...current, [doc]: on });
};
