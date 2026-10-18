import React from 'react';
import { ChevronDown } from 'lucide-react';

type NativeSelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size' | 'className'>;

interface SelectProps extends NativeSelectProps {
  /** Tinggi sama dengan FIELD_INPUT: md 34px, sm 30px di layar lebar; keduanya 44px di HP agar mudah disentuh. */
  size?: 'md' | 'sm';
  /** Kelas untuk pembungkus: lebar dan tata letak saja (mis. w-full, w-40, flex-1). */
  className?: string;
  invalid?: boolean;
  /** Warna status (bg/text/border), untuk dropdown yang sekaligus berfungsi sebagai badge status. */
  tone?: string;
}

const SIZE = {
  md: 'min-h-[44px] sm:min-h-[34px] pl-2.5 pr-8 text-xs',
  sm: 'min-h-[44px] sm:min-h-[30px] pl-2 pr-7 text-xs',
};

/**
 * Dropdown standar aplikasi untuk pilihan pendek yang tetap (status, kategori, shift, periode).
 * Tetap <select> bawaan agar di HP muncul pemilih bawaan perangkat; tampilannya diseragamkan.
 * Untuk daftar panjang dari data master (barang, supplier, pegawai) pakai SearchPicker.
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ size = 'md', className = '', invalid = false, tone, disabled, children, ...rest }, ref) => (
    // inline-block seperti <select> bawaan: lebar mengikuti isi kecuali diberi kelas lebar (w-full, w-40, ...).
    <div className={`relative inline-block align-middle max-w-full ${className}`}>
      <select
        ref={ref}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={`w-full appearance-none rounded-lg border font-medium cursor-pointer ${tone ? '' : 'bg-white text-slate-900'} transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 ${SIZE[size]} ${
          invalid ? 'border-rose-500' : tone ? tone : 'border-slate-300 hover:border-slate-400'
        }`}
        {...rest}>
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-500 ${size === 'sm' ? 'right-2 w-3.5 h-3.5' : 'right-2.5 w-4 h-4'}`}
      />
    </div>
  )
);
Select.displayName = 'Select';
