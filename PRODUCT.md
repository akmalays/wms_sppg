# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Admin Logistik & Petugas Gudang:** Bertanggung jawab mencatat penerimaan bahan pangan segar/kering dari supplier, verifikasi kualitas fisik, stock opname, dan log residu/waste makanan.
- **Kepala SPPG (Rizky Iman Ramdhan, S.Pd):** Otorisasi Nota Pesanan (PO), validasi laporan pengeluaran harian, dan monitoring kepatuhan standar gizi BGN.
- **Mitra Rekanan / Supplier:** Menerima Nota Pesanan resmi untuk pengiriman bahan makanan tepat waktu dan sesuai spesifikasi mutu.

## Product Purpose

Sistem Informasi Manajemen Pergudangan & Logistik Bahan Pangan Bergizi (Program Makan Bergizi Gratis - MBG) untuk Satuan Pelayanan Pemenuhan Gizi (SPPG) Jeru Tumpang di bawah Badan Gizi Nasional (BGN) Republik Indonesia. Bertujuan menjaga ketersediaan, higienitas, ketertelusuran rantai pasok dingin/kering, efisiensi anggaran belanja, dan akuntabilitas pelaporan harian.

## Positioning

Sistem operasional lapangan (*operational-first*) yang mengintegrasikan pencatatan harian penerimaan barang, penerbitan Nota Pesanan (PO) berformat resmi Badan Gizi Nasional dengan fitur hemat kertas (Batch Print Pool 2 nota per lembar A4), serta rekonsiliasi stok dan pencatatan waste makanan secara real-time tanpa ketergantungan koneksi internet yang rumit.

## Operating Context

- Dioperasikan langsung di ruang penerimaan, gudang penyimpanan (kering & chiller/freezer), serta kantor administrasi SPPG Jeru Tumpang, Malang, Jawa Timur.
- Perangkat operasional: PC desktop gudang, laptop admin, dan tablet lapangan.
- Output fisik: Nota Pesanan (PO) cetak ukuran A4 dan A5 siap potong, berita acara opname, dan tanda terima supplier dengan tanda tangan resmi basah/digital.

## Capabilities and Constraints

- **Penerimaan Barang:** Input cepat harian per supplier, pengelompokan jenis bahan basah/kering, validasi nominal dan kuantitas.
- **Nota Pesanan (PO) BGN:** Penomoran otomatis berkala romawi BGN, mode cetak 1 lembar A4 standar & 2 rangkap hemat kertas, pool antrean cetak gabungan (*batch print*).
- **Manajemen Supplier:** Direktori mitra rekanan terpercaya tanpa fitur hapus sembarangan untuk integritas audit historis.
- **Stock Movement & Opname:** Kartu stok real-time, pencatatan expired date, penyesuaian opname berkala.
- **Pencatatan Waste & Residu:** Pelacakan bahan sisa preparasi dapur dan makanan berlebih untuk evaluasi menu.

## Brand Commitments

- Nama Instansi: Badan Gizi Nasional - SPPG Jeru Tumpang.
- Warna Identitas: Emerald 700 (`#047857`) dan Emerald 800 (`#065f46`) sebagai simbol kesegaran pangan dan gizi nasional.
- Penandatangan Resmi: Kepala Satuan Pelayanan Pemenuhan Gizi, Rizky Iman Ramdhan, S.Pd.
- Integritas Aset: Logo resmi BGN (`src/assets/logo sppg.png`) dan tanda tangan digital (`src/assets/ttd rizky.png`).

## Evidence on Hand

- Dataset operasional riil transaksi September-Oktober 2026 di `src/db/storage.ts` dan `src/db/realSeedData.ts`.
- Format resmi dokumen Nota Pesanan sesuai template Badan Gizi Nasional.
- Aturan desain terstruktur di `DESIGN.md`.

## Product Principles

1. **Akurasi & Ergonomi Lapangan:** Formulir dan tabel dioptimalkan untuk entri cepat dengan keyboard, angka tabular monospaced, dan kontras tinggi.
2. **Tanpa Dekorasi Sia-Sia:** Menolak elemen grafis klise (*AI slop*), animasi lambat, dan efek visual yang memperlambat alur kerja petugas.
3. **Efisiensi Sumber Daya:** Penghematan kertas cetak fisik dan transparansi setiap rupiah anggaran belanja pangan.
