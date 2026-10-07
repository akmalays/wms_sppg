import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { warehouseDb } from '../db/storage';
import { User, UserRole } from '../types/warehouse';
import {
  Users,
  UserPlus,
  Search,
  ShieldCheck,
  Mail,
  Lock,
  Phone,
  IdCard,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Edit2,
  X,
  Eye,
  EyeOff,
  UserCheck,
  KeyRound,
  Building2,
  Calendar,
  Download
} from 'lucide-react';

export const UserManagementModule: React.FC = () => {
  const { currentUser, availableUsers, registerUser } = useAuth();

  // Local state for user list (synced with warehouseDb)
  const [users, setUsers] = useState<User[]>(() => warehouseDb.getUsers());
  const [activeTab, setActiveTab] = useState<'LIST' | 'CREATE'>('LIST');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('ALL');

  // Form State for creating new user
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [nip, setNip] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('ASLAP');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authCode, setAuthCode] = useState('SPPG-JERU-2026');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit User Modal State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('ADMIN');
  const [editNip, setEditNip] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editNewPassword, setEditNewPassword] = useState('');

  const refreshUserList = () => {
    setUsers(warehouseDb.getUsers());
  };

  const rolesCatalog: Array<{ role: UserRole; title: string; badge: string; desc: string }> = [
    {
      role: 'SUPERADMIN',
      title: 'Superadmin',
      badge: 'bg-purple-50 text-purple-700 border-purple-200',
      desc: 'Akses penuh konfigurasi sistem, database dan audit trail keamanan.',
    },
    {
      role: 'KA_SPPG',
      title: 'Ka SPPG (Kepala Unit)',
      badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      desc: 'Pimpinan satuan pelayanan, persetujuan opname dan monitoring kepatuhan.',
    },
    {
      role: 'ADMIN',
      title: 'Admin Gudang',
      badge: 'bg-sky-50 text-sky-800 border-sky-200',
      desc: 'Katalog barang, pesanan bahan, PO supplier dan persediaan harian.',
    },
    {
      role: 'ASLAP',
      title: 'Asisten Lapangan',
      badge: 'bg-amber-50 text-amber-800 border-amber-200',
      desc: 'Penerimaan fisik barang datang, penimbangan riil dan alur dapur.',
    },
    {
      role: 'AKUNTAN',
      title: 'Akuntan / Finance',
      badge: 'bg-teal-50 text-teal-800 border-teal-200',
      desc: 'Buku mutasi stok persediaan, rekap biaya dan rekonsiliasi.',
    },
  ];

  const getRoleBadge = (userRole: UserRole) => {
    const found = rolesCatalog.find(r => r.role === userRole);
    if (found) return found;
    return {
      role: userRole,
      title: userRole,
      badge: 'bg-slate-100 text-slate-700 border-slate-200',
      desc: 'Personel Unit SPPG',
    };
  };

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch =
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.nip && u.nip.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesRole = selectedRoleFilter === 'ALL' || u.role === selectedRoleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, selectedRoleFilter]);

  // Handle Form Submit: Create New User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMessage(null);

    if (!name.trim()) {
      setFeedbackMessage({ type: 'error', text: 'Nama lengkap petugas wajib diisi.' });
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setFeedbackMessage({ type: 'error', text: 'Alamat email dinas yang sah wajib diisi.' });
      return;
    }
    if (!password) {
      setFeedbackMessage({ type: 'error', text: 'Kata sandi akun wajib diisi.' });
      return;
    }
    if (password.length < 6) {
      setFeedbackMessage({ type: 'error', text: 'Kata sandi minimal harus 6 karakter.' });
      return;
    }
    if (password !== confirmPassword) {
      setFeedbackMessage({ type: 'error', text: 'Konfirmasi kata sandi tidak cocok.' });
      return;
    }

    setIsSubmitting(true);
    try {
      // Check existing email
      const existing = users.some(u => u.email.toLowerCase() === email.trim().toLowerCase());
      if (existing) {
        setFeedbackMessage({ type: 'error', text: `Email ${email.trim()} sudah digunakan oleh petugas lain.` });
        setIsSubmitting(false);
        return;
      }

      // Add to database
      warehouseDb.registerUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        nip: nip.trim() || undefined,
        phone: phone.trim() || undefined,
        password,
      });

      refreshUserList();

      setFeedbackMessage({
        type: 'success',
        text: `Akun petugas "${name.trim()}" dengan peran ${role} berhasil dibuat dan diaktifkan.`,
      });

      // Reset form
      setName('');
      setEmail('');
      setNip('');
      setPhone('');
      setPassword('');
      setConfirmPassword('');
      setRole('ASLAP');

      // Switch to list after brief pause
      setTimeout(() => {
        setActiveTab('LIST');
      }, 1200);
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Gagal membuat user baru.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditRole(user.role);
    setEditNip(user.nip || '');
    setEditPhone(user.phone || '');
    setEditNewPassword('');
  };

  // Save Edit
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    if (!editName.trim()) {
      alert('Nama petugas wajib diisi.');
      return;
    }

    try {
      warehouseDb.updateUser(editingUser.id, {
        name: editName.trim(),
        role: editRole,
        nip: editNip.trim() || undefined,
        phone: editPhone.trim() || undefined,
        password: editNewPassword.trim() || undefined,
      });
      refreshUserList();
      setEditingUser(null);
      alert('Data petugas berhasil diperbarui.');
    } catch (err: any) {
      alert(err.message || 'Gagal memperbarui data petugas.');
    }
  };

  // Delete User
  const handleDeleteUser = (user: User) => {
    if (user.id === currentUser.id) {
      alert('Anda tidak dapat menghapus akun yang sedang Anda gunakan saat ini.');
      return;
    }

    const isSeedUser = ['USR-001', 'USR-002', 'USR-003', 'USR-004', 'USR-005'].includes(user.id);
    const confirmText = isSeedUser
      ? `Akun "${user.name}" (${user.role}) adalah akun bawaan demo SPPG. Yakin ingin menghapusnya?`
      : `Yakin ingin menghapus akun petugas "${user.name}" (${user.email})?`;

    if (window.confirm(confirmText)) {
      warehouseDb.deleteUser(user.id);
      refreshUserList();
    }
  };

  const handleExportUsers = () => {
    const allUsers = warehouseDb.getUsers();
    const exportPayload = {
      system: 'WMS SPPG MLG TUMPANG JERU',
      unit: 'Satuan Pelayanan Pemenuhan Gizi (SPPG) MLG TUMPANG JERU, Kab. Malang',
      agency: 'Badan Gizi Nasional Republik Indonesia',
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      users: allUsers.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        nip: u.nip || '',
        phone: u.phone || '',
        password: warehouseDb.getUserPassword(u.email) || `${u.name.toLowerCase().split(' ')[0]}123`,
      })),
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `sppg_users_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="bg-white rounded-xl border border-[#ded7c8] p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[#ecf7f0] text-[#0c3123] border border-[#c2e7cf]">
                <Users className="w-5 h-5" />
              </span>
              <h1 className="font-serif-display text-xl sm:text-2xl font-bold text-[#111915] tracking-tight">
                Manajemen Petugas & Akun Pengguna
              </h1>
            </div>
            <p className="text-xs text-[#5a6860] mt-1">
              Satuan Pelayanan Pemenuhan Gizi (SPPG) MLG TUMPANG JERU, Kab. Malang. Kelola hak akses, perizinan, dan penugasan operasional staf.
            </p>
          </div>

          {/* Action & Tab Buttons */}
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto flex-wrap">
            <button
              type="button"
              onClick={handleExportUsers}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#111915] bg-white hover:bg-[#faf8f4] border border-[#ded7c8] transition-all cursor-pointer shadow-xs"
              title="Ekspor seluruh akun petugas ke file JSON"
            >
              <Download className="w-3.5 h-3.5 text-[#5a6860]" />
              <span>Ekspor Data User</span>
            </button>

            <div className="flex items-center gap-1 p-1 bg-[#ede7da] rounded-lg border border-[#ded7c8]">
              <button
                type="button"
                onClick={() => setActiveTab('LIST')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'LIST'
                    ? 'bg-[#0c3123] text-white shadow-xs'
                    : 'text-[#44534a] hover:text-[#0c3123]'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Daftar Petugas ({users.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('CREATE');
                  setFeedbackMessage(null);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'CREATE'
                    ? 'bg-[#0c3123] text-white shadow-xs'
                    : 'text-[#44534a] hover:text-[#0c3123]'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Buat User Baru</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-[#eee8dc]">
          <div className="p-3 rounded-lg bg-[#faf8f4] border border-[#ded7c8]">
            <div className="text-[11px] text-[#5a6860] font-medium">Total Akun Petugas</div>
            <div className="font-serif-display text-lg font-bold text-[#111915] mt-0.5">{users.length} Orang</div>
          </div>
          <div className="p-3 rounded-lg bg-[#ecf7f0] border border-[#c2e7cf]">
            <div className="text-[11px] text-[#0c3123] font-medium">Ka SPPG & Admin</div>
            <div className="font-serif-display text-lg font-bold text-[#0c3123] mt-0.5">
              {users.filter(u => u.role === 'KA_SPPG' || u.role === 'ADMIN').length} Orang
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[#fbf5ee] border border-[#ebdcc9]">
            <div className="text-[11px] text-[#8a4a12] font-medium">Asisten Lapangan (QC)</div>
            <div className="font-serif-display text-lg font-bold text-[#8a4a12] mt-0.5">
              {users.filter(u => u.role === 'ASLAP').length} Orang
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[#f0f9f8] border border-[#bce3de]">
            <div className="text-[11px] text-[#0e5c54] font-medium">Akuntan & Finance</div>
            <div className="font-serif-display text-lg font-bold text-[#0e5c54] mt-0.5">
              {users.filter(u => u.role === 'AKUNTAN').length} Orang
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: FORM BUAT USER BARU */}
      {/* ========================================================================= */}
      {activeTab === 'CREATE' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Kolom Kiri: Form Registrasi Input */}
          <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-2xs p-5 sm:p-6">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-emerald-600" />
                  Formulir Penambahan Akun Petugas Baru
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Lengkapi data petugas untuk menerbitkan akun baru WMS SPPG MLG TUMPANG JERU.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('LIST')}
                className="text-xs text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
              >
                Lihat Daftar Akun →
              </button>
            </div>

            {/* Alert Message */}
            {feedbackMessage && (
              <div
                className={`mb-4 p-3.5 rounded-lg text-xs font-medium flex items-start gap-2.5 ${
                  feedbackMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {feedbackMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span>{feedbackMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              {/* Nama Lengkap */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap & Gelar Petugas <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Contoh: Budi Santoso, S.Tr.Gz"
                    className="w-full pl-9 pr-3.5 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 text-slate-800 bg-white"
                  />
                </div>
              </div>

              {/* Email & NIP */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Dinas Petugas <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="nama.petugas@sppg.id"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 text-slate-800 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    NIP / Nomor Pegawai <span className="text-slate-400 text-[10px]">(Opsional)</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <IdCard className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={nip}
                      onChange={e => setNip(e.target.value)}
                      placeholder="19950101 202401 1"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 text-slate-800 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Nomor HP & Kode Unit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nomor WhatsApp / HP Aktif <span className="text-slate-400 text-[10px]">(Opsional)</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Phone className="w-4 h-4" />
                    </div>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="081234567890"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 text-slate-800 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kode Unit SPPG
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={authCode}
                      onChange={e => setAuthCode(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs font-mono font-medium rounded-lg border border-slate-300 bg-slate-50 text-slate-700"
                    />
                  </div>
                </div>
              </div>

              {/* Pilihan Peran */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Pilih Peran Petugas & Hak Otorisasi <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {rolesCatalog.map(item => {
                    const isSelected = role === item.role;
                    return (
                      <button
                        key={item.role}
                        type="button"
                        onClick={() => setRole(item.role)}
                        className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">{item.title}</span>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                          {item.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Kata Sandi Akun */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kata Sandi Akun Baru <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Min. 6 karakter"
                      className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 text-slate-800 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ulangi Kata Sandi <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Konfirmasi sandi"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 text-slate-800 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Tombol Simpan & Aktifkan */}
              <div className="pt-3 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 py-2 px-5 rounded-lg text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 shadow-2xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Mendaftarkan akun...' : 'Simpan & Aktifkan Petugas'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('LIST')}
                  className="py-2 px-4 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>

          {/* Kolom Kanan: Petunjuk Standar Akun */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Petunjuk Penugasan Akun</span>
              </div>
              <ul className="text-xs text-slate-600 space-y-2 list-disc list-inside">
                <li>Gunakan alamat email dinas aktif agar notifikasi dan audit log tercatat akurat.</li>
                <li>Kata sandi minimal 6 karakter kombinasi huruf dan angka.</li>
                <li>Peran petugas dapat diubah sewaktu-waktu oleh Superadmin atau Kepala SPPG.</li>
                <li>Setelah dibuat, petugas baru dapat langsung masuk menggunakan email dan password tersebut.</li>
              </ul>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5">
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>Lokasi Penugasan</span>
              </div>
              <div className="text-xs text-slate-600 leading-relaxed">
                Unit Layanan SPPG MLG TUMPANG JERU<br />
                Kabupaten Malang, Jawa Timur<br />
                Program MBG (Makanan Bergizi Gratis)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DAFTAR USER TERDAFTAR */}
      {/* ========================================================================= */}
      {activeTab === 'LIST' && (
        <div className="bg-white rounded-xl border border-[#ded7c8] shadow-xs overflow-hidden">
          {/* Filter Bar */}
          <div className="p-4 border-b border-[#ded7c8] bg-[#faf8f4] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#5a6860]">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari berdasarkan nama, email dinas, atau NIP..."
                className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-lg border border-[#ded7c8] focus:outline-none focus:ring-1 focus:ring-[#0c3123] focus:border-[#0c3123] bg-white text-[#111915]"
              />
            </div>

            {/* Role Filter & Add Button */}
            <div className="flex items-center gap-2.5">
              <select
                value={selectedRoleFilter}
                onChange={e => setSelectedRoleFilter(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-[#ded7c8] bg-white text-[#111915] focus:outline-none focus:ring-1 focus:ring-[#0c3123] cursor-pointer"
              >
                <option value="ALL">Semua Peran ({users.length})</option>
                <option value="SUPERADMIN">Superadmin</option>
                <option value="KA_SPPG">Ka SPPG</option>
                <option value="ADMIN">Admin Gudang</option>
                <option value="ASLAP">Aslap</option>
                <option value="AKUNTAN">Akuntan</option>
              </select>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('CREATE');
                  setFeedbackMessage(null);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-[#0c3123] hover:bg-[#155e42] transition-colors shadow-xs cursor-pointer shrink-0"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Buat User Baru</span>
              </button>
            </div>
          </div>

          {/* Table of Users */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#fbf9f5] border-b border-[#ded7c8] text-[#44534a] font-semibold">
                <tr>
                  <th className="py-3 px-4">Petugas</th>
                  <th className="py-3 px-4">Peran & Otorisasi</th>
                  <th className="py-3 px-4">Kontak / NIP</th>
                  <th className="py-3 px-4">Status Sesi</th>
                  <th className="py-3 px-4 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eee8dc]">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#5a6860]">
                      Tidak ada petugas yang cocok dengan kata kunci atau filter peran ini.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(user => {
                    const badge = getRoleBadge(user.role);
                    const isSelf = user.id === currentUser.id;

                    return (
                      <tr key={user.id} className="hover:bg-[#faf8f4] transition-colors">
                        {/* Petugas Name & Email */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#ecf7f0] text-[#0c3123] flex items-center justify-center font-bold text-xs shrink-0 border border-[#c2e7cf]">
                              {user.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                            </div>
                            <div>
                              <div className="font-semibold text-[#111915] flex items-center gap-1.5">
                                <span>{user.name}</span>
                                {isSelf && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#ecf7f0] text-[#0c3123] border border-[#c2e7cf]">
                                    Anda
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-[#5a6860] font-mono">{user.email}</div>
                            </div>
                          </div>
                        </td>

                        {/* Peran & Badge */}
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium border ${badge.badge}`}>
                            {badge.title}
                          </span>
                          <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1 max-w-xs">
                            {badge.desc}
                          </div>
                        </td>

                        {/* Kontak / NIP */}
                        <td className="py-3 px-4 text-slate-600">
                          {user.nip ? (
                            <div className="font-mono text-[11px]">NIP: {user.nip}</div>
                          ) : (
                            <div className="text-[11px] text-slate-400">NIP Belum Diisi</div>
                          )}
                          {user.phone && (
                            <div className="text-[11px] text-slate-500">{user.phone}</div>
                          )}
                        </td>

                        {/* Status Sesi */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>Aktif</span>
                          </div>
                          <div className="text-[10px] text-slate-400">Unit SPPG MLG TUMPANG JERU</div>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(user)}
                              title="Edit Petugas"
                              className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {!isSelf && (
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(user)}
                                title="Hapus Akun"
                                className="p-1.5 rounded-md text-slate-500 hover:text-rose-700 hover:bg-slate-100 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Menampilkan {filteredUsers.length} dari {users.length} akun petugas</span>
            <span>ID Sesi Terdaftar: SPPG-JERU-MLG</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT USER */}
      {/* ========================================================================= */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  Ubah Profil & Hak Akses Petugas
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Akun (Tetap)
                </label>
                <input
                  type="email"
                  disabled
                  value={editingUser.email}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Petugas <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-600 text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    NIP Petugas
                  </label>
                  <input
                    type="text"
                    value={editNip}
                    onChange={e => setEditNip(e.target.value)}
                    placeholder="1995..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-600 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    No. WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={e => setEditPhone(e.target.value)}
                    placeholder="0812..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-600 text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Peran / Penugasan <span className="text-rose-500">*</span>
                </label>
                <select
                  value={editRole}
                  onChange={e => setEditRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-600 bg-white text-slate-800 cursor-pointer"
                >
                  <option value="SUPERADMIN">Superadmin - Akses Penuh Sistem & Audit</option>
                  <option value="KA_SPPG">Ka SPPG - Kepala Unit Pelayanan</option>
                  <option value="ADMIN">Admin Gudang - Stok & Operasional</option>
                  <option value="ASLAP">Aslap - Penerimaan & QC Dapur</option>
                  <option value="AKUNTAN">Akuntan - Mutasi & Keuangan</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reset Kata Sandi Baru <span className="text-[10px] text-slate-400">(Kosongkan jika tidak diganti)</span>
                </label>
                <input
                  type="password"
                  value={editNewPassword}
                  onChange={e => setEditNewPassword(e.target.value)}
                  placeholder="Masukkan kata sandi baru (min. 6 karakter)..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-600 text-slate-800"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-2xs cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
