import trayImg1 from '../assets/tray_sample_1.jpg';
import trayImg2 from '../assets/tray_double_1.jpg';
import trayImg3 from '../assets/tray_double_2.jpg';
import posterMenuImg from '../assets/poster-single.jpg';
import posterDoubleImg from '../assets/poster-double.jpg';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { compressImageToWebP } from '../utils/imageCompressor';

export interface MenuSlideItem {
  id: string;
  title: string;
  day: string;
  category: string;
  calories: string;
  imageUrl: string;
  description: string;
  targetGrams?: string;
  allergens?: string;
}

export interface VisualStudyItem {
  id: string;
  title: string;
  category: string;
  description: string;
  imageUrl: string;
  date?: string;
  badge?: string;
}

export interface HeroVideoItem {
  id: string;
  title: string;
  url: string;
  poster?: string;
}

export interface WebsiteHeroConfig {
  backgroundType: 'video' | 'image';
  videoUrl: string; // single URL fallback
  videoPoster: string;
  videoOverlayOpacity: number; // 0.2 s/d 0.9
  showVideoSoundToggle: boolean;
  // Multi-video playlist & auto loop support:
  videos: HeroVideoItem[];
  autoLoopPlaylist: boolean; // default true: loop video berikutnya saat selesai
  videoIntervalSeconds: number; // 0 = tunggu sampai video selesai (onEnded), >0 = auto switch tiap X detik
  heroBadge: string;
  heroTitle: string;
  heroSubtitle: string;
  primaryCtaText: string;
  primaryCtaLink: string;
  secondaryCtaText: string;
  secondaryCtaLink: string;
}

export interface WebsiteMenuSliderConfig {
  autoSlide: boolean;
  intervalSeconds: number;
  pauseOnHover: boolean;
  sectionBadge: string;
  sectionTitle: string;
  sectionSubtitle: string;
  slides: MenuSlideItem[];
}

export interface WebsiteVisualStudyConfig {
  sectionBadge: string;
  sectionTitle: string;
  sectionSubtitle: string;
  items: VisualStudyItem[];
}

export interface WebsiteConfig {
  hero: WebsiteHeroConfig;
  menuSlider: WebsiteMenuSliderConfig;
  visualStudy: WebsiteVisualStudyConfig;
  lastUpdated: string;
}

const STORAGE_KEY = 'sppg_website_cms_config_v1';
export const WEBSITE_CONFIG_UPDATED_EVENT = 'sppg_website_config_updated';
const SUPABASE_BUCKET_NAME = 'sppg-assets';

// Video CDN presets yang telah teruji cepat & stabil
export const VIDEO_PRESETS = [
  {
    id: 'cooking_veg',
    label: 'Preset 1: Dapur & Olahan Sayuran Segar (Mixkit HD)',
    url: 'https://assets.mixkit.co/videos/42749/42749-720.mp4',
    poster: trayImg1,
    description: 'Aksi pemotongan bahan sayur segar dalam lingkungan dapur higienis'
  },
  {
    id: 'kitchen_prep',
    label: 'Preset 2: Buah & Sayur Meja Dapur (Mixkit HD)',
    url: 'https://assets.mixkit.co/videos/42750/42750-720.mp4',
    poster: trayImg2,
    description: 'Penataan bahan pangan segar warna-warni di atas meja persiapan'
  },
  {
    id: 'soup_pot',
    label: 'Preset 3: Pengolahan Sup Panci Besar (Mixkit HD)',
    url: 'https://assets.mixkit.co/videos/49605/49605-720.mp4',
    poster: trayImg3,
    description: 'Masakan sop kaldu segar mendidih khas dapur sentra porsi besar'
  }
];

export const IMAGE_PRESETS = [
  { id: 'poster_single', label: 'Poster Menu MBG Single (Pilihan 1)', url: posterMenuImg },
  { id: 'poster_double', label: 'Poster Menu MBG Double (Pilihan 2)', url: posterDoubleImg },
  { id: 'tray_1', label: 'Nampan 5 Sekat Lengkap (Foto Lapangan 1)', url: trayImg1 },
  { id: 'tray_2', label: 'Wadah Ganda Siap Kirim (Foto Lapangan 2)', url: trayImg2 },
  { id: 'tray_3', label: 'Penataan Warna & Selera (Foto Lapangan 3)', url: trayImg3 },
];

