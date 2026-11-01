-- Tabel waste_logs di database dibuat dari skema lama (category, pic), sehingga CREATE TABLE di skema
-- utama dilewati dan kolom waste_category, source_area, reason, recorded_by tidak pernah ada.
-- Akibatnya setiap simpan limbah ditolak server ("column ... does not exist"), padahal layar tampak
-- berhasil, dan datanya hilang saat halaman dimuat ulang.
-- Jalankan sekali di Supabase Dashboard > SQL Editor. Aman diulang.

-- 1. Kolom yang dipakai aplikasi
ALTER TABLE public.waste_logs ADD COLUMN IF NOT EXISTS waste_category TEXT;
ALTER TABLE public.waste_logs ADD COLUMN IF NOT EXISTS source_area TEXT;
ALTER TABLE public.waste_logs ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE public.waste_logs ADD COLUMN IF NOT EXISTS recorded_by TEXT;

-- 2. Baris lama: salin isi kolom lama ke kolom baru
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'waste_logs' AND column_name = 'category') THEN
        UPDATE public.waste_logs SET waste_category = category WHERE waste_category IS NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'waste_logs' AND column_name = 'pic') THEN
        UPDATE public.waste_logs SET recorded_by = pic WHERE recorded_by IS NULL;
    END IF;
END $$;

-- 3. Kolom lama tidak lagi diisi aplikasi: lepas NOT NULL agar insert tidak ditolak.
--    Kolom lain di luar daftar aplikasi juga dilepas, karena isinya tidak diketahui.
DO $$
DECLARE
    col TEXT;
BEGIN
    FOR col IN
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'waste_logs'
          AND is_nullable = 'NO'
          AND column_default IS NULL
          AND column_name NOT IN ('id')
    LOOP
        EXECUTE format('ALTER TABLE public.waste_logs ALTER COLUMN %I DROP NOT NULL', col);
    END LOOP;
END $$;

-- 4. Pulihkan rekap sisa makanan 19-28 Oktober 2026 yang ditolak server, dari Riwayat Aktivitas
--    (audit_logs WASTE_DAILY_*, input 29 Oktober oleh Nur Akmal Ays). Diambil versi terakhir per tanggal.
--    Catatan dan cara penanganan tidak tercatat di riwayat, jadi diisi default aplikasi.
--    Tanggal yang sudah punya data di tabel tidak disentuh.
INSERT INTO public.waste_logs
    (id, date, waste_category, item_name, quantity, unit, source_area, reason, disposal_method, recorded_by, created_at)
SELECT
    'WST-REC-' || v.date || '-' || replace(v.category, ' ', '-'),
    v.date::date,
    v.category,
    'Sisa ' || v.category,
    v.quantity,
    'Kg',
    'Dapur SPPG Tumpang Jeru',
    '-',
    'Pakan Ternak & Kompos Organik',
    'Nur Akmal Ays',
    '2026-10-29T05:35:00+00:00'
FROM (VALUES
    ('2026-10-19', 'karbohidrat', 50.66), ('2026-10-19', 'sayur', 37.99), ('2026-10-19', 'protein hewani', 12.67),
    ('2026-10-19', 'protein nabati', 19), ('2026-10-19', 'buah', 6.33),
    ('2026-10-20', 'karbohidrat', 30.99), ('2026-10-20', 'sayur', 23.17), ('2026-10-20', 'protein hewani', 7.72),
    ('2026-10-20', 'protein nabati', 11.59), ('2026-10-20', 'buah', 3.9),
    ('2026-10-21', 'karbohidrat', 19.98), ('2026-10-21', 'sayur', 14.98), ('2026-10-21', 'protein hewani', 7.5),
    ('2026-10-21', 'protein nabati', 4.9), ('2026-10-21', 'buah', 2.49),
    ('2026-10-22', 'karbohidrat', 78.9), ('2026-10-22', 'sayur', 59.2), ('2026-10-22', 'protein hewani', 29.6),
    ('2026-10-22', 'protein nabati', 19.7), ('2026-10-22', 'buah', 9.8),
    ('2026-10-26', 'karbohidrat', 48.66), ('2026-10-26', 'sayur', 36.5), ('2026-10-26', 'protein hewani', 12.16),
    ('2026-10-26', 'protein nabati', 18.25), ('2026-10-26', 'buah', 6.08),
    ('2026-10-27', 'karbohidrat', 82.86), ('2026-10-27', 'sayur', 62.15), ('2026-10-27', 'protein hewani', 20.7),
    ('2026-10-27', 'protein nabati', 31.07), ('2026-10-27', 'buah', 10.3),
    ('2026-10-28', 'karbohidrat', 79.4), ('2026-10-28', 'sayur', 59.5), ('2026-10-28', 'protein hewani', 19.85),
    ('2026-10-28', 'protein nabati', 29.78), ('2026-10-28', 'buah', 9.92)
) AS v(date, category, quantity)
WHERE NOT EXISTS (
    SELECT 1 FROM public.waste_logs w
    WHERE w.date = v.date::date AND lower(w.waste_category) = v.category
)
ON CONFLICT (id) DO NOTHING;
