// Draf teks halaman Menu Hari Ini dengan Gemini, dipanggil dari Atur Website.
// mode "menu": deskripsi sajian dan teks tiap bahan. mode "kids": Pahlawan Gizi, kebiasaan baik, tips Isi Piringku.
// Hanya menulis teks naratif (deskripsi, manfaat, fakta menarik). Angka gizi, gramatur, alergen,
// dan status QC sengaja tidak diminta: data itu harus dari ahli gizi, bukan karangan model.
//
// Secret yang dibutuhkan: GEMINI_API_KEY. Opsional: GEMINI_MODEL (bawaan gemini-2.5-flash).
// SUPABASE_URL dan SUPABASE_ANON_KEY sudah disediakan otomatis oleh Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

interface DraftRequest {
  mode?: 'menu' | 'kids';
  /** mode kids: nama hari kebiasaan yang ditulis, mis. "Senin" */
  habitDay?: string;
  /** mode kids: judul kebiasaan hari lain, supaya tidak berulang */
  otherHabitTitles?: string[];
  menuTitle?: string;
  menuB3?: string;
  dateText?: string;
  ingredients?: { name?: string; category?: string }[];
}

const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    description: { type: 'STRING' },
    ingredients: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          healthBenefits: { type: 'STRING' },
          whyGood: { type: 'ARRAY', items: { type: 'STRING' } },
          funFact: { type: 'STRING' },
        },
        required: ['name', 'healthBenefits', 'whyGood', 'funFact'],
      },
    },
  },
  required: ['description', 'ingredients'],
};

const KIDS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    hero: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING' },
        category: { type: 'STRING', enum: ['karbohidrat', 'protein', 'sayur', 'buah'] },
        points: { type: 'ARRAY', items: { type: 'STRING' } },
        funFact: { type: 'STRING' },
      },
      required: ['name', 'category', 'points', 'funFact'],
    },
    habit: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING' },
        description: { type: 'STRING' },
        steps: { type: 'ARRAY', items: { type: 'STRING' } },
        cheer: { type: 'STRING' },
      },
      required: ['title', 'description', 'steps', 'cheer'],
    },
    plateTip: { type: 'STRING' },
  },
  required: ['hero', 'habit', 'plateTip'],
};

const SHARED_RULES = `
Aturan wajib:
- Jangan menulis angka gizi, gram, kalori, persentase, atau takaran apa pun.
- Jangan menyebut alergen, status halal, hasil uji, atau klaim keamanan pangan.
- Jangan membuat klaim medis (menyembuhkan, mencegah penyakit tertentu).
- Jangan memakai tanda pisah panjang (—). Pakai koma atau titik.
- Jangan memakai emoji.`;

const buildKidsPrompt = (
  menuTitle: string,
  ingredients: { name: string; category: string }[],
  habitDay: string,
  otherHabitTitles: string[]
) => `
Kamu menulis bagian anak di halaman "Menu MBG Hari Ini" milik SPPG (dapur Makan Bergizi Gratis) di Kabupaten Malang.
Pembacanya siswa SD kelas 1 sampai 6. Pakai kalimat pendek, kata sehari-hari, nada ceria, sapa dengan "kamu".

Menu hari ini: ${menuTitle || '-'}
Bahan:
${ingredients.map(i => `- ${i.name}${i.category ? ` (${i.category})` : ''}`).join('\n') || '- (belum ada)'}

Tulis:
1. "hero": satu bahan dari daftar di atas yang paling menarik untuk anak, sebagai "Pahlawan Gizi Hari Ini".
   - "name": nama bahan yang singkat dan akrab untuk anak (mis. "Tempe", bukan "Tempe Bacem Tradisional").
   - "category": salah satu dari karbohidrat, protein, sayur, buah.
   - "points": 3 fakta pendek (maksimal 10 kata) kenapa bahan itu hebat.
   - "funFact": 1 fakta unik yang umum diketahui, 1 sampai 2 kalimat.
2. "habit": satu kebiasaan baik untuk hari ${habitDay || 'ini'} yang berkaitan dengan makan, kebersihan, atau kesehatan sehari-hari.
   ${otherHabitTitles.length ? `Jangan sama dengan kebiasaan hari lain: ${otherHabitTitles.join('; ')}.` : ''}
   - "title": 2 sampai 5 kata.
   - "description": 1 sampai 2 kalimat alasan kebiasaan itu penting.
   - "steps": 3 sampai 4 langkah yang bisa dicentang anak, maksimal 8 kata per langkah.
   - "cheer": 1 kalimat penyemangat pendek.
3. "plateTip": 1 sampai 2 kalimat tips makan untuk menu hari ini (mis. urutan makan, mengunyah pelan, menghabiskan sayur).
${SHARED_RULES}
`.trim();

