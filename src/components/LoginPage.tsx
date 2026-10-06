import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import logoSppgImg from '../assets/logo sppg.png';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  ShieldCheck,
  UserCheck,
  Check,
  Building2,
  BadgeAlert,
  ClipboardCheck,
  Calculator,
  Truck,
  Shield,
  Layers
} from 'lucide-react';

export interface LoginPageProps {
  onNavigateToRegister?: () => void;
}

interface OfficialAccount {
  id: string;
  roleKey: string;
  roleLabel: string;
  name: string;
  email: string;
  passwordDisplay: string;
  duty: string;
  accent: 'emerald' | 'blue' | 'indigo' | 'amber' | 'slate';
  icon: React.ElementType;
}

const OFFICIAL_ACCOUNTS: OfficialAccount[] = [
  {
    id: 'USR-003',
    roleKey: 'ADMIN',
    roleLabel: 'Admin Gudang',
    name: 'Akmal',
    email: 'akmal@sppg.id',
    passwordDisplay: 'admin123',
    duty: 'Master data barang, mutasi stok, penerimaan surat jalan, dan tata kelola PO.',
    accent: 'emerald',
    icon: Layers,
  },
  {
    id: 'USR-002',
    roleKey: 'KA_SPPG',
    roleLabel: 'Kepala SPPG (Ka SPPG)',
    name: 'Rizky Iman Ramdhan, S.Pd',
    email: 'rizky.kasppg@sppg.id',
    passwordDisplay: 'kasppg123',
    duty: 'Otorisasi stok opname, pengesahan berita acara, pengawasan kuota MBG & audit.',
    accent: 'blue',
    icon: ClipboardCheck,
  },
  {
    id: 'USR-005',
    roleKey: 'AKUNTAN',
    roleLabel: 'Akuntan Satuan Pelayanan',
    name: 'Dewi Lestari',
    email: 'dewi.akuntan@sppg.id',
    passwordDisplay: 'akuntan123',
    duty: 'Verifikasi faktur nota UMKM, rekonsiliasi pengeluaran non-pangan, audit belanja.',
    accent: 'indigo',
    icon: Calculator,
  },
  {
    id: 'USR-004',
    roleKey: 'ASLAP',
    roleLabel: 'Asisten Lapangan (Aslap)',
    name: 'Andi Pratama',
    email: 'andi.aslap@sppg.id',
    passwordDisplay: 'aslap123',
    duty: 'Pemeriksaan dermaga penerimaan, penimbangan fisik riil, checklist harian & limbah.',
    accent: 'amber',
    icon: Truck,
  },
  {
    id: 'USR-001',
    roleKey: 'SUPERADMIN',
    roleLabel: 'Superadmin Sistem',
    name: 'Budi Santoso',
    email: 'budi.superadmin@sppg.id',
    passwordDisplay: 'superadmin123',
    duty: 'Konfigurasi teknis pusat, pemeliharaan basis data, dan wewenang penuh.',
    accent: 'slate',
    icon: Shield,
  },
];

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigateToRegister }) => {
  const { login } = useAuth();

  // Inputs are clean and not prefilled with dummy values
  const [identifier, setIdentifier] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanId = identifier.trim();
    if (!cleanId) {
      setErrorMessage('Silakan masukkan email kedinasan atau nama akun petugas.');
      return;
    }
    if (!password) {
      setErrorMessage('Silakan masukkan kata sandi Anda.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(cleanId, password);
      if (!result.success) {
        setErrorMessage(result.error || 'Email kedinasan atau kata sandi tidak cocok.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi gangguan koneksi saat proses masuk.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAccount = (account: OfficialAccount) => {
    setIdentifier(account.email);
    setPassword(account.passwordDisplay);
    setSelectedAccountId(account.id);
    setErrorMessage(null);
    setCopiedId(account.id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col justify-between selection:bg-emerald-100 selection:text-emerald-900">
      {/* Top Administrative Bar */}
      <header className="bg-white border-b border-slate-200/90 shadow-2xs sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src={logoSppgImg}
              alt="Logo SPPG"
              className="w-10 h-10 object-contain shrink-0 rounded-lg p-1 bg-slate-50 border border-slate-200"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-emerald-800 tracking-tight">
                  Badan Gizi Nasional Republik Indonesia
                </span>
                <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-slate-300" />
                <span className="hidden sm:inline-block text-[11px] text-slate-500 font-medium">
                  Unit Layanan Malang
                </span>
              </div>
              <div className="text-sm font-bold text-slate-900 tracking-tight">
                Satuan Pelayanan Pemenuhan Gizi (SPPG) Jeru - Tumpang
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              <span>Sistem Operasional Logistik & Gudang</span>
            </div>
            {onNavigateToRegister && (
              <button
                type="button"
                onClick={onNavigateToRegister}
                className="text-xs font-medium text-slate-700 hover:text-emerald-800 bg-white hover:bg-slate-50 border border-slate-300 px-3 py-1 rounded-md transition-colors cursor-pointer"
              >
                Registrasi Petugas Baru
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Administrative Portal Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Kolom Kiri: Formulir Masuk Resmi (5 dari 12 kolom) */}
          <div className="lg:col-span-5 w-full">
            <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm p-6 sm:p-8 space-y-6">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full mb-3">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Autentikasi Kedinasan</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Masuk ke Portal Gudang
                </h1>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Masukkan identitas email kedinasan atau nama pengguna resmi beserta kata sandi terdaftar Anda.
                </p>
              </div>

              {/* Alert jika terjadi kesalahan */}
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <span className="font-semibold">Akses Ditolak:</span> {errorMessage}
                  </div>
                </div>
              )}

              {/* Form Input */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="identifier" className="block text-xs font-medium text-slate-700 mb-1.5">
                    Email Kedinasan atau Nama Akun
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      id="identifier"
                      name="identifier"
                      type="text"
                      autoComplete="username"
                      required
                      value={identifier}
                      onChange={e => {
                        setIdentifier(e.target.value);
                        setSelectedAccountId(null);
                      }}
                      placeholder="contoh: akmal@sppg.id atau akmal"
                      className="block w-full pl-9 pr-3.5 py-2.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition-colors"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Bisa memasukkan alamat email atau alias nama resmi (Akmal, Dewi, Rizky, Andi).
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="password" className="block text-xs font-medium text-slate-700">
                      Kata Sandi Kedinasan
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[11px] font-medium text-slate-500 hover:text-slate-800 cursor-pointer flex items-center gap-1 transition-colors"
                    >
                      {showPassword ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Sembunyikan</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>Lihat Sandi</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={e => {
                        setPassword(e.target.value);
                        setSelectedAccountId(null);
                      }}
                      placeholder="Masukkan kata sandi resmi"
                      className="block w-full pl-9 pr-3.5 py-2.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition-colors"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={e => setRememberMe(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>Ingat sesi masuk di komputer ini</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-lg text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-700 shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                >
                  {isLoading ? (
                    <span>Memverifikasi Kredensial Database...</span>
                  ) : (
                    <>
                      <span>Masuk ke Sistem Operasional</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Security Policy Notice */}
              <div className="pt-4 border-t border-slate-100 flex items-start gap-2.5 text-[11px] text-slate-500 leading-relaxed">
                <BadgeAlert className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span>
                  Setiap aktivitas transaksi mutasi logistik dan penerimaan barang dicatat dalam log audit digital SPPG untuk akuntabilitas program MBG.
                </span>
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Direktori Petugas Resmi Database (7 dari 12 kolom) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm p-6 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                      Daftar Akun Petugas Resmi SPPG
                    </h2>
                    <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                      Tersinkron Database
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Akun operasional riil yang tersimpan di database sistem. Klik tombol <strong>Gunakan Akun</strong> untuk langsung mengisi form masuk tanpa mengetik manual.
                  </p>
                </div>
              </div>

              {/* Grid Kartu Petugas Resmi */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {OFFICIAL_ACCOUNTS.map(account => {
                  const Icon = account.icon;
                  const isSelected = selectedAccountId === account.id;
                  const isCopied = copiedId === account.id;

                  const colorStyles = {
                    emerald: 'border-emerald-200 bg-emerald-50/40 text-emerald-800 hover:border-emerald-300',
                    blue: 'border-blue-200 bg-blue-50/40 text-blue-800 hover:border-blue-300',
                    indigo: 'border-indigo-200 bg-indigo-50/40 text-indigo-800 hover:border-indigo-300',
                    amber: 'border-amber-200 bg-amber-50/40 text-amber-800 hover:border-amber-300',
                    slate: 'border-slate-200 bg-slate-50/60 text-slate-800 hover:border-slate-300',
                  }[account.accent];

                  const badgeStyles = {
                    emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                    blue: 'bg-blue-100 text-blue-800 border-blue-200',
                    indigo: 'bg-indigo-100 text-indigo-800 border-indigo-200',
                    amber: 'bg-amber-100 text-amber-800 border-amber-200',
                    slate: 'bg-slate-200 text-slate-800 border-slate-300',
                  }[account.accent];

                  return (
                    <div
                      key={account.id}
                      className={`relative flex flex-col justify-between p-4 rounded-xl border transition-all ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/80 ring-2 ring-emerald-600/20 shadow-xs'
                          : colorStyles
                      }`}
                    >
                      <div>
                        {/* Header Kartu */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-white border border-slate-200/80 shadow-2xs flex items-center justify-center shrink-0">
                              <Icon className="w-3.5 h-3.5 text-slate-700" />
                            </div>
                            <div>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${badgeStyles}`}>
                                {account.roleLabel}
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {account.id}
                          </span>
                        </div>

                        {/* Nama Petugas Database */}
                        <div className="mt-1">
                          <div className="text-sm font-bold text-slate-900 tracking-tight">
                            {account.name}
                          </div>
                          <div className="text-[11px] font-mono text-slate-600 truncate mt-0.5">
                            {account.email}
                          </div>
                        </div>

                        {/* Uraian Tugas Operasional */}
                        <p className="text-[11px] text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                          {account.duty}
                        </p>
                      </div>

                      {/* Baris Kredensial & Aksi Cepat */}
                      <div className="mt-3.5 pt-3 border-t border-slate-200/60 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <span className="text-slate-400 font-medium">Sandi:</span>
                          <code className="bg-white/90 px-1.5 py-0.5 rounded font-mono font-semibold text-slate-800 border border-slate-200/80">
                            {account.passwordDisplay}
                          </code>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSelectAccount(account)}
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-700 text-white shadow-2xs'
                              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300'
                          }`}
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-300" />
                              <span>Terisi</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3 h-3" />
                              <span>Gunakan Akun</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Penjelasan Verifikasi */}
              <div className="mt-5 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-3 text-xs text-slate-600">
                <Building2 className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-semibold text-slate-800">Integritas Data Petugas:</span> Seluruh akun di atas sesuai dengan struktur Surat Keputusan Operasional Satuan Pelayanan Pemenuhan Gizi (SPPG) Jeru Tumpang. Pengubahan data pengguna dapat dilakukan melalui menu Pengaturan Profil setelah masuk.
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Governmental Footer */}
      <footer className="bg-white border-t border-slate-200/90 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">WMS SPPG</span>
            <span>—</span>
            <span>Versi Rilis Produksi v1.0.0</span>
          </div>
          <div>
            Badan Gizi Nasional RI • SPPG Jeru - Tumpang, Kabupaten Malang, Jawa Timur
          </div>
        </div>
      </footer>
    </div>
  );
};
