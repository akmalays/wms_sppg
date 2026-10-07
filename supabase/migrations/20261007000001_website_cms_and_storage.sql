-- ==============================================================================
-- SATUAN PELAYANAN PEMENUHAN GIZI (SPPG) MLG TUMPANG JERU
-- MIGRATION: WEBSITE CMS CONFIG & OBJECT STORAGE FOR MEDIA (PHOTOS & VIDEOS)
-- ==============================================================================

-- 1. TABEL METADATA KONFIGURASI WEBSITE PUBLIK
-- Menyimpan struktur JSON teks (hero, slide menu MBG, kajian visual nampan)
-- Sangat ringan (< 15 KB), cepat di-query, dan tidak membebani memori database PostgreSQL.
CREATE TABLE IF NOT EXISTS public.website_cms_config (
    id TEXT PRIMARY KEY DEFAULT 'default',
    config JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT DEFAULT 'admin'
);

-- Aktifkan Row-Level Security (RLS)
ALTER TABLE public.website_cms_config ENABLE ROW LEVEL SECURITY;

-- Kebijakan Akses: Publik (anon & authenticated) dapat membaca konfigurasi website
DROP POLICY IF EXISTS "Public can view website config" ON public.website_cms_config;
CREATE POLICY "Public can view website config"
    ON public.website_cms_config
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Kebijakan Akses: Admin / User aplikasi dapat memperbarui konfigurasi website
DROP POLICY IF EXISTS "Allow manage website config" ON public.website_cms_config;
CREATE POLICY "Allow manage website config"
    ON public.website_cms_config
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 2. REGISTRASI OBJECT STORAGE BUCKET 'sppg-assets'
-- Standar industri untuk media biner: Video MP4 & Foto WebP disimpan di Object Storage
-- (bukan disimpan di tabel SQL sebagai bytea/base64 agar database tidak bengkak dan lambat).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'sppg-assets',
    'sppg-assets',
    true,
    52428800, -- Batas maksimal 50 MB per file (cukup untuk video hero loop MP4 & foto WebP)
    ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm'];

-- 3. KEBIJAKAN AKSES STORAGE (RLS STORAGE.OBJECTS)
-- Publik dapat melihat/streaming semua gambar dan video melalui link CDN publik
DROP POLICY IF EXISTS "Public can view sppg-assets" ON storage.objects;
CREATE POLICY "Public can view sppg-assets"
    ON storage.objects
    FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'sppg-assets');

-- Izinkan upload aset media baru ke bucket sppg-assets
DROP POLICY IF EXISTS "Allow upload sppg-assets" ON storage.objects;
CREATE POLICY "Allow upload sppg-assets"
    ON storage.objects
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (bucket_id = 'sppg-assets');

-- Izinkan perbarui / replace aset media di sppg-assets
DROP POLICY IF EXISTS "Allow update sppg-assets" ON storage.objects;
CREATE POLICY "Allow update sppg-assets"
    ON storage.objects
    FOR UPDATE
    TO anon, authenticated
    USING (bucket_id = 'sppg-assets');

-- Izinkan penghapusan aset di sppg-assets
DROP POLICY IF EXISTS "Allow delete sppg-assets" ON storage.objects;
CREATE POLICY "Allow delete sppg-assets"
    ON storage.objects
    FOR DELETE
    TO anon, authenticated
    USING (bucket_id = 'sppg-assets');
