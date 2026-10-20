-- Tabel menu_orders di database dibuat dari skema lama (menu_name, portion_count, ingredients),
-- sehingga CREATE TABLE di skema utama dilewati dan kolom yang dipakai aplikasi tidak pernah ada.
-- Migrasi 20261018000001 juga gagal di baris "ALTER COLUMN chef_in_charge" (kolomnya tidak ada),
-- jadi kolom `data` dan view website publik ikut tidak terbentuk. Akibatnya setiap simpan menu
-- ditolak server dan menu hilang saat halaman dimuat ulang.
-- Jalankan sekali di Supabase Dashboard > SQL Editor. Aman diulang.

-- 1. Kolom yang dipakai aplikasi
ALTER TABLE public.menu_orders ADD COLUMN IF NOT EXISTS meal_session TEXT;
ALTER TABLE public.menu_orders ADD COLUMN IF NOT EXISTS menu_title TEXT;
ALTER TABLE public.menu_orders ADD COLUMN IF NOT EXISTS menu_description TEXT;
ALTER TABLE public.menu_orders ADD COLUMN IF NOT EXISTS target_portions INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.menu_orders ADD COLUMN IF NOT EXISTS key_ingredients JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.menu_orders ADD COLUMN IF NOT EXISTS chef_in_charge TEXT;
ALTER TABLE public.menu_orders ADD COLUMN IF NOT EXISTS data JSONB;

-- 2. Kolom lama tidak lagi diisi aplikasi: lepas NOT NULL agar insert tidak ditolak.
--    Kolom lain di luar daftar aplikasi juga dilepas, karena isinya tidak diketahui.
DO $$
DECLARE
    col TEXT;
BEGIN
    FOR col IN
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'menu_orders'
          AND is_nullable = 'NO'
          AND column_default IS NULL
          AND column_name NOT IN ('id')
    LOOP
        EXECUTE format('ALTER TABLE public.menu_orders ALTER COLUMN %I DROP NOT NULL', col);
    END LOOP;
END $$;

-- 3. Akses (sama dengan 20261018000001)
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

-- 4. View website publik (gagal dibuat oleh 20261018000001)
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
