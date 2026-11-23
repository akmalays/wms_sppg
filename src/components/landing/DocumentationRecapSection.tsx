import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Camera,
  ChevronLeft,
  ChevronRight,
  Expand,
  Images,
  X,
} from 'lucide-react';
import {
  DEFAULT_WEBSITE_CONFIG,
  DocumentationRecapEntry,
  WebsiteDocumentationRecapConfig,
} from '../../db/websiteConfigStorage';
import { FoodDoodles } from '../common/FoodDoodles';

interface DocumentationRecapSectionProps {
  recap?: WebsiteDocumentationRecapConfig;
}

const PUBLIC_FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#133d2c] focus-visible:ring-offset-2';

const parseIsoDate = (iso: string): Date | null => {
  const parts = (iso || '').split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, m, d] = parts;
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const formatFullDate = (iso: string): string => {
  const dt = parseIsoDate(iso);
  if (!dt) return iso || 'Tanggal belum diisi';
  return dt.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const formatPillParts = (iso: string): { weekday: string; dayMonth: string; year: string; monthKey: string; monthLabel: string } => {
  const dt = parseIsoDate(iso);
  if (!dt) {
    return {
      weekday: 'Kegiatan',
      dayMonth: iso || '-',
      year: '',
      monthKey: 'other',
      monthLabel: 'Lainnya',
    };
  }
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  return {
    weekday: dt.toLocaleDateString('id-ID', { weekday: 'short' }),
    dayMonth: dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
    year: String(y),
    monthKey: `${y}-${m}`,
    monthLabel: dt.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
  };
};

export const DocumentationRecapSection: React.FC<DocumentationRecapSectionProps> = ({ recap }) => {
  const effectiveRecap = recap || DEFAULT_WEBSITE_CONFIG.documentationRecap;
  const sectionTitle = (effectiveRecap.sectionTitle || '').trim() || DEFAULT_WEBSITE_CONFIG.documentationRecap.sectionTitle;
  const sectionSubtitle = (effectiveRecap.sectionSubtitle || '').trim() || DEFAULT_WEBSITE_CONFIG.documentationRecap.sectionSubtitle;

  const sortedEntries = useMemo<DocumentationRecapEntry[]>(() => {
    const list = Array.isArray(effectiveRecap.entries) ? effectiveRecap.entries : [];
    return [...list].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [effectiveRecap.entries]);

  const monthOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const entry of sortedEntries) {
      const { monthKey, monthLabel } = formatPillParts(entry.date);
      if (!seen.has(monthKey)) seen.set(monthKey, monthLabel);
    }
    return Array.from(seen.entries()).map(([key, label]) => ({ key, label }));
  }, [sortedEntries]);

  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const visibleEntries = useMemo(() => {
    if (selectedMonth === 'ALL') return sortedEntries;
    return sortedEntries.filter((entry) => formatPillParts(entry.date).monthKey === selectedMonth);
  }, [sortedEntries, selectedMonth]);

  const [selectedEntryId, setSelectedEntryId] = useState<string>('');
  const [selectedPhotoIdx, setSelectedPhotoIdx] = useState<number>(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);

  // Jaga agar entri aktif selalu valid saat bulan atau data CMS berubah
  const activeEntryIndex = useMemo(() => {
    if (visibleEntries.length === 0) return -1;
    const found = visibleEntries.findIndex((e) => e.id === selectedEntryId);
    return found >= 0 ? found : 0;
  }, [visibleEntries, selectedEntryId]);

  const activeEntry = activeEntryIndex >= 0 ? visibleEntries[activeEntryIndex] : null;
  const activePhotos = activeEntry?.photos || [];
  const safePhotoIdx = activePhotos.length > 0 ? Math.min(selectedPhotoIdx, activePhotos.length - 1) : 0;
  const activePhoto = activePhotos[safePhotoIdx] || null;

  const totalPhotosAll = useMemo(
    () => sortedEntries.reduce((sum, entry) => sum + (entry.photos?.length || 0), 0),
    [sortedEntries]
  );

  const selectEntry = (entryId: string) => {
    setSelectedEntryId(entryId);
    setSelectedPhotoIdx(0);
  };

  const handleStepPhoto = (dir: -1 | 1) => {
    if (activePhotos.length <= 1) return;
    setSelectedPhotoIdx((prev) => (prev + dir + activePhotos.length) % activePhotos.length);
  };

  const handleStepEntry = (dir: -1 | 1) => {
    if (visibleEntries.length <= 1 || activeEntryIndex < 0) return;
    const nextIdx = activeEntryIndex + dir;
    if (nextIdx < 0 || nextIdx >= visibleEntries.length) return;
    selectEntry(visibleEntries[nextIdx].id);
  };

  // Navigasi keyboard di dalam lightbox
  useEffect(() => {
    if (!isLightboxOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsLightboxOpen(false);
      } else if (e.key === 'ArrowRight' && activePhotos.length > 1) {
        setSelectedPhotoIdx((prev) => (prev + 1) % activePhotos.length);
      } else if (e.key === 'ArrowLeft' && activePhotos.length > 1) {
        setSelectedPhotoIdx((prev) => (prev - 1 + activePhotos.length) % activePhotos.length);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isLightboxOpen, activePhotos.length]);

  const newerEntry = activeEntryIndex > 0 ? visibleEntries[activeEntryIndex - 1] : null;
  const olderEntry = activeEntryIndex >= 0 && activeEntryIndex < visibleEntries.length - 1
    ? visibleEntries[activeEntryIndex + 1]
    : null;

  return (
    <section
      id="dokumentasi-kegiatan"
      className="relative overflow-hidden py-14 sm:py-20 bg-white border-b border-[#e5dfd3]"
    >
      <FoodDoodles
        width={760}
        height={280}
        seed={3}
        className="top-0 right-0 w-3/4 md:w-3/5 h-64 md:h-72 text-[#133d2c] opacity-[0.13] [mask-image:linear-gradient(to_left,black_45%,transparent)]"
      />
      <FoodDoodles
        width={540}
        height={220}
        seed={13}
        className="hidden lg:block bottom-0 left-0 w-2/5 h-56 text-[#133d2c] opacity-[0.09] [mask-image:linear-gradient(to_right,black_30%,transparent)]"
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Seksi */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 mb-7 sm:mb-9">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#133d2c] text-white text-xs font-semibold mb-3 shadow-2xs">
              <Camera className="w-3.5 h-3.5 text-[#d9c382]" aria-hidden="true" />
              <span>Rekap Dokumentasi</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-serif-display text-[#141d18] tracking-tight">
              {sectionTitle}
            </h2>
            <p className="text-xs sm:text-sm text-[#55645c] mt-2 max-w-2xl leading-relaxed">
              {sectionSubtitle}
            </p>
          </div>

          {sortedEntries.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#faf8f4] border border-[#ded7c8] text-xs font-semibold text-[#141d18]">
                <Calendar className="w-3.5 h-3.5 text-[#133d2c]" aria-hidden="true" />
                <span className="font-mono">{sortedEntries.length}</span>
                <span>tanggal tercatat</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#faf8f4] border border-[#ded7c8] text-xs font-semibold text-[#141d18]">
                <Images className="w-3.5 h-3.5 text-[#133d2c]" aria-hidden="true" />
                <span className="font-mono">{totalPhotosAll}</span>
                <span>foto kegiatan</span>
              </span>
            </div>
          )}
        </div>

        {sortedEntries.length === 0 || !activeEntry ? (
          <div className="rounded-2xl border border-[#ded7c8] bg-[#faf8f4] p-8 text-center">
            <Camera className="w-8 h-8 text-[#707e76] mx-auto mb-2.5" aria-hidden="true" />
            <p className="text-sm font-semibold text-[#141d18]">
              Belum ada rekap dokumentasi yang ditambahkan.
            </p>
            <p className="text-xs text-[#55645c] mt-1">
              Foto kegiatan per tanggal akan tampil di sini setelah diperbarui oleh petugas SPPG.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Filter Bulan (tampil otomatis jika arsip mencakup lebih dari 1 bulan) */}
            {monthOptions.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter bulan dokumentasi">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMonth('ALL');
                    setSelectedPhotoIdx(0);
                  }}
                  aria-pressed={selectedMonth === 'ALL'}
                  className={`px-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${PUBLIC_FOCUS} ${
                    selectedMonth === 'ALL'
                      ? 'bg-[#133d2c] text-white border-[#133d2c]'
                      : 'bg-[#faf8f4] text-[#425249] border-[#ded7c8] hover:border-[#133d2c]'
                  }`}
                >
                  Semua bulan
                </button>
                {monthOptions.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => {
                      setSelectedMonth(m.key);
                      setSelectedPhotoIdx(0);
                    }}
                    aria-pressed={selectedMonth === m.key}
                    className={`px-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${PUBLIC_FOCUS} ${
                      selectedMonth === m.key
                        ? 'bg-[#133d2c] text-white border-[#133d2c]'
                        : 'bg-[#faf8f4] text-[#425249] border-[#ded7c8] hover:border-[#133d2c]'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}

            {/* Strip Pemilih Tanggal Interaktif */}
            <div className="flex items-center gap-2">
              {visibleEntries.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleStepEntry(-1)}
                  disabled={activeEntryIndex <= 0}
                  aria-label="Lihat tanggal lebih baru"
                  className={`hidden sm:inline-flex items-center justify-center w-10 h-10 rounded-xl border border-[#ded7c8] bg-[#faf8f4] text-[#141d18] hover:border-[#133d2c] disabled:opacity-35 disabled:cursor-not-allowed shrink-0 transition-colors cursor-pointer ${PUBLIC_FOCUS}`}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}

              <div
                role="tablist"
                aria-label="Pilih tanggal dokumentasi"
                className="flex-1 flex items-stretch gap-2 overflow-x-auto pb-1.5 -mb-1.5 snap-x"
              >
                {visibleEntries.map((entry) => {
                  const isActive = entry.id === activeEntry.id;
                  const parts = formatPillParts(entry.date);
                  const photoCount = entry.photos?.length || 0;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => selectEntry(entry.id)}
                      className={`snap-start shrink-0 text-left px-3.5 py-2.5 min-h-[44px] rounded-xl border transition-colors cursor-pointer flex items-center gap-3 ${PUBLIC_FOCUS} ${
                        isActive
                          ? 'bg-[#133d2c] text-white border-[#133d2c] shadow-xs'
                          : 'bg-[#faf8f4] text-[#141d18] border-[#ded7c8] hover:border-[#133d2c] hover:bg-[#f5f1e7]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              isActive ? 'bg-[#d9c382]' : 'bg-[#133d2c]/40'
                            }`}
                            aria-hidden="true"
                          />
                          <span className={`text-[11px] font-medium ${isActive ? 'text-emerald-100' : 'text-[#55645c]'}`}>
                            {parts.weekday}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm font-bold leading-tight mt-0.5 whitespace-nowrap">
                          {parts.dayMonth} <span className="font-mono font-semibold opacity-80">{parts.year}</span>
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold shrink-0 ${
                          isActive
                            ? 'bg-white/15 text-emerald-50'
                            : 'bg-white border border-[#ded7c8] text-[#425249]'
                        }`}
                      >
                        {photoCount} foto
                      </span>
                    </button>
                  );
                })}
              </div>

              {visibleEntries.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleStepEntry(1)}
                  disabled={activeEntryIndex >= visibleEntries.length - 1}
                  aria-label="Lihat tanggal sebelumnya"
                  className={`hidden sm:inline-flex items-center justify-center w-10 h-10 rounded-xl border border-[#ded7c8] bg-[#faf8f4] text-[#141d18] hover:border-[#133d2c] disabled:opacity-35 disabled:cursor-not-allowed shrink-0 transition-colors cursor-pointer ${PUBLIC_FOCUS}`}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Panggung Utama Interaktif: Kiri Foto Pilihan, Kanan Keterangan Tanggal & Galeri */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              {/* Kolom Kiri: Panggung Foto Utama */}
              <div className="lg:col-span-7 flex flex-col rounded-2xl overflow-hidden border border-[#1a4734] bg-[linear-gradient(155deg,#174c36_0%,#103828_58%,#0a261b_100%)] shadow-sm relative">
                <FoodDoodles
                  width={680}
                  height={440}
                  seed={14}
                  className="inset-0 w-full h-full text-emerald-100 opacity-[0.09] [mask-image:radial-gradient(ellipse_at_center,transparent_32%,black_85%)]"
                />

                {/* Bar Atas Panggung: Tahap Foto + Counter + Tombol Perbesar */}
                <div className="relative z-10 flex items-center justify-between gap-2 px-4 pt-3.5 pb-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    {activePhoto?.stage ? (
                      <span className="px-2.5 py-1 rounded-md bg-white/14 border border-white/15 text-emerald-50 text-xs font-semibold truncate">
                        {activePhoto.stage}
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-md bg-white/14 border border-white/15 text-emerald-50 text-xs font-semibold truncate">
                        Foto kegiatan
                      </span>
                    )}
                    {activePhotos.length > 0 && (
                      <span className="text-xs font-mono text-emerald-100/80 shrink-0">
                        {safePhotoIdx + 1} / {activePhotos.length}
                      </span>
                    )}
                  </div>

                  {activePhoto && (
                    <button
                      type="button"
                      onClick={() => setIsLightboxOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg bg-white/12 hover:bg-white/20 text-white text-xs font-semibold border border-white/15 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d9c382]"
                    >
                      <Expand className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Perbesar</span>
                    </button>
                  )}
                </div>

                {/* Area Gambar */}
                <div className="relative z-10 px-3 sm:px-4">
                  {activePhoto ? (
                    <div className="relative aspect-16/10 sm:aspect-16/10 rounded-xl overflow-hidden bg-[#071811] border border-white/15 group">
                      <button
                        type="button"
                        onClick={() => setIsLightboxOpen(true)}
                        aria-label={`Perbesar foto: ${activePhoto.caption || activeEntry.title}`}
                        className="block w-full h-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#d9c382]"
                      >
                        <img
                          key={activePhoto.id}
                          src={activePhoto.imageUrl}
                          alt={activePhoto.caption || `${activeEntry.title} (${formatFullDate(activeEntry.date)})`}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.015]"
                        />
                      </button>

                      {activePhotos.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStepPhoto(-1)}
                            aria-label="Foto sebelumnya"
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/65 hover:bg-black/80 text-white border border-white/20 flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d9c382]"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStepPhoto(1)}
                            aria-label="Foto berikutnya"
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/65 hover:bg-black/80 text-white border border-white/20 flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d9c382]"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="aspect-16/10 rounded-xl border border-white/15 bg-white/5 flex flex-col items-center justify-center text-emerald-100/80 p-6 text-center">
                      <Camera className="w-8 h-8 mb-2 opacity-75" aria-hidden="true" />
                      <p className="text-xs">Belum ada foto pada tanggal ini.</p>
                    </div>
                  )}
                </div>

                {/* Keterangan Foto Aktif (di bawah foto agar tidak menutupi gambar) */}
                <div className="relative z-10 px-4 py-3.5 mt-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <p className="text-xs sm:text-sm text-emerald-50 leading-relaxed">
                    {activePhoto?.caption || activeEntry.title || 'Dokumentasi kegiatan harian SPPG Tumpang Jeru.'}
                  </p>
                  <span className="text-[11px] font-mono text-[#d9c382] shrink-0">
                    {formatFullDate(activeEntry.date)}
                  </span>
                </div>
              </div>

              {/* Kolom Kanan: Keterangan Per Tanggal + Thumbnail Galeri */}
              <div className="lg:col-span-5 flex flex-col justify-between gap-4 rounded-2xl border border-[#ded7c8] bg-[#faf8f4] p-4 sm:p-5">
                <div className="space-y-4">
                  {/* Blok Keterangan Per Tanggal */}
                  <div className="rounded-xl bg-white border border-[#e5dfd3] p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#133d2c]">
                        <Calendar className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{formatFullDate(activeEntry.date)}</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-[#eef6f1] text-[#133d2c] text-[11px] font-mono font-semibold shrink-0">
                        {activePhotos.length} foto
                      </span>
                    </div>

                    <h3 className="text-base sm:text-lg font-bold font-serif-display text-[#141d18] leading-snug">
                      {activeEntry.title || `Dokumentasi ${formatFullDate(activeEntry.date)}`}
                    </h3>

                    {activeEntry.summary && (
                      <p className="text-xs sm:text-sm text-[#4a5951] leading-relaxed">
                        {activeEntry.summary}
                      </p>
                    )}
                  </div>

                  {/* Grid Thumbnail Foto pada Tanggal Ini */}
                  {activePhotos.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-[#425249]">
                          Pilih foto pada tanggal ini
                        </span>
                        <span className="text-[11px] text-[#66756d]">
                          Klik untuk mengganti tampilan
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2.5">
                        {activePhotos.map((photo, idx) => {
                          const isSelected = idx === safePhotoIdx;
                          return (
                            <button
                              key={photo.id}
                              type="button"
                              onClick={() => setSelectedPhotoIdx(idx)}
                              aria-pressed={isSelected}
                              className={`group text-left rounded-xl overflow-hidden border bg-white transition-all cursor-pointer ${PUBLIC_FOCUS} ${
                                isSelected
                                  ? 'border-[#133d2c] ring-2 ring-[#133d2c]/25 shadow-xs'
                                  : 'border-[#ded7c8] hover:border-[#133d2c]/70'
                              }`}
                            >
                              <div className="relative aspect-4/3 bg-slate-900 overflow-hidden">
                                <img
                                  src={photo.imageUrl}
                                  alt={photo.caption || `Foto ${idx + 1}`}
                                  className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-200"
                                />
                                <span
                                  className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                                    isSelected
                                      ? 'bg-[#133d2c] text-white'
                                      : 'bg-black/70 text-white'
                                  }`}
                                >
                                  #{idx + 1}
                                </span>
                              </div>
                              <div className="px-2.5 py-2">
                                <p className="text-[11px] font-semibold text-[#141d18] truncate">
                                  {photo.stage || `Foto #${idx + 1}`}
                                </p>
                                {photo.caption && (
                                  <p className="text-[11px] text-[#55645c] line-clamp-1 mt-0.5">
                                    {photo.caption}
                                  </p>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Navigasi Cepat Antar Tanggal */}
                {visibleEntries.length > 1 && (
                  <div className="pt-3 border-t border-[#e5dfd3] grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => newerEntry && selectEntry(newerEntry.id)}
                      disabled={!newerEntry}
                      className={`inline-flex items-center justify-start gap-1.5 px-3 py-2 min-h-[44px] rounded-xl border border-[#ded7c8] bg-white text-xs font-semibold text-[#141d18] hover:border-[#133d2c] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer ${PUBLIC_FOCUS}`}
                    >
                      <ChevronLeft className="w-4 h-4 shrink-0 text-[#133d2c]" />
                      <span className="truncate">
                        {newerEntry ? formatPillParts(newerEntry.date).dayMonth : 'Terbaru'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => olderEntry && selectEntry(olderEntry.id)}
                      disabled={!olderEntry}
                      className={`inline-flex items-center justify-end gap-1.5 px-3 py-2 min-h-[44px] rounded-xl border border-[#ded7c8] bg-white text-xs font-semibold text-[#141d18] hover:border-[#133d2c] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer ${PUBLIC_FOCUS}`}
                    >
                      <span className="truncate">
                        {olderEntry ? formatPillParts(olderEntry.date).dayMonth : 'Paling lama'}
                      </span>
                      <ChevronRight className="w-4 h-4 shrink-0 text-[#133d2c]" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox Foto Layar Penuh */}
      {isLightboxOpen && activeEntry && activePhoto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Pratinjau foto dokumentasi ${formatFullDate(activeEntry.date)}`}
          className="fixed inset-0 z-50 bg-[#06140e]/92 backdrop-blur-xs flex flex-col justify-between p-3 sm:p-6"
          onClick={() => setIsLightboxOpen(false)}
        >
          {/* Top bar */}
          <div
            className="max-w-5xl w-full mx-auto flex items-center justify-between gap-3 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-200">
                <span className="font-semibold">{formatFullDate(activeEntry.date)}</span>
                {activePhoto.stage && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{activePhoto.stage}</span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span className="font-mono">
                  {safePhotoIdx + 1} / {activePhotos.length}
                </span>
              </div>
              <p className="text-sm sm:text-base font-bold truncate mt-0.5">{activeEntry.title}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsLightboxOpen(false)}
              aria-label="Tutup pratinjau foto"
              className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-white/12 hover:bg-white/22 text-white border border-white/15 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d9c382]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Foto Tengah */}
          <div
            className="relative max-w-5xl w-full mx-auto flex-1 flex items-center justify-center my-3 min-h-0"
            onClick={(e) => e.stopPropagation()}
          >
            {activePhotos.length > 1 && (
              <button
                type="button"
                onClick={() => handleStepPhoto(-1)}
                aria-label="Foto sebelumnya"
                className="absolute left-1 sm:left-3 z-10 w-11 h-11 rounded-full bg-black/70 hover:bg-black/85 text-white border border-white/20 flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d9c382]"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}

            <img
              src={activePhoto.imageUrl}
              alt={activePhoto.caption || activeEntry.title}
              className="max-h-[70dvh] max-w-full rounded-xl object-contain border border-white/15 shadow-2xl"
            />

            {activePhotos.length > 1 && (
              <button
                type="button"
                onClick={() => handleStepPhoto(1)}
                aria-label="Foto berikutnya"
                className="absolute right-1 sm:right-3 z-10 w-11 h-11 rounded-full bg-black/70 hover:bg-black/85 text-white border border-white/20 flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d9c382]"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Keterangan Bawah */}
          <div
            className="max-w-3xl w-full mx-auto text-center space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs sm:text-sm text-emerald-50 leading-relaxed">
              {activePhoto.caption || activeEntry.summary}
            </p>
            {activePhotos.length > 1 && (
              <div className="flex items-center justify-center gap-1.5 pt-1">
                {activePhotos.map((p, idx) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPhotoIdx(idx)}
                    aria-label={`Tampilkan foto ${idx + 1}`}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      idx === safePhotoIdx ? 'w-7 bg-[#d9c382]' : 'w-2 bg-white/35 hover:bg-white/60'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