export const DEFAULT_WEBSITE_CONFIG: WebsiteConfig = {
  hero: {
    backgroundType: 'video',
    videoUrl: 'https://assets.mixkit.co/videos/42749/42749-720.mp4',
    videoPoster: trayImg1,
    videoOverlayOpacity: 0.65,
    showVideoSoundToggle: true,
    autoLoopPlaylist: true,
    videoIntervalSeconds: 0, // 0 = transisi otomatis saat video selesai diputar
    videos: [
      {
        id: 'vid-1',
        title: 'Video 1: Dapur & Olahan Sayuran Segar',
        url: 'https://assets.mixkit.co/videos/42749/42749-720.mp4',
        poster: trayImg1
      },
      {
        id: 'vid-2',
        title: 'Video 2: Penataan Meja Persiapan Sayur & Buah',
        url: 'https://assets.mixkit.co/videos/42750/42750-720.mp4',
        poster: trayImg2
      },
      {
        id: 'vid-3',
        title: 'Video 3: Pengolahan Sup Panci Besar Dapur Sentra',
        url: 'https://assets.mixkit.co/videos/49605/49605-720.mp4',
        poster: trayImg3
      }
    ],
    heroBadge: 'Satuan Pelayanan Pemenuhan Gizi Kabupaten Malang',
    heroTitle: 'Ketertelusuran Rantai Pangan & Standar Gizi Harian untuk Generasi Penerus',
    heroSubtitle: 'Dari penimbangan bahan segar petani lokal Tumpang pada pukul 04.00 pagi, pengolahan dapur bersuhu terkontrol, hingga distribusi wadah bersekat SUS 304 sebelum bel istirahat sekolah berbunyi.',
    primaryCtaText: 'Lihat Siklus Menu MBG',
    primaryCtaLink: '#siklus-menu',
    secondaryCtaText: 'Alur Operasional 04.00 WIB',
    secondaryCtaLink: '#alur-pagi'
  },
  menuSlider: {
    autoSlide: true,
    intervalSeconds: 4,
    pauseOnHover: true,
    sectionBadge: 'Siklus Pangan Bergizi',
    sectionTitle: 'Koleksi Foto Menu & Siklus Porsi Gizi MBG',
    sectionSubtitle: 'Variasi olahan makanan harian yang dirotasi secara berkala guna mencukupi kebutuhan energi, protein hewani, protein nabati, dan mikronutrien anak sekolah.',
    slides: [
      {
        id: 'menu-1',
        title: 'Nasi Pulen, Ayam Ungkep Rempah & Sop Sayur Segar',
        day: 'Senin',
        category: 'Paket Porsi Lengkap MBG',
        calories: '645 kkal • Protein 26g',
        imageUrl: posterMenuImg,
        description: 'Nasi pandanwangi Tumpang, ayam ungkep bumbu kuning minim minyak, tempe bacem kedelai lokal, sop wortel kubis buncis, semangka potong, dan susu sapi segar pasteurisasi.',
        targetGrams: '475 gram',
        allergens: 'Bebas Kacang Tanah • Halal 100%'
      },
      {
        id: 'menu-2',
        title: 'Nasi Gurih Kuning, Semur Daging Sapi & Perkedel',
        day: 'Selasa',
        category: 'Paket Variasi Zat Besi',
        calories: '670 kkal • Protein 28g',
        imageUrl: posterDoubleImg,
        description: 'Daging sapi bumbu semur manis gurih kaya zat besi, perkedel kentang kukus, tumis buncis jagung manis, buah pisang mas lokal, dan susu segar tanpa gula tambahan.',
        targetGrams: '460 gram',
        allergens: 'Bebas MSG Sintetis • Bebas Pengawet'
      },
      {
        id: 'menu-3',
        title: 'Nasi Putih, Ikan Bandeng Presto & Tahu Bacem',
        day: 'Rabu',
        category: 'Paket Asam Lemak Omega-3',
        calories: '620 kkal • Protein 25g',
        imageUrl: trayImg1,
        description: 'Olahan ikan bandeng presto empuk duri lunak dengan marinasi jeruk nipis & kunyit, tahu bacem gula aren, sayur bayam bening jagung manis, dan potongan buah melon segar.',
        targetGrams: '450 gram',
        allergens: 'Mengandung Ikan Laut/Tawar'
      },
      {
        id: 'menu-4',
        title: 'Nasi Liwet Rempah, Ayam Panggang Madu & Capcay',
        day: 'Kamis',
        category: 'Paket Vitamin & Serat Tinggi',
        calories: '655 kkal • Protein 27g',
        imageUrl: trayImg2,
        description: 'Ayam panggang oven madu rempah dengan tekstur lembut, capcay sayur segar lereng Bromo, tempe mendoan oven, buah pepaya jingga manis, serta susu kotak murni.',
        targetGrams: '470 gram',
        allergens: 'Bebas Kedelai Modifikasi (Non-GMO)'
      },
      {
        id: 'menu-5',
        title: 'Nasi Timbel, Telur Puyuh Balado & Orek Tempe',
        day: 'Jumat',
        category: 'Paket Pangan Tradisional Sehat',
        calories: '630 kkal • Protein 24g',
        imageUrl: trayImg3,
        description: 'Telur balado tomat segar tanpa cabai pedas menyengat, orek tempe manis gurih renyah, lalapan timun kukus & labu siam manis, buah jeruk manis, dan susu pasteurisasi.',
        targetGrams: '455 gram',
        allergens: 'Bebas Gluten • Sayur Ozonisasi'
      }
    ]
  },
  visualStudy: {
    sectionBadge: 'Dokumentasi Arsip Unit',
    sectionTitle: 'Kajian Visual Sajian Makanan di Lapangan',
    sectionSubtitle: 'Foto riil dari fasilitas dapur dan persiapan penyajian SPPG MLG TUMPANG JERU sebelum diberangkatkan ke sekolah.',
    items: [
      {
        id: 'vis-1',
        title: 'Inspeksi Nampan 5 Sekat SUS 304',
        category: 'Standar Higienitas',
        description: 'Pemisahan higienis antar lauk tanpa risiko bercampur kuah. Wadah baja tahan karat SUS 304 standar food-grade aman untuk suhu panas.',
        imageUrl: trayImg1,
        date: '06 Okt 2026',
        badge: 'Food-Grade SUS 304'
      },
      {
        id: 'vis-2',
        title: 'Kesiapan Wadah Ganda Boks Termal',
        category: 'Kendali Rantai Panas',
        description: 'Penimbangan gramatur presisi sebelum dimasukkan ke boks insulasi tertutup untuk menjaga suhu sajian tetap hangat di atas 60°C saat tiba di sekolah.',
        imageUrl: trayImg2,
        date: '06 Okt 2026',
        badge: 'Insulasi Suhu Dingin/Panas'
      },
      {
        id: 'vis-3',
        title: 'Penataan Warna & Selera Makan Siswa',
        category: 'Psikologi Sensoris Makanan',
        description: 'Kombinasi warna alami sayur, lauk protein, buah, dan nasi pulen dirancang menarik secara visual untuk menumbuhkan nafsu makan anak secara alami.',
        imageUrl: trayImg3,
        date: '06 Okt 2026',
        badge: 'Uji Organoleptik Sensoris'
      }
    ]
  },
  lastUpdated: new Date().toISOString()
};

