# Design Direction: SPPG MLG TUMPANG JERU WMS

## 1. Identitas & Karakter Produk (Brand & Purpose)
- **Nama Produk:** WMS SPPG MLG TUMPANG JERU (Satuan Pelayanan Pemenuhan Gizi)
- **Bidang:** Sistem Manajemen Pergudangan & Logistik Bahan Pangan Bergizi Anak Sekolah (Program MBG)
- **Kepribadian Visual:** Terpercaya, presisi, ergonomis, bersih, dan berorientasi operasional lapangan (*operational-first*).
- **Prinsip Utama:** Setiap piksel dan elemen interaktif harus melayani fungsi verifikasi stok, penerimaan barang basah/kering, kepatuhan gizi, dan transparansi anggaran belanja. Tidak ada elemen dekoratif tanpa tujuan.

---

## 2. Dials (Tingkat Gaya Antislop)
- **ENERGY:** 2 (Fokus, tenang, profesional tanpa efek visual berlebihan yang melelahkan mata petugas gudang).
- **RHYTHM:** 2 (Konsisten, hierarki terstruktur antar modul operasional dengan variasi fungsional sesuai jenis data).
- **MOTION:** 1 (Minimalis dan cepat; transisi instan 150ms hanya untuk feedback interaksi, tanpa animasi mengambang atau delay).

---

## 3. Palet Warna (Color Palette)
- **Warna Utama (Primary Brand):**
  - Emerald 700 (`#047857`) & Emerald 800 (`#065f46`) untuk aksi utama, konfirmasi kedatangan bahan pangan berkualitas, dan identitas gizi SPPG.
  - Emerald 50 (`#ecfdf5`) & Emerald 100 (`#d1fae5`) untuk latar aktif dan badge status lolos QC.
- **Warna Netral (Neutrals & Structure):**
  - Surface: Putih murni (`#ffffff`) untuk kartu & tabel data; Slate 50 (`#f8fafc`) untuk selang-seling baris tabel dan bar navigasi.
  - Background Utama: Slate 100 (`#f1f5f9`) untuk kontras yang nyaman saat bekerja seharian di layar monitor.
  - Border: Slate 200 (`#e2e8f0`) dan Slate 300 (`#cbd5e1`).
  - Text Primary: Slate 900 (`#0f172a`) untuk judul dan angka penting.
  - Text Secondary: Slate 600 (`#475569`) dan Slate 700 (`#334155`) untuk label dan metadata (memenuhi kontras WCAG AA > 4.5:1).
- **Warna Semantik (Semantic Statuses):**
  - Kritis / Habis (Out of Stock / Danger): Rose 700 (`#be123c`) dengan latar Rose 50 (`#fff1f2`).
  - Peringatan / Stok Menipis (Warning / Buffer Stock): Amber 700 (`#b45309`) dengan latar Amber 50 (`#fffbeb`).
  - Informasi / Cold Chain (Chiller & Freezer): Sky 700 (`#0369a1`) dengan latar Sky 50 (`#f0f9ff`).
  - Audit / Otorisasi: Indigo 700 (`#4338ca`) dengan latar Indigo 50 (`#eef2ff`).

---

## 4. Tipografi (Typography)
- **Font:** Inter / Sans-serif sistem native untuk performa maksimal, render instan, dan keterbacaan tinggi.
- **Karakter Angka:** Font mono (`font-mono`) tabular untuk kuantitas stok, nominal rupiah, nomor PO, dan jam kedatangan agar angka sejajar secara vertikal.
- **Hierarki Teks:**
  - H1 Modul: `text-xl font-bold text-slate-900 tracking-tight`
  - H2 Subseksi: `text-sm font-semibold text-slate-800`
  - Body Text: `text-xs text-slate-700 leading-relaxed`
  - Metadata / Caption: `text-[11px] text-slate-500 font-medium`
  - Larangan: Dilarang menggunakan kapitalisasi berulang (`uppercase`) dan spasi renggang berlebihan (`tracking-widest`).

---

## 5. Token Desain Komponen (Design Tokens)
- **Border Radius:**
  - Komponen Mikro (Badge status, chip kategori): `rounded-md` (bukan pill `rounded-full` berlebihan).
  - Kontrol Interaktif (Button, Input, Dropdown select): `rounded-lg` dengan padding proporsional.
  - Kontainer (Card, Table wrapper, Modal box): `rounded-xl` dengan border halus `border-slate-200`.
- **Indikator Fokus & Aksesibilitas (WCAG AA):**
  - Setiap elemen interaktif wajib memiliki `focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1`.
  - Dilarang mematikan outline (`outline-none`) tanpa memberikan visual ring pengganti.
- **Tap Targets Mobile:**
  - Tombol aksi pada mobile wajib memiliki minimum hit-area 44px (`min-h-[44px]`).
