// Bagian kerja dan jam kerja karyawan SPPG. Jam kerja disimpan sebagai teks di kolom `shift`
// (tanpa perubahan tabel): "HH:MM - HH:MM" untuk jam tetap, atau "Fleksibel".

export const WORK_SECTIONS = ['Pengolahan', 'Persiapan', 'Pemorsian', 'Cuci Ompreng', 'Satpam', 'Staf'] as const;

export const FLEXIBLE_SCHEDULE = 'Fleksibel';

/** Toleransi keterlambatan: datang sampai 10 menit setelah jam mulai masih dianggap tepat waktu. */
export const LATE_GRACE_MINUTES = 10;

export interface WorkSchedule {
  flexible: boolean;
  start?: string; // HH:MM
  end?: string; // HH:MM
  /** Jam pulang lebih kecil dari jam masuk, mis. satpam 18:00 - 06:00. */
  overnight: boolean;
}

/** Membaca "04:00 - 12:00", "Fleksibel", dan format lama "Pagi (05:00 - 13:00)". */
export function parseSchedule(shift: string | undefined): WorkSchedule {
  const text = (shift || '').trim();
  if (!text || /fleksibel/i.test(text)) return { flexible: true, overnight: false };
  const m = text.match(/(\d{1,2})[:.](\d{2})\s*[-–]\s*(\d{1,2})[:.](\d{2})/);
  if (!m) return { flexible: true, overnight: false };
  const start = `${m[1].padStart(2, '0')}:${m[2]}`;
  const end = `${m[3].padStart(2, '0')}:${m[4]}`;
  return { flexible: false, start, end, overnight: end < start };
}

export function formatSchedule(s: WorkSchedule): string {
  return s.flexible || !s.start || !s.end ? FLEXIBLE_SCHEDULE : `${s.start} - ${s.end}`;
}

export const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.replace('.', ':').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/**
 * Menit terlambat dari jam mulai (0 bila tepat waktu atau jam fleksibel).
 * Hanya dihitung bila lewat dari toleransi; angkanya tetap dihitung dari jam mulai.
 */
export function lateMinutesFor(checkIn: string, schedule: WorkSchedule): number {
  if (schedule.flexible || !schedule.start) return 0;
  let diff = toMinutes(checkIn) - toMinutes(schedule.start);
  // Selisih dinormalkan ke rentang ±12 jam di sekitar jam mulai, agar lintas tengah malam benar:
  // 23:55 untuk shift 00:00 = datang 5 menit lebih awal; 00:20 untuk shift 23:50 = terlambat 30 menit.
  if (diff > 12 * 60) diff -= 24 * 60;
  if (diff < -12 * 60) diff += 24 * 60;
  return diff > LATE_GRACE_MINUTES ? diff : 0;
}

/** Lama kerja dari jam masuk ke jam pulang, mendukung pulang lewat tengah malam. */
export function workedMinutes(checkIn?: string, checkOut?: string): number {
  if (!checkIn || !checkOut) return 0;
  let diff = toMinutes(checkOut) - toMinutes(checkIn);
  if (diff < 0) diff += 24 * 60;
  return diff;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} jam${m > 0 ? ` ${m} menit` : ''}` : `${m} menit`;
}
