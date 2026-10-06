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
  BadgeAlert,
  Building2
} from 'lucide-react';

export interface LoginPageProps {
  onNavigateToRegister?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigateToRegister }) => {
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col justify-between selection:bg-emerald-100 selection:text-emerald-900">
      {/* Top Administrative Bar */}
      <header className="bg-white border-b border-slate-200/90 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
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

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              <span>Sistem Logistik Pangan WMS</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Centered Production Login Card */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        <div className="w-full max-w-[440px]">
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm p-6 sm:p-8 space-y-6">
            {/* Header Form */}
            <div className="text-center space-y-2">
              <div className="mx-auto w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-800 shadow-2xs mb-3">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Masuk ke Sistem WMS
              </h1>
              <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                Autentikasi operasional resmi petugas Satuan Pelayanan Pemenuhan Gizi (SPPG) Jeru Tumpang.
              </p>
            </div>

            {/* Alert Error jika login gagal */}
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-xs text-rose-800 animate-in fade-in duration-150">
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
                    onChange={e => setIdentifier(e.target.value)}
                    placeholder="nama.petugas@sppg.id"
                    className="block w-full pl-9 pr-3.5 py-2.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition-colors"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="block text-xs font-medium text-slate-700">
                    Kata Sandi
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
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
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
                  <span>Ingat sesi masuk di perangkat ini</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-lg text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-700 shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {isLoading ? (
                  <span>Memverifikasi Kredensial...</span>
                ) : (
                  <>
                    <span>Masuk ke Dashboard WMS</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {onNavigateToRegister && (
              <div className="text-center pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-500">Petugas belum terdaftar? </span>
                <button
                  type="button"
                  onClick={onNavigateToRegister}
                  className="text-xs font-semibold text-emerald-800 hover:text-emerald-900 hover:underline cursor-pointer"
                >
                  Registrasi Akun Petugas
                </button>
              </div>
            )}

            {/* Official Disclaimer */}
            <div className="pt-3 border-t border-slate-100 flex items-start gap-2.5 text-[11px] text-slate-400 leading-relaxed">
              <BadgeAlert className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <span>
                Portal terbatas. Seluruh aktivitas pencatatan logistik dan mutasi stok diawasi dan terekam dalam log audit digital unit SPPG.
              </span>
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Unit Pelayanan Desa Jeru, Kec. Tumpang, Kab. Malang</span>
          </div>
        </div>
      </main>

      {/* Bottom Governmental Footer */}
      <footer className="bg-white border-t border-slate-200/90 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">WMS SPPG Jeru Tumpang</span>
            <span>—</span>
            <span>Versi Produksi v1.0.0</span>
          </div>
          <div>
            Badan Gizi Nasional Republik Indonesia • Program Makan Bergizi Gratis (MBG)
          </div>
        </div>
      </footer>
    </div>
  );
};
