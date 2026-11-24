import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Scissors, Trash2 } from 'lucide-react';
import logoSppgImg from '../../assets/logo sppg.png';
import { warehouseDb, APP_SETTINGS_CHANGED_EVENT } from '../../db/storage';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { SearchPicker } from '../common/SearchPicker';
import { FIELD_INPUT, FIELD_LABEL, BTN_PRIMARY, BTN_SECONDARY, FOCUS_RING } from '../common/FormDialog';
import { DocSignatureToggle, OfficerSignatureImg } from '../common/OfficerSignatureImg';
import { buildItemReference } from '../../utils/itemReference';
import { poNumberForDate } from '../../utils/poNumberGenerator';
import { localDateIso } from '../../utils/localDate';

const SETTING_MANUAL_NOTAS = 'manual_nota_pesanan_v1';

const UNIT_SUGGESTIONS = [
  'Kg',
  'Gram',
  'Liter',
  'Pcs',
  'Pack',
  'Dus',
  'Ikat',
  'Krat',
  'Sak',
  'Butir',
  'Botol',
  'Jerigen',
  'Pouch',
  'Roll',
  'Rim',
];

const MONTHS_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export interface ManualNotaLine {
  id: string;
  name: string;
  qty: string;
  unit: string;
  unitPrice: string;
}

export interface SavedManualNota {
  id: string;
  poNumber: string;
  poNumberCustomized: boolean;
  date: string;
  signDate: string;
  signDateCustomized: boolean;
  deliveryTimeNote: string;
  fromName: string;
  supplierId?: string;
  supplierName: string;
  supplierAddress: string;
  signerRole1: string;
  signerRole2: string;
  signerName: string;
  printLayout: 'SINGLE' | 'DOUBLE';
  items: ManualNotaLine[];
  updatedAt: string;
}

interface CellSuggestOption {
  value: string;
  hint?: string;
}

interface ActiveSuggestState {
  rowIdx: number;
  colIdx: 0 | 2;
  anchorEl: HTMLInputElement;
}

const parseDecimal = (raw: string): number => {
  const cleaned = String(raw || '').trim().replace(',', '.');
  const num = parseFloat(cleaned);
  return Number.isFinite(num) && num > 0 ? num : 0;
};

const parsePrice = (raw: string): number => {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return 0;
  const num = parseInt(digits, 10);
  return Number.isFinite(num) && num > 0 ? num : 0;
};

const formatPriceInput = (raw: string): string => {
  const num = parsePrice(raw);
  return num > 0 ? num.toLocaleString('id-ID') : '';
};

function formatDateIndonesian(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parts[0];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (monthIdx >= 0 && monthIdx < 12 && day > 0) {
      return `${day} ${MONTHS_ID[monthIdx]} ${year}`;
    }
  }
  return dateStr;
}

function formatDateWithDashes(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parts[0];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (monthIdx >= 0 && monthIdx < 12 && day > 0) {
      return `${day}-${MONTHS_ID[monthIdx]}-${year}`;
    }
  }
  return dateStr;
}

function formatQtyForPaper(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const num = parseDecimal(trimmed);
  if (num <= 0) return trimmed;
  return num.toLocaleString('id-ID', { maximumFractionDigits: 3 });
}

