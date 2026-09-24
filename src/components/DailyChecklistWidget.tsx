import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { warehouseDb } from '../db/storage';
import { DailyTodoItem, TodoCategory, TodoPriority, UserRole } from '../types/warehouse';
import {
  CheckSquare,
  Clock,
  Plus,
  AlertCircle,
  CheckCircle2,
  Users,
  Bell,
  Volume2,
  Filter,
  ArrowRight,
  Flame,
  Calendar,
  Sparkles,
  ChevronDown,
  X,
} from 'lucide-react';

/**
 * Suara chime lembut pengingat jam kerja menggunakan Web Audio API murni.
 * Tidak membutuhkan file MP3 eksternal dan aman dari error 404.
 */
function playReminderChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    // Nada 1 (D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
    gain1.gain.setValueAtTime(0.12, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.35);

    // Nada 2 (A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.00, ctx.currentTime + 0.18);
    gain2.gain.setValueAtTime(0.12, ctx.currentTime + 0.18);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.18);
    osc2.stop(ctx.currentTime + 0.7);
  } catch (err) {
    console.warn('Audio Context belum diaktifkan oleh interaksi pengguna:', err);
  }
}

interface DailyChecklistWidgetProps {
  onNavigateToProfileTodos?: () => void;
  onRefreshData?: () => void;
}

