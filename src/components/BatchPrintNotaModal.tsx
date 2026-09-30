import React, { useState } from 'react';
import {
  Printer,
  X,
  Trash2,
  Scissors,
  Layers,
  FileText,
  Plus,
  ArrowRight,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { PurchaseOrderNota } from '../types/warehouse';
import logoSppgImg from '../assets/logo sppg.png';
import ttdRizkyImg from '../assets/ttd rizky.png';

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

  if (!isOpen) return null;

  // Filter nota-nota yang ada di pool
  const poolNotas: PurchaseOrderNota[] = poolNotaIds
    .map(id => allNotas.find(n => n.id === id || n.poNumber === id))
    .filter((n): n is PurchaseOrderNota => n !== undefined);

  // Nota-nota yang belum ada di pool untuk opsi penambahan cepat
  const availableToAdd = allNotas.filter(n => !poolNotaIds.includes(n.id) && !poolNotaIds.includes(n.poNumber));

  // Kelompokkan nota menjadi pasangan 2 nota per lembar kertas A4
  const pairedPages: [PurchaseOrderNota, PurchaseOrderNota | null][] = [];
  for (let i = 0; i < poolNotas.length; i += 2) {
    pairedPages.push([poolNotas[i], poolNotas[i + 1] || null]);
  }

  const totalSheetsNeeded = pairedPages.length;
  const sheetsSaved = Math.max(0, poolNotas.length - totalSheetsNeeded);

  const handlePrintAll = () => {
    window.print();
  };

  const handleAddSelected = () => {
    if (!selectedToAdd) return;
    onAddToPool(selectedToAdd);
    setSelectedToAdd('');
  };

  // Render 1 kartu nota untuk pratinjau lembar kertas A4 (compact mode)
  const renderNotaCard = (nota: PurchaseOrderNota, positionLabel: string) => {
    const displayDeliveryDate = formatDateWithDashes(nota.deliveryDate || nota.date);
    const displaySignDate = formatDateIndonesian(nota.date || new Date().toISOString().slice(0, 10));

    return (
      <div className="nota-compact-card bg-white text-black p-4 sm:p-5 font-sans flex flex-col justify-between rounded-lg border border-slate-200 print:border-none print:p-0">
        <div>
          {/* Header Penanda Posisi */}
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-200 text-[10px] text-slate-500">
            <span className="font-semibold text-slate-700 tracking-tight">
              {positionLabel} • {nota.supplierName}
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[9px] text-slate-400">
                Badan Gizi Nasional • SPPG Jeru Tumpang
              </span>
              {onOpenSingleNota && (
                <button
                  type="button"
                  onClick={() => onOpenSingleNota(nota)}
                  className="no-print text-sky-600 hover:text-sky-800 text-[10px] font-medium flex items-center gap-0.5 cursor-pointer ml-1"
                  title="Lihat / Edit Dokumen Ini Sendiri"
                >
                  <span>Edit</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          </div>

          {/* 1. KOP SURAT RESMI BADAN GIZI NASIONAL */}
          <div className="flex items-center gap-3 pb-1.5 border-b-2 border-black">
            <div className="shrink-0">
              <img
                src={logoSppgImg}
                alt="Logo Badan Gizi Nasional"
                className="w-11 h-11 sm:w-13 sm:h-13 object-contain"
              />
            </div>
            <div className="flex-1 text-center pr-8 sm:pr-10">
              <h1 className="text-xs sm:text-sm font-bold text-black tracking-normal leading-tight">
                BADAN GIZI NASIONAL
              </h1>
              <p className="text-[9.5px] sm:text-[10px] text-black leading-snug mt-0.5">
                Jl. Kebon Sirih No.1, RT.01/RW.07, Kb. Dirih, Kec. Menteng,
              </p>
              <p className="text-[9.5px] sm:text-[10px] text-black leading-snug">
                Kota Jakarta Pusat, Daerah Khusus Ibukota Jakarta 10340
              </p>
            </div>
          </div>

          {/* 2. JUDUL DOKUMEN & NOMOR PO */}
          <div className="text-center my-2">
            <h2 className="text-[11px] sm:text-xs font-bold text-black uppercase tracking-normal">
              NOTA PESANAN BAHAN MAKANAN DAN OPERASIONAL
            </h2>
            <div className="text-[11px] font-semibold text-black mt-0.5 flex items-center justify-center gap-1">
              {!nota.poNumber?.trim().toUpperCase().startsWith('NO.') && <span>NO.</span>}
              <span className="font-bold text-black font-mono">
                {nota.poNumber}
              </span>
            </div>
          </div>

          {/* 3. METADATA HEADER */}
          <div className="my-2 text-[11px] space-y-0.5 text-black font-normal">
            <div className="flex items-center">
              <span className="w-20 shrink-0 font-medium">Dari</span>
              <span className="w-3 text-center">:</span>
              <span className="font-semibold text-black">SPPG MALANG TUMPANG JERU</span>
            </div>
            <div className="flex items-center">
              <span className="w-20 shrink-0 font-medium">Kepada</span>
              <span className="w-3 text-center">:</span>
              <span className="font-semibold text-black">{nota.supplierName || 'Pihak Rekanan'}</span>
            </div>
            <div className="flex items-center">
              <span className="w-20 shrink-0 font-medium">Alamat</span>
              <span className="w-3 text-center">:</span>
              <span className="text-black truncate">{nota.supplierAddress || 'Kec. Pakis, Kab. Malang'}</span>
            </div>
            <div className="flex items-center">
              <span className="w-20 shrink-0 font-medium">Pengiriman</span>
              <span className="w-3 text-center">:</span>
              <span className="font-medium text-black">
                {displayDeliveryDate || '27-September-2026'} (Jam 12.00-15.00)
              </span>
            </div>
          </div>

          {/* 4. TABEL RINCIAN BARANG */}
          <div className="my-2">
            <table className="w-full text-[10.5px] border-collapse border border-black table-po-print">
              <thead>
                <tr className="bg-[#5b9bd5] text-black font-bold border-b border-black table-header-bgn">
                  <th className="border border-black py-1 px-1.5 w-8 text-center">No</th>
                  <th className="border border-black py-1 px-2.5 text-center">Uraian Jenis Bahan Makanan</th>
                  <th className="border border-black py-1 px-2 w-24 text-center leading-tight">
                    Banyaknya<br />(Angka)
                  </th>
                  <th className="border border-black py-1 px-1.5 w-14 text-center">Satuan</th>
                  <th className="border border-black py-1 px-2 w-24 text-center">Harga</th>
                  <th className="border border-black py-1 px-2 w-28 text-center">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {nota.items.map((it, idx) => {
                  const lineTotal = it.subtotal || it.quantity * it.unitPrice;
                  const hasTotal = lineTotal && lineTotal > 0;
                  return (
                    <tr key={it.id || idx}>
                      <td className="border border-black py-1 px-1.5 text-center font-normal">{idx + 1}</td>
                      <td className="border border-black py-1 px-2.5 text-left font-normal">{it.name}</td>
                      <td className="border border-black py-1 px-1.5 text-center font-normal">{it.quantity}</td>
                      <td className="border border-black py-1 px-1.5 text-center font-normal">{it.unit}</td>
                      <td className="border border-black py-1 px-2 text-right tabular-nums font-normal">
                        <div className="flex items-center justify-between">
                          <span>Rp</span>
                          <span>{it.unitPrice > 0 ? it.unitPrice.toLocaleString('id-ID') : '-'}</span>
                        </div>
                      </td>
                      <td className="border border-black py-1 px-2 text-right tabular-nums font-normal">
                        <div className="flex items-center justify-between">
                          <span>Rp</span>
                          <span>{hasTotal ? lineTotal.toLocaleString('id-ID') : '-'}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {/* BARIS TOTAL */}
                <tr className="border-t border-black font-bold">
                  <td colSpan={4} className="border border-black py-1 px-2 text-center font-bold">TOTAL</td>
                  <td className="border border-black py-1 px-2 text-left font-bold">Rp</td>
                  <td className="border border-black py-1 px-2 text-right font-bold tabular-nums">
                    {nota.grandTotal > 0 ? `${nota.grandTotal.toLocaleString('id-ID')} -` : '-'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 5. BAGIAN BAWAH: CATATAN & TTD */}
          <div className="grid grid-cols-12 gap-3 mt-1 pt-0.5 text-[10px] text-black">
            <div className="col-span-7 flex items-start gap-1 leading-snug text-[9.5px]">
              <span className="font-bold shrink-0">Catatan</span>
              <span className="font-bold shrink-0">:</span>
              <div className="space-y-0.5 text-black">
                <div>1. Harga sudah termasuk ongkos kirim (ongkir).</div>
                <div>2. Apabila barang yang diterima tidak sesuai atau rusak, maka pihak supplier akan mengganti barang tersebut sesuai kesepakatan</div>
                <div>3. Pengiriman barang dilakukan sesuai jadwal yang telah ditentukan oleh pihak pembeli.</div>
                {nota.notes && (
                  <div className="pt-0.5 text-slate-700 italic">Catatan tambahan: {nota.notes}</div>
                )}
              </div>
            </div>

            <div className="col-span-5 text-center flex flex-col items-center justify-start">
              <div className="text-[10px] font-medium text-black">
                Malang, {displaySignDate}
              </div>
              <div className="font-bold text-black mt-0.5 leading-tight text-[10px]">
                <div>Kepala Satuan Pelayanan</div>
                <div>Pemenuhan Gizi</div>
              </div>
              <div className="my-0.5 h-11 sm:h-12 flex items-center justify-center">
                <img
                  src={ttdRizkyImg}
                  alt="Tanda Tangan Rizky"
                  className="h-11 sm:h-12 w-auto object-contain"
                />
              </div>
              <div className="mt-0.5 font-bold text-black underline underline-offset-2 text-[11px]">
                {nota.approvedBy || 'Rizky Iman Ramdhan, S.Pd'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      {/* Print Specific CSS untuk Batch Pool */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 8mm;
          }
          body * {
            visibility: hidden !important;
          }
          #print-batch-pool, #print-batch-pool * {
            visibility: visible !important;
          }
          #print-batch-pool {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          .batch-a4-page {
            page-break-after: always !important;
            break-after: page !important;
            min-height: 275mm !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            padding: 2mm 0 !important;
          }
          .batch-a4-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .nota-compact-card {
            page-break-inside: avoid !important;
            border: none !important;
            box-shadow: none !important;
            padding: 2mm 0 !important;
          }
          .cut-line-print {
            margin: 4mm 0 !important;
            padding: 1mm 0 !important;
          }
          .no-print {
            display: none !important;
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

      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 shrink-0 no-print">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shadow-2xs">
              <Layers className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">
                  Pool Antrean Cetak Nota Pesanan (PO)
                </h2>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {poolNotas.length} Nota Ditampung
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Penggabungan cetak otomatis: 1 lembar kertas A4 memuat 2 nota berbeda (Atas & Bawah)
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            {/* View Tab Switcher */}
            <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-lg border border-slate-300">
              <button
                type="button"
                onClick={() => setActiveTab('PREVIEW')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'PREVIEW'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Pratinjau Kertas A4</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('LIST')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'LIST'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Daftar Antrean ({poolNotas.length})</span>
              </button>
            </div>

            {poolNotas.length > 0 && (
              <button
                type="button"
                onClick={onClearPool}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:text-rose-600 hover:bg-rose-50 text-xs font-medium transition-colors cursor-pointer"
                title="Kosongkan semua nota dari antrean cetak"
              >
                Kosongkan Pool
              </button>
            )}

            <button
              type="button"
              onClick={handlePrintAll}
              disabled={poolNotas.length === 0}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95"
              title="Cetak seluruh nota dalam antrean sekaligus"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak {poolNotas.length} Nota ({totalSheetsNeeded} Kertas A4)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer ml-1"
              title="Tutup Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar Hemat Kertas Banner & Quick Add */}
        <div className="bg-emerald-50/90 border-b border-emerald-100 px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs no-print">
          <div className="flex items-center gap-2 text-emerald-900">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Efisiensi Kertas:</strong> {poolNotas.length} nota akan dicetak pada{' '}
              <span className="font-bold underline">{totalSheetsNeeded} lembar A4</span>{' '}
              {sheetsSaved > 0 && (
                <span className="text-emerald-700 font-semibold">(Menghemat {sheetsSaved} lembar kertas fisik!)</span>
              )}
            </span>
          </div>

          {/* Quick Add Dropdown */}
          {availableToAdd.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-slate-600 text-[11px] font-medium">Tambah nota lain:</span>
              <select
                value={selectedToAdd}
                onChange={e => setSelectedToAdd(e.target.value)}
                className="text-[11px] bg-white border border-slate-300 rounded-lg px-2 py-1 focus:outline-none cursor-pointer max-w-[240px]"
              >
                <option value="">-- Pilih Nota Tambahan --</option>
                {availableToAdd.map(n => (
                  <option key={n.id} value={n.id}>
                    {n.poNumber} ({n.supplierName} - Rp {n.grandTotal.toLocaleString('id-ID')})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddSelected}
                disabled={!selectedToAdd}
                className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-[11px] font-semibold cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Tambah</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/70 flex justify-center">
          {poolNotas.length === 0 ? (
            /* Tampilan Kosong */
            <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-slate-200 text-center my-auto shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
                <Layers className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-800 mb-1">
                Antrean Pool Cetak Masih Kosong
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed mb-5">
                Kumpulkan nota-nota pesanan kecil yang siap dicetak dari daftar penerimaan. Sistem akan
                menggabungkan setiap 2 nota berbeda dalam 1 lembar kertas A4 agar hemat kertas.
              </p>
              {availableToAdd.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-slate-700 text-left">
                    Pilih nota yang tersedia untuk dimasukkan ke pool:
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl text-left">
                    {availableToAdd.map(n => (
                      <div
                        key={n.id}
                        className="p-2.5 flex items-center justify-between hover:bg-slate-50 text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-800 font-mono text-[11px]">
                            {n.poNumber}
                          </div>
                          <div className="text-slate-500 text-[10px]">
                            {n.supplierName} • {n.items.length} item • Rp {n.grandTotal.toLocaleString('id-ID')}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onAddToPool(n.id)}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Pilih</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  Belum ada nota pesanan yang dibuat. Buat nota terlebih dahulu di modul penerimaan.
                </p>
              )}
            </div>
          ) : activeTab === 'LIST' ? (
            /* Tab Tampilan Daftar Antrean */
            <div className="max-w-3xl w-full bg-white rounded-2xl p-5 border border-slate-200 shadow-xs h-fit space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Daftar Nota dalam Antrean ({poolNotas.length} Nota)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Urutan nota yang akan digabungkan berpasangan saat dicetak ke kertas A4
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('PREVIEW')}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1.5"
                >
                  <span>Lihat Pratinjau Kertas</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {poolNotas.map((n, idx) => {
                  const sheetNum = Math.floor(idx / 2) + 1;
                  const posInSheet = idx % 2 === 0 ? 'Bagian Atas' : 'Bagian Bawah';

                  return (
                    <div
                      key={n.id}
                      className="p-3.5 flex items-center justify-between hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs flex items-center justify-center border border-emerald-200">
                          {idx + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 font-mono text-xs">
                              {n.poNumber}
                            </span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                              Kertas #{sheetNum} ({posInSheet})
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 mt-0.5">
                            <span className="font-semibold text-slate-800">{n.supplierName}</span> •{' '}
                            <span>{formatDateIndonesian(n.date)}</span> •{' '}
                            <span className="font-mono font-semibold text-emerald-700">
                              Rp {n.grandTotal.toLocaleString('id-ID')}
                            </span>{' '}
                            ({n.items.length} item)
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {onOpenSingleNota && (
                          <button
                            type="button"
                            onClick={() => onOpenSingleNota(n)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
                            title="Buka / Edit Nota"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onRemoveFromPool(n.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Hapus dari antrean pool"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Tab Tampilan Pratinjau Kertas A4 (Pair Layout) */
            <div id="print-batch-pool" className="max-w-[850px] w-full flex flex-col gap-6">
              {pairedPages.map((pagePair, pageIdx) => {
                const [topNota, bottomNota] = pagePair;
                const pageNumber = pageIdx + 1;

                return (
                  <div
                    key={`page-${pageIdx}`}
                    className="batch-a4-page bg-white p-5 sm:p-8 rounded-xl shadow-md border border-slate-300 flex flex-col justify-between"
                  >
                    {/* Header Penanda Halaman Fisik A4 di Layar */}
                    <div className="no-print flex items-center justify-between pb-2 mb-2 border-b border-dashed border-slate-300 text-xs text-slate-500">
                      <span className="font-bold text-slate-700 flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-emerald-600" />
                        Lembar Kertas A4 #{pageNumber} dari {totalSheetsNeeded}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Memuat 2 nota berbeda untuk digunting menjadi ukuran A5
                      </span>
                    </div>

                    {/* 1. NOTA BAGIAN ATAS */}
                    {renderNotaCard(topNota, `Nota 1 (Bagian Atas Kertas #${pageNumber})`)}

                    {/* GARIS POTONG GUNTING DI TENGAH LEMBAR A4 */}
                    <div className="py-2.5 flex items-center justify-center gap-2 text-slate-400 select-none cut-line-print">
                      <Scissors className="w-3.5 h-3.5 rotate-90 shrink-0 text-slate-500" />
                      <span className="border-b border-dashed border-slate-400 flex-1" />
                      <span className="px-2.5 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-700 text-[9.5px] font-medium tracking-tight">
                        Potong di sini (Batas Gunting Kertas A5)
                      </span>
                      <span className="border-b border-dashed border-slate-400 flex-1" />
                      <Scissors className="w-3.5 h-3.5 -rotate-90 shrink-0 text-slate-500" />
                    </div>

                    {/* 2. NOTA BAGIAN BAWAH */}
                    {bottomNota ? (
                      renderNotaCard(bottomNota, `Nota 2 (Bagian Bawah Kertas #${pageNumber})`)
                    ) : (
                      /* Jika jumlah ganjil, bagian bawah berupa area kosong siap potong */
                      <div className="p-8 border-2 border-dashed border-slate-200 rounded-lg text-center flex flex-col items-center justify-center min-h-[220px] text-slate-400 no-print">
                        <Scissors className="w-6 h-6 mb-2 text-slate-300" />
                        <span className="text-xs font-semibold text-slate-500">
                          Setengah Kertas Bagian Bawah Kosong
                        </span>
                        <span className="text-[11px] text-slate-400 mt-0.5">
                          Jumlah nota ganjil ({poolNotas.length} nota). Anda dapat memotong kertas A4 ini menjadi A5
                          atau menambahkan 1 nota lagi ke pool.
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
