-- Tabel purchase_orders di database dibuat lewat dashboard dan tidak punya kolom penaut. Aplikasi
-- menyimpan tautan PO ke menu asal, dokumen penerimaan, dan belanja, tetapi tautan itu tidak ikut tersimpan,
-- sehingga hilang setiap kali data dimuat ulang (dan saat pantulan realtime). Akibatnya menu yang sudah
-- punya PO bisa diterbitkan PO lagi, dan barang yang sudah diterima dari PO bisa dibuatkan nota lagi
-- (PO dobel).
-- Jalankan sekali di Supabase Dashboard > SQL Editor. Aman diulang.

-- 0. Database baru: tabel dibuat dengan kolom yang dipakai aplikasi (di database lama langkah ini dilewati)
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id TEXT PRIMARY KEY,
    po_number TEXT NOT NULL,
    date DATE NOT NULL,
    delivery_date DATE,
    supplier_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC NOT NULL DEFAULT 0,
    shipping_cost NUMERIC NOT NULL DEFAULT 0,
    grand_total NUMERIC NOT NULL DEFAULT 0,
    payment_method TEXT,
    notes TEXT,
    created_by TEXT,
    approved_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ
);

-- 1. Kolom penaut dan data supplier
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS supplier_id TEXT;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS supplier_address TEXT;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS supplier_contact TEXT;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS delivery_terms TEXT;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS delivery_time TEXT;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS related_menu_order_id TEXT;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS related_receiving_id TEXT;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS related_expense_ids JSONB;

CREATE INDEX IF NOT EXISTS purchase_orders_menu_idx ON public.purchase_orders (related_menu_order_id);
CREATE INDEX IF NOT EXISTS purchase_orders_receiving_idx ON public.purchase_orders (related_receiving_id);

-- 2. Isi ulang tautan PO lama sebisanya.
-- 2a. PO dari menu: catatannya "PO dibuat otomatis dari Perencanaan Menu: <judul menu> (<porsi> porsi)."
--     dan tanggalnya sama dengan tanggal menu (PO lama) atau H-1 (PO baru).
UPDATE public.purchase_orders po
SET related_menu_order_id = m.id
FROM public.menu_orders m
WHERE po.related_menu_order_id IS NULL
  AND po.notes LIKE 'PO dibuat otomatis dari Perencanaan Menu: ' || m.menu_title || ' (%'
  AND (m.date::date = po.date::date OR m.date::date = po.date::date + 1);

-- 2b. PO yang sudah diterima lewat timbang PO: dokumen penerimaannya mencatat nomor PO
--     ("Penerimaan & penimbangan fisik dari PO <nomor>"), atau mutasi stoknya merujuk nomor PO.
UPDATE public.purchase_orders po
SET related_receiving_id = r.id
FROM public.receiving_documents r
WHERE po.related_receiving_id IS NULL
  AND po.status = 'SELESAI'
  AND r.notes LIKE '%PO ' || po.po_number || '%';

-- 3. Cek PO dobel untuk menu yang sama setelah tautan terisi: hasilnya perlu diperiksa dan
--    PO yang tidak terpakai (biasanya yang belum diterima) dihapus dari Barang Masuk.
-- SELECT related_menu_order_id, array_agg(po_number || ' ' || supplier_name || ' [' || status || ']' ORDER BY created_at)
-- FROM public.purchase_orders
-- WHERE related_menu_order_id IS NOT NULL
-- GROUP BY related_menu_order_id, supplier_name
-- HAVING count(*) > 1;
