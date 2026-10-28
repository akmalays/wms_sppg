-- Uji hedonik lewat QR: setiap sekolah per menu mendapat kode acak yang dicetak sebagai QR di dokumen
-- pengiriman. Guru/PIC memindai, membuka /nilai/<kode> tanpa login, lalu mengisi nilai dan kritik.
--
-- hedonic_links     : kode QR -> sekolah, menu, tanggal. Dibuat aplikasi saat dokumen pengiriman dicetak.
-- hedonic_responses : isian penilai. Dari halaman publik hanya bisa ditambah lewat fungsi
--                     submit_hedonic_response, yang memeriksa kode, batas waktu, dan isi nilai.
--                     Aplikasi (kunci anon, sama seperti tabel lain) bisa membaca dan menghapus isian.
--
-- Jalankan sekali di Supabase Dashboard > SQL Editor. Aman diulang.

CREATE TABLE IF NOT EXISTS public.hedonic_links (
    token TEXT PRIMARY KEY,
    menu_order_id TEXT NOT NULL,
    school_id TEXT NOT NULL,
    school_name TEXT NOT NULL,
    school_category TEXT,
    delivery_date DATE NOT NULL,
    meal_session TEXT,
    menu_title TEXT NOT NULL,
    menu_description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (menu_order_id, school_id)
);

CREATE TABLE IF NOT EXISTS public.hedonic_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT NOT NULL REFERENCES public.hedonic_links(token) ON DELETE CASCADE,
    menu_order_id TEXT NOT NULL,
    school_id TEXT NOT NULL,
    school_name TEXT NOT NULL,
    delivery_date DATE NOT NULL,
    menu_title TEXT NOT NULL,
    rater_role TEXT NOT NULL,
    rater_class TEXT,
    -- {"MP": {"rasa": 4, "warna": 5, "aroma": 4, "tekstur": 3}, "LH": {...}, ...}
    scores JSONB NOT NULL,
    overall NUMERIC(3, 2) NOT NULL,
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hedonic_responses_date_idx ON public.hedonic_responses (delivery_date DESC);
CREATE INDEX IF NOT EXISTS hedonic_responses_token_idx ON public.hedonic_responses (token);

ALTER TABLE public.hedonic_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hedonic_responses ENABLE ROW LEVEL SECURITY;

-- Tautan: dibaca halaman publik (berdasarkan kode) dan dibuat aplikasi saat mencetak
DROP POLICY IF EXISTS "hedonic_links_read" ON public.hedonic_links;
CREATE POLICY "hedonic_links_read" ON public.hedonic_links FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "hedonic_links_insert" ON public.hedonic_links;
CREATE POLICY "hedonic_links_insert" ON public.hedonic_links FOR INSERT TO anon, authenticated WITH CHECK (true);
GRANT SELECT, INSERT ON public.hedonic_links TO anon, authenticated;

-- Isian: tidak ada kebijakan INSERT, jadi penambahan hanya lewat fungsi di bawah
DROP POLICY IF EXISTS "hedonic_responses_read" ON public.hedonic_responses;
CREATE POLICY "hedonic_responses_read" ON public.hedonic_responses FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "hedonic_responses_delete" ON public.hedonic_responses;
CREATE POLICY "hedonic_responses_delete" ON public.hedonic_responses FOR DELETE TO anon, authenticated USING (true);
GRANT SELECT, DELETE ON public.hedonic_responses TO anon, authenticated;
REVOKE INSERT, UPDATE ON public.hedonic_responses FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_hedonic_response(
    p_token TEXT,
    p_rater_role TEXT,
    p_rater_class TEXT,
    p_scores JSONB,
    p_comment TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_link public.hedonic_links;
    v_sample TEXT;
    v_param TEXT;
    v_value INT;
    v_sum INT := 0;
    v_count INT := 0;
    v_id UUID;
BEGIN
    SELECT * INTO v_link FROM public.hedonic_links WHERE token = p_token;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'QR_TIDAK_DIKENAL';
    END IF;

    -- Diterima dari hari pengiriman sampai 3 hari sesudahnya (waktu Indonesia Barat)
    IF (now() AT TIME ZONE 'Asia/Jakarta')::date NOT BETWEEN v_link.delivery_date AND v_link.delivery_date + 3 THEN
        RAISE EXCEPTION 'QR_KEDALUWARSA';
    END IF;

    -- Batas isian per sekolah per menu, agar tautan yang tersebar tidak membanjiri rekap
    IF (SELECT count(*) FROM public.hedonic_responses WHERE token = p_token) >= 300 THEN
        RAISE EXCEPTION 'BATAS_ISIAN';
    END IF;

    IF p_rater_role NOT IN ('Siswa', 'Guru', 'PIC sekolah', 'Orang tua', 'Lainnya') THEN
        RAISE EXCEPTION 'PENILAI_TIDAK_VALID';
    END IF;

    IF jsonb_typeof(p_scores) <> 'object' THEN
        RAISE EXCEPTION 'NILAI_TIDAK_VALID';
    END IF;

    FOR v_sample IN SELECT jsonb_object_keys(p_scores) LOOP
        IF v_sample NOT IN ('MP', 'LH', 'LN', 'S', 'B') THEN
            RAISE EXCEPTION 'NILAI_TIDAK_VALID';
        END IF;
        FOR v_param IN SELECT jsonb_object_keys(p_scores -> v_sample) LOOP
            IF v_param NOT IN ('rasa', 'warna', 'aroma', 'tekstur') THEN
                RAISE EXCEPTION 'NILAI_TIDAK_VALID';
            END IF;
            v_value := (p_scores -> v_sample ->> v_param)::INT;
            IF v_value IS NULL OR v_value < 1 OR v_value > 5 THEN
                RAISE EXCEPTION 'NILAI_TIDAK_VALID';
            END IF;
            v_sum := v_sum + v_value;
            v_count := v_count + 1;
        END LOOP;
    END LOOP;

    IF v_count = 0 THEN
        RAISE EXCEPTION 'NILAI_KOSONG';
    END IF;

    INSERT INTO public.hedonic_responses (
        token, menu_order_id, school_id, school_name, delivery_date, menu_title,
        rater_role, rater_class, scores, overall, comment
    ) VALUES (
        p_token, v_link.menu_order_id, v_link.school_id, v_link.school_name, v_link.delivery_date, v_link.menu_title,
        p_rater_role, NULLIF(left(trim(coalesce(p_rater_class, '')), 60), ''), p_scores,
        round(v_sum::numeric / v_count, 2), NULLIF(left(trim(coalesce(p_comment, '')), 1000), '')
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_hedonic_response(TEXT, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_hedonic_response(TEXT, TEXT, TEXT, JSONB, TEXT) TO anon, authenticated;
