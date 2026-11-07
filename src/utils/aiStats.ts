import { warehouseDb } from '../db/storage';
import { fetchHedonicResponses, type HedonicResponse } from './hedonic';
import { loadDataset, runQuery, wasteKg, type QueryResult } from './aiDataQuery';
import type { AiDataset, AiGroupBy, AiMetric, AiQuerySpec } from './aiAssist';

// Angka yang dikirim ke AI untuk ditulis menjadi narasi. Selalu berupa rekap, tanpa data karyawan atau nama penilai.

const round = (n: number, digits = 2) => Number(n.toFixed(digits));

const spec = (dataset: AiDataset, metric: AiMetric, groupBy: AiGroupBy, from: string, to: string, limit = 10): AiQuerySpec => ({
  answerable: true, reason: '', interpretation: '', dataset, metric, from, to,
  itemContains: '', categoryContains: '', supplierContains: '', lowStockOnly: false, groupBy, sort: 'tertinggi', limit,
});

const simple = (r: QueryResult) => r.rows.map(row => ({ nama: row.label, nilai: round(row.value), satuan: row.unit || undefined }));

/** Rekap limbah per periode, dengan menu pada hari yang sama agar sisa makanan bisa dibandingkan antarmenu. */
export function buildWasteStats(from: string, to: string) {
  const logs = warehouseDb.getWasteLogs().filter(l => (!from || l.date >= from) && (!to || l.date <= to));
  const menus = warehouseDb.getMenuOrders().filter(o => o.status !== 'CANCELLED');
  const byCategory = new Map<string, number>();
  const byDay = new Map<string, number>();
  let totalKg = 0;
  let tpsKg = 0;
  let nonWeight = 0;
  logs.forEach(l => {
    const kg = wasteKg(l.unit, l.quantity);
    if (kg === null) {
      nonWeight += 1;
      return;
    }
    totalKg += kg;
    if (l.disposalMethod === 'TPS Terpadu') tpsKg += kg;
    byCategory.set(l.wasteCategory, (byCategory.get(l.wasteCategory) || 0) + kg);
    byDay.set(l.date, (byDay.get(l.date) || 0) + kg);
  });
  const perMenu = [...byDay.entries()].map(([date, kg]) => {
    const dayMenus = menus.filter(m => m.date === date);
    const portions = dayMenus.reduce((sum, m) => sum + (m.targetPortions || 0), 0);
    return {
      tanggal: date,
      menu: dayMenus.map(m => m.menuTitle).join(' / ') || 'Menu tidak tercatat',
      kg: round(kg),
      porsi: portions || undefined,
      gramPerPorsi: portions > 0 ? round((kg * 1000) / portions, 1) : undefined,
    };
  });
  return {
    jumlahCatatan: logs.length,
    catatanBukanBerat: nonWeight,
    totalKg: round(totalKg),
    keTpsKg: round(tpsKg),
    dimanfaatkanPersen: totalKg > 0 ? Math.round(((totalKg - tpsKg) / totalKg) * 100) : null,
    perKategoriKg: Object.fromEntries([...byCategory.entries()].map(([k, v]) => [k, round(v)])),
    hariTerbanyak: [...perMenu].sort((a, b) => b.kg - a.kg).slice(0, 12),
    hariTerendah: [...perMenu].sort((a, b) => a.kg - b.kg).slice(0, 5),
  };
}

