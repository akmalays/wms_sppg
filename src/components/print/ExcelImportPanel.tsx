import React, { useRef, useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { Select } from '../common/Select';
import { BTN_PRIMARY, BTN_SECONDARY, FIELD_LABEL } from '../common/FormDialog';
import { ColumnMap, ColumnRule } from '../../utils/excelTable';

// Panel sumber data Excel untuk form cetak massal: pilih/ganti file, unduh template, dan petakan kolom.

interface ExcelSourceProps {
  fileName: string;
  /** Ringkasan setelah file terbaca, mis. "15 penerima dari lembar TF". */
  summary?: string;
  title: string;
  hint: string;
  error?: string;
  onFile: (file: File) => void;
  onDownloadTemplate: () => void;
}

export const ExcelSource: React.FC<ExcelSourceProps> = ({ fileName, summary, title, hint, error, onFile, onDownloadTemplate }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept=".xlsx,.xls"
      className="hidden"
      onChange={e => {
        const f = e.target.files?.[0];
        if (f) onFile(f);
        e.target.value = '';
      }}
    />
  );
  const templateButton = (
    <button type="button" onClick={onDownloadTemplate} className={`${BTN_SECONDARY} shrink-0`}>
      <Download className="w-3.5 h-3.5" />
      Unduh template
    </button>
  );

  return (
    <div className="space-y-2">
      {fileName ? (
        // Setelah file terbaca: baris ringkas, tombol ganti file tidak lagi jadi aksi utama
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
          <FileSpreadsheet className="w-5 h-5 text-emerald-700 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-900 truncate">{fileName}</p>
            {summary && <p className="text-[11px] text-slate-600">{summary}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {templateButton}
            <button type="button" onClick={() => inputRef.current?.click()} className={`${BTN_SECONDARY} shrink-0`}>
              Ganti file
            </button>
          </div>
          {fileInput}
        </div>
      ) : (
        <div
          onDragOver={e => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) onFile(f);
          }}
          className={`rounded-xl border-2 border-dashed px-4 py-4 flex flex-col md:flex-row md:items-center gap-3 ${
            dragOver ? 'border-emerald-600 bg-emerald-50' : 'border-slate-300 bg-slate-50'
          }`}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className="text-xs text-slate-600 mt-0.5">{hint}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {templateButton}
            <button type="button" onClick={() => inputRef.current?.click()} className={`${BTN_PRIMARY} whitespace-nowrap shrink-0`}>
              <FileSpreadsheet className="w-4 h-4" />
              Pilih file Excel
            </button>
          </div>
          {fileInput}
        </div>
      )}
      {error && <p role="alert" className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900">{error}</p>}
    </div>
  );
};

interface ColumnMapperProps<F extends string> {
  rules: ColumnRule<F>[];
  cols: ColumnMap<F>;
  options: { index: number; label: string }[];
  onChange: (key: F, index: number | null) => void;
  onReset: () => void;
  hasOverrides: boolean;
}

// Pemetaan kolom: terbuka sendiri bila ada kolom wajib yang belum dikenali
export function ColumnMapper<F extends string>({ rules, cols, options, onChange, onReset, hasOverrides }: ColumnMapperProps<F>) {
  const missing = rules.filter(r => r.required && cols[r.key] === undefined);
  return (
    <details open={missing.length > 0} className="rounded-lg border border-slate-200 bg-white text-xs group">
      <summary className="px-3 py-2.5 cursor-pointer select-none flex items-center justify-between gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded-lg">
        <span className={missing.length ? 'font-semibold text-amber-800' : 'text-slate-700'}>
          {missing.length
            ? `${missing.length} kolom wajib belum dikenali (${missing.map(m => m.label).join(', ')}). Pilih kolomnya di bawah.`
            : 'Kolom Excel dikenali otomatis. Buka untuk memeriksa atau mengubah.'}
        </span>
        <span className="text-slate-500 shrink-0 group-open:hidden">Atur kolom</span>
        <span className="text-slate-500 shrink-0 hidden group-open:inline">Tutup</span>
      </summary>
      <div className="px-3 pb-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rules.map(rule => {
            const value = cols[rule.key];
            const isMissing = rule.required && value === undefined;
            return (
              <div key={rule.key}>
                <label htmlFor={`col-${rule.key}`} className={FIELD_LABEL}>
                  {rule.label}
                  {rule.required && <span className="text-rose-700"> *</span>}
                </label>
                <Select
                  id={`col-${rule.key}`}
                  className="w-full"
                  size="sm"
                  invalid={isMissing}
                  value={value === undefined ? '' : String(value)}
                  onChange={e => onChange(rule.key, e.target.value === '' ? null : Number(e.target.value))}
                >
                  <option value="">Tidak dipakai</option>
                  {options.map(o => (
                    <option key={o.index} value={o.index}>{o.label}</option>
                  ))}
                </Select>
              </div>
            );
          })}
        </div>
        {hasOverrides && (
          <button type="button" onClick={onReset} className={BTN_SECONDARY}>
            Kembalikan ke deteksi otomatis
          </button>
        )}
      </div>
    </details>
  );
}
