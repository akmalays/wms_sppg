import React, { useState, useEffect, useRef, useMemo } from 'react';
import logoSppgImg from '../assets/logo sppg.png';
import trayImg1 from '../assets/tray_sample_1.jpg';
import trayImg2 from '../assets/tray_double_1.jpg';
import trayImg3 from '../assets/tray_double_2.jpg';
import posterMenuImg from '../assets/poster-single.jpg';
import posterDoubleImg from '../assets/poster-double.jpg';
import sppgBuildingImg from '../assets/sppg_building.jpg';
import nasiPutihBowlImg from '../assets/nasi_putih_bowl.jpg';
import ayamBumbuKuningImg from '../assets/ayam_bumbu_kuning.jpg';
import tempeBacemImg from '../assets/tempe_bacem.jpg';
import sayurSopImg from '../assets/sayur_sop.jpg';
import buahPisangImg from '../assets/buah_pisang.jpg';
import operasionalPenerimaanImg from '../assets/operasional_penerimaan.jpg';
import operasionalPengolahanImg from '../assets/operasional_pengolahan.jpg';
import operasionalPengemasanImg from '../assets/operasional_pengemasan.jpg';
import operasionalDistribusiImg from '../assets/operasional_distribusi.jpg';
import penyaluranSiswaImg from '../assets/penyaluran_siswa.jpg';
import {
  getWebsiteConfig,
  fetchWebsiteConfigFromCloud,
  WEBSITE_CONFIG_UPDATED_EVENT,
  DEFAULT_WEBSITE_CONFIG,
  INGREDIENT_CATEGORIES,
  WebsiteConfig
} from '../db/websiteConfigStorage';
import { fetchPublicSiteData, PublicSiteData, currentWeekRange } from '../db/publicSiteData';
import { localDateIso, parseIndonesianDate } from '../utils/localDate';
import {
  LayoutGrid,
  ArrowRight,
  Building2,
  Home,
  Scale,
  Leaf,
  Utensils,
  MapPin,
  Phone,
  UtensilsCrossed,
  Clock,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Menu,
  X,
  Ban,
  AlertTriangle,
  MessageCircle
} from 'lucide-react';
import { SPPG_ADDRESS, SPPG_EMAIL, SPPG_PHONE } from './common/KopText';
import { FoodDoodles } from './common/FoodDoodles';
import { FoodImage } from './menuPublic/FoodIllustrations';
import { TrayStage, menuDishes, resolveTrayLabels, shownTrayLabels, trayLabelTexts } from './menuPublic/TrayStage';
import { DocumentationRecapSection } from './landing/DocumentationRecapSection';

export interface LandingPageProps {
  isStaffLoggedIn?: boolean;
  onReturnToDashboard?: () => void;
  staffName?: string;
}

interface TraySectionInfo {
  id: string;
  name: string;
  category: string;
  targetGrams: string;
  calories: string;
  supplier: string;
  description: string;
}

export const FOOD_COMPONENTS = [
  {
    id: 'karbohidrat',
    category: 'Karbohidrat',
    title: 'Nasi Putih',
    description: 'Nasi dimasak dengan air bersih bersuhu terkontrol untuk menghasilkan tekstur pulen dan aman dikonsumsi.',
    image: nasiPutihBowlImg
  },
  {
    id: 'protein_hewani',
    category: 'Protein Hewani',
    title: 'Ayam Bumbu Kuning',
    description: 'Daging ayam segar pilihan diolah dengan bumbu rempah alami kunyit, jahe, dan serai tanpa pengawet atau penyedap berlebih.',
    image: ayamBumbuKuningImg
  },
  {
    id: 'protein_nabati',
    category: 'Protein Nabati',
    title: 'Tempe',
    description: 'Fermentasi kedelai higienis kaya protein nabati, zat besi, serat pangan, dan kalsium alami yang mudah dicerna.',
    image: tempeBacemImg
  },
  {
    id: 'sayuran',
    category: 'Sayuran',
    title: 'Sayur Sop',
    description: 'Wortel, kubis, dan buncis dipanen segar harian, dimasak dengan kaldu bening gurih bernutrisi tinggi serat dan mikronutrien.',
    image: sayurSopImg
  },
  {
    id: 'buah',
    category: 'Buah',
    title: 'Pisang',
    description: 'Buah segar matang pohon sumber kalium alami dan vitamin C untuk melengkapi kebutuhan gizi harian siswa.',
    image: buahPisangImg
  }
];

export const OPERATIONAL_STEPS = [
  {
    step: 1,
    title: 'Penerimaan Bahan Pangan',
    description: 'Bahan yang diterima diperiksa berdasarkan jenis, jumlah, dan kondisi fisiknya.',
    image: operasionalPenerimaanImg
  },
  {
    step: 2,
    title: 'Persiapan dan Pengolahan',
    description: 'Bahan pangan disiapkan dan diolah sesuai menu serta prosedur kerja yang berlaku.',
    image: operasionalPengolahanImg
  },
  {
    step: 3,
    title: 'Pemeriksaan dan Pengemasan',
    description: 'Makanan diperiksa dan dikemas sebelum disiapkan untuk pengiriman ke sekolah.',
    image: operasionalPengemasanImg
  },
  {
    step: 4,
    title: 'Distribusi ke Sekolah',
    description: 'Makanan dikirim ke sekolah penerima sesuai jadwal distribusi yang ditetapkan.',
    image: operasionalDistribusiImg
  }
];

export const ACTIVITY_DOCS = [
  {
    id: 'doc-1',
    title: 'Persiapan Bahan',
    description: 'Pencucian dan pemotongan bahan makanan di dapur.',
    image: operasionalPengolahanImg
  },
  {
    id: 'doc-2',
    title: 'Pengemasan Makanan',
    description: 'Proses menata makanan ke dalam wadah sebelum distribusi.',
    image: operasionalPengemasanImg
  },
  {
    id: 'doc-3',
    title: 'Pemeriksaan Menu',
    description: 'Pemeriksaan kualitas dan kebersihan sebelum pengiriman.',
    image: operasionalPenerimaanImg
  },
  {
    id: 'doc-4',
    title: 'Penyaluran ke Sekolah',
    description: 'Dokumentasi penerimaan menu MBG di sekolah.',
    image: penyaluranSiswaImg
  }
];

