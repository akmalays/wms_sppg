// Setelan hapus background. Bawaan library selalu menghitung di CPU dengan satu thread (situs tidak
// crossOriginIsolated), sekitar 8 detik per foto. Dengan WebGPU, model yang sama selesai sekitar 0,5 sampai 2 detik.
// Model tetap fp16 di kedua jalur: quint8 tidak lebih cepat di CPU dan justru lambat di WebGPU,
// dan fp16 sudah tersimpan di cache browser petugas yang pernah memakai fitur ini.
// Library menyimpan sesi model per setelan (JSON), jadi preload dan proses harus memakai setelan yang sama persis.
type BgRemovalConfig = {device: "gpu" | "cpu"; model: "isnet_fp16"; output: {format: "image/png"}};
let bgConfigPromise: Promise<BgRemovalConfig> | null = null;
const bgRemovalConfig = () =>
  (bgConfigPromise ??= (async () => {
    const gpu = (navigator as Navigator & {gpu?: {requestAdapter: () => Promise<unknown>}}).gpu;
    const hasGpu = Boolean(gpu && (await gpu.requestAdapter().catch(() => null)));
    return {device: hasGpu ? "gpu" : "cpu", model: "isnet_fp16", output: {format: "image/png"}};
  })());

// Unduh dan siapkan model di belakang layar begitu ada foto nampan, supaya saat tombol ditekan tinggal menghitung.
let bgPreloaded: Promise<void> | null = null;
export const preloadBgRemoval = () => {
  bgPreloaded ??= (async () => {
    const [{preload}, config] = await Promise.all([import("@imgly/background-removal"), bgRemovalConfig()]);
    await preload(config);
  })().catch(() => {
    bgPreloaded = null; // gagal (mis. offline): coba lagi di kesempatan berikutnya
  });
  return bgPreloaded;
};

// Buang tepi transparan hasil hapus background, agar nampan memenuhi kotak saat digambar.
async function trimTransparent(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return blob;
  ctx.drawImage(bitmap, 0, 0);
  const {data, width, height} = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error("Nampan tidak terdeteksi.");
  const out = document.createElement("canvas");
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext("2d")?.drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return new Promise((resolve, reject) => out.toBlob((b) => (b ? resolve(b) : reject(new Error("Gagal memotong gambar."))), "image/png"));
}

const SOLID_ALPHA = 128;
// Lebar tepi lembut yang dibiarkan apa adanya, supaya pinggir nampan tidak jadi bergerigi.
const EDGE_PX = 3;

/**
 * Rapikan hasil model: serpihan di luar nampan (sobekan kertas, titik) dibuang, dan lubang di dalam nampan ditambal dari
 * foto asli. Pantulan logam yang putih sering dikira background, padahal nampan tidak punya lubang.
 */
