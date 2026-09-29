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
  Boxes,
  Scale,
  UtensilsCrossed
} from 'lucide-react';

export interface LoginPageProps {
  onNavigateToRegister?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigateToRegister }) => {
  const { login } = useAuth();

  const [email, setEmail] = useState<string>('hendra.admin@sppg.id');
  const [password, setPassword] = useState<string>('sppg123');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Silakan masukkan alamat email akun Anda.');
      return;
    }
    if (!password) {
      setErrorMessage('Silakan masukkan kata sandi Anda.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(email, password);
      if (!result.success) {
        setErrorMessage(result.error || 'Email atau kata sandi tidak cocok.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan saat proses masuk.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-800 font-sans flex flex-col lg:grid lg:grid-cols-12">
      {/* Kolom Kiri: Identitas Resmi & Ringkasan Operasional SPPG (5 dari 12 kolom) */}
      <div className="lg:col-span-5 bg-slate-950 border-b lg:border-b-0 lg:border-r border-slate-800/80 p-6 sm:p-10 lg:p-12 flex flex-col justify-between text-white relative overflow-hidden">
        {/* Subtle architectural ambient highlight - no glowing neon orbs */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,_rgba(6,78,59,0.15),transparent_60%)] pointer-events-none" />

        <div className="relative z-10 space-y-8">
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

          {/* Judul & Narasi Sistem */}
          <div className="space-y-3 pt-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 text-[10px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Sistem Manajemen Gudang & Logistik Pangan
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-snug">
              Pengelolaan Logistik & Rantai Pasok Pangan Bergizi
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed max-w-md">
              Sistem operasional terpadu untuk pencatatan penerimaan bahan pangan, penimbangan riil, alokasi porsi harian, dan monitoring limbah organik di unit SPPG Jeru Tumpang.
            </p>
          </div>

          {/* Pilar Operasional (Real domain, zero buzzwords) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                <Boxes className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-200">Inventaris & Stok FIFO</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Pengendalian stok bahan basah dan kering dengan pencatatan kadaluarsa.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                <Scale className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-200">Verifikasi Timbangan Riil</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Pencocokan kuantitas surat jalan PO vs timbangan fisik di dermaga.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                <UtensilsCrossed className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-200">Alokasi Menu MBG & Residu</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Porsi sekolah sasaran, buku catatan limbah, dan evaluasi piring makan.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Panel Kiri */}
        <div className="relative z-10 pt-8 mt-8 border-t border-slate-800/80 text-[11px] text-slate-400">
          <span>Versi Aplikasi v1.0.0</span>
        </div>
      </div>

      {/* Kolom Kanan: Form Login & Akses Cepat Peran (7 dari 12 kolom) */}
      <div className="lg:col-span-7 bg-white flex flex-col justify-center items-center py-10 px-4 sm:px-8 lg:px-12">
        <div className="w-full max-w-[420px] space-y-6">
          {/* Header Form */}
          <div className="flex items-start justify-between pb-1">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Masuk ke Sistem
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Masukkan alamat email dan kata sandi akun petugas Anda.
              </p>
            </div>
            {onNavigateToRegister && (
              <button
                type="button"
                onClick={onNavigateToRegister}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                + Buat User Baru
              </button>
            )}
          </div>

          {/* Alert Error jika gagal */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Gagal masuk:</span> {errorMessage}
              </div>
            </div>
          )}

          {/* Form Login Kredensial */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-slate-700 mb-1.5">
                Alamat Email Dinas
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="nama.petugas@sppg.id"
                  className="block w-full pl-9 pr-3.5 py-2.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 transition-colors"
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
                  className="text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer flex items-center gap-1"
                >
                  {showPassword ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>Sembunyikan</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span>Tampilkan</span>
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
                  className="block w-full pl-9 pr-3.5 py-2.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 transition-colors"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5">
                <span>Kata sandi demo: <code className="font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">sppg123</code></span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600">
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
              className="w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-lg text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-emerald-600 shadow-2xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span>Memverifikasi kredensial...</span>
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
              <span className="text-xs text-slate-500">Petugas belum memiliki akun? </span>
              <button
                type="button"
                onClick={onNavigateToRegister}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
              >
                Daftar Petugas Baru
              </button>
            </div>
          )}

          {/* Bottom disclaimer */}
          <div className="pt-2 text-center text-[11px] text-slate-400">
            Unit Layanan SPPG Jeru - Tumpang, Kabupaten Malang
          </div>
        </div>
      </div>
    </div>
  );
};