/** Rekap uji hedonik. Komentar dikirim tanpa nama, peran, dan kelas penilai. */
export function buildHedonicStats(responses: HedonicResponse[]) {
  const avg = (rs: HedonicResponse[]) => (rs.length ? round(rs.reduce((a, r) => a + r.overall, 0) / rs.length) : null);
  const group = (keyOf: (r: HedonicResponse) => string) => {
    const map = new Map<string, HedonicResponse[]>();
    responses.forEach(r => map.set(keyOf(r), [...(map.get(keyOf(r)) || []), r]));
    return [...map.entries()].map(([nama, rs]) => ({ nama, nilaiRataRata: avg(rs), jumlahPenilai: rs.length }));
  };
  const menus = group(r => `${r.delivery_date} ${r.menu_title}`).sort((a, b) => (a.nilaiRataRata ?? 0) - (b.nilaiRataRata ?? 0));
  return {
    skala: 'nilai 1 sampai 5, di bawah 3 perlu perhatian',
    jumlahPenilai: responses.length,
    nilaiRataRata: avg(responses),
    menuTerendah: menus.slice(0, 8),
    menuTertinggi: menus.slice(-5).reverse(),
    perSekolah: group(r => r.school_name).slice(0, 25),
    komentar: responses
      .filter(r => (r.comment || '').trim())
      .slice(0, 40)
      .map(r => ({ menu: r.menu_title, isi: (r.comment || '').trim().slice(0, 220) })),
  };
}

export interface OperationalStats {
  periode: { dari: string; sampai: string };
  menu: { jumlahMenu: number; totalPorsi: number; daftarTerbaru: { tanggal: string; menu: string; porsi: number }[] };
  belanja: { totalRupiah: number; jumlahTransaksi: number; tanpaHarga: number; perKategori: unknown; barangTerbesar: unknown };
  pesanan: { jumlahBaris: number; totalRupiah: number; perSupplier: unknown };
  stok: { barangAktif: number; dibawahMinimum: number; daftarMenipis: unknown };
  limbah: ReturnType<typeof buildWasteStats>;
  hedonik: ReturnType<typeof buildHedonicStats> | { tidakTersedia: string };
}

/** Semua angka untuk draf laporan; tiap angka dihitung dengan mesin yang sama dengan "Tanya data". */
export async function buildOperationalStats(from: string, to: string): Promise<OperationalStats> {
  const belanjaTotal = runQuery(spec('belanja', 'total_nominal', 'none', from, to));
  const belanjaKategori = runQuery(spec('belanja', 'total_nominal', 'kategori', from, to, 12));
  const belanjaBarang = runQuery(spec('belanja', 'total_nominal', 'barang', from, to, 8));
  const pesananTotal = runQuery(spec('pesanan', 'total_nominal', 'none', from, to));
  const pesananSupplier = runQuery(spec('pesanan', 'total_nominal', 'supplier', from, to, 8));
  const menuRows = loadDataset('menu').filter(r => r.date >= from && r.date <= to).sort((a, b) => b.date.localeCompare(a.date));
  const stock = loadDataset('stok');
  const low = stock.filter(s => s.low);

  let hedonik: OperationalStats['hedonik'];
  try {
    hedonik = buildHedonicStats(await fetchHedonicResponses(from, to));
  } catch {
    hedonik = { tidakTersedia: 'Data uji hedonik tidak bisa dimuat saat laporan dibuat.' };
  }

  return {
    periode: { dari: from, sampai: to },
    menu: {
      jumlahMenu: menuRows.length,
      totalPorsi: menuRows.reduce((sum, r) => sum + r.portions, 0),
      daftarTerbaru: menuRows.slice(0, 10).map(r => ({ tanggal: r.date, menu: r.item, porsi: r.portions })),
    },
    belanja: {
      totalRupiah: belanjaTotal.totals[0]?.value ?? 0,
      jumlahTransaksi: belanjaTotal.recordCount - belanjaTotal.skippedCount,
      tanpaHarga: belanjaTotal.skippedCount,
      perKategori: simple(belanjaKategori),
      barangTerbesar: simple(belanjaBarang),
    },
    pesanan: { jumlahBaris: pesananTotal.recordCount, totalRupiah: pesananTotal.totals[0]?.value ?? 0, perSupplier: simple(pesananSupplier) },
    stok: {
      barangAktif: stock.length,
      dibawahMinimum: low.length,
      daftarMenipis: low.slice(0, 15).map(s => ({ nama: s.item, sisa: round(s.qty), satuan: s.unit })),
    },
    limbah: buildWasteStats(from, to),
    hedonik,
  };
}
