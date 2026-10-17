import React, { useState, useMemo, useEffect } from 'react';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import { KopText } from './common/KopText';
import { useAuth } from '../context/AuthContext';
import { warehouseDb, signerName } from '../db/storage';
import { DailyTodoItem, TodoCategory, TodoPriority, UserRole } from '../types/warehouse';
import { exportToExcel } from '../lib/excelExport';
import { localDateIso } from '../utils/localDate';
import { SppgLogo } from './SppgLogo';
import { ROLE_INFO } from './UserManagementModule';
import { FormDialog, FIELD_INPUT, FIELD_LABEL, BTN_PRIMARY, BTN_SECONDARY, FOCUS_RING } from './common/FormDialog';
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  FileSpreadsheet,
  Printer,
  Clock,
  ListTodo,
  AlertCircle,
  RotateCcw,
  Eye,
  EyeOff,
  Users,
} from 'lucide-react';

export interface ProfileModuleProps {
  onNavigate?: (tab: string) => void;
}

type SubTab = 'profile' | 'todos' | 'report';

const TODO_CATEGORIES: TodoCategory[] = [
  'Penerimaan & QC',
  'Persiapan Dapur',
  'Sanitasi & Kebersihan',
  'Administrasi & Stok',
  'Stock Opname',
  'Distribusi',
];

const PRIORITY_TONE: Record<TodoPriority, string> = {
  Tinggi: 'bg-rose-50 text-rose-800 border-rose-200',
  Sedang: 'bg-amber-50 text-amber-800 border-amber-200',
  Rendah: 'bg-slate-50 text-slate-700 border-slate-200',
};

const BADGE = 'inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-md border';
const MIN_PASSWORD = 6;

// "2026-10-17" -> Date lokal; new Date("2026-10-17") dibaca sebagai UTC.
const parseIsoDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const formatLongDate = (iso: string) =>
  parseIsoDate(iso).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const roleLabel = (role?: string) => (role && ROLE_INFO[role as UserRole]?.label) || role || '-';

