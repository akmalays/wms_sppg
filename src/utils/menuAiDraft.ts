import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Draf teks Menu Hari Ini dari Edge Function "menu-ai-draft" (Gemini). Hanya teks naratif;
// angka gizi, alergen, dan status QC tetap diisi petugas.

export interface MenuAiDraft {
  description: string;
  ingredients: { name: string; healthBenefits: string; whyGood: string[]; funFact: string }[];
}

export interface MenuAiDraftInput {
  menuTitle: string;
  menuB3?: string;
  dateText?: string;
  ingredients: { name: string; category?: string }[];
}

export interface KidsAiDraft {
  hero: { name: string; category: string; points: string[]; funFact: string };
  habit: { title: string; description: string; steps: string[]; cheer: string };
  plateTip: string;
}

export interface KidsAiDraftInput extends MenuAiDraftInput {
  habitDay: string;
  otherHabitTitles: string[];
}

export async function invokeDraft<T>(body: Record<string, unknown>): Promise<T> {
  if (!isSupabaseConfigured()) throw new Error('Supabase belum diatur, fitur AI tidak tersedia.');

  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error('Fitur AI butuh login dengan akun Supabase. Keluar lalu masuk lagi dengan email petugas.');
  }

  const { data, error } = await supabase.functions.invoke<T>('menu-ai-draft', { body });
  if (error) {
    // FunctionsHttpError membawa Response asli; pesan dari fungsi ada di body-nya.
    const context = (error as { context?: Response }).context;
    const message = context && typeof context.json === 'function'
      ? await context.json().then((b: { error?: string }) => b?.error).catch(() => undefined)
      : undefined;
    throw new Error(message || 'Gagal menghubungi layanan AI. Periksa koneksi lalu coba lagi.');
  }
  if (!data) throw new Error('Jawaban AI kosong, coba lagi.');
  return data;
}

export async function requestMenuAiDraft(input: MenuAiDraftInput): Promise<MenuAiDraft> {
  const data = await invokeDraft<MenuAiDraft>({ mode: 'menu', ...input });
  if (typeof data.description !== 'string' || !Array.isArray(data.ingredients)) {
    throw new Error('Jawaban AI tidak lengkap, coba lagi.');
  }
  return data;
}

export async function requestKidsAiDraft(input: KidsAiDraftInput): Promise<KidsAiDraft> {
  const data = await invokeDraft<KidsAiDraft>({ mode: 'kids', ...input });
  if (!data.hero || !data.habit || typeof data.plateTip !== 'string') {
    throw new Error('Jawaban AI tidak lengkap, coba lagi.');
  }
  return data;
}
