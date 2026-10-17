import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  WebsiteConfig,
  HeroVideoItem,
  HeroDocumentationSlide,
  IngredientNutritionInfo,
  DEFAULT_WEBSITE_CONFIG,
  getWebsiteConfig,
  saveWebsiteConfigToCloud,
  fetchWebsiteConfigFromCloud,
  uploadCmsMedia,
  VIDEO_PRESETS,
  IMAGE_PRESETS
} from '../db/websiteConfigStorage';
import QRCode from 'qrcode';
import { warehouseDb } from '../db/storage';
import { localDateIso } from '../utils/localDate';
import type { MenuOrder } from '../types/warehouse';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { MenuTodayKidsEditor } from './MenuTodayKidsEditor';
import { compressImageToWebP } from '../utils/imageCompressor';
import {
  Video,
  Image as ImageIcon,
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
  Sparkles,
  UtensilsCrossed,
  Info,
  Check,
  X,
  Download,
  QrCode,
  RotateCcw,
  Printer,
  Copy,
  Apple
} from 'lucide-react';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1';
const BTN_PRIMARY = `inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors cursor-pointer min-h-[44px] sm:min-h-[36px] ${FOCUS}`;
const BTN_SECONDARY = `inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-300 transition-colors cursor-pointer min-h-[44px] sm:min-h-[36px] ${FOCUS}`;

