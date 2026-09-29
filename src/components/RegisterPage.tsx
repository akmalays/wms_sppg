import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types/warehouse';
import logoSppgImg from '../assets/logo sppg.png';
import {
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Building2,
  CheckCircle2,
  KeyRound,
  IdCard,
  Briefcase
} from 'lucide-react';

interface RegisterPageProps {
  onNavigateToLogin: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigateToLogin }) => {
  const { registerUser } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [nip, setNip] = useState('');
  const [role, setRole] = useState<UserRole>('ASLAP');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authCode, setAuthCode] = useState('SPPG-JERU-2026');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const rolesList: Array<{ role: UserRole; title: string; badge: string; desc: string }> = [
    {
      role: 'SUPERADMIN',
      title: 'Superadmin',
      badge: 'bg-purple-50 text-purple-700 border-purple-200',
      desc: 'Akses penuh seluruh sistem, database & manajemen pengguna',
    },
    {
      role: 'KA_SPPG',
      title: 'Ka SPPG (Kepala Unit)',
      badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      desc: 'Pimpinan unit, persetujuan opname & monitoring kepatuhan audit',
    },
    {
      role: 'ADMIN',
      title: 'Admin Gudang',
      badge: 'bg-sky-50 text-sky-800 border-sky-200',
      desc: 'Pencatatan katalog barang, PO supplier, alat & kartu stok',
    },
    {
      role: 'ASLAP',
      title: 'Asisten Lapangan',
      badge: 'bg-amber-50 text-amber-800 border-amber-200',
      desc: 'Penerimaan fisik dermaga, verifikasi timbangan & alur dapur',
    },
    {
      role: 'AKUNTAN',
      title: 'Akuntan / Finance',
      badge: 'bg-teal-50 text-teal-800 border-teal-200',
      desc: 'Buku mutasi persediaan, nilai stok & rekonsiliasi pengeluaran',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Nama lengkap petugas wajib diisi.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Alamat email dinas yang valid wajib diisi.');
      return;
    }
    if (!password) {
      setErrorMessage('Kata sandi wajib diisi.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Kata sandi minimal harus 6 karakter.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Konfirmasi kata sandi tidak cocok.');
      return;
    }
    if (!authCode.trim()) {
      setErrorMessage('Kode verifikasi unit SPPG wajib diisi.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await registerUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        password,
        nip: nip.trim() || undefined,
      });

      if (!result.success) {
        setErrorMessage(result.error || 'Gagal mendaftarkan user baru.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan saat pendaftaran.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-800 font-sans flex flex-col lg:grid lg:grid-cols-12">
      {/* Kolom Kiri: Identitas Resmi & Ketentuan Akses SPPG */}
      <div className="lg:col-span-5 bg-slate-950 border-b lg:border-b-0 lg:border-r border-slate-800/80 p-6 sm:p-10 lg:p-12 flex flex-col justify-between text-white relative overflow-hidden">
        {/* Subtle ambient light */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,_rgba(6,78,59,0.15),transparent_60%)] pointer-events-none" />

        <div className="relative z-10 space-y-7">
          {/* Logo & Header Institusi */}
          <div className="flex items-center gap-3.5">
            <img
              src={logoSppgImg}
              alt="Logo SPPG"
              className="w-12 h-12 object-contain shrink-0 rounded-lg p-1 bg-white/5 border border-white/10"
            />
            <div>
              <div className="text-[11px] font-semibold text-emerald-400 tracking-wide">
                Badan Gizi Nasional RI
              </div>
              <div className="text-sm font-bold text-white tracking-tight">
                SPPG Jeru Tumpang
              </div>
              <div className="text-[10px] text-slate-400">
                Satuan Pelayanan Pemenuhan Gizi
              </div>
            </div>
          </div>

          {/* Judul Registrasi */}
          <div className="space-y-2.5 pt-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 text-[10px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Pendaftaran Petugas Operasional Baru
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-snug">
              Registrasi Akun Petugas WMS SPPG
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed max-w-md">
              Daftarkan akun petugas untuk staf dan penanggung jawab operasional gudang, dapur, dan administrasi logistik pangan.
            </p>
          </div>

          {/* Daftar Otorisasi Peran Tugas */}
          <div className="space-y-2 pt-1">
            <div className="text-[11px] font-semibold text-slate-400 mb-1">
              Hak Akses Peran Petugas:
            </div>

            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-700/50">
                  Operasional Dapur & Logistik
                </span>
                <span className="text-xs font-semibold text-slate-200">Asisten Lapangan & Admin</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Berwenang melakukan input belanja, timbangan riil penerimaan barang, dan pencatatan limbah sisa makanan.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-300 border border-blue-700/50">
                  Kepemimpinan & Audit
                </span>
                <span className="text-xs font-semibold text-slate-200">Ka SPPG & Akuntan</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Berwenang memberikan persetujuan stok opname, memverifikasi nilai persediaan, dan memonitor audit log.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="relative z-10 pt-6 mt-6 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <span>Versi Aplikasi v1.0.0</span>
          <button
            type="button"
            onClick={onNavigateToLogin}
            className="text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer transition-colors"
          >
            ← Kembali ke Halaman Masuk
          </button>
        </div>
      </div>

      {/* Kolom Kanan: Form Pendaftaran User Baru */}
      <div className="lg:col-span-7 bg-white flex flex-col justify-center items-center py-8 px-4 sm:px-8 lg:px-12">
        <div className="w-full max-w-[460px] space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between pb-1">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Buat User Petugas Baru
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Isi formulir berikut untuk menambahkan akun personel SPPG.
              </p>
            </div>
            <button
              type="button"
              onClick={onNavigateToLogin}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
            >
              Masuk Akun
            </button>
          </div>

          {/* Alert Error */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Pendaftaran gagal:</span> {errorMessage}
              </div>
            </div>
          )}

          {/* Form Registrasi */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Nama Lengkap */}
            <div>
              <label htmlFor="reg-name" className="block text-xs font-medium text-slate-700 mb-1">
                Nama Lengkap & Gelar Petugas <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="reg-name"
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Contoh: Rahmat Hidayat, S.Tr.Gz"
                  className="block w-full pl-9 pr-3.5 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 transition-colors"
                />
              </div>
            </div>

            {/* Email & NIP Baris Ganda */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="reg-email" className="block text-xs font-medium text-slate-700 mb-1">
                  Email Dinas <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="reg-email"
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="nama@sppg.id"
                    className="block w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-nip" className="block text-xs font-medium text-slate-700 mb-1">
                  NIP / No. Induk Petugas <span className="text-slate-400 text-[10px]">(Opsional)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <IdCard className="w-4 h-4" />
                  </div>
                  <input
                    id="reg-nip"
                    type="text"
                    value={nip}
                    onChange={e => setNip(e.target.value)}
                    placeholder="Contoh: 19950101 202401 1"
                    className="block w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Pilihan Peran Tugas */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Pilih Peran & Penugasan Operasional <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {rolesList.map(item => {
                  const isChecked = role === item.role;
                  return (
                    <button
                      key={item.role}
                      type="button"
                      onClick={() => setRole(item.role)}
                      className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                        isChecked
                          ? 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">{item.title}</span>
                        {isChecked && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                        {item.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Password & Confirm Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="reg-password" className="block text-xs font-medium text-slate-700 mb-1">
                  Kata Sandi <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 6 karakter"
                    className="block w-full pl-9 pr-8 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 transition-colors"
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
                <label htmlFor="reg-confirm" className="block text-xs font-medium text-slate-700 mb-1">
                  Ulangi Kata Sandi <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="reg-confirm"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Konfirmasi sandi"
                    className="block w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Kode Otorisasi Unit SPPG */}
            <div>
              <label htmlFor="reg-code" className="block text-xs font-medium text-slate-700 mb-1">
                Kode Verifikasi Unit SPPG
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  id="reg-code"
                  type="text"
                  required
                  value={authCode}
                  onChange={e => setAuthCode(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2 text-xs font-mono font-semibold border border-slate-300 rounded-lg bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 transition-colors"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Kode verifikasi internal unit SPPG Jeru - Tumpang untuk menjamin keaslian data.
              </p>
            </div>

            {/* Tombol Submit */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-lg text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-emerald-600 shadow-2xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span>Mendaftarkan akun...</span>
                ) : (
                  <>
                    <span>Daftarkan & Masuk ke Sistem</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Navigasi Masuk */}
          <div className="text-center pt-1 border-t border-slate-100">
            <span className="text-xs text-slate-500">
              Sudah memiliki akun petugas terdaftar?{' '}
              <button
                type="button"
                onClick={onNavigateToLogin}
                className="font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
              >
                Masuk ke sistem
              </button>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