/**
 * Normalisasi objek konfigurasi agar selalu memiliki struktur lengkap
 */
function normalizeConfig(parsed: Partial<WebsiteConfig> | null | undefined): WebsiteConfig {
  if (!parsed) return DEFAULT_WEBSITE_CONFIG;

  const parsedHero: Partial<WebsiteHeroConfig> = parsed.hero || {};
  let normalizedVideos: HeroVideoItem[] = DEFAULT_WEBSITE_CONFIG.hero.videos;
  if (Array.isArray(parsedHero.videos) && parsedHero.videos.length > 0) {
    normalizedVideos = parsedHero.videos;
  } else if (parsedHero.videoUrl) {
    normalizedVideos = [
      {
        id: 'vid-custom',
        title: 'Video Latar Belakang Hero',
        url: parsedHero.videoUrl,
        poster: parsedHero.videoPoster || DEFAULT_WEBSITE_CONFIG.hero.videoPoster
      }
    ];
  }

  const primaryVideoUrl = normalizedVideos[0]?.url || parsedHero.videoUrl || DEFAULT_WEBSITE_CONFIG.hero.videoUrl;

  return {
    hero: {
      ...DEFAULT_WEBSITE_CONFIG.hero,
      ...parsedHero,
      videoUrl: primaryVideoUrl,
      videos: normalizedVideos
    },
    menuSlider: {
      ...DEFAULT_WEBSITE_CONFIG.menuSlider,
      ...(parsed.menuSlider || {}),
      slides: parsed.menuSlider?.slides && parsed.menuSlider.slides.length > 0
        ? parsed.menuSlider.slides
        : DEFAULT_WEBSITE_CONFIG.menuSlider.slides
    },
    visualStudy: {
      ...DEFAULT_WEBSITE_CONFIG.visualStudy,
      ...(parsed.visualStudy || {}),
      items: parsed.visualStudy?.items && parsed.visualStudy.items.length > 0
        ? parsed.visualStudy.items
        : DEFAULT_WEBSITE_CONFIG.visualStudy.items
    },
    lastUpdated: parsed.lastUpdated || new Date().toISOString()
  };
}

