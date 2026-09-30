/**
 * Utility Penyimpanan Sementara (Pool) Cetak Nota Pesanan (PO) SPPG
 * Digunakan untuk menampung nota-nota kecil sebelum dicetak bersama
 * agar 1 lembar kertas A4 bisa memuat 2 nota berbeda (hemat kertas).
 */

const STORAGE_KEY = 'sppg_nota_print_pool_v1';

export function getPrintPoolIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function savePrintPoolIds(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch (e) {
    console.error('Failed to save print pool', e);
  }
}

export function addToPrintPool(notaId: string): string[] {
  const current = getPrintPoolIds();
  if (!current.includes(notaId)) {
    const updated = [...current, notaId];
    savePrintPoolIds(updated);
    return updated;
  }
  return current;
}

export function removeFromPrintPool(notaId: string): string[] {
  const current = getPrintPoolIds();
  const updated = current.filter(id => id !== notaId);
  savePrintPoolIds(updated);
  return updated;
}

export function clearPrintPool(): void {
  savePrintPoolIds([]);
}

export function isInPrintPool(notaId: string): boolean {
  return getPrintPoolIds().includes(notaId);
}
