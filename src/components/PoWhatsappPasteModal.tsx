import React, { useEffect, useMemo, useState } from 'react';
import { Check, AlertTriangle, ClipboardPaste, RotateCcw } from 'lucide-react';
import { ItemMaster } from '../types/warehouse';
import { PO_CATEGORIES, PoCategory } from '../utils/poCategory';
import { MatchKind, ParsedWaPoItem, parseWhatsappPoText } from '../utils/poWhatsappParser';
import { DialogShell, FIELD_INPUT, FIELD_LABEL, TABLE_INPUT, BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST, FOCUS_RING } from './common/FormDialog';
import { SearchPicker, PickerOption } from './common/SearchPicker';
import { Select } from './common/Select';

export interface WaImportedPoRow {
  category: string;
  itemName: string;
  qtyOrder: string;
  supplier: string;
}

interface ReviewRow extends ParsedWaPoItem {
  selected: boolean;
  itemName: string;
  qtyOrder: string;
  supplier: string;
  chosenMatchKind: MatchKind;
}

interface PoWhatsappPasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingRowCount: number;
  masterItems: ItemMaster[];
  itemOptions: PickerOption[];
  supplierOptions: PickerOption[];
  suggestSupplier: (category: string, itemName: string, rawName?: string) => string;
  onApply: (rows: WaImportedPoRow[], mode: 'append' | 'replace') => void;
}

const SAMPLE_PLACEHOLDER = `*SPPG MALANG TUMPANG JERU*
LIST ORDER
PROTEIN:
1. telur ayam 17 krat
2. tempe sanan 45 layah

SEMBAKO:
1. beras 8 sak
2. minyak goreng 8 karton

SAYUR DAN BUAH:
1. cabe merah 2 kg
2. wortel 40 kg`;