const ICON_BTN = `inline-flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-[32px] sm:min-h-[32px] rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${FOCUS}`;

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
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
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
  const todayOrders = useMemo(
    () => warehouseDb.getMenuOrders()
      .filter(o => o.date === todayIso)
      .sort((a, b) => SESSION_ORDER[a.mealSession] - SESSION_ORDER[b.mealSession]),
    [todayIso]
  );
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const selectedOrder = todayOrders.find(o => o.id === selectedOrderId) ?? todayOrders[0];

  const handleFillFromOrder = async (order: MenuOrder) => {
    const current = config.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday;
    const ok = await askConfirm({
      title: `Isi dari menu "${order.menuTitle}"?`,
      message: 'Tanggal, nama menu, menu 3B, deskripsi, dan daftar bahan diganti. Data gizi bahan yang namanya sama tetap dipakai.',
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
      const existing = existingByName.get(normalizeName(name));
      if (existing) return existing;
      missingNutrition.push(name);
      const req = order.keyIngredients?.find(k => normalizeName(k.name || k.itemName || '') === normalizeName(name));
      return {
        id: `ing-${Date.now()}-${idx}`,
        name,
        category: req?.category || '',
        portionSmall: '',
        portionLarge: '',
        imageUrl: '',
        nutritionHighlight: '',
        healthBenefits: '',
        supplier: supplierByName.get(normalizeName(name)) || '',
      };
    });

    setConfig(prev => {
      const c = prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday;
      return {
        ...prev,
        menuToday: {
          ...c,
          dateText: formatMenuDate(order.date),
          menuTitle: order.menuTitle,
          menuB3: order.specialDietB3?.trim() || '',
          description: order.menuDescription?.trim() || c.description,
          // Order tanpa daftar bahan: pertahankan daftar lama daripada mengosongkan halaman publik.
          ingredients: ingredients.length > 0 ? ingredients : c.ingredients,
        },
      };
    });

    if (missingNutrition.length > 0) {
      showNotification(`Menu terisi. ${missingNutrition.length} bahan belum punya data gizi: ${missingNutrition.join(', ')}.`, 'warning');
    } else {
      showNotification('Menu hari ini terisi dari Rekap Order Menu.');
    }
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

  const handleUploadTodayMenuPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingTodayMenuPhoto(true);
      const result = await uploadCmsMedia(file, 'menu');
      setConfig(prev => ({
        ...prev,
        menuToday: {
          ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday),
          imageUrl: result.url
        }
      }));
      notifyImageUpload(result, 'Foto menu hari ini');
    } catch {
      showError('Gagal mengunggah foto menu.');
    } finally {
      setIsUploadingTodayMenuPhoto(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleOpenAddIngredient = () => {
    const newId = `ing-${Date.now()}`;
    const newIng: IngredientNutritionInfo = {
      id: newId,
      name: '',
      category: 'Sayuran & Sop',
      portionSmall: '50 gram (1 porsi kecil)',
      portionLarge: '75 gram (1 porsi besar)',
      imageUrl: IMAGE_PRESETS[3]?.url || '',
      nutritionHighlight: 'Vitamin & Mineral Alami',
      healthBenefits: 'Mendukung daya tahan tubuh, konsentrasi belajar, dan pemenuhan gizi anak.',
      supplier: 'Kelompok Tani Sayur Tumpang',
      notes: 'Bahan pangan lokal segar tanpa pengawet'
    };
    setEditingIngredient(newIng);
    setIngredientImagePreview(newIng.imageUrl);
    setIsIngredientModalOpen(true);
  };

  const handleOpenEditIngredient = (item: IngredientNutritionInfo) => {
    setEditingIngredient({ ...item });
    setIngredientImagePreview(item.imageUrl);
    setIsIngredientModalOpen(true);
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
    <div className={`space-y-4 ${isDirty ? 'pb-36 sm:pb-24' : ''}`}>
      {/* Header */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Atur Website</h1>
            <p className="text-xs text-slate-600 mt-0.5 max-w-2xl">
              Video hero, foto menu MBG, kajian visual, dan halaman menu hari ini yang tampil di website publik.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span className={`inline-flex items-center gap-1.5 text-xs mr-1 ${isDirty ? 'text-amber-800 font-semibold' : 'text-slate-600'}`}>
              <span className={`w-2 h-2 rounded-full ${isDirty ? 'bg-amber-500' : 'bg-emerald-600'}`} aria-hidden="true" />
              {isDirty ? 'Belum disimpan' : 'Semua tersimpan'}
            </span>
            <a href="/" target="_blank" rel="noopener noreferrer" className={BTN_SECONDARY}>
              <ExternalLink className="w-4 h-4" />
              Lihat Website
            </a>
            <button type="button" onClick={handleSaveAll} disabled={isCloudSaving || !isDirty} className={BTN_PRIMARY}>
              <Save className="w-4 h-4" />
              {isCloudSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </div>

        <div role="tablist" aria-label="Bagian website" className="flex gap-1 p-1 bg-slate-100 rounded-lg text-xs overflow-x-auto max-w-full w-fit">
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <p className="text-xs text-slate-600">Bagian paling atas halaman depan website: judul, latar video atau foto, dan slide foto di kanan.</p>
          <a href="/" target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 hover:underline min-h-[44px] sm:min-h-0 ${FOCUS}`}>
            Lihat di website
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
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

                    <select
                      value={config.hero.videoIntervalSeconds || 0}
                      onChange={e => setConfig(prev => ({
                        ...prev,
                        hero: {
                          ...prev.hero,
                          videoIntervalSeconds: parseInt(e.target.value, 10)
                        }
                      }))}
                      className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 font-medium focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                    >
                      <option value={0}>Transisi Alami saat Video Berakhir (onEnded)</option>
                      <option value={8}>Otomatis Tiap 8 Detik</option>
                      <option value={12}>Otomatis Tiap 12 Detik</option>
                      <option value={20}>Otomatis Tiap 20 Detik</option>
                      <option value={30}>Otomatis Tiap 30 Detik</option>
                    </select>
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
                  <select
                    value={config.hero.photoSlideInterval || 4}
                    onChange={e => setConfig(prev => ({
                      ...prev,
                      hero: {
                        ...prev.hero,
                        photoSlideInterval: parseInt(e.target.value, 10)
                      }
                    }))}
                    className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 font-medium focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                  >
                    <option value={3}>3 Detik</option>
                    <option value={4}>4 Detik</option>
                    <option value={5}>5 Detik</option>
                    <option value={6}>6 Detik</option>
                    <option value={8}>8 Detik</option>
                  </select>
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
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden sticky top-24 space-y-4 p-4">
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

      {/* 4. KONTEN TAB 4: MENU MBG HARI INI & QR CODE */}
      {activeTab === 'menu_today' && (() => {
        const menuToday = config.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday;
        const targetPublicUrl = `${window.location.origin}/menu-mbg-hari-ini`;

        return (
          <div className="space-y-4">
            {/* Kartu Hub QR Code & Akses Cepat */}
            <div className="bg-emerald-900 rounded-xl p-4 sm:p-5 text-white border border-emerald-800">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                  <div className="p-3 bg-white rounded-lg shrink-0">
                    {qrCodeDataUrl ? (
                      <img src={qrCodeDataUrl} alt="QR Code Menu Hari Ini" className="w-28 h-28 object-contain" />
                    ) : (
                      <div className="w-28 h-28 flex items-center justify-center text-slate-400 text-xs">
                        Membuat QR...
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 text-center sm:text-left">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-700/60 border border-emerald-500/40 text-[11px] font-semibold text-emerald-100">
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Akses Scan Meja & Nampan Makan Siswa</span>
                    </div>
                    <h3 className="text-lg font-bold text-white tracking-tight">
                      Halaman Publik: /menu-mbg-hari-ini
                    </h3>
                    <p className="text-xs text-emerald-100/90 max-w-xl leading-relaxed">
                      QR Code ini dapat ditempel di meja ruang makan sekolah, mading, atau nampan saji. Ketika siswa atau orang tua melakukan pemindaian (scan), mereka langsung diarahkan ke rincian menu, gramatur porsi besar/kecil, serta kandungan nutrisi dari tiap bahan pangan.
                    </p>
                    <div className="pt-1 flex items-center justify-center sm:justify-start gap-2 text-xs">
                      <code className="px-2.5 py-1 rounded bg-black/30 border border-white/10 font-mono text-[11px] text-emerald-200 select-all">
                        {targetPublicUrl}
                      </code>
                    </div>
                  </div>
                </div>

                {/* Tombol Aksi QR Code */}
                <div className="flex flex-wrap sm:flex-col gap-2 shrink-0 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => window.open('/menu-mbg-hari-ini', '_blank')}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white hover:bg-emerald-50 text-emerald-950 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4 text-emerald-700" />
                    <span>Buka Halaman Publik</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyQrLink}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-800/80 hover:bg-emerald-700 border border-emerald-600/50 text-white font-medium text-xs transition-colors cursor-pointer"
                  >
                    {copiedQrLink ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedQrLink ? 'Tautan Disalin!' : 'Salin Tautan'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadQrPng}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-800/80 hover:bg-emerald-700 border border-emerald-600/50 text-white font-medium text-xs transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Unduh PNG</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsPrintStickerModalOpen(true)}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 border border-emerald-500 text-white font-semibold text-xs transition-colors cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Cetak Stiker Meja</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Isi otomatis dari Rekap Order Menu */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900">Ambil dari Rekap Order Menu</h3>
                {selectedOrder ? (
                  <p className="text-xs text-slate-600 mt-0.5">
                    Menu {selectedOrder.mealSession.toLowerCase()} hari ini:{' '}
                    <span className="font-semibold text-slate-900">{selectedOrder.menuTitle}</span>
                    {' · '}{(selectedOrder.keyIngredients?.length || selectedOrder.poArrivalItems?.length || 0)} bahan
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
                    <select
                      aria-label="Pilih sesi menu"
                      value={selectedOrder.id}
                      onChange={e => setSelectedOrderId(e.target.value)}
                      className={`px-2.5 min-h-[44px] sm:min-h-[36px] rounded-lg border border-slate-300 bg-white text-xs text-slate-900 ${FOCUS}`}
                    >
                      {todayOrders.map(o => (
                        <option key={o.id} value={o.id}>{o.mealSession}: {o.menuTitle}</option>
                      ))}
                    </select>
                  )}
                  <button type="button" onClick={() => handleFillFromOrder(selectedOrder)} className={BTN_PRIMARY}>
                    <RotateCcw className="w-4 h-4" />
                    Isi otomatis
                  </button>
                </div>
              )}
            </div>

            {/* Form Pengaturan Konten Menu Hari Ini */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Kolom Kiri: Info Utama & Foto Menu */}
              <div className="lg:col-span-7 space-y-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center">
                        <UtensilsCrossed className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Identitas & Foto Sajian Menu Hari Ini
                        </h3>
                        <p className="text-[11px] text-slate-600">
                          Informasi yang tampil di bagian atas halaman saat QR code di-scan
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tanggal Sajian Menu
                    </label>
                    <input
                      type="text"
                      value={menuToday.dateText}
                      onChange={e => setConfig(prev => ({
                        ...prev,
                        menuToday: {
                          ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday),
                          dateText: e.target.value
                        }
                      }))}
                      placeholder="Contoh: Rabu, 15 Oktober 2026"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Judul Sajian Menu
                    </label>
                    <input
                      type="text"
                      value={menuToday.menuTitle}
                      onChange={e => setConfig(prev => ({
                        ...prev,
                        menuToday: {
                          ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday),
                          menuTitle: e.target.value
                        }
                      }))}
                      placeholder="Contoh: Nasi Ayam Ungkep Bumbu Kuning & Sop Sayur Segar"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="menu-b3" className="block text-xs font-semibold text-slate-700 mb-1">
                      Menu 3B (ibu hamil, ibu menyusui, balita)
                    </label>
                    <input
                      id="menu-b3"
                      type="text"
                      value={menuToday.menuB3 || ''}
                      onChange={e => setConfig(prev => ({
                        ...prev,
                        menuToday: {
                          ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday),
                          menuB3: e.target.value
                        }
                      }))}
                      placeholder="Pisahkan dengan koma. Contoh: Nasi tim, Ayam suwir, Sayur bayam, Pisang"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                    />
                    <p className="text-[11px] text-slate-600 mt-1">Terisi otomatis dari Rekap Order Menu. Kosongkan bila hari ini tidak ada menu 3B.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Subjudul / Penjelasan Ringkas
                    </label>
                    <input
                      type="text"
                      value={menuToday.menuSubtitle}
                      onChange={e => setConfig(prev => ({
                        ...prev,
                        menuToday: {
                          ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday),
                          menuSubtitle: e.target.value
                        }
                      }))}
                      placeholder="Contoh: Siklus Hari Ke-3 | Standar Nutrisi BGN & UPT Puskesmas Tumpang"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                    />
                  </div>

                  {/* Foto Menu Hari Ini */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Foto Sajian Menu Hari Ini
                    </label>
                    <div className="flex flex-col sm:flex-row items-start gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                      <div className="w-36 h-24 rounded-lg overflow-hidden border border-slate-300 bg-slate-200 shrink-0">
                        <img
                          src={menuToday.imageUrl}
                          alt="Foto Menu Hari Ini"
                          className="w-full h-full object-cover"
                          onError={e => {
                            (e.currentTarget as HTMLImageElement).src = IMAGE_PRESETS[1].url;
                          }}
                        />
                      </div>
                      <div className="flex-1 space-y-2">
                        <input
                          type="file"
                          ref={todayMenuPhotoFileRef}
                          accept="image/*"
                          onChange={handleUploadTodayMenuPhoto}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => todayMenuPhotoFileRef.current?.click()}
                          disabled={isUploadingTodayMenuPhoto}
                          className={`${BTN_PRIMARY}`}
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>{isUploadingTodayMenuPhoto ? 'Memproses...' : 'Unggah Foto Baru (WebP)'}</span>
                        </button>
                        <div className="text-[11px] text-slate-500">
                          Pilihan cepat preset foto sajian:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {IMAGE_PRESETS.map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setConfig(prev => ({
                                  ...prev,
                                  menuToday: {
                                    ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday),
                                    imageUrl: p.url
                                  }
                                }));
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] border transition-colors cursor-pointer ${
                                menuToday.imageUrl === p.url
                                  ? 'bg-emerald-700 text-white border-emerald-700'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {p.label.split('(')[0]}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Deskripsi Sajian
                    </label>
                    <textarea
                      rows={3}
                      value={menuToday.description}
                      onChange={e => setConfig(prev => ({
                        ...prev,
                        menuToday: {
                          ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday),
                          description: e.target.value
                        }
                      }))}
                      placeholder="Penjelasan menu, pengolahan higienis, dan cita rasa..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Peringatan Alergen / Keamanan Pangan
                      </label>
                      <input
                        type="text"
                        value={menuToday.allergensWarning || ''}
                        onChange={e => setConfig(prev => ({
                          ...prev,
                          menuToday: {
                            ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday),
                            allergensWarning: e.target.value
                          }
                        }))}
                        placeholder="Contoh: Mengandung kedelai. Bebas susu sapi & kacang tanah."
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Status Verifikasi QC & Gizi
                      </label>
                      <input
                        type="text"
                        value={menuToday.qcStatus || ''}
                        onChange={e => setConfig(prev => ({
                          ...prev,
                          menuToday: {
                            ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday),
                            qcStatus: e.target.value
                          }
                        }))}
                        placeholder="Contoh: Terverifikasi Ahli Gizi SPPG • Lolos Uji Organoleptik"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Ringkasan Makronutrisi Sajian */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Kandungan Gizi Makro Rata-Rata
                      </h3>
                      <p className="text-[11px] text-slate-600">
                        Akumulasi nutrisi per porsi standar rekomendasi Badan Gizi Nasional
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kalori Rata-Rata</label>
                      <input
                        type="text"
                        value={menuToday.energySummary.caloriesAvg}
                        onChange={e => setConfig(prev => ({
                          ...prev,
                          menuToday: {
                            ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday),
                            energySummary: {
                              ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday).energySummary,
                              caloriesAvg: e.target.value
                            }
                          }
                        }))}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Protein Rata-Rata</label>
                      <input
                        type="text"
                        value={menuToday.energySummary.proteinAvg}
                        onChange={e => setConfig(prev => ({
                          ...prev,
                          menuToday: {
                            ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday),
                            energySummary: {
                              ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday).energySummary,
                              proteinAvg: e.target.value
                            }
                          }
                        }))}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Karbohidrat Rata-Rata</label>
                      <input
                        type="text"
                        value={menuToday.energySummary.carbsAvg}
                        onChange={e => setConfig(prev => ({
                          ...prev,
                          menuToday: {
                            ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday),
                            energySummary: {
                              ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday).energySummary,
                              carbsAvg: e.target.value
                            }
                          }
                        }))}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Lemak Sehat</label>
                      <input
                        type="text"
                        value={menuToday.energySummary.fatAvg}
                        onChange={e => setConfig(prev => ({
                          ...prev,
                          menuToday: {
                            ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday),
                            energySummary: {
                              ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday).energySummary,
                              fatAvg: e.target.value
                            }
                          }
                        }))}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Serat Pangan</label>
                      <input
                        type="text"
                        value={menuToday.energySummary.fiberAvg}
                        onChange={e => setConfig(prev => ({
                          ...prev,
                          menuToday: {
                            ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday),
                            energySummary: {
                              ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday).energySummary,
                              fiberAvg: e.target.value
                            }
                          }
                        }))}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-800"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Kolom Kanan: Porsi Kecil vs Porsi Besar */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-5">
                  <div className="pb-3 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-900">
                      Standar Porsi: Porsi Kecil vs Porsi Besar
                    </h3>
                    <p className="text-[11px] text-slate-600">
                      Pengaturan takaran yang berubah secara interaktif pada tombol toggle di halaman publik
                    </p>
                  </div>

                  {/* Porsi Kecil */}
                  <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-900">1. Konfigurasi Porsi Kecil</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-200 text-emerald-800 font-semibold">
                        PAUD & SD 1-3
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="block text-[11px] text-slate-600 mb-0.5">Label Kategori</label>
                        <input
                          type="text"
                          value={menuToday.portionSmall.tierName}
                          onChange={e => setConfig(prev => ({
                            ...prev,
                            menuToday: {
                              ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday),
                              portionSmall: {
                                ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday).portionSmall,
                                tierName: e.target.value
                              }
                            }
                          }))}
                          className="w-full px-2 py-1 rounded border border-slate-300 text-xs bg-white text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-600 mb-0.5">Total Gramatur</label>
                        <input
                          type="text"
                          value={menuToday.portionSmall.totalGramature}
                          onChange={e => setConfig(prev => ({
                            ...prev,
                            menuToday: {
                              ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday),
                              portionSmall: {
                                ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday).portionSmall,
                                totalGramature: e.target.value
                              }
                            }
                          }))}
                          className="w-full px-2 py-1 rounded border border-slate-300 text-xs bg-white text-slate-800"
                        />
                      </div>
                    </div>

                    <div className="text-xs">
                      <label className="block text-[11px] text-slate-600 mb-0.5">Target Kalori</label>
                      <input
                        type="text"
                        value={menuToday.portionSmall.targetCalories}
                        onChange={e => setConfig(prev => ({
                          ...prev,
                          menuToday: {
                            ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday),
                            portionSmall: {
                              ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday).portionSmall,
                              targetCalories: e.target.value
                            }
                          }
                        }))}
                        className="w-full px-2 py-1 rounded border border-slate-300 text-xs bg-white text-slate-800"
                      />
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 text-xs">
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">Protein</label>
                        <input
                          type="text"
                          value={menuToday.portionSmall.proteinGrams}
                          onChange={e => setConfig(prev => ({
                            ...prev,
                            menuToday: {
                              ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday),
                              portionSmall: {
                                ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday).portionSmall,
                                proteinGrams: e.target.value
                              }
                            }
                          }))}
                          className="w-full px-1.5 py-1 rounded border border-slate-300 text-xs bg-white text-slate-800 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">Karbo</label>
                        <input
                          type="text"
                          value={menuToday.portionSmall.carbGrams}
                          onChange={e => setConfig(prev => ({
                            ...prev,
                            menuToday: {
                              ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday),
                              portionSmall: {
                                ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday).portionSmall,
                                carbGrams: e.target.value
                              }
                            }
                          }))}
                          className="w-full px-1.5 py-1 rounded border border-slate-300 text-xs bg-white text-slate-800 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">Lemak</label>
                        <input
                          type="text"
                          value={menuToday.portionSmall.fatGrams}
                          onChange={e => setConfig(prev => ({
                            ...prev,
                            menuToday: {
                              ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday),
                              portionSmall: {
                                ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday).portionSmall,
                                fatGrams: e.target.value
                              }
                            }
                          }))}
                          className="w-full px-1.5 py-1 rounded border border-slate-300 text-xs bg-white text-slate-800 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">Serat</label>
                        <input
                          type="text"
                          value={menuToday.portionSmall.fiberGrams}
                          onChange={e => setConfig(prev => ({
                            ...prev,
                            menuToday: {
                              ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday),
                              portionSmall: {
                                ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday).portionSmall,
                                fiberGrams: e.target.value
                              }
                            }
                          }))}
                          className="w-full px-1.5 py-1 rounded border border-slate-300 text-xs bg-white text-slate-800 font-mono"
                        />
                      </div>
                    </div>

                    <div className="text-xs">
                      <label className="block text-[11px] text-slate-600 mb-0.5">Uraian / Pedoman Porsi Kecil</label>
                      <textarea
                        rows={2}
                        value={menuToday.portionSmall.description}
                        onChange={e => setConfig(prev => ({
                          ...prev,
                          menuToday: {
                            ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday),
                            portionSmall: {
                              ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday).portionSmall,
                              description: e.target.value
                            }
                          }
                        }))}
                        className="w-full px-2 py-1 rounded border border-slate-300 text-xs bg-white text-slate-800"
                      />
                    </div>
                  </div>

                  {/* Porsi Besar */}
                  <div className="p-4 rounded-lg border border-sky-200 bg-sky-50/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-sky-900">2. Konfigurasi Porsi Besar</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-sky-200 text-sky-800 font-semibold">
                        SD 4-6 & SMP
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="block text-[11px] text-slate-600 mb-0.5">Label Kategori</label>
                        <input
                          type="text"
                          value={menuToday.portionLarge.tierName}
                          onChange={e => setConfig(prev => ({
                            ...prev,
                            menuToday: {
                              ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday),
                              portionLarge: {
                                ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday).portionLarge,
                                tierName: e.target.value
                              }
                            }
                          }))}
                          className="w-full px-2 py-1 rounded border border-slate-300 text-xs bg-white text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-600 mb-0.5">Total Gramatur</label>
                        <input
                          type="text"
                          value={menuToday.portionLarge.totalGramature}
                          onChange={e => setConfig(prev => ({
                            ...prev,
                            menuToday: {
                              ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday),
                              portionLarge: {
                                ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday).portionLarge,
                                totalGramature: e.target.value
                              }
                            }
                          }))}
                          className="w-full px-2 py-1 rounded border border-slate-300 text-xs bg-white text-slate-800"
                        />
                      </div>
                    </div>

                    <div className="text-xs">
                      <label className="block text-[11px] text-slate-600 mb-0.5">Target Kalori</label>
                      <input
                        type="text"
                        value={menuToday.portionLarge.targetCalories}
                        onChange={e => setConfig(prev => ({
                          ...prev,
                          menuToday: {
                            ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday),
                            portionLarge: {
                              ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday).portionLarge,
                              targetCalories: e.target.value
                            }
                          }
                        }))}
                        className="w-full px-2 py-1 rounded border border-slate-300 text-xs bg-white text-slate-800"
                      />
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 text-xs">
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">Protein</label>
                        <input
                          type="text"
                          value={menuToday.portionLarge.proteinGrams}
                          onChange={e => setConfig(prev => ({
                            ...prev,
                            menuToday: {
                              ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday),
                              portionLarge: {
                                ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday).portionLarge,
                                proteinGrams: e.target.value
                              }
                            }
                          }))}
                          className="w-full px-1.5 py-1 rounded border border-slate-300 text-xs bg-white text-slate-800 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">Karbo</label>
                        <input
                          type="text"
                          value={menuToday.portionLarge.carbGrams}
                          onChange={e => setConfig(prev => ({
                            ...prev,
                            menuToday: {
                              ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday),
                              portionLarge: {
                                ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday).portionLarge,
                                carbGrams: e.target.value
                              }
                            }
                          }))}
                          className="w-full px-1.5 py-1 rounded border border-slate-300 text-xs bg-white text-slate-800 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">Lemak</label>
                        <input
                          type="text"
                          value={menuToday.portionLarge.fatGrams}
                          onChange={e => setConfig(prev => ({
                            ...prev,
                            menuToday: {
                              ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday),
                              portionLarge: {
                                ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday).portionLarge,
                                fatGrams: e.target.value
                              }
                            }
                          }))}
                          className="w-full px-1.5 py-1 rounded border border-slate-300 text-xs bg-white text-slate-800 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">Serat</label>
                        <input
                          type="text"
                          value={menuToday.portionLarge.fiberGrams}
                          onChange={e => setConfig(prev => ({
                            ...prev,
                            menuToday: {
                              ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday),
                              portionLarge: {
                                ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday).portionLarge,
                                fiberGrams: e.target.value
                              }
                            }
                          }))}
                          className="w-full px-1.5 py-1 rounded border border-slate-300 text-xs bg-white text-slate-800 font-mono"
                        />
                      </div>
                    </div>

                    <div className="text-xs">
                      <label className="block text-[11px] text-slate-600 mb-0.5">Uraian / Pedoman Porsi Besar</label>
                      <textarea
                        rows={2}
                        value={menuToday.portionLarge.description}
                        onChange={e => setConfig(prev => ({
                          ...prev,
                          menuToday: {
                            ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday),
                            portionLarge: {
                              ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday).portionLarge,
                              description: e.target.value
                            }
                          }
                        }))}
                        className="w-full px-2 py-1 rounded border border-slate-300 text-xs bg-white text-slate-800"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Komposisi Bahan & Manfaat Kesehatan */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Bahan Pangan, Kandungan Gizi & Manfaat Kesehatan ({menuToday.ingredients.length} Bahan)
                  </h3>
                  <p className="text-[11px] text-slate-600">
                    Rincian tiap komponen makanan yang ditampilkan dengan foto, takaran gramatur, dan manfaat kognitif bagi anak
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenAddIngredient}
                  className={`${BTN_PRIMARY} self-start sm:self-auto`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Bahan Pangan</span>
                </button>
              </div>

              {/* Grid Kartu Bahan */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {menuToday.ingredients.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-lg border border-slate-200 bg-slate-50/40 hover:bg-white hover:border-emerald-300 transition-all space-y-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          onError={e => {
                            (e.currentTarget as HTMLImageElement).src = IMAGE_PRESETS[1].url;
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 capitalize">
                            {item.category.replace('_', ' ')}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">#{idx + 1}</span>
                        </div>
                        <h4 className="font-semibold text-xs text-slate-900 truncate mt-1">
                          {item.name}
                        </h4>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Pemasok: {item.supplier || 'Mitra Lokal SPPG'}
                        </div>
                      </div>
                    </div>

                    {/* Takaran Porsi */}
                    <div className="grid grid-cols-2 gap-2 text-[10px] bg-white p-2 rounded-lg border border-slate-100">
                      <div>
                        <span className="text-slate-400 block">Porsi Kecil:</span>
                        <span className="font-medium text-slate-800">{item.portionSmall}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Porsi Besar:</span>
                        <span className="font-medium text-slate-800">{item.portionLarge}</span>
                      </div>
                    </div>

                    {/* Manfaat Kesehatan & Kandungan Gizi */}
                    <div className="space-y-1.5 text-[11px]">
                      <div>
                        <span className="text-[10px] font-semibold text-emerald-800 block">Kandungan Gizi:</span>
                        <span className="text-[11px] text-slate-700 font-medium">
                          {item.nutritionHighlight}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-emerald-800 block">Manfaat:</span>
                        <p className="text-[11px] text-slate-600 line-clamp-2 leading-tight">
                          {item.healthBenefits}
                        </p>
                      </div>
                    </div>

                    {/* Tombol Aksi Bahan */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveIngredient(idx, 'up')}
                          disabled={idx === 0}
                          className={`${ICON_BTN} text-slate-600 hover:bg-slate-100`}
                          aria-label="Naikkan urutan"
                          title="Naikkan urutan"
                        >
                          <ChevronLeft className="w-3.5 h-3.5 rotate-90" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveIngredient(idx, 'down')}
                          disabled={idx === menuToday.ingredients.length - 1}
                          className={`${ICON_BTN} text-slate-600 hover:bg-slate-100`}
                          aria-label="Turunkan urutan"
                          title="Turunkan urutan"
                        >
                          <ChevronRight className="w-3.5 h-3.5 rotate-90" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditIngredient(item)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteIngredient(item.id)}
                          className={`${ICON_BTN} text-rose-600 hover:bg-rose-50`}
                          aria-label="Hapus bahan"
                          title="Hapus bahan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Konten edukasi anak: Pahlawan Gizi & Kebiasaan Baik */}
            <MenuTodayKidsEditor
              menuToday={menuToday}
              onNotify={showNotification}
              onChange={patch => setConfig(prev => ({
                ...prev,
                menuToday: {
                  ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday),
                  ...patch
                }
              }))}
            />

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
      {isIngredientModalOpen && editingIngredient && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-xl w-full p-4 sm:p-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Apple className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">
                  {(config.menuToday?.ingredients || []).some(x => x.id === editingIngredient.id) ? 'Edit Bahan Pangan' : 'Tambah Bahan Pangan'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsIngredientModalOpen(false)}
                className={`${ICON_BTN} text-slate-500 hover:text-slate-800 hover:bg-slate-100`}
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Foto Bahan */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Foto Bahan Pangan
                </label>
                <div className="flex items-start gap-3">
                  <div className="w-24 h-20 rounded-lg bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
                    {ingredientImagePreview ? (
                      <img src={ingredientImagePreview} alt="Preview Bahan" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 text-[10px]">
                        Belum ada foto
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input
                      type="file"
                      ref={ingredientFileRef}
                      accept="image/*"
                      onChange={handleUploadIngredientPhoto}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => ingredientFileRef.current?.click()}
                      disabled={isUploadingIngredientImg}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 font-semibold cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingIngredientImg ? 'Memproses...' : 'Unggah Foto Bahan'}</span>
                    </button>
                    <div className="text-[10px] text-slate-500">
                      Pilihan foto preset:
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {IMAGE_PRESETS.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setIngredientImagePreview(p.url);
                            setEditingIngredient(prev => prev ? { ...prev, imageUrl: p.url } : null);
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] border cursor-pointer ${
                            ingredientImagePreview === p.url
                              ? 'bg-emerald-700 text-white border-emerald-700'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {p.label.split('(')[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Nama & Kategori Bahan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama Bahan Pangan</label>
                  <input
                    type="text"
                    value={editingIngredient.name}
                    onChange={e => setEditingIngredient(prev => prev ? { ...prev, name: e.target.value } : null)}
                    placeholder="Contoh: Ayam Ungkep Bumbu Kuning"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kategori Gizi Bahan</label>
                  <select
                    value={editingIngredient.category}
                    onChange={e => setEditingIngredient(prev => prev ? { ...prev, category: e.target.value as any } : null)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 cursor-pointer"
                  >
                    <option value="karbohidrat">Karbohidrat (Nasi, Ubi, Kentang)</option>
                    <option value="protein_hewani">Protein Hewani (Ayam, Ikan, Telur, Daging)</option>
                    <option value="protein_nabati">Protein Nabati (Tempe, Tahu, Kacang)</option>
                    <option value="sayuran">Sayuran (Wortel, Buncis, Bayam, Sop)</option>
                    <option value="buah">Buah-buahan (Pisang, Jeruk, Semangka)</option>
                    <option value="pelengkap">Pelengkap (Susu, Biji-bijian)</option>
                  </select>
                </div>
              </div>

              {/* Takaran Porsi Kecil vs Porsi Besar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50">
                  <label className="block font-semibold text-emerald-900 mb-1">Takaran Porsi Kecil (PAUD & SD 1-3)</label>
                  <input
                    type="text"
                    value={editingIngredient.portionSmall}
                    onChange={e => setEditingIngredient(prev => prev ? { ...prev, portionSmall: e.target.value } : null)}
                    placeholder="Contoh: 50 gram (1 potong sedang)"
                    className="w-full px-2.5 py-1.5 rounded border border-slate-300 text-slate-800 bg-white"
                  />
                </div>
                <div className="p-2.5 rounded-lg border border-sky-200 bg-sky-50/50">
                  <label className="block font-semibold text-sky-900 mb-1">Takaran Porsi Besar (SD 4-6 & SMP)</label>
                  <input
                    type="text"
                    value={editingIngredient.portionLarge}
                    onChange={e => setEditingIngredient(prev => prev ? { ...prev, portionLarge: e.target.value } : null)}
                    placeholder="Contoh: 80 gram (1 potong dada/paha)"
                    className="w-full px-2.5 py-1.5 rounded border border-slate-300 text-slate-800 bg-white"
                  />
                </div>
              </div>

              {/* Nilai Gizi Utama & Highlight */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Kandungan Gizi Utama (Highlight)
                </label>
                <input
                  type="text"
                  value={editingIngredient.nutritionHighlight}
                  onChange={e => setEditingIngredient(prev => prev ? { ...prev, nutritionHighlight: e.target.value } : null)}
                  placeholder="Contoh: Protein hewani murni, Vitamin B12, Zink, Zat Besi"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                />
              </div>

              {/* Manfaat Kesehatan */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Manfaat Kesehatan & Belajar Anak
                </label>
                <textarea
                  rows={2}
                  value={editingIngredient.healthBenefits}
                  onChange={e => setEditingIngredient(prev => prev ? { ...prev, healthBenefits: e.target.value } : null)}
                  placeholder="Contoh: Mendukung perkembangan massa otot anak, menjaga fokus belajar di kelas, dan mencegah anemia."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                />
              </div>

              {/* Konten anak di halaman publik */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Mengapa baik untukmu? (satu poin per baris, opsional)
                </label>
                <textarea
                  rows={3}
                  value={(editingIngredient.whyGood || []).join('\n')}
                  onChange={e => setEditingIngredient(prev => prev ? { ...prev, whyGood: e.target.value.split('\n') } : null)}
                  placeholder="Kosongkan untuk memakai kalimat dari Manfaat Kesehatan"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tahukah kamu? (opsional)
                </label>
                <input
                  type="text"
                  value={editingIngredient.funFact || ''}
                  onChange={e => setEditingIngredient(prev => prev ? { ...prev, funFact: e.target.value } : null)}
                  placeholder="Kosongkan untuk menyembunyikan kotak ini"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                />
              </div>

              {/* Pemasok & Catatan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Asal / Pemasok Bahan</label>
                  <input
                    type="text"
                    value={editingIngredient.supplier}
                    onChange={e => setEditingIngredient(prev => prev ? { ...prev, supplier: e.target.value } : null)}
                    placeholder="Contoh: Kemitraan Peternak Unggas Tumpang"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Catatan Tambahan (Opsional)</label>
                  <input
                    type="text"
                    value={editingIngredient.notes || ''}
                    onChange={e => setEditingIngredient(prev => prev ? { ...prev, notes: e.target.value } : null)}
                    placeholder="Contoh: Diungkep perlahan tanpa minyak berlebih"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                  />
                </div>
              </div>

              {/* Tombol Aksi */}
              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsIngredientModalOpen(false)}
                  className={`${BTN_SECONDARY}`}
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveIngredient}
                  className={`${BTN_PRIMARY}`}
                >
                  Simpan Bahan
                </button>
              </div>
            </div>
          </div>
        </div>
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

      {/* Bar bawah: selalu terlihat walau halaman digulir jauh dari tombol Simpan di header */}
      {isDirty && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4 pointer-events-none no-print">
          <div className="max-w-3xl mx-auto pointer-events-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-slate-900 text-white">
            <p className="text-xs">
              <span className="font-semibold">Ada perubahan yang belum disimpan.</span>{' '}
              <span className="text-slate-300">Website publik belum berubah sampai kamu klik Simpan.</span>
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDiscardChanges}
                disabled={isCloudSaving}
                className={`px-3 py-2 min-h-[44px] sm:min-h-[34px] rounded-lg text-xs font-semibold text-slate-200 hover:text-white hover:bg-white/10 cursor-pointer disabled:opacity-50 ${FOCUS}`}
              >
                Batalkan
              </button>
              <button type="button" onClick={handleSaveAll} disabled={isCloudSaving} className={BTN_PRIMARY}>
                <Save className="w-4 h-4" />
                {isCloudSaving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