/**
 * Mengambil konfigurasi website terkini dari localStorage atau default secara sinkron
 */
export function getWebsiteConfig(): WebsiteConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_WEBSITE_CONFIG;
    }
    const parsed = JSON.parse(raw) as Partial<WebsiteConfig>;
    return normalizeConfig(parsed);
  } catch (err) {
    console.error('Gagal memuat konfigurasi website dari localStorage:', err);
    return DEFAULT_WEBSITE_CONFIG;
  }
}

/**
 * Menyimpan konfigurasi website ke localStorage dan memicu update event
 */
export function saveWebsiteConfig(config: WebsiteConfig): void {
  try {
    const updated: WebsiteConfig = {
      ...config,
      lastUpdated: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(WEBSITE_CONFIG_UPDATED_EVENT));
    }
  } catch (err) {
    console.error('Gagal menyimpan konfigurasi website:', err);
    throw err;
  }
}

/**
 * Mengambil konfigurasi website dari database cloud Supabase.
 * Jika tersedia dan valid, memperbarui cache localStorage lokal.
 */
export async function fetchWebsiteConfigFromCloud(): Promise<{
  config: WebsiteConfig;
  fromCloud: boolean;
  error?: string;
}> {
  const currentLocal = getWebsiteConfig();

  if (!isSupabaseConfigured()) {
    return { config: currentLocal, fromCloud: false };
  }

  try {
    const { data, error } = await supabase
      .from('website_cms_config')
      .select('config, updated_at')
      .eq('id', 'default')
      .maybeSingle();

    if (error) {
      // Jika tabel belum dibuat atau offline, log info dan gunakan data lokal
      console.info('Tabel website_cms_config belum aktif di Supabase, menggunakan data lokal:', error.message);
      return { config: currentLocal, fromCloud: false, error: error.message };
    }

    if (data && data.config) {
      const cloudConfig = normalizeConfig(data.config as Partial<WebsiteConfig>);
      cloudConfig.lastUpdated = data.updated_at || cloudConfig.lastUpdated;

      // Update local storage jika cloud lebih baru atau berbeda
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudConfig));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(WEBSITE_CONFIG_UPDATED_EVENT));
      }

      return { config: cloudConfig, fromCloud: true };
    }

    // Jika baris belum ada di Supabase, coba simpan konfigurasi lokal saat ini ke cloud
    try {
      await supabase.from('website_cms_config').upsert({
        id: 'default',
        config: currentLocal,
        updated_at: currentLocal.lastUpdated,
        updated_by: 'init_sync'
      });
    } catch {
      // Abaikan jika inisialisasi awal gagal
    }

    return { config: currentLocal, fromCloud: false };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.warn('Gagal memuat konfigurasi dari cloud:', errorMsg);
    return { config: currentLocal, fromCloud: false, error: errorMsg };
  }
}

/**
 * Menyimpan konfigurasi website ke database cloud Supabase dan localStorage lokal
 */
