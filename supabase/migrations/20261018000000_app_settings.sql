-- ==============================================================================
-- Pengaturan aplikasi yang sebelumnya hanya tersimpan di browser satu perangkat:
-- petugas pengiriman surat jalan dan rincian kelas per sekolah.
--
-- Satu baris per kunci, nilai berupa JSON. Akses mengikuti tabel operasional lain
-- (kunci anon, lihat 20261017000000_sync_karyawan_absensi_audit_opname.sql).
-- Jalankan sekali di Supabase Dashboard > SQL Editor. Aman diulang (IF NOT EXISTS).
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_anon_full_access" ON public.app_settings;
CREATE POLICY "app_anon_full_access" ON public.app_settings
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO anon, authenticated;

-- Perubahan dari perangkat lain langsung terbaca.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'app_settings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;
    END IF;
END $$;
