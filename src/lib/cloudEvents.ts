// Penulisan ke Supabase berjalan di belakang layar; tanpa laporan ini pengguna melihat toast
// "berhasil" padahal data tidak sampai ke server dan hilang saat halaman dimuat ulang.
export const CLOUD_WRITE_FAILED_EVENT = 'sppg_cloud_write_failed';

export function reportCloudWriteError(label: string, error: any): void {
  const message = error?.message || String(error);
  console.error(`Supabase ${label} gagal:`, error);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CLOUD_WRITE_FAILED_EVENT, { detail: { label, message } }));
  }
}
