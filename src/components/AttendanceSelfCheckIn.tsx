import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, MapPin, Search } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { localDateIso } from '../utils/localDate';
import { formatDuration, formatSchedule, parseSchedule } from '../utils/attendanceSchedule';
import {
  AttendanceDayRecord,
  AttendanceGeofence,
  GEOFENCE_SETTING_KEY,
  MAX_GPS_ACCURACY_M,
  decideAttendance,
  distanceMeters,
  isValidGeofence,
  nowHHMM,
  shiftIsoDate,
} from '../utils/attendanceAction';
import { BTN_PRIMARY, BTN_SECONDARY, FIELD_INPUT } from './common/FormDialog';
import logoSppgImg from '../assets/logo sppg.png';

// Halaman absen mandiri dari HP karyawan, dibuka lewat QR di lobby (/absen), tanpa login.
// Sengaja tidak memuat db/storage agar HP karyawan tidak mengunduh seluruh data gudang:
// hanya daftar karyawan aktif, lokasi absen, dan absensi orang itu yang dibaca langsung dari database.
//
// Pengaman: harus di dalam radius lokasi SPPG (GPS) dan foto wajah saat masuk. Aplikasi web tidak bisa
// mendeteksi aplikasi pemalsu GPS; foto, satpam, dan laporan absensi menjadi pemeriksa akhirnya.

interface PublicEmployee {
  id: string;
  name: string;
  department: string;
  position: string;
  shift: string;
}

interface DayRow extends AttendanceDayRecord {
  id: string;
  status: string;
  notes?: string | null;
}

type Phase =
  | { step: 'LOADING' }
  | { step: 'FATAL'; message: string }
  | { step: 'PICK' }
  | { step: 'READY' }
  | { step: 'WORKING'; label: string }
  | { step: 'DONE'; title: string; detail: string; tone: 'ok' | 'warn' }
  | { step: 'ERROR'; message: string };

const REMEMBER_KEY = 'sppg_absen_employee_id';

const readRemembered = () => {
  try {
    return localStorage.getItem(REMEMBER_KEY) || '';
  } catch {
    return '';
  }
};

// Foto dari kamera HP diperkecil ke lebar 200px (±6 KB) sebelum disimpan
async function compressPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Foto tidak bisa dibaca.'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = Math.round((img.naturalHeight / img.naturalWidth) * 200) || 200;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Foto tidak bisa diproses.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.55);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('HP ini tidak mendukung lokasi. Minta satpam mencatat absen Anda.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, err => {
      reject(
        new Error(
          err.code === err.PERMISSION_DENIED
            ? 'Izin lokasi ditolak. Buka pengaturan browser, izinkan lokasi untuk situs ini, lalu coba lagi.'
            : err.code === err.TIMEOUT
              ? 'Lokasi tidak ditemukan dalam 20 detik. Nyalakan GPS/lokasi HP, lalu coba lagi.'
              : 'Lokasi tidak bisa dibaca. Nyalakan GPS/lokasi HP, lalu coba lagi.'
        )
      );
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  });
}

