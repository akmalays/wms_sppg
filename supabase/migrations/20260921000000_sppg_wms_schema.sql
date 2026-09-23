-- ==============================================================================
-- SATUAN PELAYANAN PEMENUHAN GIZI (SPPG) - WMS DATABASE SCHEMA & RBAC
-- Target: Supabase (PostgreSQL 15+)
-- 5 Roles: SUPERADMIN, ADMIN, KA_SPPG, ASLAP, AKUNTAN
-- ==============================================================================

-- 1. EXTENSIONS & ENUMS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Role-Based Access Control (RBAC) User Roles (5 Peran Resmi SPPG)
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
        'SUPERADMIN',
        'ADMIN',
        'KA_SPPG',
        'ASLAP',
        'AKUNTAN'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Classification Types
DO $$ BEGIN
    CREATE TYPE item_type AS ENUM (
        'FOOD_DAILY_FLOW',
        'FOOD_CARRYING_STOCK',
        'OPERATIONAL_CONSUMABLE',
        'EQUIPMENT'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE receiving_status AS ENUM (
        'DRAFT',
        'VERIFIED_POSTED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM (
        'RECEIVING',
        'ISSUE_CONSUMPTION',
        'ADJUSTMENT',
        'STOCK_OPNAME_ADJUSTMENT'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE opname_status AS ENUM (
        'DRAFT',
        'PENDING_APPROVAL',
        'APPROVED',
        'REJECTED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE equipment_condition AS ENUM (
        'GOOD',
        'NEEDS_INSPECTION',
        'DAMAGED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE equipment_status AS ENUM (
        'ACTIVE',
        'IN_REPAIR',
        'LOST',
        'RETIRED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==============================================================================
-- 2. USER PROFILES & RBAC HELPER
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'ASLAP',
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helper function to get current authenticated user's role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Trigger to auto-create public.profiles when auth.users is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, role)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
        COALESCE((new.raw_user_meta_data->>'role')::user_role, 'ASLAP')
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==============================================================================
-- 3. WAREHOUSE MASTER TABLES
-- ==============================================================================

-- Lokasi Penyimpanan (Gudang Kering, Chiller, Freezer, Dapur Masak, dsb.)
CREATE TABLE IF NOT EXISTS public.warehouse_locations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Master Supplier / Pemasok Bahan Pangan & Alat
CREATE TABLE IF NOT EXISTS public.suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact_person TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    supply_category TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Master Barang (SKU Pangan, Bumbu, Kemasan, Alat Kerja)
CREATE TABLE IF NOT EXISTS public.item_master (
    id TEXT PRIMARY KEY, -- SKU, e.g. ITM-SMB-001
    name TEXT NOT NULL,
    item_type item_type NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT,
    base_unit TEXT NOT NULL,
    minimum_stock NUMERIC(12, 2) NOT NULL DEFAULT 0,
    reorder_point NUMERIC(12, 2) NOT NULL DEFAULT 0,
    current_stock NUMERIC(12, 2) NOT NULL DEFAULT 0,
    location_id TEXT REFERENCES public.warehouse_locations(id),
    expiry_tracking_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    last_movement_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 4. OPERATIONAL TRANSACTIONS TABLES
-- ==============================================================================

-- Penerimaan Barang (Goods Receipt Header)
CREATE TABLE IF NOT EXISTS public.receiving_documents (
    id TEXT PRIMARY KEY, -- e.g. GR-2026-0001
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    arrival_time TIME NOT NULL,
    supplier_id TEXT NOT NULL REFERENCES public.suppliers(id),
    delivery_note_no TEXT,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id),
    status receiving_status NOT NULL DEFAULT 'DRAFT',
    notes TEXT,
    supplier_signature TEXT,
    receiver_signature TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Penerimaan Barang Rincian (Goods Receipt Lines)
CREATE TABLE IF NOT EXISTS public.receiving_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id TEXT NOT NULL REFERENCES public.receiving_documents(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL REFERENCES public.item_master(id),
    item_name TEXT NOT NULL,
    category TEXT NOT NULL,
    quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
    unit TEXT NOT NULL,
    condition_note TEXT,
    batch_number TEXT,
    expiry_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Buku Besar Mutasi Stok (Inventory Ledger)
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    item_id TEXT NOT NULL REFERENCES public.item_master(id),
    item_name TEXT NOT NULL,
    item_type item_type NOT NULL,
    category TEXT NOT NULL,
    location_id TEXT,
    quantity NUMERIC(12, 2) NOT NULL, -- Positif untuk masuk, negatif untuk keluar
    unit TEXT NOT NULL,
    transaction_type transaction_type NOT NULL,
    reference_document TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES public.profiles(id),
    user_name TEXT NOT NULL,
    user_role user_role NOT NULL,
    balance_after NUMERIC(12, 2) NOT NULL,
    notes TEXT
);

-- Stock Opname Sessions (Header Sesi Opname)
CREATE TABLE IF NOT EXISTS public.stock_opname_sessions (
    id TEXT PRIMARY KEY, -- e.g. SO-2026-0001
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    location_id TEXT REFERENCES public.warehouse_locations(id),
    created_by_id UUID NOT NULL REFERENCES public.profiles(id),
    status opname_status NOT NULL DEFAULT 'DRAFT',
    approved_by_id UUID REFERENCES public.profiles(id),
    approved_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stock Opname Detail Baris
CREATE TABLE IF NOT EXISTS public.stock_opname_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id TEXT NOT NULL REFERENCES public.stock_opname_sessions(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL REFERENCES public.item_master(id),
    item_name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT NOT NULL,
    system_stock NUMERIC(12, 2) NOT NULL,
    physical_count NUMERIC(12, 2) NOT NULL,
    variance NUMERIC(12, 2) GENERATED ALWAYS AS (physical_count - system_stock) STORED,
    reason TEXT
);

-- Peralatan Dapur & Alat Kerja (Equipment Master)
CREATE TABLE IF NOT EXISTS public.equipment_items (
    id TEXT PRIMARY KEY, -- e.g. EQ-KIT-001
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit TEXT NOT NULL DEFAULT 'Unit',
    location_id TEXT REFERENCES public.warehouse_locations(id),
    condition equipment_condition NOT NULL DEFAULT 'GOOD',
    status equipment_status NOT NULL DEFAULT 'ACTIVE',
    assigned_to TEXT,
    last_inspected_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Aliran Harian Bahan Segar Dapur (Daily Flow Consumables)
CREATE TABLE IF NOT EXISTS public.daily_flow_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    item_id TEXT NOT NULL REFERENCES public.item_master(id),
    item_name TEXT NOT NULL,
    opening_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
    received_today NUMERIC(12, 2) NOT NULL DEFAULT 0,
    consumed_today NUMERIC(12, 2) NOT NULL DEFAULT 0,
    closing_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
    recorded_by_id UUID REFERENCES public.profiles(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (date, item_id)
);

-- Immutable Audit Trail Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID NOT NULL REFERENCES public.profiles(id),
    user_name TEXT NOT NULL,
    user_role user_role NOT NULL,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- ==============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES PER ROLE (5 PERAN SPPG)
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receiving_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receiving_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_opname_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_opname_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_flow_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 5.1 Profiles Policies
CREATE POLICY "Profiles viewable by authenticated users"
    ON public.profiles FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Profiles editable by self or superadmin"
    ON public.profiles FOR UPDATE TO authenticated
    USING (auth.uid() = id OR public.get_user_role() = 'SUPERADMIN');

-- 5.2 Warehouse Locations Policies
CREATE POLICY "Locations viewable by all authenticated users"
    ON public.warehouse_locations FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Locations manageable by superadmin, ka sppg, or admin"
    ON public.warehouse_locations FOR ALL TO authenticated
    USING (public.get_user_role() IN ('SUPERADMIN', 'KA_SPPG', 'ADMIN'));

-- 5.3 Suppliers Policies
CREATE POLICY "Suppliers viewable by all authenticated users"
    ON public.suppliers FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Suppliers manageable by superadmin, ka sppg, admin, or akuntan"
    ON public.suppliers FOR INSERT TO authenticated
    WITH CHECK (public.get_user_role() IN ('SUPERADMIN', 'KA_SPPG', 'ADMIN', 'AKUNTAN'));

CREATE POLICY "Suppliers editable by superadmin, ka sppg, admin, or akuntan"
    ON public.suppliers FOR UPDATE TO authenticated
    USING (public.get_user_role() IN ('SUPERADMIN', 'KA_SPPG', 'ADMIN', 'AKUNTAN'));

-- 5.4 Item Master Policies
CREATE POLICY "Item master viewable by all authenticated users"
    ON public.item_master FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Item master manageable by superadmin, ka sppg, or admin"
    ON public.item_master FOR INSERT TO authenticated
    WITH CHECK (public.get_user_role() IN ('SUPERADMIN', 'KA_SPPG', 'ADMIN'));

CREATE POLICY "Item master editable by superadmin, ka sppg, or admin"
    ON public.item_master FOR UPDATE TO authenticated
    USING (public.get_user_role() IN ('SUPERADMIN', 'KA_SPPG', 'ADMIN'));

-- 5.5 Receiving Documents & Lines Policies
CREATE POLICY "Receiving docs viewable by all authenticated users"
    ON public.receiving_documents FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Receiving docs creatable by aslap, admin, akuntan, and superadmin"
    ON public.receiving_documents FOR INSERT TO authenticated
    WITH CHECK (public.get_user_role() IN ('SUPERADMIN', 'ADMIN', 'ASLAP', 'AKUNTAN'));

CREATE POLICY "Receiving docs updatable by superadmin, ka sppg, admin, or akuntan"
    ON public.receiving_documents FOR UPDATE TO authenticated
    USING (public.get_user_role() IN ('SUPERADMIN', 'KA_SPPG', 'ADMIN', 'AKUNTAN'));

CREATE POLICY "Receiving lines viewable by all authenticated users"
    ON public.receiving_lines FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Receiving lines manageable with document"
    ON public.receiving_lines FOR ALL TO authenticated
    USING (public.get_user_role() IN ('SUPERADMIN', 'ADMIN', 'ASLAP', 'AKUNTAN'));

-- 5.6 Inventory Transactions (Ledger) Policies
CREATE POLICY "Ledger viewable by all authenticated users"
    ON public.inventory_transactions FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Ledger insertable by operations (aslap, admin, superadmin)"
    ON public.inventory_transactions FOR INSERT TO authenticated
    WITH CHECK (public.get_user_role() IN ('SUPERADMIN', 'ADMIN', 'ASLAP'));

-- 5.7 Stock Opname Sessions & Items Policies
CREATE POLICY "Opname sessions viewable by all authenticated users"
    ON public.stock_opname_sessions FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Opname sessions creatable by all operational roles"
    ON public.stock_opname_sessions FOR INSERT TO authenticated
    WITH CHECK (public.get_user_role() IN ('SUPERADMIN', 'KA_SPPG', 'ADMIN', 'ASLAP', 'AKUNTAN'));

CREATE POLICY "Opname sessions approval by ka sppg, akuntan, or superadmin"
    ON public.stock_opname_sessions FOR UPDATE TO authenticated
    USING (public.get_user_role() IN ('SUPERADMIN', 'KA_SPPG', 'AKUNTAN'));

CREATE POLICY "Opname items viewable by all authenticated users"
    ON public.stock_opname_items FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Opname items manageable by opname crew"
    ON public.stock_opname_items FOR ALL TO authenticated
    USING (public.get_user_role() IN ('SUPERADMIN', 'KA_SPPG', 'ADMIN', 'ASLAP', 'AKUNTAN'));

-- 5.8 Equipment Items Policies
CREATE POLICY "Equipment viewable by all authenticated users"
    ON public.equipment_items FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Equipment manageable by aslap, admin, and superadmin"
    ON public.equipment_items FOR ALL TO authenticated
    USING (public.get_user_role() IN ('SUPERADMIN', 'ADMIN', 'ASLAP'));

-- 5.9 Daily Flow Logs Policies
CREATE POLICY "Daily flow viewable by all authenticated users"
    ON public.daily_flow_logs FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Daily flow manageable by aslap, admin, and superadmin"
    ON public.daily_flow_logs FOR ALL TO authenticated
    USING (public.get_user_role() IN ('SUPERADMIN', 'ADMIN', 'ASLAP'));

-- 5.10 Audit Logs (Immutable) Policies
CREATE POLICY "Audit logs viewable by leadership & audit (superadmin, ka sppg, admin, akuntan)"
    ON public.audit_logs FOR SELECT TO authenticated
    USING (public.get_user_role() IN ('SUPERADMIN', 'KA_SPPG', 'ADMIN', 'AKUNTAN'));

CREATE POLICY "Audit logs insertable by system/authenticated users"
    ON public.audit_logs FOR INSERT TO authenticated
    WITH CHECK (true);

-- No UPDATE or DELETE policy on audit_logs to preserve audit trail integrity!

-- ==============================================================================
-- 6. DEFAULT SEED DATA
-- ==============================================================================
INSERT INTO public.warehouse_locations (id, name, description) VALUES
    ('LOC-DRY-01', 'Gudang Kering Utama', 'Penyimpanan sembako, beras, minyak, bumbu kering & kaleng'),
    ('LOC-CHILL-01', 'Chiller Bahan Segar', 'Suhu 2-4°C untuk sayur, buah segar, telur & bumbu basah'),
    ('LOC-FRZ-01', 'Cold Storage Freezer', 'Suhu -18°C untuk daging sapi, ayam, ikan & protein beku'),
    ('LOC-KIT-01', 'Dapur Pengolahan SPPG', 'Area persiapan dan memasak porsi gizi harian'),
    ('LOC-OPS-01', 'Gudang Non-Food & Logistik', 'Penyimpanan kemasan food grade, sabun, APD & peralatan')
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 7. PENGELUARAN NON-FOOD, ORDER MENU GIZI, & REKAP LIMBAH (SPPG CORE WORKFLOWS)
-- ==============================================================================

-- 7.1 Pengeluaran Non-Food (Peralatan, ATK, Pembersih, APD)
CREATE TABLE IF NOT EXISTS public.nonfood_expenses (
    id TEXT PRIMARY KEY, -- e.g. NFE-2026-001
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    category TEXT NOT NULL, -- Peralatan Dapur, ATK & Dokumentasi, Bahan Pembersih & Sanitasi, etc.
    item_name TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
    unit TEXT NOT NULL DEFAULT 'Pcs',
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
    department TEXT NOT NULL DEFAULT 'Dapur Pengolahan Utama',
    recipient TEXT NOT NULL,
    recorded_by TEXT NOT NULL,
    receipt_ref TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7.2 Rekap Order Menu Gizi (Perencanaan Menu & Target Porsi SPPG)
CREATE TABLE IF NOT EXISTS public.menu_orders (
    id TEXT PRIMARY KEY, -- e.g. ORD-2026-001
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    meal_session TEXT NOT NULL, -- Pagi, Siang, Snack
    menu_title TEXT NOT NULL,
    menu_description TEXT,
    target_portions INTEGER NOT NULL DEFAULT 250,
    status TEXT NOT NULL DEFAULT 'PLANNED', -- PLANNED, PREPPING, COOKING, DISTRIBUTED, COMPLETED, CANCELLED
    key_ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
    chef_in_charge TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7.3 Rekap Limbah Tercatat (Log Limbah Dapur, Bahan Rusak, Sisa Pangan, Non-Organik)
CREATE TABLE IF NOT EXISTS public.waste_logs (
    id TEXT PRIMARY KEY, -- e.g. WST-2026-001
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    waste_category TEXT NOT NULL, -- Limbah Olahan Dapur, Bahan Rusak / Kadaluarsa, etc.
    item_name TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'Kg',
    source_area TEXT NOT NULL DEFAULT 'Ruang Preparasi Sayuran',
    reason TEXT NOT NULL,
    disposal_method TEXT NOT NULL DEFAULT 'Kompos Organik', -- Kompos Organik, Pakan Maggot / Ternak, Bank Sampah, TPS
    recorded_by TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.nonfood_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waste_logs ENABLE ROW LEVEL SECURITY;

-- Non-food expenses RLS policies
CREATE POLICY "Nonfood expenses viewable by all authenticated users"
    ON public.nonfood_expenses FOR SELECT TO authenticated USING (true);

CREATE POLICY "Nonfood expenses manageable by superadmin, ka sppg, admin, and akuntan"
    ON public.nonfood_expenses FOR ALL TO authenticated
    USING (public.get_user_role() IN ('SUPERADMIN', 'KA_SPPG', 'ADMIN', 'AKUNTAN'));

-- Menu orders RLS policies
CREATE POLICY "Menu orders viewable by all authenticated users"
    ON public.menu_orders FOR SELECT TO authenticated USING (true);

CREATE POLICY "Menu orders manageable by operational roles"
    ON public.menu_orders FOR ALL TO authenticated
    USING (public.get_user_role() IN ('SUPERADMIN', 'KA_SPPG', 'ADMIN', 'ASLAP'));

-- Waste logs RLS policies
CREATE POLICY "Waste logs viewable by all authenticated users"
    ON public.waste_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Waste logs manageable by operational crew"
    ON public.waste_logs FOR ALL TO authenticated
    USING (public.get_user_role() IN ('SUPERADMIN', 'KA_SPPG', 'ADMIN', 'ASLAP'));

