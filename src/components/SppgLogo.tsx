import React, { useState } from 'react';
import logoSppgImg from '../assets/logo sppg.png';

interface SppgLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  variant?: 'color' | 'monochrome' | 'white';
}

export const SppgLogo: React.FC<SppgLogoProps> = ({
  size = 'md',
  showText = true,
  className = '',
  variant = 'color',
}) => {
  const [imageError, setImageError] = useState(false);

  const sizeMap = {
    sm: { box: 30, text: 'text-sm', sub: 'text-[9px]' },
    md: { box: 40, text: 'text-base', sub: 'text-[10px]' },
    lg: { box: 54, text: 'text-xl', sub: 'text-xs' },
    xl: { box: 70, text: 'text-2xl', sub: 'text-sm' },
  };

  const currentSize = sizeMap[size];

  const getColors = () => {
    if (variant === 'white') {
      return {
        textTitle: 'text-white',
        textSub: 'text-slate-300',
      };
    }
    if (variant === 'monochrome') {
      return {
        textTitle: 'text-slate-900',
        textSub: 'text-slate-500',
      };
    }
    return {
      textTitle: 'text-slate-900',
      textSub: 'text-slate-500',
    };
  };

  const colors = getColors();

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* Official SPPG Brand Emblem from src/assets */}
      {!imageError ? (
        <img
          src={logoSppgImg}
          alt="Logo SPPG"
          onError={() => setImageError(true)}
          style={{ width: currentSize.box, height: currentSize.box }}
          className={`shrink-0 object-contain rounded-lg ${
            variant === 'white' ? 'bg-white/10 p-0.5 rounded-lg' : ''
          }`}
        />
      ) : (
        /* Fallback Vector Emblem */
        <svg
          width={currentSize.box}
          height={currentSize.box}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="shrink-0"
        >
          <rect width="48" height="48" rx="12" fill={variant === 'white' ? 'rgba(255,255,255,0.15)' : '#064e3b'} />
          <path
            d="M12 20C12 16.6863 14.6863 14 18 14H30C33.3137 14 36 16.6863 36 20V26C36 31.5228 31.5228 36 26 36H22C16.4772 36 12 31.5228 12 26V20Z"
            fill="#047857"
          />
          <path
            d="M24 16C24 16 28 20 28 25C28 27.2091 26.2091 29 24 29C21.7909 29 20 27.2091 20 25C20 20 24 16 24 16Z"
            fill="#34d399"
          />
          <path d="M24 19V32" stroke="#064e3b" strokeWidth="2" strokeLinecap="round" />
          <rect x="18" y="38" width="12" height="2.5" rx="1.25" fill="#10b981" />
        </svg>
      )}

      {/* Brand Typography */}
      {showText && (
        <div className="text-left leading-none">
          <div className="flex items-center gap-1.5">
            <span className={`font-bold tracking-tight ${currentSize.text} ${colors.textTitle}`}>
              SPPG Jeru Tumpang
            </span>
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              WMS
            </span>
          </div>
          <p className={`${currentSize.sub} ${colors.textSub} mt-1 font-medium`}>
            Satuan Pelayanan Pemenuhan Gizi
          </p>
        </div>
      )}
    </div>
  );
};
