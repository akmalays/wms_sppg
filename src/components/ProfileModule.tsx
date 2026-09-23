import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { warehouseDb } from '../db/storage';
import { DailyTodoItem, TodoCategory, TodoPriority, UserRole } from '../types/warehouse';
import { exportToExcel } from '../lib/excelExport';
import { SppgLogo } from './SppgLogo';
import {
  User,
  Shield,
  KeyRound,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  FileSpreadsheet,
  Printer,
  Calendar,
  Clock,
  ListTodo,
  FileCheck2,
  AlertCircle,
  Sparkles,
  Info,
  CheckSquare2,
  RefreshCw,
  Award,
  Eye,
  EyeOff
} from 'lucide-react';

export const ProfileModule: React.FC = () => {
  const { currentUser, updateProfile } = useAuth();

  // Internal module tab state: 'profile' | 'todos' | 'report'
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'todos' | 'report'>('profile');

  // --- Profile Edit State ---
  const [name, setName] = useState<string>(currentUser.name);
  const [role, setRole] = useState<UserRole>(currentUser.role);
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);

  // --- Daily Todos State ---
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [todos, setTodos] = useState<DailyTodoItem[]>(() => warehouseDb.getDailyTodos(todayStr));
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'PENDING'>('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  // New todo form state
  const [newTitle, setNewTitle] = useState<string>('');
  const [newCategory, setNewCategory] = useState<TodoCategory>('Penerimaan & QC');
  const [newPriority, setNewPriority] = useState<TodoPriority>('Tinggi');
  const [newSession, setNewSession] = useState<'Pagi' | 'Siang' | 'Sore' | 'Harian'>('Pagi');
  const [newAssignedRole, setNewAssignedRole] = useState<UserRole | 'ALL'>('ALL');
  const [newNotes, setNewNotes] = useState<string>('');

  // Refresh todos from db
  const refreshTodos = () => {
    setTodos(warehouseDb.getDailyTodos(selectedDate));
  };

  // Change date
  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setTodos(warehouseDb.getDailyTodos(date));
  };

  // Handle Save Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);

    if (!name.trim()) {
      setProfileMessage({ type: 'error', text: 'Nama lengkap pengguna wajib diisi.' });
      return;
    }

    if (newPassword && newPassword.length < 6) {
      setProfileMessage({ type: 'error', text: 'Password baru minimal harus 6 karakter.' });
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setProfileMessage({ type: 'error', text: 'Konfirmasi password baru tidak cocok.' });
      return;
    }

    setIsSavingProfile(true);
    const result = await updateProfile({
      name: name.trim(),
      role: role,
      password: newPassword || undefined,
    });
    setIsSavingProfile(false);

    if (result.success) {
      setProfileMessage({
        type: 'success',
        text: 'Profil dan pengaturan hak akses berhasil disimpan serta diperbarui di seluruh sistem.',
      });
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setProfileMessage({
        type: 'error',
        text: result.error || 'Terjadi kesalahan saat memperbarui profil.',
      });
    }
  };

  // Handle Toggle Todo Checkbox
  const handleToggleTodo = (todoId: string) => {
    const updated = warehouseDb.toggleTodo(todoId, currentUser);
    setTodos(prev => prev.map(t => (t.id === todoId ? updated : t)));

    // Check if after this toggle all items are completed
    const currentList = warehouseDb.getDailyTodos(selectedDate);
    const allCompleted = currentList.length > 0 && currentList.every(t => t.isCompleted);
    if (allCompleted && updated.isCompleted) {
      // Suggest user to inspect report
      setTimeout(() => {
        const viewRep = window.confirm(
          'Luar biasa! Seluruh checklist tugas harian SPPG hari ini telah selesai 100%.\n\nBuka Lembar Laporan Penyelesaian Tugas Harian sekarang?'
        );
        if (viewRep) {
          setActiveSubTab('report');
        }
      }, 300);
    }
  };

  // Handle Add Todo
  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      alert('Judul tugas harian wajib diisi.');
      return;
    }

    warehouseDb.addTodo(
      {
        date: selectedDate,
        title: newTitle.trim(),
        category: newCategory,
        priority: newPriority,
        session: newSession,
        assignedRole: newAssignedRole,
        notes: newNotes.trim() || undefined,
        isCompleted: false,
      },
      currentUser
    );

    // Reset form
    setNewTitle('');
    setNewNotes('');
    setIsAddModalOpen(false);
    refreshTodos();
  };

  // Handle Delete Todo
  const handleDeleteTodo = (id: string, title: string) => {
    if (window.confirm(`Hapus tugas harian "${title}"?`)) {
      warehouseDb.deleteTodo(id, currentUser);
      refreshTodos();
    }
  };

  // Handle Reset Todos
  const handleResetTodos = () => {
    if (
      window.confirm(
        'Kembalikan daftar ceklis harian tanggal ini ke 8 tugas standar operasional SPPG?'
      )
    ) {
      warehouseDb.resetDailyTodos(selectedDate);
      refreshTodos();
    }
  };

  // Filtered Todos
  const filteredTodos = useMemo(() => {
    return todos.filter(item => {
      const matchCat = categoryFilter === 'ALL' || item.category === categoryFilter;
      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'COMPLETED' && item.isCompleted) ||
        (statusFilter === 'PENDING' && !item.isCompleted);
      return matchCat && matchStatus;
    });
  }, [todos, categoryFilter, statusFilter]);

  // Statistics
  const totalTasks = todos.length;
  const completedTasks = todos.filter(t => t.isCompleted).length;
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const isAllCompleted = totalTasks > 0 && completedTasks === totalTasks;

  // Last completed task info
  const completedList = todos.filter(t => t.isCompleted && t.completedAt);
  const lastCompletedItem = completedList.length > 0 ? completedList[completedList.length - 1] : null;

  // Export Report to Excel
  const handleExportExcel = () => {
    const exportData = todos.map((t, index) => ({
      'No': index + 1,
      'Tanggal': t.date,
      'Shift / Sesi': t.session || 'Harian',
      'Kategori Tugas': t.category,
      'Uraian Tugas SOP': t.title,
      'Prioritas': t.priority,
      'Status': t.isCompleted ? 'SELESAI' : 'BELUM SELESAI',
      'Waktu Selesai': t.completedAt || '-',
      'Pelaksana (PIC)': t.completedBy || '-',
      'Peran': t.assignedRole || 'ALL',
      'Catatan': t.notes || '-',
    }));

    exportToExcel(
      exportData,
      `Laporan_Tugas_Harian_SPPG_${selectedDate}.xlsx`,
      'Laporan Tugas Harian'
    );
  };

  // Print Report (PDF)
  const handlePrintReport = () => {
    window.print();
  };

  const roleDescriptions: Record<UserRole, { title: string; desc: string; badgeColor: string }> = {
    SUPERADMIN: {
      title: 'Superadmin Gudang & Dapur',
      desc: 'Akses penuh ke seluruh konfigurasi sistem, audit log, manajemen item, transaksi gudang, dan otorisasi dokumen.',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    },
    KA_SPPG: {
      title: 'Kepala SPPG (Pimpinan Satuan Pelayanan)',
      desc: 'Verifikasi & persetujuan stock opname, monitoring kepatuhan SOP harian, otorisasi penerimaan dan pengeluaran bahan pangan.',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    },
    ADMIN: {
      title: 'Admin Operasional Gudang',
      desc: 'Pencatatan penerimaan barang (GRN), pembuatan pesanan menu gizi, pencatatan mutasi stok harian dan master item.',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    },
    ASLAP: {
      title: 'Asisten Lapangan & QC Dapur',
      desc: 'Pemeriksaan fisik bahan datang, uji organoleptik, cek suhu chiller, pencatatan limbah dan serah terima bahan masak.',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    },
    AKUNTAN: {
      title: 'Akuntan / Finance SPPG',
      desc: 'Rekonsiliasi buku mutasi, validasi bon pengeluaran non-food, rekapitulasi biaya per porsi dan audit kepatuhan anggaran.',
      badgeColor: 'bg-teal-100 text-teal-800 border-teal-200',
    },
  };

  return (
    <div className="space-y-6">
      {/* Module Title Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
              <User className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-800">
              Profil Pengguna & Tugas Harian SPPG
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Kelola profil, ganti kata sandi, simulasikan peran pengguna, dan pantau checklist operasional harian.
          </p>
        </div>

        {/* Tab Navigation Pill */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl self-start md:self-auto border border-slate-200">
          <button
            onClick={() => setActiveSubTab('profile')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'profile'
                ? 'bg-white text-emerald-800 shadow-2xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>Profil & Keamanan</span>
          </button>

          <button
            onClick={() => setActiveSubTab('todos')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'todos'
                ? 'bg-white text-emerald-800 shadow-2xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ListTodo className="w-3.5 h-3.5 text-blue-600" />
            <span>Checklist Harian</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
              {completedTasks}/{totalTasks}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('report')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'report'
                ? 'bg-white text-emerald-800 shadow-2xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCheck2 className="w-3.5 h-3.5 text-teal-600" />
            <span>Laporan Penyelesaian</span>
            {isAllCompleted && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            )}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PROFIL & KEAMANAN AKUN */}
      {/* ========================================================================= */}
      {activeSubTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Edit Form */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-2xs p-6">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-600" />
                  Pengaturan Identitas & Kredensial
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ubah nama lengkap, ganti kata sandi login, dan sesuaikan peran operasional SPPG Anda.
                </p>
              </div>
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Sesi Aktif
              </span>
            </div>

            {profileMessage && (
              <div
                className={`mb-5 p-3.5 rounded-lg text-xs font-medium flex items-start gap-2.5 ${
                  profileMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {profileMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span>{profileMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-5">
              {/* Email (Readonly) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alamat Email Akun
                </label>
                <input
                  type="email"
                  value={currentUser.email}
                  disabled
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Email digunakan sebagai identitas akun login dan integrasi otorisasi.
                </p>
              </div>

              {/* Nama User */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap Pengguna <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Masukkan nama lengkap petugas..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-800"
                />
              </div>

              {/* Ganti Role */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Peran / Jabatan Petugas <span className="text-rose-500">*</span>
                </label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white text-slate-800 cursor-pointer font-medium"
                >
                  <option value="SUPERADMIN">Superadmin — Akses Penuh Konfigurasi & Audit</option>
                  <option value="KA_SPPG">Ka SPPG — Kepala Satuan Pelayanan & Otorisasi</option>
                  <option value="ADMIN">Admin — Operasional Gudang & Order Menu</option>
                  <option value="ASLAP">Aslap — Asisten Lapangan & QC Pemeriksaan Dapur</option>
                  <option value="AKUNTAN">Akuntan — Validasi Biaya, Buku Mutasi & Keuangan</option>
                </select>
                <div className="mt-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600">
                  <strong className="text-slate-800">{roleDescriptions[role]?.title}:</strong>{' '}
                  {roleDescriptions[role]?.desc}
                </div>
              </div>

              {/* Divider for Password */}
              <div className="pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                    Ganti Kata Sandi (Opsional)
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] text-emerald-700 hover:text-emerald-800 flex items-center gap-1 font-medium cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showPassword ? 'Sembunyikan' : 'Tampilkan'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Kata Sandi Baru
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Minimal 6 karakter..."
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Konfirmasi Kata Sandi Baru
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Ulangi kata sandi baru..."
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-800"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Kosongkan kolom kata sandi jika Anda hanya ingin memperbarui nama atau peran pengguna.
                </p>
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSavingProfile ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>Simpan Perubahan Profil</span>
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: User Card & Unit Info */}
          <div className="space-y-4">
            {/* Identity Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                  {currentUser.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 leading-tight">
                    {currentUser.name}
                  </h3>
                  <p className="text-xs text-slate-500 leading-normal">{currentUser.email}</p>
                </div>
              </div>

              <div className="space-y-2.5 pt-3 border-t border-slate-100 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">ID Petugas:</span>
                  <span className="font-mono font-medium text-slate-700">{currentUser.id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Peran Aktif:</span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                      roleDescriptions[currentUser.role]?.badgeColor || 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    {currentUser.role}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Status Akun:</span>
                  <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Aktif
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Unit:</span>
                  <span className="font-medium text-slate-800">SPPG Jeru Tumpang 01</span>
                </div>
              </div>
            </div>

            {/* Quick Checklist Widget */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <ListTodo className="w-3.5 h-3.5" />
                  Status Checklist Hari Ini
                </span>
                <span className="text-xs font-bold text-slate-300">
                  {completionPercentage}%
                </span>
              </div>

              <div className="w-full bg-slate-700/80 rounded-full h-2 mb-3">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${completionPercentage}%` }}
                ></div>
              </div>

              <p className="text-[11px] text-slate-300 mb-3.5 leading-relaxed">
                {isAllCompleted
                  ? 'Semua tugas harian SPPG hari ini telah selesai 100% dan terverifikasi.'
                  : `Tersisa ${totalTasks - completedTasks} tugas lagi yang perlu diselesaikan hari ini.`}
              </p>

              <button
                onClick={() => setActiveSubTab('todos')}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Buka Ceklis Operasional</span>
                <CheckSquare2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TODOLIST & CHECKLIST HARIAN SPPG */}
      {/* ========================================================================= */}
      {activeSubTab === 'todos' && (
        <div className="space-y-5">
          {/* Header Controls: Date Picker, Filters, Add Button */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Date selector */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => handleDateChange(e.target.value)}
                  className="text-xs font-semibold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                />
              </div>

              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="ALL">Semua Status</option>
                <option value="PENDING">Belum Selesai</option>
                <option value="COMPLETED">Sudah Selesai</option>
              </select>

              {/* Category filter */}
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="ALL">Semua Kategori</option>
                <option value="Penerimaan & QC">Penerimaan & QC</option>
                <option value="Persiapan Dapur">Persiapan Dapur</option>
                <option value="Sanitasi & Kebersihan">Sanitasi & Kebersihan</option>
                <option value="Administrasi & Stok">Administrasi & Stok</option>
                <option value="Distribusi">Distribusi</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleResetTodos}
                title="Muat ulang 8 tugas standar SPPG"
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Tugas Harian</span>
              </button>
            </div>
          </div>

          {/* Progress Banner */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-800">
                    Progres Penyelesaian Tugas Operasional
                  </h2>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isAllCompleted
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-blue-100 text-blue-800 border border-blue-200'
                    }`}
                  >
                    {isAllCompleted ? '100% Selesai Penuh' : `${completedTasks} dari ${totalTasks} Selesai`}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Centang tugas saat diverifikasi di lapangan. Waktu penyelesaian dan penanggung jawab tercatat otomatis.
                </p>
              </div>

              {isAllCompleted && (
                <button
                  onClick={() => setActiveSubTab('report')}
                  className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                >
                  <Award className="w-4 h-4 text-emerald-600" />
                  <span>Lihat Laporan Resmi</span>
                </button>
              )}
            </div>

            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
              <div
                className={`h-3 rounded-full transition-all duration-500 ${
                  isAllCompleted ? 'bg-emerald-600' : 'bg-emerald-500'
                }`}
                style={{ width: `${completionPercentage}%` }}
              ></div>
            </div>
          </div>

          {/* Checklist Items Cards */}
          <div className="space-y-2.5">
            {filteredTodos.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
                <ListTodo className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-medium">Tidak ada tugas harian yang cocok dengan filter.</p>
              </div>
            ) : (
              filteredTodos.map(todo => {
                const priorityBadge =
                  todo.priority === 'Tinggi'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : todo.priority === 'Sedang'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-slate-50 text-slate-600 border-slate-200';

                return (
                  <div
                    key={todo.id}
                    className={`bg-white rounded-xl border transition-all p-4 flex items-start gap-3.5 ${
                      todo.isCompleted
                        ? 'border-emerald-200 bg-emerald-50/20'
                        : 'border-slate-200 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    {/* Checkbox Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleTodo(todo.id)}
                      className="mt-0.5 text-emerald-600 hover:text-emerald-700 transition-transform active:scale-95 cursor-pointer shrink-0"
                      title={todo.isCompleted ? 'Tandai belum selesai' : 'Tandai selesai'}
                    >
                      {todo.isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 fill-emerald-600 text-white" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-300 hover:text-emerald-500" />
                      )}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {todo.category}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${priorityBadge}`}>
                          Prioritas {todo.priority}
                        </span>
                        {todo.session && (
                          <span className="text-[10px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                            Shift {todo.session}
                          </span>
                        )}
                        {todo.assignedRole && todo.assignedRole !== 'ALL' && (
                          <span className="text-[10px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                            PIC: {todo.assignedRole}
                          </span>
                        )}
                      </div>

                      <h3
                        className={`text-xs font-semibold leading-relaxed ${
                          todo.isCompleted ? 'text-slate-500 line-through' : 'text-slate-900'
                        }`}
                      >
                        {todo.title}
                      </h3>

                      {todo.notes && (
                        <p className="text-[11px] text-slate-500 mt-1 italic">
                          Catatan: {todo.notes}
                        </p>
                      )}

                      {/* Completed Audit Footer */}
                      {todo.isCompleted && (
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-emerald-700">
                          <span className="flex items-center gap-1 font-medium">
                            <Clock className="w-3 h-3 text-emerald-600" />
                            Selesai pukul {todo.completedAt}
                          </span>
                          {todo.completedBy && (
                            <span className="flex items-center gap-1 text-slate-500">
                              <User className="w-3 h-3 text-slate-400" />
                              Oleh {todo.completedBy}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={() => handleDeleteTodo(todo.id, todo.title)}
                      title="Hapus tugas ini"
                      className="text-slate-300 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: LAPORAN PENYELESAIAN TUGAS HARIAN (REPORT & BERITA ACARA) */}
      {/* ========================================================================= */}
      {activeSubTab === 'report' && (
        <div className="space-y-6">
          {/* Action Toolbar */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-semibold text-slate-700">Tanggal Laporan:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={e => handleDateChange(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 px-2 py-1 rounded-md cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                <span>Ekspor Excel (.xlsx)</span>
              </button>

              <button
                onClick={handlePrintReport}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-slate-200" />
                <span>Cetak Laporan (PDF)</span>
              </button>
            </div>
          </div>

          {/* Completion Celebration Badge if 100% */}
          {isAllCompleted ? (
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl p-5 shadow-sm flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-white/10 rounded-xl">
                  <Sparkles className="w-6 h-6 text-yellow-300" />
                </div>
                <div>
                  <h3 className="text-sm font-bold leading-tight">
                    Checklist Tugas Harian Telah Selesai 100%
                  </h3>
                  <p className="text-xs text-emerald-100 mt-0.5">
                    Seluruh {totalTasks} butir tugas operasional SPPG telah diverifikasi dan memenuhi standar operasional prosedur gizi.
                  </p>
                </div>
              </div>
              <div className="hidden sm:block text-right">
                <div className="text-[11px] text-emerald-200">Status Tugas</div>
                <div className="text-xs font-bold bg-white/20 px-2.5 py-1 rounded-lg mt-0.5">
                  Semua Selesai
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 text-amber-800 text-xs">
              <Info className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Laporan ini mencatat progres berjalan: <strong>{completedTasks}</strong> dari <strong>{totalTasks}</strong> tugas selesai ({completionPercentage}%). Anda tetap dapat mencetak atau mengekspor laporan sementara.
              </span>
            </div>
          )}

          {/* Printable Report Paper Layout */}
          <div
            id="printable-report-area"
            className="bg-white rounded-xl border border-slate-300 shadow-sm p-8 print:p-0 print:border-none print:shadow-none"
          >
            {/* Report Header */}
            <div className="flex items-start justify-between border-b-2 border-slate-800 pb-5 mb-6">
              <div className="flex items-center gap-3.5">
                <SppgLogo size="lg" variant="color" />
                <div>
                  <h2 className="text-base font-bold text-slate-900 leading-tight">
                    SATUAN PELAYANAN PEMENUHAN GIZI (SPPG)
                  </h2>
                  <p className="text-xs font-semibold text-slate-700">
                    Unit Pelayanan Dapur Gizi Jeru Tumpang 01
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Sistem Manajemen Pergudangan, Higienitas, & Aliran Bahan Pangan
                  </p>
                </div>
              </div>

              <div className="text-right text-xs">
                <div className="font-bold text-slate-800">BERITA ACARA LAPORAN HARIAN</div>
                <div className="font-mono text-slate-500 text-[11px] mt-0.5">
                  NOMOR: BA-SPPG/{selectedDate.replace(/-/g, '')}/01
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Tanggal:{' '}
                  <strong className="text-slate-700">
                    {new Date(selectedDate).toLocaleDateString('id-ID', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </strong>
                </div>
              </div>
            </div>

            {/* Metrics Overview Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-[11px] text-slate-500 font-medium">Total Tugas Terjadwal</div>
                <div className="text-lg font-bold text-slate-800 mt-0.5">{totalTasks} Butir</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-[11px] text-slate-500 font-medium">Tugas Selesai</div>
                <div className="text-lg font-bold text-emerald-700 mt-0.5">{completedTasks} Butir</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-[11px] text-slate-500 font-medium">Tingkat Kepatuhan SOP</div>
                <div className="text-lg font-bold text-slate-800 mt-0.5">{completionPercentage}%</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-[11px] text-slate-500 font-medium">Penyelesaian Terakhir</div>
                <div className="text-lg font-bold text-slate-800 mt-0.5">
                  {lastCompletedItem?.completedAt ? `Pukul ${lastCompletedItem.completedAt}` : '-'}
                </div>
              </div>
            </div>

            {/* Itemized Table */}
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">No</th>
                    <th className="py-2.5 px-3">Kategori & Shift</th>
                    <th className="py-2.5 px-3">Uraian Butir Tugas Operasional</th>
                    <th className="py-2.5 px-3 w-24">Prioritas</th>
                    <th className="py-2.5 px-3 w-28 text-center">Status</th>
                    <th className="py-2.5 px-3 w-24">Jam Selesai</th>
                    <th className="py-2.5 px-3">Pelaksana (PIC)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {todos.map((todo, idx) => (
                    <tr key={todo.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="py-2 px-3 text-center font-medium text-slate-500">{idx + 1}</td>
                      <td className="py-2 px-3">
                        <div className="font-semibold text-slate-800">{todo.category}</div>
                        <div className="text-[10px] text-slate-500">Shift {todo.session || 'Harian'}</div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-medium text-slate-800">{todo.title}</div>
                        {todo.notes && (
                          <div className="text-[11px] text-slate-500 italic mt-0.5">{todo.notes}</div>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                            todo.priority === 'Tinggi'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {todo.priority}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            todo.isCompleted
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {todo.isCompleted ? 'SELESAI' : 'BELUM'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-600 font-mono text-[11px]">
                        {todo.completedAt ? `${todo.completedAt} WIB` : '-'}
                      </td>
                      <td className="py-2 px-3 text-slate-700">
                        {todo.completedBy || (todo.assignedRole ? `Penugasan: ${todo.assignedRole}` : '-')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Statement & Signatures */}
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/40 mb-8 text-xs text-slate-600 leading-relaxed">
              <strong className="text-slate-800">Pernyataan:</strong> Seluruh butir tugas di atas telah diperiksa dan diselesaikan sesuai penugasan kerja operasional harian SPPG.
            </div>

            {/* Signature Columns */}
            <div className="grid grid-cols-2 gap-8 pt-4">
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-1">Pelaksana Operasional Lapangan</p>
                <p className="text-xs font-semibold text-slate-700">Petugas Yang Memeriksa,</p>
                <div className="h-16 flex items-end justify-center">
                  <div className="border-b border-slate-400 w-44"></div>
                </div>
                <p className="text-xs font-bold text-slate-800 mt-1">{currentUser.name}</p>
                <p className="text-[11px] text-slate-500">Jabatan: {currentUser.role}</p>
              </div>

              <div className="text-center">
                <p className="text-xs text-slate-500 mb-1">Mengetahui & Menyetujui</p>
                <p className="text-xs font-semibold text-slate-700">Kepala SPPG Unit 01,</p>
                <div className="h-16 flex items-end justify-center">
                  <div className="border-b border-slate-400 w-44"></div>
                </div>
                <p className="text-xs font-bold text-slate-800 mt-1">Dr. Siti Rahma, M.Gizi</p>
                <p className="text-[11px] text-slate-500">NIP / ID: SPPG-KA-2026-001</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: TAMBAH TUGAS HARIAN BARU */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                Tambah Butir Tugas Ceklis Harian
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddTodo} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Uraian Butir Tugas <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Contoh: Kalibrasi timbangan digital & cek sanitizer lantai..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                    <option value="Tinggi">Tinggi</option>
                    <option value="Sedang">Sedang</option>
                    <option value="Rendah">Rendah</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
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

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Penugasan Peran</label>
                  <select
                    value={newAssignedRole}
                    onChange={e => setNewAssignedRole(e.target.value as any)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-slate-800 cursor-pointer"
                  >
                    <option value="ALL">Semua Petugas (Umum)</option>
                    <option value="ASLAP">Aslap (QC / Lapangan)</option>
                    <option value="ADMIN">Admin Gudang</option>
                    <option value="AKUNTAN">Akuntan / Finance</option>
                    <option value="KA_SPPG">Kepala SPPG</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Catatan SOP / Instruksi Khusus (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                  placeholder="Catatan parameter pemeriksaan, nomor form rujukan, dll..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
                ></textarea>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                >
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
