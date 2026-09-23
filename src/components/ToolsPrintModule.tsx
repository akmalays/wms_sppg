import React, { useState, useMemo } from 'react';
import {
  Printer,
  FileText,
  ClipboardList,
  Tags,
  UtensilsCrossed,
  Layers,
  Building2,
  Calendar,
  CheckCircle2,
  Download,
  Info,
  QrCode
} from 'lucide-react';
import { warehouseDb } from '../db/storage';
import { useAuth } from '../context/AuthContext';
import { ReceivingDocument, ItemMaster, EquipmentItem } from '../types/warehouse';
import { SppgLogo } from './SppgLogo';

type FormType = 'RECEIVING_FORM' | 'OPNAME_SHEET' | 'BIN_CARD' | 'KITCHEN_REQUISITION' | 'EQUIPMENT_LABEL';

export const ToolsPrintModule: React.FC = () => {
  const { currentUser } = useAuth();

  const [activeForm, setActiveForm] = useState<FormType>('RECEIVING_FORM');
  const [unitName, setUnitName] = useState<string>('SPPG Unit Pelayanan 01 - Cakung Jakarta Timur');
  const [printDate, setPrintDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Data sources
  const receivingDocs = useMemo(() => warehouseDb.getReceivings(), []);
  const items = useMemo(() => warehouseDb.getItems(), []);
  const equipment = useMemo(() => warehouseDb.getEquipment(), []);

  // Form-specific states
  const [selectedReceivingId, setSelectedReceivingId] = useState<string>(receivingDocs[0]?.id || 'BLANK');
  const [opnameLocation, setOpnameLocation] = useState<string>('ALL');
  const [selectedItemId, setSelectedItemId] = useState<string>(items[0]?.id || '');
  const [menuToday, setMenuToday] = useState<string>('Nasi Putih Pulen, Ayam Fillet Semur Kecap, Sup Sayur Buncis & Wortel, Pisang Cavendish');
  const [targetPortions, setTargetPortions] = useState<number>(1200);
  const [kitchenPic, setKitchenPic] = useState<string>('Chef Rahmat (Kepala Dapur)');

  // Selected entities
  const selectedReceivingDoc = useMemo<ReceivingDocument | null>(() => {
    if (selectedReceivingId === 'BLANK') return null;
    return receivingDocs.find(d => d.id === selectedReceivingId) || null;
  }, [receivingDocs, selectedReceivingId]);

  const selectedItem = useMemo<ItemMaster | null>(() => {
    return items.find(i => i.id === selectedItemId) || items[0] || null;
  }, [items, selectedItemId]);

  const filteredOpnameItems = useMemo(() => {
    if (opnameLocation === 'ALL') return items;
    return items.filter(i => i.location.toLowerCase().includes(opnameLocation.toLowerCase()));
  }, [items, opnameLocation]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Print-specific style injected into head */}
      <style>{`
        @media print {
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            font-size: 12pt;
          }
          nav, header, footer, .no-print {
            display: none !important;
          }
          #print-area {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .page-break {
            page-break-after: always;
          }
          .table-print th, .table-print td {
            border: 1px solid #333333 !important;
            padding: 6px 8px !important;
          }
        }
      `}</style>

      {/* Screen Control Header */}
      <div className="no-print bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <Printer className="w-4 h-4" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Pusat Formulir & Alat Cetak Fisik SPPG
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Cetak dokumen operasional lapangan standar untuk pencatatan fisik di rak gudang, ruang chiller, dan dapur pengolahan.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Cetak Dokumen Sekarang (Print / PDF)
            </button>
          </div>
        </div>

        {/* Form Category Selector */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mt-6 pt-5 border-t border-slate-100">
          <button
            onClick={() => setActiveForm('RECEIVING_FORM')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              activeForm === 'RECEIVING_FORM'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-xs'
                : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-semibold">BA Penerimaan</span>
            </div>
            <p className="text-[11px] text-slate-500 line-clamp-1">Bukti fisik serah terima supplier</p>
          </button>

          <button
            onClick={() => setActiveForm('OPNAME_SHEET')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              activeForm === 'OPNAME_SHEET'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-xs'
                : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <ClipboardList className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-semibold">Lembar Opname Fisik</span>
            </div>
            <p className="text-[11px] text-slate-500 line-clamp-1">Tally sheet hitung rak & chiller</p>
          </button>

          <button
            onClick={() => setActiveForm('BIN_CARD')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              activeForm === 'BIN_CARD'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-xs'
                : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Layers className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-semibold">Kartu Stok (Bin Card)</span>
            </div>
            <p className="text-[11px] text-slate-500 line-clamp-1">Kartu gantung mutasi fisik rak</p>
          </button>

          <button
            onClick={() => setActiveForm('KITCHEN_REQUISITION')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              activeForm === 'KITCHEN_REQUISITION'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-xs'
                : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <UtensilsCrossed className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-semibold">Bon Permintaan Dapur</span>
            </div>
            <p className="text-[11px] text-slate-500 line-clamp-1">Pengeluaran harian porsi masak</p>
          </button>

          <button
            onClick={() => setActiveForm('EQUIPMENT_LABEL')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              activeForm === 'EQUIPMENT_LABEL'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-xs'
                : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Tags className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-semibold">Label & QR Aset</span>
            </div>
            <p className="text-[11px] text-slate-500 line-clamp-1">Stiker identifikasi alat dapur</p>
          </button>
        </div>

        {/* Contextual Customizer Controls */}
        <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-slate-600 font-medium mb-1">Nama Satuan Layanan (Header)</label>
            <input
              type="text"
              value={unitName}
              onChange={e => setUnitName(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">Tanggal Dokumen Cetak</label>
            <input
              type="date"
              value={printDate}
              onChange={e => setPrintDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {activeForm === 'RECEIVING_FORM' && (
            <div className="sm:col-span-2">
              <label className="block text-slate-600 font-medium mb-1">Pilih Dokumen Penerimaan</label>
              <select
                value={selectedReceivingId}
                onChange={e => setSelectedReceivingId(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="BLANK">-- Formulir Kosong (Siap Tulis Tangan Lapangan) --</option>
                {receivingDocs.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.id} • {d.supplierName} ({d.date})
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeForm === 'OPNAME_SHEET' && (
            <div className="sm:col-span-2">
              <label className="block text-slate-600 font-medium mb-1">Filter Lokasi Rak / Ruang</label>
              <select
                value={opnameLocation}
                onChange={e => setOpnameLocation(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="ALL">Semua Lokasi & Rak Bahan</option>
                <option value="Gudang Kering">Gudang Kering (Sembako & Bumbu)</option>
                <option value="Chiller">Chiller Bahan Segar (Sayur, Buah, Telur)</option>
                <option value="Freezer">Cold Storage Freezer (Daging & Ikan)</option>
                <option value="Dapur">Area Dapur & Persiapan</option>
              </select>
            </div>
          )}

          {activeForm === 'BIN_CARD' && (
            <div className="sm:col-span-2">
              <label className="block text-slate-600 font-medium mb-1">Pilih Master Bahan Pangan</label>
              <select
                value={selectedItemId}
                onChange={e => setSelectedItemId(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {items.map(i => (
                  <option key={i.id} value={i.id}>
                    {i.id} - {i.name} ({i.location})
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeForm === 'KITCHEN_REQUISITION' && (
            <>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Target Porsi Masak</label>
                <input
                  type="number"
                  value={targetPortions}
                  onChange={e => setTargetPortions(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Juru Masak / PIC Dapur</label>
                <input
                  type="text"
                  value={kitchenPic}
                  onChange={e => setKitchenPic(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Printable Paper Document Container */}
      <div
        id="print-area"
        className="bg-white p-8 sm:p-12 rounded-2xl border border-slate-200 shadow-sm max-w-4xl mx-auto font-sans text-slate-900"
      >
        {/* =========================================================================
            HEADER RESMI SATUAN PELAYANAN PEMENUHAN GIZI (SPPG)
        ========================================================================= */}
        <div className="border-b-2 border-slate-900 pb-4 mb-6 flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <SppgLogo size="lg" variant="color" showText={false} />
            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-900 leading-tight">
                Satuan Pelayanan Pemenuhan Gizi (SPPG)
              </h1>
              <p className="text-xs text-slate-600 font-medium">{unitName}</p>
              <p className="text-[11px] text-slate-500">
                Divisi Manajemen Gudang, Logistik Pangan & Kesiapan Dapur
              </p>
            </div>
          </div>

          <div className="text-right text-[11px] text-slate-500 space-y-0.5">
            <div>
              Format: <span className="font-semibold text-slate-700">A4 Standar Lapangan</span>
            </div>
            <div>
              Tanggal Cetak: <span className="font-semibold text-slate-700">{printDate}</span>
            </div>
            <div>
              Operator: <span className="font-semibold text-slate-700">{currentUser.name}</span>
            </div>
          </div>
        </div>

        {/* =========================================================================
            1. BERITA ACARA PENERIMAAN BARANG (GOODS RECEIPT NOTE)
        ========================================================================= */}
        {activeForm === 'RECEIVING_FORM' && (
          <div className="space-y-6">
            <div className="text-center my-4">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight border-b border-slate-300 pb-1 inline-block">
                Berita Acara Penerimaan Bahan Pangan & Logistik
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Nomor Dokumen: <span className="font-mono font-semibold">{selectedReceivingDoc ? selectedReceivingDoc.id : 'GR-2026-____'}</span>
              </p>
            </div>

            {/* Document Metadata Grid */}
            <div className="grid grid-cols-2 gap-4 p-4 border border-slate-300 rounded-lg text-xs bg-slate-50/50">
              <div className="space-y-1.5">
                <div>
                  <span className="text-slate-500 font-medium w-28 inline-block">Nama Supplier:</span>
                  <span className="font-semibold text-slate-900">
                    {selectedReceivingDoc ? selectedReceivingDoc.supplierName : '___________________________'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium w-28 inline-block">No. Surat Jalan:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {selectedReceivingDoc ? selectedReceivingDoc.deliveryNoteNo || '-' : 'SJ-______________________'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium w-28 inline-block">Waktu Kedatangan:</span>
                  <span className="font-semibold text-slate-900">
                    {selectedReceivingDoc ? `${selectedReceivingDoc.date} pukul ${selectedReceivingDoc.arrivalTime} WIB` : `${printDate} pukul __:__ WIB`}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div>
                  <span className="text-slate-500 font-medium w-28 inline-block">Petugas Penerima:</span>
                  <span className="font-semibold text-slate-900">
                    {selectedReceivingDoc ? `${selectedReceivingDoc.receiverName} (${selectedReceivingDoc.receiverRole})` : `${currentUser.name} (${currentUser.role})`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium w-28 inline-block">Status Verifikasi:</span>
                  <span className="font-semibold text-slate-900">
                    {selectedReceivingDoc ? selectedReceivingDoc.status : 'VERIFIED_POSTED'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium w-28 inline-block">Suhu Chiller / Mobil:</span>
                  <span className="font-semibold text-slate-900">
                    {selectedReceivingDoc ? 'Sesuai Standar (< 4°C)' : '___ °C (Standar Dingin)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div>
              <div className="text-xs font-semibold text-slate-700 mb-1.5">
                Rincian Bahan / Barang yang Diserahterimakan:
              </div>
              <table className="w-full border-collapse border border-slate-300 text-xs table-print">
                <thead className="bg-slate-100 text-slate-800 font-semibold text-center">
                  <tr>
                    <th className="border border-slate-300 p-2 w-10">No</th>
                    <th className="border border-slate-300 p-2 text-left">Nama Bahan Pangan / Barang</th>
                    <th className="border border-slate-300 p-2 text-left">Kategori</th>
                    <th className="border border-slate-300 p-2 text-right w-24">Jumlah</th>
                    <th className="border border-slate-300 p-2 text-center w-20">Satuan</th>
                    <th className="border border-slate-300 p-2 text-left">Kondisi Fisik / Batch / Expired</th>
                    <th className="border border-slate-300 p-2 text-center w-16">QC</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedReceivingDoc && selectedReceivingDoc.lines.length > 0 ? (
                    selectedReceivingDoc.lines.map((line, idx) => (
                      <tr key={line.id}>
                        <td className="border border-slate-300 p-2 text-center font-mono">{idx + 1}</td>
                        <td className="border border-slate-300 p-2 font-semibold text-slate-900">{line.itemName}</td>
                        <td className="border border-slate-300 p-2 text-slate-700">{line.category}</td>
                        <td className="border border-slate-300 p-2 text-right font-mono font-bold text-slate-900">
                          {line.quantity}
                        </td>
                        <td className="border border-slate-300 p-2 text-center text-slate-700">{line.unit}</td>
                        <td className="border border-slate-300 p-2 text-slate-600">
                          {line.conditionNote || line.batchNumber || 'Segar, Bersih, Lolos Uji Organoleptik'}
                        </td>
                        <td className="border border-slate-300 p-2 text-center text-emerald-700 font-bold">✓</td>
                      </tr>
                    ))
                  ) : (
                    // Blank lines for hand-written operational receipt
                    Array.from({ length: 8 }).map((_, idx) => (
                      <tr key={idx} className="h-8">
                        <td className="border border-slate-300 p-2 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="border border-slate-300 p-2"></td>
                        <td className="border border-slate-300 p-2"></td>
                        <td className="border border-slate-300 p-2"></td>
                        <td className="border border-slate-300 p-2"></td>
                        <td className="border border-slate-300 p-2"></td>
                        <td className="border border-slate-300 p-2"></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Notes Section */}
            <div className="p-3 border border-slate-300 rounded text-xs space-y-1">
              <span className="font-semibold text-slate-800">Catatan Pemeriksaan Mutu Fisik:</span>
              <p className="text-slate-600 italic">
                {selectedReceivingDoc?.notes ||
                  'Bahan makanan diterima dalam kemasan higienis, bersih dari cemaran fisik, bau normal, dan suhu simpan rantai dingin terjaga.'}
              </p>
            </div>

            {/* Signatures Section */}
            <div className="grid grid-cols-2 gap-8 pt-6">
              <div className="border border-slate-300 rounded p-3 text-center">
                <p className="text-xs text-slate-600 font-medium">Pihak Pengirim / Pemasok</p>
                <div className="h-24 flex items-center justify-center">
                  {selectedReceivingDoc?.supplierSignature?.startsWith('data:image') ? (
                    <img
                      src={selectedReceivingDoc.supplierSignature}
                      alt="Tanda Tangan Pengirim"
                      className="max-h-20 object-contain"
                    />
                  ) : (
                    <span className="text-slate-400 text-xs italic">[ Tanda Tangan & Nama Terang ]</span>
                  )}
                </div>
                <div className="border-t border-slate-300 pt-1 text-xs font-semibold text-slate-900">
                  {selectedReceivingDoc ? selectedReceivingDoc.supplierName : '( ................................................ )'}
                </div>
              </div>

              <div className="border border-slate-300 rounded p-3 text-center">
                <p className="text-xs text-slate-600 font-medium">Petugas Penerima Gudang SPPG</p>
                <div className="h-24 flex items-center justify-center">
                  {selectedReceivingDoc?.receiverSignature?.startsWith('data:image') ? (
                    <img
                      src={selectedReceivingDoc.receiverSignature}
                      alt="Tanda Tangan Penerima"
                      className="max-h-20 object-contain"
                    />
                  ) : (
                    <span className="text-slate-400 text-xs italic">[ Tanda Tangan & Stempel SPPG ]</span>
                  )}
                </div>
                <div className="border-t border-slate-300 pt-1 text-xs font-semibold text-slate-900">
                  {selectedReceivingDoc ? `${selectedReceivingDoc.receiverName} (${selectedReceivingDoc.receiverRole})` : `( ${currentUser.name} )`}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            2. LEMBAR KERJA FISIK STOCK OPNAME (TALLY SHEET)
        ========================================================================= */}
        {activeForm === 'OPNAME_SHEET' && (
          <div className="space-y-6">
            <div className="text-center my-4">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight border-b border-slate-300 pb-1 inline-block">
                Lembar Kerja Hitung Fisik (Stock Opname Tally Sheet)
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Area: <span className="font-semibold">{opnameLocation === 'ALL' ? 'Seluruh Gudang & Chiller' : opnameLocation}</span> • Tanggal: <span className="font-semibold">{printDate}</span>
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-300 rounded text-xs grid grid-cols-3 gap-3">
              <div>
                <span className="text-slate-500">Tim Penghitung (Checker):</span>
                <div className="font-semibold text-slate-900">1. ........................................</div>
              </div>
              <div>
                <span className="text-slate-500">Saksi / Supervisor:</span>
                <div className="font-semibold text-slate-900">2. ........................................</div>
              </div>
              <div>
                <span className="text-slate-500">Target Rekonsiliasi:</span>
                <div className="font-semibold text-slate-900">{filteredOpnameItems.length} SKU Bahan</div>
              </div>
            </div>

            <table className="w-full border-collapse border border-slate-300 text-xs table-print">
              <thead className="bg-slate-100 text-slate-800 font-semibold">
                <tr>
                  <th className="border border-slate-300 p-2 w-8 text-center">No</th>
                  <th className="border border-slate-300 p-2 text-left w-24">Kode SKU</th>
                  <th className="border border-slate-300 p-2 text-left">Nama Bahan Makanan</th>
                  <th className="border border-slate-300 p-2 text-left w-36">Lokasi Rak/Box</th>
                  <th className="border border-slate-300 p-2 text-center w-16">Satuan</th>
                  <th className="border border-slate-300 p-2 text-right w-20">Stok Sistem</th>
                  <th className="border border-slate-300 p-2 text-center w-28 bg-emerald-50/70">
                    Hitung Fisik (Tally)
                  </th>
                  <th className="border border-slate-300 p-2 text-left w-36">Kondisi / Catatan</th>
                </tr>
              </thead>
              <tbody>
                {filteredOpnameItems.map((item, idx) => (
                  <tr key={item.id} className="h-9">
                    <td className="border border-slate-300 p-2 text-center font-mono text-slate-500">{idx + 1}</td>
                    <td className="border border-slate-300 p-2 font-mono font-semibold text-slate-700">{item.id}</td>
                    <td className="border border-slate-300 p-2 font-semibold text-slate-900">{item.name}</td>
                    <td className="border border-slate-300 p-2 text-slate-600">{item.location}</td>
                    <td className="border border-slate-300 p-2 text-center text-slate-700">{item.baseUnit}</td>
                    <td className="border border-slate-300 p-2 text-right font-mono font-semibold text-slate-500">
                      {item.currentStock}
                    </td>
                    <td className="border border-slate-300 p-2 text-center bg-emerald-50/30">
                      {/* Blank box for pen writing */}
                    </td>
                    <td className="border border-slate-300 p-2 text-slate-400"></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs">
              <div>
                <p className="text-slate-600">Petugas Hitung Lapangan</p>
                <div className="h-20 flex items-end justify-center">
                  <div className="border-t border-slate-400 w-48 pt-1 font-semibold text-slate-800">
                    ( .................................................. )
                  </div>
                </div>
              </div>
              <div>
                <p className="text-slate-600">Warehouse Manager / Kepala Gudang</p>
                <div className="h-20 flex items-end justify-center">
                  <div className="border-t border-slate-400 w-48 pt-1 font-semibold text-slate-800">
                    ( .................................................. )
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            3. KARTU STOK FISIK / BIN CARD (RAK & CHILLER)
        ========================================================================= */}
        {activeForm === 'BIN_CARD' && selectedItem && (
          <div className="space-y-6">
            <div className="text-center my-4">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight border-b border-slate-300 pb-1 inline-block">
                Kartu Stok Fisik Gudang & Chiller (Bin Card)
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Ditempelkan pada rak penyimpanan atau keranjang bahan baku di gudang
              </p>
            </div>

            {/* Card Header Spec */}
            <div className="grid grid-cols-2 gap-3 p-3.5 border-2 border-slate-900 rounded-lg text-xs bg-slate-50">
              <div className="space-y-1">
                <div>
                  <span className="text-slate-500 w-28 inline-block">Kode Bahan (SKU):</span>
                  <span className="font-mono font-bold text-slate-900">{selectedItem.id}</span>
                </div>
                <div>
                  <span className="text-slate-500 w-28 inline-block">Nama Bahan:</span>
                  <span className="font-bold text-slate-900 text-sm">{selectedItem.name}</span>
                </div>
                <div>
                  <span className="text-slate-500 w-28 inline-block">Kategori Pangan:</span>
                  <span className="font-semibold text-slate-800">{selectedItem.category}</span>
                </div>
              </div>

              <div className="space-y-1">
                <div>
                  <span className="text-slate-500 w-32 inline-block">Lokasi Simpan:</span>
                  <span className="font-bold text-slate-900">{selectedItem.location}</span>
                </div>
                <div>
                  <span className="text-slate-500 w-32 inline-block">Satuan Pengukuran:</span>
                  <span className="font-semibold text-slate-800">{selectedItem.baseUnit}</span>
                </div>
                <div>
                  <span className="text-slate-500 w-32 inline-block">Batas Minimum:</span>
                  <span className="font-mono font-bold text-amber-800">{selectedItem.minimumStock} {selectedItem.baseUnit}</span>
                </div>
              </div>
            </div>

            {/* Manual Tally Table */}
            <table className="w-full border-collapse border border-slate-900 text-xs table-print">
              <thead className="bg-slate-200 text-slate-900 font-bold text-center">
                <tr>
                  <th className="border border-slate-900 p-2 w-24">Tanggal</th>
                  <th className="border border-slate-900 p-2 text-left">No. Bukti / Dokumen Ref</th>
                  <th className="border border-slate-900 p-2 text-right w-20">Masuk (+)</th>
                  <th className="border border-slate-900 p-2 text-right w-20">Keluar (-)</th>
                  <th className="border border-slate-900 p-2 text-right w-24">Sisa Saldo</th>
                  <th className="border border-slate-900 p-2 text-center w-24">Paraf Petugas</th>
                </tr>
              </thead>
              <tbody>
                {/* Initial Balance Row */}
                <tr className="bg-slate-50 font-semibold">
                  <td className="border border-slate-900 p-2 text-center font-mono">{printDate}</td>
                  <td className="border border-slate-900 p-2">Saldo Awal Cetak Kartu</td>
                  <td className="border border-slate-900 p-2 text-right font-mono">-</td>
                  <td className="border border-slate-900 p-2 text-right font-mono">-</td>
                  <td className="border border-slate-900 p-2 text-right font-mono font-bold">{selectedItem.currentStock}</td>
                  <td className="border border-slate-900 p-2 text-center text-slate-500">Initial</td>
                </tr>

                {/* 10 Empty Grid Rows for Hand Writing */}
                {Array.from({ length: 12 }).map((_, idx) => (
                  <tr key={idx} className="h-8">
                    <td className="border border-slate-900 p-2 text-center"></td>
                    <td className="border border-slate-900 p-2"></td>
                    <td className="border border-slate-900 p-2"></td>
                    <td className="border border-slate-900 p-2"></td>
                    <td className="border border-slate-900 p-2"></td>
                    <td className="border border-slate-900 p-2"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* =========================================================================
            4. FORMULIR PERMINTAAN BAHAN MASAK DAPUR (KITCHEN REQUISITION)
        ========================================================================= */}
        {activeForm === 'KITCHEN_REQUISITION' && (
          <div className="space-y-6">
            <div className="text-center my-4">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight border-b border-slate-300 pb-1 inline-block">
                Bon Pengeluaran & Permintaan Bahan Pangan Dapur
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Dokumen Serah Terima Bahan Gudang/Chiller ke Tim Olahan Masak SPPG
              </p>
            </div>

            <div className="p-4 border border-slate-300 rounded-lg text-xs bg-slate-50 space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-500 font-medium">Hari / Tanggal Pengolahan:</span>
                  <div className="font-bold text-slate-900 text-sm mt-0.5">{printDate}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Target Porsi Anak Penerima:</span>
                  <div className="font-bold text-emerald-800 text-sm mt-0.5">
                    {targetPortions.toLocaleString('id-ID')} Porsi Makan Bergizi
                  </div>
                </div>
              </div>
              <div className="border-t border-slate-200 pt-2">
                <span className="text-slate-500 font-medium">Menu Masakan Hari Ini:</span>
                <div className="font-semibold text-slate-900 mt-0.5">{menuToday}</div>
              </div>
            </div>

            <table className="w-full border-collapse border border-slate-300 text-xs table-print">
              <thead className="bg-slate-100 text-slate-800 font-semibold">
                <tr>
                  <th className="border border-slate-300 p-2 w-8 text-center">No</th>
                  <th className="border border-slate-300 p-2 text-left">Nama Bahan Pangan</th>
                  <th className="border border-slate-300 p-2 text-left w-32">Lokasi Ambil</th>
                  <th className="border border-slate-300 p-2 text-right w-24">Jumlah Diminta</th>
                  <th className="border border-slate-300 p-2 text-right w-24">Jumlah Diserahkan</th>
                  <th className="border border-slate-300 p-2 text-center w-16">Satuan</th>
                  <th className="border border-slate-300 p-2 text-left">Pemeriksaan Suhu/Mutu</th>
                </tr>
              </thead>
              <tbody>
                {items.slice(0, 8).map((item, idx) => (
                  <tr key={item.id} className="h-8">
                    <td className="border border-slate-300 p-2 text-center font-mono">{idx + 1}</td>
                    <td className="border border-slate-300 p-2 font-semibold text-slate-900">{item.name}</td>
                    <td className="border border-slate-300 p-2 text-slate-600">{item.location}</td>
                    <td className="border border-slate-300 p-2 text-right font-mono font-semibold text-slate-700">
                      {Math.round(item.currentStock * 0.35)}
                    </td>
                    <td className="border border-slate-300 p-2 text-right font-mono font-bold text-emerald-800">
                      {Math.round(item.currentStock * 0.35)}
                    </td>
                    <td className="border border-slate-300 p-2 text-center text-slate-700">{item.baseUnit}</td>
                    <td className="border border-slate-300 p-2 text-slate-600">Suhu Aman, Baik</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="grid grid-cols-3 gap-4 pt-8 text-center text-xs">
              <div>
                <p className="text-slate-600">Diminta Oleh (Koki/Dapur)</p>
                <div className="h-20 flex items-end justify-center">
                  <div className="border-t border-slate-400 w-40 pt-1 font-semibold text-slate-800">
                    {kitchenPic}
                  </div>
                </div>
              </div>
              <div>
                <p className="text-slate-600">Diserahkan Oleh (Gudang)</p>
                <div className="h-20 flex items-end justify-center">
                  <div className="border-t border-slate-400 w-40 pt-1 font-semibold text-slate-800">
                    {currentUser.name}
                  </div>
                </div>
              </div>
              <div>
                <p className="text-slate-600">Mengetahui (Kepala Unit)</p>
                <div className="h-20 flex items-end justify-center">
                  <div className="border-t border-slate-400 w-40 pt-1 font-semibold text-slate-800">
                    Dr. Siti Rahma (Manager)
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            5. LABEL & QR CODE PERALATAN MASAK (EQUIPMENT TAGS)
        ========================================================================= */}
        {activeForm === 'EQUIPMENT_LABEL' && (
          <div className="space-y-6">
            <div className="text-center my-4">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight border-b border-slate-300 pb-1 inline-block">
                Stiker & Label Identifikasi Aset Peralatan Dapur SPPG
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Cetak pada kertas stiker / HVS untuk ditempelkan pada mesin dan alat kerja dapur
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {equipment.slice(0, 6).map(eq => (
                <div
                  key={eq.id}
                  className="border-2 border-slate-800 rounded-xl p-4 bg-white flex items-start justify-between gap-3 shadow-2xs page-break"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-emerald-800">SPPG Gudang & Dapur</span>
                      <span className="text-[10px] text-slate-400">• Aset Inventaris</span>
                    </div>
                    <div className="font-mono font-bold text-xs text-slate-900">{eq.id}</div>
                    <div className="font-bold text-sm text-slate-900 leading-tight">{eq.name}</div>
                    <div className="text-[11px] text-slate-600">
                      Lokasi: <span className="font-medium text-slate-800">{eq.location}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200">
                      Terakhir Diperiksa: {eq.lastInspectedDate} • Status: {eq.condition}
                    </div>
                  </div>

                  <div className="w-16 h-16 rounded-lg bg-slate-900 text-white flex flex-col items-center justify-center shrink-0">
                    <QrCode className="w-8 h-8" />
                    <span className="text-[8px] font-mono mt-0.5">SCAN</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
