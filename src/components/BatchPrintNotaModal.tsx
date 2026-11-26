import React, { useMemo, useState } from 'react';
import { SearchPicker } from './common/SearchPicker';
import {
  Printer,
  X,
  Trash2,
  Scissors,
  Plus,
  ExternalLink,
  Search,
} from 'lucide-react';
import { PurchaseOrderNota } from '../types/warehouse';
import { warehouseDb, signerName } from '../db/storage';
import logoSppgImg from '../assets/logo sppg.png';
import { deliveryTimeNoteFor } from '../utils/notaDelivery';
import { DocSignatureToggle, OfficerSignatureImg } from './common/OfficerSignatureImg';
import { BTN_PRIMARY, BTN_SECONDARY, FIELD_INPUT, FOCUS_RING } from './common/FormDialog';

export interface BatchPrintNotaModalProps {
  isOpen: boolean;
  onClose: () => void;
  poolNotaIds: string[];
  allNotas: PurchaseOrderNota[];
  onRemoveFromPool: (id: string) => void;
  onClearPool: () => void;
  onOpenSingleNota?: (nota: PurchaseOrderNota) => void;
  onAddToPool: (id: string) => void;
}

function formatDateIndonesian(dateStr?: string): string {
  if (!dateStr) return '';
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (monthIdx >= 0 && monthIdx < 12) {
        return `${day} ${months[monthIdx]} ${year}`;
      }
    }
  } catch {
    // fallback
  }
  return dateStr;
}

function formatDateWithDashes(dateStr?: string): string {
  if (!dateStr) return '';
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (monthIdx >= 0 && monthIdx < 12) {
        return `${day}-${months[monthIdx]}-${year}`;
      }
    }
  } catch {
    // fallback
  }
  return dateStr;
}

