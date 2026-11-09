import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { MenuOrder, SchoolBeneficiaryAllocation } from '../types/warehouse';

// Uji hedonik lewat QR (lihat supabase/migrations/20261028000000_hedonic_qr.sql).
// Kode, parameter, dan skala sama dengan Formulir Uji Organoleptik kertas.

export const HEDONIC_PATH = '/nilai/';
/** Pintu masuk tanpa kode (QR di halaman menu hari ini): penilai memilih sekolah, lalu diarahkan ke /nilai/<kode>. */
export const HEDONIC_ENTRY_PATH = '/nilai';

export const HEDONIC_SAMPLES: { code: string; label: string }[] = [
  { code: 'MP', label: 'Makanan pokok' },
  { code: 'LH', label: 'Lauk hewani' },
  { code: 'LN', label: 'Lauk nabati' },
  { code: 'S', label: 'Sayur' },
  { code: 'B', label: 'Buah' },
];
export const HEDONIC_PARAMS: { key: HedonicParam; label: string }[] = [
  { key: 'rasa', label: 'Rasa' },
  { key: 'warna', label: 'Warna' },
  { key: 'aroma', label: 'Aroma' },
  { key: 'tekstur', label: 'Tekstur' },
];
export const HEDONIC_SCALE = ['Tidak suka', 'Kurang suka', 'Sedikit suka', 'Suka', 'Sangat suka'];
export const HEDONIC_ROLES = ['Siswa', 'Guru', 'PIC sekolah', 'Orang tua', 'Lainnya'] as const;
/** Isian diterima dari hari pengiriman sampai H+3 (sama dengan pemeriksaan di database). */
export const HEDONIC_DAYS_OPEN = 3;

export type HedonicParam = 'rasa' | 'warna' | 'aroma' | 'tekstur';
export type HedonicScores = Record<string, Partial<Record<HedonicParam, number>>>;

export interface HedonicLink {
  token: string;
  menu_order_id: string;
  school_id: string;
  school_name: string;
  school_category?: string | null;
  delivery_date: string;
  meal_session?: string | null;
  menu_title: string;
  menu_description?: string | null;
}

export interface HedonicResponse {
  id: string;
  token: string;
  menu_order_id: string;
  school_id: string;
  school_name: string;
  delivery_date: string;
  menu_title: string;
  rater_role: string;
  rater_class?: string | null;
  scores: HedonicScores;
  overall: number;
  comment?: string | null;
  created_at: string;
}

export type HedonicMenu = Pick<MenuOrder, 'id' | 'date' | 'mealSession' | 'menuTitle' | 'menuDescription'>;
export type HedonicSchool = Pick<SchoolBeneficiaryAllocation, 'id' | 'schoolName' | 'category'>;

export const hedonicUrl = (token: string) => `${window.location.origin}${HEDONIC_PATH}${token}`;

export const hedonicTokenFromPath = (pathname: string) => {
  const m = pathname.match(/^\/nilai\/([A-Za-z0-9]+)\/?$/);
  return m ? m[1] : null;
};

// Tanpa huruf/angka yang mirip (0/O, 1/I/L) agar bisa diketik ulang bila QR rusak
const TOKEN_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newToken = () => {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => TOKEN_CHARS[b % TOKEN_CHARS.length]).join('');
};

/**
 * Kode QR per sekolah untuk satu menu. Kode yang sudah ada dipakai lagi, jadi cetak ulang menghasilkan QR yang sama
 * dan isian yang sudah masuk tetap terhubung.
 */
export async function ensureHedonicLinks(order: HedonicMenu, schools: HedonicSchool[]): Promise<Record<string, string>> {
  if (!isSupabaseConfigured() || schools.length === 0) return {};
  const ids = schools.map(s => s.id);
  const { data: existing, error } = await supabase
    .from('hedonic_links')
    .select('token, school_id')
    .eq('menu_order_id', order.id)
    .in('school_id', ids);
  if (error) throw error;

  const tokens: Record<string, string> = {};
  (existing || []).forEach(r => {
    tokens[r.school_id] = r.token;
  });
  const missing = schools.filter(s => !tokens[s.id]);
  if (missing.length > 0) {
    const rows = missing.map(s => ({
      token: newToken(),
      menu_order_id: order.id,
      school_id: s.id,
      school_name: s.schoolName,
      school_category: s.category,
      delivery_date: order.date,
      meal_session: order.mealSession,
      menu_title: order.menuTitle,
      menu_description: order.menuDescription || null,
    }));
    // Perangkat lain bisa membuat kode yang sama pada saat bersamaan: yang dobel diabaikan, lalu dibaca ulang
    const { error: insertError } = await supabase
      .from('hedonic_links')
      .upsert(rows, { onConflict: 'menu_order_id,school_id', ignoreDuplicates: true });
    if (insertError) throw insertError;
    const { data: fresh, error: rereadError } = await supabase
      .from('hedonic_links')
      .select('token, school_id')
      .eq('menu_order_id', order.id)
      .in('school_id', missing.map(s => s.id));
    if (rereadError) throw rereadError;
    (fresh || []).forEach(r => {
      tokens[r.school_id] = r.token;
    });
  }
  return tokens;
}

