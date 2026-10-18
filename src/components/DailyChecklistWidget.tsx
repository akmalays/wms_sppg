import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Select } from './common/Select';
import { useAuth } from '../context/AuthContext';
import { warehouseDb } from '../db/storage';
import { DailyTodoItem, TodoCategory, TodoPriority } from '../types/warehouse';
import { localDateIso } from '../utils/localDate';
import {
  CheckSquare,
  Clock,
  Plus,
  AlertCircle,
  Check,
  CheckCircle2,
  Users,
  Bell,
  BellOff,
  ArrowRight,
  Flame,
  X,
} from 'lucide-react';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1';
const SOUND_KEY = 'sppg_jobdesk_reminder_sound';

const CATEGORIES: TodoCategory[] = ['Penerimaan & QC', 'Persiapan Dapur', 'Sanitasi & Kebersihan', 'Administrasi & Stok', 'Stock Opname', 'Distribusi'];

/**
 * Nada pengingat lembut memakai Web Audio API (tanpa file MP3).
 * Satu AudioContext dipakai ulang: browser hanya mengizinkan suara setelah ada interaksi,
 * dan context yang sudah diizinkan tetap bisa berbunyi untuk pengingat berikutnya.
 */
let audioCtx: AudioContext | null = null;
function playReminderChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx ?? new Ctx();
    const ctx = audioCtx;
    void ctx.resume();
    // Dua nada: D5 lalu A5.
    [
      { freq: 587.33, start: 0, end: 0.35 },
      { freq: 880, start: 0.18, end: 0.7 },
    ].forEach(({ freq, start, end }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0.12, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + end);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + end);
    });
  } catch (err) {
    console.warn('Nada pengingat tidak bisa diputar:', err);
  }
}

