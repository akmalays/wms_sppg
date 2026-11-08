-- Bucket foto dokumentasi (foto nota, surat jalan, timbangan) yang dipakai uploadDocumentationPhoto.
-- Foto sudah dikompres ke WebP di browser, jadi batas 2 MB per file cukup longgar dan menahan
-- unggahan mentah yang lolos kompresi. Tanpa bucket ini aplikasi tidak akan menyimpan foto.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'sppg-documentation',
    'sppg-documentation',
    true,
    2097152,
    ARRAY['image/webp', 'image/jpeg']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/webp', 'image/jpeg'];

DROP POLICY IF EXISTS "Public can view sppg-documentation" ON storage.objects;
CREATE POLICY "Public can view sppg-documentation"
    ON storage.objects
    FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'sppg-documentation');

DROP POLICY IF EXISTS "Allow upload sppg-documentation" ON storage.objects;
CREATE POLICY "Allow upload sppg-documentation"
    ON storage.objects
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (bucket_id = 'sppg-documentation');

-- Foto yang dihapus dari dokumen ikut dihapus dari storage agar kuota tidak terpakai sia-sia
DROP POLICY IF EXISTS "Allow delete sppg-documentation" ON storage.objects;
CREATE POLICY "Allow delete sppg-documentation"
    ON storage.objects
    FOR DELETE
    TO anon, authenticated
    USING (bucket_id = 'sppg-documentation');