const makeEmptyLine = (): ManualNotaLine => ({
  id: `MNL-ITEM-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  name: '',
  qty: '',
  unit: '',
  unitPrice: '',
});

const isRowFilled = (line: ManualNotaLine): boolean =>
  Boolean(line.name.trim() || line.qty.trim() || parsePrice(line.unitPrice) > 0);

function createBlankDraft(notaDates: string[], defaultHeadName: string): SavedManualNota {
  const today = localDateIso();
  return {
    id: '',
    poNumber: poNumberForDate(today, notaDates),
    poNumberCustomized: false,
    date: today,
    signDate: today,
    signDateCustomized: false,
    deliveryTimeNote: '',
    fromName: 'SPPG MLG TUMPANG JERU',
    supplierId: '',
    supplierName: '',
    supplierAddress: '',
    signerRole1: 'Kepala Satuan Pelayanan',
    signerRole2: 'Pemenuhan Gizi',
    signerName: defaultHeadName || 'Rizky Iman Ramdhan, S.Pd',
    printLayout: 'SINGLE',
    items: [makeEmptyLine(), makeEmptyLine(), makeEmptyLine(), makeEmptyLine(), makeEmptyLine()],
    updatedAt: new Date().toISOString(),
  };
}

const CELL_INPUT =
  'w-full h-11 sm:h-9 px-2.5 bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-emerald-50/60 focus:ring-2 focus:ring-inset focus:ring-emerald-600 transition-colors';

export const ManualNotaPesananDoc: React.FC = () => {
  const { currentUser } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const tbodyRef = useRef<HTMLTableSectionElement | null>(null);
  const suggestListRef = useRef<HTMLUListElement | null>(null);

  const [version, setVersion] = useState(0);
  useEffect(() => {
    const reload = () => setVersion(v => v + 1);
    window.addEventListener(APP_SETTINGS_CHANGED_EVENT, reload);
    window.addEventListener('sppg_warehouse_sync', reload);
    return () => {
      window.removeEventListener(APP_SETTINGS_CHANGED_EVENT, reload);
      window.removeEventListener('sppg_warehouse_sync', reload);
    };
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const suppliers = useMemo(() => warehouseDb.getSuppliers().filter(s => s.isActive !== false), [version]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const masterItems = useMemo(() => warehouseDb.getItems().filter(i => i.isActive), [version]);
  const itemLookup = useMemo(
    () => buildItemReference(masterItems, warehouseDb.getNonFoodExpenses()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [masterItems, version]
  );

  const savedNotas = useMemo(
    () => warehouseDb.getAppSetting<SavedManualNota[]>(SETTING_MANUAL_NOTAS, []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version]
  );

  const existingNotaDates = useMemo(() => {
    const poDates = warehouseDb.getPurchaseOrders().map(p => p.date).filter(Boolean);
    const manualDates = savedNotas.map(n => n.date).filter(Boolean);
    return [...poDates, ...manualDates];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedNotas, version]);

  const defaultHeadName = useMemo(() => warehouseDb.getSppgHeadName(), [version]); // eslint-disable-line react-hooks/exhaustive-deps

  const [draft, setDraft] = useState<SavedManualNota>(() => createBlankDraft(existingNotaDates, defaultHeadName));

  // Popover saran ringan pengganti <datalist> bawaan browser
  const [suggestTarget, setSuggestTarget] = useState<ActiveSuggestState | null>(null);
  const [suggestIndex, setSuggestIndex] = useState<number>(-1);
  const [suggestPos, setSuggestPos] = useState<{ left: number; width: number; top?: number; bottom?: number }>({
    left: 0,
    width: 240,
  });

  const suggestOptions = useMemo<CellSuggestOption[]>(() => {
    if (!suggestTarget) return [];
    const row = draft.items[suggestTarget.rowIdx];
    if (!row) return [];

    if (suggestTarget.colIdx === 0) {
      const q = row.name.trim().toLowerCase();
      if (!q) return [];
      const words = q.split(/\s+/);
      const matched = masterItems
        .filter(it => {
          const hay = it.name.toLowerCase();
          return words.every(w => hay.includes(w));
        })
        .sort((a, b) => {
          const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
          const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
          return aStarts - bStarts || a.name.localeCompare(b.name, 'id');
        })
        .slice(0, 8);

      if (matched.length === 1 && matched[0].name.toLowerCase() === q) return [];
      return matched.map(it => {
        const ref = itemLookup(it.name);
        const unit = ref?.unit || it.baseUnit || 'Kg';
        const priceHint = ref?.price && ref.price > 0 ? ` · Rp ${ref.price.toLocaleString('id-ID')}` : '';
        return {
          value: it.name,
          hint: `${unit}${priceHint}`,
        };
      });
    }

    const q = row.unit.trim().toLowerCase();
    if (!q) return [];
    const matchedUnits = UNIT_SUGGESTIONS.filter(u => u.toLowerCase().includes(q)).sort((a, b) => {
      const aStarts = a.toLowerCase().startsWith(q) ? 0 : 1;
      const bStarts = b.toLowerCase().startsWith(q) ? 0 : 1;
      return aStarts - bStarts || a.localeCompare(b, 'id');
    });
    if (matchedUnits.length === 1 && matchedUnits[0].toLowerCase() === q) return [];
    return matchedUnits.slice(0, 6).map(u => ({ value: u }));
  }, [suggestTarget, draft.items, masterItems, itemLookup]);

  const isSuggestOpen = Boolean(suggestTarget && suggestOptions.length > 0);

  const updateSuggestPosition = (el: HTMLInputElement, colIdx: 0 | 2) => {
    const r = el.getBoundingClientRect();
    const minW = colIdx === 0 ? 250 : 120;
    const width = Math.min(Math.max(r.width, minW), window.innerWidth - 16);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    const spaceBelow = window.innerHeight - r.bottom;
    if (spaceBelow < 200 && r.top > spaceBelow) {
      setSuggestPos({ left, width, bottom: window.innerHeight - r.top + 3 });
    } else {
      setSuggestPos({ left, width, top: r.bottom + 3 });
    }
  };

  useLayoutEffect(() => {
    if (!isSuggestOpen || !suggestTarget) return;
    const sync = () => updateSuggestPosition(suggestTarget.anchorEl, suggestTarget.colIdx);
    sync();
    window.addEventListener('resize', sync);
    window.addEventListener('scroll', sync, true);
    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('scroll', sync, true);
    };
  }, [isSuggestOpen, suggestTarget]);

  useEffect(() => {
    if (!isSuggestOpen || suggestIndex < 0) return;
    suggestListRef.current
      ?.querySelector<HTMLElement>(`[data-suggest-idx="${suggestIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [isSuggestOpen, suggestIndex]);

  const closeSuggest = () => {
    setSuggestTarget(null);
    setSuggestIndex(-1);
  };

  const suggestedPoNumber = useMemo(
    () => poNumberForDate(draft.date || localDateIso(), existingNotaDates),
    [draft.date, existingNotaDates]
  );

  const lineTotals = useMemo(
    () =>
      draft.items.map(it => {
        const q = parseDecimal(it.qty);
        const p = parsePrice(it.unitPrice);
        return Math.round(q * p);
      }),
    [draft.items]
  );

  const grandTotal = useMemo(() => lineTotals.reduce((acc, n) => acc + n, 0), [lineTotals]);
  const filledRowCount = useMemo(() => draft.items.filter(isRowFilled).length, [draft.items]);

  const supplierOptions = useMemo(
    () =>
      suppliers.map(s => ({
        value: s.name,
        label: s.name,
        group: s.supplyCategory || 'Supplier',
        hint: s.address || undefined,
      })),
    [suppliers]
  );

  const handleDateChange = (nextDate: string) => {
    const cleanDate = nextDate || localDateIso();
    setDraft(prev => ({
      ...prev,
      date: cleanDate,
      signDate: prev.signDateCustomized ? prev.signDate : cleanDate,
      poNumber: prev.poNumberCustomized ? prev.poNumber : poNumberForDate(cleanDate, existingNotaDates),
    }));
  };

  const handlePoNumberChange = (val: string) => {
    setDraft(prev => ({
      ...prev,
      poNumber: val,
      poNumberCustomized: true,
    }));
  };

  const handleFollowDateNumber = () => {
    setDraft(prev => ({
      ...prev,
      poNumber: poNumberForDate(prev.date || localDateIso(), existingNotaDates),
      poNumberCustomized: false,
    }));
  };

  const handleSupplierSelect = (optValue: string | null, customText: string) => {
    const chosenName = (optValue ?? customText).trim();
    const matched = suppliers.find(s => s.name.toLowerCase() === chosenName.toLowerCase());
    setDraft(prev => ({
      ...prev,
      supplierId: matched?.id || '',
      supplierName: matched ? matched.name : chosenName,
      supplierAddress: matched?.address ? matched.address : prev.supplierAddress,
    }));
  };

  const focusCell = (rowIdx: number, colIdx: number) => {
    const tbody = tbodyRef.current;
    if (!tbody) return;
    const nextInput = tbody.querySelector<HTMLInputElement>(
      `input[data-grid-row="${rowIdx}"][data-grid-col="${colIdx}"]`
    );
    if (nextInput) {
      nextInput.focus();
      nextInput.select();
    }
  };

  const applySuggestion = (rowIdx: number, colIdx: 0 | 2, chosenValue: string) => {
    const targetLine = draft.items[rowIdx];
    if (!targetLine) return;
    closeSuggest();

    if (colIdx === 0) {
      const ref = itemLookup(chosenValue);
      setDraft(prev => ({
        ...prev,
        items: prev.items.map((line, i) => {
          if (i !== rowIdx) return line;
          return {
            ...line,
            name: chosenValue,
            unit: ref?.unit || line.unit || 'Kg',
            unitPrice: !line.unitPrice && ref?.price ? formatPriceInput(String(ref.price)) : line.unitPrice,
          };
        }),
      }));
      requestAnimationFrame(() => focusCell(rowIdx, 1));
    } else {
      setDraft(prev => ({
        ...prev,
        items: prev.items.map((line, i) => (i === rowIdx ? { ...line, unit: chosenValue } : line)),
      }));
      requestAnimationFrame(() => focusCell(rowIdx, 3));
    }
  };

  const handleLineChange = (
    id: string,
    rowIdx: number,
    field: keyof ManualNotaLine,
    value: string,
    inputEl?: HTMLInputElement
  ) => {
    setDraft(prev => ({
      ...prev,
      items: prev.items.map(line => {
        if (line.id !== id) return line;
        if (field === 'name') {
          const ref = itemLookup(value);
          if (ref) {
            return {
              ...line,
              name: value,
              unit: ref.unit || line.unit || 'Kg',
              unitPrice: !line.unitPrice && ref.price ? formatPriceInput(String(ref.price)) : line.unitPrice,
            };
          }
          return { ...line, name: value };
        }
        if (field === 'unitPrice') {
          return { ...line, unitPrice: formatPriceInput(value) };
        }
        if (field === 'qty') {
          const cleanedQty = value.replace(/[^0-9.,]/g, '');
          return {
            ...line,
            qty: cleanedQty,
            unit: cleanedQty && !line.unit ? 'Kg' : line.unit,
          };
        }
        return { ...line, [field]: value };
      }),
    }));

    if ((field === 'name' || field === 'unit') && inputEl) {
      const colIdx: 0 | 2 = field === 'name' ? 0 : 2;
      if (value.trim()) {
        updateSuggestPosition(inputEl, colIdx);
        setSuggestTarget({ rowIdx, colIdx, anchorEl: inputEl });
        setSuggestIndex(-1);
      } else {
        closeSuggest();
      }
    }
  };

  const handleEnsureDefaultUnit = (id: string) => {
    setDraft(prev => ({
      ...prev,
      items: prev.items.map(line => {
        if (line.id !== id) return line;
        if ((line.name.trim() || line.qty.trim()) && !line.unit.trim()) {
          return { ...line, unit: 'Kg' };
        }
        return line;
      }),
    }));
  };

  const appendRowAndFocus = (targetRowIdx: number, targetColIdx: number) => {
    setDraft(prev => ({ ...prev, items: [...prev.items, makeEmptyLine()] }));
    requestAnimationFrame(() => {
      focusCell(targetRowIdx, targetColIdx);
    });
  };

  const handleAddLine = () => {
    const nextIdx = draft.items.length;
    appendRowAndFocus(nextIdx, 0);
  };

  const handleRemoveLine = (id: string) => {
    closeSuggest();
    setDraft(prev => {
      if (prev.items.length <= 1) {
        return { ...prev, items: [makeEmptyLine()] };
      }
      return { ...prev, items: prev.items.filter(it => it.id !== id) };
    });
  };

  /**
   * Navigasi tabel ala spreadsheet yang menyatu mulus dengan saran autocomplete ringan:
   * - Saat daftar saran terbuka: Panah Bawah memilih saran; Enter menerima saran terpilih (bila belum ada saran dipilih, Enter tetap pindah sel tanpa menimpa ketikan); Escape menutup saran.
   * - Panah Atas / Bawah: pindah baris di kolom yang sama (otomatis tambah baris di ujung bila baris sedang terisi).
   * - Panah Kiri / Kanan: pindah antar kolom saat kursor di tepi teks atau seluruh teks terpilih; membungkus antar baris.
   * - Enter: lanjut ke kolom kosong berikutnya pada baris yang sedang diisi, atau turun ke baris berikutnya.
   */
  const handleSpreadsheetKeyDown = (e: React.KeyboardEvent<HTMLTableSectionElement>) => {
    if (e.ctrlKey || e.metaKey) return;
    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.dataset.gridRow === undefined || target.dataset.gridCol === undefined) return;

    const rowIdx = Number(target.dataset.gridRow);
    const colIdx = Number(target.dataset.gridCol);
    const totalRows = draft.items.length;
    const currentRow = draft.items[rowIdx];
    const lastCol = 3;

    const thisCellSuggestOpen =
      isSuggestOpen &&
      suggestTarget !== null &&
      suggestTarget.rowIdx === rowIdx &&
      suggestTarget.colIdx === colIdx;

    if (e.key === 'Escape' && thisCellSuggestOpen) {
      e.preventDefault();
      e.stopPropagation();
      closeSuggest();
      return;
    }

    if (e.altKey && e.key === 'ArrowDown' && (colIdx === 0 || colIdx === 2)) {
      e.preventDefault();
      updateSuggestPosition(target, colIdx);
      setSuggestTarget({ rowIdx, colIdx, anchorEl: target });
      setSuggestIndex(0);
      return;
    }
    if (e.altKey) return;

    if (thisCellSuggestOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSuggestIndex(prev => (prev + 1 < suggestOptions.length ? prev + 1 : 0));
        return;
      }
      if (e.key === 'ArrowUp' && suggestIndex >= 0) {
        e.preventDefault();
        e.stopPropagation();
        setSuggestIndex(prev => prev - 1);
        return;
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && suggestIndex >= 0 && suggestOptions[suggestIndex]) {
        e.preventDefault();
        e.stopPropagation();
        applySuggestion(rowIdx, colIdx as 0 | 2, suggestOptions[suggestIndex].value);
        return;
      }
    }

    if (e.key === 'Tab') {
      closeSuggest();
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      closeSuggest();
      if (rowIdx > 0) focusCell(rowIdx - 1, colIdx);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      closeSuggest();
      if (rowIdx + 1 < totalRows) {
        focusCell(rowIdx + 1, colIdx);
      } else if (currentRow && isRowFilled(currentRow)) {
        appendRowAndFocus(rowIdx + 1, colIdx);
      }
      return;
    }

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const valLen = target.value.length;
      const selStart = target.selectionStart;
      const selEnd = target.selectionEnd;
      const allSelected = valLen === 0 || (selStart === 0 && selEnd === valLen);
      const atLeftEdge = selStart === null || allSelected || (selStart === 0 && selEnd === 0);
      const atRightEdge = selStart === null || allSelected || (selStart === valLen && selEnd === valLen);

      if (e.key === 'ArrowLeft' && atLeftEdge) {
        e.preventDefault();
        e.stopPropagation();
        closeSuggest();
        if (colIdx > 0) {
          focusCell(rowIdx, colIdx - 1);
        } else if (rowIdx > 0) {
          focusCell(rowIdx - 1, lastCol);
        }
      } else if (e.key === 'ArrowRight' && atRightEdge) {
        e.preventDefault();
        e.stopPropagation();
        closeSuggest();
        if (colIdx < lastCol) {
          focusCell(rowIdx, colIdx + 1);
        } else if (rowIdx + 1 < totalRows) {
          focusCell(rowIdx + 1, 0);
        } else if (currentRow && isRowFilled(currentRow)) {
          appendRowAndFocus(rowIdx + 1, 0);
        }
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      closeSuggest();

      if (e.shiftKey) {
        if (rowIdx > 0) focusCell(rowIdx - 1, colIdx);
        else if (colIdx > 0) focusCell(rowIdx, colIdx - 1);
        return;
      }

      if (!currentRow) return;

      if (colIdx === 0 && currentRow.name.trim() && !currentRow.qty.trim()) {
        focusCell(rowIdx, 1);
        return;
      }
      if (colIdx === 1 && currentRow.qty.trim() && !currentRow.unitPrice.trim()) {
        focusCell(rowIdx, 2);
        return;
      }
      if (colIdx === 2 && !currentRow.unitPrice.trim()) {
        focusCell(rowIdx, 3);
        return;
      }

      if (colIdx === lastCol) {
        const nextRow = draft.items[rowIdx + 1];
        if (nextRow) {
          focusCell(rowIdx + 1, nextRow.name.trim() ? lastCol : 0);
        } else {
          appendRowAndFocus(rowIdx + 1, 0);
        }
        return;
      }

      if (rowIdx + 1 < totalRows) {
        focusCell(rowIdx + 1, colIdx);
      } else {
        appendRowAndFocus(rowIdx + 1, colIdx);
      }
    }
  };

  const handleNewNota = () => {
    closeSuggest();
    setDraft(createBlankDraft(existingNotaDates, defaultHeadName));
  };

  const handleLoadSaved = (id: string) => {
    const target = savedNotas.find(n => n.id === id);
    if (!target) return;
    closeSuggest();
    setDraft({
      ...target,
      items:
        target.items.length > 0
          ? target.items.map(it => ({
              ...it,
              unitPrice: formatPriceInput(it.unitPrice),
            }))
          : [makeEmptyLine()],
    });
  };

  const handleSaveNota = () => {
    const cleanPoNumber = draft.poNumber.trim();
    if (!cleanPoNumber) {
      toast.warning('Isi nomor NP terlebih dahulu sebelum menyimpan.', 'Nomor NP Kosong');
      return;
    }
    const normalizedItems = draft.items.map(it => ({
      ...it,
      unit: isRowFilled(it) && !it.unit.trim() ? 'Kg' : it.unit.trim(),
      unitPrice: formatPriceInput(it.unitPrice),
    }));
    const id = draft.id || `MNP-${Date.now()}`;
    const record: SavedManualNota = {
      ...draft,
      id,
      poNumber: cleanPoNumber,
      items: normalizedItems,
      updatedAt: new Date().toISOString(),
    };
    const nextList = [record, ...savedNotas.filter(n => n.id !== id)];
    warehouseDb.saveAppSetting(SETTING_MANUAL_NOTAS, nextList, currentUser || undefined);
    setDraft(record);
    toast.success(`Nota ${cleanPoNumber} disimpan ke daftar nota manual.`, 'Nota Tersimpan');
  };

  const handleDuplicateAsNew = () => {
    setDraft(prev => ({
      ...prev,
      id: '',
      updatedAt: new Date().toISOString(),
    }));
    toast.info('Salinan nota siap diedit sebagai dokumen baru.', 'Salin Nota');
  };

  const handleDeleteSaved = async () => {
    if (!draft.id) return;
    const ok = await confirm({
      title: 'Hapus nota manual?',
      message: `Nota ${draft.poNumber}${draft.supplierName ? ` (${draft.supplierName})` : ''} akan dihapus dari daftar simpanan.`,
      confirmText: 'Hapus',
      variant: 'danger',
    });
    if (!ok) return;
    const nextList = savedNotas.filter(n => n.id !== draft.id);
    warehouseDb.saveAppSetting(SETTING_MANUAL_NOTAS, nextList, currentUser || undefined);
    setDraft(createBlankDraft(existingNotaDates, defaultHeadName));
    toast.success('Nota manual dihapus.', 'Dihapus');
  };

  const displayPoNumber = useMemo(() => {
    const raw = draft.poNumber.trim();
    if (!raw) return 'NO. NP/SPPG/....../....../......';
    return /^NO\./i.test(raw) ? raw : `NO. ${raw}`;
  }, [draft.poNumber]);

  const displayDeliveryDate = formatDateWithDashes(draft.date);
  const displaySignDate = formatDateIndonesian(draft.signDate || draft.date);

  const segmentBtn = (active: boolean) =>
    `flex-1 px-3 py-1.5 min-h-[40px] sm:min-h-[32px] rounded-md text-xs cursor-pointer transition-colors ${FOCUS_RING} ${
      active ? 'bg-white text-slate-900 font-semibold shadow-2xs' : 'text-slate-600 hover:text-slate-900 font-medium'
    }`;

  // Baris untuk kertas cetak: tampilkan baris yang terisi, atau 3 baris kosong bila semua masih kosong
  const paperRows = useMemo(() => {
    const nonEmpty = draft.items.filter(isRowFilled);
    return nonEmpty.length > 0 ? nonEmpty : draft.items.slice(0, 3);
  }, [draft.items]);

  const renderNotaCard = (copyTitle?: string, isCompact: boolean = false) => {
    return (
      <div
        className={`nota-copy-block bg-white text-black font-sans flex flex-col justify-between ${
          isCompact
            ? 'p-4 sm:p-5 rounded-lg border border-slate-300 print:border-none print:p-0 print:rounded-none'
            : 'p-6 sm:p-10 print:p-0'
        }`}
      >
        <div>
          {copyTitle && (
            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-200 text-[10px] text-slate-600">
              <span className="font-semibold text-slate-800">{copyTitle}</span>
              <span className="font-mono text-[9px] text-slate-500">Badan Gizi Nasional · SPPG MLG TUMPANG JERU</span>
            </div>
          )}

          {/* 1. Kop Surat Resmi Badan Gizi Nasional */}
          <div
            className={`flex items-center gap-3 sm:gap-4 ${
              isCompact ? 'pb-1.5 border-b-2 border-black' : 'pb-2.5 border-b-[2.5px] border-black'
            }`}
          >
            <div className="shrink-0">
              <img
                src={logoSppgImg}
                alt="Logo Badan Gizi Nasional"
                className={`${isCompact ? 'w-11 h-11 sm:w-13 sm:h-13' : 'w-16 h-16 sm:w-20 sm:h-20'} object-contain`}
              />
            </div>
            <div className={`flex-1 text-center ${isCompact ? 'pr-8 sm:pr-10' : 'pr-12 sm:pr-16'}`}>
              <h2 className={`${isCompact ? 'text-xs sm:text-sm' : 'text-base sm:text-lg'} font-bold text-black tracking-normal leading-tight`}>
                BADAN GIZI NASIONAL
              </h2>
              <p className={`${isCompact ? 'text-[9.5px] sm:text-[10px]' : 'text-[11px] sm:text-xs'} text-black leading-snug mt-0.5`}>
                Jl. Kebon Sirih No.1, RT.01/RW.07, Kb. Sirih, Kec. Menteng,
              </p>
              <p className={`${isCompact ? 'text-[9.5px] sm:text-[10px]' : 'text-[11px] sm:text-xs'} text-black leading-snug`}>
                Kota Jakarta Pusat, Daerah Khusus Ibukota Jakarta 10340
              </p>
            </div>
          </div>

          {/* 2. Judul Dokumen & Nomor NP */}
          <div className={`text-center ${isCompact ? 'my-2' : 'my-3.5'}`}>
            <h3 className={`${isCompact ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm'} font-bold text-black tracking-normal`}>
              NOTA PESANAN BAHAN MAKANAN DAN OPERASIONAL
            </h3>
            <div className={`${isCompact ? 'text-[11px]' : 'text-xs'} font-mono font-bold text-black mt-0.5`}>
              {displayPoNumber}
            </div>
          </div>

          {/* 3. Metadata Header (Dari, Kepada, Alamat, Pengiriman) */}
          <div className={`${isCompact ? 'my-2 text-[11px] space-y-0.5' : 'my-3 text-xs space-y-1'} text-black`}>
            <div className="flex items-start">
              <span className={`${isCompact ? 'w-20' : 'w-24'} shrink-0 font-medium`}>Dari</span>
              <span className="w-3 text-center shrink-0">:</span>
              <span className="font-semibold flex-1">{draft.fromName.trim() || 'SPPG MLG TUMPANG JERU'}</span>
            </div>
            <div className="flex items-start">
              <span className={`${isCompact ? 'w-20' : 'w-24'} shrink-0 font-medium`}>Kepada</span>
              <span className="w-3 text-center shrink-0">:</span>
              <span className="font-semibold flex-1">
                {draft.supplierName.trim() || '........................................'}
              </span>
            </div>
            <div className="flex items-start">
              <span className={`${isCompact ? 'w-20' : 'w-24'} shrink-0 font-medium`}>Alamat</span>
              <span className="w-3 text-center shrink-0">:</span>
              <span className="flex-1">
                {draft.supplierAddress.trim() || '........................................'}
              </span>
            </div>
            <div className="flex items-start">
              <span className={`${isCompact ? 'w-20' : 'w-24'} shrink-0 font-medium`}>Pengiriman</span>
              <span className="w-3 text-center shrink-0">:</span>
              <span className="font-medium flex-1">
                {displayDeliveryDate || '......................'}
                {draft.deliveryTimeNote.trim() ? ` ${draft.deliveryTimeNote.trim()}` : ''}
              </span>
            </div>
          </div>

          {/* 4. Tabel Rincian Barang Resmi */}
          <div className={isCompact ? 'my-2' : 'my-3'}>
            <table className={`w-full ${isCompact ? 'text-[10.5px]' : 'text-xs'} border-collapse border border-black table-po-print`}>
              <thead>
                <tr className="bg-[#5b9bd5] text-black font-bold border-b border-black table-header-bgn">
                  <th className={`border border-black ${isCompact ? 'py-1 px-1.5 w-8' : 'py-1.5 px-2 w-10'} text-center`}>
                    No
                  </th>
                  <th className={`border border-black ${isCompact ? 'py-1 px-2.5' : 'py-1.5 px-3'} text-center`}>
                    Uraian Jenis Bahan Makanan
                  </th>
                  <th className={`border border-black ${isCompact ? 'py-1 px-2 w-24' : 'py-1.5 px-2.5 w-28'} text-center leading-tight`}>
                    Banyaknya
                    <br />
                    (Angka)
                  </th>
                  <th className={`border border-black ${isCompact ? 'py-1 px-1.5 w-14' : 'py-1.5 px-2 w-16'} text-center`}>
                    Satuan
                  </th>
                  <th className={`border border-black ${isCompact ? 'py-1 px-2 w-24' : 'py-1.5 px-3 w-28'} text-center`}>
                    Harga
                  </th>
                  <th className={`border border-black ${isCompact ? 'py-1 px-2 w-28' : 'py-1.5 px-3 w-32'} text-center`}>
                    Jumlah
                  </th>
                </tr>
              </thead>
              <tbody>
                {paperRows.map((it, idx) => {
                  const unitPriceNum = parsePrice(it.unitPrice);
                  const qtyNum = parseDecimal(it.qty);
                  const lineTotal = Math.round(qtyNum * unitPriceNum);
                  const qtyText = formatQtyForPaper(it.qty);
                  const unitText = isRowFilled(it) ? it.unit.trim() || 'Kg' : '';
                  return (
                    <tr key={it.id || idx}>
                      <td className={`border border-black ${isCompact ? 'py-1 px-1.5' : 'py-1.5 px-2'} text-center tabular-nums`}>
                        {idx + 1}
                      </td>
                      <td className={`border border-black ${isCompact ? 'py-1 px-2.5' : 'py-1.5 px-3'} text-left`}>
                        {it.name.trim() || '\u00A0'}
                      </td>
                      <td className={`border border-black ${isCompact ? 'py-1 px-1.5' : 'py-1.5 px-2'} text-center tabular-nums`}>
                        {qtyText}
                      </td>
                      <td className={`border border-black ${isCompact ? 'py-1 px-1.5' : 'py-1.5 px-2'} text-center`}>
                        {unitText}
                      </td>
                      <td className={`border border-black ${isCompact ? 'py-1 px-2' : 'py-1.5 px-3'} text-right tabular-nums`}>
                        <div className="flex items-center justify-between gap-1">
                          <span>Rp</span>
                          <span>{unitPriceNum > 0 ? unitPriceNum.toLocaleString('id-ID') : '-'}</span>
                        </div>
                      </td>
                      <td className={`border border-black ${isCompact ? 'py-1 px-2' : 'py-1.5 px-3'} text-right tabular-nums`}>
                        <div className="flex items-center justify-between gap-1">
                          <span>Rp</span>
                          <span>{lineTotal > 0 ? lineTotal.toLocaleString('id-ID') : '-'}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                <tr className="border-t border-black font-bold">
                  <td colSpan={4} className={`border border-black ${isCompact ? 'py-1 px-2' : 'py-1.5 px-3'} text-center font-bold`}>
                    TOTAL
                  </td>
                  <td className={`border border-black ${isCompact ? 'py-1 px-2' : 'py-1.5 px-3'} text-left font-bold`}>
                    Rp
                  </td>
                  <td className={`border border-black ${isCompact ? 'py-1 px-2' : 'py-1.5 px-3'} text-right font-bold tabular-nums`}>
                    {grandTotal > 0 ? `${grandTotal.toLocaleString('id-ID')} -` : '-'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 5. Catatan & Pengesahan */}
          <div className={`grid grid-cols-12 gap-3 ${isCompact ? 'mt-1 pt-0.5 text-[10px]' : 'mt-2 pt-1 text-xs'} text-black`}>
            <div className={`col-span-7 flex items-start gap-1 leading-snug ${isCompact ? 'text-[9.5px]' : 'text-[11px]'}`}>
              <span className="font-bold shrink-0">Catatan</span>
              <span className="font-bold shrink-0">:</span>
              <div className="space-y-0.5">
                <div>1. Harga sudah termasuk ongkos kirim (ongkir).</div>
                <div>
                  2. Apabila barang yang diterima tidak sesuai atau rusak, maka pihak supplier akan mengganti barang tersebut sesuai kesepakatan
                </div>
                <div>3. Pengiriman barang dilakukan sesuai jadwal yang telah ditentukan oleh pihak pembeli.</div>
              </div>
            </div>

            <div className="col-span-5 text-center flex flex-col items-center justify-start">
              <div className={`${isCompact ? 'text-[10px]' : 'text-[11px]'} font-medium`}>
                Malang, {displaySignDate}
              </div>
              <div className="font-bold mt-0.5 leading-tight">
                {draft.signerRole1 && <div>{draft.signerRole1}</div>}
                {draft.signerRole2 && <div>{draft.signerRole2}</div>}
              </div>
              <div className={`my-0.5 ${isCompact ? 'h-20' : 'h-24 sm:h-28'} flex items-center justify-center`}>
                <OfficerSignatureImg
                  doc="po-nota"
                  officer="KEPALA_SPPG"
                  className={isCompact ? 'h-20' : 'h-24 sm:h-28'}
                  forName={draft.signerName}
                />
              </div>
              <div className={`mt-0.5 font-bold underline underline-offset-2 ${isCompact ? 'text-[11px]' : 'text-xs'}`}>
                {draft.signerName.trim() || '................................'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)] gap-4 items-start">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: ${draft.printLayout === 'DOUBLE' ? '5mm 8mm' : '10mm 12mm'};
          }
          .table-po-print {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          .table-po-print th, .table-po-print td {
            border: 1.5px solid #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .table-header-bgn {
            background-color: #5b9bd5 !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .nota-copy-block {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .cut-line-print {
            margin: 3mm 0 !important;
            padding: 1mm 0 !important;
          }
        }
      `}</style>

      {/* Kolom Kiri: Pengaturan & Tabel Spreadsheet */}
      <div className="space-y-4 no-print">
        {/* Bagian 1: Arsip Simpanan, Nomor NP, Tanggal, dan Supplier */}
        <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-3.5">
          <div className="flex flex-wrap items-end justify-between gap-2 pb-3 border-b border-slate-200">
            <div className="flex-1 min-w-[200px]">
              <label htmlFor="manual-nota-saved" className={FIELD_LABEL}>
                Nota tersimpan ({savedNotas.length})
              </label>
              <SearchPicker
                id="manual-nota-saved"
                value={draft.id}
                options={savedNotas.map(n => {
                  const total = n.items.reduce((s, it) => s + Math.round(parseDecimal(it.qty) * parsePrice(it.unitPrice)), 0);
                  return {
                    value: n.id,
                    label: `${n.poNumber} · ${n.supplierName || 'Tanpa supplier'}`,
                    hint: `${formatDateIndonesian(n.date)}${total > 0 ? ` · Rp ${total.toLocaleString('id-ID')}` : ''}`,
                  };
                })}
                onSelect={opt => opt && handleLoadSaved(opt.value)}
                placeholder={savedNotas.length === 0 ? 'Belum ada nota disimpan' : 'Pilih nota tersimpan'}
                searchPlaceholder="Cari nomor NP atau supplier..."
                noun="nota"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={handleNewNota} className={BTN_SECONDARY}>
                Nota baru
              </button>
              {draft.id && (
                <button type="button" onClick={handleDuplicateAsNew} className={BTN_SECONDARY}>
                  Duplikat
                </button>
              )}
              <button type="button" onClick={handleSaveNota} className={BTN_PRIMARY}>
                {draft.id ? 'Simpan perubahan' : 'Simpan nota'}
              </button>
              {draft.id && (
                <button
                  type="button"
                  onClick={handleDeleteSaved}
                  className={`${BTN_SECONDARY} text-rose-700 border-rose-200 hover:bg-rose-50`}
                >
                  Hapus
                </button>
              )}
            </div>
          </div>

          {/* Nomor NP diletakkan tepat di atas Tanggal */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label htmlFor="manual-np-number" className="text-xs font-medium text-slate-700">
                Nomor NP
              </label>
              {draft.poNumber.trim() !== suggestedPoNumber && (
                <button
                  type="button"
                  onClick={handleFollowDateNumber}
                  className={`text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer rounded-sm ${FOCUS_RING}`}
                >
                  Ikuti nomor tanggal ({suggestedPoNumber})
                </button>
              )}
            </div>
            <input
              id="manual-np-number"
              type="text"
              value={draft.poNumber}
              onChange={e => handlePoNumberChange(e.target.value)}
              placeholder="NO. NP/SPPG/185/XI/2026"
              className={`${FIELD_INPUT} font-mono font-semibold`}
            />
          </div>

          {/* Tanggal pengiriman, jam opsional, dan tanggal tanda tangan */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="manual-np-date" className={FIELD_LABEL}>
                Tanggal pengiriman
              </label>
              <input
                id="manual-np-date"
                type="date"
                value={draft.date}
                onChange={e => handleDateChange(e.target.value)}
                className={`${FIELD_INPUT} font-mono`}
              />
            </div>
            <div>
              <label htmlFor="manual-np-time" className={FIELD_LABEL}>
                Keterangan jam (opsional)
              </label>
              <input
                id="manual-np-time"
                type="text"
                value={draft.deliveryTimeNote}
                onChange={e => setDraft(prev => ({ ...prev, deliveryTimeNote: e.target.value }))}
                placeholder="(Jam 15.20)"
                className={FIELD_INPUT}
              />
            </div>
            <div>
              <div className="flex items-center justify-between gap-1 mb-1">
                <label htmlFor="manual-np-signdate" className="text-xs font-medium text-slate-700">
                  Tanggal tanda tangan
                </label>
                {draft.signDate !== draft.date && (
                  <button
                    type="button"
                    onClick={() => setDraft(prev => ({ ...prev, signDate: prev.date, signDateCustomized: false }))}
                    className={`text-[11px] font-semibold text-emerald-700 hover:underline cursor-pointer rounded-sm ${FOCUS_RING}`}
                  >
                    Samakan
                  </button>
                )}
              </div>
              <input
                id="manual-np-signdate"
                type="date"
                value={draft.signDate}
                onChange={e =>
                  setDraft(prev => ({
                    ...prev,
                    signDate: e.target.value || prev.date,
                    signDateCustomized: true,
                  }))
                }
                className={`${FIELD_INPUT} font-mono`}
              />
            </div>
          </div>

          {/* Pemilihan Supplier Terpadu */}
          <div className="pt-2 border-t border-slate-200 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-3">
              <div>
                <label htmlFor="manual-np-supplier" className={FIELD_LABEL}>
                  Kepada (supplier)
                </label>
                <SearchPicker
                  id="manual-np-supplier"
                  allowCustom
                  value={draft.supplierName}
                  options={supplierOptions}
                  onSelect={(opt, text) => handleSupplierSelect(opt ? opt.value : null, text)}
                  placeholder="Pilih dari daftar atau ketik supplier..."
                  searchPlaceholder="Cari supplier atau ketik nama baru..."
                  noun="supplier"
                />
              </div>
              <div>
                <label htmlFor="manual-np-from" className={FIELD_LABEL}>
                  Dari
                </label>
                <input
                  id="manual-np-from"
                  type="text"
                  value={draft.fromName}
                  onChange={e => setDraft(prev => ({ ...prev, fromName: e.target.value }))}
                  className={FIELD_INPUT}
                />
              </div>
            </div>

            <div>
              <label htmlFor="manual-np-address" className={FIELD_LABEL}>
                Alamat supplier
              </label>
              <input
                id="manual-np-address"
                type="text"
                value={draft.supplierAddress}
                onChange={e => setDraft(prev => ({ ...prev, supplierAddress: e.target.value }))}
                placeholder="Terisi otomatis dari Master Supplier, atau ketik manual"
                className={FIELD_INPUT}
              />
            </div>
          </div>
        </section>

        {/* Bagian 2: Tabel Spreadsheet Rincian Barang */}
        <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Rincian bahan &amp; barang
                {filledRowCount > 0 && <span className="font-normal text-slate-500"> ({filledRowCount} terisi)</span>}
              </h2>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Gunakan tombol panah (atas, bawah, kiri, kanan), Tab, atau Enter untuk berpindah antar sel dan baris.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-300 overflow-x-auto bg-white">
            <table className="w-full min-w-[500px] table-fixed text-left text-xs border-collapse">
              <colgroup>
                <col className="w-8" />
                <col />
                <col className="w-[74px]" />
                <col className="w-[68px]" />
                <col className="w-[104px]" />
                <col className="w-[96px]" />
                <col className="w-8" />
              </colgroup>
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-300 select-none">
                <tr className="divide-x divide-slate-200">
                  <th className="py-2 px-1.5 text-center">No</th>
                  <th className="py-2 px-2.5">Uraian bahan / barang</th>
                  <th className="py-2 px-2 text-right">Qty</th>
                  <th className="py-2 px-2">Satuan</th>
                  <th className="py-2 px-2 text-right">Harga (Rp)</th>
                  <th className="py-2 px-2 text-right">Jumlah</th>
                  <th className="py-2 px-1">
                    <span className="sr-only">Hapus</span>
                  </th>
                </tr>
              </thead>
              <tbody
                ref={tbodyRef}
                onKeyDownCapture={handleSpreadsheetKeyDown}
                className="divide-y divide-slate-200"
              >
                {draft.items.map((line, idx) => {
                  const rowSubtotal = lineTotals[idx] || 0;
                  return (
                    <tr key={line.id} className="divide-x divide-slate-200 focus-within:bg-slate-50/40">
                      <td className="py-0 px-1 text-center font-mono text-[11px] text-slate-500 bg-slate-50/50 select-none tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="p-0">
                        <input
                          type="text"
                          autoComplete="off"
                          data-grid-row={idx}
                          data-grid-col={0}
                          aria-label={`Uraian bahan baris ${idx + 1}`}
                          value={line.name}
                          onChange={e => handleLineChange(line.id, idx, 'name', e.target.value, e.currentTarget)}
                          onBlur={() => {
                            handleEnsureDefaultUnit(line.id);
                            closeSuggest();
                          }}
                          placeholder="Nama bahan atau barang..."
                          className={CELL_INPUT}
                        />
                      </td>
                      <td className="p-0">
                        <input
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          data-grid-row={idx}
                          data-grid-col={1}
                          aria-label={`Banyaknya baris ${idx + 1}`}
                          value={line.qty}
                          onChange={e => handleLineChange(line.id, idx, 'qty', e.target.value)}
                          onFocus={closeSuggest}
                          onBlur={() => handleEnsureDefaultUnit(line.id)}
                          placeholder="0"
                          className={`${CELL_INPUT} text-right font-mono tabular-nums`}
                        />
                      </td>
                      <td className="p-0">
                        <input
                          type="text"
                          autoComplete="off"
                          data-grid-row={idx}
                          data-grid-col={2}
                          aria-label={`Satuan baris ${idx + 1}`}
                          value={line.unit}
                          onChange={e => handleLineChange(line.id, idx, 'unit', e.target.value, e.currentTarget)}
                          onBlur={closeSuggest}
                          placeholder="Kg"
                          className={CELL_INPUT}
                        />
                      </td>
                      <td className="p-0">
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          data-grid-row={idx}
                          data-grid-col={3}
                          aria-label={`Harga satuan baris ${idx + 1}`}
                          value={line.unitPrice}
                          onChange={e => handleLineChange(line.id, idx, 'unitPrice', e.target.value)}
                          onFocus={closeSuggest}
                          placeholder="0"
                          className={`${CELL_INPUT} text-right font-mono tabular-nums`}
                        />
                      </td>
                      <td className="py-0 px-2 text-right font-mono font-semibold text-slate-900 bg-slate-50/60 tabular-nums select-none">
                        {rowSubtotal > 0 ? rowSubtotal.toLocaleString('id-ID') : '-'}
                      </td>
                      <td className="p-0 text-center bg-slate-50/30">
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => handleRemoveLine(line.id)}
                          aria-label={`Hapus baris ${line.name || idx + 1}`}
                          title="Hapus baris"
                          className={`inline-flex items-center justify-center w-full h-11 sm:h-9 text-slate-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer transition-colors ${FOCUS_RING}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <button type="button" onClick={handleAddLine} className={BTN_SECONDARY}>
              <Plus className="w-3.5 h-3.5 text-slate-600" />
              Tambah baris
            </button>
            <div className="flex items-baseline gap-2.5 ml-auto">
              <span className="text-xs font-medium text-slate-600">Total pesanan</span>
              <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                Rp {grandTotal.toLocaleString('id-ID')}
              </span>
            </div>
          </div>
        </section>

        {/* Bagian 3: Format Kertas & Penandatangan */}
        <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-3.5">
          <div>
            <span className={FIELD_LABEL} id="manual-np-layout-label">
              Format cetak kertas A4
            </span>
            <div
              role="radiogroup"
              aria-labelledby="manual-np-layout-label"
              className="flex p-0.5 rounded-lg bg-slate-100 border border-slate-200"
            >
              <button
                type="button"
                role="radio"
                aria-checked={draft.printLayout === 'SINGLE'}
                onClick={() => setDraft(prev => ({ ...prev, printLayout: 'SINGLE' }))}
                className={segmentBtn(draft.printLayout === 'SINGLE')}
              >
                1 lembar penuh
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={draft.printLayout === 'DOUBLE'}
                onClick={() => setDraft(prev => ({ ...prev, printLayout: 'DOUBLE' }))}
                className={segmentBtn(draft.printLayout === 'DOUBLE')}
              >
                2 rangkap per A4 (arsip &amp; rekanan)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="manual-np-signer-name" className={FIELD_LABEL}>
                Nama penandatangan
              </label>
              <input
                id="manual-np-signer-name"
                type="text"
                value={draft.signerName}
                onChange={e => setDraft(prev => ({ ...prev, signerName: e.target.value }))}
                className={FIELD_INPUT}
              />
            </div>
            <div>
              <label htmlFor="manual-np-role1" className={FIELD_LABEL}>
                Jabatan baris 1 &amp; 2
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  id="manual-np-role1"
                  type="text"
                  aria-label="Jabatan baris 1"
                  value={draft.signerRole1}
                  onChange={e => setDraft(prev => ({ ...prev, signerRole1: e.target.value }))}
                  className={FIELD_INPUT}
                />
                <input
                  type="text"
                  aria-label="Jabatan baris 2"
                  value={draft.signerRole2}
                  onChange={e => setDraft(prev => ({ ...prev, signerRole2: e.target.value }))}
                  className={FIELD_INPUT}
                />
              </div>
            </div>
          </div>

          <DocSignatureToggle doc="po-nota" />
        </section>
      </div>

      {/* Popover saran bahan / satuan yang ringkas & bersih (hanya muncul saat mengetik) */}
      {isSuggestOpen &&
        suggestTarget &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              left: suggestPos.left,
              width: suggestPos.width,
              top: suggestPos.top,
              bottom: suggestPos.bottom,
              zIndex: 80,
            }}
            className="bg-white rounded-lg border border-slate-200 shadow-lg overflow-hidden text-xs no-print"
          >
            <ul ref={suggestListRef} role="listbox" className="max-h-48 overflow-y-auto py-1 divide-y divide-slate-100">
              {suggestOptions.map((opt, idx) => {
                const active = idx === suggestIndex;
                return (
                  <li
                    key={opt.value}
                    data-suggest-idx={idx}
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => setSuggestIndex(idx)}
                    onMouseDown={e => {
                      e.preventDefault();
                      applySuggestion(suggestTarget.rowIdx, suggestTarget.colIdx, opt.value);
                    }}
                    className={`flex items-center justify-between gap-3 px-2.5 py-1.5 cursor-pointer transition-colors ${
                      active ? 'bg-emerald-50 text-emerald-900 font-medium' : 'text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <span className="min-w-0 truncate">{opt.value}</span>
                    {opt.hint && (
                      <span className="shrink-0 text-[11px] text-slate-500 font-mono tabular-nums">{opt.hint}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body
        )}

      {/* Kolom Kanan: Pratinjau Kertas A4 (ikut tercetak lewat #print-area) */}
      <div
        id="print-area"
        className={
          draft.printLayout === 'SINGLE'
            ? 'bg-white rounded-xl border border-slate-200 overflow-x-auto min-h-[880px]'
            : 'flex flex-col gap-3'
        }
      >
        {draft.printLayout === 'SINGLE' ? (
          renderNotaCard(undefined, false)
        ) : (
          <>
            {renderNotaCard('Lembar 1: Arsip SPPG / Pembeli', true)}
            <div className="py-1 flex items-center justify-center gap-2 text-[10px] text-slate-500 font-mono select-none cut-line-print">
              <Scissors className="w-3.5 h-3.5 rotate-90 shrink-0 text-slate-500" />
              <span className="border-b border-dashed border-slate-400 flex-1" />
              <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-700 text-[9.5px] font-sans font-medium">
                Batas potong kertas A5
              </span>
              <span className="border-b border-dashed border-slate-400 flex-1" />
              <Scissors className="w-3.5 h-3.5 -rotate-90 shrink-0 text-slate-500" />
            </div>
            {renderNotaCard('Lembar 2: Pihak Rekanan / Supplier', true)}
          </>
        )}
      </div>
    </div>
  );
};

export const ManualNotaModule: React.FC = () => {
  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          nav, header, footer, .no-print {
            display: none !important;
          }
          body, #root, #root > div, main {
            background: #ffffff !important;
            color: #000000 !important;
            padding: 0 !important;
            margin: 0 !important;
            max-width: none !important;
            min-height: 0 !important;
          }
          #print-area {
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
          }
        }
      `}</style>

      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Nota Pesanan Manual</h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Buat, simpan, dan cetak Nota Pesanan Bahan Makanan dan Operasional tanpa memengaruhi antrean stok gudang.
            </p>
          </div>
          <button type="button" onClick={() => window.print()} className={`${BTN_PRIMARY} shrink-0`}>
            Cetak A4
          </button>
        </div>
      </div>

      <ManualNotaPesananDoc />
    </div>
  );
};