export const BENEFICIARY_SCHOOLS = [
  { name: 'SDN 1 Jeru', location: 'Desa Jeru, Tumpang' },
  { name: 'SDN 2 Jeru', location: 'Desa Jeru, Tumpang' },
  { name: 'SDN 1 Malangsuko', location: 'Malangsuko, Tumpang' },
  { name: 'SDN 2 Malangsuko', location: 'Malangsuko, Tumpang' },
  { name: 'SDN 3 Tumpang', location: 'Krajan Tumpang' },
  { name: 'SDN 1 Tumpang', location: 'Pusat Tumpang' },
  { name: 'SMPN 1 Tumpang', location: 'Kauman, Tumpang' },
  { name: 'SMPN 2 Tumpang', location: 'Kebonsari, Tumpang' },
  { name: 'SDN 2 Tumpang', location: 'Raya Tumpang' },
  { name: 'MI Miftahul Huda', location: 'Dsn. Krajan, Jeru' },
  { name: 'MI Nurul Huda', location: 'Tumpang Barat' },
  { name: 'MTs Al-Ittihad', location: 'Kecamatan Tumpang' },
  { name: 'SDN 4 Tumpang', location: 'Tumpang' },
  { name: 'SMPN 3 Tumpang', location: 'Tumpang' }
];

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const parseIso = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const shortDate = (iso: string) => parseIso(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

// "Nasi, Ayam Goreng, Sayur Sop dan Pisang" -> ["Nasi", "Ayam Goreng", "Sayur Sop", "Pisang"]
const splitDishes = (title: string) =>
  title.split(/,|\s+dan\s+|\s*\+\s*/i).map(x => x.trim()).filter(Boolean);

// Tautan bagian lama yang tersimpan di konfigurasi website diarahkan ke id yang benar.
const LEGACY_ANCHORS: Record<string, string> = { '#alur-pagi': '#alur-operasional' };
const fixAnchor = (href: string | undefined, fallback: string) => {
  const value = (href || '').trim() || fallback;
  return LEGACY_ANCHORS[value] || value;
};

const NAV_LINKS = [
  { href: '#siklus-menu', label: 'Menu MBG' },
  { href: '#alur-operasional', label: 'Alur Operasional' },
  { href: '#sekolah-penerima', label: 'Sekolah Penerima' },
  { href: '#dokumentasi-kegiatan', label: 'Dokumentasi' },
  { href: '#panduan-penerima', label: 'Panduan' },
  { href: '#kontak-sppg', label: 'Kontak' },
];

// Bunyi dua aturan ini mengikuti stiker segel ompreng (print/MealBoxLabelDoc), agar sama dengan yang dibaca di sekolah.
const GUIDE_RULES = [
  {
    Icon: Clock,
    title: 'Makan sebelum jam di stiker',
    text: 'Stiker segel pada ompreng mencantumkan batas jam konsumsi. Segera makan sebelum jam tersebut.',
  },
  {
    Icon: Ban,
    title: 'Jangan dibawa pulang',
    text: 'Makanan tidak boleh dibawa pulang atau dipindah ke kotak makan maupun foam.',
  },
];

const GUIDE_HELP = [
  {
    Icon: AlertTriangle,
    title: 'Punya alergi?',
    text: 'Bahan dan peringatan alergen tertulis di halaman menu hari ini. Untuk alergi berat, tanyakan langsung ke dapur SPPG.',
    links: [{ href: '/menu-mbg-hari-ini', label: 'Cek bahan menu hari ini' }],
  },
  {
    Icon: MessageCircle,
    title: 'Ada keluhan atau masukan?',
    text: 'Nilai menu lewat QR di halaman menu hari ini. Untuk keluhan yang perlu segera ditangani, hubungi SPPG.',
    links: [
      { href: '/menu-mbg-hari-ini', label: 'Beri penilaian menu' },
      { href: '#kontak-sppg', label: 'Hubungi SPPG' },
    ],
  },
];

const PUBLIC_FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#133d2c] focus-visible:ring-offset-2';

const formatMenuHeadline = (raw: string): string => {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

interface IngredientCardTone {
  bandBg: string;
  plateTint: string;
  ringColor: string;
  badgeBg: string;
  badgeText: string;
  dot: string;
}

const getIngredientTone = (category: string): IngredientCardTone => {
  const c = (category || '').toLowerCase();
  if (c.includes('karbo') || c.includes('pokok')) {
    return {
      bandBg: 'bg-[#fdf6e7]',
      plateTint: '#fbf0d4',
      ringColor: 'border-[#e9d39c]',
      badgeBg: 'bg-[#f8e7be]',
      badgeText: 'text-[#783f04]',
      dot: 'bg-[#d97706]',
    };
  }
  if (c.includes('hewani')) {
    return {
      bandBg: 'bg-[#fef2ea]',
      plateTint: '#fde4d3',
      ringColor: 'border-[#efc4a8]',
      badgeBg: 'bg-[#fbd9c4]',
      badgeText: 'text-[#8c2d0c]',
      dot: 'bg-[#ea580c]',
    };
  }
  if (c.includes('nabati') || c.includes('protein')) {
    return {
      bandBg: 'bg-[#f3f6e7]',
      plateTint: '#e6edd0',
      ringColor: 'border-[#cedaa8]',
      badgeBg: 'bg-[#dfe9bd]',
      badgeText: 'text-[#365314]',
      dot: 'bg-[#65a30d]',
    };
  }
  if (c.includes('sayur')) {
    return {
      bandBg: 'bg-[#ebf7f0]',
      plateTint: '#d8efe2',
      ringColor: 'border-[#b3dec5]',
      badgeBg: 'bg-[#cbead7]',
      badgeText: 'text-[#14532d]',
      dot: 'bg-[#15803d]',
    };
  }
  if (c.includes('buah')) {
    return {
      bandBg: 'bg-[#fdf1f5]',
      plateTint: '#fae0e9',
      ringColor: 'border-[#efbfd0]',
      badgeBg: 'bg-[#f7d3e0]',
      badgeText: 'text-[#881337]',
      dot: 'bg-[#e11d48]',
    };
  }
  return {
    bandBg: 'bg-[#f6f3ec]',
    plateTint: '#ede7db',
    ringColor: 'border-[#dad1c0]',
    badgeBg: 'bg-[#e8e1d3]',
    badgeText: 'text-[#334155]',
    dot: 'bg-[#64748b]',
  };
};

// Ornamen ranting daun botani khusus sudut panggung hijau agar latar tidak polos tanpa mengganggu keterbacaan label nampan.
const TrayCornerSprig: React.FC<{ className?: string; flip?: boolean }> = ({ className = '', flip }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 180 180"
    fill="none"
    className={`pointer-events-none absolute ${flip ? '-scale-x-100 -scale-y-100' : ''} ${className}`}
  >
    <path
      d="M-8 168C28 124 68 82 146 28"
      stroke="#7dd3a8"
      strokeOpacity="0.28"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M30 124C14 96 20 66 46 54C56 80 50 106 30 124Z"
      fill="#236449"
      fillOpacity="0.58"
    />
    <path
      d="M66 90C54 62 66 34 94 26C98 54 88 78 66 90Z"
      fill="#2b7556"
      fillOpacity="0.48"
    />
    <path
      d="M44 114C72 114 98 102 112 78C86 78 60 90 44 114Z"
      fill="#1d543d"
      fillOpacity="0.65"
    />
    <path
      d="M98 62C118 64 138 56 150 40C130 38 110 46 98 62Z"
      fill="#2b7556"
      fillOpacity="0.45"
    />
    <circle cx="132" cy="22" r="3" fill="#d9c382" fillOpacity="0.45" />
    <circle cx="152" cy="54" r="2.2" fill="#a7f3d0" fillOpacity="0.35" />
    <circle cx="84" cy="126" r="2.5" fill="#d9c382" fillOpacity="0.35" />
  </svg>
);

// Model yang sama dengan halaman menu hari ini: nama dan panah putih di atas panggung hijau SPPG,
// nomor pada makanan di layar sempit agar mudah dibaca.
const PostedTray: React.FC<{ menuToday: WebsiteConfig['menuToday']; photo: string; alt: string }> = ({ menuToday, photo, alt }) => {
  const dishTexts = useMemo(() => trayLabelTexts(menuDishes(menuToday).regular), [menuToday]);
  const placements = useMemo(() => resolveTrayLabels(dishTexts, menuToday.trayLabels), [dishTexts, menuToday.trayLabels]);
  const texts = useMemo(() => shownTrayLabels(dishTexts, placements), [dishTexts, placements]);
  return (
    <div className="relative overflow-hidden h-full bg-[linear-gradient(155deg,#174c36_0%,#103828_54%,#0a261b_100%)] px-4 py-7 sm:px-6 sm:py-9 lg:px-7 lg:py-10 flex flex-col justify-center">
      {/* Pola doodle bahan pangan & alat makan di tepian panggung; memudar di tengah agar label panah tetap kontras */}
      <FoodDoodles
        width={760}
        height={520}
        seed={7}
        className="inset-0 w-full h-full text-emerald-100 opacity-[0.14] [mask-image:radial-gradient(ellipse_at_center,transparent_22%,black_82%)]"
      />

      {/* Ornamen ranting daun botani di dua sudut diagonal */}
      <TrayCornerSprig className="-top-6 -left-6 w-36 h-36 sm:w-44 sm:h-44" />
      <TrayCornerSprig flip className="-bottom-6 -right-6 w-36 h-36 sm:w-44 sm:h-44" />

      {/* Bingkai garis tipis ala kartu menu cetak */}
      <div
        className="pointer-events-none absolute inset-3 rounded-xl border border-white/12"
        aria-hidden="true"
      />
      <span className="pointer-events-none absolute top-3 left-3 w-3 h-3 border-t-2 border-l-2 border-[#d9c382]/55 rounded-tl-md" aria-hidden="true" />
      <span className="pointer-events-none absolute top-3 right-3 w-3 h-3 border-t-2 border-r-2 border-[#d9c382]/55 rounded-tr-md" aria-hidden="true" />
      <span className="pointer-events-none absolute bottom-3 left-3 w-3 h-3 border-b-2 border-l-2 border-[#d9c382]/55 rounded-bl-md" aria-hidden="true" />
      <span className="pointer-events-none absolute bottom-3 right-3 w-3 h-3 border-b-2 border-r-2 border-[#d9c382]/55 rounded-br-md" aria-hidden="true" />

      {/* Sorotan lembut tepat di belakang nampan stainless agar tepinya terangkat dari latar hijau gelap */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.16)_0%,rgba(16,56,40,0)_64%)]"
        aria-hidden="true"
      />

      {/* Label ringkas di bagian atas panggung */}
      <div className="relative z-10 flex items-center justify-between gap-2 px-1 pb-3 text-[11px] font-medium text-emerald-100/80">
        <span className="inline-flex items-center gap-1.5">
          <Leaf className="w-3.5 h-3.5 text-[#d9c382]" aria-hidden="true" />
          <span>Ompreng hari ini</span>
        </span>
        <span className="hidden sm:inline text-emerald-100/65">SPPG Tumpang Jeru</span>
      </div>

      <div className="relative z-10 w-full my-auto">
        <div className="hidden xl:block">
          <TrayStage photo={photo} alt={alt} texts={texts} placements={placements} labelTone="light" />
        </div>
        <div className="xl:hidden">
          <div className="max-w-md mx-auto">
            <TrayStage photo={photo} alt={alt} texts={texts} placements={placements} compact labelTone="light" />
          </div>
          <ol aria-label="Isi menu" className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2">
            {texts.map((text, i) => (
              <li key={text} className="flex items-start gap-2.5 text-xs sm:text-sm font-medium text-emerald-50 leading-snug">
                <span className="w-5 h-5 rounded-full bg-white/15 border border-white/25 text-white text-[11px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5" aria-hidden="true">
                  {i + 1}
                </span>
                <span>{formatMenuHeadline(text)}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
};

export const LandingPage: React.FC<LandingPageProps> = ({
  onReturnToDashboard,
  staffName
}) => {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [publicData, setPublicData] = useState<PublicSiteData | null>(null);

  useEffect(() => {
    let alive = true;
    fetchPublicSiteData().then(data => {
      if (alive) setPublicData(data);
    });
    return () => {
      alive = false;
    };
  }, []);
  const [config, setConfig] = useState<WebsiteConfig>(getWebsiteConfig);
  const [selectedMenuDate, setSelectedMenuDate] = useState<string>('');
  const [activeIngredientCategory, setActiveIngredientCategory] = useState<string>('Semua');
  const [showAllSchools, setShowAllSchools] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Hero Photo Slides Carousel (Dokumentasi Lapangan Kotak Kanan)
  const heroPhotoSlides = (config.hero.photoSlides && config.hero.photoSlides.length > 0)
    ? config.hero.photoSlides
    : (DEFAULT_WEBSITE_CONFIG.hero.photoSlides || []);

  const [currentHeroPhotoIndex, setCurrentHeroPhotoIndex] = useState(0);
  const [isHeroPhotoPaused, setIsHeroPhotoPaused] = useState(false);
  const activeHeroPhotoIndex = heroPhotoSlides.length > 0
    ? (currentHeroPhotoIndex % heroPhotoSlides.length)
    : 0;
  const currentHeroPhoto = heroPhotoSlides[activeHeroPhotoIndex] || heroPhotoSlides[0];

  // Helper render headline wording persis sesuai spesifikasi editorial
  const renderHeroTitle = (title: string) => {
    if (title.includes('Menu MBG Disiapkan Setiap Hari')) {
      return (
        <>
          <span className="block text-white">Dari Dapur SPPG</span>
          <span className="block text-white">Tumpang Jeru,</span>
          <span className="text-[#86efac] block">Menu MBG Disiapkan</span>
          <span className="text-[#86efac] block">Setiap Hari</span>
        </>
      );
    }
    if (title.includes('Menu MBG Disiapkan')) {
      const parts = title.split('Menu MBG Disiapkan');
      return (
        <>
          <span className="text-white">{parts[0]}</span>
          <span className="text-[#86efac]">Menu MBG Disiapkan{parts[1] || ''}</span>
        </>
      );
    }
    return <span className="text-white">{title}</span>;
  };

  // Timer auto-slide foto hero kotak kanan
  useEffect(() => {
    const isAutoSlide = config.hero.autoSlidePhotos ?? true;
    if (!isAutoSlide || isHeroPhotoPaused || heroPhotoSlides.length <= 1) return;

    const intervalTime = Math.max(2, config.hero.photoSlideInterval || 4) * 1000;
    const timer = setInterval(() => {
      setCurrentHeroPhotoIndex(prev => (prev + 1) % heroPhotoSlides.length);
    }, intervalTime);

    return () => clearInterval(timer);
  }, [config.hero.autoSlidePhotos, config.hero.photoSlideInterval, isHeroPhotoPaused, heroPhotoSlides.length]);

  // Multi-Video Playlist & Loop Management untuk Video Latar Belakang Hero
  const videoList = (config.hero.videos && config.hero.videos.length > 0)
    ? config.hero.videos
    : (config.hero.videoUrl ? [{ id: 'vid-1', title: 'Video Hero Utama', url: config.hero.videoUrl, poster: config.hero.videoPoster }] : []);

  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const activeVideoIndex = videoList.length > 0 ? (currentVideoIndex % videoList.length) : 0;
  const activeVideo = videoList[activeVideoIndex];

  // Handler loop otomatis saat video latar selesai diputar
  const handleVideoEnded = () => {
    if (videoList.length > 1) {
      setCurrentVideoIndex(prev => (prev + 1) % videoList.length);
    } else if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  };

  const handleVideoError = () => {
    console.warn('Gagal memuat video aktif:', activeVideo?.url);
    if (videoList.length > 1) {
      setCurrentVideoIndex(prev => (prev + 1) % videoList.length);
    }
  };

  // Pastikan browser modern mengizinkan autoplay video latar belakang secara otomatis
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !activeVideo?.url) return;
    el.muted = true;
    el.defaultMuted = true;
    try {
      el.setAttribute('muted', '');
    } catch {
      // Abaikan jika tidak didukung
    }

    const playPromise = el.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('Autoplay latar belakang ditunda oleh kebijakan browser:', err);
      });
    }
  }, [activeVideoIndex, activeVideo?.url]);

  // Listener untuk memulai autoplay jika browser menahan pemutaran
  useEffect(() => {
    const handleFirstUserInteraction = () => {
      if (videoRef.current && videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      }
    };

    window.addEventListener('click', handleFirstUserInteraction, { once: true });
    window.addEventListener('touchstart', handleFirstUserInteraction, { once: true });
    return () => {
      window.removeEventListener('click', handleFirstUserInteraction);
      window.removeEventListener('touchstart', handleFirstUserInteraction);
    };
  }, []);

  // Timer auto-switch jika pengguna mengaktifkan interval pergantian detik (> 0)
  useEffect(() => {
    const intervalSec = config.hero.videoIntervalSeconds;
    if (!intervalSec || intervalSec <= 0 || videoList.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentVideoIndex(prev => (prev + 1) % videoList.length);
    }, intervalSec * 1000);

    return () => clearInterval(timer);
  }, [config.hero.videoIntervalSeconds, videoList.length]);

  // Sinkronisasi otomatis saat konfigurasi diubah di dashboard CMS dan ambil data cloud
  useEffect(() => {
    const handleConfigUpdate = () => {
      setConfig(getWebsiteConfig());
    };
    window.addEventListener(WEBSITE_CONFIG_UPDATED_EVENT, handleConfigUpdate);

    // Tarik pembaruan konfigurasi dari Cloud Supabase di latar belakang
    fetchWebsiteConfigFromCloud().then(result => {
      if (result.fromCloud) {
        setConfig(result.config);
      }
    });

    return () => window.removeEventListener(WEBSITE_CONFIG_UPDATED_EVENT, handleConfigUpdate);
  }, []);

  // --- Data turunan untuk seksi menu, bahan, sekolah ---
  const todayIso = localDateIso();
  const week = currentWeekRange();
  const weekMenus = publicData?.weekMenus || [];
  const menuDates = Array.from(new Set(weekMenus.map(m => m.date)));
  const activeMenuDate = menuDates.includes(selectedMenuDate)
    ? selectedMenuDate
    : menuDates.includes(todayIso) ? todayIso : menuDates[0] || '';
  const activeMenus = weekMenus.filter(m => m.date === activeMenuDate);
  // Hanya hari yang tanggalnya sama dengan menu terbitan Atur Website yang ditampilkan; hari lain dibiarkan kosong.
  const postedDate = parseIndonesianDate(config.menuToday?.dateText || '');
  const isActiveDayPosted =
    (config.menuToday?.menuTitle || '').trim() !== '' && postedDate !== null && localDateIso(postedDate) === activeMenuDate;
  const postedPhoto = isActiveDayPosted ? config.menuToday.imageUrl || '' : '';

  const todayIngredients = config.menuToday?.ingredients || [];
  const componentCards = todayIngredients.length > 0
    ? todayIngredients.map(ing => ({
        id: ing.id,
        category: INGREDIENT_CATEGORIES.find(c => c.value === ing.category)?.label || ing.category || 'Bahan',
        title: ing.name,
        description: ing.healthBenefits?.trim() || ing.nutritionHighlight?.trim() || '',
        nutritionTags: (ing.nutritionHighlight || '')
          .split(/[•,;]/)
          .map(t => t.trim())
          .filter(Boolean)
          .slice(0, 3),
        portionSmall: ing.portionSmall?.trim() || '',
        portionLarge: ing.portionLarge?.trim() || '',
        image: ing.imageUrl,
      }))
    : FOOD_COMPONENTS.map(item => ({
        ...item,
        nutritionTags: [] as string[],
        portionSmall: '',
        portionLarge: '',
      }));
  const isSampleComponents = todayIngredients.length === 0;
  const ingredientCategories = Array.from(new Set(componentCards.map(c => c.category)));
  const selectedIngredientCat =
    activeIngredientCategory === 'Semua' || ingredientCategories.includes(activeIngredientCategory)
      ? activeIngredientCategory
      : 'Semua';
  const visibleComponentCards =
    selectedIngredientCat === 'Semua'
      ? componentCards
      : componentCards.filter(c => c.category === selectedIngredientCat);

  const schools = publicData?.schools.length
    ? publicData.schools.map(sc => ({ name: sc.name, location: sc.category }))
    : BENEFICIARY_SCHOOLS;

  return (
    <div className="min-h-screen bg-[#faf8f4] text-[#1c2420] font-sans selection:bg-[#d8eedf] selection:text-[#0c3123] antialiased">
      {/* Header Navigasi Editorial */}
      <header className="sticky top-0 z-30 bg-[#faf8f4]/95 backdrop-blur-md border-b border-[#e5dfd3]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          {/* Logo & Identitas SPPG */}
          <div className="flex items-center gap-3.5">
            <img
              src={logoSppgImg}
              alt="Logo SPPG"
              className="w-12 h-12 object-contain shrink-0 rounded-lg p-1 bg-white border border-[#ded8cb] shadow-2xs"
            />
            <div>
              <div className="text-[11px] font-semibold text-[#0c3123] tracking-wide">
                Badan Gizi Nasional RI
              </div>
              <div className="text-base font-bold text-[#141d18] font-serif-display leading-tight flex items-center gap-2">
                <span>SPPG MLG TUMPANG JERU</span>
              </div>
              <div className="text-[10px] text-[#63726a] font-medium">
                Desa Jeru, Kec. Tumpang, Kab. Malang
              </div>
            </div>
          </div>

          {/* Navigasi Seksi Publik */}
          <nav aria-label="Bagian halaman" className="hidden lg:flex items-center gap-6 text-xs font-semibold text-[#44534a]">
            {NAV_LINKS.map(link => (
              <a key={link.href} href={link.href} className={`hover:text-[#0c3123] rounded ${PUBLIC_FOCUS}`}>
                {link.label}
              </a>
            ))}
          </nav>

          {/* Status Layanan Publik / Tombol Dashboard untuk Staf */}
          <div className="flex items-center gap-2.5">
            {onReturnToDashboard ? (
              <div className="relative group flex items-center">
                <button
                  type="button"
                  onClick={onReturnToDashboard}
                  className="w-10 h-10 rounded-xl bg-[#0c3123] hover:bg-[#134431] active:bg-[#071f16] text-white flex items-center justify-center transition-all shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c3123] border border-[#1e5842]/40"
                  aria-label="Kembali ke Dashboard WMS"
                  title="Kembali ke Dashboard WMS"
                >
                  <LayoutGrid className="w-5 h-5 text-[#86efac]" />
                </button>

                {/* Tooltip */}
                <div
                  role="tooltip"
                  className="absolute right-0 top-full mt-2 hidden group-hover:flex group-focus-within:flex flex-col items-end z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="bg-slate-900 text-white px-3 py-1.5 rounded-lg shadow-xl text-xs font-medium whitespace-nowrap flex items-center gap-2 border border-slate-700/60">
                    <span className="font-semibold text-white">Kembali ke Dashboard WMS</span>
                    {staffName && (
                      <>
                        <span className="text-slate-500">•</span>
                        <span className="text-emerald-400 font-normal">{staffName}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(v => !v)}
              aria-expanded={isMobileNavOpen}
              aria-controls="mobile-public-nav"
              aria-label={isMobileNavOpen ? 'Tutup menu' : 'Buka menu'}
              className={`lg:hidden w-11 h-11 rounded-lg border border-[#ded7c8] bg-white flex items-center justify-center text-[#141d18] cursor-pointer ${PUBLIC_FOCUS}`}
            >
              {isMobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {isMobileNavOpen && (
          <nav id="mobile-public-nav" aria-label="Bagian halaman" className="lg:hidden border-t border-[#e5dfd3] bg-[#faf8f4]">
            <div className="max-w-7xl mx-auto px-4 py-2 flex flex-col">
              {NAV_LINKS.map(link => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileNavOpen(false)}
                  className={`flex items-center px-3 min-h-[44px] rounded-lg text-sm font-medium text-[#2a3830] hover:bg-[#f0ece1] ${PUBLIC_FOCUS}`}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </nav>
        )}
      </header>

      {/* 4. Hero Section: Editorial Headline dengan Video Latar Belakang Sinematik */}
      <section className="relative overflow-hidden pt-16 pb-16 lg:pt-24 lg:pb-28 border-b border-[#e5dfd3]">
        {/* Background Video atau Pola Alam */}
        {config.hero.backgroundType === 'video' && activeVideo?.url ? (
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            <video
              ref={videoRef}
              key={`bg-${activeVideo.url}`}
              src={activeVideo.url}
              autoPlay
              muted
              loop={videoList.length <= 1}
              playsInline
              preload="auto"
              onEnded={handleVideoEnded}
              onError={handleVideoError}
              poster={activeVideo.poster || config.hero.videoPoster || trayImg1}
              className="w-full h-full object-cover object-center filter brightness-[0.78] contrast-[1.05] transition-opacity duration-700"
            />
            {/* Lapisan Gradient Tint Berlapis untuk Keterbacaan Sempurna */}
            <div
              className="absolute inset-0 bg-gradient-to-r from-[#0c2217]/85 via-[#0d261a]/65 to-[#081710]/45"
              style={{ opacity: Math.max(0.25, Math.min(0.85, config.hero.videoOverlayOpacity)) }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#091811]/90 via-transparent to-[#0a1b13]/35" />
          </div>
        ) : (
          // Foto statis: latar foto (diatur di Atur Website) dengan lapisan gelap yang sama agar teks putih tetap terbaca.
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            <img
              src={config.hero.videoPoster || trayImg1}
              alt=""
              className="w-full h-full object-cover object-center brightness-[0.78]"
            />
            <div
              className="absolute inset-0 bg-gradient-to-r from-[#0c2217]/85 via-[#0d261a]/65 to-[#081710]/45"
              style={{ opacity: Math.max(0.25, Math.min(0.85, config.hero.videoOverlayOpacity)) }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#091811]/90 via-transparent to-[#0a1b13]/35" />
          </div>
        )}

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">
            {/* Narasi Utama */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl backdrop-blur-md text-xs font-medium border border-white/20 bg-black/35 text-white/95 shadow-xs">
                <Home className="w-3.5 h-3.5 text-emerald-400" />
                <span>{config.hero.heroBadge}</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-[50px] font-bold font-display leading-[1.14] tracking-tight text-white drop-shadow-sm">
                {renderHeroTitle(config.hero.heroTitle)}
              </h1>

              <p className="text-sm sm:text-base leading-relaxed max-w-xl text-slate-200 drop-shadow-2xs">
                {config.hero.heroSubtitle}
              </p>

              {/* Tombol Aksi Publik & Kontrol Media Hero */}
              <div className="flex flex-wrap items-center gap-3.5 pt-2">
                <a
                  href={fixAnchor(config.hero.primaryCtaLink, '#siklus-menu')}
                  className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 transition-all cursor-pointer shadow-lg border border-emerald-500/30"
                >
                  <Utensils className="w-4 h-4 text-emerald-200" />
                  <span>{config.hero.primaryCtaText || 'Lihat Menu MBG'}</span>
                  <ChevronRight className="w-4 h-4 text-emerald-200" />
                </a>

                <a
                  href={fixAnchor(config.hero.secondaryCtaLink, '#alur-operasional')}
                  className="inline-flex items-center gap-2.5 px-5 py-3.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors border bg-white/10 hover:bg-white/20 text-white border-white/25 backdrop-blur-md"
                >
                  <Clock className="w-4 h-4 text-white/90" />
                  <span>{config.hero.secondaryCtaText || 'Jadwal Operasional'}</span>
                  <ChevronRight className="w-4 h-4 text-white/90" />
                </a>
              </div>
            </div>

            {/* Visual Dokumentasi Operasional: Dokumentasi Slide Foto (Auto Slide & Kustomisasi) */}
            <div className="lg:col-span-5">
              <div
                className="rounded-2xl p-3 border bg-slate-900/90 border-slate-700/80"
                onMouseEnter={() => setIsHeroPhotoPaused(true)}
                onMouseLeave={() => setIsHeroPhotoPaused(false)}
              >
                {/* Frame Foto Utama dengan Auto-Slide & Navigasi */}
                <div className="relative overflow-hidden rounded-xl bg-slate-950 aspect-4/3 border border-slate-700/60 shadow-inner group">
                  {currentHeroPhoto ? (
                    <img
                      key={currentHeroPhoto.id || activeHeroPhotoIndex}
                      src={currentHeroPhoto.imageUrl}
                      alt={currentHeroPhoto.title}
                      className="w-full h-full object-cover object-center transition-all duration-700 ease-out group-hover:scale-105"
                    />
                  ) : (
                    <img
                      src={trayImg1}
                      alt="Standar sajian nampan makan bergizi gratis SPPG Jeru"
                      className="w-full h-full object-cover object-center"
                    />
                  )}

                  {/* Gradient Overlay untuk Kontras Tag & Teks */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/35 pointer-events-none" />

                  {/* Badge Kategori & Status di Pojok Kiri Atas */}
                  {currentHeroPhoto?.badge && (
                    <div className="absolute top-3 left-3 bg-black/80 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-white/10 pointer-events-none">
                      {currentHeroPhoto.badge}
                    </div>
                  )}

                  {/* Counter Slide di Pojok Kanan Atas */}
                  {heroPhotoSlides.length > 1 && (
                    <div className="absolute top-3 right-3 bg-black/75 text-white/90 text-[11px] font-mono font-medium px-2 py-0.5 rounded-md border border-white/20 backdrop-blur-xs shadow-xs pointer-events-none">
                      {activeHeroPhotoIndex + 1} / {heroPhotoSlides.length}
                    </div>
                  )}

                  {/* Tombol Navigasi Geser (Chevron Kiri & Kanan) */}
                  {heroPhotoSlides.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentHeroPhotoIndex(prev => (prev - 1 + heroPhotoSlides.length) % heroPhotoSlides.length);
                        }}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-opacity [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-visible:opacity-100 cursor-pointer border border-white/20"
                        aria-label="Foto Sebelumnya"
                        title="Foto Sebelumnya"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentHeroPhotoIndex(prev => (prev + 1) % heroPhotoSlides.length);
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-opacity [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-visible:opacity-100 cursor-pointer border border-white/20"
                        aria-label="Foto Berikutnya"
                        title="Foto Berikutnya"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>

                      {/* Pagination Indicator Dots di Bawah Foto */}
                      <div className="absolute bottom-2.5 left-0 right-0 flex items-center justify-center gap-1.5 z-10 pointer-events-auto">
                        {heroPhotoSlides.map((slide, idx) => (
                          <button
                            key={slide.id || idx}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCurrentHeroPhotoIndex(idx);
                            }}
                            className={`h-1.5 rounded-full transition-all cursor-pointer ${
                              idx === activeHeroPhotoIndex
                                ? 'w-6 bg-emerald-400'
                                : 'w-1.5 bg-white/50 hover:bg-white/80'
                            }`}
                            aria-label={`Lihat slide ${idx + 1}`}
                            title={`Slide ${idx + 1}: ${slide.title}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Deskripsi & Keterangan Slide Foto */}
                <div className="mt-3 p-3.5 rounded-xl border space-y-1 bg-[#091523]/95 border-slate-800/80 text-slate-200">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="font-bold truncate pr-2 text-white">
                      {currentHeroPhoto?.title || 'Nasi, Ayam Kecap, Tempe, Sayur, dan Buah'}
                    </span>
                    {currentHeroPhoto?.targetGrams && (
                      <span className="font-mono text-xs text-emerald-400 font-semibold shrink-0">
                        {currentHeroPhoto.targetGrams}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-300">
                    {currentHeroPhoto?.description || 'Menu ini disajikan sesuai standar gizi dengan porsi yang sesuai untuk anak sekolah.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 3 Pilar Nilai Operasional Hero */}
          <div className="pt-10 lg:pt-14 mt-8 border-t border-white/15">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-0 md:divide-x md:divide-white/15">
              {/* Pilar 1: Penimbangan Bahan */}
              <div className="flex items-center gap-3.5 md:pr-6">
                <div className="w-11 h-11 rounded-xl bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400 shadow-inner">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white">Penimbangan Bahan</h4>
                  <p className="text-xs text-slate-300 mt-0.5">Sesuai kebutuhan menu</p>
                </div>
              </div>

              {/* Pilar 2: Wadah Makanan */}
              <div className="flex items-center gap-3.5 md:px-8">
                <div className="w-11 h-11 rounded-xl bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400 shadow-inner">
                  <Utensils className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white">Wadah Makanan</h4>
                  <p className="text-xs text-slate-300 mt-0.5">Stainless steel food-grade</p>
                </div>
              </div>

              {/* Pilar 3: Pengelolaan Sisa Makanan */}
              <div className="flex items-center gap-3.5 md:pl-8">
                <div className="w-11 h-11 rounded-xl bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400 shadow-inner">
                  <Leaf className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white">Pengelolaan Sisa Makanan</h4>
                  <p className="text-xs text-slate-300 mt-0.5">Lebih ramah lingkungan</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          SEKSI 2: MENU MBG MINGGU INI (#siklus-menu)
          ======================================================== */}
      <section id="siklus-menu" className="relative overflow-hidden py-14 sm:py-20 bg-[#faf8f4] border-b border-[#e5dfd3]">
        {/* Mengisi ruang kosong di samping judul; memudar ke kiri agar tidak mengganggu teks. */}
        <FoodDoodles width={760} height={320} seed={1} className="hidden md:block top-0 right-0 w-3/5 h-80 text-[#133d2c] opacity-[0.14] [mask-image:linear-gradient(to_left,black_45%,transparent)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-7">
            <div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-serif-display text-[#141d18] tracking-tight">
                Menu MBG Minggu Ini
              </h2>
              <p className="text-xs sm:text-sm text-[#55645c] mt-2 max-w-xl leading-relaxed">
                {shortDate(week.start)} - {shortDate(week.end)} {parseIso(week.end).getFullYear()}. Menu harian untuk sekolah penerima di Tumpang Jeru.
              </p>
            </div>

            {publicData !== null && menuDates.length > 0 && (
              <div
                role="tablist"
                aria-label="Pilih hari menu"
                className="inline-flex gap-1.5 overflow-x-auto max-w-full p-1.5 rounded-2xl bg-white border border-[#ded7c8] self-start lg:self-auto"
              >
                {menuDates.map(date => {
                  const isActive = date === activeMenuDate;
                  return (
                    <button
                      key={date}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setSelectedMenuDate(date)}
                      className={`shrink-0 min-w-[96px] min-h-[44px] px-3.5 py-2 rounded-xl text-left transition-colors duration-150 cursor-pointer ${PUBLIC_FOCUS} ${
                        isActive
                          ? 'bg-[#133d2c] text-white'
                          : 'bg-transparent text-[#2a3830] hover:bg-[#f5f1e8]'
                      }`}
                    >
                      <div className="text-xs font-bold leading-tight">{DAY_NAMES[parseIso(date).getDay()]}</div>
                      <div className={`text-[11px] mt-0.5 leading-tight ${isActive ? 'text-emerald-100' : 'text-[#5f6e66]'}`}>
                        {shortDate(date)}{date === todayIso ? ' · hari ini' : ''}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {publicData === null ? (
            <div className="bg-white rounded-2xl border border-[#ded7c8] p-8 text-center text-sm text-[#55645c]">Memuat menu...</div>
          ) : menuDates.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#ded7c8] p-8 text-center">
              <UtensilsCrossed className="w-8 h-8 text-[#9aa79f] mx-auto mb-3" aria-hidden="true" />
              <p className="text-sm font-semibold text-[#141d18]">Menu pekan ini belum diumumkan.</p>
            </div>
          ) : !isActiveDayPosted ? (
            <div className="relative overflow-hidden bg-white rounded-2xl border border-[#ded7c8] p-8 sm:p-12 text-center">
              {/* Bagian tengah dikosongkan supaya kalimatnya tetap bersih. */}
              <FoodDoodles width={1200} height={150} seed={2} className="inset-0 w-full h-full text-[#133d2c] opacity-[0.16] [mask-image:radial-gradient(ellipse_at_center,transparent_30%,black_72%)]" />
              <div className="relative space-y-1.5">
                <p className="text-sm font-semibold text-[#141d18]">
                  Menu {DAY_NAMES[parseIso(activeMenuDate).getDay()]}, {shortDate(activeMenuDate)} belum diunggah.
                </p>
                <p className="text-xs text-[#55645c]">
                  Pilih hari lain di atas untuk melihat menu yang sudah tayang.
                </p>
              </div>
            </div>
          ) : (() => {
            const mt = config.menuToday;
            const nutritionHighlights = [
              { label: 'Energi', value: mt.energySummary?.caloriesAvg?.trim() || mt.portionLarge?.targetCalories?.trim() || '' },
              { label: 'Protein', value: mt.energySummary?.proteinAvg?.trim() || mt.portionLarge?.proteinGrams?.trim() || '' },
              { label: 'Karbohidrat', value: mt.energySummary?.carbsAvg?.trim() || mt.portionLarge?.carbGrams?.trim() || '' },
              { label: 'Lemak', value: mt.energySummary?.fatAvg?.trim() || mt.portionLarge?.fatGrams?.trim() || '' },
            ].filter(item => item.value !== '');
            const smallGram = mt.portionSmall?.totalGramature?.trim() || '';
            const largeGram = mt.portionLarge?.totalGramature?.trim() || '';
            const hasGramature = Boolean(smallGram || largeGram);

            return (
              <div className="bg-white rounded-2xl border border-[#ded7c8] overflow-hidden grid grid-cols-1 lg:grid-cols-12 shadow-xs">
                {postedPhoto && (
                  <figure className="lg:col-span-7 bg-[#103828]">
                    <PostedTray menuToday={mt} photo={postedPhoto} alt={`Foto sajian ${activeMenus[0]?.title}`} />
                  </figure>
                )}

                <div className={`${postedPhoto ? 'lg:col-span-5' : 'lg:col-span-12'} p-5 sm:p-7 lg:p-8 flex flex-col justify-between gap-6`}>
                  <div className="space-y-5">
                    {activeMenus.map((menu, menuIdx) => {
                      const dishes = splitDishes(menu.title);
                      const menuDesc = menu.description?.trim() || (menuIdx === 0 ? mt.description?.trim() : '');
                      const b3Text = menu.specialDietB3?.trim() || (menuIdx === 0 ? mt.menuB3?.trim() : '');

                      return (
                        <div key={menu.id} className={menuIdx > 0 ? 'pt-5 border-t border-[#ece6d9] space-y-4' : 'space-y-4'}>
                          <div>
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-semibold text-[#55645c]">
                                {DAY_NAMES[parseIso(menu.date).getDay()]}, {shortDate(menu.date)}
                                {activeMenus.length > 1 && ` · ${menu.mealSession}`}
                              </span>
                              {menu.date === todayIso && (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] font-semibold">
                                  Hari ini
                                </span>
                              )}
                            </div>

                            <h3 className="text-xl sm:text-2xl font-bold font-serif-display text-[#141d18] mt-2 leading-snug">
                              {formatMenuHeadline(menu.title)}
                            </h3>

                            {menuDesc && (
                              <p className="text-xs sm:text-sm text-[#4c5b53] mt-2 leading-relaxed">
                                {menuDesc}
                              </p>
                            )}
                          </div>

                          {/* Daftar isi ompreng */}
                          {dishes.length > 0 && (
                            <div className={postedPhoto ? 'hidden xl:block' : 'block'}>
                              <div className="text-[11px] font-semibold text-[#5f6e66] mb-2">
                                Isi ompreng
                              </div>
                              <ol className="grid grid-cols-1 sm:grid-cols-2 gap-2" aria-label="Komponen menu">
                                {dishes.map((dish, idx) => (
                                  <li
                                    key={dish}
                                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#faf8f4] border border-[#ebe4d6] text-xs font-semibold text-[#1c2821]"
                                  >
                                    <span className="w-5 h-5 rounded-md bg-[#e8f2ec] text-[#133d2c] font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                                      {idx + 1}
                                    </span>
                                    <span className="leading-snug">{formatMenuHeadline(dish)}</span>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          )}

                          {b3Text && (
                            <div className="rounded-xl bg-[#f4f7f2] border border-[#d6e4d9] px-3.5 py-2.5 text-xs text-[#25382e] leading-relaxed">
                              <span className="font-semibold text-[#133d2c]">Menu 3B (Balita &amp; Ibu Hamil/Menyusui): </span>
                              {formatMenuHeadline(b3Text)}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Ringkasan gizi nyata dari konfigurasi menu hari ini */}
                    {nutritionHighlights.length > 0 && (
                      <div className="pt-4 border-t border-[#ece6d9] space-y-2.5">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-[11px] font-semibold text-[#5f6e66]">Rata-rata gizi per porsi</span>
                          {hasGramature && (
                            <span className="text-[11px] text-[#55645c] font-mono tabular-nums">
                              {[smallGram && `Kecil ${smallGram}`, largeGram && `Besar ${largeGram}`].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </div>
                        <dl className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2">
                          {nutritionHighlights.map(stat => (
                            <div key={stat.label} className="rounded-xl bg-[#faf8f4] border border-[#ebe4d6] px-3 py-2">
                              <dt className="text-[11px] text-[#5f6e66]">{stat.label}</dt>
                              <dd className="text-xs sm:text-sm font-bold font-mono text-[#133d2c] tabular-nums mt-0.5">
                                {stat.value}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    )}
                  </div>

                  {/* Tautan ke halaman detail menu & gizi */}
                  <div className="pt-4 border-t border-[#ece6d9] flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[11px] text-[#5f6e66]">
                      Takaran porsi kecil, besar, dan info alergen
                    </span>
                    <a
                      href="/menu-mbg-hari-ini"
                      className={`inline-flex items-center justify-center px-4 min-h-[44px] rounded-xl bg-[#133d2c] hover:bg-[#0c2b1e] text-white text-xs font-semibold transition-colors duration-150 ${PUBLIC_FOCUS}`}
                    >
                      Buka rincian gizi
                    </a>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* ========================================================
          SEKSI 3: BAHAN MENU (#komponen-menu)
          ======================================================== */}
      <section id="komponen-menu" className="relative overflow-hidden py-14 sm:py-20 bg-white border-b border-[#e5dfd3]">
        <FoodDoodles
          width={680}
          height={280}
          seed={4}
          className="top-0 right-0 w-3/4 sm:w-1/2 h-64 sm:h-72 text-[#133d2c] opacity-[0.11] [mask-image:linear-gradient(to_left,black_38%,transparent)]"
        />
        <FoodDoodles
          width={560}
          height={240}
          seed={9}
          className="hidden md:block bottom-0 left-0 w-2/5 h-60 text-[#133d2c] opacity-[0.08] [mask-image:linear-gradient(to_right,black_30%,transparent)]"
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-serif-display text-[#141d18] tracking-tight">
                {isSampleComponents ? 'Bahan Makanan MBG' : 'Bahan Menu Hari Ini'}
              </h2>
              <p className="text-xs sm:text-sm text-[#55645c] mt-2 max-w-xl leading-relaxed">
                {isSampleComponents
                  ? 'Contoh bahan yang dipakai di menu MBG dan manfaatnya.'
                  : `${componentCards.length} bahan pada menu ${config.menuToday.dateText || 'hari ini'} beserta takaran porsinya.`}
              </p>
            </div>

            {ingredientCategories.length > 1 && (
              <div
                role="tablist"
                aria-label="Filter kategori bahan"
                className="flex flex-wrap gap-1.5 self-start lg:self-auto"
              >
                {(['Semua', ...ingredientCategories] as const).map(cat => {
                  const isActive = selectedIngredientCat === cat;
                  const tone = cat === 'Semua' ? null : getIngredientTone(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveIngredientCategory(cat)}
                      className={`inline-flex items-center gap-1.5 px-3 min-h-[44px] sm:min-h-[36px] rounded-xl text-xs font-semibold border transition-colors duration-150 cursor-pointer ${PUBLIC_FOCUS} ${
                        isActive
                          ? 'bg-[#133d2c] text-white border-[#133d2c]'
                          : 'bg-[#faf8f4] text-[#2c3a32] border-[#e3dccf] hover:bg-[#f2ede2]'
                      }`}
                    >
                      {tone && (
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-emerald-300' : tone.dot}`}
                          aria-hidden="true"
                        />
                      )}
                      <span>{cat}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {(() => {
            const count = visibleComponentCards.length;
            const remLg = count % 3;
            const ctaLgSpan = remLg === 2 ? 'lg:col-span-1' : remLg === 1 ? 'lg:col-span-2' : 'lg:col-span-3';
            const ctaSmSpan = count % 2 === 1 ? 'sm:col-span-1' : 'sm:col-span-2';
            const isFullWidthCta = remLg === 0;

            return (
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {visibleComponentCards.map((item, idx) => {
                  const tone = getIngredientTone(item.category);
                  const hasPortions = Boolean(item.portionSmall || item.portionLarge);

                  return (
                    <li
                      key={item.id}
                      className="group rounded-2xl border border-[#e5dfd3] bg-white overflow-hidden flex flex-col transition-colors duration-150 hover:border-[#c9bfa9]"
                    >
                      {/* Panggung piring atas dengan warna kelompok pangan Isi Piringku */}
                      <div className={`relative px-5 pt-4 pb-5 ${tone.bandBg} border-b border-[#ece6d9]`}>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold ${tone.badgeBg} ${tone.badgeText}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} aria-hidden="true" />
                            {item.category}
                          </span>
                          <span className="font-mono text-[11px] font-semibold text-[#5f6e66] tabular-nums">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                        </div>

                        <div className="flex justify-center">
                          <div className={`relative p-2 rounded-full border border-dashed ${tone.ringColor} bg-white/70`}>
                            <FoodImage
                              name={item.title}
                              category={item.category}
                              imageUrl={item.image}
                              alt=""
                              tint={tone.plateTint}
                              className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border border-white shadow-xs"
                              illustrationClassName="h-[68%] w-auto"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Rincian nama, manfaat, sorotan gizi & takaran porsi */}
                      <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-bold font-serif-display text-[#141d18] leading-snug">
                            {formatMenuHeadline(item.title)}
                          </h3>
                          {item.description && (
                            <p className="text-xs sm:text-[13px] text-[#4e5d55] mt-1.5 leading-relaxed">
                              {item.description}
                            </p>
                          )}
                          {item.nutritionTags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-3">
                              {item.nutritionTags.map(tag => (
                                <span
                                  key={tag}
                                  className="px-2 py-0.5 rounded-md bg-[#faf8f4] border border-[#e7e0d3] text-[11px] font-medium text-[#2d3b33]"
                                >
                                  {formatMenuHeadline(tag)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {hasPortions && (
                          <div className="pt-3 border-t border-[#efe9dd] flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-[#55645c]">
                            <span className="font-medium">Takaran saji</span>
                            <span className="font-mono font-semibold text-[#141d18] tabular-nums">
                              {[item.portionSmall && `Kecil ${item.portionSmall}`, item.portionLarge && `Besar ${item.portionLarge}`]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}

                {/* Kartu penghubung editorial ke halaman gizi lengkap (otomatis mengisi sisa kolom grid) */}
                <li
                  className={`relative overflow-hidden rounded-2xl bg-[linear-gradient(155deg,#174c36_0%,#103828_58%,#0a261b_100%)] text-white p-6 flex ${
                    isFullWidthCta
                      ? 'flex-col sm:flex-row sm:items-center justify-between gap-4'
                      : 'flex-col justify-between gap-5'
                  } ${ctaSmSpan} ${ctaLgSpan}`}
                >
                  <TrayCornerSprig flip className="-bottom-8 -right-8 w-40 h-40 opacity-90" />
                  <div className="pointer-events-none absolute inset-2.5 rounded-xl border border-white/10" aria-hidden="true" />
                  <div className="relative z-10 max-w-lg">
                    <h3 className="text-xl font-bold font-serif-display text-white leading-snug">
                      Cek alergen dan takaran porsi anak
                    </h3>
                    <p className="text-xs text-emerald-100/85 mt-2 leading-relaxed">
                      Halaman menu hari ini memuat takaran porsi kecil dan besar, peringatan alergen, serta panduan Isi Piringku untuk siswa.
                    </p>
                  </div>
                  <div className="relative z-10 shrink-0">
                    <a
                      href="/menu-mbg-hari-ini"
                      className={`inline-flex items-center justify-center px-4 min-h-[44px] rounded-xl bg-white hover:bg-[#f4f1ea] text-[#103828] text-xs font-bold transition-colors duration-150 ${PUBLIC_FOCUS}`}
                    >
                      Lihat menu hari ini
                    </a>
                  </div>
                </li>
              </ul>
            );
          })()}
        </div>
      </section>

      {/* ========================================================
          SEKSI 4: ALUR OPERASIONAL (#alur-operasional)
          ======================================================== */}
      <section id="alur-operasional" className="relative overflow-hidden py-14 sm:py-20 bg-[#faf8f4] border-b border-[#e5dfd3]">
        <FoodDoodles
          width={760}
          height={280}
          seed={5}
          className="top-0 right-0 w-3/4 md:w-3/5 h-64 md:h-72 text-[#133d2c] opacity-[0.13] [mask-image:linear-gradient(to_left,black_42%,transparent)]"
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#133d2c] text-white text-xs font-semibold mb-3 shadow-2xs">
              <span>Alur Operasional</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-serif-display text-[#141d18] tracking-tight">
              Tahapan Persiapan dan Penyaluran MBG
            </h2>
            <p className="text-xs sm:text-sm text-[#55645c] mt-2 max-w-2xl leading-relaxed">
              Proses pelaksanaan MBG dari penerimaan bahan pangan hingga penyaluran ke sekolah.
            </p>
          </div>

          {/* 4 Kartu Berurutan dengan Panah Pemisah */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 relative">
            {OPERATIONAL_STEPS.map((step, idx) => (
              <div
                key={step.step}
                className="bg-white rounded-3xl p-4 sm:p-5 border border-[#ded7c8] shadow-xs flex flex-col justify-between relative group hover:border-[#133d2c] transition-all"
              >
                <div>
                  {/* Lingkaran Angka Tahapan Hijau Gelap */}
                  <div className="w-8 h-8 rounded-full bg-[#133d2c] text-white text-xs font-bold flex items-center justify-center mb-3.5 shadow-2xs">
                    {step.step}
                  </div>

                  {/* Foto Tahapan */}
                  <div className="aspect-4/3 rounded-2xl overflow-hidden bg-slate-900 border border-[#ded7c8] mb-4">
                    <img
                      src={step.image}
                      alt={step.title}
                      className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                    />
                  </div>

                  <h3 className="text-sm font-bold text-[#141d18] leading-snug">
                    {step.title}
                  </h3>
                  <p className="text-xs text-[#55645c] mt-1.5 leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Panah Pemisah Antar Kartu pada Desktop */}
                {idx < OPERATIONAL_STEPS.length - 1 && (
                  <div className="hidden lg:flex absolute -right-3.5 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white border border-[#ded7c8] items-center justify-center text-[#707e76] shadow-2xs">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================
          SEKSI 5: REKAP DOKUMENTASI KEGIATAN (#dokumentasi-kegiatan)
          ======================================================== */}
      <DocumentationRecapSection recap={config.documentationRecap} />

      {/* ========================================================
          SEKSI 6: SEKOLAH PENERIMA (#sekolah-penerima)
          ======================================================== */}
      <section id="sekolah-penerima" className="relative overflow-hidden py-14 sm:py-20 bg-[#faf8f4] border-b border-[#e5dfd3]">
        <FoodDoodles
          width={760}
          height={280}
          seed={6}
          className="top-0 right-0 w-3/4 md:w-3/5 h-64 md:h-72 text-[#133d2c] opacity-[0.13] [mask-image:linear-gradient(to_left,black_40%,transparent)]"
        />
        <FoodDoodles
          width={560}
          height={220}
          seed={11}
          className="hidden md:block bottom-0 left-0 w-2/5 h-56 text-[#133d2c] opacity-[0.1] [mask-image:linear-gradient(to_right,black_30%,transparent)]"
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#133d2c] text-white text-xs font-semibold mb-3 shadow-2xs">
                <span>Sekolah Penerima</span>
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-serif-display text-[#141d18] tracking-tight">
                Daftar Sekolah Penerima MBG
              </h2>
              <p className="text-xs sm:text-sm text-[#55645c] mt-2 max-w-2xl leading-relaxed">
                Sekolah yang menerima layanan MBG dari SPPG MLG Tumpang Jeru.
              </p>
            </div>

            {/* Badge Total 14 Sekolah */}
            <div className="shrink-0">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#f6f2e8] border border-[#ded7c8] text-xs font-semibold text-[#141d18]">
                <span>Total {schools.length} sekolah</span>
              </span>
            </div>
          </div>

          {/* Grid Kartu Sekolah */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(showAllSchools ? schools : schools.slice(0, 8)).map((sch) => (
              <div
                key={sch.name}
                className="p-4 rounded-2xl bg-white border border-[#ded7c8] flex items-center gap-3.5 hover:border-[#133d2c] transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-[#faf8f4] border border-[#ded7c8] flex items-center justify-center shrink-0 text-[#133d2c] shadow-2xs">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#141d18] truncate">
                    {sch.name}
                  </div>
                  <div className="text-[11px] text-[#707e76] truncate mt-0.5">
                    {sch.location}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Tombol Lihat Seluruh Sekolah */}
          {schools.length > 8 && (
            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={() => setShowAllSchools(!showAllSchools)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-[#ded7c8] text-xs font-bold text-[#133d2c] hover:bg-[#f0ece1] transition-colors cursor-pointer"
              >
                <span>{showAllSchools ? 'Tampilkan lebih sedikit' : `Lihat seluruh ${schools.length} sekolah penerima`}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAllSchools ? 'rotate-180' : ''}`} />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ========================================================
          SEKSI 7: PANDUAN ORANG TUA DAN SEKOLAH (#panduan-penerima)
          ======================================================== */}
      <section id="panduan-penerima" className="relative overflow-hidden py-14 sm:py-20 bg-white border-b border-[#e5dfd3]">
        <FoodDoodles
          width={420}
          height={220}
          seed={12}
          className="lg:hidden top-0 right-0 w-3/5 h-48 text-[#133d2c] opacity-[0.11] [mask-image:linear-gradient(to_left,black_35%,transparent)]"
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          <div className="relative overflow-hidden lg:col-span-5">
            {/* Hanya di layar lebar: di layar sempit kolom ini setinggi judulnya, tidak ada ruang kosong. */}
            <FoodDoodles width={500} height={380} seed={4} className="hidden lg:block left-0 right-0 top-36 bottom-0 w-full h-[calc(100%-9rem)] text-[#133d2c] opacity-[0.16] [mask-image:linear-gradient(to_bottom,transparent,black_30%,black_70%,transparent)]" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#133d2c] text-white text-xs font-semibold mb-3 shadow-2xs">
                <span>Panduan Penerima</span>
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-serif-display text-[#141d18] tracking-tight">
                Saat Makanan MBG Tiba
              </h2>
              <p className="text-xs sm:text-sm text-[#55645c] mt-2 max-w-md leading-relaxed">
                Yang perlu diperhatikan orang tua, guru, dan PIC sekolah.
              </p>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-5">
            {/* Dua aturan wajib dipisah dari bantuan di bawahnya, karena aturan ini berlaku untuk setiap ompreng. */}
            <ul className="bg-[#faf8f4] rounded-3xl border border-[#ded7c8] px-5 sm:px-6 divide-y divide-[#e5dfd3]">
              {GUIDE_RULES.map(({ Icon, title, text }) => (
                <li key={title} className="flex items-start gap-3.5 py-5">
                  <div className="w-10 h-10 rounded-xl bg-white border border-[#ded7c8] flex items-center justify-center shrink-0 text-[#133d2c]">
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold font-serif-display text-[#141d18] leading-snug">{title}</h3>
                    <p className="text-xs sm:text-sm text-[#55645c] mt-1 leading-relaxed">{text}</p>
                  </div>
                </li>
              ))}
            </ul>

            <ul className="px-5 sm:px-6 divide-y divide-[#e5dfd3]">
              {GUIDE_HELP.map(({ Icon, title, text, links }) => (
                <li key={title} className="flex items-start gap-3.5 py-4">
                  <div className="w-10 h-10 rounded-xl bg-[#faf8f4] border border-[#ded7c8] flex items-center justify-center shrink-0 text-[#133d2c]">
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-[#141d18]">{title}</h3>
                    <p className="text-xs sm:text-sm text-[#55645c] mt-1 leading-relaxed">{text}</p>
                    <div className="flex flex-wrap gap-x-5">
                      {links.map(link => (
                        <a
                          key={link.label}
                          href={link.href}
                          className={`inline-flex items-center min-h-[44px] rounded-sm text-xs font-bold text-[#133d2c] underline underline-offset-2 hover:text-[#1c553d] ${PUBLIC_FOCUS}`}
                        >
                          {link.label}
                        </a>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ========================================================
          SEKSI 8: INFORMASI DAN KONTAK SPPG (#kontak-sppg)
          ======================================================== */}
      <section id="kontak-sppg" className="relative overflow-hidden py-14 sm:py-20 bg-[#faf8f4]">
        <FoodDoodles
          width={760}
          height={260}
          seed={10}
          className="top-0 left-0 w-3/5 h-60 text-[#133d2c] opacity-[0.1] [mask-image:linear-gradient(to_right,black_35%,transparent)]"
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden bg-[#0c2419] rounded-3xl p-6 sm:p-10 lg:p-12 text-white border border-[#1b4331] shadow-lg">
            <FoodDoodles
              width={960}
              height={460}
              seed={8}
              className="inset-0 w-full h-full text-emerald-100 opacity-[0.08] [mask-image:radial-gradient(ellipse_at_center,transparent_28%,black_88%)]"
            />
            <TrayCornerSprig className="-top-8 -left-8 w-40 h-40 opacity-65" />
            <TrayCornerSprig flip className="-bottom-8 -right-8 w-44 h-44 opacity-70" />
            {/* Bagian Atas: Kiri Teks + CTA, Kanan Foto Bangunan SPPG */}
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              <div className="lg:col-span-7 space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#153e2c] text-emerald-200 border border-emerald-700/50 text-xs font-semibold">
                  <span>Informasi dan Kontak</span>
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-serif-display text-white tracking-tight">
                  Informasi dan Kontak SPPG
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
                  Untuk informasi menu, kegiatan operasional, atau penyaluran ke sekolah, silakan hubungi SPPG MLG Tumpang Jeru melalui kontak resmi yang tersedia.
                </p>

                <div className="pt-2">
                  <a
                    href={`mailto:${SPPG_EMAIL}`}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-[#0c2419] font-bold text-xs sm:text-sm hover:bg-[#f0ece1] transition-all shadow-md cursor-pointer"
                  >
                    <span>Hubungi SPPG</span>
                    <ArrowRight className="w-4 h-4 text-[#0c2419]" />
                  </a>
                </div>
              </div>

              {/* Foto Nyata Bangunan SPPG Tumpang Jeru */}
              <div className="lg:col-span-5">
                <div className="aspect-16/10 rounded-2xl overflow-hidden border border-white/20 shadow-md">
                  <img
                    src={sppgBuildingImg}
                    alt="Gedung SPPG Tumpang Jeru"
                    className="w-full h-full object-cover object-center"
                  />
                </div>
              </div>
            </div>

            {/* Strip Informasi Bawah: Identitas, Alamat, Jam Operasional, Kontak */}
            <div className="relative z-10 mt-10 pt-8 border-t border-white/15 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-xs text-slate-300">
              {/* Kolom 1: Logo & Nama SPPG */}
              <div className="flex items-start gap-3">
                <img
                  src={logoSppgImg}
                  alt="Logo SPPG"
                  className="w-10 h-10 object-contain rounded-lg p-1 bg-white/10 border border-white/20 shrink-0"
                />
                <div>
                  <div className="font-bold text-white text-sm">SPPG MLG TUMPANG JERU</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Desa Jeru, Kec. Tumpang, Kab. Malang</div>
                </div>
              </div>

              {/* Kolom 2: Alamat */}
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-white">Alamat</div>
                  <div className="text-[11px] text-slate-300 mt-0.5">
                    {SPPG_ADDRESS}
                  </div>
                </div>
              </div>

              {/* Kolom 3: Jam Operasional */}
              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-white">Jam Operasional</div>
                  <div className="text-[11px] text-slate-300 mt-0.5">Senin – Sabtu</div>
                  <div className="text-[11px] text-emerald-300 font-mono">04.00 – 14.00 WIB</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">(Penyaluran pagi)</div>
                </div>
              </div>

              {/* Kolom 4: Kontak */}
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-white">Kontak</div>
                  <a href={`tel:${SPPG_PHONE.replace(/[^0-9+]/g, '')}`} className="block text-[11px] text-slate-300 mt-0.5 font-mono hover:text-white">{SPPG_PHONE}</a>
                  <a href={`mailto:${SPPG_EMAIL}`} className="block text-[11px] text-slate-300 mt-0.5 hover:text-white break-all">{SPPG_EMAIL}</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Minimalis */}
      <footer className="bg-[#081710] text-[#708076] text-xs py-8 border-t border-[#12281d]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">SPPG MLG TUMPANG JERU</span>
            <span>•</span>
            <span>Badan Gizi Nasional RI</span>
          </div>
          <div>
            © 2026 Seluruh hak cipta dilindungi undang-undang.
          </div>
        </div>
      </footer>
    </div>
  );
};