export const ProfileModule: React.FC<ProfileModuleProps> = ({ onNavigate }) => {
  const { currentUser, updateProfile, availableUsers, can } = useAuth();
  const askConfirm = useConfirm();
  const toast = useToast();

  const [activeSubTab, setActiveSubTab] = useState<SubTab>('profile');

  // --- Profil ---
  const [name, setName] = useState<string>(currentUser.name);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // --- Tugas harian ---
  const todayStr = localDateIso();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [todos, setTodos] = useState<DailyTodoItem[]>(() => warehouseDb.getDailyTodos(todayStr));
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'PENDING'>('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addError, setAddError] = useState('');

  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<TodoCategory>('Penerimaan & QC');
  const [newPriority, setNewPriority] = useState<TodoPriority>('Tinggi');
  const [newSession, setNewSession] = useState<'Pagi' | 'Siang' | 'Sore' | 'Harian'>('Pagi');
  const [newTargetTime, setNewTargetTime] = useState('08:00');
  const [newAssignedUserId, setNewAssignedUserId] = useState('');
  const [newAssignedRole, setNewAssignedRole] = useState<UserRole | 'ALL'>('ALL');
  const [newNotes, setNewNotes] = useState('');

  const refreshTodos = (date = selectedDate) => setTodos(warehouseDb.getDailyTodos(date));

  // Tugas yang dicentang di perangkat lain ikut muncul.
  useEffect(() => {
    const onSync = () => setTodos(warehouseDb.getDailyTodos(selectedDate));
    window.addEventListener('sppg_warehouse_sync', onSync);
    return () => window.removeEventListener('sppg_warehouse_sync', onSync);
  }, [selectedDate]);

  const handleDateChange = (date: string) => {
    if (!date) return;
    setSelectedDate(date);
    refreshTodos(date);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');

    if (!name.trim()) {
      setProfileError('Nama lengkap wajib diisi.');
      return;
    }
    if (newPassword || confirmPassword) {
      if (!currentPassword) {
        setProfileError('Isi kata sandi saat ini untuk mengganti kata sandi.');
        return;
      }
      if (newPassword.length < MIN_PASSWORD) {
        setProfileError(`Kata sandi baru minimal ${MIN_PASSWORD} karakter.`);
        return;
      }
      if (newPassword !== confirmPassword) {
        setProfileError('Konfirmasi kata sandi baru tidak cocok.');
        return;
      }
    }

    setIsSavingProfile(true);
    const result = await updateProfile({
      name: name.trim(),
      currentPassword: newPassword ? currentPassword : undefined,
      password: newPassword || undefined,
    });
    setIsSavingProfile(false);

    if (result.success) {
      toast.success(newPassword ? 'Profil dan kata sandi tersimpan.' : 'Profil tersimpan.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setProfileError(result.error || 'Profil gagal disimpan.');
    }
  };

  const handleToggleTodo = (todoId: string) => {
    const updated = warehouseDb.toggleTodo(todoId, currentUser);
    const next = todos.map(t => (t.id === todoId ? updated : t));
    setTodos(next);

    if (updated.isCompleted && next.length > 0 && next.every(t => t.isCompleted)) {
      toast.success('Semua tugas tanggal ini selesai. Laporannya siap dicetak di tab Laporan.');
    }
  };

  const openAddModal = () => {
    setAddError('');
    setNewTitle('');
    setNewNotes('');
    setNewAssignedUserId('');
    setNewAssignedRole('ALL');
    setIsAddModalOpen(true);
  };

  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setAddError('Uraian tugas wajib diisi.');
      return;
    }

    const assignedUser = availableUsers?.find(u => u.id === newAssignedUserId);
    warehouseDb.addTodo(
      {
        date: selectedDate,
        title: newTitle.trim(),
        category: newCategory,
        priority: newPriority,
        session: newSession,
        targetTime: newTargetTime || undefined,
        assignedUserId: assignedUser?.id,
        assignedUserName: assignedUser?.name,
        assignedRole: assignedUser ? assignedUser.role : newAssignedRole,
        notes: newNotes.trim() || undefined,
        isCompleted: false,
      },
      currentUser
    );

    setIsAddModalOpen(false);
    refreshTodos();
    toast.success(`Tugas "${newTitle.trim()}" ditambahkan.`);
  };

  const handleDeleteTodo = async (id: string, title: string) => {
    if (await askConfirm({ title: `Hapus tugas "${title}"?`, confirmText: 'Hapus tugas', variant: 'danger' })) {
      warehouseDb.deleteTodo(id, currentUser);
      refreshTodos();
    }
  };

  const handleResetTodos = async () => {
    if (
      await askConfirm({
        title: 'Kembalikan ke tugas standar?',
        message: `Daftar tugas ${formatLongDate(selectedDate)} diganti dengan 8 tugas standar operasional SPPG. Centang yang sudah ada ikut hilang.`,
        confirmText: 'Kembalikan',
        variant: 'warning',
      })
    ) {
      warehouseDb.resetDailyTodos(selectedDate);
      refreshTodos();
    }
  };

  const filteredTodos = useMemo(
    () =>
      todos.filter(item => {
        const matchCat = categoryFilter === 'ALL' || item.category === categoryFilter;
        const matchStatus =
          statusFilter === 'ALL' ||
          (statusFilter === 'COMPLETED' && item.isCompleted) ||
          (statusFilter === 'PENDING' && !item.isCompleted);
        return matchCat && matchStatus;
      }),
    [todos, categoryFilter, statusFilter]
  );

  const categoryOptions = useMemo(
    () => Array.from(new Set([...TODO_CATEGORIES, ...todos.map(t => t.category)])),
    [todos]
  );

  const totalTasks = todos.length;
  const completedTasks = todos.filter(t => t.isCompleted).length;
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const isAllCompleted = totalTasks > 0 && completedTasks === totalTasks;
  const isToday = selectedDate === todayStr;

  // Jam selesai paling akhir (format "HH.MM"), bukan urutan terakhir di daftar.
  const lastCompletedAt = todos
    .map(t => t.completedAt)
    .filter((v): v is string => Boolean(v))
    .sort()
    .pop();

  const handleExportExcel = () => {
    const exportData = todos.map((t, index) => ({
      'No': index + 1,
      'Tanggal': t.date,
      'Target Jam': t.targetTime || '-',
      'Sesi': t.session || 'Harian',
      'Kategori': t.category,
      'Uraian Tugas': t.title,
      'Ditugaskan ke': t.assignedUserName || (t.assignedRole && t.assignedRole !== 'ALL' ? roleLabel(t.assignedRole) : 'Semua petugas'),
      'Prioritas': t.priority,
      'Status': t.isCompleted ? 'Selesai' : 'Belum selesai',
      'Jam Selesai': t.completedAt || '-',
      'Diselesaikan oleh': t.completedBy || '-',
      'Catatan': t.notes || '-',
    }));
    exportToExcel(exportData, `Laporan_Tugas_Harian_SPPG_${selectedDate}.xlsx`, 'Laporan Tugas Harian');
  };

  const tabs: { id: SubTab; label: string }[] = [
    { id: 'profile', label: 'Profil' },
    { id: 'todos', label: `Tugas harian (${completedTasks}/${totalTasks})` },
    { id: 'report', label: 'Laporan' },
  ];

  const dateControl = (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="date"
        aria-label="Tanggal tugas"
        value={selectedDate}
        onChange={e => handleDateChange(e.target.value)}
        className={`${FIELD_INPUT} w-auto font-semibold`}
      />
      {!isToday && (
        <button type="button" onClick={() => handleDateChange(todayStr)} className={BTN_SECONDARY}>
          Hari ini
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm 12mm; }
          body * { visibility: hidden; }
          #printable-report-area, #printable-report-area * { visibility: visible; }
          #printable-report-area { position: absolute; left: 0; top: 0; width: 100%; border: none; padding: 0; }
        }
      `}</style>

      {/* Header */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Profil & Tugas Harian</h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Nama dan kata sandi akun, ceklis tugas operasional harian, dan laporan penyelesaiannya.
          </p>
        </div>
        <div role="tablist" aria-label="Bagian halaman profil" className="flex gap-1 p-1 bg-slate-100 rounded-lg text-xs overflow-x-auto max-w-full w-fit">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeSubTab === tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`px-3 rounded-md whitespace-nowrap cursor-pointer min-h-[44px] sm:min-h-[32px] ${FOCUS_RING} ${
                activeSubTab === tab.id ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ===================== PROFIL ===================== */}
      {activeSubTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <form onSubmit={handleSaveProfile} className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900">Data akun</h2>

            {profileError && (
              <p role="alert" className="flex items-start gap-2 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900">
                <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
                {profileError}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="pf-email" className={FIELD_LABEL}>Email</label>
                <input id="pf-email" type="email" value={currentUser.email} disabled className={FIELD_INPUT} />
              </div>
              <div>
                <label htmlFor="pf-name" className={FIELD_LABEL}>Nama lengkap</label>
                <input
                  id="pf-name"
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className={FIELD_INPUT}
                />
              </div>
            </div>

            <div>
              <span className={FIELD_LABEL}>Peran</span>
              <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
                <span className="font-semibold text-slate-900">{roleLabel(currentUser.role)}</span>
                {ROLE_INFO[currentUser.role] && <> · {ROLE_INFO[currentUser.role].desc}</>}
                <p className="text-[11px] text-slate-600 mt-1">Peran hanya bisa diubah oleh Superadmin atau Kepala SPPG lewat Kelola Akun.</p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-slate-900">Ganti kata sandi</h3>
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-pressed={showPassword}
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 hover:underline cursor-pointer rounded min-h-[44px] sm:min-h-0 ${FOCUS_RING}`}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showPassword ? 'Sembunyikan' : 'Tampilkan'}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="pf-cur" className={FIELD_LABEL}>Kata sandi saat ini</label>
                  <input
                    id="pf-cur"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    className={FIELD_INPUT}
                  />
                </div>
                <div>
                  <label htmlFor="pf-new" className={FIELD_LABEL}>Kata sandi baru</label>
                  <input
                    id="pf-new"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder={`Minimal ${MIN_PASSWORD} karakter`}
                    className={FIELD_INPUT}
                  />
                </div>
                <div>
                  <label htmlFor="pf-confirm" className={FIELD_LABEL}>Ulangi kata sandi baru</label>
                  <input
                    id="pf-confirm"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className={FIELD_INPUT}
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-600">Biarkan kosong jika hanya mengubah nama.</p>
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={isSavingProfile} className={BTN_PRIMARY}>
                {isSavingProfile ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </form>

          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-base shrink-0" aria-hidden="true">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 truncate">{currentUser.name}</div>
                  <div className="text-xs text-slate-600 truncate">{currentUser.email}</div>
                </div>
              </div>
              <dl className="mt-4 pt-3 border-t border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-600">Peran</dt>
                  <dd className="font-semibold text-slate-900">{roleLabel(currentUser.role)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-600">ID akun</dt>
                  <dd className="font-mono text-slate-800 truncate">{currentUser.id}</dd>
                </div>
              </dl>
              {onNavigate && can('MANAGE_USERS') && (
                <button type="button" onClick={() => onNavigate('user_management')} className={`${BTN_SECONDARY} w-full mt-4`}>
                  <Users className="w-4 h-4" />
                  Kelola akun aplikasi
                </button>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-bold text-slate-900">Tugas hari ini</h2>
                <span className="text-xs font-semibold text-slate-700 tabular-nums">
                  {isToday ? `${completedTasks}/${totalTasks}` : '-'}
                </span>
              </div>
              {isToday && (
                <div className="w-full bg-slate-100 rounded-full h-2 mt-2" role="progressbar" aria-valuenow={completionPercentage} aria-valuemin={0} aria-valuemax={100}>
                  <div className="bg-emerald-600 h-2 rounded-full" style={{ width: `${completionPercentage}%` }} />
                </div>
              )}
              <p className="text-xs text-slate-600 mt-2">
                {!isToday
                  ? 'Buka tab Tugas harian untuk melihat tugas hari ini.'
                  : isAllCompleted
                    ? 'Semua tugas hari ini selesai.'
                    : `${totalTasks - completedTasks} tugas belum selesai.`}
              </p>
              <button
                type="button"
                onClick={() => {
                  handleDateChange(todayStr);
                  setActiveSubTab('todos');
                }}
                className={`${BTN_SECONDARY} w-full mt-3`}
              >
                Buka tugas harian
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TUGAS HARIAN ===================== */}
      {activeSubTab === 'todos' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {dateControl}
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={handleResetTodos} className={BTN_SECONDARY} title="Ganti daftar dengan 8 tugas standar SPPG">
                  <RotateCcw className="w-3.5 h-3.5" />
                  Tugas standar
                </button>
                <button type="button" onClick={openAddModal} className={BTN_PRIMARY}>
                  <Plus className="w-4 h-4" />
                  Tambah tugas
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filter status"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
                className={`${FIELD_INPUT} w-auto`}
              >
                <option value="ALL">Semua status</option>
                <option value="PENDING">Belum selesai</option>
                <option value="COMPLETED">Sudah selesai</option>
              </select>
              <select
                aria-label="Filter kategori"
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className={`${FIELD_INPUT} w-auto`}
              >
                <option value="ALL">Semua kategori</option>
                {categoryOptions.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between gap-2 text-xs mb-2">
                <span className="text-slate-700">
                  <span className="font-semibold text-slate-900">{completedTasks} dari {totalTasks}</span> selesai · {formatLongDate(selectedDate)}
                </span>
                <span className="font-semibold text-slate-900 tabular-nums">{completionPercentage}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2" role="progressbar" aria-valuenow={completionPercentage} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-2 rounded-full bg-emerald-600 transition-all" style={{ width: `${completionPercentage}%` }} />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {filteredTodos.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                <ListTodo className="w-8 h-8 text-slate-300 mx-auto mb-2" aria-hidden="true" />
                <p className="text-xs text-slate-600">
                  {totalTasks === 0 ? 'Belum ada tugas untuk tanggal ini.' : 'Tidak ada tugas yang cocok dengan filter.'}
                </p>
              </div>
            ) : (
              filteredTodos.map(todo => (
                <div
                  key={todo.id}
                  className={`rounded-xl border p-3 sm:p-4 flex items-start gap-3 ${
                    todo.isCompleted ? 'bg-emerald-50/40 border-emerald-200' : 'bg-white border-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleToggleTodo(todo.id)}
                    aria-pressed={todo.isCompleted}
                    aria-label={todo.isCompleted ? `Tandai belum selesai: ${todo.title}` : `Tandai selesai: ${todo.title}`}
                    className={`-m-2 p-2 rounded-lg shrink-0 cursor-pointer text-emerald-700 hover:bg-emerald-50 ${FOCUS_RING}`}
                  >
                    {todo.isCompleted ? (
                      <CheckCircle2 className="w-6 h-6 fill-emerald-700 text-white" />
                    ) : (
                      <Circle className="w-6 h-6 text-slate-400" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <h3 className={`text-sm font-semibold ${todo.isCompleted ? 'text-slate-600 line-through' : 'text-slate-900'}`}>
                      {todo.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {todo.targetTime && (
                        <span className={`${BADGE} bg-white text-slate-700 border-slate-200 font-mono`}>
                          <Clock className="w-3 h-3" aria-hidden="true" />
                          {todo.targetTime}
                        </span>
                      )}
                      <span className={`${BADGE} bg-slate-100 text-slate-700 border-slate-200`}>{todo.category}</span>
                      <span className={`${BADGE} ${PRIORITY_TONE[todo.priority] || PRIORITY_TONE.Rendah}`}>Prioritas {todo.priority.toLowerCase()}</span>
                      {todo.session && todo.session !== 'Harian' && (
                        <span className={`${BADGE} bg-white text-slate-700 border-slate-200`}>{todo.session}</span>
                      )}
                      {todo.assignedUserName ? (
                        <span className={`${BADGE} bg-white text-slate-700 border-slate-200`}>
                          <Users className="w-3 h-3" aria-hidden="true" />
                          {todo.assignedUserName}
                        </span>
                      ) : todo.assignedRole && todo.assignedRole !== 'ALL' ? (
                        <span className={`${BADGE} bg-white text-slate-700 border-slate-200`}>{roleLabel(todo.assignedRole)}</span>
                      ) : null}
                    </div>
                    {todo.notes && <p className="text-xs text-slate-600 mt-1.5">{todo.notes}</p>}
                    {todo.isCompleted && (
                      <p className="text-[11px] text-emerald-800 mt-1.5">
                        Selesai pukul {todo.completedAt}
                        {todo.completedBy && ` oleh ${todo.completedBy}`}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteTodo(todo.id, todo.title)}
                    aria-label={`Hapus tugas: ${todo.title}`}
                    title="Hapus tugas"
                    className={`inline-flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-[32px] sm:min-h-[32px] -m-1 rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer shrink-0 ${FOCUS_RING}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ===================== LAPORAN ===================== */}
      {activeSubTab === 'report' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {dateControl}
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={handleExportExcel} disabled={totalTasks === 0} className={`${BTN_SECONDARY} disabled:opacity-50 disabled:cursor-not-allowed`}>
                  <FileSpreadsheet className="w-4 h-4" />
                  Ekspor Excel
                </button>
                <button type="button" onClick={() => window.print()} disabled={totalTasks === 0} className={BTN_PRIMARY}>
                  <Printer className="w-4 h-4" />
                  Cetak laporan
                </button>
              </div>
            </div>
            {!isAllCompleted && totalTasks > 0 && (
              <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Baru {completedTasks} dari {totalTasks} tugas selesai ({completionPercentage}%). Laporan tetap bisa dicetak sebagai laporan sementara.
              </p>
            )}
          </div>

          <div id="printable-report-area" className="bg-white rounded-xl border border-slate-200 p-4 sm:p-8 overflow-x-auto">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4 border-b-2 border-slate-800 pb-5 mb-6">
              <div className="flex items-start gap-4">
                <SppgLogo size="lg" variant="color" showText={false} />
                <KopText />
              </div>
              <div className="sm:text-right text-xs">
                <div className="font-bold text-slate-900">BERITA ACARA LAPORAN HARIAN</div>
                <div className="font-mono text-slate-600 text-[11px] mt-0.5">
                  NOMOR: BA-SPPG/{selectedDate.replace(/-/g, '')}/01
                </div>
                <div className="text-[11px] text-slate-600 mt-1">
                  Tanggal: <strong className="text-slate-800">{formatLongDate(selectedDate)}</strong>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Tugas terjadwal', value: `${totalTasks}` },
                { label: 'Tugas selesai', value: `${completedTasks}` },
                { label: 'Persentase selesai', value: `${completionPercentage}%` },
                { label: 'Selesai terakhir', value: lastCompletedAt ? `Pukul ${lastCompletedAt}` : '-' },
              ].map(m => (
                <div key={m.label} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-[11px] text-slate-600">{m.label}</div>
                  <div className="text-lg font-bold text-slate-900 mt-0.5 tabular-nums">{m.value}</div>
                </div>
              ))}
            </div>

            <table className="w-full min-w-[640px] text-left text-xs border border-slate-200 mb-6">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">No</th>
                  <th className="py-2.5 px-3">Kategori & jam</th>
                  <th className="py-2.5 px-3">Uraian tugas</th>
                  <th className="py-2.5 px-3 w-20">Prioritas</th>
                  <th className="py-2.5 px-3 w-20 text-center">Status</th>
                  <th className="py-2.5 px-3 w-24">Jam selesai</th>
                  <th className="py-2.5 px-3">Pelaksana</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {todos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-600">Belum ada tugas untuk tanggal ini.</td>
                  </tr>
                ) : (
                  todos.map((todo, idx) => (
                    <tr key={todo.id}>
                      <td className="py-2 px-3 text-center text-slate-600">{idx + 1}</td>
                      <td className="py-2 px-3">
                        <div className="font-semibold text-slate-800">{todo.category}</div>
                        <div className="text-[11px] text-slate-600">{todo.targetTime || todo.session || 'Harian'}</div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-medium text-slate-900">{todo.title}</div>
                        {todo.notes && <div className="text-[11px] text-slate-600 mt-0.5">{todo.notes}</div>}
                      </td>
                      <td className="py-2 px-3 text-slate-700">{todo.priority}</td>
                      <td className="py-2 px-3 text-center font-semibold">
                        {todo.isCompleted ? <span className="text-emerald-800">Selesai</span> : <span className="text-slate-600">Belum</span>}
                      </td>
                      <td className="py-2 px-3 text-slate-700 font-mono">{todo.completedAt ? `${todo.completedAt} WIB` : '-'}</td>
                      <td className="py-2 px-3 text-slate-700">
                        <div className="font-semibold">{todo.completedBy || '-'}</div>
                        {todo.assignedUserName && <div className="text-[11px] text-slate-600">Ditugaskan: {todo.assignedUserName}</div>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <p className="border border-slate-200 rounded-lg p-4 bg-slate-50 mb-8 text-xs text-slate-700 leading-relaxed">
              <strong className="text-slate-900">Pernyataan:</strong> butir tugas di atas telah diperiksa dan dikerjakan sesuai penugasan operasional harian SPPG.
            </p>

            <div className="grid grid-cols-2 gap-8 pt-4 text-center text-xs">
              <div>
                <p className="text-slate-600">Petugas yang memeriksa,</p>
                <div className="h-16" />
                <p className="font-bold text-slate-900 underline">{currentUser.name}</p>
                <p className="text-[11px] text-slate-600">{roleLabel(currentUser.role)}</p>
              </div>
              <div>
                <p className="text-slate-600">Mengetahui & menyetujui,</p>
                <div className="h-16" />
                <p className="font-bold text-slate-900 underline">{signerName('KEPALA_SPPG')}</p>
                <p className="text-[11px] text-slate-600">Kepala SPPG</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <FormDialog
          title="Tambah tugas"
          description={formatLongDate(selectedDate)}
          onClose={() => setIsAddModalOpen(false)}
          onSubmit={handleAddTodo}
          submitLabel="Simpan tugas"
          error={addError}
        >
          <div>
            <label htmlFor="td-title" className={FIELD_LABEL}>Uraian tugas</label>
            <input
              id="td-title"
              type="text"
              required
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Contoh: Kalibrasi timbangan digital"
              className={FIELD_INPUT}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="td-cat" className={FIELD_LABEL}>Kategori</label>
              <select id="td-cat" value={newCategory} onChange={e => setNewCategory(e.target.value as TodoCategory)} className={FIELD_INPUT}>
                {TODO_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="td-prio" className={FIELD_LABEL}>Prioritas</label>
              <select id="td-prio" value={newPriority} onChange={e => setNewPriority(e.target.value as TodoPriority)} className={FIELD_INPUT}>
                <option value="Tinggi">Tinggi</option>
                <option value="Sedang">Sedang</option>
                <option value="Rendah">Rendah</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="td-time" className={FIELD_LABEL}>Target jam</label>
              <input id="td-time" type="time" value={newTargetTime} onChange={e => setNewTargetTime(e.target.value)} className={`${FIELD_INPUT} font-mono`} />
            </div>
            <div>
              <label htmlFor="td-session" className={FIELD_LABEL}>Sesi</label>
              <select id="td-session" value={newSession} onChange={e => setNewSession(e.target.value as typeof newSession)} className={FIELD_INPUT}>
                <option value="Pagi">Pagi (05.00–09.00)</option>
                <option value="Siang">Siang (09.00–14.00)</option>
                <option value="Sore">Sore (14.00–18.00)</option>
                <option value="Harian">Kapan saja</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="td-user" className={FIELD_LABEL}>Tugaskan ke orang</label>
              <select id="td-user" value={newAssignedUserId} onChange={e => setNewAssignedUserId(e.target.value)} className={FIELD_INPUT}>
                <option value="">Tidak spesifik</option>
                {availableUsers?.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({roleLabel(u.role)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="td-role" className={FIELD_LABEL}>Atau ke peran</label>
              <select
                id="td-role"
                value={newAssignedRole}
                disabled={Boolean(newAssignedUserId)}
                onChange={e => setNewAssignedRole(e.target.value as UserRole | 'ALL')}
                className={FIELD_INPUT}
              >
                <option value="ALL">Semua petugas</option>
                {(Object.keys(ROLE_INFO) as UserRole[]).map(r => (
                  <option key={r} value={r}>{ROLE_INFO[r].label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="td-notes" className={FIELD_LABEL}>Catatan (opsional)</label>
            <textarea
              id="td-notes"
              rows={2}
              value={newNotes}
              onChange={e => setNewNotes(e.target.value)}
              placeholder="Parameter pemeriksaan, nomor form rujukan, dll."
              className={`${FIELD_INPUT} py-2`}
            />
          </div>
        </FormDialog>
      )}
    </div>
  );
};
