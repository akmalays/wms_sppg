import React, { useState, useEffect, useRef } from 'react';
import {
  WebsiteConfig,
  HeroVideoItem,
  MenuSlideItem,
  VisualStudyItem,
  HeroDocumentationSlide,
  IngredientNutritionInfo,
  PortionTierConfig,
  WebsiteMenuTodayConfig,
  DEFAULT_WEBSITE_CONFIG,
  getWebsiteConfig,
  saveWebsiteConfig,
  saveWebsiteConfigToCloud,
  fetchWebsiteConfigFromCloud,
  uploadCmsMedia,
  VIDEO_PRESETS,
  IMAGE_PRESETS
} from '../db/websiteConfigStorage';
import QRCode from 'qrcode';
import { MenuTodayKidsEditor } from './MenuTodayKidsEditor';
import { compressImageToWebP } from '../utils/imageCompressor';
import {
  Globe,
  Video,
  Image as ImageIcon,
  Sliders,
  Play,
  Pause,
  Plus,
  Trash2,
  Edit2,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Upload,
  Sparkles,
  Layers,
  UtensilsCrossed,
  FileText,
  Volume2,
  VolumeX,
  Eye,
  Info,
  Clock,
  Check,
  X,
  Cloud,
  Database,
  Download,
  UploadCloud,
  RefreshCw,
  HardDrive,
  QrCode,
  Printer,
  Copy,
  PlusCircle,
  Apple,
  Share2
} from 'lucide-react';

interface WebsiteCmsModuleProps {
  onViewLanding?: () => void;
}

