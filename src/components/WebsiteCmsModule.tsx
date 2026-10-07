import React, { useState, useEffect, useRef } from 'react';
import {
  WebsiteConfig,
  HeroVideoItem,
  MenuSlideItem,
  VisualStudyItem,
  getWebsiteConfig,
  saveWebsiteConfig,
  saveWebsiteConfigToCloud,
  fetchWebsiteConfigFromCloud,
  uploadCmsMedia,
  exportWebsiteConfigAsJson,
  importWebsiteConfigFromJson,
  resetWebsiteConfigToDefault,
  VIDEO_PRESETS,
  IMAGE_PRESETS
} from '../db/websiteConfigStorage';
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
  HardDrive
} from 'lucide-react';

interface WebsiteCmsModuleProps {
  onViewLanding?: () => void;
}

export const WebsiteCmsModule: React.FC<WebsiteCmsModuleProps> = ({ onViewLanding }) => {
  const [config, setConfig] = useState<WebsiteConfig>(getWebsiteConfig);
  const [activeTab, setActiveTab] = useState<'hero' | 'menu' | 'visual'>('hero');
  const [isSavedAlert, setIsSavedAlert] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Cloud Sync & Storage States
  const [cloudStatus, setCloudStatus] = useState<'synced' | 'local' | 'syncing'>('local');
  const [isCloudSaving, setIsCloudSaving] = useState(false);
  const [isSyncingFromCloud, setIsSyncingFromCloud] = useState(false);
  const [showSqlGuide, setShowSqlGuide] = useState(false);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);

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

  // Video preview testing
  const [isVideoUploading, setIsVideoUploading] = useState(false);
  const videoFileRef = useRef<HTMLInputElement>(null);
  const menuFileRef = useRef<HTMLInputElement>(null);
  const visualFileRef = useRef<HTMLInputElement>(null);

  // Ambil data terbaru dari cloud saat modul pertama kali dibuka
  useEffect(() => {
    let isMounted = true;
    fetchWebsiteConfigFromCloud().then(res => {
      if (!isMounted) return;
      if (res.fromCloud) {
        setConfig(res.config);
        setCloudStatus('synced');
      } else {
        setCloudStatus('local');
      }
    });
    return () => { isMounted = false; };
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
      setCloudStatus(res.isCloudSynced ? 'synced' : 'local');
      showNotification(res.message);
    } catch {
      showNotification('Konfigurasi disimpan di cache lokal browser.');
    } finally {
      setIsCloudSaving(false);
    }
  };

  const handleManualSyncCloud = async () => {
    setIsSyncingFromCloud(true);
    try {
      const res = await fetchWebsiteConfigFromCloud();
      if (res.fromCloud) {
        setConfig(res.config);
        setCloudStatus('synced');
        showNotification('Berhasil menarik konfigurasi terbaru dari Database Supabase Cloud!');
      } else {
        setCloudStatus('local');
        showNotification(res.error ? `Info Cloud: ${res.error}` : 'Menggunakan konfigurasi lokal browser.');
      }
    } finally {
      setIsSyncingFromCloud(false);
    }
  };

  const handleExportJson = () => {
    exportWebsiteConfigAsJson();
    showNotification('Berkas JSON konfigurasi website berhasil diunduh sebagai cadangan.');
  };

  const handleImportJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importWebsiteConfigFromJson(file);
      setConfig(imported);
      showNotification('Konfigurasi website berhasil dipulihkan dari berkas JSON cadangan!');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal membaca berkas JSON cadangan.');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleResetToDefault = () => {
    const confirmReset = window.confirm(
      'Kembalikan seluruh foto menu, dokumentasi kajian visual, dan video hero ke setelan bawaan pabrik SPPG?'
    );
    if (confirmReset) {
      const resetConfig = resetWebsiteConfigToDefault();
      setConfig(resetConfig);
      showNotification('Pengaturan website berhasil di-reset ke setelan awal.');
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

  return (
    <div className="space-y-6">
      {/* 1. Header Konsol CMS */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-[#0f172a] text-white flex items-center justify-center shrink-0 shadow-xs border border-slate-700">
              <Globe className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  CMS Landing Page SPPG
                </span>

                {/* Indikator Status Cloud Database / Storage */}
                {cloudStatus === 'synced' ? (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
                    <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Supabase Cloud Terhubung</span>
                  </span>
                ) : (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1.5 shadow-2xs">
                    <HardDrive className="w-3.5 h-3.5 text-slate-500" />
                    <span>Penyimpanan Lokal Browser (Offline-Ready)</span>
                  </span>
                )}

                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  Diperbarui: {new Date(config.lastUpdated).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                </span>
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-1">
                Pengaturan Konten & Visual Website Publik
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Kustomisasi video latar belakang hero, rotasi slide foto menu makanan bergizi, dan galeri kajian visual nampan.
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            {onViewLanding && (
              <button
                type="button"
                onClick={onViewLanding}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors cursor-pointer border border-slate-200 shadow-2xs"
                title="Buka website publik untuk melihat tampilan secara langsung"
              >
                <Eye className="w-3.5 h-3.5 text-blue-600" />
                <span>Ke Website</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </button>
            )}

            <button
              type="button"
              onClick={handleManualSyncCloud}
              disabled={isSyncingFromCloud}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer border border-slate-200 shadow-2xs"
              title="Tarik konfigurasi terbaru dari database cloud Supabase"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isSyncingFromCloud ? 'animate-spin' : ''}`} />
              <span>{isSyncingFromCloud ? 'Sinkron...' : 'Sinkron Cloud'}</span>
            </button>

            {/* Input File Tersembunyi untuk Impor JSON */}
            <input
              type="file"
              ref={jsonFileInputRef}
              accept=".json"
              onChange={handleImportJsonFile}
              className="hidden"
            />

            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors cursor-pointer border border-slate-200 shadow-2xs"
              title="Unduh konfigurasi website saat ini sebagai berkas file JSON cadangan"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Ekspor JSON</span>
            </button>

            <button
              type="button"
              onClick={() => jsonFileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors cursor-pointer border border-slate-200 shadow-2xs"
              title="Pulihkan konfigurasi dari berkas file JSON cadangan"
            >
              <UploadCloud className="w-3.5 h-3.5 text-slate-500" />
              <span>Impor JSON</span>
            </button>

            <button
              type="button"
              onClick={handleResetToDefault}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-xs font-medium transition-colors cursor-pointer border border-slate-200 shadow-2xs"
              title="Reset ke setelan bawaan foto & video"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isCloudSaving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-75 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer border border-blue-500"
            >
              <Save className="w-4 h-4" />
              <span>{isCloudSaving ? 'Menyimpan Cloud...' : 'Simpan Semua Perubahan'}</span>
            </button>
          </div>
        </div>

        {/* Banner Penjelasan Arsitektur Database & Object Storage */}
        <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
              <Database className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="font-semibold text-slate-900">Arsitektur Penyimpanan Media Modern:</span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Foto menu & dokumentasi otomatis dikompresi ke <strong>WebP</strong> dan diunggah ke <strong>Supabase Object Storage (sppg-assets)</strong>. Video hero disarankan berformat MP4 ringkas/CDN. Database PostgreSQL hanya menyimpan metadata & URL publik sehingga database tetap ringan, aman, dan secepat kilat.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowSqlGuide(prev => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold shrink-0 cursor-pointer shadow-2xs transition-colors self-start md:self-auto"
          >
            <Info className="w-3.5 h-3.5 text-blue-600" />
            <span>{showSqlGuide ? 'Tutup Panduan SQL' : 'Lihat Skema SQL Supabase'}</span>
          </button>
        </div>

        {/* Panel Panduan SQL Supabase (Bisa disalin untuk Dashboard Supabase) */}
        {showSqlGuide && (
          <div className="mt-3 p-4 bg-slate-900 text-slate-200 rounded-xl border border-slate-800 text-xs space-y-2.5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="font-mono text-cyan-400 font-semibold flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                supabase/migrations/20261007000001_website_cms_and_storage.sql
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`-- TABEL CMS & STORAGE BUCKET
CREATE TABLE IF NOT EXISTS public.website_cms_config (
    id TEXT PRIMARY KEY DEFAULT 'default',
    config JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT DEFAULT 'admin'
);
ALTER TABLE public.website_cms_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view website config" ON public.website_cms_config FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow manage website config" ON public.website_cms_config FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('sppg-assets', 'sppg-assets', true, 52428800, ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm'])
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Public can view sppg-assets" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'sppg-assets');
CREATE POLICY "Allow upload sppg-assets" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'sppg-assets');`);
                  alert('Kode SQL berhasil disalin ke clipboard! Silakan tempel (paste) di SQL Editor Supabase Anda.');
                }}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-semibold cursor-pointer"
              >
                Salin Skrip SQL
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Jalankan perintah SQL ini di menu <strong>SQL Editor</strong> di dashboard Supabase proyek Anda untuk membuat tabel <code className="text-cyan-300">public.website_cms_config</code> dan bucket <code className="text-cyan-300">sppg-assets</code> secara otomatis.
            </p>
          </div>
        )}

        {/* Notifikasi Toast Tersimpan */}
        {isSavedAlert && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{saveMessage}</span>
          </div>
        )}

        {/* Tab Navigasi Sub-Modul */}
        <div className="mt-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('hero')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'hero'
                ? 'bg-[#0f172a] text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Video className={`w-4 h-4 ${activeTab === 'hero' ? 'text-cyan-400' : 'text-slate-500'}`} />
            <span>Hero & Video Background</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('menu')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'menu'
                ? 'bg-[#0f172a] text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <UtensilsCrossed className={`w-4 h-4 ${activeTab === 'menu' ? 'text-cyan-400' : 'text-slate-500'}`} />
            <span>Foto Menu & Auto-Slide ({config.menuSlider.slides.length} Menu)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('visual')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'visual'
                ? 'bg-[#0f172a] text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <ImageIcon className={`w-4 h-4 ${activeTab === 'visual' ? 'text-cyan-400' : 'text-slate-500'}`} />
            <span>Kajian Visual Lapangan ({config.visualStudy.items.length} Dokumentasi)</span>
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
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Video className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      Tipe Latar Belakang Hero Section
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Pilih apakah hero menggunakan video gerak sinematik loop atau foto statis
                    </p>
                  </div>
                </div>

                <div className="flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, hero: { ...prev.hero, backgroundType: 'video' } }))}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                      config.hero.backgroundType === 'video'
                        ? 'bg-[#0f172a] text-white shadow-xs'
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
                        ? 'bg-[#0f172a] text-white shadow-xs'
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
                      <span>Daftar Playlist Video Hero (Putar Bergantian / Loop)</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-800 font-semibold">
                        {(config.hero.videos || []).length} Video
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Saat video selesai diputar, website otomatis memutar video berikutnya secara berulang (looping).
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Input File Tersembunyi untuk Upload Video Baru ke Playlist */}
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-75 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                      title="Unggah file MP4 langsung ke Cloud Storage dan tambahkan ke loop"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingHeroVideo ? 'Mengunggah...' : 'Upload Video Baru'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenAddHeroVideo}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium border border-slate-200 transition-colors cursor-pointer"
                      title="Tambah tautan video manual atau preset"
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
                        <span className="w-6 h-6 rounded-lg bg-[#0f172a] text-cyan-400 font-mono text-xs font-bold flex items-center justify-center shrink-0">
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
                          className="p-1.5 rounded hover:bg-blue-100 text-blue-600 transition-colors cursor-pointer"
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
                <div className="p-3.5 rounded-xl bg-slate-100/80 border border-slate-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-xs text-slate-800">Mode Transisi & Looping Video:</span>
                      <p className="text-[11px] text-slate-500">
                        Atur kapan video berganti ke urutan berikutnya di hero section.
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
                      className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 font-medium"
                    >
                      <option value={0}>Transisi Alami saat Video Berakhir (onEnded)</option>
                      <option value={8}>Otomatis Tiap 8 Detik</option>
                      <option value={12}>Otomatis Tiap 12 Detik</option>
                      <option value={20}>Otomatis Tiap 20 Detik</option>
                      <option value={30}>Otomatis Tiap 30 Detik</option>
                    </select>
                  </div>

                  {/* Tambah Cepat Preset HD ke Playlist */}
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-[11px] font-semibold text-slate-600 block mb-1.5">
                      Tambah Cepat Video HD Dapur ke Playlist:
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
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-blue-400'
                            }`}
                          >
                            <div className="font-bold flex items-center justify-between">
                              <span>{vp.label.split(':')[0]}</span>
                              {isAlreadyAdded ? (
                                <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                                  <Check className="w-3 h-3" /> Ada di List
                                </span>
                              ) : (
                                <Plus className="w-3 h-3 text-blue-600" />
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
                    <Sliders className="w-3.5 h-3.5 text-blue-600" />
                    <span>Tingkat Kegelapan Lapisan Overlay ({Math.round(config.hero.videoOverlayOpacity * 100)}%)</span>
                  </label>
                  <span className="text-[11px] font-medium text-slate-500 font-mono">
                    Rekomendasi: 60% – 75% agar teks terbaca jelas
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
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>20% (Lebih Terang Video)</span>
                  <span>55% (Seimbang)</span>
                  <span>85% (Maksimal Kontras Teks)</span>
                </div>
              </div>

              {/* Teks & Judul Hero Section */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <h4 className="text-xs font-bold text-slate-800">Kustomisasi Teks & Narasi Hero</h4>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Badge Atas</label>
                  <input
                    type="text"
                    value={config.hero.heroBadge}
                    onChange={e => setConfig(prev => ({ ...prev, hero: { ...prev.hero, heroBadge: e.target.value } }))}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Judul Utama (Headline)</label>
                  <input
                    type="text"
                    value={config.hero.heroTitle}
                    onChange={e => setConfig(prev => ({ ...prev, hero: { ...prev.hero, heroTitle: e.target.value } }))}
                    className="w-full px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Paragraf Narasi</label>
                  <textarea
                    rows={3}
                    value={config.hero.heroSubtitle}
                    onChange={e => setConfig(prev => ({ ...prev, hero: { ...prev.hero, heroSubtitle: e.target.value } }))}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-800"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Pratinjau Langsung Video Hero */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-md sticky top-24">
              <div className="p-3 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between text-xs text-slate-200">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-semibold">Simulasi Tampilan Hero Publik</span>
                </div>
                <span className="font-mono text-[11px] text-cyan-400">16:9 Cinema View</span>
              </div>

              {/* Layar Simulasi Hero dengan Video & Teks */}
              <div className="relative aspect-16/10 overflow-hidden bg-slate-950 flex flex-col justify-end p-5 text-white">
                {/* Background Video atau Image */}
                {config.hero.backgroundType === 'video' && config.hero.videoUrl ? (
                  <video
                    key={config.hero.videoUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    poster={config.hero.videoPoster}
                    className="absolute inset-0 w-full h-full object-cover object-center filter brightness-90"
                  >
                    <source src={config.hero.videoUrl} type="video/mp4" />
                  </video>
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
                  <h4 className="font-serif-display text-base font-bold text-white leading-tight drop-shadow-xs line-clamp-2">
                    {config.hero.heroTitle}
                  </h4>
                  <p className="text-[11px] text-slate-200 line-clamp-2 drop-shadow-xs leading-relaxed">
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

              <div className="p-3 bg-slate-900 text-[11px] text-slate-400 border-t border-slate-800 flex items-center justify-between">
                <span>Format video: Auto-loop, Muted, Inline</span>
                <span className="text-cyan-400">Status: Siap Ditayangkan</span>
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
                  <Sliders className="w-4 h-4 text-blue-600" />
                  <span>Pengaturan Auto-Slide Menu MBG</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Atur pergeseran otomatis dan durasi pergantian foto menu di landing page
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
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    Auto-Slide {config.menuSlider.autoSlide ? 'Aktif' : 'Nonaktif'}
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
                    className="font-bold text-blue-600 bg-transparent focus:outline-none cursor-pointer"
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
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-slate-700 font-medium">Jeda Saat Kursor Di Atas Menu</span>
                </label>
              </div>
            </div>

            {/* Judul Seksi Menu */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Judul Seksi Menu di Landing Page
                </label>
                <input
                  type="text"
                  value={config.menuSlider.sectionTitle}
                  onChange={e => setConfig(prev => ({
                    ...prev,
                    menuSlider: { ...prev.menuSlider, sectionTitle: e.target.value }
                  }))}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Subjudul / Keterangan Seksi
                </label>
                <input
                  type="text"
                  value={config.menuSlider.sectionSubtitle}
                  onChange={e => setConfig(prev => ({
                    ...prev,
                    menuSlider: { ...prev.menuSlider, sectionSubtitle: e.target.value }
                  }))}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Daftar Koleksi Slide Menu */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">
                Koleksi Slide Menu Harian MBG ({config.menuSlider.slides.length} Menu)
              </h3>
              <p className="text-xs text-slate-500">
                Foto dan resep ini akan berputar otomatis secara bergantian pada carousel di website
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenAddMenu}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
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
                  <div className="absolute top-3 left-3 bg-[#0f172a]/90 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-lg border border-slate-700">
                    {slide.day}
                  </div>
                  <div className="absolute top-3 right-3 bg-white/95 text-slate-900 text-[10px] font-bold px-2 py-0.5 rounded-lg shadow-xs">
                    Slide #{idx + 1}
                  </div>
                </div>

                {/* Deskripsi Menu */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                      {slide.category}
                    </span>
                    <h4 className="font-display text-sm font-bold text-slate-900 mt-1 line-clamp-1">
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
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 cursor-pointer"
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
                  <ImageIcon className="w-4 h-4 text-blue-600" />
                  <span>Pengaturan Seksi Kajian Visual Lapangan</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Foto riil dokumentasi nampan 5 sekat, pengemasan boks ganda, dan standar higienitas SPPG
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenAddVisual}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Dokumentasi Visual Baru</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Judul Seksi di Landing Page
                </label>
                <input
                  type="text"
                  value={config.visualStudy.sectionTitle}
                  onChange={e => setConfig(prev => ({
                    ...prev,
                    visualStudy: { ...prev.visualStudy, sectionTitle: e.target.value }
                  }))}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-800"
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
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-800"
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
                    <div className="absolute top-3 left-3 bg-[#111915]/90 text-emerald-300 text-[10px] font-semibold px-2 py-0.5 rounded-md border border-slate-700">
                      {item.badge}
                    </div>
                  )}
                  <div className="absolute top-3 right-3 bg-white/90 text-slate-900 text-[10px] font-bold px-2 py-0.5 rounded-md">
                    Foto #{idx + 1}
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                      {item.category}
                    </span>
                    <h4 className="font-display text-sm font-bold text-slate-900 mt-0.5">
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
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 cursor-pointer"
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

      {/* 5. MODAL FORM: EDIT / TAMBAH SLIDE MENU */}
      {isMenuModalOpen && editingMenuSlide && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
                  <UtensilsCrossed className="w-4 h-4" />
                </div>
                <h4 className="font-display text-sm font-bold text-slate-900">
                  {editingMenuSlide.id.startsWith('menu-') ? 'Edit Foto & Resep Menu MBG' : 'Tambah Menu Baru'}
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-semibold cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingMenuImg ? 'Mengompres...' : 'Unggah Foto dari Perangkat (WebP Otomatis)'}</span>
                    </button>
                    <div className="text-[11px] text-slate-500">
                      Atau pilih dari preset poster resmi:
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
                              ? 'bg-blue-600 text-white border-blue-600'
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
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Hari Siklus</label>
                  <select
                    value={editingMenuSlide.day}
                    onChange={e => setEditingMenuSlide(prev => prev ? { ...prev, day: e.target.value } : null)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 cursor-pointer"
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
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Estimasi Energi & Gizi</label>
                  <input
                    type="text"
                    value={editingMenuSlide.calories}
                    onChange={e => setEditingMenuSlide(prev => prev ? { ...prev, calories: e.target.value } : null)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
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
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
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
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-semibold cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingVisualImg ? 'Mengompres...' : 'Unggah Foto Baru (WebP Otomatis)'}</span>
                    </button>
                    <div className="text-[11px] text-slate-500">
                      Atau pilih foto arsip unit:
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
                              ? 'bg-blue-600 text-white border-blue-600'
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
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kategori Aspek</label>
                  <input
                    type="text"
                    value={editingVisualItem.category}
                    onChange={e => setEditingVisualItem(prev => prev ? { ...prev, category: e.target.value } : null)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
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
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal / Tim Penguji</label>
                  <input
                    type="text"
                    value={editingVisualItem.date || ''}
                    onChange={e => setEditingVisualItem(prev => prev ? { ...prev, date: e.target.value } : null)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
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
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
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
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
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
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
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
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
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
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-slate-800"
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-semibold cursor-pointer"
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
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
                >
                  Simpan Video
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
