import React, { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  MapPin,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Truck,
} from 'lucide-react';
import { warehouseDb } from '../db/storage';
import {
  InventoryTransaction,
  ItemMaster,
  PurchaseOrderNota,
  ReceivingDocument,
  ReceivingLine,
  StockStatus,
} from '../types/warehouse';
import { getStorageLocationDetails } from '../utils/skuGenerator';
import { normalizeToStandardCategory } from '../utils/categoryStandards';
import { BTN_PRIMARY, BTN_SECONDARY, DialogShell, FOCUS_RING, TABLE_INPUT } from './common/FormDialog';

interface ItemStockDetailModalProps {
  item: ItemMaster | null;
  onClose: () => void;
  canAdjust?: boolean;
  onAdjust?: (item: ItemMaster) => void;
  refreshKey?: number;
}

type MovementFilter = 'ALL' | 'IN' | 'OUT' | 'ADJUST';

interface EnrichedMovement {
  id: string;
  timestamp: string;
  dateIso: string;
  timeLabel: string;
  kind: 'IN' | 'OUT' | 'ADJUST';
  badgeLabel: string;
  quantity: number;
  unit: string;
  balanceAfter: number | null;
  referenceDocument: string;
  supplierName?: string;
  deliveryNoteNo?: string;
  expiryDate?: string;
  batchNumber?: string;
  userName: string;
  notes?: string;
}

const SHORT_MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function formatDateId(iso: string): string {
  const clean = (iso || '').slice(0, 10);
  const [y, m, d] = clean.split('-');
  if (!y || !m || !d) return iso || '-';
  return `${parseInt(d, 10)} ${SHORT_MONTHS_ID[parseInt(m, 10) - 1] || m} ${y}`;
}

function parseDateAndTime(ts: string): { dateIso: string; timeLabel: string; sortKey: string } {
  const raw = (ts || '').trim();
  if (!raw) return { dateIso: '', timeLabel: '', sortKey: '' };

  // Format lokal "YYYY-MM-DD HH:mm" atau "YYYY-MM-DD HH:mm:ss"
  const localMatch = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?/);
  if (localMatch && !raw.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(raw)) {
    const [, dateIso, hhmm, ss] = localMatch;
    return {
      dateIso,
      timeLabel: hhmm.replace(':', '.'),
      sortKey: `${dateIso}T${hhmm}:${ss || '00'}`,
    };
  }

  // Format ISO UTC atau bertanda zona waktu
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const mo = String(parsed.getMonth() + 1).padStart(2, '0');
    const da = String(parsed.getDate()).padStart(2, '0');
    const hh = String(parsed.getHours()).padStart(2, '0');
    const mm = String(parsed.getMinutes()).padStart(2, '0');
    const ss = String(parsed.getSeconds()).padStart(2, '0');
    return {
      dateIso: `${y}-${mo}-${da}`,
      timeLabel: `${hh}.${mm}`,
      sortKey: `${y}-${mo}-${da}T${hh}:${mm}:${ss}`,
    };
  }

  return { dateIso: raw.slice(0, 10), timeLabel: '', sortKey: raw };
}

function extractSupplierFromNotes(notes?: string): string | undefined {
  if (!notes) return undefined;
  const fromPo = notes.match(/Penerimaan resmi PO\s+.+?\(([^)]+)\)/i);
  if (fromPo?.[1]) return fromPo[1].trim();
  const fromText = notes.match(/Penerimaan\s+.*?\bdari\s+([^.;(]+)/i);
  if (fromText?.[1]) return fromText[1].trim();
  return undefined;
}