export const DailyChecklistWidget: React.FC<DailyChecklistWidgetProps> = ({
  onNavigateToProfileTodos,
  onRefreshData,
}) => {
  const { currentUser, availableUsers } = useAuth();
  const todayStr = new Date().toISOString().split('T')[0];

  const [todos, setTodos] = useState<DailyTodoItem[]>(() => warehouseDb.getDailyTodos(todayStr));
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>('ALL'); // 'ALL' | 'ME' | userId
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'PENDING' | 'DONE'>('ALL');
  const [currentTimeStr, setCurrentTimeStr] = useState<string>(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Form states for quick add
  const [newTitle, setNewTitle] = useState('');
  const [newTargetTime, setNewTargetTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:00`;
  });
  const [newCategory, setNewCategory] = useState<TodoCategory>('Penerimaan & QC');
  const [newPriority, setNewPriority] = useState<TodoPriority>('Tinggi');
  const [newSession, setNewSession] = useState<'Pagi' | 'Siang' | 'Sore' | 'Harian'>('Pagi');
  const [newAssignedUserId, setNewAssignedUserId] = useState<string>('');
  const [newNotes, setNewNotes] = useState('');

  // Update clock every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const formatted = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      setCurrentTimeStr(formatted);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const refreshTodoList = () => {
    const refreshed = warehouseDb.getDailyTodos(todayStr);
    setTodos(refreshed);
    if (onRefreshData) onRefreshData();
  };

  const handleToggle = (todoId: string) => {
    warehouseDb.toggleTodo(todoId, currentUser);
    refreshTodoList();
  };

  // Filtered todos based on staff, category, and status
  const filteredTodos = useMemo(() => {
    return todos.filter(t => {
      // Staff filter
      if (selectedStaffFilter === 'ME') {
        const isAssignedToMe = t.assignedUserId === currentUser.id || (!t.assignedUserId && (t.assignedRole === currentUser.role || t.assignedRole === 'ALL'));
        if (!isAssignedToMe) return false;
      } else if (selectedStaffFilter !== 'ALL') {
        if (t.assignedUserId !== selectedStaffFilter) return false;
      }

      // Category filter
      if (selectedCategoryFilter !== 'ALL' && t.category !== selectedCategoryFilter) {
        return false;
      }

      // Status filter
      if (selectedStatusFilter === 'PENDING' && t.isCompleted) return false;
      if (selectedStatusFilter === 'DONE' && !t.isCompleted) return false;

      return true;
    }).sort((a, b) => {
      // Sort by target time ascending
      const timeA = a.targetTime || '99:99';
      const timeB = b.targetTime || '99:99';
      return timeA.localeCompare(timeB);
    });
  }, [todos, selectedStaffFilter, selectedCategoryFilter, selectedStatusFilter, currentUser]);

  // Overall Statistics for today
  const totalCount = todos.length;
  const completedCount = todos.filter(t => t.isCompleted).length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Hourly Analysis
  const currentHourNum = parseInt(currentTimeStr.split(':')[0], 10);

  // Tasks scheduled for the current hour window (e.g. if now 13:45, tasks between 13:00 - 13:59)
  const currentHourTasks = useMemo(() => {
    return todos.filter(t => {
      if (!t.targetTime) return false;
      const taskHour = parseInt(t.targetTime.split(':')[0], 10);
      return taskHour === currentHourNum;
    });
  }, [todos, currentHourNum]);

  // Overdue tasks: scheduled before current hour and not yet completed
  const overdueTasks = useMemo(() => {
    return todos.filter(t => {
      if (t.isCompleted || !t.targetTime) return false;
      const [h, m] = t.targetTime.split(':').map(Number);
      const [curH, curM] = currentTimeStr.split(':').map(Number);
      if (h < curH) return true;
      if (h === curH && m < curM - 15) return true; // Lewat lebih dari 15 menit
      return false;
    });
  }, [todos, currentTimeStr]);

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      alert('Judul tugas wajib diisi.');
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
        assignedUserId: assignedUser ? assignedUser.id : undefined,
        assignedUserName: assignedUser ? assignedUser.name : undefined,
        assignedRole: assignedUser ? assignedUser.role : 'ALL',
        notes: newNotes.trim() || undefined,
        isCompleted: false,
      },
      currentUser
    );

    setNewTitle('');
    setNewNotes('');
    setIsAddModalOpen(false);
    refreshTodoList();

    if (soundEnabled) {
      playReminderChime();
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* 1. Header Bar: Title, Live Clock & Hourly Alert */}
      <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <CheckSquare className="w-3.5 h-3.5" />
                Ceklis Tugas & Jobdesk Harian
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono text-slate-300 bg-slate-800 border border-slate-700">
                <Clock className="w-3 h-3 text-emerald-400" />
                {currentTimeStr} WIB
              </span>
            </div>
            <h3 className="text-base font-bold text-white">
              Monitoring Jobdesk Operasional SPPG Jeru Tumpang Hari Ini
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Ceklis langsung tugas yang telah selesai dan pantau pengingat target tiap jam untuk masing-masing staf.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              type="button"
              onClick={() => {
                playReminderChime();
                alert(`Pengingat suara diuji. Waktu saat ini: ${currentTimeStr} WIB`);
              }}
              title="Uji suara pengingat jam"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Uji Suara</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah Jobdesk
            </button>
          </div>
        </div>

        {/* Hourly Smart Notification Banner */}
        <div className="mt-4 pt-3 border-t border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-lg shrink-0 ${overdueTasks.length > 0 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
              <Bell className="w-4 h-4 animate-bounce" />
            </div>
            <div>
              <span className="font-semibold text-white">
                Fokus Jam {String(currentHourNum).padStart(2, '0')}:00 - {String(currentHourNum + 1).padStart(2, '0')}:00 WIB:
              </span>{' '}
              {currentHourTasks.length > 0 ? (
                <span className="text-slate-200">
                  Ada {currentHourTasks.length} tugas terjadwal (
                  {currentHourTasks.filter(t => t.isCompleted).length} selesai,{' '}
                  {currentHourTasks.filter(t => !t.isCompleted).length} belum)
                </span>
              ) : (
                <span className="text-slate-300">
                  Tidak ada tugas baru dijadwalkan pada jam ini. Tetap pantau alur dapur & gudang.
                </span>
              )}
            </div>
          </div>

          {overdueTasks.length > 0 && (
            <div className="flex items-center gap-1.5 bg-rose-500/20 border border-rose-500/40 text-rose-200 px-3 py-1 rounded-lg shrink-0">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              <span className="font-bold">{overdueTasks.length} tugas lewat target jam</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Progress Bar & Filter Toolbar */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
        {/* Progress Tracker */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
            <span className="text-slate-700 flex items-center gap-1.5 font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Progres Ceklis Hari Ini:
              <strong className="text-emerald-700 font-bold ml-1">
                {completedCount} dari {totalCount} Tugas Selesai ({progressPercent}%)
              </strong>
            </span>
            <span className="text-slate-500 text-[11px]">
              {totalCount - completedCount} tugas pending
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-emerald-600 h-2.5 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Custom Staff & Category Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Custom Staff Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              Staf:
            </span>
            <select
              value={selectedStaffFilter}
              onChange={e => setSelectedStaffFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-2xs"
            >
              <option value="ALL">Semua Staf (Semua Jobdesk)</option>
              <option value="ME">⭐ Tugas Saya ({currentUser.name})</option>
              {availableUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>

            {/* Category Filter */}
            <select
              value={selectedCategoryFilter}
              onChange={e => setSelectedCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-2xs"
            >
              <option value="ALL">Semua Kategori</option>
              <option value="Penerimaan & QC">Penerimaan & QC</option>
              <option value="Persiapan Dapur">Persiapan Dapur</option>
              <option value="Sanitasi & Kebersihan">Sanitasi & Kebersihan</option>
              <option value="Administrasi & Stok">Administrasi & Stok</option>
              <option value="Stock Opname">Stock Opname</option>
              <option value="Distribusi">Distribusi</option>
            </select>
          </div>

          {/* Status Quick Pills */}
          <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setSelectedStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer ${selectedStatusFilter === 'ALL' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-600 hover:text-slate-800'}`}
            >
              Semua ({todos.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatusFilter('PENDING')}
              className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer ${selectedStatusFilter === 'PENDING' ? 'bg-white text-amber-800 shadow-2xs' : 'text-slate-600 hover:text-slate-800'}`}
            >
              Belum ({totalCount - completedCount})
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatusFilter('DONE')}
              className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer ${selectedStatusFilter === 'DONE' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-600 hover:text-slate-800'}`}
            >
              Selesai ({completedCount})
            </button>
          </div>
        </div>
      </div>

      {/* 3. Task List / Checklist Timeline */}
      <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
        {filteredTodos.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            <CheckSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            Tidak ada tugas yang sesuai dengan filter yang dipilih.
          </div>
        ) : (
          filteredTodos.map(todo => {
            const isOverdue = !todo.isCompleted && todo.targetTime && (() => {
              const [h, m] = todo.targetTime.split(':').map(Number);
              const [curH, curM] = currentTimeStr.split(':').map(Number);
              return h < curH || (h === curH && m < curM - 15);
            })();

            const isCurrentHour = todo.targetTime && parseInt(todo.targetTime.split(':')[0], 10) === currentHourNum;

            return (
              <div
                key={todo.id}
                className={`p-3.5 sm:px-5 transition-colors flex items-start gap-3.5 hover:bg-slate-50/80 ${
                  todo.isCompleted
                    ? 'bg-slate-50/50'
                    : isOverdue
                    ? 'bg-rose-50/40'
                    : isCurrentHour
                    ? 'bg-blue-50/30'
                    : 'bg-white'
                }`}
              >
                {/* Interactive Checkbox */}
                <button
                  type="button"
                  onClick={() => handleToggle(todo.id)}
                  className={`mt-0.5 shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-all cursor-pointer ${
                    todo.isCompleted
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs'
                      : isOverdue
                      ? 'border-rose-400 bg-white hover:border-rose-600'
                      : 'border-slate-300 bg-white hover:border-emerald-500'
                  }`}
                  title={todo.isCompleted ? 'Batalkan status selesai' : 'Tandai selesai'}
                >
                  {todo.isCompleted && <CheckCircle2 className="w-3.5 h-3.5" />}
                </button>

                {/* Task Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {/* Target Time Badge */}
                    {todo.targetTime ? (
                      <span
                        className={`inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2 py-0.5 rounded border ${
                          todo.isCompleted
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : isOverdue
                            ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                            : isCurrentHour
                            ? 'bg-blue-100 text-blue-800 border-blue-300'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        Jam {todo.targetTime}
                        {isOverdue && ' (Lewat)'}
                        {isCurrentHour && !todo.isCompleted && ' (Jam Ini)'}
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                        Shift {todo.session || 'Harian'}
                      </span>
                    )}

                    {/* Assigned Staff Pill */}
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      <Users className="w-3 h-3 text-slate-500" />
                      {todo.assignedUserName || (todo.assignedRole ? `Role: ${todo.assignedRole}` : 'Semua Staf')}
                    </span>

                    {/* Category Pill */}
                    <span className="text-[10px] font-medium text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                      {todo.category}
                    </span>

                    {/* Priority */}
                    {todo.priority === 'Tinggi' && (
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <Flame className="w-2.5 h-2.5 text-rose-600" />
                        Tinggi
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <p
                    className={`text-xs font-semibold leading-snug ${
                      todo.isCompleted
                        ? 'line-through text-slate-400'
                        : 'text-slate-800'
                    }`}
                  >
                    {todo.title}
                  </p>

                  {/* Notes & Completion stamp */}
                  {todo.notes && (
                    <p className="text-[11px] text-slate-500 mt-0.5 italic">
                      {todo.notes}
                    </p>
                  )}

                  {todo.isCompleted && todo.completedBy && (
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 mt-1 font-medium">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Selesai pukul {todo.completedAt || '-'} oleh {todo.completedBy}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. Footer link to Profile & Jobdesk Management */}
      {onNavigateToProfileTodos && (
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <span>Kelola laporan cetak berita acara & riwayat ceklis harian:</span>
          <button
            type="button"
            onClick={onNavigateToProfileTodos}
            className="font-semibold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
          >
            Buka Menu Jobdesk & Laporan <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 5. Modal Tambah Jobdesk Baru */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <CheckSquare className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Tambah Jobdesk / Tugas Harian SPPG Jeru Tumpang
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Tentukan target jam dan staf penanggung jawab tugas
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickAdd} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Uraian Butir Tugas <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Contoh: Pengecekan segel beras & uji organoleptik sayur bayam..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
                />
              </div>

              {/* Input Jam & Shift */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    Target Jam (Jam Pelaksanaan) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={newTargetTime}
                    onChange={e => setNewTargetTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-slate-800 font-semibold"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Pengingat jam akan menyorot tugas pada jam ini
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tugaskan ke Staf Khusus
                  </label>
                  <select
                    value={newAssignedUserId}
                    onChange={e => setNewAssignedUserId(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-slate-800 cursor-pointer font-medium"
                  >
                    <option value="">Semua Staf (Bisa dikerjakan siapa saja)</option>
                    {availableUsers.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kategori</label>
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value as TodoCategory)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-slate-800 cursor-pointer"
                  >
                    <option value="Penerimaan & QC">Penerimaan & QC</option>
                    <option value="Persiapan Dapur">Persiapan Dapur</option>
                    <option value="Sanitasi & Kebersihan">Sanitasi & Kebersihan</option>
                    <option value="Administrasi & Stok">Administrasi & Stok</option>
                    <option value="Stock Opname">Stock Opname</option>
                    <option value="Distribusi">Distribusi</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Prioritas</label>
                  <select
                    value={newPriority}
                    onChange={e => setNewPriority(e.target.value as TodoPriority)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-slate-800 cursor-pointer"
                  >
                    <option value="Tinggi">Tinggi (Kritis)</option>
                    <option value="Sedang">Sedang (Rutin)</option>
                    <option value="Rendah">Rendah</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Shift / Sesi</label>
                  <select
                    value={newSession}
                    onChange={e => setNewSession(e.target.value as any)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-slate-800 cursor-pointer"
                  >
                    <option value="Pagi">Pagi (05:00 - 09:00)</option>
                    <option value="Siang">Siang (09:00 - 14:00)</option>
                    <option value="Sore">Sore (14:00 - 18:00)</option>
                    <option value="Harian">Fleksibel Harian</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Catatan SOP / Instruksi Khusus (Opsional)
                </label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                  placeholder="Misal: Catat hasil di buku log dan laporkan ke Ka SPPG..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer text-slate-600 text-[11px]">
                  <input
                    type="checkbox"
                    checked={soundEnabled}
                    onChange={e => setSoundEnabled(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  Bunyikan nada konfirmasi saat simpan
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 font-semibold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs cursor-pointer"
                  >
                    Simpan Tugas
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