function readSoundPref(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

const nowHHMM = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

// Lewat lebih dari 15 menit dari target jam dan belum selesai.
function isTaskOverdue(todo: DailyTodoItem, current: string): boolean {
  if (todo.isCompleted || !todo.targetTime) return false;
  const [h, m] = todo.targetTime.split(':').map(Number);
  const [curH, curM] = current.split(':').map(Number);
  return h * 60 + m < curH * 60 + curM - 15;
}

interface DailyChecklistWidgetProps {
  onNavigateToProfileTodos?: () => void;
}

// Tidak memicu onRefreshData dashboard: itu me-mount ulang seluruh dashboard sehingga filter dan
// pengingat di widget ini ter-reset setiap kali satu tugas dicentang. Bagian lain dashboard tidak memakai data jobdesk.
export const DailyChecklistWidget: React.FC<DailyChecklistWidgetProps> = ({ onNavigateToProfileTodos }) => {
  const { currentUser, availableUsers } = useAuth();

  // Tanggal lokal (WIB). toISOString() memakai UTC sehingga sebelum 07.00 WIB tanggalnya mundur sehari.
  const [todayStr, setTodayStr] = useState(localDateIso);
  const [currentTimeStr, setCurrentTimeStr] = useState(nowHHMM);
  const [todos, setTodos] = useState<DailyTodoItem[]>(() => warehouseDb.getDailyTodos(localDateIso()));

  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>('ALL'); // 'ALL' | 'ME' | userId
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'PENDING' | 'DONE'>('ALL');

  const [soundOn, setSoundOn] = useState(readSoundPref);
  const [lastReminder, setLastReminder] = useState<{ time: string; titles: string[] } | null>(null);
  const remindedRef = useRef<Set<string>>(new Set());

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addError, setAddError] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newTargetTime, setNewTargetTime] = useState(() => `${nowHHMM().slice(0, 2)}:00`);
  const [newCategory, setNewCategory] = useState<TodoCategory>('Penerimaan & QC');
  const [newPriority, setNewPriority] = useState<TodoPriority>('Tinggi');
  const [newSession, setNewSession] = useState<'Pagi' | 'Siang' | 'Sore' | 'Harian'>('Pagi');
  const [newAssignedUserId, setNewAssignedUserId] = useState<string>('');
  const [newNotes, setNewNotes] = useState('');

  const refreshTodoList = useCallback(() => setTodos(warehouseDb.getDailyTodos(todayStr)), [todayStr]);

  // Jam dan tanggal diperbarui tiap 30 detik, jadi lewat tengah malam ceklis otomatis berganti hari.
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeStr(nowHHMM());
      setTodayStr(localDateIso());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setTodos(warehouseDb.getDailyTodos(todayStr));
    remindedRef.current = new Set();
    setLastReminder(null);
  }, [todayStr]);

  // Tugas yang dicentang di perangkat lain ikut muncul.
  useEffect(() => {
    const onSync = () => setTodos(warehouseDb.getDailyTodos(todayStr));
    window.addEventListener('sppg_warehouse_sync', onSync);
    return () => window.removeEventListener('sppg_warehouse_sync', onSync);
  }, [todayStr]);

  // Pengingat: tepat saat jam target tiba (selama aplikasi terbuka), sekali per tugas.
  // Tugas yang jamnya sudah lewat saat halaman dibuka tidak dibunyikan serentak.
  useEffect(() => {
    const due = todos.filter(t => !t.isCompleted && t.targetTime === currentTimeStr && !remindedRef.current.has(t.id));
    if (due.length === 0) return;
    due.forEach(t => remindedRef.current.add(t.id));
    setLastReminder({ time: currentTimeStr, titles: due.map(t => t.title) });
    if (soundOn) playReminderChime();
  }, [currentTimeStr, todos, soundOn]);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    try {
      localStorage.setItem(SOUND_KEY, next ? 'on' : 'off');
    } catch {
      /* mode privat: pilihan hanya bertahan selama halaman terbuka */
    }
    // Klik ini sekaligus memberi izin suara ke browser, dan memperdengarkan bunyinya.
    if (next) playReminderChime();
  };

  const handleToggle = (todoId: string) => {
    warehouseDb.toggleTodo(todoId, currentUser);
    refreshTodoList();
  };

  // Belum selesai di atas (urut jam), yang sudah selesai di bawah.
  const filteredTodos = useMemo(() => {
    return todos
      .filter(t => {
        if (selectedStaffFilter === 'ME') {
          const isMine = t.assignedUserId === currentUser.id || (!t.assignedUserId && (t.assignedRole === currentUser.role || t.assignedRole === 'ALL'));
          if (!isMine) return false;
        } else if (selectedStaffFilter !== 'ALL' && t.assignedUserId !== selectedStaffFilter) {
          return false;
        }
        if (selectedCategoryFilter !== 'ALL' && t.category !== selectedCategoryFilter) return false;
        if (selectedStatusFilter === 'PENDING' && t.isCompleted) return false;
        if (selectedStatusFilter === 'DONE' && !t.isCompleted) return false;
        return true;
      })
      .sort((a, b) => Number(a.isCompleted) - Number(b.isCompleted) || (a.targetTime || '99:99').localeCompare(b.targetTime || '99:99'));
  }, [todos, selectedStaffFilter, selectedCategoryFilter, selectedStatusFilter, currentUser]);

  const totalCount = todos.length;
  const completedCount = todos.filter(t => t.isCompleted).length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const currentHourNum = parseInt(currentTimeStr.split(':')[0], 10);
  const currentHourTasks = todos.filter(t => t.targetTime && parseInt(t.targetTime.split(':')[0], 10) === currentHourNum);
  const overdueCount = todos.filter(t => isTaskOverdue(t, currentTimeStr)).length;

  const closeAddModal = useCallback(() => {
    setIsAddModalOpen(false);
    setAddError('');
  }, []);

  useEffect(() => {
    if (!isAddModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAddModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isAddModalOpen, closeAddModal]);

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setAddError('Uraian tugas wajib diisi.');
      return;
    }
    const assignedUser = availableUsers.find(u => u.id === newAssignedUserId);
    warehouseDb.addTodo(
      {
        date: todayStr,
        title: newTitle.trim(),
        category: newCategory,
        priority: newPriority,
        session: newSession,
        targetTime: newTargetTime || undefined,
        assignedUserId: assignedUser?.id,
        assignedUserName: assignedUser?.name,
        assignedRole: assignedUser ? assignedUser.role : 'ALL',
        notes: newNotes.trim() || undefined,
        isCompleted: false,
      },
      currentUser
    );
    setNewTitle('');
    setNewNotes('');
    closeAddModal();
    refreshTodoList();
  };

  const statusPills: { key: typeof selectedStatusFilter; label: string; count: number }[] = [
    { key: 'ALL', label: 'Semua', count: totalCount },
    { key: 'PENDING', label: 'Belum', count: totalCount - completedCount },
    { key: 'DONE', label: 'Selesai', count: completedCount },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* 1. Judul, jam, pengingat */}
      <div className="p-5 border-b border-slate-200">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-emerald-700" />
              Jobdesk Hari Ini
            </h3>
            <p className="text-xs text-slate-600 mt-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span className="font-mono tabular-nums">{currentTimeStr}</span> WIB · Centang tugas yang sudah selesai.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start">
            <button
              type="button"
              onClick={toggleSound}
              aria-pressed={soundOn}
              className={`inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${FOCUS} ${
                soundOn ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}>
              {soundOn ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              Suara pengingat {soundOn ? 'nyala' : 'mati'}
            </button>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className={`inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer transition-colors ${FOCUS}`}>
              <Plus className="w-4 h-4" />
              Tambah Jobdesk
            </button>
          </div>
        </div>

        {/* Ringkasan jam ini */}
        <div aria-live="polite" className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <p className="text-slate-700">
            <span className="font-semibold text-slate-900">
              Jam {String(currentHourNum).padStart(2, '0')}.00–{String((currentHourNum + 1) % 24).padStart(2, '0')}.00:
            </span>{' '}
            {currentHourTasks.length > 0
              ? `${currentHourTasks.length} tugas terjadwal, ${currentHourTasks.filter(t => !t.isCompleted).length} belum selesai.`
              : 'Tidak ada tugas terjadwal di jam ini.'}
          </p>
          {overdueCount > 0 && (
            <p className="inline-flex items-center gap-1.5 self-start rounded-md bg-rose-50 border border-rose-200 text-rose-800 px-2.5 py-1 font-semibold">
              <AlertCircle className="w-3.5 h-3.5" />
              {overdueCount} tugas lewat target jam
            </p>
          )}
        </div>
        {lastReminder && (
          <div role="status" className="mt-3 flex items-start justify-between gap-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
            <p>
              <Bell className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
              <span className="font-semibold">Waktunya ({lastReminder.time}):</span> {lastReminder.titles.join('; ')}
            </p>
            <button
              type="button"
              onClick={() => setLastReminder(null)}
              aria-label="Tutup pengingat"
              className={`shrink-0 -m-1 p-1 rounded-md text-amber-900 hover:bg-amber-100 cursor-pointer ${FOCUS}`}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* 2. Progres & filter */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-slate-800">Progres hari ini</span>
            <span className="text-slate-700">
              <span className="font-mono tabular-nums font-semibold text-emerald-800">{completedCount}/{totalCount}</span> selesai
            </span>
          </div>
          <div
            className="w-full bg-slate-200 rounded-full h-2 overflow-hidden"
            role="progressbar"
            aria-label="Progres jobdesk hari ini"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}>
            <div className="bg-emerald-600 h-2 rounded-full transition-[width] duration-150" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <label htmlFor="jobdesk-staff" className="text-xs font-medium text-slate-700 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              Staf
            </label>
            <Select
              id="jobdesk-staff"
              value={selectedStaffFilter}
              onChange={e => setSelectedStaffFilter(e.target.value)}>
              <option value="ALL">Semua staf</option>
              <option value="ME">Tugas saya ({currentUser.name})</option>
              {availableUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </Select>
            <Select
              aria-label="Kategori"
              value={selectedCategoryFilter}
              onChange={e => setSelectedCategoryFilter(e.target.value)}>
              <option value="ALL">Semua kategori</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>

          <div role="group" aria-label="Status tugas" className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-lg text-xs">
            {statusPills.map(p => (
              <button
                key={p.key}
                type="button"
                aria-pressed={selectedStatusFilter === p.key}
                onClick={() => setSelectedStatusFilter(p.key)}
                className={`min-h-[36px] px-3 rounded-md font-medium transition-colors cursor-pointer ${FOCUS} ${
                  selectedStatusFilter === p.key ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                {p.label} ({p.count})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Daftar tugas */}
      <ul className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
        {filteredTodos.length === 0 ? (
          <li className="p-8 text-center text-slate-600 text-xs">
            <CheckSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            {totalCount === 0 ? 'Belum ada jobdesk untuk hari ini.' : 'Tidak ada tugas yang sesuai dengan filter.'}
          </li>
        ) : (
          filteredTodos.map(todo => {
            const isOverdue = isTaskOverdue(todo, currentTimeStr);
            const isCurrentHour = !!todo.targetTime && parseInt(todo.targetTime.split(':')[0], 10) === currentHourNum;

            return (
              <li
                key={todo.id}
                className={`px-3 py-3 sm:px-5 flex items-start gap-2 ${
                  todo.isCompleted ? 'bg-slate-50/60' : isOverdue ? 'bg-rose-50/50' : isCurrentHour ? 'bg-amber-50/50' : 'bg-white'
                }`}
              >
                {/* Area sentuh 44px, kotak centang 24px */}
                <button
                  type="button"
                  onClick={() => handleToggle(todo.id)}
                  aria-pressed={todo.isCompleted}
                  aria-label={todo.isCompleted ? `Batalkan selesai: ${todo.title}` : `Tandai selesai: ${todo.title}`}
                  className={`shrink-0 w-11 h-11 -my-1.5 flex items-center justify-center rounded-lg cursor-pointer hover:bg-slate-100 ${FOCUS}`}>
                  <span
                    className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                      todo.isCompleted ? 'bg-emerald-600 border-emerald-600 text-white' : isOverdue ? 'border-rose-500 bg-white' : 'border-slate-400 bg-white'
                    }`}
                  >
                    {todo.isCompleted && <Check className="w-4 h-4 stroke-[3]" />}
                  </span>
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    {todo.targetTime ? (
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                          todo.isCompleted
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : isOverdue
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : isCurrentHour
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        <span className="font-mono tabular-nums">{todo.targetTime}</span>
                        {isOverdue && ' · lewat'}
                        {isCurrentHour && !todo.isCompleted && !isOverdue && ' · jam ini'}
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                        Shift {todo.session || 'Harian'}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                      <Users className="w-3 h-3" />
                      {todo.assignedUserName || (todo.assignedRole && todo.assignedRole !== 'ALL' ? todo.assignedRole : 'Semua staf')}
                    </span>
                    <span className="text-[11px] font-medium text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md">{todo.category}</span>
                    {todo.priority === 'Tinggi' && (
                      <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                        <Flame className="w-3 h-3" />
                        Prioritas tinggi
                      </span>
                    )}
                  </div>

                  <p className={`text-sm font-medium leading-snug ${todo.isCompleted ? 'line-through text-slate-500' : 'text-slate-900'}`}>{todo.title}</p>
                  {todo.notes && <p className="text-xs text-slate-600 mt-0.5">{todo.notes}</p>}
                  {todo.isCompleted && todo.completedBy && (
                    <p className="flex items-center gap-1.5 text-[11px] text-emerald-800 mt-1 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Selesai pukul {todo.completedAt || '-'} oleh {todo.completedBy}
                    </p>
                  )}
                </div>
              </li>
            );
          })
        )}
      </ul>

      {/* 4. Tautan ke riwayat & laporan */}
      {onNavigateToProfileTodos && (
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700">
          <span>Riwayat ceklis dan berita acara cetak:</span>
          <button
            type="button"
            onClick={onNavigateToProfileTodos}
            className={`min-h-[40px] px-2 rounded-md font-semibold text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer ${FOCUS}`}>
            Buka Jobdesk & Laporan <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 5. Dialog tambah jobdesk */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-3 sm:p-4 overflow-y-auto" onClick={closeAddModal}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-jobdesk-title"
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <div>
                <h3 id="add-jobdesk-title" className="text-base font-bold text-slate-900">Tambah Jobdesk</h3>
                <p className="text-xs text-slate-600 mt-0.5">Tentukan jam target dan staf penanggung jawab.</p>
              </div>
              <button
                type="button"
                onClick={closeAddModal}
                aria-label="Tutup"
                className={`w-11 h-11 flex items-center justify-center text-slate-600 rounded-lg hover:bg-slate-200/60 cursor-pointer ${FOCUS}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickAdd} noValidate className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
                <div>
                  <label htmlFor="jobdesk-title" className="block font-semibold text-slate-700 mb-1">
                    Uraian tugas <span className="text-rose-700">*</span>
                  </label>
                  <input
                    id="jobdesk-title"
                    type="text"
                    autoFocus
                    value={newTitle}
                    onChange={e => {
                      setNewTitle(e.target.value);
                      if (addError) setAddError('');
                    }}
                    aria-invalid={!!addError}
                    aria-describedby={addError ? 'jobdesk-title-error' : undefined}
                    placeholder="Contoh: Pengecekan segel beras dan uji organoleptik bayam"
                    className={`w-full px-3 py-2 rounded-lg border text-slate-800 ${addError ? 'border-rose-500' : 'border-slate-300'} ${FOCUS}`}
                  />
                  {addError && <p id="jobdesk-title-error" className="mt-1 text-rose-700 font-medium">{addError}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="jobdesk-time" className="block font-semibold text-slate-700 mb-1">Jam target</label>
                    <input
                      id="jobdesk-time"
                      type="time"
                      value={newTargetTime}
                      onChange={e => setNewTargetTime(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-slate-800 font-semibold ${FOCUS}`}
                    />
                    <span className="text-[11px] text-slate-600 mt-0.5 block">Pengingat berbunyi pada jam ini.</span>
                  </div>
                  <div>
                    <label htmlFor="jobdesk-user" className="block font-semibold text-slate-700 mb-1">Ditugaskan ke</label>
                    <Select className="w-full"
                      id="jobdesk-user"
                      value={newAssignedUserId}
                      onChange={e => setNewAssignedUserId(e.target.value)}>
                      <option value="">Semua staf</option>
                      {availableUsers.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.role})
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="jobdesk-category" className="block font-semibold text-slate-700 mb-1">Kategori</label>
                    <Select className="w-full"
                      id="jobdesk-category"
                      value={newCategory}
                      onChange={e => setNewCategory(e.target.value as TodoCategory)}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </Select>
                  </div>
                  <div>
                    <label htmlFor="jobdesk-priority" className="block font-semibold text-slate-700 mb-1">Prioritas</label>
                    <Select className="w-full"
                      id="jobdesk-priority"
                      value={newPriority}
                      onChange={e => setNewPriority(e.target.value as TodoPriority)}>
                      <option value="Tinggi">Tinggi</option>
                      <option value="Sedang">Sedang</option>
                      <option value="Rendah">Rendah</option>
                    </Select>
                  </div>
                  <div>
                    <label htmlFor="jobdesk-session" className="block font-semibold text-slate-700 mb-1">Shift</label>
                    <Select className="w-full"
                      id="jobdesk-session"
                      value={newSession}
                      onChange={e => setNewSession(e.target.value as typeof newSession)}>
                      <option value="Pagi">Pagi (05.00–09.00)</option>
                      <option value="Siang">Siang (09.00–14.00)</option>
                      <option value="Sore">Sore (14.00–18.00)</option>
                      <option value="Harian">Fleksibel</option>
                    </Select>
                  </div>
                </div>

                <div>
                  <label htmlFor="jobdesk-notes" className="block font-semibold text-slate-700 mb-1">Catatan (opsional)</label>
                  <input
                    id="jobdesk-notes"
                    type="text"
                    value={newNotes}
                    onChange={e => setNewNotes(e.target.value)}
                    placeholder="Misal: catat hasil di buku log dan laporkan ke Ka SPPG"
                    className={`w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 ${FOCUS}`}
                  />
                </div>
              </div>

              <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={closeAddModal}
                  className={`min-h-[44px] px-4 rounded-lg text-slate-700 hover:bg-slate-200/60 text-xs font-semibold cursor-pointer ${FOCUS}`}>
                  Batal
                </button>
                <button
                  type="submit"
                  className={`min-h-[44px] px-5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer ${FOCUS}`}>
                  Simpan Tugas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