const MATCH_BADGE: Record<MatchKind, { label: string; className: string }> = {
  EXACT: { label: 'Cocok master', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  SIMILAR: { label: 'Mirip (cek)', className: 'bg-sky-50 text-sky-800 border-sky-200' },
  NEW: { label: 'Bahan baru', className: 'bg-amber-50 text-amber-800 border-amber-200' },
};

export const PoWhatsappPasteModal: React.FC<PoWhatsappPasteModalProps> = ({
  isOpen,
  onClose,
  existingRowCount,
  masterItems,
  itemOptions,
  supplierOptions,
  suggestSupplier,
  onApply,
}) => {
  const [rawText, setRawText] = useState('');
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [unparsedLines, setUnparsedLines] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<'ALL' | 'CHECK' | 'EXACT'>('ALL');

  const masterNameSet = useMemo(() => {
    const map = new Map<string, ItemMaster>();
    masterItems.forEach(it => {
      if (it.isActive !== false && it.itemType !== 'EQUIPMENT') {
        map.set(it.name.trim().toLowerCase(), it);
      }
    });
    return map;
  }, [masterItems]);

  // Reset saat modal dibuka kembali agar tidak membawa sisa tempelan sebelumnya.
  useEffect(() => {
    if (!isOpen) return;
    setRawText('');
    setRows([]);
    setUnparsedLines([]);
    setFilterMode('ALL');
  }, [isOpen]);

  const handleTextChange = (nextText: string) => {
    setRawText(nextText);
    if (!nextText.trim()) {
      setRows([]);
      setUnparsedLines([]);
      return;
    }
    const parsed = parseWhatsappPoText(nextText, masterItems);
    setUnparsedLines(parsed.unparsedLines);
    setRows(
      parsed.items.map(it => ({
        ...it,
        selected: true,
        itemName: it.suggestedName,
        qtyOrder: it.formattedQty,
        supplier: suggestSupplier(it.category, it.suggestedName, it.rawName),
        chosenMatchKind: it.matchKind,
      }))
    );
  };

  const updateRow = (id: string, patch: Partial<ReviewRow>) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  };

  const selectItemName = (row: ReviewRow, nextName: string) => {
    const matched = masterNameSet.get(nextName.trim().toLowerCase());
    const nextKind: MatchKind = matched
      ? nextName.trim().toLowerCase() === row.rawName.trim().toLowerCase()
        ? 'EXACT'
        : 'SIMILAR'
      : 'NEW';
    const nextSupplier = row.supplier || suggestSupplier(row.category, nextName, row.rawName);
    updateRow(row.id, {
      itemName: nextName,
      chosenMatchKind: nextKind,
      supplier: nextSupplier,
    });
  };

  const selectedRows = useMemo(
    () => rows.filter(r => r.selected && r.itemName.trim()),
    [rows]
  );

  const counts = useMemo(() => {
    let exact = 0;
    let similar = 0;
    let fresh = 0;
    rows.forEach(r => {
      if (r.chosenMatchKind === 'EXACT') exact++;
      else if (r.chosenMatchKind === 'SIMILAR') similar++;
      else fresh++;
    });
    return { exact, similar, fresh, needCheck: similar + fresh };
  }, [rows]);

  const visibleRows = useMemo(() => {
    if (filterMode === 'EXACT') return rows.filter(r => r.chosenMatchKind === 'EXACT');
    if (filterMode === 'CHECK') return rows.filter(r => r.chosenMatchKind !== 'EXACT');
    return rows;
  }, [rows, filterMode]);

  const allSelected = rows.length > 0 && rows.every(r => r.selected);

  const handleConfirm = (mode: 'append' | 'replace') => {
    if (selectedRows.length === 0) return;
    onApply(
      selectedRows.map(r => ({
        category: r.category,
        itemName: r.itemName.trim(),
        qtyOrder: r.qtyOrder.trim() || r.formattedQty,
        supplier: r.supplier.trim(),
      })),
      mode
    );
    onClose();
  };

  if (!isOpen) return null;

  return (
    <DialogShell
      size="2xl"
      title="Tempel daftar PO dari WhatsApp"
      description="Langkah 1 dari 2: tempel teks order lalu kroscek kesesuaian nama bahan, jumlah, dan supplier sebelum masuk ke daftar PO."
      onClose={onClose}
      footer={
        <>
          <div className="mr-auto text-[11px] text-slate-600 hidden sm:block">
            {selectedRows.length > 0
              ? 'Masuk ke form PO dulu (belum diterbitkan) untuk kroscek tahap kedua.'
              : 'Tempel daftar order di kotak atas untuk membaca bahan.'}
          </div>
          <button type="button" onClick={onClose} className={`${BTN_SECONDARY} ${BTN_GHOST}`}>
            Batal
          </button>
          {existingRowCount > 0 && (
            <button
              type="button"
              disabled={selectedRows.length === 0}
              onClick={() => handleConfirm('replace')}
              className={`${BTN_SECONDARY} disabled:opacity-50`}
              title="Hapus daftar bahan yang sudah ada lalu ganti dengan hasil tempelan ini"
            >
              Ganti daftar ({selectedRows.length})
            </button>
          )}
          <button
            type="button"
            disabled={selectedRows.length === 0}
            onClick={() => handleConfirm(existingRowCount > 0 ? 'append' : 'replace')}
            className={`${BTN_PRIMARY} disabled:opacity-50`}
          >
            <Check className="w-4 h-4" />
            {existingRowCount > 0
              ? `Tambahkan ke PO (${selectedRows.length})`
              : `Masukkan ke daftar PO (${selectedRows.length})`}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Input teks WA */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <label htmlFor="wa-po-paste-input" className={`${FIELD_LABEL} mb-0`}>
              Teks list order WhatsApp
            </label>
            {rawText && (
              <button
                type="button"
                onClick={() => handleTextChange('')}
                className={`inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 rounded px-1.5 py-0.5 cursor-pointer ${FOCUS_RING}`}
              >
                <RotateCcw className="w-3 h-3" />
                Bersihkan
              </button>
            )}
          </div>
          <textarea
            id="wa-po-paste-input"
            rows={rows.length > 0 ? 5 : 9}
            value={rawText}
            onChange={e => handleTextChange(e.target.value)}
            placeholder={SAMPLE_PLACEHOLDER}
            className={`${FIELD_INPUT} font-mono text-[11px] leading-relaxed py-2 min-h-[110px]`}
          />
          <p className="mt-1 text-[11px] text-slate-600">
            Mendukung judul kategori (<span className="font-mono">PROTEIN:</span>, <span className="font-mono">SEMBAKO:</span>, <span className="font-mono">SAYUR DAN BUAH:</span>) dan baris bernomor seperti <span className="font-mono">1. telur ayam 17 krat</span>.
          </p>
        </div>

        {/* Peringatan baris tidak terbaca */}
        {unparsedLines.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-950 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="min-w-0 space-y-1">
              <p className="font-semibold">
                {unparsedLines.length} baris tidak dikenali format jumlahnya (dilewati):
              </p>
              <p className="text-[11px] text-amber-900 font-mono break-words">
                {unparsedLines.join(' · ')}
              </p>
            </div>
          </div>
        )}

        {/* Hasil kroscek */}
        {rows.length > 0 ? (
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-slate-900 tabular-nums">
                  {selectedRows.length} dari {rows.length} bahan dipilih
                </span>
                <span className="text-slate-400" aria-hidden="true">·</span>
                <span className="px-2 py-0.5 rounded-md border bg-emerald-50 text-emerald-800 border-emerald-200 text-[11px] font-medium tabular-nums">
                  {counts.exact} cocok
                </span>
                {counts.similar > 0 && (
                  <span className="px-2 py-0.5 rounded-md border bg-sky-50 text-sky-800 border-sky-200 text-[11px] font-medium tabular-nums">
                    {counts.similar} mirip
                  </span>
                )}
                {counts.fresh > 0 && (
                  <span className="px-2 py-0.5 rounded-md border bg-amber-50 text-amber-800 border-amber-200 text-[11px] font-medium tabular-nums">
                    {counts.fresh} baru
                  </span>
                )}
              </div>

              <div role="tablist" aria-label="Filter hasil pembacaan" className="inline-flex gap-1 p-0.5 bg-slate-100 rounded-lg text-[11px] self-start sm:self-auto">
                {([
                  { id: 'ALL', label: `Semua (${rows.length})` },
                  { id: 'CHECK', label: `Perlu dicek (${counts.needCheck})` },
                  { id: 'EXACT', label: `Cocok (${counts.exact})` },
                ] as const).map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={filterMode === tab.id}
                    onClick={() => setFilterMode(tab.id)}
                    className={`px-2.5 min-h-[36px] sm:min-h-[26px] rounded-md cursor-pointer ${FOCUS_RING} ${
                      filterMode === tab.id
                        ? 'bg-white text-slate-900 font-semibold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 font-medium'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              {/* Header desktop */}
              <div className="hidden sm:grid sm:grid-cols-[2rem_1.35fr_7.5rem_7rem_11.5rem] gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-700 items-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={e => setRows(prev => prev.map(r => ({ ...r, selected: e.target.checked })))}
                  aria-label="Pilih semua bahan"
                  className="w-4 h-4 rounded border-slate-300 text-emerald-700 cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-600"
                />
                <span>Kesesuaian bahan (teks WA → nama di PO)</span>
                <span>Kategori</span>
                <span>Jumlah</span>
                <span>Supplier</span>
              </div>

              <ul className="divide-y divide-slate-100 max-h-[42vh] overflow-y-auto">
                {visibleRows.map(row => {
                  const badge = MATCH_BADGE[row.chosenMatchKind];
                  const showUseRawButton =
                    row.itemName.trim().toLowerCase() !== row.rawName.trim().toLowerCase();
                  return (
                    <li
                      key={row.id}
                      className={`px-3 py-2.5 grid gap-2 items-start grid-cols-[1.75rem_1fr] sm:grid-cols-[2rem_1.35fr_7.5rem_7rem_11.5rem] ${
                        row.selected ? 'bg-white' : 'bg-slate-50/70 opacity-60'
                      }`}
                    >
                      <div className="pt-1.5">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={e => updateRow(row.id, { selected: e.target.checked })}
                          aria-label={`Masukkan ${row.itemName || row.rawName}`}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-700 cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-600"
                        />
                      </div>

                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className={`px-1.5 py-0.5 rounded-md border font-medium ${badge.className}`}>
                            {badge.label}
                          </span>
                          <span className="text-slate-600 truncate" title={row.rawLine}>
                            WA: <span className="font-mono text-slate-800">{row.rawName}</span>
                          </span>
                        </div>

                        <SearchPicker
                          size="sm"
                          allowCustom
                          noun="bahan"
                          value={row.itemName}
                          options={itemOptions}
                          placeholder="Pilih dari master atau pakai nama WA"
                          searchPlaceholder="Cari bahan di master barang..."
                          ariaLabel={`Nama bahan PO untuk ${row.rawName}`}
                          onSelect={(opt, text) => selectItemName(row, opt ? opt.value : text)}
                        />

                        {(row.candidates.length > 1 || showUseRawButton) && (
                          <div className="flex flex-wrap items-center gap-1 text-[11px]">
                            {row.candidates
                              .filter(c => c.item.name.trim().toLowerCase() !== row.itemName.trim().toLowerCase())
                              .map(c => (
                                <button
                                  key={c.item.id}
                                  type="button"
                                  onClick={() => selectItemName(row, c.item.name)}
                                  className={`px-1.5 py-0.5 rounded-md border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 cursor-pointer ${FOCUS_RING}`}
                                >
                                  Ganti ke {c.item.name}
                                </button>
                              ))}
                            {showUseRawButton && (
                              <button
                                type="button"
                                onClick={() => selectItemName(row, row.rawName)}
                                className={`px-1.5 py-0.5 rounded-md border border-slate-200 bg-white hover:bg-amber-50 hover:border-amber-300 text-slate-700 cursor-pointer ${FOCUS_RING}`}
                              >
                                Pakai “{row.rawName}”
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Kategori, Jumlah, Supplier: di mobile dibungkus dalam grid bawah agar rapi */}
                      <div className="col-start-2 sm:col-start-auto sm:contents grid grid-cols-2 gap-2">
                        <div>
                          <span className="block sm:hidden text-[10px] font-medium text-slate-500 mb-0.5">Kategori</span>
                          <Select
                            size="sm"
                            className="w-full"
                            aria-label={`Kategori ${row.itemName}`}
                            value={row.category}
                            onChange={e => updateRow(row.id, { category: e.target.value as PoCategory })}
                          >
                            {PO_CATEGORIES.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </Select>
                        </div>

                        <div>
                          <span className="block sm:hidden text-[10px] font-medium text-slate-500 mb-0.5">Jumlah</span>
                          <input
                            type="text"
                            value={row.qtyOrder}
                            onChange={e => updateRow(row.id, { qtyOrder: e.target.value })}
                            aria-label={`Jumlah ${row.itemName}`}
                            className={`${TABLE_INPUT} font-mono tabular-nums`}
                          />
                        </div>

                        <div className="col-span-2 sm:col-span-1">
                          <span className="block sm:hidden text-[10px] font-medium text-slate-500 mb-0.5">Supplier</span>
                          <SearchPicker
                            size="sm"
                            allowCustom
                            noun="supplier"
                            value={row.supplier}
                            options={supplierOptions}
                            placeholder="Pilih supplier"
                            searchPlaceholder="Cari atau ketik supplier..."
                            ariaLabel={`Supplier ${row.itemName}`}
                            onSelect={(opt, text) => updateRow(row.id, { supplier: opt ? opt.value : text })}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
                {visibleRows.length === 0 && (
                  <li className="px-4 py-6 text-center text-xs text-slate-600">
                    Tidak ada bahan di filter ini.
                  </li>
                )}
              </ul>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-6 text-center space-y-1">
            <ClipboardPaste className="w-5 h-5 text-slate-400 mx-auto" aria-hidden="true" />
            <p className="text-xs font-medium text-slate-700">Daftar bahan untuk dikroscek akan muncul otomatis di sini.</p>
            <p className="text-[11px] text-slate-600">
              Bahan yang mirip dengan Master Barang akan dicocokkan otomatis dan bisa Anda koreksi sebelum masuk ke form PO.
            </p>
          </div>
        )}
      </div>
    </DialogShell>
  );
};