export const WebsiteCmsModule: React.FC<WebsiteCmsModuleProps> = ({ onViewLanding }) => {
  const [config, setConfig] = useState<WebsiteConfig>(getWebsiteConfig);
  const [activeTab, setActiveTab] = useState<'hero' | 'menu' | 'visual' | 'menu_today'>('hero');
  const [isSavedAlert, setIsSavedAlert] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const [isCloudSaving, setIsCloudSaving] = useState(false);

  // State untuk editing Menu Slide
  const [editingMenuSlide, setEditingMenuSlide] = useState<MenuSlideItem | null>(null);
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [menuImagePreview, setMenuImagePreview] = useState<string>('');
  const [isUploadingMenuImg, setIsUploadingMenuImg] = useState(false);

  // State untuk editing Visual Study Item
  const [editingVisualItem, setEditingVisualItem] = useState<VisualStudyItem | null>(null);
  const [isVisualModalOpen, setIsVisualModalOpen] = useState(false);
  const [visualImagePreview, setVisualImagePreview] = useState<string>('');
  const [isUploadingVisualImg, setIsUploadingVisualImg] = useState(false);

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

  // Video preview testing
  const [isVideoUploading, setIsVideoUploading] = useState(false);
  const videoFileRef = useRef<HTMLInputElement>(null);
  const menuFileRef = useRef<HTMLInputElement>(null);
  const visualFileRef = useRef<HTMLInputElement>(null);

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
      if (res.fromCloud) {
        setConfig(res.config);
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

  const showNotification = (msg: string) => {
    setSaveMessage(msg);
    setIsSavedAlert(true);
    setTimeout(() => setIsSavedAlert(false), 3500);
  };

  const handleSaveAll = async () => {
    setIsCloudSaving(true);
    try {
      const res = await saveWebsiteConfigToCloud(config);
      showNotification(res.message);
    } catch {
      showNotification('Konfigurasi disimpan di cache lokal browser.');
    } finally {
      setIsCloudSaving(false);
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
      alert('Tautan/file video wajib diisi.');
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
    showNotification(`Video "${editingHeroVideo.title}" berhasil disimpan ke playlist loop!`);
  };

  const handleDeleteHeroVideo = (id: string) => {
    const curVideos = config.hero.videos || [];
    if (curVideos.length <= 1) {
      alert('Minimal harus ada 1 video dalam playlist hero.');
      return;
    }
    if (window.confirm('Hapus video ini dari playlist putar hero?')) {
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
      alert('Mohon pilih file video yang valid (.mp4, .webm).');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      alert('Ukuran video terlalu besar (maksimal 50 MB). Disarankan video ringkas berdurasi 10–30 detik.');
      return;
    }

    setIsUploadingHeroVideo(true);
    try {
      const result = await uploadCmsMedia(file, 'hero');
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

      if (result.isCloudStorage) {
        showNotification(`Video "${newVid.title}" (${result.finalSizeKb} KB) berhasil diunggah ke Cloud Storage & ditambahkan ke playlist loop!`);
      } else {
        showNotification(`Video "${newVid.title}" berhasil ditambahkan ke playlist loop (tersimpan lokal).`);
      }
    } catch (err) {
      console.error(err);
      alert('Gagal mengunggah file video.');
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
      alert('Mohon pilih file video yang valid (.mp4, .webm).');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      alert('Ukuran video maksimal 50 MB.');
      return;
    }

    setIsUploadingHeroVideo(true);
    try {
      const result = await uploadCmsMedia(file, 'hero');
      setEditingHeroVideo(prev => prev ? { ...prev, url: result.url } : null);
      if (result.isCloudStorage) {
        showNotification(`Video baru berhasil diunggah ke Supabase Storage!`);
      } else {
        showNotification(result.warning || 'Video disimpan secara lokal.');
      }
    } catch {
      alert('Gagal mengunggah file video.');
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

    showNotification(`Preset "${newVid.title}" ditambahkan ke playlist loop video!`);
  };

  // Hero Photo Slides CRUD Handlers (Dokumentasi Kotak Kanan Landing Page)
  const handleOpenAddHeroSlide = () => {
    const newSlide: HeroDocumentationSlide = {
      id: `hero-photo-${Date.now()}`,
      title: 'Sajian Nampan MBG Bersekat SUS 304',
      category: 'Standar Wadah Higienis',
      description: 'Pemisahan higienis antar lauk tanpa risiko bercampur kuah. Wadah stainless steel SUS 304 standar food-grade.',
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
      alert('Judul foto dokumentasi wajib diisi.');
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
    showNotification(`Slide foto "${updatedSlide.title}" berhasil diperbarui! Klik Simpan Semua Perubahan.`);
  };

  const handleDeleteHeroSlide = (id: string) => {
    const currentSlides = config.hero.photoSlides && config.hero.photoSlides.length > 0
      ? config.hero.photoSlides
      : (DEFAULT_WEBSITE_CONFIG.hero.photoSlides || []);
    if (currentSlides.length <= 1) {
      alert('Minimal harus ada 1 slide foto dokumentasi yang aktif di kotak hero.');
      return;
    }
    if (window.confirm('Hapus slide foto dokumentasi ini dari kotak hero landing page?')) {
      setConfig(prev => ({
        ...prev,
        hero: {
          ...prev.hero,
          photoSlides: (prev.hero.photoSlides || DEFAULT_WEBSITE_CONFIG.hero.photoSlides || []).filter(s => s.id !== id)
        }
      }));
      showNotification('Slide foto dokumentasi hero dihapus.');
    }
  };

  const handleMoveHeroSlide = (idx: number, direction: 'up' | 'down') => {
    const currentSlides = [...(config.hero.photoSlides || DEFAULT_WEBSITE_CONFIG.hero.photoSlides || [])];
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
      if (result.isCloudStorage) {
        showNotification(`Foto berhasil diunggah ke Supabase Storage (${result.finalSizeKb} KB)!`);
      } else {
        showNotification(result.warning || 'Foto disimpan secara lokal di browser.');
      }
    } catch {
      alert('Gagal mengunggah foto slide hero.');
    } finally {
      setIsUploadingHeroSlideImg(false);
      if (e.target) e.target.value = '';
    }
  };

  // Video Upload Handler Legacy (Fallback)
  const handleVideoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      alert('Mohon pilih file video yang valid (.mp4, .webm).');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      alert('Ukuran video terlalu besar (maksimal 50 MB). Disarankan menggunakan video ringkas atau tautan URL CDN.');
      return;
    }

    setIsVideoUploading(true);
    try {
      const result = await uploadCmsMedia(file, 'hero');
      setConfig(prev => ({
        ...prev,
        hero: {
          ...prev.hero,
          videoUrl: result.url,
          backgroundType: 'video'
        }
      }));
      if (result.isCloudStorage) {
        showNotification(`Video hero (${result.finalSizeKb} KB) berhasil diunggah ke Supabase Object Storage!`);
      } else {
        showNotification(result.warning || 'Video disimpan secara lokal di browser.');
      }
    } catch (err) {
      console.error(err);
      alert('Gagal mengunggah file video ke storage.');
    } finally {
      setIsVideoUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  // Menu Image Upload Handler (Kompres WebP otomatis + Upload Supabase Storage)
  const handleMenuImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingMenuImg(true);
      const result = await uploadCmsMedia(file, 'menu');
      setMenuImagePreview(result.url);
      if (editingMenuSlide) {
        setEditingMenuSlide(prev => prev ? { ...prev, imageUrl: result.url } : null);
      }
      if (result.isCloudStorage) {
        showNotification(`Foto menu dikompresi ke WebP (${result.finalSizeKb} KB) & disimpan di Supabase Storage!`);
      } else if (result.warning) {
        showNotification(result.warning);
      }
    } catch (err) {
      console.error(err);
      alert('Gagal memproses gambar menu.');
    } finally {
      setIsUploadingMenuImg(false);
      if (e.target) e.target.value = '';
    }
  };

  // Visual Study Image Upload Handler (Kompres WebP otomatis + Upload Supabase Storage)
  const handleVisualImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingVisualImg(true);
      const result = await uploadCmsMedia(file, 'visual');
      setVisualImagePreview(result.url);
      if (editingVisualItem) {
        setEditingVisualItem(prev => prev ? { ...prev, imageUrl: result.url } : null);
      }
      if (result.isCloudStorage) {
        showNotification(`Foto kajian dikompresi ke WebP (${result.finalSizeKb} KB) & disimpan di Supabase Storage!`);
      } else if (result.warning) {
        showNotification(result.warning);
      }
    } catch (err) {
      console.error(err);
      alert('Gagal memproses gambar dokumentasi.');
    } finally {
      setIsUploadingVisualImg(false);
      if (e.target) e.target.value = '';
    }
  };

  // Menu Slide Crud
  const handleOpenAddMenu = () => {
    const newSlide: MenuSlideItem = {
      id: `menu-${Date.now()}`,
      title: 'Menu Porsi Baru MBG',
      day: 'Senin',
      category: 'Paket Porsi Lengkap MBG',
      calories: '650 kkal • Protein 25g',
      imageUrl: IMAGE_PRESETS[0].url,
      description: 'Deskripsi menu lengkap porsi bergizi seimbang dengan takaran karbohidrat, protein hewani, protein nabati, sayuran, dan buah segar.',
      targetGrams: '460 gram',
      allergens: 'Halal • Bersih Berstandar'
    };
    setEditingMenuSlide(newSlide);
    setMenuImagePreview(newSlide.imageUrl);
    setIsMenuModalOpen(true);
  };

  const handleOpenEditMenu = (slide: MenuSlideItem) => {
    setEditingMenuSlide({ ...slide });
    setMenuImagePreview(slide.imageUrl);
    setIsMenuModalOpen(true);
  };

  const handleSaveMenuSlide = () => {
    if (!editingMenuSlide) return;
    if (!editingMenuSlide.title.trim()) {
      alert('Judul menu wajib diisi.');
      return;
    }

    const updatedSlide = {
      ...editingMenuSlide,
      imageUrl: menuImagePreview || editingMenuSlide.imageUrl
    };

    setConfig(prev => {
      const exists = prev.menuSlider.slides.some(s => s.id === updatedSlide.id);
      const slides = exists
        ? prev.menuSlider.slides.map(s => s.id === updatedSlide.id ? updatedSlide : s)
        : [...prev.menuSlider.slides, updatedSlide];
      return {
        ...prev,
        menuSlider: {
          ...prev.menuSlider,
          slides
        }
      };
    });

    setIsMenuModalOpen(false);
    setEditingMenuSlide(null);
    showNotification(`Slide menu "${updatedSlide.title}" berhasil diperbarui! Jangan lupa klik Simpan Semua Perubahan.`);
  };

  const handleDeleteMenuSlide = (id: string) => {
    if (config.menuSlider.slides.length <= 1) {
      alert('Minimal harus ada 1 slide menu yang aktif di website.');
      return;
    }
    if (window.confirm('Hapus slide menu ini dari website?')) {
      setConfig(prev => ({
        ...prev,
        menuSlider: {
          ...prev.menuSlider,
          slides: prev.menuSlider.slides.filter(s => s.id !== id)
        }
      }));
      showNotification('Slide menu dihapus.');
    }
  };

  const handleMoveMenuSlide = (idx: number, direction: 'up' | 'down') => {
    const slides = [...config.menuSlider.slides];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= slides.length) return;
    const temp = slides[idx];
    slides[idx] = slides[targetIdx];
    slides[targetIdx] = temp;
    setConfig(prev => ({
      ...prev,
      menuSlider: { ...prev.menuSlider, slides }
    }));
  };

  // Visual Study Crud
  const handleOpenAddVisual = () => {
    const newItem: VisualStudyItem = {
      id: `vis-${Date.now()}`,
      title: 'Dokumentasi Nampan / Fasilitas Baru',
      category: 'Standar Higienitas',
      description: 'Keterangan pengujian sampel atau penataan nampan di fasilitas dapur SPPG MLG TUMPANG JERU.',
      imageUrl: IMAGE_PRESETS[2].url,
      date: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
      badge: 'Inspeksi Tim QC'
    };
    setEditingVisualItem(newItem);
    setVisualImagePreview(newItem.imageUrl);
    setIsVisualModalOpen(true);
  };

  const handleOpenEditVisual = (item: VisualStudyItem) => {
    setEditingVisualItem({ ...item });
    setVisualImagePreview(item.imageUrl);
    setIsVisualModalOpen(true);
  };

  const handleSaveVisualItem = () => {
    if (!editingVisualItem) return;
    if (!editingVisualItem.title.trim()) {
      alert('Judul dokumentasi wajib diisi.');
      return;
    }

    const updatedItem = {
      ...editingVisualItem,
      imageUrl: visualImagePreview || editingVisualItem.imageUrl
    };

    setConfig(prev => {
      const exists = prev.visualStudy.items.some(i => i.id === updatedItem.id);
      const items = exists
        ? prev.visualStudy.items.map(i => i.id === updatedItem.id ? updatedItem : i)
        : [...prev.visualStudy.items, updatedItem];
      return {
        ...prev,
        visualStudy: {
          ...prev.visualStudy,
          items
        }
      };
    });

    setIsVisualModalOpen(false);
    setEditingVisualItem(null);
    showNotification(`Kajian visual "${updatedItem.title}" berhasil diperbarui!`);
  };

  const handleDeleteVisualItem = (id: string) => {
    if (config.visualStudy.items.length <= 1) {
      alert('Minimal harus ada 1 foto kajian visual yang aktif di website.');
      return;
    }
    if (window.confirm('Hapus foto kajian visual ini dari website?')) {
      setConfig(prev => ({
        ...prev,
        visualStudy: {
          ...prev.visualStudy,
          items: prev.visualStudy.items.filter(i => i.id !== id)
        }
      }));
      showNotification('Foto kajian visual dihapus.');
    }
  };

  const handleMoveVisualItem = (idx: number, direction: 'up' | 'down') => {
    const items = [...config.visualStudy.items];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= items.length) return;
    const temp = items[idx];
    items[idx] = items[targetIdx];
    items[targetIdx] = temp;
    setConfig(prev => ({
      ...prev,
      visualStudy: { ...prev.visualStudy, items }
    }));
  };

  // Helper & Handler untuk Menu MBG Hari Ini & QR Code
  const handleCopyQrLink = () => {
    const targetUrl = `${window.location.origin}/menu-mbg-hari-ini`;
    navigator.clipboard.writeText(targetUrl);
    setCopiedQrLink(true);
    setTimeout(() => setCopiedQrLink(false), 2200);
    showNotification('Tautan URL publik /menu-mbg-hari-ini berhasil disalin!');
  };

  const handleDownloadQrPng = () => {
    if (!qrCodeDataUrl) return;
    const a = document.createElement('a');
    a.href = qrCodeDataUrl;
    a.download = `qr-code-menu-mbg-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
    showNotification('File gambar QR Code berhasil diunduh (PNG).');
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
      if (result.isCloudStorage) {
        showNotification(`Foto menu hari ini diunggah ke cloud (${result.finalSizeKb} KB)!`);
      } else {
        showNotification('Foto menu hari ini disimpan.');
      }
    } catch {
      alert('Gagal mengunggah foto menu.');
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
      alert('Nama bahan pangan wajib diisi.');
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
    showNotification(`Bahan "${editingIngredient.name}" berhasil disimpan!`);
  };

  const handleDeleteIngredient = (id: string) => {
    const curMenuToday = config.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday;
    if (curMenuToday.ingredients.length <= 1) {
      alert('Minimal harus ada 1 bahan pangan dalam daftar menu hari ini.');
      return;
    }
    if (window.confirm('Hapus bahan pangan ini dari sajian menu hari ini?')) {
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
      if (result.isCloudStorage) {
        showNotification(`Foto bahan diunggah (${result.finalSizeKb} KB)!`);
      } else {
        showNotification('Foto bahan disimpan secara lokal.');
      }
    } catch {
      alert('Gagal mengunggah foto bahan.');
    } finally {
      setIsUploadingIngredientImg(false);
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Konsol CMS */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-900/10 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-900/15">
              <Globe className="w-6 h-6 text-emerald-700" />
            </div>
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Pengaturan Konten Website Publik
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                Kelola video latar belakang hero, rotasi slide foto nampan MBG, dan galeri kajian visual operasional.
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
            {onViewLanding && (
              <button
                type="button"
                onClick={onViewLanding}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-semibold transition-colors cursor-pointer border border-slate-200 shadow-2xs"
                title="Buka pratinjau website publik"
              >
                <Eye className="w-4 h-4 text-emerald-700" />
                <span>Lihat Website</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </button>
            )}

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isCloudSaving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-75 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer border border-emerald-600 active:scale-[0.99]"
            >
              <Save className="w-4 h-4" />
              <span>{isCloudSaving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
            </button>
          </div>
        </div>

        {/* Notifikasi Toast Tersimpan */}
        {isSavedAlert && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{saveMessage}</span>
          </div>
        )}

        {/* Tab Navigasi Sub-Modul */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => setActiveTab('hero')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'hero'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900'
            }`}
          >
            <Video className={`w-4 h-4 ${activeTab === 'hero' ? 'text-emerald-200' : 'text-slate-500'}`} />
            <span>Hero & Video Background</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('menu')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'menu'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900'
            }`}
          >
            <UtensilsCrossed className={`w-4 h-4 ${activeTab === 'menu' ? 'text-emerald-200' : 'text-slate-500'}`} />
            <span>Foto Menu MBG ({config.menuSlider.slides.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('visual')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'visual'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900'
            }`}
          >
            <ImageIcon className={`w-4 h-4 ${activeTab === 'visual' ? 'text-emerald-200' : 'text-slate-500'}`} />
            <span>Kajian Visual Lapangan ({config.visualStudy.items.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('menu_today')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'menu_today'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900'
            }`}
          >
            <QrCode className={`w-4 h-4 ${activeTab === 'menu_today' ? 'text-emerald-200' : 'text-slate-500'}`} />
            <span>Menu Hari Ini & QR Code</span>
          </button>
        </div>
      </div>

      {/* 2. KONTEN TAB 1: HERO & VIDEO BACKGROUND */}
      {activeTab === 'hero' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Kolom Kiri: Konfigurasi Video & Kontrol */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center">
                    <Video className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      Format Latar Hero
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Tampilan utama halaman depan: video gerak sinematik atau foto statis
                    </p>
                  </div>
                </div>

                <div className="flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, hero: { ...prev.hero, backgroundType: 'video' } }))}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                      config.hero.backgroundType === 'video'
                        ? 'bg-[#0c3123] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Video (Aktif)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, hero: { ...prev.hero, backgroundType: 'image' } }))}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                      config.hero.backgroundType === 'image'
                        ? 'bg-[#0c3123] text-white shadow-xs'
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
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-900 font-semibold">
                        {(config.hero.videos || []).length} Video
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-75 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                      title="Unggah file MP4 langsung ke penyimpanan cloud"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingHeroVideo ? 'Mengunggah...' : 'Upload Video'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenAddHeroVideo}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium border border-slate-200 transition-colors cursor-pointer"
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
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
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
                          className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-30 text-slate-600 transition-colors cursor-pointer"
                          title="Geser ke atas"
                        >
                          <ChevronLeft className="w-3.5 h-3.5 rotate-90" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveHeroVideo(idx, 'down')}
                          disabled={idx === (config.hero.videos?.length || 1) - 1}
                          className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-30 text-slate-600 transition-colors cursor-pointer"
                          title="Geser ke bawah"
                        >
                          <ChevronRight className="w-3.5 h-3.5 rotate-90" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditHeroVideo(vid)}
                          className="p-1.5 rounded hover:bg-emerald-100 text-emerald-800 transition-colors cursor-pointer"
                          title="Edit video ini"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteHeroVideo(vid.id)}
                          className="p-1.5 rounded hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                          title="Hapus video dari playlist"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pengaturan Looping & Waktu Transisi Playlist */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-xs text-slate-800">Mode Transisi Video:</span>
                      <p className="text-[11px] text-slate-500">
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

              {/* Teks & Judul Hero Section */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <h4 className="text-xs font-bold text-slate-800">Teks & Narasi Hero</h4>

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
            </div>

            {/* Card Kustomisasi Dokumentasi Slide Foto Hero (Kotak Kanan Landing Page) */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>Slide Foto Hero (Kotak Kanan)</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-900 font-semibold">
                        {(config.hero.photoSlides || DEFAULT_WEBSITE_CONFIG.hero.photoSlides || []).length} Foto
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Foto operasional & sajian nampan yang tampil bergantian di sisi kanan hero
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleOpenAddHeroSlide}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer self-start sm:self-auto shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Foto Slide</span>
                </button>
              </div>

              {/* Pengaturan Auto-Slide & Durasi Detik */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
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
                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                          {slide.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleMoveHeroSlide(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-30 text-slate-600 transition-colors cursor-pointer"
                        title="Geser ke atas"
                      >
                        <ChevronLeft className="w-3.5 h-3.5 rotate-90" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveHeroSlide(idx, 'down')}
                        disabled={idx === (config.hero.photoSlides || DEFAULT_WEBSITE_CONFIG.hero.photoSlides || []).length - 1}
                        className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-30 text-slate-600 transition-colors cursor-pointer"
                        title="Geser ke bawah"
                      >
                        <ChevronRight className="w-3.5 h-3.5 rotate-90" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEditHeroSlide(slide)}
                        className="p-1.5 rounded hover:bg-emerald-100 text-emerald-800 transition-colors cursor-pointer"
                        title="Edit slide foto ini"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteHeroSlide(slide.id)}
                        className="p-1.5 rounded hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                        title="Hapus foto dari slide"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Pratinjau Tampilan Hero */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-md sticky top-24 space-y-4 p-4">
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
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-white/20 backdrop-blur-xs text-white border border-white/30">
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
      )}

      {/* 3. KONTEN TAB 2: FOTO MENU & AUTO-SLIDE */}
      {activeTab === 'menu' && (
        <div className="space-y-6">
          {/* Bar Kontrol Slider Otomatis */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-display text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-700" />
                  <span>Pengaturan Rotasi Menu MBG</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Atur perputaran carousel dan durasi pergantian menu di halaman depan
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Toggle Auto-Slide */}
                <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                  <input
                    type="checkbox"
                    checked={config.menuSlider.autoSlide}
                    onChange={e => setConfig(prev => ({
                      ...prev,
                      menuSlider: { ...prev.menuSlider, autoSlide: e.target.checked }
                    }))}
                    className="w-4 h-4 text-emerald-700 rounded border-slate-300 focus:ring-emerald-600 accent-emerald-700 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    Rotasi {config.menuSlider.autoSlide ? 'Aktif' : 'Nonaktif'}
                  </span>
                </label>

                {/* Interval Detik */}
                <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
                  <span className="text-slate-600 font-medium">Durasi:</span>
                  <select
                    value={config.menuSlider.intervalSeconds}
                    onChange={e => setConfig(prev => ({
                      ...prev,
                      menuSlider: { ...prev.menuSlider, intervalSeconds: parseInt(e.target.value, 10) }
                    }))}
                    className="font-bold text-emerald-800 bg-transparent focus:outline-none cursor-pointer"
                  >
                    <option value={3}>3 Detik</option>
                    <option value={4}>4 Detik</option>
                    <option value={5}>5 Detik</option>
                    <option value={6}>6 Detik</option>
                    <option value={8}>8 Detik</option>
                    <option value={10}>10 Detik</option>
                  </select>
                </div>

                {/* Pause on Hover */}
                <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
                  <input
                    type="checkbox"
                    checked={config.menuSlider.pauseOnHover}
                    onChange={e => setConfig(prev => ({
                      ...prev,
                      menuSlider: { ...prev.menuSlider, pauseOnHover: e.target.checked }
                    }))}
                    className="w-4 h-4 text-emerald-700 rounded border-slate-300 focus:ring-emerald-600 accent-emerald-700 cursor-pointer"
                  />
                  <span className="text-slate-700 font-medium">Jeda Saat Kursor Di Atas Menu</span>
                </label>
              </div>
            </div>

            {/* Judul Seksi Menu */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Judul Seksi di Halaman Depan
                </label>
                <input
                  type="text"
                  value={config.menuSlider.sectionTitle}
                  onChange={e => setConfig(prev => ({
                    ...prev,
                    menuSlider: { ...prev.menuSlider, sectionTitle: e.target.value }
                  }))}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-800 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Subjudul Seksi
                </label>
                <input
                  type="text"
                  value={config.menuSlider.sectionSubtitle}
                  onChange={e => setConfig(prev => ({
                    ...prev,
                    menuSlider: { ...prev.menuSlider, sectionSubtitle: e.target.value }
                  }))}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-800 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Daftar Koleksi Slide Menu */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">
                Koleksi Menu Harian MBG ({config.menuSlider.slides.length} Menu)
              </h3>
              <p className="text-xs text-slate-500">
                Foto dan resep berganti bergantian pada carousel website
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenAddMenu}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Foto Menu Baru</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {config.menuSlider.slides.map((slide, idx) => (
              <div
                key={slide.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs flex flex-col hover:border-slate-300 transition-all group"
              >
                {/* Gambar Menu */}
                <div className="relative aspect-4/3 bg-slate-900 overflow-hidden">
                  <img
                    src={slide.imageUrl}
                    alt={slide.title}
                    className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                  />
                  <div className="absolute top-3 left-3 bg-[#0c3123]/95 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-lg border border-emerald-700/50">
                    {slide.day}
                  </div>
                  <div className="absolute top-3 right-3 bg-white/95 text-slate-900 text-[10px] font-bold px-2 py-0.5 rounded-lg shadow-xs">
                    Slide #{idx + 1}
                  </div>
                </div>

                {/* Deskripsi Menu */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/50 px-2 py-0.5 rounded">
                      {slide.category}
                    </span>
                    <h4 className="font-display text-sm font-bold text-slate-900 mt-1.5 line-clamp-1">
                      {slide.title}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {slide.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="font-mono text-emerald-700 font-bold text-[11px]">
                      {slide.calories}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveMenuSlide(idx, 'up')}
                        disabled={idx === 0}
                        title="Geser urutan lebih dulu"
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 disabled:opacity-30 cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveMenuSlide(idx, 'down')}
                        disabled={idx === config.menuSlider.slides.length - 1}
                        title="Geser urutan setelahnya"
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 disabled:opacity-30 cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEditMenu(slide)}
                        title="Edit Menu"
                        className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-700 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMenuSlide(slide.id)}
                        title="Hapus Menu"
                        className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. KONTEN TAB 3: KAJIAN VISUAL SAJIAN MAKANAN */}
      {activeTab === 'visual' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-display text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-emerald-700" />
                  <span>Pengaturan Kajian Visual Lapangan</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Dokumentasi nampan 5 sekat, pengemasan boks ganda, dan standar higienitas SPPG
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenAddVisual}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Dokumentasi Visual Baru</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Judul Seksi di Halaman Depan
                </label>
                <input
                  type="text"
                  value={config.visualStudy.sectionTitle}
                  onChange={e => setConfig(prev => ({
                    ...prev,
                    visualStudy: { ...prev.visualStudy, sectionTitle: e.target.value }
                  }))}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-800 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Subjudul Seksi
                </label>
                <input
                  type="text"
                  value={config.visualStudy.sectionSubtitle}
                  onChange={e => setConfig(prev => ({
                    ...prev,
                    visualStudy: { ...prev.visualStudy, sectionSubtitle: e.target.value }
                  }))}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-800 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {config.visualStudy.items.map((item, idx) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs flex flex-col hover:border-slate-300 transition-all"
              >
                <div className="relative aspect-4/3 bg-slate-900 overflow-hidden">
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                  {item.badge && (
                    <div className="absolute top-3 left-3 bg-[#0c3123]/90 text-emerald-300 text-[10px] font-semibold px-2 py-0.5 rounded-md border border-emerald-700/50">
                      {item.badge}
                    </div>
                  )}
                  <div className="absolute top-3 right-3 bg-white/90 text-slate-900 text-[10px] font-bold px-2 py-0.5 rounded-md">
                    Foto #{idx + 1}
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <span className="text-[10px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200/50 px-2 py-0.5 rounded inline-block">
                      {item.category}
                    </span>
                    <h4 className="font-display text-sm font-bold text-slate-900 mt-1">
                      {item.title}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-3 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-400 font-medium">
                      {item.date || 'Arsip SPPG'}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveVisualItem(idx, 'up')}
                        disabled={idx === 0}
                        title="Pindah Urutan Kiri"
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 disabled:opacity-30 cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveVisualItem(idx, 'down')}
                        disabled={idx === config.visualStudy.items.length - 1}
                        title="Pindah Urutan Kanan"
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 disabled:opacity-30 cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEditVisual(item)}
                        title="Edit Dokumentasi"
                        className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-700 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteVisualItem(item.id)}
                        title="Hapus Dokumentasi"
                        className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. KONTEN TAB 4: MENU MBG HARI INI & QR CODE */}
      {activeTab === 'menu_today' && (() => {
        const menuToday = config.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday;
        const targetPublicUrl = `${window.location.origin}/menu-mbg-hari-ini`;

        return (
          <div className="space-y-6">
            {/* Kartu Hub QR Code & Akses Cepat */}
            <div className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-900 rounded-2xl p-6 text-white shadow-md border border-emerald-700/40">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                  <div className="p-3 bg-white rounded-xl shadow-lg shrink-0">
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
                    <h3 className="font-display text-lg font-bold text-white tracking-tight">
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
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-emerald-50 text-emerald-950 font-semibold text-xs transition-colors cursor-pointer shadow-xs"
                  >
                    <ExternalLink className="w-4 h-4 text-emerald-700" />
                    <span>Buka Halaman Publik</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyQrLink}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-800/80 hover:bg-emerald-700 border border-emerald-600/50 text-white font-medium text-xs transition-colors cursor-pointer"
                  >
                    {copiedQrLink ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedQrLink ? 'Tautan Disalin!' : 'Salin Tautan'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadQrPng}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-800/80 hover:bg-emerald-700 border border-emerald-600/50 text-white font-medium text-xs transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Unduh PNG</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsPrintStickerModalOpen(true)}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 border border-emerald-500 text-white font-semibold text-xs transition-colors cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Cetak Stiker Meja</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Form Pengaturan Konten Menu Hari Ini */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Kolom Kiri: Info Utama & Foto Menu */}
              <div className="lg:col-span-7 space-y-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center">
                        <UtensilsCrossed className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-display text-sm font-bold text-slate-900">
                          Identitas & Foto Sajian Menu Hari Ini
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Informasi yang tampil di bagian atas halaman saat QR code di-scan
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                        Label Badge Status
                      </label>
                      <input
                        type="text"
                        value={menuToday.badge || ''}
                        onChange={e => setConfig(prev => ({
                          ...prev,
                          menuToday: {
                            ...(prev.menuToday || DEFAULT_WEBSITE_CONFIG.menuToday),
                            badge: e.target.value
                          }
                        }))}
                        placeholder="Contoh: Menu Hari Ini • Segar & Halal"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                      />
                    </div>
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
                    <div className="flex flex-col sm:flex-row items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                      <div className="w-36 h-24 rounded-lg overflow-hidden border border-slate-300 bg-slate-200 shrink-0 shadow-2xs">
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
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer shadow-2xs"
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
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-display text-sm font-bold text-slate-900">
                        Kandungan Gizi Makro Rata-Rata
                      </h3>
                      <p className="text-[11px] text-slate-500">
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
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
                  <div className="pb-3 border-b border-slate-100">
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      Standar Porsi: Porsi Kecil vs Porsi Besar
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Pengaturan takaran yang berubah secara interaktif pada tombol toggle di halaman publik
                    </p>
                  </div>

                  {/* Porsi Kecil */}
                  <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-3">
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
                  <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/40 space-y-3">
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
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-display text-sm font-bold text-slate-900">
                    Bahan Pangan, Kandungan Gizi & Manfaat Kesehatan ({menuToday.ingredients.length} Bahan)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Rincian tiap komponen makanan yang ditampilkan dengan foto, takaran gramatur, dan manfaat kognitif bagi anak
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenAddIngredient}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs transition-colors cursor-pointer self-start sm:self-auto shadow-2xs"
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
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-white hover:border-emerald-300 transition-all space-y-3"
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
                          className="p-1 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-30 cursor-pointer"
                          title="Naikkan urutan"
                        >
                          <ChevronLeft className="w-3.5 h-3.5 rotate-90" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveIngredient(idx, 'down')}
                          disabled={idx === menuToday.ingredients.length - 1}
                          className="p-1 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-30 cursor-pointer"
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
                          className="p-1 rounded hover:bg-rose-100 text-rose-600 cursor-pointer"
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

            {/* Bottom Save Bar */}
            <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl border border-emerald-200">
              <div className="text-xs text-emerald-900">
                <span className="font-bold">Perubahan Tersimpan Sementara:</span> Klik simpan untuk menerapkan ke website publik dan database cloud.
              </div>
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={isCloudSaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-75 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer border border-emerald-600"
              >
                <Save className="w-4 h-4" />
                <span>{isCloudSaving ? 'Menyimpan...' : 'Simpan Semua Perubahan'}</span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* 5. MODAL FORM: EDIT / TAMBAH SLIDE MENU */}
      {isMenuModalOpen && editingMenuSlide && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <UtensilsCrossed className="w-4 h-4" />
                </div>
                <h4 className="font-display text-sm font-bold text-slate-900">
                  {editingMenuSlide.id.startsWith('menu-') ? 'Edit Menu MBG' : 'Tambah Menu Baru'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsMenuModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Foto Menu Upload / Preview */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Foto Sajian Menu
                </label>
                <div className="flex items-start gap-3">
                  <div className="w-28 h-24 rounded-xl bg-slate-900 overflow-hidden border border-slate-200 shrink-0">
                    {menuImagePreview ? (
                      <img src={menuImagePreview} alt="Preview Menu" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500 text-[10px]">
                        Belum ada foto
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input
                      type="file"
                      ref={menuFileRef}
                      accept="image/*"
                      onChange={handleMenuImageUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => menuFileRef.current?.click()}
                      disabled={isUploadingMenuImg}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 font-semibold cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingMenuImg ? 'Memproses...' : 'Unggah Foto dari Perangkat'}</span>
                    </button>
                    <div className="text-[11px] text-slate-500">
                      Pilihan foto preset:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {IMAGE_PRESETS.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setMenuImagePreview(p.url);
                            setEditingMenuSlide(prev => prev ? { ...prev, imageUrl: p.url } : null);
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] border transition-colors cursor-pointer ${
                            menuImagePreview === p.url
                              ? 'bg-emerald-700 text-white border-emerald-700'
                              : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {p.label.split('(')[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Judul & Hari */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Judul Menu / Paket</label>
                  <input
                    type="text"
                    value={editingMenuSlide.title}
                    onChange={e => setEditingMenuSlide(prev => prev ? { ...prev, title: e.target.value } : null)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Hari Siklus</label>
                  <select
                    value={editingMenuSlide.day}
                    onChange={e => setEditingMenuSlide(prev => prev ? { ...prev, day: e.target.value } : null)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 cursor-pointer focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                  >
                    <option value="Senin">Senin</option>
                    <option value="Selasa">Selasa</option>
                    <option value="Rabu">Rabu</option>
                    <option value="Kamis">Kamis</option>
                    <option value="Jumat">Jumat</option>
                    <option value="Sabtu">Sabtu</option>
                  </select>
                </div>
              </div>

              {/* Kategori & Kalori */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kategori / Paket</label>
                  <input
                    type="text"
                    value={editingMenuSlide.category}
                    onChange={e => setEditingMenuSlide(prev => prev ? { ...prev, category: e.target.value } : null)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Estimasi Energi & Gizi</label>
                  <input
                    type="text"
                    value={editingMenuSlide.calories}
                    onChange={e => setEditingMenuSlide(prev => prev ? { ...prev, calories: e.target.value } : null)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Deskripsi */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Uraian Komponen Masakan</label>
                <textarea
                  rows={3}
                  value={editingMenuSlide.description}
                  onChange={e => setEditingMenuSlide(prev => prev ? { ...prev, description: e.target.value } : null)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsMenuModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveMenuSlide}
                  className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold cursor-pointer"
                >
                  Terapkan Slide
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL FORM: EDIT / TAMBAH KAJIAN VISUAL */}
      {isVisualModalOpen && editingVisualItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <h4 className="font-display text-sm font-bold text-slate-900">
                  {editingVisualItem.id.startsWith('vis-') ? 'Edit Foto Kajian Visual' : 'Tambah Kajian Visual Baru'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsVisualModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Foto Dokumentasi Upload / Preview */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Foto Dokumentasi Lapangan
                </label>
                <div className="flex items-start gap-3">
                  <div className="w-28 h-24 rounded-xl bg-slate-900 overflow-hidden border border-slate-200 shrink-0">
                    {visualImagePreview ? (
                      <img src={visualImagePreview} alt="Preview Visual" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500 text-[10px]">
                        Belum ada foto
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input
                      type="file"
                      ref={visualFileRef}
                      accept="image/*"
                      onChange={handleVisualImageUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => visualFileRef.current?.click()}
                      disabled={isUploadingVisualImg}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 font-semibold cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingVisualImg ? 'Memproses...' : 'Unggah Foto Baru'}</span>
                    </button>
                    <div className="text-[11px] text-slate-500">
                      Pilihan foto arsip unit:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {IMAGE_PRESETS.slice(2).map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setVisualImagePreview(p.url);
                            setEditingVisualItem(prev => prev ? { ...prev, imageUrl: p.url } : null);
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] border transition-colors cursor-pointer ${
                            visualImagePreview === p.url
                              ? 'bg-emerald-700 text-white border-emerald-700'
                              : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {p.label.split('(')[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Judul & Kategori */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Judul Dokumentasi</label>
                  <input
                    type="text"
                    value={editingVisualItem.title}
                    onChange={e => setEditingVisualItem(prev => prev ? { ...prev, title: e.target.value } : null)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kategori Aspek</label>
                  <input
                    type="text"
                    value={editingVisualItem.category}
                    onChange={e => setEditingVisualItem(prev => prev ? { ...prev, category: e.target.value } : null)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Badge & Tanggal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Label / Badge</label>
                  <input
                    type="text"
                    value={editingVisualItem.badge || ''}
                    onChange={e => setEditingVisualItem(prev => prev ? { ...prev, badge: e.target.value } : null)}
                    placeholder="Contoh: Food-Grade SUS 304"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal / Tim Penguji</label>
                  <input
                    type="text"
                    value={editingVisualItem.date || ''}
                    onChange={e => setEditingVisualItem(prev => prev ? { ...prev, date: e.target.value } : null)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Keterangan */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Uraian / Keterangan Temuan Lapangan</label>
                <textarea
                  rows={3}
                  value={editingVisualItem.description}
                  onChange={e => setEditingVisualItem(prev => prev ? { ...prev, description: e.target.value } : null)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsVisualModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveVisualItem}
                  className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold cursor-pointer"
                >
                  Terapkan Dokumentasi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 7. MODAL FORM: TAMBAH / EDIT VIDEO HERO */}
      {isHeroVideoModalOpen && editingHeroVideo && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Video className="w-4 h-4" />
                </div>
                <h4 className="font-display text-sm font-bold text-slate-900">
                  {editingHeroVideo.id.startsWith('vid-') ? 'Edit Video Playlist Hero' : 'Tambah Video Hero'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsHeroVideoModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
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
                  <div className="aspect-video rounded-xl bg-slate-950 overflow-hidden border border-slate-300">
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
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveHeroVideo}
                  className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <h4 className="font-display text-sm font-bold text-slate-900">
                  {editingHeroSlide.id.startsWith('hero-photo-') ? 'Edit Slide Foto Dokumentasi Hero' : 'Tambah Slide Foto Baru'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsHeroSlideModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
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
                  <div className="w-28 h-24 rounded-xl bg-slate-900 overflow-hidden border border-slate-200 shrink-0">
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
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveHeroSlide}
                  className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Apple className="w-4 h-4" />
                </div>
                <h4 className="font-display text-sm font-bold text-slate-900">
                  {editingIngredient.name ? `Edit Bahan: ${editingIngredient.name}` : 'Tambah Bahan Pangan Baru'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsIngredientModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
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
                  <div className="w-24 h-20 rounded-xl bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
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
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveIngredient}
                  className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Printer className="w-4 h-4" />
                </div>
                <h4 className="font-display text-sm font-bold text-slate-900">
                  Cetak Stiker QR Code Meja & Nampan
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsPrintStickerModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
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
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs cursor-pointer"
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
                  className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
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
