import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import logoSppgImg from '../assets/logo sppg.png';
import { Eye, EyeOff, ArrowLeft, AlertCircle } from 'lucide-react';

export interface LoginPageProps {
  onNavigateToLanding?: () => void;
}

// Warna mengikuti halaman publik (LandingPage) agar beranda dan login terasa satu situs.
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#133d2c] focus-visible:ring-offset-2';
const INPUT =
  'block w-full min-h-[44px] px-3.5 text-sm rounded-lg border border-[#d6cfbf] bg-white text-[#141d18] placeholder:text-[#9a9384] focus:outline-none focus:border-[#133d2c] focus:ring-2 focus:ring-[#133d2c]/15';

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigateToLanding }) => {
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanId = identifier.trim();
    if (!cleanId) {
      setErrorMessage('Isi email atau nama akun.');
      return;
    }
    if (!password) {
      setErrorMessage('Isi kata sandi.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(cleanId, password);
      if (!result.success) {
        setErrorMessage(result.error || 'Email atau kata sandi salah.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal terhubung. Periksa koneksi internet, lalu coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf8f4] text-[#141d18] flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[380px]">
          <div className="flex items-center gap-3 mb-8">
            <img src={logoSppgImg} alt="" className="w-11 h-11 object-contain shrink-0" />
            <div className="leading-tight">
              <div className="text-base font-bold font-serif-display">SPPG Tumpang Jeru</div>
              <div className="text-xs text-[#5d6b62]">Sistem gudang & dapur</div>
            </div>
          </div>

          <h1 className="text-2xl font-bold font-serif-display tracking-tight">Masuk petugas</h1>
          <p className="mt-1 text-sm text-[#5d6b62]">Pakai akun yang dibuatkan Kepala SPPG.</p>

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            <div>
              <label htmlFor="identifier" className="block text-sm font-medium mb-1.5">
                Email atau nama akun
              </label>
              <input
                id="identifier"
                name="identifier"
                type="text"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder="nama.sppgjeru@sppg.id"
                aria-invalid={!!errorMessage && !identifier.trim()}
                className={INPUT}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1.5">
                Kata sandi
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  aria-invalid={!!errorMessage && !!identifier.trim()}
                  className={`${INPUT} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  aria-pressed={showPassword}
                  className={`absolute inset-y-0 right-0 w-11 flex items-center justify-center rounded-r-lg text-[#5d6b62] hover:text-[#141d18] cursor-pointer ${FOCUS}`}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {errorMessage && (
              <p role="alert" className="flex items-start gap-2 text-sm text-[#b42318]">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full min-h-[44px] rounded-lg text-sm font-semibold text-white bg-[#0c3123] hover:bg-[#134431] active:bg-[#071f16] cursor-pointer disabled:opacity-60 disabled:cursor-wait ${FOCUS}`}
            >
              {isLoading ? 'Memeriksa…' : 'Masuk'}
            </button>
          </form>

          <p className="mt-6 text-xs text-[#5d6b62]">Lupa kata sandi? Hubungi Kepala SPPG untuk direset.</p>

          {onNavigateToLanding && (
            <button
              type="button"
              onClick={onNavigateToLanding}
              className={`mt-8 inline-flex items-center gap-1.5 min-h-[44px] text-sm text-[#2a3830] hover:text-[#141d18] cursor-pointer rounded-md ${FOCUS}`}
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali ke beranda
            </button>
          )}
        </div>
      </main>
    </div>
  );
};
