import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface TimestampWatermarkOptions {
  /** Baris utama stempel waktu, mis. "23 Nov 2026 · 14.25.08 WIB" */
  primary: string;
  /** Baris sekunder opsional, mis. "SPPG MLG Tumpang Jeru · Sisa makanan · Akmal" */
  secondary?: string;
}

export interface CompressOptions {
  /** Maksimal dimensi (lebar atau tinggi) dalam pixel. Default 1600px (sangat tajam untuk surat jalan/timbangan) */
  maxDimension?: number;
  /** Kualitas kompresi WebP dari 0.1 sampai 1.0. Default 0.8 (sweet spot hemat ukuran & detail tajam) */
  quality?: number;
  /** Stempel waktu yang dibakar langsung di sudut bawah foto sebelum dikompresi */
  timestampWatermark?: TimestampWatermarkOptions;
}

export interface CompressedImageResult {
  file: File;
  blob: Blob;
  dataUrl: string;
  originalSizeKb: number;
  compressedSizeKb: number;
  compressionRatioPercent: number;
  dimensions: { width: number; height: number };
}

const SHORT_MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** Format stempel waktu lokal ringkas untuk foto dan tampilan UI, mis. "23 Nov 2026 · 14.25.08 WIB". */
export function formatPhotoTimestamp(input: Date | string = new Date(), withSeconds = true): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return typeof input === 'string' ? input : '-';
  const day = String(d.getDate()).padStart(2, '0');
  const mon = SHORT_MONTHS_ID[d.getMonth()] || '';
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const timeStr = withSeconds ? `${hh}.${mm}.${ss}` : `${hh}.${mm}`;
  const tzOffsetMin = -d.getTimezoneOffset();
  const tzLabel = tzOffsetMin === 420 ? 'WIB' : tzOffsetMin === 480 ? 'WITA' : tzOffsetMin === 540 ? 'WIT' : '';
  return `${day} ${mon} ${year} · ${timeStr}${tzLabel ? ` ${tzLabel}` : ''}`;
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function trimTextToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 3 && ctx.measureText(`${trimmed}...`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}...`;
}

function renderTimestampWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  watermark: TimestampWatermarkOptions
): void {
  const scale = Math.max(width, height) / 1200;
  const margin = Math.max(12, Math.round(20 * scale));
  const padX = Math.max(10, Math.round(16 * scale));
  const padY = Math.max(8, Math.round(11 * scale));
  const primarySize = Math.max(15, Math.round(24 * scale));
  const secondarySize = Math.max(11, Math.round(16 * scale));
  const lineGap = watermark.secondary ? Math.max(4, Math.round(6 * scale)) : 0;
  const maxBoxWidth = Math.max(120, width - margin * 2);
  const maxTextWidth = Math.max(80, maxBoxWidth - padX * 2);

  ctx.save();
  ctx.textBaseline = 'top';

  const primaryFont = `700 ${primarySize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
  const secondaryFont = `500 ${secondarySize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

  ctx.font = primaryFont;
  const primaryText = trimTextToWidth(ctx, watermark.primary, maxTextWidth);
  const primaryW = ctx.measureText(primaryText).width;

  let secondaryText = '';
  let secondaryW = 0;
  if (watermark.secondary) {
    ctx.font = secondaryFont;
    secondaryText = trimTextToWidth(ctx, watermark.secondary, maxTextWidth);
    secondaryW = ctx.measureText(secondaryText).width;
  }

  const boxW = Math.min(maxBoxWidth, Math.ceil(Math.max(primaryW, secondaryW) + padX * 2));
  const boxH = Math.ceil(padY * 2 + primarySize + (secondaryText ? lineGap + secondarySize : 0));
  const boxX = margin;
  const boxY = Math.max(margin, height - margin - boxH);

  drawRoundedRect(ctx, boxX, boxY, boxW, boxH, Math.max(6, Math.round(10 * scale)));
  ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = primaryFont;
  ctx.fillText(primaryText, boxX + padX, boxY + padY);

  if (secondaryText) {
    ctx.fillStyle = '#e2e8f0';
    ctx.font = secondaryFont;
    ctx.fillText(secondaryText, boxX + padX, boxY + padY + primarySize + lineGap);
  }
  ctx.restore();
}

/**
 * Otomatis mengompresi dan mengonversi foto (JPG, PNG, HEIC, dll) ke format WebP di sisi browser (Client-Side).
 * Tidak membebani server dan menghemat kuota internet tim gudang hingga 90-95%.
 */
export async function compressImageToWebP(
  sourceFile: File | Blob,
  options: CompressOptions = {}
): Promise<CompressedImageResult> {
  const maxDim = options.maxDimension || 1600;
  const quality = options.quality || 0.8;
  const sourceName = sourceFile instanceof File && sourceFile.name ? sourceFile.name : `foto-${Date.now()}.jpg`;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Gagal memproses gambar'));
      img.onload = () => {
        let width = img.naturalWidth;
        let height = img.naturalHeight;

        // Hitung skala resize proporsional
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        // Render ke canvas off-screen
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context tidak tersedia'));
          return;
        }

        // Gambar dengan smoothing berkualitas tinggi
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        if (options.timestampWatermark?.primary) {
          renderTimestampWatermark(ctx, width, height, options.timestampWatermark);
        }

        // Ekspor ke WebP Blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Gagal mengonversi gambar ke WebP'));
              return;
            }

            // Ganti ekstensi file menjadi .webp
            const originalNameWithoutExt = sourceName.replace(/\.[^/.]+$/, '');
            const newFileName = `${originalNameWithoutExt}.webp`;
            const webpFile = new File([blob], newFileName, {
              type: 'image/webp',
              lastModified: Date.now(),
            });

            const originalSizeKb = Math.round(sourceFile.size / 1024);
            const compressedSizeKb = Math.round(blob.size / 1024);
            const savedPercent = originalSizeKb > 0
              ? Math.round(((originalSizeKb - compressedSizeKb) / originalSizeKb) * 100)
              : 0;

            const dataUrl = canvas.toDataURL('image/webp', quality);

            resolve({
              file: webpFile,
              blob,
              dataUrl,
              originalSizeKb,
              compressedSizeKb,
              compressionRatioPercent: savedPercent,
              dimensions: { width, height },
            });
          },
          'image/webp',
          quality
        );
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(sourceFile);
  });
}

/**
 * Upload file hasil kompresi ke Supabase Storage bucket.
 * Jika Supabase belum disetup / offline, otomatis fallback mengembalikan Data URL lokal.
 */
export async function uploadDocumentationPhoto(
  file: File | Blob,
  folder: 'receiving' | 'waste' | 'menu' | 'profile' = 'receiving'
): Promise<{ url: string; error?: string; isLocalFallback: boolean }> {
  // Jika Supabase belum dikonfigurasi, gunakan fallback base64 Data URL
  if (!isSupabaseConfigured()) {
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    return { url: dataUrl, isLocalFallback: true };
  }

  try {
    const bucketName = 'sppg-documentation';
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const fileName = `${folder}/${timestamp}_${randomSuffix}.webp`;

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, file, {
        contentType: 'image/webp',
        cacheControl: '31536000', // 1 tahun cache di browser
        upsert: false,
      });

    if (uploadError) {
      console.warn('Gagal upload ke Supabase Storage, menggunakan fallback dataUrl:', uploadError.message);
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      return { url: dataUrl, error: uploadError.message, isLocalFallback: true };
    }

    // Dapatkan Public URL
    const { data } = supabase.storage.from(bucketName).getPublicUrl(fileName);
    return { url: data.publicUrl, isLocalFallback: false };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    return { url: dataUrl, error: errorMsg, isLocalFallback: true };
  }
}

/**
 * Hapus foto dari bucket dokumentasi berdasarkan URL publiknya, agar foto yang dibuang tidak terus memakan kuota.
 * URL data lokal (fallback tanpa Supabase) tidak perlu dihapus dari mana pun.
 */
export async function deleteDocumentationPhoto(url: string): Promise<void> {
  const marker = '/object/public/sppg-documentation/';
  const at = url.indexOf(marker);
  if (!isSupabaseConfigured() || at < 0) return;
  const path = decodeURIComponent(url.slice(at + marker.length).split('?')[0]);
  const { error } = await supabase.storage.from('sppg-documentation').remove([path]);
  if (error) console.warn('Gagal menghapus foto dari storage:', error.message);
}