export const AttendanceSelfCheckIn: React.FC = () => {
  const [phase, setPhase] = useState<Phase>({ step: 'LOADING' });
  const [employees, setEmployees] = useState<PublicEmployee[]>([]);
  const [geofence, setGeofence] = useState<AttendanceGeofence | null>(null);
  const [employeeId, setEmployeeId] = useState(readRemembered);
  const [query, setQuery] = useState('');
  const [records, setRecords] = useState<{ todays?: DayRow; yesterday?: DayRow }>({});
  const [clock, setClock] = useState(() => new Date());
  const fileRef = useRef<HTMLInputElement>(null);

  const employee = employees.find(e => e.id === employeeId);
  const today = localDateIso(clock);

  useEffect(() => {
    const t = window.setInterval(() => setClock(new Date()), 15000);
    return () => window.clearInterval(t);
  }, []);

  // Muat lokasi absen dan daftar karyawan aktif
  useEffect(() => {
    (async () => {
      if (!isSupabaseConfigured()) {
        setPhase({ step: 'FATAL', message: 'Aplikasi belum tersambung ke database. Hubungi admin.' });
        return;
      }
      const [geoRes, empRes] = await Promise.all([
        supabase.from('app_settings').select('value').eq('key', GEOFENCE_SETTING_KEY).maybeSingle(),
        supabase.from('employees').select('id,name,department,position,shift,status').neq('status', 'NONAKTIF').order('name'),
      ]);
      if (geoRes.error || empRes.error) {
        setPhase({ step: 'FATAL', message: 'Data absen gagal dimuat. Periksa internet HP, lalu muat ulang halaman.' });
        return;
      }
      const geo = (geoRes.data as { value?: unknown } | null)?.value;
      if (!isValidGeofence(geo)) {
        setPhase({ step: 'FATAL', message: 'Lokasi absen belum diatur. Minta admin mengatur lokasi absen di aplikasi.' });
        return;
      }
      setGeofence(geo);
      const list = ((empRes.data || []) as (PublicEmployee & { status: string })[]).map(e => ({
        id: e.id,
        name: e.name,
        department: e.department,
        position: e.position || '',
        shift: e.shift || '',
      }));
      setEmployees(list);
      setPhase({ step: list.some(e => e.id === readRemembered()) ? 'READY' : 'PICK' });
    })();
  }, []);

  // Absensi hari ini dan kemarin milik karyawan terpilih, untuk menentukan masuk atau pulang
  const loadRecords = async (empId: string) => {
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('id,date,check_in_time,check_out_time,status,notes')
      .eq('employee_id', empId)
      .in('date', [today, shiftIsoDate(today, -1)]);
    if (error) throw new Error('Data absen gagal dimuat. Periksa internet HP.');
    const rows: DayRow[] = (data || []).map((r: any) => ({
      id: r.id,
      date: r.date,
      checkInTime: r.check_in_time || undefined,
      checkOutTime: r.check_out_time || undefined,
      status: r.status,
      notes: r.notes,
    }));
    setRecords({ todays: rows.find(r => r.date === today), yesterday: rows.find(r => r.date !== today) });
  };

  useEffect(() => {
    if (phase.step !== 'READY' || !employeeId) return;
    loadRecords(employeeId).catch(err => setPhase({ step: 'ERROR', message: err.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.step, employeeId, today]);

  const decision = employee ? decideAttendance(employee.shift, today, nowHHMM(clock), records.todays, records.yesterday) : null;

  const chooseEmployee = (id: string) => {
    setEmployeeId(id);
    try {
      localStorage.setItem(REMEMBER_KEY, id);
    } catch {
      /* tidak diingat di HP ini, tetap bisa absen */
    }
    setQuery('');
    setPhase({ step: 'READY' });
  };

  // Lokasi wajib di dalam radius SPPG dan cukup akurat
  const checkLocation = async (): Promise<string> => {
    setPhase({ step: 'WORKING', label: 'Memeriksa lokasi…' });
    const pos = await getPosition();
    const accuracy = Math.round(pos.coords.accuracy);
    if (accuracy > MAX_GPS_ACCURACY_M) {
      throw new Error(`Lokasi kurang akurat (±${accuracy} m). Pindah ke dekat pintu atau ruang terbuka, tunggu sebentar, lalu coba lagi.`);
    }
    const distance = distanceMeters(pos.coords.latitude, pos.coords.longitude, geofence!.lat, geofence!.lng);
    if (distance > geofence!.radius) {
      throw new Error(`Anda berada ${distance.toLocaleString('id-ID')} m dari SPPG. Absen hanya bisa dalam radius ${geofence!.radius} m dari SPPG.`);
    }
    return `${distance} m dari SPPG (akurasi ±${accuracy} m)`;
  };

  const submitIn = async (file: File) => {
    if (!employee || decision?.kind !== 'IN') return;
    try {
      setPhase({ step: 'WORKING', label: 'Memproses foto…' });
      const photo = await compressPhoto(file);
      const locationNote = await checkLocation();
      setPhase({ step: 'WORKING', label: 'Menyimpan absen…' });
      const time = nowHHMM();
      const fresh = decideAttendance(employee.shift, today, time, records.todays, records.yesterday);
      const late = fresh.kind === 'IN' ? fresh.lateMinutes : 0;
      const { error } = await supabase.from('attendance_logs').upsert({
        id: `ATT-${today.replace(/-/g, '')}-${employee.id}`,
        date: today,
        employee_id: employee.id,
        employee_name: employee.name,
        department: employee.department,
        position: employee.position,
        shift: employee.shift,
        check_in_time: time,
        check_out_time: null,
        status: late > 0 ? 'TERLAMBAT' : 'HADIR',
        late_minutes: late,
        photo_url: photo,
        notes: `Absen mandiri. Masuk: ${locationNote}`,
        recorded_by: 'Absen mandiri (HP karyawan)',
        verified: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error('Absen gagal disimpan. Periksa internet HP, lalu coba lagi.');
      setPhase({
        step: 'DONE',
        title: `Masuk ${time}`,
        detail: decision.flexible ? 'Jam fleksibel' : late > 0 ? `Terlambat ${formatDuration(late)}` : 'Tepat waktu',
        tone: late > 0 ? 'warn' : 'ok',
      });
    } catch (err: any) {
      setPhase({ step: 'ERROR', message: err?.message || 'Absen gagal. Coba lagi.' });
    }
  };

  const submitOut = async () => {
    if (!employee || decision?.kind !== 'OUT') return;
    try {
      const locationNote = await checkLocation();
      setPhase({ step: 'WORKING', label: 'Menyimpan absen pulang…' });
      const time = nowHHMM();
      const row = decision.date === today ? records.todays : records.yesterday;
      const { error } = await supabase
        .from('attendance_logs')
        .update({
          check_out_time: time,
          notes: `${row?.notes ? `${row.notes} ` : ''}Pulang: ${locationNote}`.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq('id', row!.id);
      if (error) throw new Error('Absen pulang gagal disimpan. Periksa internet HP, lalu coba lagi.');
      setPhase({ step: 'DONE', title: `Pulang ${time}`, detail: `Lama kerja ${formatDuration(decision.worked)}`, tone: 'ok' });
    } catch (err: any) {
      setPhase({ step: 'ERROR', message: err?.message || 'Absen gagal. Coba lagi.' });
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? employees.filter(e => e.name.toLowerCase().includes(q) || e.department.toLowerCase().includes(q)) : employees;
  }, [employees, query]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <img src={logoSppgImg} alt="" className="w-9 h-9 object-contain" />
        <div className="min-w-0">
          <h1 className="text-sm font-semibold">Absen karyawan</h1>
          <p className="text-[11px] text-slate-600">SPPG Tumpang Jeru</p>
        </div>
        {/* Jam yang akan tercatat */}
        <div className="ml-auto text-right">
          <div className="text-lg font-bold font-mono tabular-nums">{nowHHMM(clock)}</div>
          <div className="text-[11px] text-slate-600">
            {clock.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-md mx-auto p-4 space-y-4">
        {phase.step === 'LOADING' && <p className="text-sm text-slate-700 text-center py-10">Memuat…</p>}

        {phase.step === 'FATAL' && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{phase.message}</div>
        )}

        {phase.step === 'PICK' && (
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="p-4 border-b border-slate-200 space-y-2">
              <h2 className="text-sm font-semibold">Pilih nama Anda</h2>
              <p className="text-xs text-slate-600">Cukup sekali. Nama diingat di HP ini untuk absen berikutnya.</p>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Cari nama atau bagian"
                  aria-label="Cari nama"
                  className={`${FIELD_INPUT} pl-8`}
                />
              </div>
            </div>
            {filtered.length === 0 ? (
              <p className="p-4 text-sm text-slate-600">Nama tidak ditemukan. Minta admin mendaftarkan Anda sebagai karyawan.</p>
            ) : (
              <ul className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
                {filtered.map(e => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => chooseEmployee(e.id)}
                      className="w-full text-left px-4 py-3 min-h-[56px] hover:bg-slate-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600"
                    >
                      <div className="text-sm font-semibold">{e.name}</div>
                      <div className="text-xs text-slate-600">{e.department}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {employee && phase.step !== 'PICK' && phase.step !== 'FATAL' && phase.step !== 'LOADING' && (
          <section className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-base font-bold truncate">{employee.name}</div>
              <div className="text-xs text-slate-600">
                {employee.department} · {formatSchedule(parseSchedule(employee.shift))}
              </div>
            </div>
            {(phase.step === 'READY' || phase.step === 'ERROR') && (
              <button type="button" onClick={() => setPhase({ step: 'PICK' })} className={`${BTN_SECONDARY} shrink-0`}>
                Bukan saya
              </button>
            )}
          </section>
        )}

        {employee && phase.step === 'READY' && decision && (
          <section className="space-y-3">
            {decision.kind === 'IN' && (
              <>
                <p className="text-sm text-slate-800">
                  Ambil foto wajah Anda. Lokasi HP diperiksa otomatis, pastikan Anda sudah di lokasi SPPG.
                </p>
                <button type="button" onClick={() => fileRef.current?.click()} className={`${BTN_PRIMARY} w-full min-h-[52px] text-sm`}>
                  <Camera className="w-5 h-5" />
                  Foto &amp; absen masuk
                </button>
              </>
            )}
            {decision.kind === 'OUT' && (
              <>
                <p className="text-sm text-slate-800">
                  Masuk pukul <b className="font-mono">{decision.checkIn}</b>. Lokasi HP diperiksa otomatis saat absen pulang.
                </p>
                <button type="button" onClick={submitOut} className={`${BTN_PRIMARY} w-full min-h-[52px] text-sm`}>
                  <MapPin className="w-5 h-5" />
                  Absen pulang
                </button>
              </>
            )}
            {decision.kind === 'TOO_SOON' && (
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
                Anda sudah absen masuk pukul <b className="font-mono">{decision.checkIn}</b>. Buka halaman ini lagi saat pulang.
              </div>
            )}
            {decision.kind === 'COMPLETE' && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                Absen hari ini sudah lengkap: masuk <b className="font-mono">{decision.checkIn}</b>, pulang{' '}
                <b className="font-mono">{decision.checkOut}</b>.
              </div>
            )}
          </section>
        )}

        {phase.step === 'WORKING' && (
          <p role="status" className="text-sm text-slate-800 text-center py-6">{phase.label}</p>
        )}

        {phase.step === 'DONE' && (
          <section
            role="status"
            className={`rounded-xl border p-5 text-center ${phase.tone === 'warn' ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}
          >
            <div className="text-2xl font-bold font-mono tabular-nums">{phase.title}</div>
            <div className={`mt-1 text-sm font-medium ${phase.tone === 'warn' ? 'text-amber-800' : 'text-emerald-800'}`}>{phase.detail}</div>
            <p className="mt-3 text-xs text-slate-700">Absen tersimpan. Halaman ini boleh ditutup.</p>
          </section>
        )}

        {phase.step === 'ERROR' && (
          <section className="space-y-3">
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{phase.message}</div>
            <button type="button" onClick={() => setPhase({ step: 'READY' })} className={`${BTN_SECONDARY} w-full`}>
              Coba lagi
            </button>
          </section>
        )}

        {/* Kamera depan HP; foto diproses setelah dipilih */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="user"
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
          onChange={e => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) submitIn(file);
          }}
        />
      </main>
    </div>
  );
};

export default AttendanceSelfCheckIn;
