-- Enum user_role di database dibuat dari skema lama (SUPER_ADMIN, WAREHOUSE_STAFF, MANAGER,
-- PURCHASING, ...). CREATE TYPE di skema utama dilewati karena tipe sudah ada, sehingga lima
-- peran yang dipakai aplikasi tidak pernah ditambahkan. Akibatnya setiap insert ke audit_logs
-- dan inventory_transactions ditolak: "invalid input value for enum user_role".
-- Nilai lama dibiarkan agar baris dan profil yang sudah ada tetap valid.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'SUPERADMIN';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'ADMIN';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'KA_SPPG';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'ASLAP';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'AKUNTAN';