async function cleanCutout(blob: Blob, source: string): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const {width, height} = bitmap;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", {willReadFrequently: true});
  if (!ctx) return blob;
  ctx.drawImage(bitmap, 0, 0);
  const image = ctx.getImageData(0, 0, width, height);
  const {data} = image;
  const alphaAt = (i: number) => data[i * 4 + 3];
  const total = width * height;
  const neighbours = (i: number, visit: (n: number) => void) => {
    const x = i % width;
    if (x > 0) visit(i - 1);
    if (x < width - 1) visit(i + 1);
    if (i >= width) visit(i - width);
    if (i < total - width) visit(i + width);
  };

  // Bagian padat terbesar adalah nampan.
  const component = new Int32Array(total);
  let bestId = 0, bestSize = 0, nextId = 0;
  const stack: number[] = [];
  for (let start = 0; start < total; start++) {
    if (component[start] || alphaAt(start) < SOLID_ALPHA) continue;
    const id = ++nextId;
    let size = 0;
    component[start] = id;
    stack.push(start);
    while (stack.length) {
      const i = stack.pop()!;
      size++;
      neighbours(i, (n) => {
        if (!component[n] && alphaAt(n) >= SOLID_ALPHA) {
          component[n] = id;
          stack.push(n);
        }
      });
    }
    if (size > bestSize) {
      bestSize = size;
      bestId = id;
    }
  }
  if (!bestId) return blob;

  // Area luar: menyebar dari tepi gambar lewat piksel yang bukan nampan. Yang tidak terjangkau berarti di dalam nampan.
  const outside = new Uint8Array(total);
  const edgeStart = (i: number) => {
    if (component[i] !== bestId && !outside[i]) {
      outside[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < width; x++) {
    edgeStart(x);
    edgeStart(total - width + x);
  }
  for (let y = 0; y < height; y++) {
    edgeStart(y * width);
    edgeStart(y * width + width - 1);
  }
  while (stack.length) neighbours(stack.pop()!, edgeStart);

  const nearOutside = outside.slice();
  let ring: number[] = [];
  for (let i = 0; i < total; i++) if (outside[i]) ring.push(i);
  for (let step = 0; step < EDGE_PX; step++) {
    const next: number[] = [];
    for (const i of ring) {
      neighbours(i, (n) => {
        if (!nearOutside[n]) {
          nearOutside[n] = 1;
          next.push(n);
        }
      });
    }
    ring = next;
  }

  // Foto asli gagal dimuat: serpihan tetap dibuang, lubang dibiarkan.
  let original: Uint8ClampedArray | null = null;
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = source;
    await img.decode();
    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = width;
    sourceCanvas.height = height;
    const sourceCtx = sourceCanvas.getContext("2d", {willReadFrequently: true});
    if (sourceCtx) {
      sourceCtx.drawImage(img, 0, 0, width, height);
      original = sourceCtx.getImageData(0, 0, width, height).data;
    }
  } catch {
    original = null;
  }

  for (let i = 0; i < total; i++) {
    const p = i * 4;
    if (outside[i]) {
      // Tepi lembut nampan tetap, serpihan yang jauh dari nampan dihapus.
      if (!nearNampan(i)) data[p + 3] = 0;
    } else if (!nearOutside[i] && data[p + 3] < 255 && original) {
      data[p] = original[p];
      data[p + 1] = original[p + 1];
      data[p + 2] = original[p + 2];
      data[p + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Gagal merapikan gambar."))), "image/png"));

  function nearNampan(i: number): boolean {
    const x = i % width;
    const y = (i - x) / width;
    for (let dy = -EDGE_PX; dy <= EDGE_PX; dy++) {
      for (let dx = -EDGE_PX; dx <= EDGE_PX; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height && component[ny * width + nx] === bestId) return true;
      }
    }
    return false;
  }
}

// Sudut kemiringan nampan: sudut putar dengan kotak pembatas terkecil. Nampan berbentuk persegi panjang, jadi kotak
// terkecil didapat saat sisinya sejajar sumbu. Dihitung pada salinan kecil dan hanya titik tepi kiri dan kanan tiap baris.
function trayTiltDegrees(bitmap: ImageBitmap): number {
  const scale = Math.min(1, 240 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d", {willReadFrequently: true});
  if (!ctx) return 0;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const {data, width, height} = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const edge: [number, number][] = [];
  for (let y = 0; y < height; y++) {
    let first = -1, last = -1;
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 128) {
        if (first < 0) first = x;
        last = x;
      }
    }
    if (first >= 0) edge.push([first, y], [last, y]);
  }
  let best = 0, bestArea = Infinity;
  for (let deg = -45; deg <= 45; deg += 0.5) {
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of edge) {
      const rx = x * cos - y * sin;
      const ry = x * sin + y * cos;
      if (rx < minX) minX = rx;
      if (rx > maxX) maxX = rx;
      if (ry < minY) minY = ry;
      if (ry > maxY) maxY = ry;
    }
    const area = (maxX - minX) * (maxY - minY);
    // Hasil seri atau hampir seri: pilih putaran terkecil, supaya nampan yang sudah lurus tidak ikut diputar.
    if (area < bestArea * 0.995 || (area <= bestArea * 1.005 && Math.abs(deg) < Math.abs(best))) {
      bestArea = Math.min(area, bestArea);
      best = deg;
    }
  }
  return best;
}

/** Luruskan potongan nampan yang miring, lalu buang lagi tepi transparannya. */
export async function straightenCutout(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const deg = trayTiltDegrees(bitmap);
  if (deg === 0) return trimTransparent(blob);
  const rad = (deg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(bitmap.width * cos + bitmap.height * sin);
  canvas.height = Math.ceil(bitmap.width * sin + bitmap.height * cos);
  const ctx = canvas.getContext("2d");
  if (!ctx) return trimTransparent(blob);
  ctx.imageSmoothingQuality = "high";
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  const rotated = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Gagal meluruskan gambar."))), "image/png"));
  return trimTransparent(rotated);
}

/**
 * Hapus background foto nampan. source boleh data URL atau alamat gambar; alamat relatif dijadikan absolut
 * karena library membaca alamat relatif terhadap CDN modelnya, bukan terhadap situs ini.
 */
export async function cutoutTrayPhoto(source: string, onStatus?: (status: string) => void): Promise<Blob> {
  onStatus?.("Menyiapkan...");
  // Library dimuat saat dipakai saja. Model diunduh sekali lalu disimpan cache browser; biasanya sudah
  // disiapkan oleh preload sejak foto diunggah.
  const [{removeBackground}, config] = await Promise.all([import("@imgly/background-removal"), bgRemovalConfig()]);
  const absolute = source.startsWith("data:") ? source : new URL(source, window.location.href).href;
  const blob = await removeBackground(absolute, {
    ...config,
    progress: (key: string, current: number, total: number) => {
      if (key.startsWith("fetch") && total > 0) onStatus?.(`Mengunduh model ${Math.round((current / total) * 100)}%`);
      else if (key.startsWith("compute")) onStatus?.("Menghapus background...");
    },
  });
  return straightenCutout(await cleanCutout(blob, absolute));
}
