import React, { useEffect, useMemo, useState } from 'react';
import { Printer, X } from 'lucide-react';
import {
  MenuOrder,
  PurchaseOrderItem,
  PurchaseOrderNota,
  ReceivingDocument,
  User,
} from '../types/warehouse';
import { warehouseDb } from '../db/storage';
import { localDateIso } from '../utils/localDate';
import { isExtraCostPoItem } from '../utils/extraCosts';
import { angkaTerbilang } from './ToolsPrintModule';
import { SppgLogo } from './SppgLogo';
import { KopText } from './common/KopText';
import { DocSignatureToggle, OfficerSignatureImg } from './common/OfficerSignatureImg';
import { Select } from './common/Select';
import { BTN_PRIMARY, FIELD_INPUT, FOCUS_RING } from './common/FormDialog';

interface ReceivingPoReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchaseOrders: PurchaseOrderNota[];
  receivings: ReceivingDocument[];
  currentUser: User;
  initialStartDate?: string;
  initialEndDate?: string;
}

type StatusScope = 'COMPLETED' | 'ALL';
type ReportViewMode = 'DETAIL' | 'SUMMARY';
type PaperOrientation = 'portrait' | 'landscape';
type QuickPreset = 'TODAY' | 'LAST_7' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM';

const formatLongDate = (iso?: string): string => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso || '-';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const formatDateWithDay = (iso?: string): string => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso || '-';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const formatRp = (n: number): string => `Rp ${Math.round(Number(n) || 0).toLocaleString('id-ID')}`;

const formatNum = (n: number): string =>
  Number.isFinite(n) ? n.toLocaleString('id-ID', { maximumFractionDigits: 2 }) : '0';

const parseQtyString = (raw?: string): { qty: number; unit: string } | null => {
  if (!raw) return null;
  const m = raw.trim().match(/^([\d.,]+)\s*(.*)$/);
  if (!m) return null;
  const qty = parseFloat(m[1].replace(',', '.'));
  if (!Number.isFinite(qty)) return null;
  return { qty, unit: (m[2] || '').trim() };
};

// Gabungkan satuan berat/volume agar rekap timbangan akurat (gram → kg, ml → liter), satuan kemasan tetap utuh.
const normalizeForWeightSummary = (qty: number, rawUnit: string): { qty: number; unit: string; priority: number } => {
  const u = (rawUnit || '').trim().toLowerCase();
  if (u === 'kg' || u === 'kilogram') return { qty, unit: 'kg', priority: 1 };
  if (u === 'gr' || u === 'g' || u === 'gram') return { qty: qty / 1000, unit: 'kg', priority: 1 };
  if (u === 'ons') return { qty: qty / 10, unit: 'kg', priority: 1 };
  if (u === 'l' || u === 'lt' || u === 'ltr' || u === 'liter') return { qty, unit: 'liter', priority: 2 };
  if (u === 'ml' || u === 'mililiter') return { qty: qty / 1000, unit: 'liter', priority: 2 };
  const cleanLabel = (rawUnit || 'unit').trim();
  return { qty, unit: cleanLabel.toLowerCase(), priority: 3 };
};

const accumulateUnits = (
  entries: Array<{ qty: number; unit: string }>
): Array<{ unit: string; total: number; priority: number }> => {
  const map = new Map<string, { label: string; total: number; priority: number }>();
  entries.forEach(({ qty, unit }) => {
    if (!Number.isFinite(qty) || qty <= 0) return;
    const norm = normalizeForWeightSummary(qty, unit);
    const key = norm.unit.toLowerCase();
    const prev = map.get(key);
    const label = norm.priority <= 2 ? norm.unit : (prev?.label || unit.trim() || norm.unit);
    map.set(key, {
      label,
      total: (prev?.total || 0) + norm.qty,
      priority: norm.priority,
    });
  });
  return Array.from(map.values())
    .map(v => ({ unit: v.label, total: Math.round(v.total * 1000) / 1000, priority: v.priority }))
    .sort((a, b) => a.priority - b.priority || b.total - a.total);
};

const formatUnitSummary = (totals: Array<{ unit: string; total: number }>): string => {
  if (totals.length === 0) return '-';
  return totals.map(t => `${formatNum(t.total)} ${t.unit}`).join(', ');
};

interface EnrichedItemRow {
  id: string;
  name: string;
  category: string;
  orderedQty?: number;
  orderedUnit?: string;
  receivedQty: number;
  receivedUnit: string;
  diffText: string;
  diffTone: 'neutral' | 'plus' | 'minus';
  unitPrice: number;
  subtotal: number;
  notes?: string;
}

interface EnrichedPoRecord {
  po: PurchaseOrderNota;
  effectiveDate: string;
  receivingDoc?: ReceivingDocument;
  menuOrder?: MenuOrder;
  isCompleted: boolean;
  materialRows: EnrichedItemRow[];
  extraCostRows: PurchaseOrderItem[];
  materialTotal: number;
  extraCostTotal: number;
  grandTotal: number;
  unitTotals: Array<{ unit: string; total: number; priority: number }>;
}