export async function saveWebsiteConfigToCloud(config: WebsiteConfig): Promise<{
  success: boolean;
  isCloudSynced: boolean;
  message: string;
}> {
  // 1. Simpan segera ke localStorage agar UI instan merespons tanpa jeda jaringan
  const updated: WebsiteConfig = {
    ...config,
    lastUpdated: new Date().toISOString()
  };
  saveWebsiteConfig(updated);

  if (!isSupabaseConfigured()) {
    return {
      success: true,
      isCloudSynced: false,
      message: 'Tersimpan di browser lokal (Supabase belum terhubung).'
    };
  }

  // 2. Sinkronisasi ke PostgreSQL Supabase
  try {
    const { error } = await supabase.from('website_cms_config').upsert({
      id: 'default',
      config: updated,
      updated_at: updated.lastUpdated,
      updated_by: 'admin_cms'
    });

    if (error) {
      console.warn('Gagal sinkron ke tabel Supabase website_cms_config:', error.message);
      return {
        success: true,
        isCloudSynced: false,
        message: `Tersimpan di browser lokal. Cloud pending: ${error.message}`
      };
    }

    return {
      success: true,
      isCloudSynced: true,
      message: 'Konfigurasi website berhasil disinkronkan ke Database Cloud Supabase!'
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return {
      success: true,
      isCloudSynced: false,
      message: `Tersimpan di browser lokal. (Koneksi cloud: ${errorMsg})`
    };
  }
}

/**
 * Upload aset media (foto menu, foto dokumentasi, atau video hero)
 * Otomatis mengompresi foto ke WebP dan mengunggah ke Supabase Storage (Bucket sppg-assets).
 * Memiliki fallback otomatis ke local Data URL jika Supabase offline.
 */
export async function uploadCmsMedia(
  file: File,
  folder: 'hero' | 'menu' | 'visual'
): Promise<{
  url: string;
  isCloudStorage: boolean;
  warning?: string;
  originalSizeKb: number;
  finalSizeKb: number;
}> {
  const originalSizeKb = Math.round(file.size / 1024);

  // Helper untuk membaca file sebagai Data URL lokal (fallback)
  const readFileAsDataUrl = async (f: File | Blob): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(f);
    });
  };

  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');

  let uploadBlob: Blob | File = file;
  let uploadMime = file.type;
  let fileExt = file.name.split('.').pop() || 'bin';

  // 1. Jika gambar, kompres client-side ke WebP berkualitas tinggi terlebih dahulu
  if (isImage) {
    try {
      const compressed = await compressImageToWebP(file, {
        maxDimension: folder === 'hero' ? 1920 : 1200,
        quality: 0.82
      });
      uploadBlob = compressed.blob;
      uploadMime = 'image/webp';
      fileExt = 'webp';
    } catch (compressErr) {
      console.warn('Gagal kompresi WebP, menggunakan file asli:', compressErr);
    }
  }

  const finalSizeKb = Math.round(uploadBlob.size / 1024);

  // Jika Supabase tidak dikonfigurasi, langsung gunakan data URL lokal
  if (!isSupabaseConfigured()) {
    const localDataUrl = await readFileAsDataUrl(uploadBlob);
    return {
      url: localDataUrl,
      isCloudStorage: false,
      warning: 'Supabase belum dikonfigurasi. Media disimpan secara lokal di browser.',
      originalSizeKb,
      finalSizeKb
    };
  }

  // 2. Unggah ke Supabase Storage (Object Storage)
  try {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const fileName = `${folder}/${timestamp}_${randomSuffix}.${fileExt}`;

    // Coba upload ke bucket sppg-assets
    const { error: uploadError } = await supabase.storage
      .from(SUPABASE_BUCKET_NAME)
      .upload(fileName, uploadBlob, {
        contentType: uploadMime,
        cacheControl: '31536000', // Cache 1 tahun di CDN browser
        upsert: false
      });

    if (uploadError) {
      console.warn('Supabase storage upload gagal:', uploadError.message);
      // Fallback ke local data url
      const localDataUrl = await readFileAsDataUrl(uploadBlob);
      return {
        url: localDataUrl,
        isCloudStorage: false,
        warning: `Aset disimpan lokal (Bucket ${SUPABASE_BUCKET_NAME} belum siap di Supabase: ${uploadError.message})`,
        originalSizeKb,
        finalSizeKb
      };
    }

    // Ambil Public URL dari CDN Supabase
    const { data: publicUrlData } = supabase.storage
      .from(SUPABASE_BUCKET_NAME)
      .getPublicUrl(fileName);

    return {
      url: publicUrlData.publicUrl,
      isCloudStorage: true,
      originalSizeKb,
      finalSizeKb
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown storage error';
    const localDataUrl = await readFileAsDataUrl(uploadBlob);
    return {
      url: localDataUrl,
      isCloudStorage: false,
      warning: `Aset disimpan lokal (${errorMsg})`,
      originalSizeKb,
      finalSizeKb
    };
  }
}

/**
 * Ekspor konfigurasi website saat ini sebagai berkas file JSON cadangan
 */
export function exportWebsiteConfigAsJson(): void {
  const config = getWebsiteConfig();
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(config, null, 2));
  const downloadAnchor = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `sppg_website_config_backup_${dateStr}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

/**
 * Mengimpor berkas konfigurasi JSON dari perangkat
 */
export async function importWebsiteConfigFromJson(file: File): Promise<WebsiteConfig> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text) as Partial<WebsiteConfig>;
        const normalized = normalizeConfig(parsed);
        saveWebsiteConfig(normalized);
        resolve(normalized);
      } catch (err) {
        reject(new Error('Format berkas JSON tidak valid atau rusak'));
      }
    };
    reader.onerror = () => reject(new Error('Gagal membaca berkas file JSON'));
    reader.readAsText(file);
  });
}

/**
 * Mengembalikan konfigurasi website ke setelan bawaan pabrik
 */
export function resetWebsiteConfigToDefault(): WebsiteConfig {
  saveWebsiteConfig(DEFAULT_WEBSITE_CONFIG);
  return DEFAULT_WEBSITE_CONFIG;
}