const buildPrompt = (menuTitle: string, menuB3: string, dateText: string, ingredients: { name: string; category: string }[]) => `
Kamu menulis teks untuk halaman "Menu MBG Hari Ini" milik SPPG (dapur Makan Bergizi Gratis) di Kabupaten Malang.
Halaman ini dibuka siswa SD/SMP dan orang tua dengan memindai QR di meja makan.

Menu: ${menuTitle || '-'}
Tanggal: ${dateText || '-'}
Menu 3B (ibu hamil, menyusui, balita): ${menuB3 || 'tidak ada'}
Bahan:
${ingredients.map(i => `- ${i.name}${i.category ? ` (${i.category})` : ''}`).join('\n')}

Tulis dalam Bahasa Indonesia yang hangat, sederhana, dan mudah dipahami anak:
1. "description": 2 sampai 3 kalimat tentang sajian hari ini.
2. Untuk SETIAP bahan di daftar, dengan "name" persis sama seperti di daftar:
   - "healthBenefits": 1 kalimat manfaat bahan itu bagi tubuh anak.
   - "whyGood": 2 sampai 3 poin pendek (maksimal 8 kata per poin) kenapa bahan itu baik.
   - "funFact": 1 fakta menarik yang umum diketahui tentang bahan itu.
${SHARED_RULES}
`.trim();

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Metode tidak didukung.' }, 405);

  // Hanya petugas yang login lewat Supabase Auth. Anon key saja tidak cukup, karena anon key ikut
  // terkirim ke browser dan siapa pun bisa menghabiskan kuota Gemini.
  const authHeader = req.headers.get('Authorization') || '';
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return json({ error: 'Fitur AI hanya untuk petugas yang login dengan akun Supabase.' }, 401);

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return json({ error: 'GEMINI_API_KEY belum diatur di Supabase.' }, 500);
  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';

  let body: DraftRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Isi permintaan bukan JSON.' }, 400);
  }

  const ingredients = (Array.isArray(body.ingredients) ? body.ingredients : [])
    .slice(0, 20)
    .map(i => ({ name: clip(i?.name, 80), category: clip(i?.category, 40) }))
    .filter(i => i.name);
  const menuTitle = clip(body.menuTitle, 200);
  if (!menuTitle && ingredients.length === 0) return json({ error: 'Isi judul menu atau daftar bahan dulu.' }, 400);

  const kids = body.mode === 'kids';
  const otherHabitTitles = (Array.isArray(body.otherHabitTitles) ? body.otherHabitTitles : [])
    .slice(0, 6)
    .map(t => clip(t, 60))
    .filter(Boolean);
  const prompt = kids
    ? buildKidsPrompt(menuTitle, ingredients, clip(body.habitDay, 20), otherHabitTitles)
    : buildPrompt(menuTitle, clip(body.menuB3, 200), clip(body.dateText, 60), ingredients);
  const schema = kids ? KIDS_SCHEMA : RESPONSE_SCHEMA;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.7 },
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error('Gemini error', res.status, detail.slice(0, 500));
    return json({ error: res.status === 429 ? 'Kuota Gemini habis, coba lagi nanti.' : 'Gemini gagal membuat draf.' }, 502);
  }

  const result = await res.json();
  const text: string | undefined = result?.candidates?.[0]?.content?.parts?.[0]?.text;
  try {
    const draft = JSON.parse(text || '');
    return json(draft);
  } catch {
    console.error('Jawaban Gemini bukan JSON', (text || '').slice(0, 500));
    return json({ error: 'Jawaban Gemini tidak terbaca, coba lagi.' }, 502);
  }
});