/** Menu terbaru dalam rentang tanggal yang masih menerima penilaian. Status menu tidak dipakai karena tidak selalu dimajukan petugas. */
export async function fetchOpenHedonicMenu(from: string, to: string): Promise<HedonicMenu | null> {
  const { data, error } = await supabase
    .from('menu_orders')
    .select('id, date, meal_session, menu_title, menu_description')
    .gte('date', from)
    .lte('date', to)
    .neq('status', 'CANCELLED')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { id: data.id, date: data.date, mealSession: data.meal_session, menuTitle: data.menu_title, menuDescription: data.menu_description };
}

// Halaman ini publik: kontak PIC sekolah sengaja tidak ikut diambil
export async function fetchHedonicSchools(): Promise<HedonicSchool[]> {
  const { data, error } = await supabase.from('school_beneficiaries').select('id, school_name, category').order('school_name');
  if (error) throw error;
  return (data || []).map(s => ({ id: s.id, schoolName: s.school_name, category: s.category }));
}

export async function fetchHedonicLink(token: string): Promise<HedonicLink | null> {
  const { data, error } = await supabase.from('hedonic_links').select('*').eq('token', token).maybeSingle();
  if (error) throw error;
  return (data as HedonicLink) || null;
}

const SUBMIT_ERRORS: Record<string, string> = {
  QR_TIDAK_DIKENAL: 'QR ini tidak dikenal. Pindai ulang QR di surat jalan.',
  QR_KEDALUWARSA: `Penilaian untuk menu ini sudah ditutup (hanya dibuka sampai ${HEDONIC_DAYS_OPEN} hari setelah pengiriman).`,
  BATAS_ISIAN: 'Jumlah penilaian untuk sekolah ini sudah mencapai batas.',
  PENILAI_TIDAK_VALID: 'Pilih siapa yang menilai.',
  NILAI_TIDAK_VALID: 'Ada nilai yang tidak valid. Muat ulang halaman lalu coba lagi.',
  NILAI_KOSONG: 'Beri nilai minimal satu makanan.',
};

export async function submitHedonicResponse(input: {
  token: string;
  raterRole: string;
  raterClass: string;
  scores: HedonicScores;
  comment: string;
}): Promise<void> {
  const { error } = await supabase.rpc('submit_hedonic_response', {
    p_token: input.token,
    p_rater_role: input.raterRole,
    p_rater_class: input.raterClass,
    p_scores: input.scores,
    p_comment: input.comment,
  });
  if (error) {
    const code = Object.keys(SUBMIT_ERRORS).find(k => error.message?.includes(k));
    throw new Error(code ? SUBMIT_ERRORS[code] : 'Penilaian gagal dikirim. Periksa sinyal internet lalu coba lagi.');
  }
}

export async function fetchHedonicResponses(from: string, to: string): Promise<HedonicResponse[]> {
  const { data, error } = await supabase
    .from('hedonic_responses')
    .select('*')
    .gte('delivery_date', from)
    .lte('delivery_date', to)
    .order('created_at', { ascending: false })
    .limit(5000);
  if (error) throw error;
  return ((data || []) as HedonicResponse[]).map(r => ({ ...r, overall: Number(r.overall) }));
}

export async function fetchHedonicLinks(from: string, to: string): Promise<HedonicLink[]> {
  const { data, error } = await supabase
    .from('hedonic_links')
    .select('*')
    .gte('delivery_date', from)
    .lte('delivery_date', to);
  if (error) throw error;
  return (data || []) as HedonicLink[];
}

export async function deleteHedonicResponse(id: string): Promise<void> {
  const { error } = await supabase.from('hedonic_responses').delete().eq('id', id);
  if (error) throw error;
}

/** Rata-rata satu parameter atau satu makanan dari kumpulan isian; null bila belum ada nilai. */
export function averageScore(responses: HedonicResponse[], pick: (s: HedonicScores) => (number | undefined)[]): number | null {
  const values = responses.flatMap(r => pick(r.scores || {})).filter((v): v is number => typeof v === 'number');
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}
