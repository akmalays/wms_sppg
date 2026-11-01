import ttdRizkyImg from '../assets/ttd rizky.png';
import ttdEnoImg from '../assets/ttd eno.png';
import ttdToniImg from '../assets/ttd toni.png';
import { warehouseDb } from '../db/storage';

// Petugas & tanda tangan diatur di modal "Petugas di dokumen pengiriman", dipakai semua dokumen cetak.
// Disimpan di tabel app_settings (lihat warehouseDb.saveAppSetting) agar sama di semua perangkat.
export const SETTING_OFFICERS = 'delivery_officers';

export interface DeliveryOfficerSettings {
  nutritionistName: string;
  fieldAssistantName: string;
  headName: string;
  /** Kosong = dicetak bergaris untuk ditulis tangan (driver bisa berganti tiap hari). */
  driverName: string;
  /** Jam batas makan di Berita Acara Penerimaan, mis. "11:00". */
  consumeBefore: string;
  /** Tanda tangan Kepala SPPG (data URL gambar), dicetak di kotak Mengetahui. */
  headSignature?: string;
  nutritionistSignature?: string;
  fieldAssistantSignature?: string;
  /** Tanda tangan yang gambarnya disimpan tapi tidak dicetak (centang dilepas di modal Petugas). */
  hiddenSignatures?: SignatureKey[];
  // Field lama, tidak lagi dicetak
  nutritionistTitle?: string;
  vehicleNumber?: string;
  pickupTimeRange?: string;
}

// Nama sesuai dokumen pengiriman SPPG Malang Tumpang Jeru; bisa diubah lewat tombol Petugas.
export const DEFAULT_OFFICERS: DeliveryOfficerSettings = {
  nutritionistName: 'Eno Shafira Ramadanti, A.md.Gz',
  fieldAssistantName: 'Mukhammad Ali Akbar Fathoni, S.Pd',
  headName: 'Rizky Iman Ramadhan, S.Pd.',
  driverName: '',
  consumeBefore: '11:00',
};

// Tanda tangan bawaan hanya dipakai selama namanya masih nama default, agar tidak tercetak di atas nama orang lain.
// String kosong berarti sengaja dihapus. URL aset tidak disimpan karena hash-nya berubah tiap build.
export type SignatureKey = 'headSignature' | 'nutritionistSignature' | 'fieldAssistantSignature';
export type NameKey = 'headName' | 'nutritionistName' | 'fieldAssistantName';
export const DEFAULT_SIGNATURES: [SignatureKey, NameKey, string][] = [
  ['headSignature', 'headName', ttdRizkyImg],
  ['nutritionistSignature', 'nutritionistName', ttdEnoImg],
  ['fieldAssistantSignature', 'fieldAssistantName', ttdToniImg],
];

export const toggleSignaturePrint = (o: DeliveryOfficerSettings, key: SignatureKey, printed: boolean): DeliveryOfficerSettings => {
  const hidden = (o.hiddenSignatures || []).filter(k => k !== key);
  return { ...o, hiddenSignatures: printed ? hidden : [...hidden, key] };
};

export const withDefaultSignatures = (o: DeliveryOfficerSettings): DeliveryOfficerSettings => {
  const out = { ...o };
  for (const [sig, name, img] of DEFAULT_SIGNATURES) {
    if (out[sig] === undefined && out[name] === DEFAULT_OFFICERS[name]) out[sig] = img;
  }
  return out;
};

export const stripDefaultSignatures = (o: DeliveryOfficerSettings): DeliveryOfficerSettings => {
  const out = { ...o };
  for (const [sig, , img] of DEFAULT_SIGNATURES) {
    if (out[sig] === img) out[sig] = undefined;
  }
  return out;
};

// Yang dikirim ke lembar cetak: tanda tangan yang centangnya dilepas dikosongkan.
export const officersForPrint = (o: DeliveryOfficerSettings): DeliveryOfficerSettings => {
  const out = { ...o };
  for (const key of o.hiddenSignatures || []) out[key] = undefined;
  return out;
};

// Isian petugas yang kosong diisi dari jabatan karyawan aktif.
export const loadOfficers = (): DeliveryOfficerSettings => {
  const saved = warehouseDb.getAppSetting<Partial<DeliveryOfficerSettings>>(SETTING_OFFICERS, {});
  return withDefaultSignatures({
    ...DEFAULT_OFFICERS,
    ...saved,
    nutritionistName: saved.nutritionistName || DEFAULT_OFFICERS.nutritionistName,
    fieldAssistantName: saved.fieldAssistantName || DEFAULT_OFFICERS.fieldAssistantName,
    headName: saved.headName || DEFAULT_OFFICERS.headName,
    consumeBefore: saved.consumeBefore || DEFAULT_OFFICERS.consumeBefore,
  });
};

/**
 * Gambar tanda tangan petugas untuk dokumen cetak di luar dokumen pengiriman, atau undefined bila belum ada gambarnya.
 * Tampil-tidaknya diatur per dokumen (lihat docSignatureOn), bukan oleh centang di modal Petugas.
 * `defaultVariant` mengganti gambar bawaan dengan potongan lain yang lebih pas di dokumen itu;
 * gambar unggahan sendiri tetap dipakai apa adanya.
 */
export const officerSignature = (key: SignatureKey, defaultVariant?: string): string | undefined => {
  const o = loadOfficers();
  const img = o[key];
  if (!img) return undefined;
  const isDefault = DEFAULT_SIGNATURES.some(([sig, , def]) => sig === key && def === img);
  return isDefault && defaultVariant ? defaultVariant : img;
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
