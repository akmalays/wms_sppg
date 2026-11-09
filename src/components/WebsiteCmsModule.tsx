import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Select } from './common/Select';
import {
  WebsiteConfig,
  HeroVideoItem,
  HeroDocumentationSlide,
  IngredientNutritionInfo,
  WebsiteMenuTodayConfig,
  PortionTierConfig,
  DEFAULT_WEBSITE_CONFIG,
  INGREDIENT_CATEGORIES,
  getWebsiteConfig,
  saveWebsiteConfigToCloud,
  fetchWebsiteConfigFromCloud,
  uploadCmsMedia,
  VIDEO_PRESETS,
  IMAGE_PRESETS,
  EMPTY_PORTION_TIER,
  hasPortionNutrition
} from '../db/websiteConfigStorage';
import QRCode from 'qrcode';
import { warehouseDb } from '../db/storage';
import { localDateIso } from '../utils/localDate';
import type { MenuOrder, MenuPosterMenu } from '../types/warehouse';
import { portionFromPoster } from '../utils/menuTrayPublish';
import { estimateIngredientPortions, withEstimatedPortions } from '../utils/portionEstimate';
import { FormDialog } from './common/FormDialog';
import { ImageBankDialog } from './common/ImageBankDialog';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { MenuTodayKidsEditor } from './MenuTodayKidsEditor';
import { compressImageToWebP } from '../utils/imageCompressor';
import { requestMenuAiDraft, MenuAiDraft } from '../utils/menuAiDraft';
import { cutoutTrayPhoto } from '../utils/trayCutout';
import { TrayLabelEditor } from './menuPublic/TrayLabelEditor';
import { menuDishes } from './menuPublic/TrayStage';
import { detectAllergens } from '../utils/allergens';
import { AiIngredientTidyDialog } from './ai/AiIngredientTidyDialog';
import { requestIngredientTidy, type AiIngredientSuggestion } from '../utils/aiAssist';
import {
  Video,
  Image as ImageIcon,
  ListChecks,
  Sliders,
  Play,
  Plus,
  Trash2,
  Edit2,
  Save,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Upload,
  Check,
  X,
  Download,
  RotateCcw,
  Printer,
  Copy,
  PenLine,
  Images
} from 'lucide-react';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1';
const BTN_PRIMARY = `inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors cursor-pointer min-h-[44px] sm:min-h-[36px] ${FOCUS}`;
const BTN_SECONDARY = `inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-300 transition-colors cursor-pointer min-h-[44px] sm:min-h-[36px] ${FOCUS}`;

const ICON_BTN = `inline-flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-[32px] sm:min-h-[32px] rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${FOCUS}`;

const FIELD = `w-full px-3 min-h-[44px] sm:min-h-[36px] rounded-lg border border-slate-300 bg-white text-xs text-slate-800 ${FOCUS}`;
const FIELD_LABEL = 'block text-xs font-semibold text-slate-700 mb-1';

const AllergenPreview: React.FC<{ menuToday: WebsiteMenuTodayConfig }> = ({ menuToday }) => {
  const { regular, b3 } = menuDishes(menuToday);
  const regularFound = detectAllergens([...regular, ...menuToday.ingredients.map(i => i.name)]);
  const b3Found = b3.length > 0 ? detectAllergens(b3) : null;
  const show = (found: string[]) => (found.length > 0 ? found.join(', ') : 'tidak ada yang terdeteksi, baris alergen tidak ditampilkan');
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700">
      <p>
        <span className="font-semibold text-slate-800">Alergen di halaman publik: </span>
        {show(regularFound)}
      </p>
      {b3Found && (
        <p className="mt-0.5">
          <span className="font-semibold text-slate-800">Menu 3B: </span>
          {show(b3Found)}
        </p>
      )}
      <p className="mt-1 text-[11px] text-slate-600">
        Dibaca otomatis dari nama menu dan bahan. Tulis nama bahan dengan jelas, mis. "bumbu kacang" atau "saus mayo", supaya ikut terbaca.
      </p>
    </div>
  );
};

type EnergyKey = 'caloriesAvg' | 'proteinAvg' | 'carbsAvg' | 'fatAvg' | 'fiberAvg';
const ENERGY_FIELDS: { key: EnergyKey; label: string }[] = [
  { key: 'caloriesAvg', label: 'Kalori' },
  { key: 'proteinAvg', label: 'Protein' },
  { key: 'carbsAvg', label: 'Karbohidrat' },
  { key: 'fatAvg', label: 'Lemak' },
  { key: 'fiberAvg', label: 'Serat' },
];

const PORTION_FIELDS: { key: keyof PortionTierConfig; label: string }[] = [
  { key: 'tierName', label: 'Untuk' },
  { key: 'totalGramature', label: 'Total gramatur' },
  { key: 'targetCalories', label: 'Target kalori' },
  { key: 'proteinGrams', label: 'Protein' },
  { key: 'carbGrams', label: 'Karbohidrat' },
  { key: 'fatGrams', label: 'Lemak' },
  { key: 'fiberGrams', label: 'Serat' },
  { key: 'description', label: 'Alasan porsi berbeda' },
];

type ToastTone = 'success' | 'warning' | 'error';

const SESSION_ORDER: Record<MenuOrder['mealSession'], number> = { Siang: 0, Pagi: 1, Snack: 2 };

// Format yang dibaca halaman publik untuk mendeteksi menu kedaluwarsa: "Rabu, 14 Oktober 2026".
const formatMenuDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const normalizeName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

// Draf per tab browser, supaya pindah menu di aplikasi tidak menghapus perubahan yang belum disimpan.
const DRAFT_KEY = 'sppg_website_cms_draft_v1';

const readDraft = (): WebsiteConfig | null => {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as WebsiteConfig) : null;
  } catch {
    return null;
  }
};

const CollapsibleCard: React.FC<{
  title: string;
  summary: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, summary, defaultOpen, children }) => (
  <details open={defaultOpen} className="group bg-white rounded-xl border border-slate-200">
    <summary className={`list-none [&::-webkit-details-marker]:hidden flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 min-h-[44px] cursor-pointer select-none rounded-xl hover:bg-slate-50 ${FOCUS}`}>
      <div className="min-w-0">
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        <p className="text-xs text-slate-600 mt-0.5">{summary}</p>
      </div>
      <ChevronDown className="w-4 h-4 text-slate-500 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
    </summary>
    <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-4 space-y-5 border-t border-slate-200">{children}</div>
  </details>
);

