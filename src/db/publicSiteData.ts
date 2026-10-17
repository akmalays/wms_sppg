import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { localDateIso } from '../utils/localDate';

// Data website publik dibaca dari view berkolom terbatas (lihat migrasi 20261018000001).
// Pengunjung tidak login, jadi data ini tidak bisa diambil dari cache aplikasi petugas.

export interface PublicMenuDay {
  id: string;
  date: string; // YYYY-MM-DD
  mealSession: string;
  title: string;
  description?: string;
  specialDietB3?: string;
}

export interface PublicSchool {
  id: string;
  name: string;
  category: string;
}

export interface PublicSupplier {
  id: string;
  name: string;
  category: string;
}

export interface PublicSiteData {
  weekMenus: PublicMenuDay[];
  schools: PublicSchool[];
  suppliers: PublicSupplier[];
  /** false bila Supabase belum terhubung atau view belum dibuat; halaman memakai isi bawaan. */
  available: boolean;
}

const SESSION_ORDER: Record<string, number> = { Pagi: 0, Siang: 1, Snack: 2 };

/** Senin–Sabtu pekan berjalan; pada hari Minggu yang ditampilkan pekan berikutnya. */
export function currentWeekRange(today = new Date()): { start: string; end: string } {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dow = d.getDay(); // 0 = Minggu
  const offsetToMonday = dow === 0 ? 1 : 1 - dow;
  const monday = new Date(d);
  monday.setDate(d.getDate() + offsetToMonday);
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);
  return { start: localDateIso(monday), end: localDateIso(saturday) };
}

export async function fetchPublicSiteData(): Promise<PublicSiteData> {
  const empty: PublicSiteData = { weekMenus: [], schools: [], suppliers: [], available: false };
  if (!isSupabaseConfigured()) return empty;

  const { start, end } = currentWeekRange();
  const [menuRes, schoolRes, supplierRes] = await Promise.all([
    supabase.from('public_menu_schedule').select('*').gte('date', start).lte('date', end).order('date'),
    supabase.from('public_schools').select('*').order('school_name'),
    supabase.from('public_suppliers').select('*').order('name'),
  ]);

  if (menuRes.error || schoolRes.error || supplierRes.error) {
    console.warn(
      'Data website publik belum tersedia (sudah menjalankan migrasi 20261018000001?):',
      menuRes.error?.message || schoolRes.error?.message || supplierRes.error?.message
    );
    return empty;
  }

  const weekMenus = (menuRes.data || [])
    .map((r: any): PublicMenuDay => ({
      id: r.id,
      date: String(r.date).slice(0, 10),
      mealSession: r.meal_session || 'Siang',
      title: r.menu_title || '',
      description: r.menu_description || undefined,
      specialDietB3: r.special_diet_b3 || undefined,
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || (SESSION_ORDER[a.mealSession] ?? 9) - (SESSION_ORDER[b.mealSession] ?? 9));

  return {
    weekMenus,
    schools: (schoolRes.data || []).map((r: any) => ({ id: r.id, name: r.school_name, category: r.category || '' })),
    suppliers: (supplierRes.data || []).map((r: any) => ({ id: r.id, name: r.name, category: r.supply_category || '' })),
    available: true,
  };
}
