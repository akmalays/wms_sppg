import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface CompressOptions {
  /** Maksimal dimensi (lebar atau tinggi) dalam pixel. Default 1600px (sangat tajam untuk surat jalan/timbangan) */
  maxDimension?: number;
  /** Kualitas kompresi WebP dari 0.1 sampai 1.0. Default 0.8 (sweet spot hemat ukuran & detail tajam) */
  quality?: number;
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

/**
 * Otomatis mengompresi dan mengonversi foto (JPG, PNG, HEIC, dll) ke format WebP di sisi browser (Client-Side).
 * Tidak membebani server dan menghemat kuota internet tim gudang hingga 90-95%.
 */
export async function compressImageToWebP(
  sourceFile: File,
  options: CompressOptions = {}
): Promise<CompressedImageResult> {
  const maxDim = options.maxDimension || 1600;
  const quality = options.quality || 0.8;

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

        // Ekspor ke WebP Blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Gagal mengonversi gambar ke WebP'));
              return;
            }

            // Ganti ekstensi file menjadi .webp
            const originalNameWithoutExt = sourceFile.name.replace(/\.[^/.]+$/, '');
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
