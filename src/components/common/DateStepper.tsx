import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { FOCUS_RING } from './FormDialog';

// Pemilih tanggal dengan tombol hari sebelumnya/berikutnya dalam satu kelompok bergaris.
// Lebarnya mengikuti isi, jadi tidak melebar memenuhi baris seperti input tanggal biasa.

interface DateStepperProps {
  value: string; // YYYY-MM-DD
  onChange: (iso: string) => void;
  ariaLabel: string;
  /** Tampilkan tombol ‹ › untuk mundur/maju satu hari. */
  stepper?: boolean;
}

const shiftIso = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const STEP_BTN = `inline-flex items-center justify-center w-9 min-h-[44px] sm:min-h-[34px] text-slate-600 hover:bg-slate-50 hover:text-slate-900 cursor-pointer ${FOCUS_RING}`;

export const DateStepper: React.FC<DateStepperProps> = ({ value, onChange, ariaLabel, stepper = true }) => (
  <div className="inline-flex items-stretch rounded-lg border border-slate-300 bg-white overflow-hidden shrink-0">
    {stepper && (
      <button type="button" onClick={() => onChange(shiftIso(value, -1))} className={STEP_BTN} aria-label="Hari sebelumnya" title="Hari sebelumnya">
        <ChevronLeft className="w-4 h-4" />
      </button>
    )}
    <input
      type="date"
      aria-label={ariaLabel}
      value={value}
      onChange={e => e.target.value && onChange(e.target.value)}
      className={`px-2.5 min-h-[44px] sm:min-h-[34px] text-xs font-semibold text-slate-900 bg-white tabular-nums cursor-pointer ${
        stepper ? 'border-x border-slate-200' : ''
      } focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600`}
    />
    {stepper && (
      <button type="button" onClick={() => onChange(shiftIso(value, 1))} className={STEP_BTN} aria-label="Hari berikutnya" title="Hari berikutnya">
        <ChevronRight className="w-4 h-4" />
      </button>
    )}
  </div>
);
