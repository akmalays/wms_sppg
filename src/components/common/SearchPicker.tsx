import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, Plus } from 'lucide-react';

export interface PickerOption {
  value: string;
  label: string;
  /** Judul kelompok di daftar (mis. kategori). */
  group?: string;
  /** Keterangan kecil di kanan (mis. harga acuan atau stok). */
  hint?: string;
}

interface SearchPickerProps {
  id?: string;
  /** Nilai terpilih: `value` opsi, atau teks bebas bila allowCustom. */
  value: string;
  options: PickerOption[];
  /** opt = null berarti teks bebas yang diketik pengguna (hanya bila allowCustom). */
  onSelect: (opt: PickerOption | null, text: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  allowCustom?: boolean;
  invalid?: boolean;
  ariaLabel?: string;
  size?: 'md' | 'sm';
  /** Kata benda untuk penghitung, mis. "barang" pada "14 dari 61 barang". */
  noun?: string;
}

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1';
const POPOVER_MAX_H = 320;

/**
 * Pengganti <select>/<datalist> untuk daftar panjang: kotak cari di atas daftar, bisa dipakai
 * dengan keyboard (panah, Enter, Escape). Daftar dirender lewat portal dengan posisi fixed
 * agar tidak terpotong oleh modal yang memakai overflow hidden.
 */
export const SearchPicker: React.FC<SearchPickerProps> = ({
  id,
  value,
  options,
  onSelect,
  placeholder = 'Pilih...',
  searchPlaceholder = 'Cari...',
  allowCustom = false,
  invalid = false,
  ariaLabel,
  size = 'md',
  noun = 'pilihan',
}) => {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number }>({ left: 0, width: 0 });

  const selected = options.find(o => o.value === value);
  const displayLabel = selected ? selected.label : value;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    // Semua kata harus muncul, urutan bebas: "ayam karkas" cocok dengan "Daging Ayam Broiler Karkas".
    const words = q.split(/\s+/);
    return options.filter(o => {
      // Hanya nama: nama kelompok seperti "Bahan Basah" membuat pencarian "sa" cocok ke semua isinya.
      const hay = o.label.toLowerCase();
      return words.every(w => hay.includes(w));
    });
  }, [options, query]);

  const trimmed = query.trim();
  const showCustom = allowCustom && trimmed !== '' && !options.some(o => o.label.toLowerCase() === trimmed.toLowerCase());
  // Baris "pakai teks ini" di paling bawah, agar Enter memilih hasil yang cocok lebih dulu.
  const customRow = filtered.length;
  const rowCount = filtered.length + (showCustom ? 1 : 0);

  const place = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.max(r.width, 280);
    const left = Math.min(r.left, window.innerWidth - width - 8);
    const spaceBelow = window.innerHeight - r.bottom;
    if (spaceBelow < POPOVER_MAX_H + 16 && r.top > spaceBelow) {
      setPos({ left, width, bottom: window.innerHeight - r.top + 4 });
    } else {
      setPos({ left, width, top: r.bottom + 4 });
    }
  };

  const openPicker = () => {
    setQuery('');
    setActive(0);
    place();
    setOpen(true);
  };

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  useLayoutEffect(() => {
    if (!open) return;
    const onMove = () => place();
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!popoverRef.current?.contains(t) && !triggerRef.current?.contains(t)) close(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => setActive(0), [query]);

  // Baris aktif selalu terlihat saat berpindah dengan panah.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-row="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const choose = (row: number) => {
    if (showCustom && row === customRow) {
      onSelect(null, trimmed);
    } else {
      const opt = filtered[row];
      if (!opt) return;
      onSelect(opt, opt.label);
    }
    close();
  };

  const onSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(a => Math.min(a + 1, rowCount - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(a => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (rowCount > 0) choose(active);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      close(false);
    }
  };

  // Ukuran sama dengan Select agar kedua jenis dropdown sejajar.
  const pad = size === 'sm' ? 'min-h-[44px] sm:min-h-[30px] px-2 text-xs' : 'min-h-[44px] sm:min-h-[34px] px-2.5 text-xs';
  let lastGroup: string | undefined;

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        onClick={() => (open ? close() : openPicker())}
        onKeyDown={e => {
          if (!open && (e.key === 'ArrowDown' || (e.key.length === 1 && !e.ctrlKey && !e.metaKey))) {
            e.preventDefault();
            openPicker();
            if (e.key.length === 1) setQuery(e.key);
          }
        }}
        className={`w-full flex items-center justify-between gap-2 rounded-lg border bg-white text-left cursor-pointer ${pad} ${FOCUS} ${
          invalid ? 'border-rose-500' : 'border-slate-300 hover:border-slate-400'
        }`}>
        <span className={`truncate ${displayLabel ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>{displayLabel || placeholder}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open &&
        createPortal(
          <div
            ref={popoverRef}
            style={{ position: 'fixed', left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, zIndex: 70 }}
            className="bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden text-xs">
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  autoFocus
                  type="text"
                  role="combobox"
                  aria-expanded="true"
                  aria-controls={listId}
                  aria-activedescendant={rowCount > 0 ? `${listId}-${active}` : undefined}
                  aria-label={searchPlaceholder}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={onSearchKey}
                  placeholder={searchPlaceholder}
                  className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <p className="mt-1 px-0.5 text-[11px] text-slate-600">{filtered.length} dari {options.length} {noun}</p>
            </div>
            <ul ref={listRef} id={listId} role="listbox" className="overflow-y-auto" style={{ maxHeight: POPOVER_MAX_H - 72 }}>
              {filtered.map((o, i) => {
                const row = i;
                const header = o.group && o.group !== lastGroup ? o.group : null;
                lastGroup = o.group;
                return (
                  <React.Fragment key={`${o.group}-${o.value}`}>
                    {header && (
                      <li role="presentation" className="sticky top-0 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600 border-b border-slate-100">
                        {header}
                      </li>
                    )}
                    <li
                      id={`${listId}-${row}`}
                      data-row={row}
                      role="option"
                      aria-selected={active === row}
                      onMouseEnter={() => setActive(row)}
                      onClick={() => choose(row)}
                      className={`flex items-center justify-between gap-3 px-3 py-2 cursor-pointer ${active === row ? 'bg-emerald-50' : ''} ${
                        o.value === value ? 'font-semibold text-emerald-800' : 'text-slate-800'
                      }`}>
                      <span className="min-w-0 truncate">{o.label}</span>
                      {o.hint && <span className="shrink-0 text-[11px] text-slate-600 font-mono tabular-nums">{o.hint}</span>}
                    </li>
                  </React.Fragment>
                );
              })}
              {showCustom && (
                <li
                  id={`${listId}-${customRow}`}
                  data-row={customRow}
                  role="option"
                  aria-selected={active === customRow}
                  onMouseEnter={() => setActive(customRow)}
                  onClick={() => choose(customRow)}
                  className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer border-t border-slate-100 ${active === customRow ? 'bg-emerald-50' : ''}`}>
                  <Plus className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span className="text-slate-800">
                    Pakai <strong className="text-slate-900">"{trimmed}"</strong> sebagai barang baru
                  </span>
                </li>
              )}
              {rowCount === 0 && (
                <li className="px-3 py-6 text-center text-slate-600">
                  Tidak ada {noun} yang cocok dengan "{trimmed}".
                </li>
              )}
            </ul>
          </div>,
          document.body
        )}
    </>
  );
};
