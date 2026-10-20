-- ==============================================================================
-- 1. Order menu tersimpan di cloud.
--    Sebelumnya aplikasi tidak pernah mengunggah order menu, dan cache browser untuk menu
--    sengaja dimatikan, sehingga menu & PO bahan hilang setiap halaman dimuat ulang.
--    Kolom `data` menyimpan order utuh (alokasi sekolah, menu B3, rincian PO, dst.).
-- 2. Website publik membaca menu, sekolah, dan pemasok lewat view berkolom terbatas:
--    tanpa biaya, PO, nomor telepon, atau alamat.
--
-- Akses mengikuti tabel operasional lain (kunci anon, lihat 20261017000000_*.sql).
-- Jalankan sekali di Supabase Dashboard > SQL Editor. Aman diulang.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. MENU ORDERS
-- ------------------------------------------------------------------------------
ALTER TABLE public.menu_orders ADD COLUMN IF NOT EXISTS data JSONB;
-- Tabel lama tidak punya chef_in_charge; tambahkan dulu agar baris berikutnya tidak gagal
-- (lihat juga 20261020000001_menu_orders_legacy_columns.sql).
ALTER TABLE public.menu_orders ADD COLUMN IF NOT EXISTS chef_in_charge TEXT;
ALTER TABLE public.menu_orders ALTER COLUMN chef_in_charge DROP NOT NULL;

DROP POLICY IF EXISTS "Menu orders viewable by all authenticated users" ON public.menu_orders;
DROP POLICY IF EXISTS "Menu orders manageable by operational roles" ON public.menu_orders;
DROP POLICY IF EXISTS "app_anon_full_access" ON public.menu_orders;
CREATE POLICY "app_anon_full_access" ON public.menu_orders
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_orders TO anon, authenticated;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'menu_orders'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_orders;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. VIEW UNTUK WEBSITE PUBLIK (hanya kolom yang boleh dilihat pengunjung)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.public_menu_schedule AS
SELECT
    id,
    date,
    meal_session,
    menu_title,
    COALESCE(NULLIF(menu_description, ''), data->>'menuDescription') AS menu_description,
    data->>'specialDietB3' AS special_diet_b3
FROM public.menu_orders
WHERE status IS DISTINCT FROM 'CANCELLED';

CREATE OR REPLACE VIEW public.public_schools AS
SELECT id, school_name, category
FROM public.school_beneficiaries;

CREATE OR REPLACE VIEW public.public_suppliers AS
SELECT id, name, supply_category
FROM public.suppliers
WHERE is_active IS DISTINCT FROM FALSE;

GRANT SELECT ON public.public_menu_schedule, public.public_schools, public.public_suppliers TO anon, authenticated;