export const WebsiteCmsModule: React.FC = () => {
  const [config, setConfig] = useState<WebsiteConfig>(() => readDraft() ?? getWebsiteConfig());
  const [activeTab, setActiveTab] = useState<'hero' | 'menu_today'>('menu_today');
  const toast = useToast();
  const askConfirm = useConfirm();

  // Snapshot terakhir yang sudah disimpan, untuk mendeteksi perubahan yang belum disimpan.
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(getWebsiteConfig()));
  const isDirty = useMemo(() => JSON.stringify(config) !== savedJson, [config, savedJson]);
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  const [isCloudSaving, setIsCloudSaving] = useState(false);

  // State untuk Multi-Video Hero Playlist & Modal
  const [editingHeroVideo, setEditingHeroVideo] = useState<HeroVideoItem | null>(null);
  const [isHeroVideoModalOpen, setIsHeroVideoModalOpen] = useState(false);
  const [isUploadingHeroVideo, setIsUploadingHeroVideo] = useState(false);
  const newHeroVideoFileRef = useRef<HTMLInputElement>(null);
  const editingHeroVideoFileRef = useRef<HTMLInputElement>(null);

  // State untuk Dokumentasi Slide Foto Hero (Kotak Kanan) & Modal
  const [editingHeroSlide, setEditingHeroSlide] = useState<HeroDocumentationSlide | null>(null);
  const [isHeroSlideModalOpen, setIsHeroSlideModalOpen] = useState(false);
  const [heroSlideImagePreview, setHeroSlideImagePreview] = useState<string>('');
  const [isUploadingHeroSlideImg, setIsUploadingHeroSlideImg] = useState(false);
  const heroSlideFileRef = useRef<HTMLInputElement>(null);


  // State untuk Menu Hari Ini & QR Code
  const [editingIngredient, setEditingIngredient] = useState<IngredientNutritionInfo | null>(null);
  const [isIngredientModalOpen, setIsIngredientModalOpen] = useState(false);
  const [ingredientImagePreview, setIngredientImagePreview] = useState<string>('');
  const [isUploadingIngredientImg, setIsUploadingIngredientImg] = useState(false);
  const ingredientFileRef = useRef<HTMLInputElement>(null);

  const [isUploadingTodayMenuPhoto, setIsUploadingTodayMenuPhoto] = useState(false);
  const todayMenuPhotoFileRef = useRef<HTMLInputElement>(null);
  const [isUploadingB3Photo, setIsUploadingB3Photo] = useState(false);
  const b3PhotoFileRef = useRef<HTMLInputElement>(null);

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copiedQrLink, setCopiedQrLink] = useState(false);
  const [isPrintStickerModalOpen, setIsPrintStickerModalOpen] = useState(false);

  // Ambil data terbaru dari cloud saat modul pertama kali dibuka
  useEffect(() => {
    let isMounted = true;
    fetchWebsiteConfigFromCloud().then(res => {
      if (!isMounted) return;
      // Jangan timpa perubahan yang sudah mulai diketik sebelum data cloud tiba.
      if (res.fromCloud) {
        setSavedJson(JSON.stringify(res.config));
        if (!isDirtyRef.current) setConfig(res.config);
      }
    });
    return () => { isMounted = false; };
  }, []);

  // Generate QR Code data URL untuk halaman publik menu hari ini
  useEffect(() => {
    const targetUrl = `${window.location.origin}/menu-mbg-hari-ini`;
    QRCode.toDataURL(targetUrl, {
      width: 360,
      margin: 2,
      color: {
        dark: '#064e3b',
        light: '#ffffff'
      }
    }).then(url => {
      setQrCodeDataUrl(url);
    }).catch(err => {
      console.error('Failed to generate QR Code data URL', err);
    });
  }, []);

  useEffect(() => {
    try {
      if (isDirty) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(config));
      else sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // Kuota penuh atau storage diblokir: draf tidak tersimpan, peringatan beforeunload tetap jalan.
    }
  }, [config, isDirty]);

  useEffect(() => {
    if (readDraft()) showNotification('Perubahan yang belum disimpan dari sesi sebelumnya dipulihkan.', 'warning');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);


  const anyModalOpen = isHeroVideoModalOpen || isHeroSlideModalOpen || isIngredientModalOpen || isPrintStickerModalOpen;
  useEffect(() => {
    if (!anyModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setIsHeroVideoModalOpen(false);
      setIsHeroSlideModalOpen(false);
      setIsIngredientModalOpen(false);
      setIsPrintStickerModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [anyModalOpen]);

  const showNotification = (text: string, tone: ToastTone = 'success') => {
    if (tone === 'success') toast.success(text);
    else if (tone === 'warning') toast.warning(text, undefined, 7000);
    else toast.error(text, undefined, 7000);
  };
  const showError = (text: string) => showNotification(text, 'error');

  const handleSaveAll = async () => {
    setIsCloudSaving(true);
    try {
      const res = await saveWebsiteConfigToCloud(config);
      // Sinkron cloud yang gagal tetap dihitung "belum disimpan" agar tombol Simpan bisa dicoba lagi.
      if (!res.cloudFailed) setSavedJson(JSON.stringify(config));
      if (res.isCloudSynced) {
        showNotification('Tersimpan. Website publik sudah menampilkan perubahan ini.');
      } else {
        showNotification(`${res.message} Pengunjung lain belum melihat perubahan ini.`, 'warning');
      }
    } catch (err) {
      // Biasanya kuota penyimpanan browser penuh karena media yang tidak terunggah ke cloud.
      const detail = err instanceof Error ? err.message : '';
      showError(`Gagal menyimpan${detail ? `: ${detail}` : ''}. Perubahan masih ada di halaman ini, coba lagi.`);
    } finally {
      setIsCloudSaving(false);
    }
  };

  const handleDiscardChanges = async () => {
    if (!(await askConfirm({
      title: 'Buang perubahan?',
      message: 'Semua perubahan yang belum disimpan akan hilang.',
      confirmText: 'Buang perubahan',
      variant: 'danger',
    }))) return;
    setConfig(JSON.parse(savedJson) as WebsiteConfig);
    showNotification('Perubahan dibatalkan.');
  };

  // Video yang gagal masuk cloud akan jadi data URL puluhan MB dan memenuhi kuota browser.
  const rejectLocalVideo = (result: { isCloudStorage: boolean; warning?: string }) => {
    if (result.isCloudStorage) return false;
    showError(`Video tidak bisa diunggah ke cloud${result.warning ? ` (${result.warning})` : ''}. Coba lagi, atau pakai tautan URL video.`);
    return true;
  };

  const notifyImageUpload = (result: { isCloudStorage: boolean; warning?: string; finalSizeKb: number }, label: string) => {
    if (result.isCloudStorage) {
      showNotification(`${label} diunggah (${result.finalSizeKb} KB).`);
    } else {
      showNotification(result.warning || `${label} hanya tersimpan di browser ini.`, 'warning');
    }
  };

  // Hero Video Playlist CRUD Handlers
  const handleOpenAddHeroVideo = () => {
    const newVid: HeroVideoItem = {
      id: `vid-${Date.now()}`,
      title: `Video #${(config.hero.videos?.length || 0) + 1} - Dokumentasi Unit`,
      url: VIDEO_PRESETS[0].url,
      poster: VIDEO_PRESETS[0].poster
    };
    setEditingHeroVideo(newVid);
    setIsHeroVideoModalOpen(true);
  };

  const handleOpenEditHeroVideo = (vid: HeroVideoItem) => {
    setEditingHeroVideo({ ...vid });
    setIsHeroVideoModalOpen(true);
  };

  const handleSaveHeroVideo = () => {
    if (!editingHeroVideo) return;
    if (!editingHeroVideo.url.trim()) {
      showError('Tautan/file video wajib diisi.');
      return;
    }

    setConfig(prev => {
      const curVideos = prev.hero.videos || [];
      const exists = curVideos.some(v => v.id === editingHeroVideo.id);
      const nextVideos = exists
        ? curVideos.map(v => v.id === editingHeroVideo.id ? editingHeroVideo : v)
        : [...curVideos, editingHeroVideo];

      return {
        ...prev,
        hero: {
          ...prev.hero,
          videos: nextVideos,
          videoUrl: nextVideos[0]?.url || prev.hero.videoUrl
        }
      };
    });

    setIsHeroVideoModalOpen(false);
    setEditingHeroVideo(null);
    showNotification(`Video "${editingHeroVideo.title}" diperbarui.`);
  };

  const handleDeleteHeroVideo = async (id: string) => {
    const curVideos = config.hero.videos || [];
    if (curVideos.length <= 1) {
      showError('Minimal harus ada 1 video dalam playlist hero.');
      return;
    }
    if (await askConfirm({ title: 'Hapus video ini dari playlist hero?', message: 'Website publik berubah setelah kamu klik Simpan.', confirmText: 'Hapus video', variant: 'danger' })) {
      setConfig(prev => {
        const nextVideos = (prev.hero.videos || []).filter(v => v.id !== id);
        return {
          ...prev,
          hero: {
            ...prev.hero,
            videos: nextVideos,
            videoUrl: nextVideos[0]?.url || prev.hero.videoUrl
          }
        };
      });
      showNotification('Video dihapus dari playlist hero.');
    }
  };

  const handleMoveHeroVideo = (idx: number, direction: 'up' | 'down') => {
    const curVideos = [...(config.hero.videos || [])];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= curVideos.length) return;
    const temp = curVideos[idx];
    curVideos[idx] = curVideos[targetIdx];
    curVideos[targetIdx] = temp;
    setConfig(prev => ({
      ...prev,
      hero: {
        ...prev.hero,
        videos: curVideos,
        videoUrl: curVideos[0]?.url || prev.hero.videoUrl
      }
    }));
  };

  // Upload Video Baru Langsung dari Tombol di Tab Hero
  const handleDirectUploadNewHeroVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      showError('Mohon pilih file video yang valid (.mp4, .webm).');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      showError('Ukuran video terlalu besar (maksimal 50 MB). Disarankan video ringkas berdurasi 10–30 detik.');
      return;
    }

    setIsUploadingHeroVideo(true);
    try {
      const result = await uploadCmsMedia(file, 'hero');
      if (rejectLocalVideo(result)) return;
      const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      const newVid: HeroVideoItem = {
        id: `vid-${Date.now()}`,
        title: cleanTitle.length > 2 ? cleanTitle : `Video #${(config.hero.videos?.length || 0) + 1}`,
        url: result.url
      };

      setConfig(prev => {
        const nextVideos = [...(prev.hero.videos || []), newVid];
        return {
          ...prev,
          hero: {
            ...prev.hero,
            backgroundType: 'video',
            videos: nextVideos,
            videoUrl: nextVideos[0]?.url || prev.hero.videoUrl
          }
        };
      });

      showNotification(`Video "${newVid.title}" ditambahkan ke playlist.`);
    } catch (err) {
      console.error(err);
      showError('Gagal mengunggah file video.');
    } finally {
      setIsUploadingHeroVideo(false);
      if (e.target) e.target.value = '';
    }
  };

  // Upload untuk mengganti file video pada modal edit
  const handleUploadForEditingHeroVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingHeroVideo) return;

    if (!file.type.startsWith('video/')) {
      showError('Mohon pilih file video yang valid (.mp4, .webm).');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      showError('Ukuran video maksimal 50 MB.');
      return;
    }

    setIsUploadingHeroVideo(true);
    try {
      const result = await uploadCmsMedia(file, 'hero');
      if (rejectLocalVideo(result)) return;
      setEditingHeroVideo(prev => prev ? { ...prev, url: result.url } : null);
      showNotification('File video diganti.');
    } catch {
      showError('Gagal mengunggah file video.');
    } finally {
      setIsUploadingHeroVideo(false);
      if (e.target) e.target.value = '';
    }
  };

  // Tambah Cepat Preset ke Playlist
  const handleAddPresetToHeroVideos = (preset: typeof VIDEO_PRESETS[0]) => {
    const newVid: HeroVideoItem = {
      id: `vid-${Date.now()}-${preset.id}`,
      title: preset.label.split(':')[1]?.trim() || preset.label,
      url: preset.url,
      poster: preset.poster
    };

    setConfig(prev => {
      const curVideos = prev.hero.videos || [];
      const nextVideos = [...curVideos, newVid];
      return {
        ...prev,
        hero: {
          ...prev.hero,
          backgroundType: 'video',
          videos: nextVideos,
          videoUrl: nextVideos[0]?.url || prev.hero.videoUrl
        }
      };
    });

    showNotification(`Preset "${newVid.title}" ditambahkan ke playlist.`);
  };

  // Hero Photo Slides CRUD Handlers (Dokumentasi Kotak Kanan Landing Page)
  const handleOpenAddHeroSlide = () => {
    const newSlide: HeroDocumentationSlide = {
      id: `hero-photo-${Date.now()}`,
      title: '',
      category: 'Standar Wadah Higienis',
      description: '',
      imageUrl: IMAGE_PRESETS[2].url,
      badge: 'SUS 304 Food-Grade',
      targetGrams: '475 gram'
    };
    setEditingHeroSlide(newSlide);
    setHeroSlideImagePreview(newSlide.imageUrl);
    setIsHeroSlideModalOpen(true);
  };

  const handleOpenEditHeroSlide = (slide: HeroDocumentationSlide) => {
    setEditingHeroSlide({ ...slide });
    setHeroSlideImagePreview(slide.imageUrl);
    setIsHeroSlideModalOpen(true);
  };

  const handleSaveHeroSlide = () => {
    if (!editingHeroSlide) return;
    if (!editingHeroSlide.title.trim()) {
      showError('Judul foto dokumentasi wajib diisi.');
      return;
    }

    const updatedSlide: HeroDocumentationSlide = {
      ...editingHeroSlide,
      imageUrl: heroSlideImagePreview || editingHeroSlide.imageUrl
    };

    setConfig(prev => {
      const currentSlides = prev.hero.photoSlides && prev.hero.photoSlides.length > 0
        ? prev.hero.photoSlides
        : (DEFAULT_WEBSITE_CONFIG.hero.photoSlides || []);
      const exists = currentSlides.some(s => s.id === updatedSlide.id);
      const slides = exists
        ? currentSlides.map(s => s.id === updatedSlide.id ? updatedSlide : s)
        : [...currentSlides, updatedSlide];
      return {
        ...prev,
        hero: {
          ...prev.hero,
          photoSlides: slides
        }
      };
    });

    setIsHeroSlideModalOpen(false);
    setEditingHeroSlide(null);
    showNotification(`Slide foto "${updatedSlide.title}" diperbarui.`);
  };

  const handleDeleteHeroSlide = async (id: string) => {
    const currentSlides = config.hero.photoSlides && config.hero.photoSlides.length > 0
      ? config.hero.photoSlides
      : (DEFAULT_WEBSITE_CONFIG.hero.photoSlides || []);
    if (currentSlides.length <= 1) {
      showError('Minimal harus ada 1 slide foto dokumentasi yang aktif di kotak hero.');
      return;
    }
    if (await askConfirm({ title: 'Hapus slide foto ini?', message: 'Website publik berubah setelah kamu klik Simpan.', confirmText: 'Hapus slide', variant: 'danger' })) {
      setConfig(prev => ({
        ...prev,
        hero: {
          ...prev.hero,
          photoSlides: (prev.hero.photoSlides?.length ? prev.hero.photoSlides : DEFAULT_WEBSITE_CONFIG.hero.photoSlides || []).filter(s => s.id !== id)
        }
      }));
      showNotification('Slide foto dokumentasi hero dihapus.');
    }
  };

  const handleMoveHeroSlide = (idx: number, direction: 'up' | 'down') => {
    const currentSlides = [...(config.hero.photoSlides?.length ? config.hero.photoSlides : DEFAULT_WEBSITE_CONFIG.hero.photoSlides || [])];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= currentSlides.length) return;
    const temp = currentSlides[idx];
    currentSlides[idx] = currentSlides[targetIdx];
    currentSlides[targetIdx] = temp;
    setConfig(prev => ({
      ...prev,
      hero: {
        ...prev.hero,
        photoSlides: currentSlides
      }
    }));
  };

  const handleUploadHeroSlideImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingHeroSlideImg(true);
      const result = await uploadCmsMedia(file, 'hero');
      setHeroSlideImagePreview(result.url);
      if (editingHeroSlide) {
        setEditingHeroSlide(prev => prev ? { ...prev, imageUrl: result.url } : null);
      }
      notifyImageUpload(result, 'Foto');
    } catch {
      showError('Gagal mengunggah foto slide hero.');
    } finally {
      setIsUploadingHeroSlideImg(false);
      if (e.target) e.target.value = '';
    }
  };

  // Menu hari ini dari Rekap Order Menu, supaya tidak perlu diketik dua kali.
  const todayIso = localDateIso();
  // Dibaca ulang saat data gudang tersinkron, supaya poster yang baru disimpan langsung bisa diambil
  const [ordersVersion, setOrdersVersion] = useState(0);
  useEffect(() => {
    const bump = () => setOrdersVersion(v => v + 1);
    window.addEventListener('sppg_warehouse_sync', bump);
    return () => window.removeEventListener('sppg_warehouse_sync', bump);
  }, []);
  const todayOrders = useMemo(
    () => warehouseDb.getMenuOrders()
      .filter(o => o.date === todayIso && o.status !== 'CANCELLED')
      .sort((a, b) => SESSION_ORDER[a.mealSession] - SESSION_ORDER[b.mealSession]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todayIso, ordersVersion]
  );
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const selectedOrder = todayOrders.find(o => o.id === selectedOrderId) ?? todayOrders[0];

  const handleFillFromOrder = async (order: MenuOrder) => {
    const current = config.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday;
    const ok = await askConfirm({
      title: `Isi dari menu "${order.menuTitle}"?`,
      message: order.poster
        ? 'Tanggal, nama menu, menu 3B, deskripsi, dan daftar bahan diganti. Nilai gizi per porsi, foto ompreng, dan letak nama diambil dari poster menu tanggal ini. Data gizi bahan yang namanya sama tetap dipakai.'
        : 'Tanggal, nama menu, menu 3B, deskripsi, dan daftar bahan diganti. Data gizi bahan yang namanya sama tetap dipakai. Poster menu tanggal ini belum dibuat, jadi gizi per porsi dikosongkan dan foto ompreng tidak berubah.',
      confirmText: 'Isi otomatis',
      variant: 'warning',
    });
    if (!ok) return;

    const supplierByName = new Map(
      (order.poArrivalItems || []).map(it => [normalizeName(it.itemName), it.supplier])
    );
    const existingByName = new Map(current.ingredients.map(i => [normalizeName(i.name), i]));
    const names = [
      ...(order.keyIngredients || []).map(k => k.name || k.itemName || ''),
      ...(order.poArrivalItems || []).map(it => it.itemName),
    ].map(n => n.trim()).filter(Boolean);
    const uniqueNames = [...new Map(names.map(n => [normalizeName(n), n])).values()];

    const missingNutrition: string[] = [];
    const ingredients: IngredientNutritionInfo[] = uniqueNames.map((name, idx) => {
      const estimate = estimateIngredientPortions(name, order, current.portionSmall, current.portionLarge);
      const existing = existingByName.get(normalizeName(name));
      if (existing) return withEstimatedPortions(existing, estimate);
      missingNutrition.push(name);
      const req = order.keyIngredients?.find(k => normalizeName(k.name || k.itemName || '') === normalizeName(name));
      return {
        id: `ing-${Date.now()}-${idx}`,
        name,
        category: req?.category || '',
        portionSmall: estimate.small,
        portionLarge: estimate.large,
        imageUrl: '',
        nutritionHighlight: '',
        healthBenefits: '',
        supplier: supplierByName.get(normalizeName(name)) || '',
      };
    });

    // Dari poster menu: nilai gizi per porsi, foto ompreng tanpa background, dan letak nama yang sudah diubah ke panggung
    // halaman publik. Gizi yang tidak ada di poster dikosongkan, supaya angka menu hari lain tidak tampil di menu ini.
    const poster = order.poster;
    const cutoutOf = (m: MenuPosterMenu | undefined) => (m?.photoUrl && m.photoOriginalUrl ? m : undefined);
    const regularTray = cutoutOf(poster?.menus[0]);
    const b3Tray = poster?.printMode === 'DOUBLE' ? cutoutOf(poster.menus[1]) : undefined;
    const fromPoster: string[] = [];
    if (poster?.menus[0] && [poster.menus[0].largePortion, poster.menus[0].smallPortion].some(n => Object.values(n || {}).some(v => String(v).trim()))) {
      fromPoster.push('gizi per porsi');
    }
    if (regularTray) fromPoster.push('foto ompreng');
    if (b3Tray) fromPoster.push('foto ompreng 3B');
    // Gizi 3B ada di menus[1] pada poster satu menu maupun dua menu; fotonya hanya dari poster dua menu.
    const b3Poster = poster?.menus[1];
    const b3HasNutrition = Boolean(b3Poster && [b3Poster.largePortion, b3Poster.smallPortion].some(n => Object.values(n || {}).some(v => String(v).trim())));
    if (b3HasNutrition) fromPoster.push('gizi 3B');

    setConfig(prev => {
      const c = prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday;
      return {
        ...prev,
        menuToday: {
          ...c,
          portionLarge: portionFromPoster(c.portionLarge, poster?.menus[0]?.largePortion),
          portionSmall: portionFromPoster(c.portionSmall, poster?.menus[0]?.smallPortion),
          ...(regularTray ? { imageUrl: regularTray.photoUrl!, trayLabels: regularTray.stageLabels ?? null } : {}),
          ...(b3Tray ? { imageUrlB3: b3Tray.photoUrl!, trayLabelsB3: b3Tray.stageLabels ?? null } : {}),
          portionLargeB3: portionFromPoster(c.portionLargeB3 ?? EMPTY_PORTION_TIER, b3Poster?.largePortion),
          portionSmallB3: portionFromPoster(c.portionSmallB3 ?? EMPTY_PORTION_TIER, b3Poster?.smallPortion),
          dateText: formatMenuDate(order.date),
          menuTitle: order.menuTitle,
          menuB3: order.specialDietB3?.trim() || '',
          description: order.menuDescription?.trim() || c.description,
          // Order tanpa daftar bahan: pertahankan daftar lama daripada mengosongkan halaman publik.
          ingredients: ingredients.length > 0 ? ingredients : c.ingredients,
        },
      };
    });

    const posterNote = fromPoster.length > 0 ? ` Dari poster menu: ${fromPoster.join(', ')}.` : '';
    if (missingNutrition.length > 0) {
      showNotification(`Menu terisi.${posterNote} ${missingNutrition.length} bahan belum punya data gizi: ${missingNutrition.join(', ')}.`, 'warning');
    } else {
      showNotification(`Menu hari ini terisi dari Rekap Order Menu.${posterNote}`);
    }
  };

  const patchMenuToday = (patch: Partial<WebsiteMenuTodayConfig>) =>
    setConfig(prev => ({ ...prev, menuToday: { ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday), ...patch } }));

  const patchEnergy = (key: EnergyKey, value: string) =>
    setConfig(prev => {
      const mt = prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday;
      return { ...prev, menuToday: { ...mt, energySummary: { ...mt.energySummary, [key]: value } } };
    });

  const patchPortion = (
    tier: 'portionSmall' | 'portionLarge' | 'portionSmallB3' | 'portionLargeB3',
    key: keyof PortionTierConfig,
    value: string
  ) =>
    setConfig(prev => {
      const mt = prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday;
      return { ...prev, menuToday: { ...mt, [tier]: { ...(mt[tier] ?? EMPTY_PORTION_TIER), [key]: value } } };
    });

  // Draf teks dari Gemini. Hasil masuk ke draf halaman ini dan baru tampil di website setelah Simpan.
  const [aiBusy, setAiBusy] = useState<'description' | 'ingredients' | null>(null);

  const fetchAiDraft = async (target: 'description' | 'ingredients'): Promise<MenuAiDraft | null> => {
    const mt = config.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday;
    setAiBusy(target);
    try {
      return await requestMenuAiDraft({
        menuTitle: mt.menuTitle,
        menuB3: mt.menuB3,
        dateText: mt.dateText,
        ingredients: mt.ingredients.map(i => ({ name: i.name, category: i.category })),
      });
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Gagal membuat draf AI.');
      return null;
    } finally {
      setAiBusy(null);
    }
  };

  const handleAiDescription = async () => {
    const mt = config.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday;
    if (mt.description.trim()) {
      const ok = await askConfirm({
        title: 'Ganti deskripsi dengan draf AI?',
        message: 'Deskripsi sajian yang sekarang akan ditimpa. Baca dulu hasilnya sebelum menyimpan.',
        confirmText: 'Ganti',
        variant: 'warning',
      });
      if (!ok) return;
    }
    const draft = await fetchAiDraft('description');
    if (!draft?.description.trim()) return;
    patchMenuToday({ description: draft.description.trim() });
    showNotification('Draf deskripsi masuk. Baca dan perbaiki dulu sebelum Simpan.');
  };

  // Usulan AI untuk bahan dari data belanja; baru berubah setelah petugas memeriksa di dialog.
  const [tidySuggestions, setTidySuggestions] = useState<AiIngredientSuggestion[] | null>(null);
  const [isTidying, setIsTidying] = useState(false);
  const handleAiTidyIngredients = async () => {
    const mt = config.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday;
    setIsTidying(true);
    try {
      setTidySuggestions(await requestIngredientTidy(mt.menuTitle, mt.ingredients.map(i => i.name)));
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Bahan gagal dirapikan AI.');
    } finally {
      setIsTidying(false);
    }
  };

  // Hanya mengisi kolom teks bahan yang masih kosong, supaya tulisan petugas tidak tertimpa.
  const handleAiIngredients = async () => {
    const draft = await fetchAiDraft('ingredients');
    if (!draft) return;
    const byName = new Map(draft.ingredients.map(d => [normalizeName(d.name), d]));
    const merge = (items: IngredientNutritionInfo[]) =>
      items.map(item => {
        const d = byName.get(normalizeName(item.name));
        if (!d) return item;
        return {
          ...item,
          healthBenefits: item.healthBenefits.trim() ? item.healthBenefits : d.healthBenefits.trim(),
          whyGood: item.whyGood?.some(w => w.trim()) ? item.whyGood : d.whyGood.map(w => w.trim()).filter(Boolean),
          funFact: item.funFact?.trim() ? item.funFact : d.funFact.trim(),
        };
      });
    // Hitungan dari state saat ini hanya untuk pesan; penulisan lewat updater agar ketikan selama menunggu AI tidak hilang.
    const current = (config.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday).ingredients;
    const filled = merge(current).filter((next, i) =>
      next.healthBenefits !== current[i].healthBenefits || next.whyGood !== current[i].whyGood || next.funFact !== current[i].funFact
    ).length;
    setConfig(prev => {
      const mt = prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday;
      return { ...prev, menuToday: { ...mt, ingredients: merge(mt.ingredients) } };
    });
    showNotification(
      filled > 0
        ? `Teks ${filled} bahan diisi draf AI. Kolom yang sudah ada isinya tidak diubah.`
        : 'Semua bahan sudah punya teks, tidak ada yang diubah.',
      filled > 0 ? 'success' : 'warning'
    );
  };

  // Helper & Handler untuk Menu MBG Hari Ini & QR Code
  const handleCopyQrLink = () => {
    const targetUrl = `${window.location.origin}/menu-mbg-hari-ini`;
    navigator.clipboard.writeText(targetUrl).then(
      () => {
        setCopiedQrLink(true);
        setTimeout(() => setCopiedQrLink(false), 2200);
        showNotification('Tautan disalin.');
      },
      () => showError(`Browser menolak menyalin. Salin manual: ${targetUrl}`)
    );
  };

  const handleDownloadQrPng = () => {
    if (!qrCodeDataUrl) return;
    const a = document.createElement('a');
    a.href = qrCodeDataUrl;
    a.download = `qr-code-menu-mbg-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
    showNotification('QR Code diunduh.');
  };

  // Nampan tanpa latar supaya menonjol di hero halaman publik. Hasilnya diunggah seperti foto biasa.
  // Menu reguler dan 3B memakai alur yang sama, hanya kolom foto dan status prosesnya yang berbeda.
  const [trayCutoutStatus, setTrayCutoutStatus] = useState('');
  const [trayCutoutStatusB3, setTrayCutoutStatusB3] = useState('');
  type TrayPhotoKey = 'imageUrl' | 'imageUrlB3';
  const trayStatusSetter = (key: TrayPhotoKey) => (key === 'imageUrl' ? setTrayCutoutStatus : setTrayCutoutStatusB3);

  const cutoutTrayPhotoFor = async (key: TrayPhotoKey) => {
    const source = (config.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday)[key];
    if (!source) return;
    const setStatus = trayStatusSetter(key);
    setStatus('Menyiapkan...');
    try {
      const blob = await cutoutTrayPhoto(source, setStatus);
      const result = await uploadCmsMedia(new File([blob], 'nampan.png', { type: 'image/png' }), 'menu');
      patchMenuToday({ [key]: result.url });
      notifyImageUpload(result, key === 'imageUrl' ? 'Foto nampan tanpa latar' : 'Foto ompreng 3B tanpa latar');
    } catch {
      showError('Background gagal dihapus. Periksa koneksi internet (model diunduh saat pertama kali), lalu coba lagi.');
    } finally {
      setStatus('');
    }
  };
  const handleCutoutTodayMenuPhoto = () => cutoutTrayPhotoFor('imageUrl');

  const uploadTrayPhotoFor = async (key: TrayPhotoKey, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const setBusy = key === 'imageUrl' ? setIsUploadingTodayMenuPhoto : setIsUploadingB3Photo;
    const setStatus = trayStatusSetter(key);

    try {
      setBusy(true);
      // Background dihapus otomatis agar ompreng menyatu dengan hero. Bila gagal, foto asli tetap dipakai dan
      // petugas diberi tahu, tombol Hapus background bisa dicoba lagi.
      let upload: File = file;
      try {
        const { dataUrl } = await compressImageToWebP(file, { maxDimension: 1600, quality: 0.9 });
        const blob = await cutoutTrayPhoto(dataUrl, setStatus);
        upload = new File([blob], 'nampan.png', { type: 'image/png' });
      } catch {
        showError('Background gagal dihapus, foto diunggah apa adanya. Coba tombol Hapus background lagi saat koneksi baik.');
      } finally {
        setStatus('');
      }
      const result = await uploadCmsMedia(upload, 'menu');
      patchMenuToday({ [key]: result.url });
      notifyImageUpload(result, key === 'imageUrl' ? 'Foto menu hari ini' : 'Foto ompreng 3B');
    } catch {
      showError('Gagal mengunggah foto menu.');
    } finally {
      setBusy(false);
      if (e.target) e.target.value = '';
    }
  };
  const handleUploadTodayMenuPhoto = (e: React.ChangeEvent<HTMLInputElement>) => uploadTrayPhotoFor('imageUrl', e);

  const handleOpenAddIngredient = () => {
    const newId = `ing-${Date.now()}`;
    const newIng: IngredientNutritionInfo = {
      id: newId,
      name: '',
      category: 'sayuran',
      portionSmall: '',
      portionLarge: '',
      imageUrl: '',
      nutritionHighlight: '',
      healthBenefits: '',
      supplier: '',
      notes: ''
    };
    setEditingIngredient(newIng);
    setIngredientImagePreview(newIng.imageUrl);
    setIngredientAiError('');
    setIsIngredientModalOpen(true);
  };

  // Order yang tanggalnya sama dengan menu di halaman publik, bukan selalu order hari ini.
  const estimatePortionsFor = (ingredientName: string) => {
    const mt = config.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday;
    const order = warehouseDb.getMenuOrders().find(o => o.status !== 'CANCELLED' && formatMenuDate(o.date) === mt.dateText.trim());
    return estimateIngredientPortions(ingredientName, order, mt.portionSmall, mt.portionLarge);
  };

  const handleOpenEditIngredient = (item: IngredientNutritionInfo) => {
    setEditingIngredient(withEstimatedPortions({ ...item }, estimatePortionsFor(item.name)));
    setIngredientImagePreview(item.imageUrl);
    setIngredientAiError('');
    setIsIngredientModalOpen(true);
  };

  // Hanya kolom teks. Takaran dan pemasok tetap diisi petugas, karena harus dari data dapur, bukan karangan model.
  // Kolom yang sudah ditulis tidak ditimpa, kecuali keempatnya terisi dan petugas meminta tulis ulang.
  const [isIngredientBankOpen, setIsIngredientBankOpen] = useState(false);
  const [ingredientAiBusy, setIngredientAiBusy] = useState(false);
  const [ingredientAiError, setIngredientAiError] = useState('');
  const handleAiFillIngredient = async () => {
    if (!editingIngredient?.name.trim() || ingredientAiBusy) return;
    const { id, name, category, nutritionHighlight, healthBenefits, whyGood, funFact } = editingIngredient;
    const replaceAll = Boolean(nutritionHighlight.trim() && healthBenefits.trim() && whyGood?.some(w => w.trim()) && funFact?.trim());
    if (replaceAll) {
      const ok = await askConfirm({
        title: 'Tulis ulang teks bahan ini?',
        message: 'Kandungan gizi, manfaat, alasan baik, dan "Tahukah kamu" yang sekarang akan diganti draf AI.',
        confirmText: 'Tulis ulang',
        variant: 'warning',
      });
      if (!ok) return;
    }
    setIngredientAiError('');
    setIngredientAiBusy(true);
    try {
      const mt = config.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday;
      const draft = await requestMenuAiDraft({ menuTitle: mt.menuTitle, dateText: mt.dateText, ingredients: [{ name: name.trim(), category }] });
      const d = draft.ingredients.find(i => normalizeName(i.name) === normalizeName(name)) ?? draft.ingredients[0];
      if (!d) throw new Error('AI belum memberi hasil, coba lagi.');
      // Lewat updater dan dicek id-nya: petugas bisa mengetik atau berganti bahan selama menunggu AI.
      setEditingIngredient(prev => {
        if (!prev || prev.id !== id) return prev;
        const pick = (current: string | undefined, next: string | undefined) =>
          replaceAll || !current?.trim() ? next?.trim() || current || '' : current;
        const points = (d.whyGood || []).map(w => w.trim()).filter(Boolean);
        return {
          ...prev,
          nutritionHighlight: pick(prev.nutritionHighlight, d.nutritionHighlight),
          healthBenefits: pick(prev.healthBenefits, d.healthBenefits),
          whyGood: (replaceAll || !prev.whyGood?.some(w => w.trim())) && points.length > 0 ? points : prev.whyGood,
          funFact: pick(prev.funFact, d.funFact),
        };
      });
    } catch (err) {
      setIngredientAiError(err instanceof Error ? err.message : 'Gagal membuat draf AI.');
    } finally {
      setIngredientAiBusy(false);
    }
  };

  const handleSaveIngredient = () => {
    if (!editingIngredient) return;
    if (!editingIngredient.name.trim()) {
      showError('Nama bahan pangan wajib diisi.');
      return;
    }

    const curMenuToday = config.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday;
    const curIngredients = curMenuToday.ingredients || [];
    const exists = curIngredients.some(i => i.id === editingIngredient.id);
    const updatedIngredients = exists
      ? curIngredients.map(i => i.id === editingIngredient.id ? editingIngredient : i)
      : [...curIngredients, editingIngredient];

    setConfig(prev => ({
      ...prev,
      menuToday: {
        ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday),
        ingredients: updatedIngredients
      }
    }));

    setIsIngredientModalOpen(false);
    setEditingIngredient(null);
    showNotification(`Bahan "${editingIngredient.name}" diperbarui.`);
  };

  const handleDeleteIngredient = async (id: string) => {
    const curMenuToday = config.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday;
    if (curMenuToday.ingredients.length <= 1) {
      showError('Minimal harus ada 1 bahan pangan dalam daftar menu hari ini.');
      return;
    }
    if (await askConfirm({ title: 'Hapus bahan ini dari menu hari ini?', message: 'Website publik berubah setelah kamu klik Simpan.', confirmText: 'Hapus bahan', variant: 'danger' })) {
      setConfig(prev => {
        const c = prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday;
        return {
          ...prev,
          menuToday: {
            ...c,
            ingredients: c.ingredients.filter(i => i.id !== id)
          }
        };
      });
      showNotification('Bahan pangan dihapus.');
    }
  };

  const handleMoveIngredient = (idx: number, direction: 'up' | 'down') => {
    const curMenuToday = config.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday;
    const items = [...curMenuToday.ingredients];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= items.length) return;
    const temp = items[idx];
    items[idx] = items[targetIdx];
    items[targetIdx] = temp;
    setConfig(prev => ({
      ...prev,
      menuToday: {
        ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday),
        ingredients: items
      }
    }));
  };

  const handleUploadIngredientPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingIngredientImg(true);
      const result = await uploadCmsMedia(file, 'menu');
      setIngredientImagePreview(result.url);
      if (editingIngredient) {
        setEditingIngredient(prev => prev ? { ...prev, imageUrl: result.url } : null);
      }
      notifyImageUpload(result, 'Foto bahan');
    } catch {
      showError('Gagal mengunggah foto bahan.');
    } finally {
      setIsUploadingIngredientImg(false);
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header menempel di bawah navbar, supaya status dan tombol Simpan selalu terlihat tanpa bar mengambang */}
      <div className="sticky top-14 z-30 bg-white px-4 py-3 sm:px-5 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">Atur Website</h1>
          <p className={`inline-flex items-center gap-1.5 text-xs ${isDirty ? 'text-amber-800 font-semibold' : 'text-slate-600'}`} aria-live="polite">
            <span className={`w-2 h-2 rounded-full ${isDirty ? 'bg-amber-500' : 'bg-emerald-600'}`} aria-hidden="true" />
            {isDirty ? 'Belum disimpan, website publik belum berubah' : 'Semua tersimpan'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isDirty && (
            <button type="button" onClick={handleDiscardChanges} disabled={isCloudSaving} className={BTN_SECONDARY}>
              Batalkan
            </button>
          )}
          <a href="/" target="_blank" rel="noopener noreferrer" className={`${BTN_SECONDARY} hidden sm:inline-flex`}>
            <ExternalLink className="w-4 h-4" />
            Lihat Website
          </a>
          <button type="button" onClick={handleSaveAll} disabled={isCloudSaving || !isDirty} className={BTN_PRIMARY}>
            <Save className="w-4 h-4" />
            {isCloudSaving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>

      <div className="space-y-3 px-1">
        <p className="text-xs text-slate-600 max-w-2xl">
          Isi halaman menu hari ini (yang dibuka dari QR) dan bagian atas halaman depan website.
        </p>
        <div role="tablist" aria-label="Bagian website" className="flex gap-1 p-1 bg-slate-200/70 rounded-lg text-xs overflow-x-auto max-w-full w-fit">
          {([
            { id: 'menu_today', label: 'Menu Hari Ini & QR' },
            { id: 'hero', label: 'Bagian Atas (Hero)' },
          ] as const).map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 rounded-md whitespace-nowrap cursor-pointer min-h-[44px] sm:min-h-[32px] ${FOCUS} ${
                activeTab === tab.id ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. KONTEN TAB 1: HERO & VIDEO BACKGROUND */}
      {activeTab === 'hero' && (
        <div className="space-y-4">
        <p className="text-xs text-slate-600 px-1">Bagian paling atas halaman depan website: judul, latar video atau foto, dan slide foto di kanan.</p>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Kolom Kiri: Konfigurasi Video & Kontrol */}
          <div className="lg:col-span-7 space-y-4">
            <CollapsibleCard title="Teks & Judul" summary={config.hero.heroTitle || 'Judul belum diisi'} defaultOpen>
              <div className="space-y-3">

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Badge Teks</label>
                  <input
                    type="text"
                    value={config.hero.heroBadge}
                    onChange={e => setConfig(prev => ({ ...prev, hero: { ...prev.hero, heroBadge: e.target.value } }))}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-800 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Judul Utama</label>
                  <input
                    type="text"
                    value={config.hero.heroTitle}
                    onChange={e => setConfig(prev => ({ ...prev, hero: { ...prev.hero, heroTitle: e.target.value } }))}
                    className="w-full px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-800 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Deskripsi Narasi</label>
                  <textarea
                    rows={3}
                    value={config.hero.heroSubtitle}
                    onChange={e => setConfig(prev => ({ ...prev, hero: { ...prev.hero, heroSubtitle: e.target.value } }))}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-800 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
              </div>
            </CollapsibleCard>

            <CollapsibleCard
              title="Latar Belakang"
              summary={config.hero.backgroundType === 'video'
                ? `Video, ${(config.hero.videos || []).length} di playlist`
                : 'Foto statis'}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700">Jenis latar</span>
                <div className="flex items-center p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, hero: { ...prev.hero, backgroundType: 'video' } }))}
                    className={`px-3 py-1 min-h-[44px] sm:min-h-[30px] text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${FOCUS} ${
                      config.hero.backgroundType === 'video'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Video</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, hero: { ...prev.hero, backgroundType: 'image' } }))}
                    className={`px-3 py-1 min-h-[44px] sm:min-h-[30px] text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${FOCUS} ${
                      config.hero.backgroundType === 'image'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Foto Statis</span>
                  </button>
                </div>
              </div>

              {/* Multi-Video Playlist Management */}
              <div className="space-y-4 pt-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-100">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span>Playlist Video Hero (Looping Otomatis)</span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] bg-emerald-100 text-emerald-900 font-semibold">
                        {(config.hero.videos || []).length} Video
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Video diputar berurutan secara otomatis berkesinambungan.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={newHeroVideoFileRef}
                      accept="video/mp4,video/webm"
                      onChange={handleDirectUploadNewHeroVideo}
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() => newHeroVideoFileRef.current?.click()}
                      disabled={isUploadingHeroVideo}
                      className={`${BTN_PRIMARY}`}
                      title="Unggah file MP4 langsung ke penyimpanan cloud"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingHeroVideo ? 'Mengunggah...' : 'Upload Video'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenAddHeroVideo}
                      className={`${BTN_SECONDARY}`}
                      title="Tambah tautan video manual"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah URL</span>
                    </button>
                  </div>
                </div>

                {/* Daftar Item Video Playlist */}
                <div className="space-y-2">
                  {(config.hero.videos || []).map((vid, idx) => (
                    <div
                      key={vid.id}
                      className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-50/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-[#0c3123] text-emerald-300 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                          #{idx + 1}
                        </span>
                        <div className="w-16 h-11 rounded-lg bg-slate-900 border border-slate-300 overflow-hidden shrink-0 flex items-center justify-center relative">
                          <video src={vid.url} className="w-full h-full object-cover" muted preload="metadata" />
                          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                            <Play className="w-3.5 h-3.5 text-white/80" />
                          </div>
                        </div>
                        <div className="min-w-0">
                          <h5 className="font-bold text-xs text-slate-900 truncate">
                            {vid.title}
                          </h5>
                          <p className="text-[10px] text-slate-500 font-mono truncate max-w-[280px]">
                            {vid.url}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleMoveHeroVideo(idx, 'up')}
                          disabled={idx === 0}
                          className={`${ICON_BTN} text-slate-600 hover:bg-slate-100`}
                          aria-label="Geser ke atas"
                          title="Geser ke atas"
                        >
                          <ChevronLeft className="w-3.5 h-3.5 rotate-90" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveHeroVideo(idx, 'down')}
                          disabled={idx === (config.hero.videos?.length || 1) - 1}
                          className={`${ICON_BTN} text-slate-600 hover:bg-slate-100`}
                          aria-label="Geser ke bawah"
                          title="Geser ke bawah"
                        >
                          <ChevronRight className="w-3.5 h-3.5 rotate-90" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditHeroVideo(vid)}
                          className={`${ICON_BTN} text-emerald-700 hover:bg-emerald-50`}
                          aria-label="Edit video ini"
                          title="Edit video ini"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteHeroVideo(vid.id)}
                          className={`${ICON_BTN} text-rose-600 hover:bg-rose-50`}
                          aria-label="Hapus video dari playlist"
                          title="Hapus video dari playlist"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pengaturan Looping & Waktu Transisi Playlist */}
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-xs text-slate-800">Mode Transisi Video:</span>
                      <p className="text-[11px] text-slate-600">
                        Atur interval pergantian video latar belakang.
                      </p>
                    </div>

                    <Select size="sm"
                      value={config.hero.videoIntervalSeconds || 0}
                      onChange={e => setConfig(prev => ({
                        ...prev,
                        hero: {
                          ...prev.hero,
                          videoIntervalSeconds: parseInt(e.target.value, 10)
                        }
                      }))}>
                      <option value={0}>Transisi Alami saat Video Berakhir (onEnded)</option>
                      <option value={8}>Otomatis Tiap 8 Detik</option>
                      <option value={12}>Otomatis Tiap 12 Detik</option>
                      <option value={20}>Otomatis Tiap 20 Detik</option>
                      <option value={30}>Otomatis Tiap 30 Detik</option>
                    </Select>
                  </div>

                  {/* Preset Video Rekomendasi */}
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-[11px] font-semibold text-slate-600 block mb-1.5">
                      Pilihan Video Operasional Dapur:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {VIDEO_PRESETS.map((vp) => {
                        const isAlreadyAdded = (config.hero.videos || []).some(v => v.url === vp.url);
                        return (
                          <button
                            key={vp.id}
                            type="button"
                            onClick={() => handleAddPresetToHeroVideos(vp)}
                            disabled={isAlreadyAdded}
                            className={`p-2 rounded-lg text-left border text-[11px] transition-all cursor-pointer ${
                              isAlreadyAdded
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 opacity-80'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-emerald-50/50 hover:border-emerald-300'
                            }`}
                          >
                            <div className="font-bold flex items-center justify-between">
                              <span className="truncate">{vp.label.split(':')[0]}</span>
                              {isAlreadyAdded ? (
                                <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-0.5 shrink-0">
                                  <Check className="w-3 h-3" /> Ada
                                </span>
                              ) : (
                                <Plus className="w-3 h-3 text-emerald-700 shrink-0" />
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{vp.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Pengaturan Overlay Transparansi Gelap untuk Keterbacaan Teks */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Lapisan Overlay Gelap ({Math.round(config.hero.videoOverlayOpacity * 100)}%)</span>
                  </label>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Standar: 60% – 75%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="0.85"
                  step="0.05"
                  value={config.hero.videoOverlayOpacity}
                  onChange={e => setConfig(prev => ({
                    ...prev,
                    hero: { ...prev.hero, videoOverlayOpacity: parseFloat(e.target.value) }
                  }))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-700"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>20% (Terang)</span>
                  <span>55% (Sedang)</span>
                  <span>85% (Kontras Tinggi)</span>
                </div>
              </div>

            </CollapsibleCard>

            {/* Slide foto di sisi kanan hero */}
            <CollapsibleCard
              title="Slide Foto Kanan"
              summary={`${(config.hero.photoSlides?.length ? config.hero.photoSlides : DEFAULT_WEBSITE_CONFIG.hero.photoSlides || []).length} foto bergantian di sisi kanan judul`}
            >
              <div className="flex justify-end">
                <button type="button" onClick={handleOpenAddHeroSlide} className={BTN_PRIMARY}>
                  <Plus className="w-4 h-4" />
                  Tambah foto
                </button>
              </div>

              {/* Pengaturan Auto-Slide & Durasi Detik */}
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setConfig(prev => ({
                      ...prev,
                      hero: {
                        ...prev.hero,
                        autoSlidePhotos: !(prev.hero.autoSlidePhotos ?? true)
                      }
                    }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                      (config.hero.autoSlidePhotos ?? true) ? 'bg-emerald-700' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        (config.hero.autoSlidePhotos ?? true) ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <div>
                    <span className="font-bold text-xs text-slate-800 block">
                      Auto-Slide Foto: {(config.hero.autoSlidePhotos ?? true) ? 'Aktif' : 'Non-Aktif'}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Berganti foto secara berkala otomatis
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <span className="text-xs text-slate-600 font-medium">Interval:</span>
                  <Select size="sm"
                    value={config.hero.photoSlideInterval || 4}
                    onChange={e => setConfig(prev => ({
                      ...prev,
                      hero: {
                        ...prev.hero,
                        photoSlideInterval: parseInt(e.target.value, 10)
                      }
                    }))}>
                    <option value={3}>3 Detik</option>
                    <option value={4}>4 Detik</option>
                    <option value={5}>5 Detik</option>
                    <option value={6}>6 Detik</option>
                    <option value={8}>8 Detik</option>
                  </Select>
                </div>
              </div>

              {/* Daftar Foto Slide */}
              <div className="space-y-2.5">
                {(config.hero.photoSlides || DEFAULT_WEBSITE_CONFIG.hero.photoSlides || []).map((slide, idx) => (
                  <div
                    key={slide.id || idx}
                    className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-50/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-[#0c3123] text-emerald-300 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                        #{idx + 1}
                      </span>
                      <div className="w-16 h-12 rounded-lg bg-slate-900 border border-slate-300 overflow-hidden shrink-0 relative">
                        <img src={slide.imageUrl} alt={slide.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h5 className="font-bold text-xs text-slate-900 truncate">
                            {slide.title}
                          </h5>
                          {slide.badge && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-900 font-medium shrink-0">
                              {slide.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 line-clamp-1 mt-0.5">
                          {slide.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleMoveHeroSlide(idx, 'up')}
                        disabled={idx === 0}
                        className={`${ICON_BTN} text-slate-600 hover:bg-slate-100`}
                        aria-label="Geser ke atas"
                        title="Geser ke atas"
                      >
                        <ChevronLeft className="w-3.5 h-3.5 rotate-90" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveHeroSlide(idx, 'down')}
                        disabled={idx === (config.hero.photoSlides || DEFAULT_WEBSITE_CONFIG.hero.photoSlides || []).length - 1}
                        className={`${ICON_BTN} text-slate-600 hover:bg-slate-100`}
                        aria-label="Geser ke bawah"
                        title="Geser ke bawah"
                      >
                        <ChevronRight className="w-3.5 h-3.5 rotate-90" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEditHeroSlide(slide)}
                        className={`${ICON_BTN} text-emerald-700 hover:bg-emerald-50`}
                        aria-label="Edit slide foto ini"
                        title="Edit slide foto ini"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteHeroSlide(slide.id)}
                        className={`${ICON_BTN} text-rose-600 hover:bg-rose-50`}
                        aria-label="Hapus foto dari slide"
                        title="Hapus foto dari slide"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleCard>
          </div>

          {/* Kolom Kanan: Pratinjau Tampilan Hero */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden sticky top-40 space-y-4 p-4">
              <div className="flex items-center justify-between text-xs text-slate-200 pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="font-semibold text-slate-100">Pratinjau Hero Section</span>
                </div>
                <span className="text-[11px] font-medium text-emerald-400">Live View</span>
              </div>

              {/* Layar Simulasi Background Hero dengan Video & Teks */}
              <div className="relative aspect-16/10 overflow-hidden rounded-xl bg-slate-950 flex flex-col justify-end p-5 text-white border border-slate-800">
                {/* Background Video atau Image */}
                {config.hero.backgroundType === 'video' && (config.hero.videos?.[0]?.url || config.hero.videoUrl) ? (
                  <video
                    key={config.hero.videos?.[0]?.url || config.hero.videoUrl}
                    src={config.hero.videos?.[0]?.url || config.hero.videoUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="auto"
                    poster={config.hero.videoPoster}
                    className="absolute inset-0 w-full h-full object-cover object-center filter brightness-90"
                  />
                ) : (
                  <img
                    src={config.hero.videoPoster}
                    alt="Background Statis"
                    className="absolute inset-0 w-full h-full object-cover object-center"
                  />
                )}

                {/* Lapisan Gradient Tint Overlay sesuai nilai slider */}
                <div
                  className="absolute inset-0 bg-gradient-to-t from-[#0c2317] via-[#0f172a]/80 to-transparent pointer-events-none transition-opacity duration-200"
                  style={{ opacity: config.hero.videoOverlayOpacity }}
                />

                {/* Konten Simulasi Teks */}
                <div className="relative z-10 space-y-2 max-w-sm">
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-white/20 text-white border border-white/30">
                    {config.hero.heroBadge}
                  </span>
                  <h4 className="font-display text-base font-bold text-white leading-tight drop-shadow-xs">
                    {config.hero.heroTitle.includes('Menu MBG Disiapkan Setiap Hari') ? (
                      <>
                        <span>{config.hero.heroTitle.replace('Menu MBG Disiapkan Setiap Hari', '').trim()} </span>
                        <span className="text-[#86efac]">Menu MBG Disiapkan Setiap Hari</span>
                      </>
                    ) : (
                      config.hero.heroTitle
                    )}
                  </h4>
                  <p className="text-[11px] text-slate-200 line-clamp-3 drop-shadow-xs leading-relaxed">
                    {config.hero.heroSubtitle}
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="px-3 py-1 rounded-lg bg-[#0c3123] text-white text-[10px] font-semibold border border-emerald-500/30">
                      {config.hero.primaryCtaText}
                    </span>
                    <span className="px-3 py-1 rounded-lg bg-white/80 text-slate-900 text-[10px] font-semibold">
                      {config.hero.secondaryCtaText}
                    </span>
                  </div>
                </div>
              </div>

              {/* Simulasi Kotak Kanan: Dokumentasi Slide Foto */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Slide Foto Operasional (Kotak Kanan)</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    Auto: {(config.hero.autoSlidePhotos ?? true) ? `${config.hero.photoSlideInterval || 4}s` : 'Manual'}
                  </span>
                </div>

                <div className="relative aspect-4/3 rounded-lg overflow-hidden border border-slate-700 bg-slate-900">
                  <img
                    src={(config.hero.photoSlides || DEFAULT_WEBSITE_CONFIG.hero.photoSlides || [])[0]?.imageUrl || IMAGE_PRESETS[2].url}
                    alt="Pratinjau Slide Foto"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 bg-black/80 text-white text-[10px] font-medium px-2 py-0.5 rounded border border-slate-700 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" />
                    <span>{(config.hero.photoSlides || DEFAULT_WEBSITE_CONFIG.hero.photoSlides || [])[0]?.badge || 'SUS 304 Food-Grade'}</span>
                  </div>
                  <div className="absolute top-2 right-2 bg-black/80 text-white text-[10px] font-mono px-1.5 py-0.5 rounded border border-white/20">
                    1 / {(config.hero.photoSlides || DEFAULT_WEBSITE_CONFIG.hero.photoSlides || []).length}
                  </div>
                  <div className="absolute bottom-2 left-2 right-2 bg-slate-900/90 p-2 rounded-md border border-slate-700 text-left">
                    <div className="text-[11px] font-bold text-white truncate">
                      {(config.hero.photoSlides || DEFAULT_WEBSITE_CONFIG.hero.photoSlides || [])[0]?.title || 'Sajian Nampan SUS 304'}
                    </div>
                    <div className="text-[10px] text-slate-300 line-clamp-1 mt-0.5">
                      {(config.hero.photoSlides || DEFAULT_WEBSITE_CONFIG.hero.photoSlides || [])[0]?.description}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* KONTEN TAB: MENU MBG HARI INI & QR CODE */}
      {activeTab === 'menu_today' && (() => {
        const menuToday = config.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday;
        const targetPublicUrl = `${window.location.origin}/menu-mbg-hari-ini`;
        const energy = menuToday.energySummary;
        const small = menuToday.portionSmall;
        const large = menuToday.portionLarge;
        const b3Dishes = menuDishes(menuToday).b3;
        const hero = menuToday.nutritionHero;
        const habitCount = (menuToday.dailyHabits || []).filter(h => h.title.trim()).length;

        return (
          <div className="space-y-4">
            {/* Isi otomatis dari Rekap Order Menu: pekerjaan harian, jadi paling atas */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900">Ambil dari Rekap Order Menu</h2>
                {selectedOrder ? (
                  <p className="text-xs text-slate-600 mt-0.5">
                    Menu {todayOrders.length > 1 ? `${selectedOrder.mealSession.toLowerCase()} ` : ''}hari ini:{' '}
                    <span className="font-semibold text-slate-900">{selectedOrder.menuTitle}</span>
                    {' · '}{(selectedOrder.keyIngredients?.length || selectedOrder.poArrivalItems?.length || 0)} bahan
                    {selectedOrder.poster ? ' · gizi dan foto dari poster menu' : ' · poster menu belum dibuat'}
                  </p>
                ) : (
                  <p className="text-xs text-slate-600 mt-0.5">
                    Belum ada menu untuk {formatMenuDate(todayIso)} di Rekap Order Menu. Isi manual di bawah, atau buat menunya dulu.
                  </p>
                )}
                {menuToday.dateText.trim() !== formatMenuDate(todayIso) && (
                  <p className="text-xs text-amber-800 mt-1">
                    Halaman publik masih menampilkan menu {menuToday.dateText || 'tanpa tanggal'}.
                  </p>
                )}
              </div>
              {selectedOrder && (
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {todayOrders.length > 1 && (
                    <Select
                      aria-label="Pilih sesi menu"
                      value={selectedOrder.id}
                      onChange={e => setSelectedOrderId(e.target.value)}>
                      {todayOrders.map(o => (
                        <option key={o.id} value={o.id}>{o.mealSession}: {o.menuTitle}</option>
                      ))}
                    </Select>
                  )}
                  <button type="button" onClick={() => handleFillFromOrder(selectedOrder)} className={BTN_PRIMARY}>
                    <RotateCcw className="w-4 h-4" />
                    Isi otomatis
                  </button>
                </div>
              )}
            </div>

            {/* QR halaman publik */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="w-20 h-20 shrink-0 rounded-lg border border-slate-200 bg-white p-1 flex items-center justify-center">
                {qrCodeDataUrl ? (
                  <img src={qrCodeDataUrl} alt="QR halaman menu hari ini" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-[11px] text-slate-500">Membuat QR...</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold text-slate-900">QR halaman menu hari ini</h2>
                <p className="text-xs text-slate-600 mt-0.5">Ditempel di meja makan atau nampan. Isinya mengikuti pengaturan di bawah.</p>
                <code className="inline-block mt-1.5 max-w-full truncate px-2 py-0.5 rounded bg-slate-100 font-mono text-[11px] text-slate-700 select-all">
                  {targetPublicUrl}
                </code>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <a href="/menu-mbg-hari-ini" target="_blank" rel="noopener noreferrer" className={BTN_SECONDARY}>
                  <ExternalLink className="w-4 h-4" />
                  Buka
                </a>
                <button type="button" onClick={handleCopyQrLink} className={BTN_SECONDARY}>
                  {copiedQrLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedQrLink ? 'Disalin' : 'Salin tautan'}
                </button>
                <button type="button" onClick={handleDownloadQrPng} disabled={!qrCodeDataUrl} className={BTN_SECONDARY}>
                  <Download className="w-4 h-4" />
                  Unduh PNG
                </button>
                <button type="button" onClick={() => setIsPrintStickerModalOpen(true)} className={BTN_SECONDARY}>
                  <Printer className="w-4 h-4" />
                  Cetak stiker meja
                </button>
              </div>
            </div>

            <CollapsibleCard
              title="Menu & foto"
              summary={`${menuToday.menuTitle || 'Judul belum diisi'}${menuToday.dateText ? ` · ${menuToday.dateText}` : ''}`}
              defaultOpen
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="mt-date" className={FIELD_LABEL}>Tanggal sajian</label>
                  <input id="mt-date" type="text" value={menuToday.dateText} onChange={e => patchMenuToday({ dateText: e.target.value })}
                    placeholder="Rabu, 15 Oktober 2026" className={FIELD} />
                </div>
                <div>
                  <label htmlFor="mt-subtitle" className={FIELD_LABEL}>Subjudul</label>
                  <input id="mt-subtitle" type="text" value={menuToday.menuSubtitle} onChange={e => patchMenuToday({ menuSubtitle: e.target.value })}
                    placeholder="Siklus hari ke-3" className={FIELD} />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="mt-title" className={FIELD_LABEL}>Judul menu</label>
                  <input id="mt-title" type="text" value={menuToday.menuTitle} onChange={e => patchMenuToday({ menuTitle: e.target.value })}
                    placeholder="Nasi ayam ungkep bumbu kuning & sop sayur" className={FIELD} />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div>
                  <span className={FIELD_LABEL}>Foto sajian</span>
                  <div className="flex items-start gap-3">
                    {/* contain: ompreng tanpa latar tampil utuh seperti di halaman publik, tidak terpotong */}
                    <div className="w-32 h-24 rounded-lg overflow-hidden border border-slate-300 bg-slate-100 shrink-0">
                      <img
                        src={menuToday.imageUrl}
                        alt="Foto menu hari ini"
                        className="w-full h-full object-contain"
                        onError={e => {
                          (e.currentTarget as HTMLImageElement).src = IMAGE_PRESETS[1].url;
                        }}
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <input type="file" ref={todayMenuPhotoFileRef} accept="image/*" onChange={handleUploadTodayMenuPhoto} className="hidden" />
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => todayMenuPhotoFileRef.current?.click()} disabled={isUploadingTodayMenuPhoto} className={BTN_SECONDARY}>
                          <Upload className="w-4 h-4" />
                          {isUploadingTodayMenuPhoto ? (trayCutoutStatus || 'Memproses...') : 'Unggah foto'}
                        </button>
                        <button type="button" onClick={handleCutoutTodayMenuPhoto} disabled={Boolean(trayCutoutStatus) || !menuToday.imageUrl} className={`${BTN_SECONDARY} disabled:opacity-60 disabled:cursor-wait`}>
                          {!isUploadingTodayMenuPhoto && trayCutoutStatus ? trayCutoutStatus : 'Hapus background'}
                        </button>
                      </div>
                      <Select
                        aria-label="Pakai foto contoh"
                        className="w-full max-w-xs"
                        value={IMAGE_PRESETS.some(p => p.url === menuToday.imageUrl) ? menuToday.imageUrl : ''}
                        onChange={e => e.target.value && patchMenuToday({ imageUrl: e.target.value })}
                      >
                        <option value="">Atau pilih foto contoh</option>
                        {IMAGE_PRESETS.map(p => (
                          <option key={p.id} value={p.url}>{p.label.split('(')[0].trim()}</option>
                        ))}
                      </Select>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-end justify-between gap-2 mb-1">
                    <label htmlFor="mt-desc" className={`${FIELD_LABEL} mb-0`}>Deskripsi sajian</label>
                    <button type="button" onClick={handleAiDescription} disabled={aiBusy !== null}
                      className={`inline-flex items-center gap-1 px-2 min-h-[44px] sm:min-h-[28px] rounded-md text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:text-slate-400 cursor-pointer disabled:cursor-wait ${FOCUS}`}>
                      <PenLine className="w-3.5 h-3.5" />
                      {aiBusy === 'description' ? 'Menulis...' : 'Tulis draf dengan AI'}
                    </button>
                  </div>
                  <textarea id="mt-desc" rows={4} value={menuToday.description} onChange={e => patchMenuToday({ description: e.target.value })}
                    placeholder="Penjelasan menu dan cara pengolahannya" className={`${FIELD} py-2`} />
                </div>
              </div>

              <TrayLabelEditor menuToday={menuToday} onChange={patchMenuToday} />

              {/* Alergen dibaca dari nama menu dan bahan, bukan diketik: tidak bisa tertinggal saat menu berganti. */}
              <AllergenPreview menuToday={menuToday} />
            </CollapsibleCard>

            <CollapsibleCard
              title="Gizi & porsi"
              summary={[
                energy.caloriesAvg && `Rata-rata ${energy.caloriesAvg}`,
                (small.totalGramature || large.totalGramature) && `porsi kecil ${small.totalGramature || '-'}, besar ${large.totalGramature || '-'}`,
              ].filter(Boolean).join(' · ') || 'Belum diisi'}
            >
              <div>
                <span className={FIELD_LABEL}>Kandungan gizi rata-rata per porsi</span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {ENERGY_FIELDS.map(f => (
                    <div key={f.key}>
                      <label htmlFor={`energy-${f.key}`} className="block text-[11px] text-slate-600 mb-1">{f.label}</label>
                      <input id={`energy-${f.key}`} type="text" value={energy[f.key]} onChange={e => patchEnergy(f.key, e.target.value)} className={FIELD} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs border-separate border-spacing-y-1.5 min-w-[420px]">
                  <thead>
                    <tr className="text-left text-slate-600">
                      <th scope="col" className="font-semibold w-28 pr-2">Takaran</th>
                      <th scope="col" className="font-semibold px-1">Porsi kecil</th>
                      <th scope="col" className="font-semibold px-1">Porsi besar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PORTION_FIELDS.map(f => (
                      <tr key={f.key} className="align-top">
                        <th scope="row" className="font-medium text-slate-700 text-left pr-2 pt-2.5">{f.label}</th>
                        {(['portionSmall', 'portionLarge'] as const).map(tier => (
                          <td key={tier} className="px-1">
                            {f.key === 'description' ? (
                              <textarea rows={2} aria-label={`${f.label} ${tier === 'portionSmall' ? 'porsi kecil' : 'porsi besar'}`}
                                value={menuToday[tier][f.key]} onChange={e => patchPortion(tier, f.key, e.target.value)} className={`${FIELD} py-2`} />
                            ) : (
                              <input type="text" aria-label={`${f.label} ${tier === 'portionSmall' ? 'porsi kecil' : 'porsi besar'}`}
                                value={menuToday[tier][f.key]} onChange={e => patchPortion(tier, f.key, e.target.value)} className={FIELD} />
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Angka gizi terisi otomatis dari poster menu. Angka yang diubah di sini tertimpa setiap poster tanggal ini dibuka atau diubah.</p>
            </CollapsibleCard>

            <CollapsibleCard
              title="Menu 3B"
              summary={b3Dishes.length === 0
                ? 'Tidak ada menu 3B'
                : [
                    `${b3Dishes.length} hidangan`,
                    menuToday.imageUrlB3 ? 'foto ompreng ada' : 'belum ada foto ompreng',
                    hasPortionNutrition(menuToday.portionLargeB3) || hasPortionNutrition(menuToday.portionSmallB3) ? 'gizi terisi' : 'gizi belum diisi',
                  ].join(' · ')}
            >
              <div>
                <label htmlFor="menu-b3" className={FIELD_LABEL}>Hidangan 3B (ibu hamil, ibu menyusui, balita)</label>
                <input id="menu-b3" type="text" value={menuToday.menuB3 || ''} onChange={e => patchMenuToday({ menuB3: e.target.value })}
                  placeholder="Pisahkan dengan koma. Kosongkan bila tidak ada menu 3B" className={FIELD} />
                <p className="text-[11px] text-slate-500 mt-1">
                  Gizi 3B terisi otomatis dari poster menu. Foto 3B ikut bila posternya dicetak dua menu.
                </p>
              </div>

              <fieldset disabled={b3Dishes.length === 0} className="space-y-4 disabled:opacity-60">
                <div>
                  <span className={FIELD_LABEL}>Foto ompreng 3B</span>
                  <div className="flex items-start gap-3">
                    <div className="w-32 h-24 rounded-lg overflow-hidden border border-slate-300 bg-slate-100 shrink-0 flex items-center justify-center">
                      {menuToday.imageUrlB3 ? (
                        <img src={menuToday.imageUrlB3} alt="Foto ompreng menu 3B" className="w-full h-full object-contain" />
                      ) : (
                        <span className="text-[11px] text-slate-500 text-center px-2">Kosong: ilustrasi ompreng yang tampil</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <input type="file" ref={b3PhotoFileRef} accept="image/*" onChange={e => uploadTrayPhotoFor('imageUrlB3', e)} className="hidden" />
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => b3PhotoFileRef.current?.click()} disabled={isUploadingB3Photo} className={BTN_SECONDARY}>
                          <Upload className="w-4 h-4" />
                          {isUploadingB3Photo ? (trayCutoutStatusB3 || 'Memproses...') : 'Unggah foto'}
                        </button>
                        <button type="button" onClick={() => cutoutTrayPhotoFor('imageUrlB3')} disabled={Boolean(trayCutoutStatusB3) || !menuToday.imageUrlB3} className={`${BTN_SECONDARY} disabled:opacity-60 disabled:cursor-wait`}>
                          {!isUploadingB3Photo && trayCutoutStatusB3 ? trayCutoutStatusB3 : 'Hapus background'}
                        </button>
                        {menuToday.imageUrlB3 && (
                          <button type="button" onClick={() => patchMenuToday({ imageUrlB3: '', trayLabelsB3: null })} className={`${BTN_SECONDARY} text-rose-700`}>
                            <Trash2 className="w-4 h-4" />
                            Hapus foto
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">Nama hidangan dan panahnya diatur di bagian Menu &amp; foto, pilih Menu 3B.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <span className={FIELD_LABEL}>Gizi per porsi menu 3B</span>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-separate border-spacing-y-1.5 min-w-[420px]">
                      <thead>
                        <tr className="text-left text-slate-600">
                          <th scope="col" className="font-semibold w-28 pr-2">Takaran</th>
                          <th scope="col" className="font-semibold px-1">Porsi kecil</th>
                          <th scope="col" className="font-semibold px-1">Porsi besar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {PORTION_FIELDS.filter(f => f.key !== 'description').map(f => (
                          <tr key={f.key} className="align-top">
                            <th scope="row" className="font-medium text-slate-700 text-left pr-2 pt-2.5">{f.label}</th>
                            {(['portionSmallB3', 'portionLargeB3'] as const).map(tier => (
                              <td key={tier} className="px-1">
                                <input type="text" aria-label={`${f.label} 3B ${tier === 'portionSmallB3' ? 'porsi kecil' : 'porsi besar'}`}
                                  value={(menuToday[tier] ?? EMPTY_PORTION_TIER)[f.key]} onChange={e => patchPortion(tier, f.key, e.target.value)}
                                  placeholder={f.key === 'tierName' ? (tier === 'portionSmallB3' ? 'Porsi Kecil (Balita)' : 'Porsi Besar (Ibu hamil & menyusui)') : undefined}
                                  className={FIELD} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Kosongkan semua angka untuk menyembunyikan tabel gizi 3B di halaman publik.</p>
                </div>
              </fieldset>
            </CollapsibleCard>

            <CollapsibleCard
              title="Bahan pangan"
              summary={menuToday.ingredients.length > 0
                ? `${menuToday.ingredients.length} bahan: ${menuToday.ingredients.slice(0, 4).map(i => i.name).join(', ')}${menuToday.ingredients.length > 4 ? ', ...' : ''}`
                : 'Belum ada bahan'}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-600">Foto, takaran, dan manfaat tiap bahan. Urutan di sini sama dengan di halaman publik.</p>
                <div className="flex flex-wrap justify-end gap-2 shrink-0">
                  {menuToday.ingredients.length > 0 && (
                    <button type="button" onClick={handleAiTidyIngredients} disabled={isTidying} className={`${BTN_SECONDARY} disabled:cursor-wait disabled:text-slate-400`}>
                      <ListChecks className="w-4 h-4" />
                      {isTidying ? 'Merapikan...' : 'Rapikan bahan dengan AI'}
                    </button>
                  )}
                  {menuToday.ingredients.length > 0 && (
                    <button type="button" onClick={handleAiIngredients} disabled={aiBusy !== null} className={`${BTN_SECONDARY} disabled:cursor-wait disabled:text-slate-400`}>
                      <PenLine className="w-4 h-4" />
                      {aiBusy === 'ingredients' ? 'Menulis...' : 'Isi teks kosong dengan AI'}
                    </button>
                  )}
                  <button type="button" onClick={handleOpenAddIngredient} className={BTN_PRIMARY}>
                    <Plus className="w-4 h-4" />
                    Tambah bahan
                  </button>
                </div>
              </div>

              {menuToday.ingredients.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center border border-dashed border-slate-300 rounded-lg">
                  Belum ada bahan. Pakai "Isi otomatis" di atas atau tambah manual.
                </p>
              ) : (
                <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                  {menuToday.ingredients.map((item, idx) => {
                    const incomplete = !item.nutritionHighlight.trim() || !item.healthBenefits.trim();
                    return (
                      <li key={item.id} className="flex items-center gap-3 px-3 py-2">
                        <div className="w-10 h-10 rounded-md overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                          {item.imageUrl && (
                            <img src={item.imageUrl} alt="" className="w-full h-full object-cover"
                              onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-900 truncate">{item.name}</p>
                          <p className="text-[11px] text-slate-600 truncate">
                            {[item.category.replace('_', ' '), item.portionSmall && item.portionLarge ? `${item.portionSmall} / ${item.portionLarge}` : '']
                              .filter(Boolean).join(' · ') || 'Takaran belum diisi'}
                            {incomplete && <span className="text-amber-800"> · data gizi belum lengkap</span>}
                          </p>
                        </div>
                        <div className="flex items-center shrink-0">
                          <button type="button" onClick={() => handleMoveIngredient(idx, 'up')} disabled={idx === 0}
                            className={`${ICON_BTN} text-slate-600 hover:bg-slate-100`} aria-label={`Naikkan ${item.name}`}>
                            <ChevronLeft className="w-4 h-4 rotate-90" />
                          </button>
                          <button type="button" onClick={() => handleMoveIngredient(idx, 'down')} disabled={idx === menuToday.ingredients.length - 1}
                            className={`${ICON_BTN} text-slate-600 hover:bg-slate-100`} aria-label={`Turunkan ${item.name}`}>
                            <ChevronRight className="w-4 h-4 rotate-90" />
                          </button>
                          <button type="button" onClick={() => handleOpenEditIngredient(item)}
                            className={`${ICON_BTN} text-slate-700 hover:bg-slate-100`} aria-label={`Ubah ${item.name}`}>
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => handleDeleteIngredient(item.id)}
                            className={`${ICON_BTN} text-rose-700 hover:bg-rose-50`} aria-label={`Hapus ${item.name}`}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CollapsibleCard>

            <CollapsibleCard
              title="Konten anak"
              summary={`${hero?.name?.trim() ? `Pahlawan gizi: ${hero.name}` : 'Pahlawan gizi disembunyikan'} · ${habitCount} kebiasaan baik`}
            >
              <MenuTodayKidsEditor menuToday={menuToday} onNotify={showNotification} onChange={patchMenuToday} />
            </CollapsibleCard>
          </div>
        );
      })()}

      {/* 7. MODAL FORM: TAMBAH / EDIT VIDEO HERO */}
      {isHeroVideoModalOpen && editingHeroVideo && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-4 sm:p-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Video className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">
                  {(config.hero.videos || []).some(x => x.id === editingHeroVideo.id) ? 'Edit Video Hero' : 'Tambah Video Hero'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsHeroVideoModalOpen(false)}
                className={`${ICON_BTN} text-slate-500 hover:text-slate-800 hover:bg-slate-100`}
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Judul / Label Video</label>
                <input
                  type="text"
                  value={editingHeroVideo.title}
                  onChange={e => setEditingHeroVideo(prev => prev ? { ...prev, title: e.target.value } : null)}
                  placeholder="Contoh: Dapur Pukul 04.00 WIB & Sayuran Segar"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tautan File Video (Direct MP4 / WebM URL) atau Unggah Berkas
                </label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editingHeroVideo.url}
                    onChange={e => setEditingHeroVideo(prev => prev ? { ...prev, url: e.target.value } : null)}
                    placeholder="https://.../video.mp4"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-slate-800 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={editingHeroVideoFileRef}
                      accept="video/mp4,video/webm"
                      onChange={handleUploadForEditingHeroVideo}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => editingHeroVideoFileRef.current?.click()}
                      disabled={isUploadingHeroVideo}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingHeroVideo ? 'Mengunggah...' : 'Pilih Berkas MP4 dari Laptop'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Pratinjau Video Mini */}
              {editingHeroVideo.url && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Pratinjau Video</label>
                  <div className="aspect-video rounded-lg bg-slate-950 overflow-hidden border border-slate-300">
                    <video
                      key={editingHeroVideo.url}
                      src={editingHeroVideo.url}
                      controls
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsHeroVideoModalOpen(false)}
                  className={`${BTN_SECONDARY}`}
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveHeroVideo}
                  className={`${BTN_PRIMARY}`}
                >
                  Simpan Video
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL FORM: EDIT / TAMBAH DOKUMENTASI SLIDE FOTO HERO (KOTAK KANAN) */}
      {isHeroSlideModalOpen && editingHeroSlide && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-xl w-full p-4 sm:p-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">
                  {(config.hero.photoSlides || []).some(x => x.id === editingHeroSlide.id) ? 'Edit Slide Foto' : 'Tambah Slide Foto'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsHeroSlideModalOpen(false)}
                className={`${ICON_BTN} text-slate-500 hover:text-slate-800 hover:bg-slate-100`}
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Foto Dokumentasi Upload / Preview */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Foto Dokumentasi Nampan / Operasional
                </label>
                <div className="flex items-start gap-3">
                  <div className="w-28 h-24 rounded-lg bg-slate-900 overflow-hidden border border-slate-200 shrink-0">
                    {heroSlideImagePreview ? (
                      <img src={heroSlideImagePreview} alt="Preview Foto Hero" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500 text-[10px]">
                        Belum ada foto
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input
                      type="file"
                      ref={heroSlideFileRef}
                      accept="image/*"
                      onChange={handleUploadHeroSlideImage}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => heroSlideFileRef.current?.click()}
                      disabled={isUploadingHeroSlideImg}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-semibold cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingHeroSlideImg ? 'Mengompresi & Mengunggah...' : 'Unggah Foto Baru (Auto WebP)'}</span>
                    </button>
                    <p className="text-[10px] text-slate-500">
                      Disarankan rasio 4:3 beresolusi tajam (otomatis dikompresi WebP untuk pemuatan instan).
                    </p>
                  </div>
                </div>

                {/* Preset Pilihan Cepat */}
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-semibold text-slate-500 block mb-1">Atau pilih dari foto preset:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {IMAGE_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setHeroSlideImagePreview(p.url);
                          setEditingHeroSlide(prev => prev ? { ...prev, imageUrl: p.url } : null);
                        }}
                        className={`px-2 py-1 rounded text-[10px] font-medium border cursor-pointer ${
                          heroSlideImagePreview === p.url
                            ? 'bg-emerald-100 border-emerald-400 text-emerald-900 font-bold'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {p.label.split('(')[0]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Judul & Kategori */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Judul Dokumentasi</label>
                  <input
                    type="text"
                    value={editingHeroSlide.title}
                    onChange={e => setEditingHeroSlide(prev => prev ? { ...prev, title: e.target.value } : null)}
                    placeholder="Contoh: Sajian Nampan 5 Sekat SUS 304"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kategori / Standar Aspek</label>
                  <input
                    type="text"
                    value={editingHeroSlide.category}
                    onChange={e => setEditingHeroSlide(prev => prev ? { ...prev, category: e.target.value } : null)}
                    placeholder="Contoh: Standar Wadah Higienis"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                  />
                </div>
              </div>

              {/* Badge & Target Gramatur */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Label Badge Pojok Kiri</label>
                  <input
                    type="text"
                    value={editingHeroSlide.badge || ''}
                    onChange={e => setEditingHeroSlide(prev => prev ? { ...prev, badge: e.target.value } : null)}
                    placeholder="Contoh: SUS 304 Food-Grade"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Gramatur / Takaran Porsi</label>
                  <input
                    type="text"
                    value={editingHeroSlide.targetGrams || ''}
                    onChange={e => setEditingHeroSlide(prev => prev ? { ...prev, targetGrams: e.target.value } : null)}
                    placeholder="Contoh: 475 gram"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                  />
                </div>
              </div>

              {/* Keterangan */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Uraian / Keterangan Singkat</label>
                <textarea
                  rows={3}
                  value={editingHeroSlide.description}
                  onChange={e => setEditingHeroSlide(prev => prev ? { ...prev, description: e.target.value } : null)}
                  placeholder="Keterangan standar operasional wadah, gramatur, atau penyajian..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                />
              </div>

              {/* Aksi Modal */}
              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsHeroSlideModalOpen(false)}
                  className={`${BTN_SECONDARY}`}
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveHeroSlide}
                  className={`${BTN_PRIMARY}`}
                >
                  Terapkan Foto Slide
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL FORM: EDIT / TAMBAH BAHAN PANGAN MENU HARI INI */}
      {tidySuggestions && (
        <AiIngredientTidyDialog
          ingredients={(config.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday).ingredients}
          suggestions={tidySuggestions}
          onClose={() => setTidySuggestions(null)}
          onApply={next => {
            patchMenuToday({ ingredients: next });
            setTidySuggestions(null);
            showNotification('Daftar bahan dirapikan. Periksa lagi sebelum Simpan.');
          }}
        />
      )}

      {isIngredientModalOpen && editingIngredient && (
        <FormDialog
          title={(config.menuToday?.ingredients || []).some(x => x.id === editingIngredient.id) ? 'Edit bahan pangan' : 'Tambah bahan pangan'}
          onClose={() => setIsIngredientModalOpen(false)}
          onSubmit={e => {
            e.preventDefault();
            handleSaveIngredient();
          }}
          submitLabel="Simpan bahan"
        >
            <div className="space-y-4 text-xs">
              {/* Foto Bahan */}
              <div>
                <span className={FIELD_LABEL}>Foto bahan (opsional)</span>
                <div className="flex items-start gap-3">
                  <div className="w-24 h-20 rounded-lg bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
                    {ingredientImagePreview ? (
                      <img src={ingredientImagePreview} alt="Foto bahan yang dipakai" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500 text-[11px] text-center px-1">
                        Belum ada foto
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <input
                      type="file"
                      ref={ingredientFileRef}
                      accept="image/*"
                      onChange={handleUploadIngredientPhoto}
                      className="hidden"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => ingredientFileRef.current?.click()}
                        disabled={isUploadingIngredientImg}
                        className={BTN_SECONDARY}
                      >
                        <Upload className="w-4 h-4" />
                        {isUploadingIngredientImg ? 'Memproses...' : ingredientImagePreview ? 'Ganti foto' : 'Unggah foto'}
                      </button>
                      <button type="button" onClick={() => setIsIngredientBankOpen(true)} className={BTN_SECONDARY}>
                        <Images className="w-4 h-4" />
                        Ambil dari bank
                      </button>
                      {ingredientImagePreview && (
                        <button
                          type="button"
                          onClick={() => {
                            setIngredientImagePreview('');
                            setEditingIngredient(prev => prev ? { ...prev, imageUrl: '' } : null);
                          }}
                          className={`${BTN_SECONDARY} text-rose-700`}
                        >
                          <Trash2 className="w-4 h-4" />
                          Hapus foto
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">Tampil kecil di detail bahan pada halaman menu. Tanpa foto, hanya ilustrasi yang tampil.</p>
                  </div>
                </div>
              </div>

              {/* Nama & Kategori Bahan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ingredient-name" className={FIELD_LABEL}>Nama bahan</label>
                  <input
                    id="ingredient-name"
                    type="text"
                    value={editingIngredient.name}
                    onChange={e => setEditingIngredient(prev => prev ? { ...prev, name: e.target.value } : null)}
                    onBlur={() => setEditingIngredient(prev => prev ? withEstimatedPortions(prev, estimatePortionsFor(prev.name)) : null)}
                    placeholder="Contoh: Kubis"
                    className={FIELD}
                  />
                </div>
                <div>
                  <label htmlFor="ingredient-category" className={FIELD_LABEL}>Kategori</label>
                  <Select id="ingredient-category" className="w-full"
                    value={editingIngredient.category}
                    onChange={e => setEditingIngredient(prev => prev ? { ...prev, category: e.target.value } : null)}>
                    {/* Bahan dari Rekap Order bisa membawa kategori di luar daftar; tetap ditampilkan apa adanya agar tidak terlihat seperti Karbohidrat. */}
                    {!INGREDIENT_CATEGORIES.some(c => c.value === editingIngredient.category) && (
                      <option value={editingIngredient.category}>{editingIngredient.category || 'Pilih kategori'}</option>
                    )}
                    {INGREDIENT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </Select>
                </div>
              </div>

              {/* Takaran Porsi Kecil vs Porsi Besar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ingredient-small" className={FIELD_LABEL}>Porsi kecil (PAUD, SD 1-3)</label>
                  <input
                    id="ingredient-small"
                    type="text"
                    value={editingIngredient.portionSmall}
                    onChange={e => setEditingIngredient(prev => prev ? { ...prev, portionSmall: e.target.value } : null)}
                    placeholder="Contoh: 50 gram"
                    className={FIELD}
                  />
                </div>
                <div>
                  <label htmlFor="ingredient-large" className={FIELD_LABEL}>Porsi besar (SD 4-6, SMP)</label>
                  <input
                    id="ingredient-large"
                    type="text"
                    value={editingIngredient.portionLarge}
                    onChange={e => setEditingIngredient(prev => prev ? { ...prev, portionLarge: e.target.value } : null)}
                    placeholder="Contoh: 75 gram"
                    className={FIELD}
                  />
                </div>
                {estimatePortionsFor(editingIngredient.name).note && (
                  <p className="sm:col-span-2 -mt-1 text-[11px] text-slate-600">{estimatePortionsFor(editingIngredient.name).note}</p>
                )}
              </div>

              {/* Teks detail bahan di halaman publik; bagian ini yang bisa diisi AI */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h5 className="text-xs font-bold text-slate-900">Teks di halaman menu</h5>
                    <p className="text-[11px] text-slate-600">
                      {editingIngredient.name.trim() ? 'AI mengisi kolom yang masih kosong. Baca dulu sebelum menyimpan.' : 'Isi nama bahan dulu supaya AI bisa menulis.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAiFillIngredient}
                    disabled={ingredientAiBusy || !editingIngredient.name.trim()}
                    className={`${BTN_SECONDARY} shrink-0 disabled:cursor-not-allowed disabled:text-slate-400`}
                  >
                    <PenLine className="w-4 h-4" />
                    {ingredientAiBusy ? 'Menulis...' : 'Isi dengan AI'}
                  </button>
                </div>
                {ingredientAiError && (
                  <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{ingredientAiError}</p>
                )}

                <div>
                  <label htmlFor="ingredient-highlight" className={FIELD_LABEL}>Kandungan gizi utama</label>
                  <input
                    id="ingredient-highlight"
                    type="text"
                    value={editingIngredient.nutritionHighlight}
                    onChange={e => setEditingIngredient(prev => prev ? { ...prev, nutritionHighlight: e.target.value } : null)}
                    placeholder="Pisahkan dengan koma. Contoh: Vitamin C, Serat"
                    className={FIELD}
                  />
                </div>
                <div>
                  <label htmlFor="ingredient-benefits" className={FIELD_LABEL}>Manfaat untuk tubuh</label>
                  <textarea
                    id="ingredient-benefits"
                    rows={2}
                    value={editingIngredient.healthBenefits}
                    onChange={e => setEditingIngredient(prev => prev ? { ...prev, healthBenefits: e.target.value } : null)}
                    placeholder="Satu kalimat yang mudah dipahami anak"
                    className={`${FIELD} py-2`}
                  />
                </div>
                <div>
                  <label htmlFor="ingredient-why" className={FIELD_LABEL}>Mengapa baik untukmu? (opsional, satu poin per baris)</label>
                  <textarea
                    id="ingredient-why"
                    rows={3}
                    value={(editingIngredient.whyGood || []).join('\n')}
                    onChange={e => setEditingIngredient(prev => prev ? { ...prev, whyGood: e.target.value.split('\n') } : null)}
                    placeholder="Kosongkan untuk memakai kalimat Manfaat untuk tubuh"
                    className={`${FIELD} py-2`}
                  />
                </div>
                <div>
                  <label htmlFor="ingredient-fact" className={FIELD_LABEL}>Tahukah kamu? (opsional)</label>
                  <input
                    id="ingredient-fact"
                    type="text"
                    value={editingIngredient.funFact || ''}
                    onChange={e => setEditingIngredient(prev => prev ? { ...prev, funFact: e.target.value } : null)}
                    placeholder="Kosongkan untuk menyembunyikan kotak ini"
                    className={FIELD}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="ingredient-notes" className={FIELD_LABEL}>Catatan (opsional)</label>
                <input
                  id="ingredient-notes"
                  type="text"
                  value={editingIngredient.notes || ''}
                  onChange={e => setEditingIngredient(prev => prev ? { ...prev, notes: e.target.value } : null)}
                  placeholder="Contoh: Dicuci dan dipotong saat pagi"
                  className={FIELD}
                />
              </div>
            </div>
            {isIngredientBankOpen && (
              <ImageBankDialog
                onClose={() => setIsIngredientBankOpen(false)}
                onPick={url => {
                  setIngredientImagePreview(url);
                  setEditingIngredient(prev => prev ? { ...prev, imageUrl: url } : null);
                }}
              />
            )}
        </FormDialog>
      )}

      {/* 9. MODAL / PRINT VIEW: CETAK STIKER MEJA QR CODE */}
      {isPrintStickerModalOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-4 sm:p-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Printer className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">
                  Cetak Stiker QR Code Meja & Nampan
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsPrintStickerModalOpen(false)}
                className={`${ICON_BTN} text-slate-500 hover:text-slate-800 hover:bg-slate-100`}
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Preview Stiker yang siap diprint */}
            <div
              id="qr-sticker-printable"
              className="p-5 rounded-2xl border-2 border-dashed border-emerald-500 bg-emerald-50/30 text-center space-y-3"
            >
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-800 text-white text-[10px] font-bold">
                SPPG MLG TUMPANG JERU
              </div>
              <h4 className="font-display text-sm font-bold text-slate-900">
                MENU MAKAN BERGIZI GRATIS
              </h4>
              <p className="text-[11px] text-slate-600 font-medium">
                Scan QR Code untuk melihat foto sajian, gramatur porsi besar/kecil & rincian gizi hari ini:
              </p>

              <div className="flex justify-center py-1">
                <div className="p-2.5 bg-white rounded-xl shadow-md border border-slate-200 inline-block">
                  {qrCodeDataUrl ? (
                    <img src={qrCodeDataUrl} alt="QR Code" className="w-44 h-44 object-contain" />
                  ) : (
                    <div className="w-44 h-44 flex items-center justify-center text-xs text-slate-400">
                      Memuat QR...
                    </div>
                  )}
                </div>
              </div>

              <div className="text-[10px] text-slate-500 font-mono">
                {window.location.origin}/menu-mbg-hari-ini
              </div>

              <div className="text-[10px] text-emerald-800 font-semibold bg-white/80 p-2 rounded-lg border border-emerald-200/60">
                Porsi Kecil: PAUD & SD 1-3 | Porsi Besar: SD 4-6 & SMP
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-200 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsPrintStickerModalOpen(false)}
                className={`${BTN_SECONDARY}`}
              >
                Tutup
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadQrPng}
                  className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh PNG</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    window.print();
                  }}
                  className={`${BTN_PRIMARY}`}
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Stiker</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