function formatQty(val: number): string {
  return Number(val.toFixed(2)).toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function getStockStatus(item: ItemMaster): StockStatus {
  if (item.currentStock <= 0) return 'OUT_OF_STOCK';
  if (item.currentStock <= item.minimumStock) return 'LOW';
  return 'NORMAL';
}

export const ItemStockDetailModal: React.FC<ItemStockDetailModalProps> = ({
  item,
  onClose,
  canAdjust = false,
  onAdjust,
  refreshKey = 0,
}) => {
  const [filter, setFilter] = useState<MovementFilter>('ALL');
  const [query, setQuery] = useState('');

  const enrichedData = useMemo(() => {
    if (!item) return null;

    const transactions = warehouseDb.getTransactions().filter(tx => tx.itemId === item.id);
    const receivings = warehouseDb.getReceivings();
    const purchaseOrders = warehouseDb.getPurchaseOrders();

    const receivingById = new Map<string, ReceivingDocument>();
    receivings.forEach(rec => receivingById.set(rec.id, rec));

    const poByNumber = new Map<string, PurchaseOrderNota>();
    purchaseOrders.forEach(po => {
      if (po.poNumber) poByNumber.set(po.poNumber, po);
    });

    const findMatchingReceivingLine = (rec?: ReceivingDocument): ReceivingLine | undefined =>
      rec?.lines?.find(l => l.itemId === item.id);

    const coveredReceivingIds = new Set<string>();

    const movements: Array<EnrichedMovement & { sortKey: string }> = transactions.map((tx: InventoryTransaction) => {
      const { dateIso, timeLabel, sortKey } = parseDateAndTime(tx.timestamp);
      const ref = (tx.referenceDocument || '').trim();

      let rec = ref ? receivingById.get(ref) : undefined;
      const po = ref ? poByNumber.get(ref) : undefined;
      if (!rec && po?.relatedReceivingId) {
        rec = receivingById.get(po.relatedReceivingId);
      }
      if (rec) coveredReceivingIds.add(rec.id);

      const recLine = findMatchingReceivingLine(rec);
      const supplierName =
        rec?.supplierName ||
        po?.supplierName ||
        (tx.transactionType === 'RECEIVING' ? extractSupplierFromNotes(tx.notes) : undefined);

      let kind: 'IN' | 'OUT' | 'ADJUST' = 'ADJUST';
      let badgeLabel = 'Koreksi';
      if (tx.transactionType === 'RECEIVING') {
        kind = 'IN';
        badgeLabel = 'Masuk';
      } else if (tx.transactionType === 'ISSUE_CONSUMPTION') {
        kind = 'OUT';
        badgeLabel = 'Keluar';
      } else if (tx.transactionType === 'STOCK_OPNAME_ADJUSTMENT') {
        kind = 'ADJUST';
        badgeLabel = 'Opname';
      } else {
        kind = 'ADJUST';
        badgeLabel = tx.quantity >= 0 ? 'Koreksi +' : 'Koreksi -';
      }

      const effectiveDate = rec?.date || dateIso;
      const effectiveTime = rec?.arrivalTime ? rec.arrivalTime.slice(0, 5).replace(':', '.') : timeLabel;

      return {
        id: tx.id,
        timestamp: tx.timestamp,
        dateIso: effectiveDate,
        timeLabel: effectiveTime,
        sortKey: sortKey || `${effectiveDate}T${effectiveTime.replace('.', ':') || '00:00'}:00`,
        kind,
        badgeLabel,
        quantity: tx.quantity,
        unit: tx.unit || item.baseUnit,
        balanceAfter: typeof tx.balanceAfter === 'number' ? tx.balanceAfter : null,
        referenceDocument: ref || '-',
        supplierName,
        deliveryNoteNo: rec?.deliveryNoteNo || undefined,
        expiryDate: recLine?.expiryDate || undefined,
        batchNumber: recLine?.batchNumber || undefined,
        userName: tx.userName || rec?.receiverName || '-',
        notes: tx.notes || recLine?.conditionNote || rec?.notes || undefined,
      };
    });

    // Sertakan juga dokumen penerimaan yang memuat item ini jika transaksinya belum tercatat di ledger.
    receivings.forEach(rec => {
      if (coveredReceivingIds.has(rec.id)) return;
      const line = rec.lines?.find(l => l.itemId === item.id);
      if (!line) return;
      // Hindari duplikasi bila sudah ada transaksi RECEIVING dengan tanggal, jumlah, dan supplier yang sama (mis. lewat nomor PO)
      const duplicateExists = movements.some(
        m =>
          m.kind === 'IN' &&
          m.dateIso === rec.date &&
          Math.abs(m.quantity - line.quantity) < 0.01 &&
          (m.supplierName || '').toLowerCase() === (rec.supplierName || '').toLowerCase()
      );
      if (duplicateExists) return;

      const timeStr = rec.arrivalTime ? rec.arrivalTime.slice(0, 5).replace(':', '.') : '';
      movements.push({
        id: `REC-${rec.id}-${line.id}`,
        timestamp: `${rec.date} ${rec.arrivalTime || '00:00'}`,
        dateIso: rec.date,
        timeLabel: timeStr,
        sortKey: `${rec.date}T${(rec.arrivalTime || '00:00').slice(0, 5)}:00`,
        kind: 'IN',
        badgeLabel: 'Masuk',
        quantity: line.quantity,
        unit: line.unit || item.baseUnit,
        balanceAfter: null,
        referenceDocument: rec.id,
        supplierName: rec.supplierName || undefined,
        deliveryNoteNo: rec.deliveryNoteNo || undefined,
        expiryDate: line.expiryDate || undefined,
        batchNumber: line.batchNumber || undefined,
        userName: rec.receiverName || '-',
        notes: line.conditionNote || rec.notes || undefined,
      });
    });

    movements.sort((a, b) => b.sortKey.localeCompare(a.sortKey));

    let totalIn = 0;
    let inCount = 0;
    let totalOut = 0;
    let outCount = 0;
    let adjustCount = 0;

    movements.forEach(m => {
      if (m.kind === 'IN') {
        totalIn += Math.abs(m.quantity);
        inCount += 1;
      } else if (m.kind === 'OUT') {
        totalOut += Math.abs(m.quantity);
        outCount += 1;
      } else {
        adjustCount += 1;
      }
    });

    const lastIn = movements.find(m => m.kind === 'IN') || null;
    const lastOut = movements.find(m => m.kind === 'OUT') || null;
    const suppliers = Array.from(
      new Set(movements.filter(m => m.kind === 'IN' && m.supplierName).map(m => m.supplierName!))
    );

    return {
      movements,
      totalIn,
      inCount,
      totalOut,
      outCount,
      adjustCount,
      lastIn,
      lastOut,
      suppliers,
    };
  }, [item, refreshKey]);

  if (!item || !enrichedData) return null;

  const status = getStockStatus(item);
  const category = normalizeToStandardCategory(item.category || item.subcategory, item.name);
  const rackSpec = getStorageLocationDetails(item.location);
  const unitPrice = item.estimatedPrice && item.estimatedPrice > 0 ? item.estimatedPrice : 0;
  const stockValue = Math.max(0, item.currentStock) * unitPrice;

  const filteredMovements = enrichedData.movements.filter(m => {
    if (filter !== 'ALL' && m.kind !== filter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const hay = [
      m.dateIso,
      formatDateId(m.dateIso),
      m.supplierName || '',
      m.referenceDocument,
      m.deliveryNoteNo || '',
      m.userName,
      m.notes || '',
      m.badgeLabel,
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });

  const statusBadge = (
    <span
      className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${
        status === 'OUT_OF_STOCK'
          ? 'bg-rose-50 text-rose-700'
          : status === 'LOW'
            ? 'bg-amber-50 text-amber-800'
            : 'bg-emerald-50 text-emerald-800'
      }`}
    >
      {status === 'OUT_OF_STOCK' ? 'Habis' : status === 'LOW' ? 'Menipis' : 'Aman'}
    </span>
  );

  const skuBadge = (
    <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[11px] font-medium">
      {item.id}
    </span>
  );

  return (
    <DialogShell
      title={item.name}
      badges={
        <>
          {statusBadge}
          {skuBadge}
        </>
      }
      description={
        <span>
          {category} · {rackSpec.rackCode} {rackSpec.shortName}
        </span>
      }
      onClose={onClose}
      size="xl"
      footer={
        <>
          {canAdjust && onAdjust && item.isActive !== false && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onAdjust(item);
              }}
              className={BTN_SECONDARY}
            >
              <RefreshCw className="w-3.5 h-3.5 text-emerald-700" />
              Koreksi stok
            </button>
          )}
          <button type="button" onClick={onClose} className={BTN_PRIMARY}>
            Tutup
          </button>
        </>
      }
    >
      {/* Ringkasan stok & keluar masuk */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/80">
          <div className="text-[11px] font-medium text-slate-600">Jumlah stok saat ini</div>
          <div
            className={`mt-1 text-lg font-bold font-mono tabular-nums ${
              status === 'OUT_OF_STOCK' ? 'text-rose-700' : status === 'LOW' ? 'text-amber-800' : 'text-slate-900'
            }`}
          >
            {formatQty(item.currentStock)}{' '}
            <span className="text-xs font-sans font-medium text-slate-600">{item.baseUnit}</span>
          </div>
          <div className="text-[11px] text-slate-600 mt-0.5">
            Minimum: <span className="font-mono">{formatQty(item.minimumStock)}</span> {item.baseUnit}
          </div>
        </div>

        <div className="p-3 rounded-xl border border-slate-200 bg-white">
          <div className="text-[11px] font-medium text-slate-600">Total barang masuk</div>
          <div className="mt-1 text-lg font-bold font-mono tabular-nums text-emerald-700">
            +{formatQty(enrichedData.totalIn)}{' '}
            <span className="text-xs font-sans font-medium text-slate-600">{item.baseUnit}</span>
          </div>
          <div className="text-[11px] text-slate-600 mt-0.5 truncate" title={enrichedData.lastIn?.supplierName}>
            {enrichedData.inCount > 0
              ? `${enrichedData.inCount}x masuk · terakhir ${formatDateId(enrichedData.lastIn!.dateIso)}`
              : 'Belum ada penerimaan'}
          </div>
        </div>

        <div className="p-3 rounded-xl border border-slate-200 bg-white">
          <div className="text-[11px] font-medium text-slate-600">Total barang keluar</div>
          <div className="mt-1 text-lg font-bold font-mono tabular-nums text-rose-700">
            -{formatQty(enrichedData.totalOut)}{' '}
            <span className="text-xs font-sans font-medium text-slate-600">{item.baseUnit}</span>
          </div>
          <div className="text-[11px] text-slate-600 mt-0.5">
            {enrichedData.outCount > 0
              ? `${enrichedData.outCount}x keluar · terakhir ${formatDateId(enrichedData.lastOut!.dateIso)}`
              : 'Belum ada pengeluaran'}
          </div>
        </div>

        <div className="p-3 rounded-xl border border-slate-200 bg-white">
          <div className="text-[11px] font-medium text-slate-600">Nilai stok &amp; harga</div>
          <div className="mt-1 text-base font-bold font-mono tabular-nums text-slate-900">
            {unitPrice > 0 ? `Rp ${Math.round(stockValue).toLocaleString('id-ID')}` : 'Belum diisi'}
          </div>
          <div className="text-[11px] text-slate-600 mt-0.5 font-mono">
            {unitPrice > 0 ? `@ Rp ${unitPrice.toLocaleString('id-ID')} / ${item.baseUnit}` : 'Harga satuan kosong'}
          </div>
        </div>
      </div>

      {/* Info lokasi & supplier pemasok */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-start gap-2 text-slate-700 min-w-0">
          <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="min-w-0">
            <span className="font-medium text-slate-900">{item.location || '-'}</span>
            {item.notes && <span className="text-slate-600"> · {item.notes}</span>}
          </div>
        </div>
        {enrichedData.suppliers.length > 0 && (
          <div className="flex items-start gap-1.5 text-slate-700 shrink-0">
            <Truck className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              Supplier:{' '}
              <strong className="font-semibold text-slate-900">
                {enrichedData.suppliers.slice(0, 3).join(', ')}
                {enrichedData.suppliers.length > 3 ? ` (+${enrichedData.suppliers.length - 3})` : ''}
              </strong>
            </span>
          </div>
        )}
      </div>

      {/* Filter & pencarian riwayat keluar masuk */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div role="tablist" aria-label="Filter riwayat mutasi" className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg self-start">
            {([
              { id: 'ALL', label: `Semua (${enrichedData.movements.length})` },
              { id: 'IN', label: `Masuk (${enrichedData.inCount})` },
              { id: 'OUT', label: `Keluar (${enrichedData.outCount})` },
              { id: 'ADJUST', label: `Koreksi (${enrichedData.adjustCount})` },
            ] as const).map(tab => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={filter === tab.id}
                onClick={() => setFilter(tab.id)}
                className={`px-2.5 rounded-md whitespace-nowrap text-xs cursor-pointer min-h-[44px] sm:min-h-[30px] ${FOCUS_RING} ${
                  filter === tab.id
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 font-medium'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {enrichedData.movements.length > 0 && (
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                aria-label="Cari riwayat barang"
                placeholder="Cari supplier, dokumen, petugas"
                className={`${TABLE_INPUT} pl-8`}
              />
            </div>
          )}
        </div>

        {/* Tabel & daftar riwayat keluar masuk */}
        {filteredMovements.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 py-10 px-4 text-center">
            <p className="text-xs font-semibold text-slate-800">
              {enrichedData.movements.length === 0
                ? 'Belum ada riwayat keluar masuk untuk barang ini.'
                : 'Tidak ada mutasi yang cocok dengan filter atau pencarian.'}
            </p>
            <p className="text-[11px] text-slate-600 mt-1">
              {enrichedData.movements.length === 0
                ? 'Penerimaan barang, pemakaian dapur, koreksi, dan hasil opname akan muncul otomatis di sini.'
                : 'Coba ganti tab filter atau hapus kata kunci pencarian.'}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3 whitespace-nowrap">Tanggal</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Jenis</th>
                    <th className="py-2.5 px-3">Supplier / Keterangan</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Jumlah</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Saldo akhir</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Petugas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMovements.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50/80 align-top">
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-medium text-slate-900">{formatDateId(m.dateIso)}</div>
                        {m.timeLabel && (
                          <div className="text-[11px] font-mono text-slate-600 tabular-nums">{m.timeLabel}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                            m.kind === 'IN'
                              ? 'bg-emerald-50 text-emerald-800'
                              : m.kind === 'OUT'
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-indigo-50 text-indigo-700'
                          }`}
                        >
                          {m.kind === 'IN' ? (
                            <ArrowDownLeft className="w-3 h-3" aria-hidden="true" />
                          ) : m.kind === 'OUT' ? (
                            <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
                          ) : (
                            <SlidersHorizontal className="w-3 h-3" aria-hidden="true" />
                          )}
                          {m.badgeLabel}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 min-w-[220px]">
                        {m.kind === 'IN' && (
                          <div className="font-semibold text-slate-900">
                            {m.supplierName || 'Supplier tidak tercatat'}
                          </div>
                        )}
                        {m.notes && (
                          <div className={m.kind === 'IN' ? 'text-[11px] text-slate-600 mt-0.5' : 'text-slate-900'}>
                            {m.notes}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-600 mt-0.5">
                          <span className="font-mono">Dok: {m.referenceDocument}</span>
                          {m.deliveryNoteNo && <span>· SJ: {m.deliveryNoteNo}</span>}
                          {m.batchNumber && <span>· Batch: {m.batchNumber}</span>}
                          {m.expiryDate && <span>· Exp: {formatDateId(m.expiryDate)}</span>}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono font-semibold tabular-nums">
                        <span
                          className={
                            m.quantity > 0
                              ? 'text-emerald-700'
                              : m.quantity < 0
                                ? 'text-rose-700'
                                : 'text-slate-700'
                          }
                        >
                          {m.quantity > 0 ? '+' : ''}
                          {formatQty(m.quantity)}
                        </span>{' '}
                        <span className="font-sans font-normal text-slate-600 text-[11px]">{m.unit}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono text-slate-800 tabular-nums">
                        {m.balanceAfter !== null ? `${formatQty(m.balanceAfter)} ${m.unit}` : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">{m.userName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile list */}
            <ul className="md:hidden divide-y divide-slate-100">
              {filteredMovements.map(m => (
                <li key={m.id} className="p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                          m.kind === 'IN'
                            ? 'bg-emerald-50 text-emerald-800'
                            : m.kind === 'OUT'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-indigo-50 text-indigo-700'
                        }`}
                      >
                        {m.kind === 'IN' ? (
                          <ArrowDownLeft className="w-3 h-3" aria-hidden="true" />
                        ) : m.kind === 'OUT' ? (
                          <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
                        ) : (
                          <SlidersHorizontal className="w-3 h-3" aria-hidden="true" />
                        )}
                        {m.badgeLabel}
                      </span>
                      <span className="text-xs font-medium text-slate-900">
                        {formatDateId(m.dateIso)}
                        {m.timeLabel ? <span className="font-mono text-slate-600"> · {m.timeLabel}</span> : null}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className={`font-mono text-sm font-bold tabular-nums ${
                          m.quantity > 0 ? 'text-emerald-700' : m.quantity < 0 ? 'text-rose-700' : 'text-slate-700'
                        }`}
                      >
                        {m.quantity > 0 ? '+' : ''}
                        {formatQty(m.quantity)} <span className="text-xs font-sans font-normal text-slate-600">{m.unit}</span>
                      </div>
                      {m.balanceAfter !== null && (
                        <div className="text-[11px] font-mono text-slate-600 tabular-nums">
                          Saldo: {formatQty(m.balanceAfter)}
                        </div>
                      )}
                    </div>
                  </div>

                  {m.kind === 'IN' && (
                    <div className="text-xs font-semibold text-slate-900">
                      Supplier: {m.supplierName || 'Tidak tercatat'}
                    </div>
                  )}
                  {m.notes && <p className="text-xs text-slate-700 leading-relaxed">{m.notes}</p>}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-600">
                    <span className="font-mono">Dok: {m.referenceDocument}</span>
                    {m.deliveryNoteNo && <span>· SJ: {m.deliveryNoteNo}</span>}
                    {m.expiryDate && <span>· Exp: {formatDateId(m.expiryDate)}</span>}
                    <span>· Petugas: {m.userName}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </DialogShell>
  );
};
