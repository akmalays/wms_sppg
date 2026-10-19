// Logika absen yang dipakai bersama oleh Mode absen (perangkat di pintu) dan halaman absen di HP karyawan.
// Sengaja tanpa import ke db/storage: halaman absen di HP tidak boleh ikut memuat seluruh data gudang.

import { lateMinutesFor, parseSchedule, toMinutes, workedMinutes } from './attendanceSchedule';

export interface AttendanceDayRecord {
  date: string;
  checkInTime?: string;
  checkOutTime?: string;
}

export type AttendanceDecision =
  | { kind: 'IN'; date: string; lateMinutes: number; flexible: boolean }
  | { kind: 'OUT'; date: string; checkIn: string; worked: number }
  | { kind: 'TOO_SOON'; checkIn: string }
  | { kind: 'COMPLETE'; checkIn: string; checkOut: string };

/** Jeda minimal antara masuk dan pulang; absen ulang lebih cepat dari ini dianggap tidak sengaja. */
export const MIN_SHIFT_MINUTES = 60;

/**
 * Menentukan absen berikutnya: masuk, pulang, atau sudah lengkap.
 * Shift lewat tengah malam (atau masuk mulai pukul 18:00) yang belum pulang dicatat pulangnya di hari masuk.
 */
export function decideAttendance(
  shift: string,
  today: string,
  now: string,
  todays?: AttendanceDayRecord,
  yesterday?: AttendanceDayRecord
): AttendanceDecision {
  const schedule = parseSchedule(shift);
  const yesterdayOpen = yesterday?.checkInTime && !yesterday.checkOutTime ? yesterday : undefined;
  const openOvernight =
    !todays && yesterdayOpen && (schedule.overnight || toMinutes(yesterdayOpen.checkInTime!) >= 18 * 60) ? yesterdayOpen : undefined;
  const open = todays?.checkInTime && !todays.checkOutTime ? todays : openOvernight;

  if (open?.checkInTime) {
    const worked = workedMinutes(open.checkInTime, now);
    if (worked < MIN_SHIFT_MINUTES) return { kind: 'TOO_SOON', checkIn: open.checkInTime };
    return { kind: 'OUT', date: open.date, checkIn: open.checkInTime, worked };
  }
  if (todays?.checkInTime && todays.checkOutTime) {
    return { kind: 'COMPLETE', checkIn: todays.checkInTime, checkOut: todays.checkOutTime };
  }
  return { kind: 'IN', date: today, lateMinutes: lateMinutesFor(now, schedule), flexible: schedule.flexible };
}

// ---------------------------------------------------------------------------
// Lokasi absen (geofence): titik SPPG dan radius, disimpan di app_settings.
// ---------------------------------------------------------------------------

export const GEOFENCE_SETTING_KEY = 'attendance_geofence';

export interface AttendanceGeofence {
  lat: number;
  lng: number;
  /** Radius dalam meter. */
  radius: number;
}

export const DEFAULT_GEOFENCE_RADIUS = 100;
/** Posisi dengan akurasi lebih buruk dari ini ditolak, karena bisa jadi tebakan dari jaringan, bukan GPS. */
export const MAX_GPS_ACCURACY_M = 150;

/** Jarak dua titik dalam meter (rumus haversine). */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

export function isValidGeofence(g: unknown): g is AttendanceGeofence {
  const v = g as AttendanceGeofence | null;
  return Boolean(v && Number.isFinite(v.lat) && Number.isFinite(v.lng) && Number.isFinite(v.radius) && v.radius > 0);
}

export const nowHHMM = (d = new Date()) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Tanggal lokal YYYY-MM-DD digeser sekian hari. */
export function shiftIsoDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
