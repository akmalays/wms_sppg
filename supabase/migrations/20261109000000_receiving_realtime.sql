-- Daftar Barang Masuk dimuat ulang dari perubahan dokumen dan rinciannya. Rincian tiba setelah dokumen,
-- jadi tanpa siaran dari receiving_lines perangkat lain melihat dokumen kosong sampai halaman dimuat ulang.
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['receiving_documents', 'receiving_lines']
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
        END IF;
    END LOOP;
END $$;
