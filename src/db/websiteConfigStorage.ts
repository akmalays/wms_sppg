import trayImg1 from '../assets/tray_sample_1.jpg';
import trayImg2 from '../assets/tray_double_1.jpg';
import trayImg3 from '../assets/tray_double_2.jpg';
import posterMenuImg from '../assets/poster-single.jpg';
import posterDoubleImg from '../assets/poster-double.jpg';
import nasiPutihBowlImg from '../assets/nasi_putih_bowl.jpg';
import ayamBumbuKuningImg from '../assets/ayam_bumbu_kuning.jpg';
import tempeBacemImg from '../assets/tempe_bacem.jpg';
import sayurSopImg from '../assets/sayur_sop.jpg';
import buahPisangImg from '../assets/buah_pisang.jpg';
import tempeMaskotImg from '../assets/tempe_maskot_mbg.jpg';
import cuciTanganImg from '../assets/cuci_tangan_mbg.jpg';
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

export interface HeroDocumentationSlide {
  id: string;
  title: string;
  category: string;
  description: string;
  imageUrl: string;
  badge?: string;
  targetGrams?: string;
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
  // Dokumentasi Slide Foto Hero (Auto-slide di kotak kanan)
  photoSlides?: HeroDocumentationSlide[];
  autoSlidePhotos?: boolean;
  photoSlideInterval?: number; // detik
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

export interface IngredientNutritionInfo {
  id: string;
  name: string;
  category: string;
  portionSmall: string;
  portionLarge: string;
  imageUrl: string;
  nutritionHighlight: string;
  healthBenefits: string;
  supplier: string;
  notes?: string;
  /** Poin "Mengapa ... baik untukmu?"; kosong = memakai kalimat dari healthBenefits */
  whyGood?: string[];
  /** Kotak "Tahukah kamu?"; kosong = disembunyikan */
  funFact?: string;
}

export interface PortionTierConfig {
  tierName: string;
  targetCalories: string;
  totalGramature: string;
  description: string;
  proteinGrams: string;
  carbGrams: string;
  fatGrams: string;
  fiberGrams: string;
}

export interface NutritionHeroConfig {
  name: string;
  category: string;
  imageUrl: string;
  points: string[];
  /** Kotak "Fakta menarik"; kosong = disembunyikan */
  funFact?: string;
  /** Daftar "Kandungan utama"; kosong = memakai kandungan menonjol bahan yang namanya cocok */
  keyNutrients?: string[];
}

/** weekday mengikuti Date.getDay(): 1 = Senin ... 6 = Sabtu */
export interface DailyHabitItem {
  weekday: number;
  title: string;
  description: string;
  steps: string[];
  imageUrl: string;
  /** Kalimat penyemangat di bawah langkah; kosong = disembunyikan */
  cheer?: string;
}

export const HABIT_WEEKDAY_LABELS: Record<number, string> = {
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu'
};

export interface WebsiteMenuTodayConfig {
  dateText: string;
  menuTitle: string;
  menuSubtitle: string;
  badge?: string;
  /** Menu 3B (ibu hamil, ibu menyusui, balita non-PAUD), dipisah koma; kosong = pilihan 3B dinonaktifkan */
  menuB3?: string;
  description: string;
  imageUrl: string;
  energySummary: {
    caloriesAvg: string;
    proteinAvg: string;
    carbsAvg: string;
    fatAvg: string;
    fiberAvg: string;
    calciumAvg: string;
    ironAvg: string;
  };
  portionSmall: PortionTierConfig;
  portionLarge: PortionTierConfig;
  allergensWarning: string;
  qcStatus: string;
  qrTargetUrl: string;
  ingredients: IngredientNutritionInfo[];
  nutritionHero: NutritionHeroConfig;
  dailyHabits: DailyHabitItem[];
  /** Kotak "Tips hari ini" di Isi Piringku; kosong = disembunyikan */
  plateTip?: string;
  /**
   * Berat badan acuan (kg) untuk perkiraan "energi setara aktivitas".
   * Bawaan dari tabel AKG 2019 (Permenkes No. 28/2019): 7–9 tahun 27 kg, 10–12 tahun rata-rata 37 kg.
   */
  bodyWeightSmallKg?: string;
  bodyWeightLargeKg?: string;
}

export interface WebsiteConfig {
  hero: WebsiteHeroConfig;
  menuSlider: WebsiteMenuSliderConfig;
  visualStudy: WebsiteVisualStudyConfig;
  menuToday: WebsiteMenuTodayConfig;
  lastUpdated: string;
}

const STORAGE_KEY = 'sppg_website_cms_config_v1';
export const WEBSITE_CONFIG_UPDATED_EVENT = 'sppg_website_config_updated';
const SUPABASE_BUCKET_NAME = 'sppg-assets';

// Video CDN presets yang telah teruji cepat & stabil (Supabase Cloud Storage)
export const VIDEO_PRESETS = [
  {
    id: 'sppg_kitchen_1',
    label: 'Preset 1: Dapur & Olahan Sayuran Segar SPPG',
    url: 'https://fqsqtxtmdcajcnhpcwgw.supabase.co/storage/v1/object/public/sppg-assets/hero/1791362609925_qifjdf.mp4',
    poster: trayImg1,
    description: 'Dokumentasi pengolahan bahan sayur segar dalam lingkungan dapur SPPG Jeru'
  },
  {
    id: 'sppg_kitchen_2',
    label: 'Preset 2: Penataan Meja Persiapan & Porsi MBG',
    url: 'https://fqsqtxtmdcajcnhpcwgw.supabase.co/storage/v1/object/public/sppg-assets/hero/1791362621960_a4uig3.mp4',
    poster: trayImg2,
    description: 'Penataan sajian nampan bersekat SUS 304 sesuai standar gizi harian'
  },
  {
    id: 'sppg_kitchen_3',
    label: 'Preset 3: Pengolahan Sup Panci Besar Dapur Sentra',
    url: 'https://fqsqtxtmdcajcnhpcwgw.supabase.co/storage/v1/object/public/sppg-assets/hero/1791359566504_4wfoj7.mp4',
    poster: trayImg3,
    description: 'Masakan sop kaldu segar mendidih khas dapur sentra porsi besar SPPG'
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
    videoUrl: 'https://fqsqtxtmdcajcnhpcwgw.supabase.co/storage/v1/object/public/sppg-assets/hero/1791362609925_qifjdf.mp4',
    videoPoster: trayImg1,
    videoOverlayOpacity: 0.45,
    showVideoSoundToggle: true,
    autoLoopPlaylist: true,
    videoIntervalSeconds: 0, // 0 = transisi otomatis saat video selesai diputar
    videos: [
      {
        id: 'vid-1791362614609',
        title: 'Video 1: Dapur & Olahan Sayuran Segar SPPG',
        url: 'https://fqsqtxtmdcajcnhpcwgw.supabase.co/storage/v1/object/public/sppg-assets/hero/1791362609925_qifjdf.mp4',
        poster: trayImg1
      },
      {
        id: 'vid-1791362627190',
        title: 'Video 2: Penataan Meja Persiapan & Porsi MBG',
        url: 'https://fqsqtxtmdcajcnhpcwgw.supabase.co/storage/v1/object/public/sppg-assets/hero/1791362621960_a4uig3.mp4',
        poster: trayImg2
      },
      {
        id: 'vid-custom',
        title: 'Video 3: Pengolahan Sup Panci Besar Dapur Sentra',
        url: 'https://fqsqtxtmdcajcnhpcwgw.supabase.co/storage/v1/object/public/sppg-assets/hero/1791359566504_4wfoj7.mp4',
        poster: trayImg3
      }
    ],
    heroBadge: 'Satuan Pelayanan Pemenuhan Gizi (SPPG)',
    heroTitle: 'Dari Dapur SPPG Tumpang Jeru, Menu MBG Disiapkan Setiap Hari',
    heroSubtitle: 'Mulai dari penerimaan bahan pangan, proses pengolahan di dapur, hingga pengiriman makanan ke sekolah, setiap tahap menjadi bagian dari pelaksanaan Program Makan Bergizi Gratis di Tumpang Jeru.',
    primaryCtaText: 'Lihat Menu MBG',
    primaryCtaLink: '#siklus-menu',
    secondaryCtaText: 'Jadwal Operasional',
    secondaryCtaLink: '#alur-operasional',
    autoSlidePhotos: true,
    photoSlideInterval: 4,
    photoSlides: [
      {
        id: 'hero-photo-1',
        title: 'Nasi, Ayam Kecap, Tempe, Sayur, dan Buah',
        category: 'Menu Hari Ini',
        description: 'Menu ini disajikan sesuai standar gizi dengan porsi yang sesuai untuk anak sekolah.',
        imageUrl: trayImg1,
        badge: 'Menu Hari Ini',
        targetGrams: '± 450 gram',
      },
      {
        id: 'hero-photo-2',
        title: 'Kesiapan Wadah Ganda Boks Termal',
        category: 'Rantai Suhu Terjaga',
        description: 'Penimbangan gramatur presisi sebelum dimasukkan ke boks insulasi tertutup untuk menjaga kehangatan hidangan.',
        imageUrl: trayImg2,
        badge: 'Insulasi Termal',
        targetGrams: '460 gram',
      },
      {
        id: 'hero-photo-3',
        title: 'Penataan Warna & Keseimbangan Gizi',
        category: 'Variasi Porsi Seimbang',
        description: 'Kombinasi warna alami sayur, lauk protein, buah, dan nasi pulen dirancang menarik secara visual untuk nafsu makan anak.',
        imageUrl: trayImg3,
        badge: 'AKG Seimbang',
        targetGrams: '450 gram',
      },
      {
        id: 'hero-photo-4',
        title: 'Sajian Porsi Lengkap MBG SPPG Jeru',
        category: 'Paket Menu Harian',
        description: 'Nasi pulen, ayam ungkep rempah, tempe bacem kedelai lokal, sop sayur segar, buah semangka, dan susu pasteurisasi.',
        imageUrl: posterMenuImg,
        badge: '1/3 AKG Harian',
        targetGrams: '470 gram',
      },
    ]
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
  menuToday: {
    dateText: 'Rabu, 14 Oktober 2026',
    menuTitle: 'Nasi Putih, Ayam Bumbu Kuning, Sayur Sop, Tempe Bacem, dan Pisang',
    menuSubtitle: 'Paket Menu Bergizi Lengkap Standar Nasional SPPG Jeru',
    description: 'Sajian makanan higienis harian yang disusun oleh ahli gizi untuk memenuhi sepertiga kebutuhan energi dan protein harian anak sekolah secara proporsional.',
    imageUrl: trayImg1,
    energySummary: {
      caloriesAvg: '585 kkal',
      proteinAvg: '26 g',
      carbsAvg: '82 g',
      fatAvg: '15 g',
      fiberAvg: '6.5 g',
      calciumAvg: '190 mg',
      ironAvg: '3.4 mg'
    },
    portionSmall: {
      tierName: 'Porsi Kecil (PAUD & SD Kelas 1–3)',
      targetCalories: '465 kkal',
      totalGramature: '± 360 gram',
      description: 'Disesuaikan dengan kapasitas lambung dan kebutuhan metabolisme anak usia 5–9 tahun.',
      proteinGrams: '19 g',
      carbGrams: '68 g',
      fatGrams: '12 g',
      fiberGrams: '4.8 g'
    },
    portionLarge: {
      tierName: 'Porsi Besar (SD Kelas 4–6 & SMP)',
      targetCalories: '685 kkal',
      totalGramature: '± 490 gram',
      description: 'Diperkaya kalori dan protein ekstra guna menopang percepatan pertumbuhan pubertas dan aktivitas fisik aktif.',
      proteinGrams: '29 g',
      carbGrams: '96 g',
      fatGrams: '17 g',
      fiberGrams: '7.8 g'
    },
    allergensWarning: 'Bebas Kacang Tanah • Halal 100% • Wadah Food-Grade SUS 304',
    qcStatus: 'Lolos Uji Sensoris Organoleptik & Suhu Inti Masak ≥ 75°C',
    qrTargetUrl: '/menu-mbg-hari-ini',
    ingredients: [
      {
        id: 'ing-1',
        name: 'Nasi Putih Pulen Lokal',
        category: 'Karbohidrat',
        portionSmall: '100 gram',
        portionLarge: '150 gram',
        imageUrl: nasiPutihBowlImg,
        nutritionHighlight: 'Energi 175 kkal • Karbohidrat 40g',
        healthBenefits: 'Sumber glukosa murni dan energi utama otak anak, menjaga konsentrasi belajar tetap prima di dalam kelas.',
        supplier: 'Poktan Sri Rejeki, Malangsuko Tumpang',
        notes: 'Beras pandanwangi lokal bebas bahan pemutih sintetis.'
      },
      {
        id: 'ing-2',
        name: 'Ayam Ungkep Bumbu Kuning',
        category: 'Protein Hewani',
        portionSmall: '50 gram',
        portionLarge: '75 gram',
        imageUrl: ayamBumbuKuningImg,
        nutritionHighlight: 'Protein 22g • Zat Besi 1.8mg',
        healthBenefits: 'Asam amino esensial untuk pembentukan otot, pertumbuhan sel darah merah, serta kurkumin kunyit sebagai anti-inflamasi alami.',
        supplier: 'UD Sumber Tani, Pakis Malang',
        notes: 'Daging ayam segar dipotong higienis bersertifikasi halal.'
      },
      {
        id: 'ing-3',
        name: 'Tempe Bacem Tradisional',
        category: 'Protein Nabati',
        portionSmall: '35 gram',
        portionLarge: '50 gram',
        imageUrl: tempeBacemImg,
        nutritionHighlight: 'Protein 9g • Kalsium 75mg • Probiotik',
        healthBenefits: 'Kedelai fermentasi kaya bakteri baik untuk saluran cerna anak, serta membantu penguatan tulang dan gigi.',
        supplier: 'Sentra Tempe Krajan, Desa Jeru',
        notes: 'Diolah dengan gula aren asli tanpa pemanis buatan.'
      },
      {
        id: 'ing-4',
        name: 'Sayur Sop Wortel, Buncis & Kubis',
        category: 'Sayuran',
        portionSmall: '60 gram',
        portionLarge: '90 gram',
        imageUrl: sayurSopImg,
        nutritionHighlight: 'Serat 3.5g • Vitamin A 420mcg • Kalium',
        healthBenefits: 'Beta-karoten untuk kesehatan mata anak, serat alami mencegah sembelit, dan kuah kaldu menjaga hidrasi sel.',
        supplier: 'Kelompok Tani Jeru & Poncokusumo',
        notes: 'Sayur segar dipetik sore hari dan dimasak subuh hari.'
      },
      {
        id: 'ing-5',
        name: 'Buah Pisang Mas Lokal',
        category: 'Buah',
        portionSmall: '1 buah (± 60g)',
        portionLarge: '1 buah (± 85g)',
        imageUrl: buahPisangImg,
        nutritionHighlight: 'Kalium 360mg • Vitamin C 11mg',
        healthBenefits: 'Elektrolit alami untuk memulihkan energi setelah jam olahraga, serta memicu produksi hormon bahagia secara alami.',
        supplier: 'Mitra Petani Buah Malang',
        notes: 'Buah segar matang alami tanpa karbit kimiawi.'
      }
    ],
    plateTip: '',
    bodyWeightSmallKg: '27',
    bodyWeightLargeKg: '37',
    nutritionHero: {
      name: 'Tempe',
      category: 'Protein Nabati',
      imageUrl: tempeMaskotImg,
      points: [
        'Membantu pertumbuhan dan memperbaiki jaringan tubuh.',
        'Mengandung protein, kalsium dan probiotik.',
        'Baik untuk kesehatan tulang dan pencernaan.'
      ]
    },
    // Isi awal yang bisa diubah petugas di CMS; foto kosong memakai ilustrasi anak sehat.
    dailyHabits: [
      {
        weekday: 1,
        title: 'Cuci tangan pakai sabun',
        description: 'Biasakan cuci tangan dengan sabun sebelum makan. Tangan bersih, makanan lebih aman dan sehat!',
        steps: ['Basahi tangan dengan air mengalir', 'Gosok sabun ke telapak, sela jari, dan kuku', 'Bilas sampai bersih lalu keringkan'],
        imageUrl: cuciTanganImg
      },
      {
        weekday: 2,
        title: 'Berdoa sebelum makan',
        description: 'Duduk rapi dan berdoa bersama sebelum mulai makan.',
        steps: ['Duduk rapi di tempatmu', 'Berdoa bersama teman', 'Mulai makan dengan tenang'],
        imageUrl: ''
      },
      {
        weekday: 3,
        title: 'Habiskan makananmu',
        description: 'Makanan di ompreng sudah disiapkan sesuai kebutuhan tubuhmu. Yuk, habiskan sampai bersih!',
        steps: ['Ambil porsi makan dengan tenang', 'Kunyah pelan-pelan', 'Habiskan sampai ompreng bersih'],
        imageUrl: ''
      },
      {
        weekday: 4,
        title: 'Minum air putih',
        description: 'Air putih membantu tubuh tetap segar dan fokus belajar.',
        steps: ['Bawa botol minum dari rumah', 'Minum air putih setelah makan', 'Isi ulang botol saat istirahat'],
        imageUrl: ''
      },
      {
        weekday: 5,
        title: 'Buang sampah pada tempatnya',
        description: 'Setelah makan, rapikan meja dan buang sampah ke tempat sampah.',
        steps: ['Kumpulkan sisa bungkus dan tisu', 'Buang ke tempat sampah', 'Kembalikan ompreng dengan rapi'],
        imageUrl: ''
      },
      {
        weekday: 6,
        title: 'Makan sayur dan buah',
        description: 'Sayur dan buah berwarna-warni membantu menjaga daya tahan tubuh.',
        steps: ['Coba semua sayur di ompreng', 'Makan buahnya juga', 'Ceritakan sayur favoritmu ke teman'],
        imageUrl: ''
      }
    ]
  },
  lastUpdated: new Date().toISOString()
};

// Gambar bawaan di src/assets, dipetakan dari nama file tanpa ekstensi ke URL build saat ini.
const BUNDLED_ASSETS: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../assets/*.{jpg,jpeg,png,webp}', { eager: true, import: 'default' })
  ).map(([path, url]) => [path.split('/').pop()!.replace(/\.\w+$/, ''), url])
);

/**
 * Config yang tersimpan (localStorage/Supabase) bisa berisi URL aset dari build lain,
 * misal "/assets/tray_sample_1-BJd2G0Fi.jpg" atau "/src/assets/tray_sample_1.jpg".
 * Hash nama file berubah setiap build sehingga URL lama rusak; arahkan ulang ke aset build ini.
 */
function relinkBundledAssets<T>(value: T): T {
  if (typeof value === 'string') {
    const match = value.match(/^(?:https?:\/\/[^/]+)?\/(?:src\/)?assets\/([^/?#]+?)\.(?:jpe?g|png|webp)$/i);
    if (!match) return value;
    const fileStem = decodeURIComponent(match[1]);
    const resolved = BUNDLED_ASSETS[fileStem] ?? BUNDLED_ASSETS[fileStem.replace(/-[\w-]{8}$/, '')];
    return (resolved ?? value) as T;
  }
  if (Array.isArray(value)) return value.map(relinkBundledAssets) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, relinkBundledAssets(v)])
    ) as T;
  }
  return value;
}

/**
 * Normalisasi objek konfigurasi agar selalu memiliki struktur lengkap
 */
function normalizeConfig(parsed: Partial<WebsiteConfig> | null | undefined): WebsiteConfig {
  if (!parsed) return DEFAULT_WEBSITE_CONFIG;
  parsed = relinkBundledAssets(parsed);

  const parsedHero: Partial<WebsiteHeroConfig> = parsed.hero || {};
  let normalizedVideos: HeroVideoItem[] = DEFAULT_WEBSITE_CONFIG.hero.videos;
  if (Array.isArray(parsedHero.videos) && parsedHero.videos.length > 0) {
    // Otomatis ganti ke video Supabase jika cache browser menyimpan tautan dummy mixkit
    const hasMixkitUrl = parsedHero.videos.some(v => v.url && v.url.includes('mixkit.co'));
    if (hasMixkitUrl) {
      normalizedVideos = DEFAULT_WEBSITE_CONFIG.hero.videos;
    } else {
      normalizedVideos = parsedHero.videos;
    }
  } else if (parsedHero.videoUrl && !parsedHero.videoUrl.includes('mixkit.co')) {
    normalizedVideos = [
      {
        id: 'vid-custom',
        title: 'Video Latar Belakang Hero',
        url: parsedHero.videoUrl,
        poster: parsedHero.videoPoster || DEFAULT_WEBSITE_CONFIG.hero.videoPoster
      }
    ];
  }

  const primaryVideoUrl = normalizedVideos[0]?.url || DEFAULT_WEBSITE_CONFIG.hero.videoUrl;

  // Migrasi otomatis dari wording bawaan lama ke wording standar terkini
  const effectiveHeroTitle = (parsedHero.heroTitle === 'Ketertelusuran Rantai Pangan & Standar Gizi Harian untuk Generasi Penerus' || !parsedHero.heroTitle)
    ? DEFAULT_WEBSITE_CONFIG.hero.heroTitle
    : parsedHero.heroTitle;

  const effectiveHeroBadge = (parsedHero.heroBadge === 'Satuan Pelayanan Pemenuhan Gizi Kabupaten Malang' || !parsedHero.heroBadge)
    ? DEFAULT_WEBSITE_CONFIG.hero.heroBadge
    : parsedHero.heroBadge;

  const effectiveHeroSubtitle = (parsedHero.heroSubtitle?.includes('penimbangan bahan segar petani lokal Tumpang') || !parsedHero.heroSubtitle)
    ? DEFAULT_WEBSITE_CONFIG.hero.heroSubtitle
    : parsedHero.heroSubtitle;

  const effectivePrimaryCta = (parsedHero.primaryCtaText === 'Lihat Siklus Menu MBG' || !parsedHero.primaryCtaText)
    ? DEFAULT_WEBSITE_CONFIG.hero.primaryCtaText
    : parsedHero.primaryCtaText;

  const effectiveSecondaryCta = (parsedHero.secondaryCtaText === 'Alur Operasional 04.00 WIB' || !parsedHero.secondaryCtaText)
    ? DEFAULT_WEBSITE_CONFIG.hero.secondaryCtaText
    : parsedHero.secondaryCtaText;

  const normalizedPhotoSlides = ((Array.isArray(parsedHero.photoSlides) && parsedHero.photoSlides.length > 0)
    ? parsedHero.photoSlides
    : DEFAULT_WEBSITE_CONFIG.hero.photoSlides || []).map(slide => {
      if (slide.id === 'hero-photo-1' && slide.title === 'Sajian Nampan 5 Sekat SUS 304') {
        return {
          ...slide,
          title: 'Nasi, Ayam Kecap, Tempe, Sayur, dan Buah',
          category: 'Menu Hari Ini',
          badge: 'Menu Hari Ini',
          targetGrams: '± 450 gram',
          description: 'Menu ini disajikan sesuai standar gizi dengan porsi yang sesuai untuk anak sekolah.'
        };
      }
      return slide;
    });

  const normalizedMenuToday: WebsiteMenuTodayConfig = parsed.menuToday ? {
    ...DEFAULT_WEBSITE_CONFIG.menuToday,
    ...parsed.menuToday,
    energySummary: {
      ...DEFAULT_WEBSITE_CONFIG.menuToday.energySummary,
      ...(parsed.menuToday.energySummary || {})
    },
    portionSmall: {
      ...DEFAULT_WEBSITE_CONFIG.menuToday.portionSmall,
      ...(parsed.menuToday.portionSmall || {})
    },
    portionLarge: {
      ...DEFAULT_WEBSITE_CONFIG.menuToday.portionLarge,
      ...(parsed.menuToday.portionLarge || {})
    },
    ingredients: (Array.isArray(parsed.menuToday.ingredients) && parsed.menuToday.ingredients.length > 0)
      ? parsed.menuToday.ingredients
      : DEFAULT_WEBSITE_CONFIG.menuToday.ingredients,
    nutritionHero: {
      ...DEFAULT_WEBSITE_CONFIG.menuToday.nutritionHero,
      ...(parsed.menuToday.nutritionHero || {})
    },
    dailyHabits: Array.isArray(parsed.menuToday.dailyHabits)
      ? parsed.menuToday.dailyHabits
      : DEFAULT_WEBSITE_CONFIG.menuToday.dailyHabits
  } : DEFAULT_WEBSITE_CONFIG.menuToday;

  return {
    hero: {
      ...DEFAULT_WEBSITE_CONFIG.hero,
      ...parsedHero,
      backgroundType: parsedHero.backgroundType || 'video',
      videoUrl: primaryVideoUrl,
      videos: normalizedVideos,
      heroBadge: effectiveHeroBadge,
      heroTitle: effectiveHeroTitle,
      heroSubtitle: effectiveHeroSubtitle,
      primaryCtaText: effectivePrimaryCta,
      secondaryCtaText: effectiveSecondaryCta,
      photoSlides: normalizedPhotoSlides,
      autoSlidePhotos: parsedHero.autoSlidePhotos ?? DEFAULT_WEBSITE_CONFIG.hero.autoSlidePhotos,
      photoSlideInterval: parsedHero.photoSlideInterval || DEFAULT_WEBSITE_CONFIG.hero.photoSlideInterval
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
    menuToday: normalizedMenuToday,
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
  /** true jika Supabase terhubung tapi sinkron gagal, jadi layak dicoba lagi */
  cloudFailed: boolean;
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
      cloudFailed: false,
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
        cloudFailed: true,
        message: `Tersimpan di browser lokal. Cloud pending: ${error.message}`
      };
    }

    return {
      success: true,
      isCloudSynced: true,
      cloudFailed: false,
      message: 'Konfigurasi website berhasil disinkronkan ke Database Cloud Supabase!'
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return {
      success: true,
      isCloudSynced: false,
      cloudFailed: true,
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

