import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, UserRole } from '../types/warehouse';
import { SppgLogo } from './SppgLogo';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  Building2,
  Boxes,
  KeyRound,
  UserCheck
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { availableUsers, login, loginAsUser } = useAuth();

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

  const handleQuickLogin = (user: User) => {
    setEmail(user.email);
    setPassword('sppg123');
    setErrorMessage(null);
    loginAsUser(user.id);
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'SUPERADMIN':
        return {
          label: 'Superadmin',
          classes: 'bg-purple-50 text-purple-700 border-purple-200',
          scope: 'Akses penuh seluruh sistem, database, dan konfigurasi',
        };
      case 'KA_SPPG':
        return {
          label: 'Ka SPPG',
          classes: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          scope: 'Pimpinan unit, approval opname, monitoring audit',
        };
      case 'ADMIN':
        return {
          label: 'Admin Gudang',
          classes: 'bg-sky-50 text-sky-800 border-sky-200',
          scope: 'Master data barang, supplier, alat, dan administrasi stok',
        };
      case 'ASLAP':
        return {
          label: 'Asisten Lapangan',
          classes: 'bg-amber-50 text-amber-800 border-amber-200',
          scope: 'Penerimaan fisik dermaga, opname fisik rak, alur dapur',
        };
      case 'AKUNTAN':
        return {
          label: 'Akuntan',
          classes: 'bg-teal-50 text-teal-800 border-teal-200',
          scope: 'Buku mutasi stok, nilai persediaan, rekonsiliasi',
        };
      default:
        return {
          label: role,
          classes: 'bg-slate-100 text-slate-700 border-slate-200',
          scope: 'Operasional SPPG',
        };
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 text-slate-800 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Official SPPG Vector Logo */}
        <div className="flex justify-center mb-3.5">
          <SppgLogo size="lg" variant="color" showText={false} />
        </div>

        <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-tight">
          Sistem Manajemen Gudang & Logistik Pangan
        </h1>
        <p className="mt-1 text-xs text-slate-600 font-medium">
          Satuan Pelayanan Pemenuhan Gizi (SPPG) • Operasional Lapangan Terpadu
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-4xl">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Traditional Form Login */}
          <div className="lg:col-span-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 pb-3 mb-5 border-b border-slate-100">
                <KeyRound className="w-4 h-4 text-emerald-700" />
                <h2 className="text-sm font-semibold text-slate-800">
                  Masuk dengan Kredensial Akun
                </h2>
              </div>

              {errorMessage && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Gagal masuk:</span> {errorMessage}
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-1">
                    Alamat Email Terdaftar
                  </label>
                  <div className="relative rounded-xl shadow-2xs">
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
                      placeholder="nama@sppg.id"
                      className="block w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-xs font-semibold text-slate-700 mb-1">
                    Kata Sandi (Password)
                  </label>
                  <div className="relative rounded-xl shadow-2xs">
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
                      className="block w-full pl-9 pr-10 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Kata sandi bawaan untuk akun demo: <code className="font-semibold text-slate-700 bg-slate-100 px-1 py-0.5 rounded">sppg123</code>
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={e => setRememberMe(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                    />
                    <span>Ingat sesi masuk</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <span>Sedang memverifikasi...</span>
                  ) : (
                    <>
                      <span>Masuk ke Dashboard WMS</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: 1-Click Role Accounts Selector */}
          <div className="lg:col-span-6 bg-slate-50/70 p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-slate-700" />
                  <h2 className="text-sm font-semibold text-slate-800">
                    Pilih Akun Demo (5 Peran SPPG)
                  </h2>
                </div>
                <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                  1-Klik Masuk
                </span>
              </div>

              <p className="text-[11px] text-slate-600 mb-3">
                Pilih akun petugas untuk masuk langsung ke sistem:
              </p>

              <div className="space-y-2">
                {availableUsers.map(user => {
                  const badge = getRoleBadge(user.role);
                  const isSelected = email === user.email;

                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleQuickLogin(user)}
                      className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-start justify-between gap-3 cursor-pointer ${
                        isSelected
                          ? 'bg-white border-emerald-500 ring-1 ring-emerald-500 shadow-xs'
                          : 'bg-white hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{user.name}</span>
                          <span className={`text-[10px] font-semibold px-2 py-0.2 rounded-full border ${badge.classes}`}>
                            {badge.label}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">{user.email}</div>
                        <p className="text-[10px] text-slate-600 pt-0.5">{badge.scope}</p>
                      </div>

                      <div className="shrink-0 mt-1">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 group-hover:underline">
                          Masuk
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200/80 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Satuan Pelayanan Pemenuhan Gizi</span>
              <span className="text-slate-600 font-medium">Unit Jeru Tumpang 01</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
