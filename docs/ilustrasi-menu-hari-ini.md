# Ilustrasi halaman Menu MBG Hari Ini

Halaman `/menu-mbg-hari-ini` memakai dua jenis ilustrasi:

- **File di `public/ilustrasi/`.** Halaman membacanya langsung lewat nama file. Selama file belum ada, halaman memakai gambar bawaan dari `src/assets/` (lihat tabel).
- **Gambar yang diunggah lewat Atur Website.** Buka tab Menu Hari Ini, lalu unggah di bagian Pahlawan Gizi atau Misi Sehat.

## Gaya yang sama untuk semua prompt

Tempelkan teks ini di akhir setiap prompt supaya semua ilustrasi bergaya seragam:

> Flat vector children's book illustration, soft rounded shapes, warm friendly colors (leaf green #1f8a4c, cream #f7f4ec, sunny yellow, soft orange), thin dark-green outlines, gentle shading, Indonesian elementary school context, no text, no watermark, transparent background, centered subject with small padding.

Simpan sebagai **PNG berlatar transparan**, lalu ubah ke **WebP** dengan lebar sekitar 600 px supaya halaman tetap ringan. Anak-anak dengan seragam sekolah Indonesia: kemeja putih dan celana atau rok merah untuk SD.

## 1. File di `public/ilustrasi/`

| Nama file | Dipakai di | Gambar bawaan | Prompt |
|---|---|---|---|
| `manfaat-anak.webp` | Kartu "Manfaat untuk Anak" | `anak_sehat_mbg.jpg` | A cheerful Indonesian elementary school boy in a white shirt and red shorts uniform, raising one fist energetically, big smile, small sparkle lines around him. |
| `tahukah-kamu.webp` | Kartu "Tahukah Kamu?" | `sayur_wortel_mbg.jpg` | A small cheerful group of fresh vegetables: carrot, broccoli, spinach leaves, and a tomato, arranged together. |

## 2. Diunggah lewat Atur Website

**Pahlawan Gizi** (bagian Pahlawan Gizi Hari Ini). Contoh untuk tempe:

> A cute smiling tempeh block character with small arms and legs, waving happily, with a few soybeans around it.

Untuk bahan lain, ganti "tempeh block" dengan bahannya, misalnya "carrot", "chicken drumstick", atau "banana".

**Misi Sehat** (satu gambar untuk setiap hari):

| Hari | Kebiasaan | Prompt |
|---|---|---|
| Senin | Cuci tangan pakai sabun | An Indonesian school boy washing his hands with soap and foam at a sink with running water, happy expression. |
| Selasa | Berdoa sebelum makan | An Indonesian school girl in a hijab and school uniform sitting at a table, hands raised in prayer before eating, a food tray in front of her. |
| Rabu | Habiskan makananmu | An Indonesian school child proudly showing an empty stainless steel food tray, thumbs up. |
| Kamis | Minum air putih | An Indonesian school child drinking from a reusable water bottle, refreshed smile, small water droplets. |
| Jumat | Buang sampah pada tempatnya | An Indonesian school child throwing a food wrapper into a green trash bin, recycling symbol on the bin. |
| Sabtu | Makan sayur dan buah | An Indonesian school child happily eating vegetables and fruit (carrot, broccoli, banana, orange) from a plate. |