export const BatchPrintNotaModal: React.FC<BatchPrintNotaModalProps> = ({
  isOpen,
  onClose,
  poolNotaIds,
  allNotas,
  onRemoveFromPool,
  onClearPool,
  onOpenSingleNota,
  onAddToPool,
}) => {
  const [activeTab, setActiveTab] = useState<'PREVIEW' | 'LIST'>('PREVIEW');
  const [selectedToAdd, setSelectedToAdd] = useState<string>('');
  const [emptySearch, setEmptySearch] = useState<string>('');

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const allAvailableNotas: PurchaseOrderNota[] = useMemo(() => {
    if (!isOpen) return [];
    try {
      const dbNotas = warehouseDb.getPurchaseOrders();
      const map = new Map<string, PurchaseOrderNota>();
      (allNotas || []).forEach(n => {
        if (n && n.id) map.set(n.id, n);
      });
      (dbNotas || []).forEach(n => {
        if (n && n.id) map.set(n.id, n);
      });
      return Array.from(map.values()).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    } catch {
      return allNotas || [];
    }
  }, [allNotas, isOpen]);

  const poolNotas: PurchaseOrderNota[] = useMemo(() => {
    return poolNotaIds
      .map(id => {
        const found = allAvailableNotas.find(n => n.id === id);
        if (found) return found;
        try {
          const directFromDb = warehouseDb.getPurchaseOrderById(id);
          if (directFromDb) return directFromDb;
        } catch {
          // ignore
        }
        return undefined;
      })
      .filter((n): n is PurchaseOrderNota => n !== undefined && n !== null);
  }, [poolNotaIds, allAvailableNotas]);

  const availableToAdd = useMemo(
    () => allAvailableNotas.filter(n => !poolNotaIds.includes(n.id)),
    [allAvailableNotas, poolNotaIds]
  );

  const filteredEmptyNotas = useMemo(() => {
    const q = emptySearch.trim().toLowerCase();
    if (!q) return availableToAdd;
    return availableToAdd.filter(
      n =>
        (n.poNumber || '').toLowerCase().includes(q) ||
        (n.supplierName || '').toLowerCase().includes(q) ||
        (n.date || '').includes(q)
    );
  }, [availableToAdd, emptySearch]);

  const pairedPages: [PurchaseOrderNota, PurchaseOrderNota | null][] = [];
  for (let i = 0; i < poolNotas.length; i += 2) {
    pairedPages.push([poolNotas[i], poolNotas[i + 1] || null]);
  }

  const totalSheetsNeeded = pairedPages.length;
  const totalPoolNominal = poolNotas.reduce((sum, n) => sum + (Number(n.grandTotal) || 0), 0);

  const handlePrintAll = () => {
    setActiveTab('PREVIEW');
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleAddSelected = () => {
    if (!selectedToAdd) return;
    onAddToPool(selectedToAdd);
    setSelectedToAdd('');
  };

  // Render 1 kartu nota untuk pratinjau lembar kertas A4 (format resmi BGN, 2 nota per lembar)
  const renderNotaCard = (nota: PurchaseOrderNota, positionLabel: string) => {
    const displayDeliveryDate =
      formatDateWithDashes(nota.deliveryDate || nota.date) ||
      formatDateWithDashes(new Date().toISOString().slice(0, 10));
    const displaySignDate = formatDateIndonesian(nota.date || new Date().toISOString().slice(0, 10));

    let displayAddress = nota.supplierAddress;
    if (!displayAddress || displayAddress.trim() === '') {
      try {
        const supp = warehouseDb.getSuppliers().find(
          s => s.name.toLowerCase() === (nota.supplierName || '').toLowerCase() || s.id === nota.supplierId
        );
        if (supp?.address) displayAddress = supp.address;
      } catch {
        // ignore
      }
    }
    if (!displayAddress || displayAddress.trim() === '') {
      displayAddress = 'Malang, Jawa Timur';
    }

    const calculatedTotal = (nota.items || []).reduce(
      (acc, it) => acc + (it.subtotal || it.quantity * it.unitPrice || 0),
      0
    );
    const grandTotalValue = nota.grandTotal > 0 ? nota.grandTotal : calculatedTotal;

    const displaySignerName =
      !nota.approvedBy || nota.approvedBy.includes('Siti Rahma')
        ? signerName('KEPALA_SPPG')
        : nota.approvedBy;

    return (
      <div className="nota-compact-card bg-white text-black p-3 sm:p-4 font-sans flex flex-col justify-between border border-slate-200 print:border-none print:p-0">
        <div>
          {/* Penanda posisi tipis hanya di layar */}
          <div className="no-print flex items-center justify-between pb-1.5 mb-2 border-b border-slate-200 text-[11px] text-slate-600">
            <span className="font-medium text-slate-700">
              {positionLabel} · <span className="font-semibold text-slate-900">{nota.supplierName}</span>
            </span>
            <div className="flex items-center gap-3">
              {onOpenSingleNota && (
                <button
                  type="button"
                  onClick={() => onOpenSingleNota(nota)}
                  className={`inline-flex items-center gap-1 text-slate-700 hover:text-emerald-800 font-medium cursor-pointer rounded ${FOCUS_RING}`}
                >
                  <span>Ubah nota</span>
                  <ExternalLink className="w-3 h-3" aria-hidden />
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemoveFromPool(nota.id)}
                className={`inline-flex items-center gap-1 text-slate-500 hover:text-rose-700 font-medium cursor-pointer rounded ${FOCUS_RING}`}
              >
                <span>Keluarkan</span>
              </button>
            </div>
          </div>

          {/* 1. KOP SURAT RESMI BADAN GIZI NASIONAL */}
          <div className="flex items-center gap-2.5 pb-1 border-b-2 border-black">
            <div className="shrink-0">
              <img
                src={logoSppgImg}
                alt="Logo Badan Gizi Nasional"
                className="w-10 h-10 object-contain"
              />
            </div>
            <div className="flex-1 text-center pr-6">
              <h1 className="text-xs font-bold text-black tracking-normal leading-tight">
                BADAN GIZI NASIONAL
              </h1>
              <p className="text-[9px] text-black leading-tight mt-0.5">
                Jl. Kebon Sirih No.1, RT.01/RW.07, Kb. Sirih, Kec. Menteng,
              </p>
              <p className="text-[9px] text-black leading-tight">
                Kota Jakarta Pusat, Daerah Khusus Ibukota Jakarta 10340
              </p>
            </div>
          </div>

          {/* 2. JUDUL DOKUMEN & NOMOR PO */}
          <div className="text-center my-1">
            <h2 className="text-[10.5px] font-bold text-black">
              NOTA PESANAN BAHAN MAKANAN DAN OPERASIONAL
            </h2>
            <div className="text-[10px] font-semibold text-black mt-0.5 flex items-center justify-center gap-1">
              {!nota.poNumber?.trim().toUpperCase().startsWith('NO.') && <span>NO.</span>}
              <span className="font-bold text-black font-mono">
                {nota.poNumber}
              </span>
            </div>
          </div>

          {/* 3. METADATA HEADER */}
          <div className="my-1 text-[10px] space-y-0.5 text-black font-normal">
            <div className="flex items-center">
              <span className="w-16 shrink-0 font-medium">Dari</span>
              <span className="w-2.5 text-center">:</span>
              <span className="font-semibold text-black">SPPG MLG TUMPANG JERU</span>
            </div>
            <div className="flex items-center">
              <span className="w-16 shrink-0 font-medium">Kepada</span>
              <span className="w-2.5 text-center">:</span>
              <span className="font-semibold text-black">{nota.supplierName || 'Pihak Rekanan'}</span>
            </div>
            <div className="flex items-center">
              <span className="w-16 shrink-0 font-medium">Alamat</span>
              <span className="w-2.5 text-center">:</span>
              <span className="text-black truncate">{displayAddress}</span>
            </div>
            <div className="flex items-center">
              <span className="w-16 shrink-0 font-medium">Pengiriman</span>
              <span className="w-2.5 text-center">:</span>
              <span className="font-medium text-black">
                {displayDeliveryDate} {deliveryTimeNoteFor(nota)}
              </span>
            </div>
          </div>

          {/* 4. TABEL RINCIAN BARANG */}
          <div className="my-1">
            <table className="w-full text-[9px] border-collapse border border-black table-po-print">
              <thead>
                <tr className="bg-[#5b9bd5] text-black font-bold border-b border-black table-header-bgn">
                  <th className="border border-black py-0.5 px-1 w-7 text-center">No</th>
                  <th className="border border-black py-0.5 px-2 text-center">Uraian Jenis Bahan Makanan</th>
                  <th className="border border-black py-0.5 px-1.5 w-20 text-center leading-tight">
                    Banyaknya<br />(Angka)
                  </th>
                  <th className="border border-black py-0.5 px-1 w-12 text-center">Satuan</th>
                  <th className="border border-black py-0.5 px-1.5 w-20 text-center">Harga</th>
                  <th className="border border-black py-0.5 px-1.5 w-24 text-center">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {(nota.items || []).map((it, idx) => {
                  const lineTotal = it.subtotal || it.quantity * it.unitPrice;
                  const hasTotal = lineTotal && lineTotal > 0;
                  return (
                    <tr key={it.id || idx}>
                      <td className="border border-black py-0.5 px-1 text-center font-normal">{idx + 1}</td>
                      <td className="border border-black py-0.5 px-2 text-left font-normal">{it.name}</td>
                      <td className="border border-black py-0.5 px-1 text-center font-normal">{it.quantity}</td>
                      <td className="border border-black py-0.5 px-1 text-center font-normal">{it.unit}</td>
                      <td className="border border-black py-0.5 px-1.5 text-right tabular-nums font-normal">
                        <div className="flex items-center justify-between">
                          <span>Rp</span>
                          <span>{it.unitPrice > 0 ? it.unitPrice.toLocaleString('id-ID') : '-'}</span>
                        </div>
                      </td>
                      <td className="border border-black py-0.5 px-1.5 text-right tabular-nums font-normal">
                        <div className="flex items-center justify-between">
                          <span>Rp</span>
                          <span>{hasTotal ? lineTotal.toLocaleString('id-ID') : '-'}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                <tr className="border-t border-black font-bold">
                  <td colSpan={4} className="border border-black py-0.5 px-1.5 text-center font-bold">TOTAL</td>
                  <td className="border border-black py-0.5 px-1.5 text-left font-bold">Rp</td>
                  <td className="border border-black py-0.5 px-1.5 text-right font-bold tabular-nums">
                    {grandTotalValue > 0 ? `${grandTotalValue.toLocaleString('id-ID')} -` : '-'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 5. CATATAN & TTD */}
          <div className="grid grid-cols-12 gap-2 mt-0.5 text-[9px] text-black">
            <div className="col-span-7 flex items-start gap-1 leading-tight text-[8.5px]">
              <span className="font-bold shrink-0">Catatan</span>
              <span className="font-bold shrink-0">:</span>
              <div className="space-y-0.5 text-black">
                <div>1. Harga sudah termasuk ongkos kirim (ongkir).</div>
                <div>2. Apabila barang yang diterima tidak sesuai atau rusak, maka pihak supplier akan mengganti barang tersebut sesuai kesepakatan</div>
                <div>3. Pengiriman barang dilakukan sesuai jadwal yang telah ditentukan oleh pihak pembeli.</div>
              </div>
            </div>

            <div className="col-span-5 text-center flex flex-col items-center justify-start">
              <div className="text-[9px] font-medium text-black">
                Malang, {displaySignDate}
              </div>
              <div className="font-bold text-black mt-0.5 leading-tight text-[9px]">
                <div>Kepala SPPG</div>
                <div>Malang Tumpang Jeru</div>
              </div>
              <div className="my-0.5 h-20 flex items-center justify-center">
                <OfficerSignatureImg doc="po-nota" officer="KEPALA_SPPG" className="h-20" forName={displaySignerName} />
              </div>
              <div className="mt-0.5 font-bold text-black underline underline-offset-2 text-[10px]">
                {displaySignerName}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/55"
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-print-modal-title"
    >
      {/* Print Specific CSS untuk Batch Pool */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          html, body {
            overflow: visible !important;
            height: auto !important;
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body *:not(:has(#print-batch-pool)):not(#print-batch-pool):not(#print-batch-pool *) {
            display: none !important;
          }
          body *:has(#print-batch-pool) {
            position: static !important;
            display: block !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            min-height: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
            background: transparent !important;
            transform: none !important;
            animation: none !important;
          }
          #print-batch-pool {
            position: static !important;
            width: 100% !important;
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          .batch-a4-page {
            box-sizing: border-box !important;
            width: 100% !important;
            min-height: 285mm !important;
            max-height: 292mm !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            padding: 6mm 8mm !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: #ffffff !important;
            overflow: hidden !important;
          }
          .batch-a4-wrapper:last-child .batch-a4-page {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .nota-compact-card {
            box-sizing: border-box !important;
            max-height: 137mm !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
            overflow: hidden !important;
          }
          .cut-line-print {
            margin: 1.5mm 0 !important;
            padding: 0 !important;
            height: 4mm !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .no-print {
            display: none !important;
          }
          .table-po-print {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          .table-po-print th, .table-po-print td {
            border: 1px solid #000000 !important;
            padding: 1.5px 3px !important;
            font-size: 8px !important;
            line-height: 1.15 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .table-header-bgn {
            background-color: #5b9bd5 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color: #000000 !important;
          }
          img {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-5xl w-full max-h-[94dvh] flex flex-col overflow-hidden">
        {/* Header bersih */}
        <div className="no-print border-b border-slate-200 bg-white shrink-0">
          <div className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 id="batch-print-modal-title" className="text-sm font-bold text-slate-900">
                Antrean Cetak Nota
              </h2>
              <p className="text-xs text-slate-600 mt-0.5 truncate">
                {poolNotas.length > 0
                  ? `${poolNotas.length} nota · ${totalSheetsNeeded} lembar A4 (2 nota per lembar) · Rp ${totalPoolNominal.toLocaleString('id-ID')}`
                  : 'Gabungkan 2 nota pesanan per lembar A4 untuk dicetak sekaligus.'}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {poolNotas.length > 0 && (
                <button
                  type="button"
                  onClick={onClearPool}
                  className={`${BTN_SECONDARY} hover:text-rose-700 hover:border-rose-300`}
                >
                  Kosongkan
                </button>
              )}
              <button
                type="button"
                onClick={handlePrintAll}
                disabled={poolNotas.length === 0}
                className={`${BTN_PRIMARY} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Printer className="w-4 h-4" />
                <span>
                  {poolNotas.length > 0
                    ? `Cetak ${poolNotas.length} nota`
                    : 'Cetak'}
                </span>
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup antrean cetak"
                className={`inline-flex items-center justify-center w-10 h-10 sm:w-9 sm:h-9 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer ${FOCUS_RING}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Bilah kontrol sekunder: tab tampilan, tambah nota, dan tanda tangan */}
          {poolNotas.length > 0 && (
            <div className="px-4 sm:px-5 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex p-0.5 rounded-lg bg-slate-200/70" role="tablist" aria-label="Tampilan antrean cetak">
                  {([
                    ['PREVIEW', `Pratinjau A4 (${totalSheetsNeeded})`],
                    ['LIST', `Daftar nota (${poolNotas.length})`],
                  ] as const).map(([tab, label]) => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-3 min-h-[30px] rounded-md text-[11px] font-semibold cursor-pointer ${FOCUS_RING} ${
                        activeTab === tab
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <DocSignatureToggle doc="po-nota" />
              </div>

              {availableToAdd.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-60 sm:w-64">
                    <SearchPicker
                      value={selectedToAdd}
                      options={availableToAdd.map(n => ({
                        value: n.id,
                        label: `${n.poNumber} · ${n.supplierName}`,
                        hint: `${n.date} · Rp ${n.grandTotal.toLocaleString('id-ID')}`,
                      }))}
                      onSelect={opt => opt && setSelectedToAdd(opt.value)}
                      placeholder="Tambah nota ke antrean..."
                      searchPlaceholder="Cari nomor nota atau supplier..."
                      ariaLabel="Tambah nota ke antrean"
                      noun="nota"
                      size="sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddSelected}
                    disabled={!selectedToAdd}
                    className={`${BTN_SECONDARY} !min-h-[32px] !py-1 !px-3 disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden />
                    <span>Tambah</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Isi Modal */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100">
          {poolNotas.length === 0 ? (
            /* Antrean kosong: langsung siap pilih nota tanpa dekorasi berlebihan */
            <div className="max-w-2xl mx-auto bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Antrean masih kosong</h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Pilih nota di bawah untuk dimasukkan ke antrean cetak (2 nota per lembar A4).
                  </p>
                </div>
                {availableToAdd.length > 0 && (
                  <div className="relative w-full sm:w-60 shrink-0">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden />
                    <input
                      type="search"
                      aria-label="Cari nota"
                      placeholder="Cari nomor PO atau supplier..."
                      value={emptySearch}
                      onChange={e => setEmptySearch(e.target.value)}
                      className={`${FIELD_INPUT} pl-8 !min-h-[34px]`}
                    />
                  </div>
                )}
              </div>

              {availableToAdd.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-600">
                  Belum ada nota pesanan yang tersedia. Buat atau terima PO terlebih dahulu di halaman Barang Masuk.
                </div>
              ) : filteredEmptyNotas.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-600">
                  Tidak ada nota yang cocok dengan &ldquo;{emptySearch}&rdquo;.
                </div>
              ) : (
                <div className="max-h-[55dvh] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
                        <th className="py-2 px-4">No. PO</th>
                        <th className="py-2 px-3">Supplier</th>
                        <th className="py-2 px-3 w-28">Tanggal</th>
                        <th className="py-2 px-3 w-28 text-right">Nominal</th>
                        <th className="py-2 px-4 w-24 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredEmptyNotas.map(n => (
                        <tr key={n.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                            {n.poNumber}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-slate-900">{n.supplierName}</div>
                            <div className="text-[11px] text-slate-500">{n.items.length} bahan</div>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                            {n.date}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">
                            Rp {n.grandTotal.toLocaleString('id-ID')}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => onAddToPool(n.id)}
                              className={`${BTN_SECONDARY} !min-h-[30px] !py-1 !px-2.5 text-[11px]`}
                            >
                              <Plus className="w-3 h-3" aria-hidden />
                              <span>Pilih</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Tab Daftar Antrean dalam bentuk tabel rapi */}
              {activeTab === 'LIST' && (
                <div className="max-w-4xl mx-auto bg-white rounded-xl border border-slate-200 overflow-hidden no-print">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                          <th className="py-2.5 px-3 w-10 text-center">No</th>
                          <th className="py-2.5 px-3 w-36">Posisi Kertas</th>
                          <th className="py-2.5 px-3">No. PO</th>
                          <th className="py-2.5 px-3">Supplier</th>
                          <th className="py-2.5 px-3 w-28">Tanggal</th>
                          <th className="py-2.5 px-3 w-16 text-center">Item</th>
                          <th className="py-2.5 px-3 w-32 text-right">Nominal</th>
                          <th className="py-2.5 px-3 w-24 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {poolNotas.map((n, idx) => {
                          const sheetNum = Math.floor(idx / 2) + 1;
                          const posInSheet = idx % 2 === 0 ? 'Atas' : 'Bawah';
                          return (
                            <tr key={n.id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 text-center font-mono text-slate-500">{idx + 1}</td>
                              <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                                Lembar {sheetNum} · {posInSheet}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                                {n.poNumber}
                              </td>
                              <td className="py-2.5 px-3 font-medium text-slate-900">{n.supplierName}</td>
                              <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">{n.date}</td>
                              <td className="py-2.5 px-3 text-center font-mono text-slate-700">{n.items.length}</td>
                              <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">
                                Rp {n.grandTotal.toLocaleString('id-ID')}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <div className="inline-flex items-center justify-end gap-1">
                                  {onOpenSingleNota && (
                                    <button
                                      type="button"
                                      onClick={() => onOpenSingleNota(n)}
                                      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-600 hover:text-emerald-800 hover:bg-slate-100 cursor-pointer ${FOCUS_RING}`}
                                      title="Buka atau ubah nota"
                                      aria-label={`Ubah ${n.poNumber}`}
                                    >
                                      <ExternalLink className="w-4 h-4" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => onRemoveFromPool(n.id)}
                                    className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer ${FOCUS_RING}`}
                                    title="Keluarkan dari antrean"
                                    aria-label={`Keluarkan ${n.poNumber}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-50 border-t border-slate-200 font-semibold text-slate-900">
                          <td colSpan={6} className="py-2.5 px-3 text-right">Total ({poolNotas.length} nota)</td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            Rp {totalPoolNominal.toLocaleString('id-ID')}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Pratinjau Kertas A4 (selalu ada di DOM untuk dicetak) */}
              <div
                id="print-batch-pool"
                className={`max-w-[820px] w-full mx-auto ${
                  activeTab === 'PREVIEW' ? 'flex flex-col gap-6' : 'hidden print:flex flex-col gap-6'
                }`}
              >
                {pairedPages.map((pagePair, pageIdx) => {
                  const [topNota, bottomNota] = pagePair;
                  const pageNumber = pageIdx + 1;

                  return (
                    <div key={`page-${pageIdx}`} className="batch-a4-wrapper space-y-1.5 print:space-y-0">
                      <div className="no-print flex items-center justify-between text-[11px] text-slate-600 px-0.5">
                        <span className="font-semibold text-slate-700">
                          Lembar A4 {pageNumber} dari {totalSheetsNeeded}
                        </span>
                        <span>2 nota per lembar (potong tengah jadi A5)</span>
                      </div>

                      <div className="batch-a4-page bg-white p-4 sm:p-6 border border-slate-300 shadow-xs flex flex-col justify-between">
                        {/* Nota Atas */}
                        {renderNotaCard(topNota, 'Nota atas')}

                        {/* Garis potong tengah */}
                        <div className="py-2 flex items-center justify-center gap-2 text-slate-500 select-none cut-line-print">
                          <Scissors className="w-3 h-3 rotate-90 shrink-0" aria-hidden />
                          <span className="border-b border-dashed border-slate-400 flex-1" />
                          <span className="text-[9px] font-medium text-slate-600">
                            Garis potong A5
                          </span>
                          <span className="border-b border-dashed border-slate-400 flex-1" />
                        </div>

                        {/* Nota Bawah */}
                        {bottomNota ? (
                          renderNotaCard(bottomNota, 'Nota bawah')
                        ) : (
                          <div className="p-6 border border-dashed border-slate-300 text-center flex flex-col items-center justify-center min-h-[160px] text-slate-500 no-print">
                            <span className="text-xs font-medium text-slate-700">
                              Paruh bawah lembar masih kosong
                            </span>
                            <span className="text-[11px] text-slate-500 mt-1">
                              Tambahkan 1 nota lagi di atas agar 1 lembar A4 terisi penuh, atau langsung cetak untuk 1 nota A5.
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