export const ReceivingPoReportModal: React.FC<ReceivingPoReportModalProps> = ({
  isOpen,
  onClose,
  purchaseOrders,
  receivings,
  currentUser,
  initialStartDate,
  initialEndDate,
}) => {
  const todayIso = useMemo(() => localDateIso(), []);
  const monthStartIso = useMemo(() => {
    const d = new Date();
    return localDateIso(new Date(d.getFullYear(), d.getMonth(), 1));
  }, []);

  const [dateFrom, setDateFrom] = useState<string>(initialStartDate || monthStartIso);
  const [dateTo, setDateTo] = useState<string>(initialEndDate || todayIso);
  const [activePreset, setActivePreset] = useState<QuickPreset>('CUSTOM');
  const [statusScope, setStatusScope] = useState<StatusScope>('COMPLETED');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<ReportViewMode>('DETAIL');
  const [orientation, setOrientation] = useState<PaperOrientation>('portrait');

  useEffect(() => {
    if (!isOpen) return;
    if (initialStartDate) setDateFrom(initialStartDate);
    if (initialEndDate) setDateTo(initialEndDate);
    setActivePreset('CUSTOM');
  }, [isOpen, initialStartDate, initialEndDate]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const applyPreset = (preset: Exclude<QuickPreset, 'CUSTOM'>) => {
    const now = new Date();
    setActivePreset(preset);
    if (preset === 'TODAY') {
      const iso = localDateIso(now);
      setDateFrom(iso);
      setDateTo(iso);
      return;
    }
    if (preset === 'LAST_7') {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      setDateFrom(localDateIso(start));
      setDateTo(localDateIso(now));
      return;
    }
    if (preset === 'THIS_MONTH') {
      setDateFrom(localDateIso(new Date(now.getFullYear(), now.getMonth(), 1)));
      setDateTo(localDateIso(now));
      return;
    }
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    setDateFrom(localDateIso(prevStart));
    setDateTo(localDateIso(prevEnd));
  };

  const handlePrint = () => {
    window.print();
  };

  const receivingsById = useMemo(() => {
    const m = new Map<string, ReceivingDocument>();
    receivings.forEach(r => m.set(r.id, r));
    return m;
  }, [receivings]);

  const menuOrdersById = useMemo(() => {
    const m = new Map<string, MenuOrder>();
    warehouseDb.getMenuOrders().forEach(o => m.set(o.id, o));
    return m;
  }, [isOpen, purchaseOrders]);

  const dateScopedPos = useMemo<EnrichedPoRecord[]>(() => {
    const start = dateFrom <= dateTo ? dateFrom : dateTo;
    const end = dateFrom <= dateTo ? dateTo : dateFrom;

    return purchaseOrders
      .filter(po => po.status !== 'DRAFT')
      .map(po => {
        const receivingDoc = po.relatedReceivingId ? receivingsById.get(po.relatedReceivingId) : undefined;
        const effectiveDate = (receivingDoc?.date || po.deliveryDate || po.date || '').slice(0, 10);
        const isCompleted = po.status === 'SELESAI' || po.status === 'DIBAYAR' || Boolean(po.relatedReceivingId);
        return { po, receivingDoc, effectiveDate, isCompleted };
      })
      .filter(({ effectiveDate, isCompleted }) => {
        if (!effectiveDate) return false;
        if (start && effectiveDate < start) return false;
        if (end && effectiveDate > end) return false;
        if (statusScope === 'COMPLETED' && !isCompleted) return false;
        return true;
      })
      .map(({ po, receivingDoc, effectiveDate, isCompleted }) => {
        const menuOrder = po.relatedMenuOrderId ? menuOrdersById.get(po.relatedMenuOrderId) : undefined;
        const arrivalMap = new Map<string, { qtyOrder?: string }>();
        const supLower = (po.supplierName || '').trim().toLowerCase();
        (menuOrder?.poArrivalItems || []).forEach(arr => {
          const arrSup = (arr.supplier || '').trim().toLowerCase();
          if (!arrSup || arrSup === supLower) {
            arrivalMap.set(arr.itemName.trim().toLowerCase(), { qtyOrder: arr.qtyOrder });
          }
        });

        const recLinesByItem = new Map<string, { quantity: number; unit: string; conditionNote?: string }>();
        (receivingDoc?.lines || []).forEach(line => {
          recLinesByItem.set(line.itemName.trim().toLowerCase(), {
            quantity: Number(line.quantity) || 0,
            unit: line.unit,
            conditionNote: line.conditionNote,
          });
        });

        const materialItems = (po.items || []).filter(it => !isExtraCostPoItem(it));
        const extraCostRows = (po.items || []).filter(isExtraCostPoItem);

        const materialRows: EnrichedItemRow[] = materialItems.map((it, idx) => {
          const key = it.name.trim().toLowerCase();
          const recLine = recLinesByItem.get(key);
          const receivedQty = isCompleted ? (recLine ? recLine.quantity : Number(it.quantity) || 0) : Number(it.quantity) || 0;
          const receivedUnit = (isCompleted && recLine?.unit) || it.unit || '';

          const orderedParsed = parseQtyString(arrivalMap.get(key)?.qtyOrder);
          let diffText = '-';
          let diffTone: 'neutral' | 'plus' | 'minus' = 'neutral';
          if (isCompleted && orderedParsed) {
            const ordNorm = normalizeForWeightSummary(orderedParsed.qty, orderedParsed.unit);
            const recNorm = normalizeForWeightSummary(receivedQty, receivedUnit);
            if (ordNorm.unit === recNorm.unit) {
              const delta = Math.round((recNorm.qty - ordNorm.qty) * 1000) / 1000;
              if (Math.abs(delta) > 0.0001) {
                diffText = `${delta > 0 ? '+' : ''}${formatNum(delta)} ${recNorm.unit}`;
                diffTone = delta > 0 ? 'plus' : 'minus';
              } else {
                diffText = 'Sesuai';
              }
            }
          }

          const unitPrice = Number(it.unitPrice) || 0;
          const subtotal = Number(it.subtotal) || Math.round(receivedQty * unitPrice);
          const conditionText = recLine?.conditionNote || it.notes || '';

          return {
            id: it.id || `${po.id}-${idx}`,
            name: it.name,
            category: it.category || '-',
            orderedQty: orderedParsed?.qty,
            orderedUnit: orderedParsed?.unit,
            receivedQty,
            receivedUnit,
            diffText,
            diffTone,
            unitPrice,
            subtotal,
            notes: conditionText.replace(/^Estimasi tiba:\s*[\d.:]+\s*\|?\s*/i, '').trim() || undefined,
          };
        });

        const materialTotal = materialRows.reduce((s, r) => s + r.subtotal, 0);
        const extraCostTotal = extraCostRows.reduce((s, c) => s + (Number(c.subtotal) || Number(c.unitPrice) || 0), 0);
        const grandTotal = Number(po.grandTotal) || materialTotal + extraCostTotal;
        const unitTotals = accumulateUnits(materialRows.map(r => ({ qty: r.receivedQty, unit: r.receivedUnit })));

        return {
          po,
          effectiveDate,
          receivingDoc,
          menuOrder,
          isCompleted,
          materialRows,
          extraCostRows,
          materialTotal,
          extraCostTotal,
          grandTotal,
          unitTotals,
        };
      })
      .sort(
        (a, b) =>
          a.effectiveDate.localeCompare(b.effectiveDate) ||
          (a.po.poNumber || '').localeCompare(b.po.poNumber || '') ||
          (a.po.supplierName || '').localeCompare(b.po.supplierName || '', 'id')
      );
  }, [purchaseOrders, receivingsById, menuOrdersById, dateFrom, dateTo, statusScope]);

  const supplierOptions = useMemo(() => {
    const names = Array.from(new Set(dateScopedPos.map(r => r.po.supplierName || 'Tanpa Supplier')));
    return names.sort((a, b) => a.localeCompare(b, 'id'));
  }, [dateScopedPos]);

  useEffect(() => {
    if (selectedSupplier !== 'ALL' && !supplierOptions.includes(selectedSupplier)) {
      setSelectedSupplier('ALL');
    }
  }, [selectedSupplier, supplierOptions]);

  const filteredPos = useMemo(
    () =>
      selectedSupplier === 'ALL'
        ? dateScopedPos
        : dateScopedPos.filter(r => (r.po.supplierName || 'Tanpa Supplier') === selectedSupplier),
    [dateScopedPos, selectedSupplier]
  );

  const summary = useMemo(() => {
    let totalNominal = 0;
    let totalExtraCost = 0;
    let totalItems = 0;
    let completedCount = 0;
    let pendingCount = 0;
    const allUnits: Array<{ qty: number; unit: string }> = [];
    const bySupplierMap = new Map<
      string,
      {
        supplierName: string;
        poCount: number;
        itemCount: number;
        totalNominal: number;
        units: Array<{ qty: number; unit: string }>;
      }
    >();

    filteredPos.forEach(rec => {
      totalNominal += rec.grandTotal;
      totalExtraCost += rec.extraCostTotal;
      totalItems += rec.materialRows.length;
      if (rec.isCompleted) completedCount += 1;
      else pendingCount += 1;

      const supName = rec.po.supplierName || 'Tanpa Supplier';
      const entry = bySupplierMap.get(supName) || {
        supplierName: supName,
        poCount: 0,
        itemCount: 0,
        totalNominal: 0,
        units: [],
      };
      entry.poCount += 1;
      entry.itemCount += rec.materialRows.length;
      entry.totalNominal += rec.grandTotal;
      rec.materialRows.forEach(row => {
        const u = { qty: row.receivedQty, unit: row.receivedUnit };
        allUnits.push(u);
        entry.units.push(u);
      });
      bySupplierMap.set(supName, entry);
    });

    const bySupplier = Array.from(bySupplierMap.values())
      .map(s => ({ ...s, unitTotals: accumulateUnits(s.units) }))
      .sort((a, b) => b.totalNominal - a.totalNominal);

    const byDateMap = new Map<string, EnrichedPoRecord[]>();
    filteredPos.forEach(rec => {
      const list = byDateMap.get(rec.effectiveDate) || [];
      list.push(rec);
      byDateMap.set(rec.effectiveDate, list);
    });
    const byDate = Array.from(byDateMap.entries()).map(([date, records]) => ({
      date,
      records,
      dayTotal: records.reduce((sum, r) => sum + r.grandTotal, 0),
      dayItems: records.reduce((sum, r) => sum + r.materialRows.length, 0),
    }));

    return {
      totalNominal,
      totalExtraCost,
      totalItems,
      completedCount,
      pendingCount,
      supplierCount: bySupplier.length,
      unitTotals: accumulateUnits(allUnits),
      bySupplier,
      byDate,
    };
  }, [filteredPos]);

  if (!isOpen) return null;

  const displayStart = dateFrom <= dateTo ? dateFrom : dateTo;
  const displayEnd = dateFrom <= dateTo ? dateTo : dateFrom;
  const periodLabel =
    displayStart === displayEnd
      ? formatLongDate(displayStart)
      : `${formatLongDate(displayStart)} s/d ${formatLongDate(displayEnd)}`;
  const accountantName = warehouseDb.getSignerName('AKUNTAN');
  const headOfficeName = warehouseDb.getSignerName('KEPALA_SPPG');

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/55 flex items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receiving-po-report-title"
    >
      {/* Pola isolasi cetak yang sama dengan NotaPesananModal & MenuOrdersModule:
          membuka posisi/overflow seluruh leluhur agar kertas A4 mengalir multi-halaman tanpa terpotong. */}
      <style>{`
        @media print {
          @page {
            size: A4 ${orientation};
            margin: 10mm;
          }
          html, body {
            overflow: visible !important;
            height: auto !important;
            background: #ffffff !important;
          }
          body *:not(:has(#print-receiving-po-report)):not(#print-receiving-po-report):not(#print-receiving-po-report *) {
            display: none !important;
          }
          body *:has(#print-receiving-po-report) {
            position: static !important;
            display: block !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            min-height: 0 !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            border-radius: 0 !important;
            background: #ffffff !important;
            box-shadow: none !important;
            animation: none !important;
            transform: none !important;
          }
          #print-receiving-po-report {
            position: static !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: #ffffff !important;
            color: #0f172a !important;
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }
          #print-receiving-po-report thead {
            display: table-header-group;
          }
          #print-receiving-po-report tfoot {
            display: table-row-group;
          }
          #print-receiving-po-report tr,
          #print-receiving-po-report .report-avoid-break {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-6xl w-full max-h-[94dvh] flex flex-col overflow-hidden">
        {/* Header & Bilah Pengaturan (tidak ikut tercetak) */}
        <div className="no-print border-b border-slate-200 bg-white shrink-0">
          <div className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 id="receiving-po-report-title" className="text-sm font-bold text-slate-900">
                Laporan Penerimaan PO
              </h2>
              <p className="text-xs text-slate-600 mt-0.5 truncate">
                {filteredPos.length > 0
                  ? `${filteredPos.length} PO · ${summary.totalItems} bahan · ${formatRp(summary.totalNominal)}`
                  : 'Pilih rentang tanggal untuk menampilkan laporan PO'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handlePrint}
                disabled={filteredPos.length === 0}
                className={`${BTN_PRIMARY} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Printer className="w-4 h-4" />
                <span>Cetak / PDF</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup laporan"
                className={`inline-flex items-center justify-center w-10 h-10 sm:w-9 sm:h-9 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer ${FOCUS_RING}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Kontrol ringkas: rentang tanggal, preset, filter, dan format kertas */}
          <div className="px-4 sm:px-5 py-2.5 bg-slate-50 border-t border-slate-200 space-y-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex p-0.5 rounded-lg bg-slate-200/70">
                {([
                  ['TODAY', 'Hari ini'],
                  ['LAST_7', '7 hari'],
                  ['THIS_MONTH', 'Bulan ini'],
                  ['LAST_MONTH', 'Bulan lalu'],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyPreset(key)}
                    className={`px-2.5 min-h-[30px] rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${FOCUS_RING} ${
                      activePreset === key
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <input
                  id="po-rep-from"
                  type="date"
                  aria-label="Dari tanggal"
                  value={dateFrom}
                  onChange={e => {
                    setDateFrom(e.target.value);
                    setActivePreset('CUSTOM');
                  }}
                  className={`${FIELD_INPUT} w-auto !min-h-[32px] font-mono`}
                />
                <span className="text-slate-500">s/d</span>
                <input
                  id="po-rep-to"
                  type="date"
                  aria-label="Sampai tanggal"
                  value={dateTo}
                  onChange={e => {
                    setDateTo(e.target.value);
                    setActivePreset('CUSTOM');
                  }}
                  className={`${FIELD_INPUT} w-auto !min-h-[32px] font-mono`}
                />
              </div>

              <Select
                size="sm"
                aria-label="Filter supplier"
                value={selectedSupplier}
                onChange={e => setSelectedSupplier(e.target.value)}
              >
                <option value="ALL">Semua supplier ({supplierOptions.length})</option>
                {supplierOptions.map(sup => (
                  <option key={sup} value={sup}>{sup}</option>
                ))}
              </Select>

              <Select
                size="sm"
                aria-label="Cakupan status PO"
                value={statusScope}
                onChange={e => setStatusScope(e.target.value as StatusScope)}
              >
                <option value="COMPLETED">Sudah diterima</option>
                <option value="ALL">Semua PO</option>
              </Select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-200/70">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex p-0.5 rounded-lg bg-slate-200/70" role="tablist" aria-label="Tampilan laporan">
                  {([
                    ['DETAIL', 'Rinci per bahan'],
                    ['SUMMARY', 'Ringkas per PO'],
                  ] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      role="tab"
                      aria-selected={viewMode === mode}
                      onClick={() => setViewMode(mode)}
                      className={`px-2.5 min-h-[28px] rounded-md text-[11px] font-semibold cursor-pointer ${FOCUS_RING} ${
                        viewMode === mode ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="inline-flex p-0.5 rounded-lg bg-slate-200/70" role="tablist" aria-label="Orientasi kertas">
                  {([
                    ['portrait', 'A4 Tegak'],
                    ['landscape', 'A4 Mendatar'],
                  ] as const).map(([orient, label]) => (
                    <button
                      key={orient}
                      type="button"
                      role="tab"
                      aria-selected={orientation === orient}
                      onClick={() => setOrientation(orient)}
                      className={`px-2.5 min-h-[28px] rounded-md text-[11px] font-semibold cursor-pointer ${FOCUS_RING} ${
                        orientation === orient ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <DocSignatureToggle doc="laporan-penerimaan-po" />
            </div>
          </div>
        </div>

        {/* Pratinjau Kertas A4 */}
        <div className="flex-1 overflow-auto bg-slate-200/70 p-3 sm:p-6">
          <div
            id="print-receiving-po-report"
            className={`bg-white mx-auto border border-slate-300 shadow-xs p-6 sm:p-9 text-slate-900 ${
              orientation === 'landscape' ? 'max-w-[1040px]' : 'max-w-[800px]'
            }`}
          >
            {/* Kop Surat Resmi SPPG */}
            <div className="flex items-center justify-between gap-4 border-b-2 border-slate-900 pb-3 mb-4">
              <div className="flex items-center gap-3">
                <SppgLogo size="md" variant="color" showText={false} />
                <KopText />
              </div>
              <div className="text-right text-[10px] font-mono text-slate-600 shrink-0 leading-relaxed">
                <div>Laporan Penerimaan PO</div>
                <div>Dicetak {formatLongDate(todayIso)}</div>
              </div>
            </div>

            {/* Judul Dokumen */}
            <div className="text-center mb-4">
              <h3 className="text-sm font-bold text-slate-900">
                Laporan Rekapitulasi Penerimaan &amp; Penimbangan PO Bahan
              </h3>
              <p className="text-xs text-slate-700 mt-0.5">
                Periode {periodLabel}
                {selectedSupplier !== 'ALL' ? ` · Supplier: ${selectedSupplier}` : ''}
              </p>
            </div>

            {filteredPos.length === 0 ? (
              <div className="border border-slate-300 py-10 px-6 text-center my-6">
                <p className="text-sm font-semibold text-slate-800">Tidak ada data PO pada rentang tanggal ini.</p>
                <p className="text-xs text-slate-600 mt-1">
                  Sesuaikan tanggal, pilihan supplier, atau ganti cakupan ke &ldquo;Semua PO&rdquo;.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Ringkasan Dokumen bergaya ledger resmi (bukan kartu dashboard) */}
                <table className="w-full text-xs border-collapse border border-slate-800 report-avoid-break">
                  <tbody>
                    <tr className="border-b border-slate-300">
                      <td className="py-1.5 px-2.5 bg-slate-50 font-semibold text-slate-700 w-36 border-r border-slate-300">
                        Periode laporan
                      </td>
                      <td className="py-1.5 px-2.5 text-slate-900 border-r border-slate-300">
                        {periodLabel} ({summary.byDate.length} hari)
                      </td>
                      <td className="py-1.5 px-2.5 bg-slate-50 font-semibold text-slate-700 w-36 border-r border-slate-300">
                        Total nominal PO
                      </td>
                      <td className="py-1.5 px-2.5 text-right font-mono tabular-nums font-bold text-sm text-slate-900">
                        {formatRp(summary.totalNominal)}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="py-1.5 px-2.5 bg-slate-50 font-semibold text-slate-700 border-r border-slate-300">
                        Cakupan data
                      </td>
                      <td className="py-1.5 px-2.5 text-slate-900 border-r border-slate-300">
                        {filteredPos.length} PO ({summary.completedCount} selesai
                        {summary.pendingCount > 0 ? `, ${summary.pendingCount} menunggu` : ''}) · {summary.supplierCount} supplier · {summary.totalItems} bahan
                      </td>
                      <td className="py-1.5 px-2.5 bg-slate-50 font-semibold text-slate-700 border-r border-slate-300">
                        Biaya tambahan
                      </td>
                      <td className="py-1.5 px-2.5 text-right font-mono tabular-nums text-slate-900">
                        {summary.totalExtraCost > 0 ? formatRp(summary.totalExtraCost) : '-'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2.5 bg-slate-50 font-semibold text-slate-700 border-r border-slate-300 align-top">
                        Total timbangan
                      </td>
                      <td colSpan={3} className="py-1.5 px-2.5 font-mono tabular-nums text-[11px] font-semibold text-slate-900">
                        {formatUnitSummary(summary.unitTotals)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Bagian 1: Rekap per Supplier */}
                <section className="report-avoid-break">
                  <h4 className="text-xs font-bold text-slate-900 mb-1.5">
                    1. Rekapitulasi per Supplier
                  </h4>
                  <table className="w-full text-left text-[11px] border-collapse border border-slate-800">
                    <thead>
                      <tr className="bg-slate-100 text-slate-900 font-semibold border-b border-slate-800">
                        <th className="py-1.5 px-2 border-r border-slate-400 w-8 text-center">No</th>
                        <th className="py-1.5 px-2.5 border-r border-slate-400">Supplier</th>
                        <th className="py-1.5 px-2 border-r border-slate-400 w-14 text-center">PO</th>
                        <th className="py-1.5 px-2 border-r border-slate-400 w-16 text-center">Bahan</th>
                        <th className="py-1.5 px-2.5 border-r border-slate-400">Total Timbangan / Volume</th>
                        <th className="py-1.5 px-2.5 w-32 text-right">Total Nominal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300">
                      {summary.bySupplier.map((sup, idx) => (
                        <tr key={sup.supplierName}>
                          <td className="py-1.5 px-2 border-r border-slate-300 text-center font-mono tabular-nums text-slate-700">
                            {idx + 1}
                          </td>
                          <td className="py-1.5 px-2.5 border-r border-slate-300 font-semibold text-slate-900">
                            {sup.supplierName}
                          </td>
                          <td className="py-1.5 px-2 border-r border-slate-300 text-center font-mono tabular-nums">
                            {sup.poCount}
                          </td>
                          <td className="py-1.5 px-2 border-r border-slate-300 text-center font-mono tabular-nums">
                            {sup.itemCount}
                          </td>
                          <td className="py-1.5 px-2.5 border-r border-slate-300 font-mono tabular-nums text-[10.5px] text-slate-800">
                            {formatUnitSummary(sup.unitTotals)}
                          </td>
                          <td className="py-1.5 px-2.5 text-right font-mono tabular-nums font-semibold text-slate-900">
                            {formatRp(sup.totalNominal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-bold text-slate-900 border-t border-slate-800">
                        <td colSpan={2} className="py-1.5 px-2.5 border-r border-slate-400 text-right">
                          Total
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-400 text-center font-mono tabular-nums">
                          {filteredPos.length}
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-400 text-center font-mono tabular-nums">
                          {summary.totalItems}
                        </td>
                        <td className="py-1.5 px-2.5 border-r border-slate-400 font-mono tabular-nums text-[10.5px]">
                          {formatUnitSummary(summary.unitTotals)}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-mono tabular-nums">
                          {formatRp(summary.totalNominal)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </section>

                {/* Bagian 2: Ringkas per PO atau Rinci per Bahan */}
                {viewMode === 'SUMMARY' ? (
                  <section>
                    <h4 className="text-xs font-bold text-slate-900 mb-1.5">
                      2. Daftar Penerimaan PO per Tanggal
                    </h4>
                    <table className="w-full text-left text-[11px] border-collapse border border-slate-800">
                      <thead>
                        <tr className="bg-slate-100 text-slate-900 font-semibold border-b border-slate-800">
                          <th className="py-1.5 px-2 border-r border-slate-400 w-8 text-center">No</th>
                          <th className="py-1.5 px-2 border-r border-slate-400 w-24">Tanggal</th>
                          <th className="py-1.5 px-2 border-r border-slate-400">No. PO &amp; Dokumen</th>
                          <th className="py-1.5 px-2 border-r border-slate-400">Supplier</th>
                          <th className="py-1.5 px-2 border-r border-slate-400 w-14 text-center">Bahan</th>
                          <th className="py-1.5 px-2 border-r border-slate-400">Timbangan / Volume</th>
                          <th className="py-1.5 px-2 border-r border-slate-400 w-18 text-center">Status</th>
                          <th className="py-1.5 px-2 w-28 text-right">Nominal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-300">
                        {filteredPos.map((rec, idx) => (
                          <tr key={rec.po.id}>
                            <td className="py-1.5 px-2 border-r border-slate-300 text-center font-mono tabular-nums">
                              {idx + 1}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-300 font-mono tabular-nums text-[10.5px] whitespace-nowrap">
                              {rec.effectiveDate}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-300">
                              <div className="font-mono text-[10.5px] font-semibold text-slate-900">{rec.po.poNumber}</div>
                              {rec.receivingDoc && (
                                <div className="font-mono text-[10px] text-slate-600">
                                  {rec.receivingDoc.id} · {rec.receivingDoc.arrivalTime?.slice(0, 5) || '-'} WIB
                                </div>
                              )}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-300 font-medium text-slate-900">
                              {rec.po.supplierName}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-300 text-center font-mono tabular-nums">
                              {rec.materialRows.length}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-300 font-mono tabular-nums text-[10.5px]">
                              {formatUnitSummary(rec.unitTotals)}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-300 text-center text-[10.5px]">
                              {rec.isCompleted ? 'Selesai' : 'Menunggu'}
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono tabular-nums font-semibold">
                              {formatRp(rec.grandTotal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-100 font-bold text-slate-900 border-t border-slate-800">
                          <td colSpan={7} className="py-1.5 px-2.5 border-r border-slate-400 text-right">
                            Total Nominal PO
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                            {formatRp(summary.totalNominal)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </section>
                ) : (
                  <section className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-900">
                      2. Rincian Timbangan &amp; Nominal per Tanggal dan PO
                    </h4>

                    {summary.byDate.map(dayGroup => (
                      <div key={dayGroup.date} className="space-y-2.5">
                        <div className="flex items-baseline justify-between gap-2 pb-1 border-b border-slate-900 text-xs">
                          <span className="font-bold text-slate-900">
                            {formatDateWithDay(dayGroup.date)}
                          </span>
                          <span className="font-mono tabular-nums text-[11px] font-semibold text-slate-700">
                            {dayGroup.records.length} PO · {dayGroup.dayItems} bahan · {formatRp(dayGroup.dayTotal)}
                          </span>
                        </div>

                        {dayGroup.records.map(rec => (
                          <div key={rec.po.id} className="border border-slate-700">
                            <div className="px-2.5 py-1.5 bg-slate-50 border-b border-slate-500 flex flex-wrap items-baseline justify-between gap-2 text-[11px]">
                              <div className="space-y-0.5">
                                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                  <span className="font-bold text-slate-900">{rec.po.supplierName}</span>
                                  <span className="font-mono text-slate-700">{rec.po.poNumber}</span>
                                  {rec.receivingDoc && (
                                    <span className="font-mono text-slate-600">({rec.receivingDoc.id})</span>
                                  )}
                                  <span className="text-[10.5px] font-semibold text-slate-700">
                                    · {rec.isCompleted ? 'Selesai diterima' : 'Menunggu kedatangan'}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-600 flex flex-wrap gap-x-3 gap-y-0.5">
                                  {rec.receivingDoc?.arrivalTime && (
                                    <span>Tiba {rec.receivingDoc.arrivalTime.slice(0, 5)} WIB</span>
                                  )}
                                  {rec.receivingDoc?.receiverName && (
                                    <span>Penerima: {rec.receivingDoc.receiverName}</span>
                                  )}
                                  {rec.receivingDoc?.notes && <span>{rec.receivingDoc.notes}</span>}
                                  {rec.menuOrder && <span>Menu {formatDateWithDay(rec.menuOrder.date)}</span>}
                                </div>
                              </div>
                              <div className="text-right font-mono tabular-nums">
                                <span className="font-bold text-slate-900">{formatRp(rec.grandTotal)}</span>
                                <span className="block text-[10px] text-slate-600">
                                  {formatUnitSummary(rec.unitTotals)}
                                </span>
                              </div>
                            </div>

                            <table className="w-full text-left text-[10.5px] border-collapse">
                              <thead>
                                <tr className="bg-white border-b border-slate-400 text-slate-800 font-semibold">
                                  <th className="py-1 px-2 w-7 text-center border-r border-slate-300">No</th>
                                  <th className="py-1 px-2 border-r border-slate-300">Nama Bahan</th>
                                  <th className="py-1 px-2 w-24 border-r border-slate-300 text-right">Pesanan PO</th>
                                  <th className="py-1 px-2 w-28 border-r border-slate-300 text-right">Hasil Timbang</th>
                                  <th className="py-1 px-2 w-20 border-r border-slate-300 text-center">Selisih</th>
                                  <th className="py-1 px-2 w-24 border-r border-slate-300 text-right">Harga Satuan</th>
                                  <th className="py-1 px-2 w-28 text-right">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {rec.materialRows.map((row, idx) => (
                                  <tr key={row.id}>
                                    <td className="py-1 px-2 text-center font-mono tabular-nums text-slate-600 border-r border-slate-200">
                                      {idx + 1}
                                    </td>
                                    <td className="py-1 px-2 border-r border-slate-200">
                                      <span className="font-medium text-slate-900">{row.name}</span>
                                      {row.notes && (
                                        <span className="block text-[9.5px] text-slate-500">{row.notes}</span>
                                      )}
                                    </td>
                                    <td className="py-1 px-2 text-right font-mono tabular-nums text-slate-600 border-r border-slate-200 whitespace-nowrap">
                                      {row.orderedQty !== undefined
                                        ? `${formatNum(row.orderedQty)} ${row.orderedUnit || ''}`
                                        : '-'}
                                    </td>
                                    <td className="py-1 px-2 text-right font-mono tabular-nums font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                                      {rec.isCompleted
                                        ? `${formatNum(row.receivedQty)} ${row.receivedUnit}`
                                        : `${formatNum(row.receivedQty)} ${row.receivedUnit} (rencana)`}
                                    </td>
                                    <td
                                      className={`py-1 px-2 text-center font-mono tabular-nums border-r border-slate-200 whitespace-nowrap ${
                                        row.diffTone === 'plus'
                                          ? 'text-emerald-800 font-semibold'
                                          : row.diffTone === 'minus'
                                            ? 'text-amber-800 font-semibold'
                                            : 'text-slate-500'
                                      }`}
                                    >
                                      {row.diffText}
                                    </td>
                                    <td className="py-1 px-2 text-right font-mono tabular-nums text-slate-700 border-r border-slate-200 whitespace-nowrap">
                                      {row.unitPrice > 0 ? formatRp(row.unitPrice) : '-'}
                                    </td>
                                    <td className="py-1 px-2 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                                      {formatRp(row.subtotal)}
                                    </td>
                                  </tr>
                                ))}

                                {rec.extraCostRows.map(cost => (
                                  <tr key={cost.id} className="bg-slate-50">
                                    <td className="py-1 px-2 text-center text-slate-500 border-r border-slate-200">+</td>
                                    <td colSpan={5} className="py-1 px-2 text-slate-700 italic border-r border-slate-200">
                                      Biaya tambahan: {cost.name}
                                    </td>
                                    <td className="py-1 px-2 text-right font-mono tabular-nums font-semibold text-slate-900">
                                      {formatRp(Number(cost.subtotal) || Number(cost.unitPrice) || 0)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="bg-slate-50 border-t border-slate-400 font-bold text-slate-900">
                                  <td colSpan={6} className="py-1 px-2 text-right border-r border-slate-300">
                                    Subtotal PO {rec.po.supplierName}
                                  </td>
                                  <td className="py-1 px-2 text-right font-mono tabular-nums">
                                    {formatRp(rec.grandTotal)}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        ))}
                      </div>
                    ))}
                  </section>
                )}

                {/* Penutup Total & Terbilang */}
                <div className="border-t-2 border-b border-slate-900 py-2.5 px-2 bg-slate-50/70 report-avoid-break">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      Grand Total ({filteredPos.length} PO · {summary.totalItems} bahan)
                    </span>
                    <span className="text-sm font-bold text-slate-900 font-mono tabular-nums">
                      {formatRp(summary.totalNominal)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-700 mt-1">
                    Terbilang: <span className="italic font-medium text-slate-900">{angkaTerbilang(Math.round(summary.totalNominal))}</span>
                  </div>
                  <div className="text-[11px] text-slate-700 mt-0.5">
                    Rekap timbangan &amp; volume: <span className="font-mono font-semibold text-slate-900">{formatUnitSummary(summary.unitTotals)}</span>
                  </div>
                </div>

                {/* Blok Tanda Tangan Resmi */}
                <div className="grid grid-cols-3 gap-4 pt-5 text-center text-xs report-avoid-break">
                  <div>
                    <p className="text-slate-600">Dibuat oleh,</p>
                    <p className="font-semibold text-slate-900 mt-0.5">Petugas Gudang / Logistik</p>
                    <div className="h-20 flex items-center justify-center">
                      <OfficerSignatureImg doc="laporan-penerimaan-po" officer="ASLAP" forName={currentUser.name} className="h-16" />
                    </div>
                    <p className="font-bold text-slate-900 underline underline-offset-4">
                      {currentUser.name || '...........................'}
                    </p>
                  </div>

                  <div>
                    <p className="text-slate-600">Diperiksa oleh,</p>
                    <p className="font-semibold text-slate-900 mt-0.5">Akuntan SPPG</p>
                    <div className="h-20 flex items-center justify-center">
                      <OfficerSignatureImg doc="laporan-penerimaan-po" officer="AKUNTAN" forName={accountantName} className="h-16" />
                    </div>
                    <p className="font-bold text-slate-900 underline underline-offset-4">
                      {accountantName || '...........................'}
                    </p>
                  </div>

                  <div>
                    <p className="text-slate-600">Malang, {formatLongDate(todayIso)}</p>
                    <p className="font-semibold text-slate-900 mt-0.5">Kepala SPPG</p>
                    <div className="h-20 flex items-center justify-center">
                      <OfficerSignatureImg doc="laporan-penerimaan-po" officer="KEPALA_SPPG" forName={headOfficeName} className="h-16" />
                    </div>
                    <p className="font-bold text-slate-900 underline underline-offset-4">
                      {headOfficeName || '...........................'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
