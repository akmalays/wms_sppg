-- ==============================================================================
-- Sinkronisasi data yang sebelumnya hanya tersimpan di browser:
-- karyawan, absensi, riwayat aktivitas, stok opname, tugas harian, penerima manfaat.
--
-- Konteks: login aplikasi masih memakai akun lokal (ID "USR-xxx", bukan UUID Supabase Auth),
-- dan aplikasi mengakses database dengan kunci anon. Karena itu:
--   1. Kolom ID petugas diubah ke TEXT dan relasi ke tabel profiles dilepas.
--   2. Kebijakan RLS mengizinkan peran anon, sama seperti tabel operasional lain.
-- Jalankan sekali di Supabase Dashboard > SQL Editor. Aman diulang (IF NOT EXISTS).
-- Semua tabel yang diubah di sini kosong saat migrasi ini ditulis (dicek 17 Okt 2026).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. TUGAS HARIAN (tabel baru) - dibuat paling awal karena dipakai bagian 7 dan 8
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_todos (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL,
    title TEXT NOT NULL,
    category TEXT,
    priority TEXT,
    session TEXT,
    target_time TEXT,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TEXT,
    completed_by TEXT,
    assigned_role TEXT,
    assigned_user_id TEXT,
    assigned_user_name TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS daily_todos_date_idx ON public.daily_todos (date);
CREATE INDEX IF NOT EXISTS attendance_logs_date_idx ON public.attendance_logs (date);
CREATE INDEX IF NOT EXISTS audit_logs_timestamp_idx ON public.audit_logs (timestamp DESC);

-- ------------------------------------------------------------------------------
-- 1. KARYAWAN (tabel sudah ada, kolomnya minim)
-- ------------------------------------------------------------------------------
ALTER TABLE public.employees
    ADD COLUMN IF NOT EXISTS nik TEXT,
    ADD COLUMN IF NOT EXISTS nip TEXT,
    ADD COLUMN IF NOT EXISTS gender TEXT,
    ADD COLUMN IF NOT EXISTS department TEXT,
    ADD COLUMN IF NOT EXISTS position TEXT,
    ADD COLUMN IF NOT EXISTS employment_type TEXT,
    ADD COLUMN IF NOT EXISTS shift TEXT,
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'AKTIF',
    ADD COLUMN IF NOT EXISTS address TEXT,
    ADD COLUMN IF NOT EXISTS emergency_contact TEXT,
    ADD COLUMN IF NOT EXISTS avatar_url TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT;

-- Kolom lama yang tidak selalu diisi aplikasi dibuat boleh kosong.
ALTER TABLE public.employees ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE public.employees ALTER COLUMN join_date DROP NOT NULL;
ALTER TABLE public.employees ALTER COLUMN role DROP NOT NULL;
ALTER TABLE public.employees ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.employees ALTER COLUMN is_active DROP NOT NULL;

-- ------------------------------------------------------------------------------
-- 2. ABSENSI (tabel sudah ada, kolomnya minim)
-- ------------------------------------------------------------------------------
ALTER TABLE public.attendance_logs
    ADD COLUMN IF NOT EXISTS employee_name TEXT,
    ADD COLUMN IF NOT EXISTS department TEXT,
    ADD COLUMN IF NOT EXISTS position TEXT,
    ADD COLUMN IF NOT EXISTS shift TEXT,
    ADD COLUMN IF NOT EXISTS check_in_time TEXT,
    ADD COLUMN IF NOT EXISTS check_out_time TEXT,
    ADD COLUMN IF NOT EXISTS late_minutes INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS photo_url TEXT,
    ADD COLUMN IF NOT EXISTS recorded_by TEXT,
    ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ------------------------------------------------------------------------------
-- 3. PENERIMA MANFAAT (tabel sudah ada, kolomnya minim)
-- ------------------------------------------------------------------------------
ALTER TABLE public.school_beneficiaries
    ADD COLUMN IF NOT EXISTS category TEXT,
    ADD COLUMN IF NOT EXISTS portion_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS delivery_time TEXT,
    ADD COLUMN IF NOT EXISTS contact_person TEXT,
    ADD COLUMN IF NOT EXISTS phone TEXT,
    ADD COLUMN IF NOT EXISTS status TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT;

-- ------------------------------------------------------------------------------
-- 4. RIWAYAT AKTIVITAS: ID petugas lokal (USR-xxx) dan rincian berupa teks biasa
-- ------------------------------------------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT conname FROM pg_constraint
             WHERE conrelid = 'public.audit_logs'::regclass AND contype = 'f'
    LOOP
        EXECUTE format('ALTER TABLE public.audit_logs DROP CONSTRAINT %I', r.conname);
    END LOOP;
END $$;

ALTER TABLE public.audit_logs ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.audit_logs ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE public.audit_logs ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE public.audit_logs ALTER COLUMN details DROP DEFAULT;
ALTER TABLE public.audit_logs ALTER COLUMN details TYPE TEXT USING details::text;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ------------------------------------------------------------------------------
-- 5. STOK OPNAME: ID petugas lokal, lokasi berupa teks, nama petugas disimpan
-- ------------------------------------------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT conname FROM pg_constraint
             WHERE conrelid = 'public.stock_opname_sessions'::regclass
               AND contype = 'f'
               AND confrelid = 'public.profiles'::regclass
    LOOP
        EXECUTE format('ALTER TABLE public.stock_opname_sessions DROP CONSTRAINT %I', r.conname);
    END LOOP;
END $$;

ALTER TABLE public.stock_opname_sessions ALTER COLUMN created_by_id TYPE TEXT USING created_by_id::text;
ALTER TABLE public.stock_opname_sessions ALTER COLUMN approved_by_id TYPE TEXT USING approved_by_id::text;
ALTER TABLE public.stock_opname_sessions
    ADD COLUMN IF NOT EXISTS location TEXT,
    ADD COLUMN IF NOT EXISTS created_by_name TEXT,
    ADD COLUMN IF NOT EXISTS approved_by_name TEXT;

ALTER TABLE public.stock_opname_items ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.stock_opname_items ALTER COLUMN id TYPE TEXT USING id::text;

-- ------------------------------------------------------------------------------
-- 7. HAK AKSES (RLS) untuk kunci anon
-- ------------------------------------------------------------------------------
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_opname_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_opname_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['employees', 'attendance_logs', 'school_beneficiaries',
                             'stock_opname_sessions', 'stock_opname_items', 'daily_todos']
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "app_anon_full_access" ON public.%I', t);
        EXECUTE format(
            'CREATE POLICY "app_anon_full_access" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)',
            t
        );
    END LOOP;
END $$;

-- Riwayat aktivitas hanya boleh dibaca dan ditambah: tanpa UPDATE/DELETE agar tidak bisa diubah.
DROP POLICY IF EXISTS "app_anon_read_audit" ON public.audit_logs;
CREATE POLICY "app_anon_read_audit" ON public.audit_logs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "app_anon_insert_audit" ON public.audit_logs;
CREATE POLICY "app_anon_insert_audit" ON public.audit_logs FOR INSERT TO anon, authenticated WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees, public.attendance_logs, public.school_beneficiaries,
    public.stock_opname_sessions, public.stock_opname_items, public.daily_todos TO anon, authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO anon, authenticated;
REVOKE UPDATE, DELETE ON public.audit_logs FROM anon, authenticated;

-- ------------------------------------------------------------------------------
-- 8. REALTIME: perubahan dari perangkat lain langsung muncul tanpa muat ulang
-- ------------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['employees', 'attendance_logs', 'stock_opname_sessions', 'daily_todos', 'audit_logs']
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
        END IF;
    END LOOP;
END $$;
