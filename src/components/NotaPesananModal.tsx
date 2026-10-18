import React, { useState, useEffect, useMemo } from 'react';
import {
  Printer,
  X,
  Plus,
  Trash2,
  Check,
  Save,
  Copy,
  FileText,
  Scissors,
  Layers,
} from 'lucide-react';
import {
  PurchaseOrderNota,
  PurchaseOrderItem,
  Supplier,
  User,
} from '../types/warehouse';
import logoSppgImg from '../assets/logo sppg.png';
import ttdRizkyImg from '../assets/ttd rizky.png';
import { buildItemReference } from '../utils/itemReference';
import { normalizeToStandardCategory } from '../utils/categoryStandards';
import { syncPoNumberWithDate } from '../utils/poNumberGenerator';
import { useToast } from '../context/ToastContext';
import { warehouseDb } from '../db/storage';
import { normalizeQtyForUnit } from '../utils/unitConversion';

export interface NotaPesananModalProps {
  isOpen: boolean;
  onClose: () => void;
  nota: PurchaseOrderNota;
  onSaveNota: (updatedNota: PurchaseOrderNota) => void;
  onDeleteNota?: (nota: PurchaseOrderNota) => void;
  initialTab?: 'FORM' | 'PREVIEW';
  suppliers: Supplier[];
  currentUser: User;
  onSupplierAdded?: (newSupplier: Supplier) => void;
  isInPool?: boolean;
  onTogglePool?: (notaId: string) => void;
  onOpenBatchPool?: () => void;
  poolCount?: number;
}

function formatDateIndonesian(dateStr: string): string {
  if (!dateStr) return '';
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
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

function formatDateWithDashes(dateStr: string): string {
  if (!dateStr) return '';
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
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

export const NotaPesananModal: React.FC<NotaPesananModalProps> = ({
  isOpen,
  onClose,
  nota,
  onSaveNota,
  onDeleteNota,
  suppliers,
  currentUser,
  isInPool = false,
  onTogglePool,
  onOpenBatchPool,
  poolCount = 0,
}) => {
  const toast = useToast();
  const [formData, setFormData] = useState<PurchaseOrderNota>(nota);
  const [saveToast, setSaveToast] = useState(false);

  // Mode layout cetak: SINGLE = 1 lembar A4 standar; DOUBLE = 2 rangkap dalam 1 lembar A4 (hemat kertas)
  const [printLayout, setPrintLayout] = useState<'SINGLE' | 'DOUBLE'>(
    (nota.items?.length || 0) <= 5 ? 'DOUBLE' : 'SINGLE'
  );

  // Field khusus format resmi BGN
  const [deliveryFrom, setDeliveryFrom] = useState('SPPG MLG TUMPANG JERU');
  const [deliveryTimeNote, setDeliveryTimeNote] = useState('(Jam 12.00-15.00)');
  const [signerName, setSignerName] = useState(
    formData.approvedBy && !formData.approvedBy.includes('Siti Rahma')
      ? formData.approvedBy
      : warehouseDb.getSppgHeadName()
  );
  const [signerRole1, setSignerRole1] = useState('Kepala Satuan Pelayanan');
  const [signerRole2, setSignerRole2] = useState('Pemenuhan Gizi');

  // Keyboard Accessibility: Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Sync state when incoming nota changes
  useEffect(() => {
    setFormData(nota);
    if (nota.approvedBy && !nota.approvedBy.includes('Siti Rahma')) {
      setSignerName(nota.approvedBy);
    } else {
      setSignerName(warehouseDb.getSppgHeadName());
    }
    // Jika jumlah item ringkas (1-5), aktifkan mode hemat kertas (2 rangkap) secara cerdas
    if ((nota.items?.length || 0) <= 5) {
      setPrintLayout('DOUBLE');
    }
  }, [nota]);

  if (!isOpen) return null;

  // Auto-calculate subtotal and grandTotal
  const recalculateTotals = (items: PurchaseOrderItem[]) => {
    const subtotal = items.reduce((sum, it) => sum + (it.subtotal || it.quantity * it.unitPrice), 0);
    const grandTotal = Math.max(0, subtotal - (formData.discount || 0) + (formData.tax || 0));
    return {
      subtotal,
      grandTotal,
    };
  };

  const handleFieldChange = (field: keyof PurchaseOrderNota, value: any) => {
    setFormData(prev => {
      const next = {
        ...prev,
        [field]: value,
      };
      if (field === 'date' && value) {
        next.poNumber = syncPoNumberWithDate(prev.poNumber, value);
      }
      return next;
    });
  };

  const handleSupplierSelect = (supplierId: string) => {
    const found = suppliers.find(s => s.id === supplierId);
    if (found) {
      setFormData(prev => ({
        ...prev,
        supplierId: found.id,
        supplierName: found.name,
        supplierContact: found.phone ? `${found.phone} (${found.contactPerson})` : prev.supplierContact,
        supplierAddress: found.address || prev.supplierAddress,
        supplierPic: found.contactPerson || prev.supplierPic,
      }));
    }
  };

  // Nama barang, satuan, dan harga acuan dari Master Barang dan riwayat belanja (bukan katalog di kode).
  const masterItems = useMemo(() => warehouseDb.getItems().filter(i => i.isActive), []);
  const getItemReference = useMemo(() => buildItemReference(masterItems, warehouseDb.getNonFoodExpenses()), [masterItems]);

  const handleItemChange = (index: number, field: keyof PurchaseOrderItem, value: any) => {
    const updatedItems = [...formData.items];
    const item = { ...updatedItems[index], [field]: value };

    if (field === 'quantity' || field === 'unitPrice') {
      const q = field === 'quantity' ? parseFloat(value) || 0 : item.quantity;
      const p = field === 'unitPrice' ? parseFloat(value) || 0 : item.unitPrice;
      item.subtotal = q * p;
    }

    if (field === 'name') {
      const ref = getItemReference(String(value));
      if (ref) {
        item.category = normalizeToStandardCategory(ref.item?.category, String(value));
        if (ref.unit) item.unit = ref.unit;
        if ((!item.unitPrice || item.unitPrice === 0) && ref.price) {
          item.unitPrice = ref.price;
          item.subtotal = (item.quantity || 1) * ref.price;
        }
      }
    }

    updatedItems[index] = item;
    const totals = recalculateTotals(updatedItems);

    setFormData(prev => ({
      ...prev,
      items: updatedItems,
      ...totals,
    }));
  };

  const handleAddItem = () => {
    const newItem: PurchaseOrderItem = {
      id: `POI-${Date.now()}`,
      name: '',
      category: 'Bahan Basah',
      quantity: 1,
      unit: 'Kg',
      unitPrice: 0,
      subtotal: 0,
    };
    const updatedItems = [...formData.items, newItem];
    const totals = recalculateTotals(updatedItems);
    setFormData(prev => ({
      ...prev,
      items: updatedItems,
      ...totals,
    }));
  };

  const handleRemoveItem = (index: number) => {
    if (formData.items.length <= 1) return;
    const updatedItems = formData.items.filter((_, i) => i !== index);
    const totals = recalculateTotals(updatedItems);
    setFormData(prev => ({
      ...prev,
      items: updatedItems,
      ...totals,
    }));
  };

  // Jumlah dari input masih berupa teks; satuan hitung (Pcs, Botol, ...) dibulatkan minimal 1
  const buildNormalizedNota = (): PurchaseOrderNota => {
    const items = formData.items.map(it => {
      const rawQty = parseFloat(String(it.quantity).replace(',', '.')) || 0;
      const qty = normalizeQtyForUnit(rawQty, it.unit);
      const unitPrice = Number(it.unitPrice) || 0;
      // Subtotal dari belanja asli dipertahankan kecuali jumlahnya ikut dibulatkan
      const subtotal = qty === rawQty && it.subtotal ? it.subtotal : Math.round(qty * unitPrice);
      return { ...it, quantity: qty, unitPrice, subtotal };
    });
    return { ...formData, items, ...recalculateTotals(items), approvedBy: signerName };
  };

  const handleSaveOnly = () => {
    try {
      const updated = buildNormalizedNota();
      setFormData(updated);
      onSaveNota(updated);
      toast.success(`Nota PO ${formData.poNumber} berhasil disimpan.`, 'Nota Disimpan');
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 2500);
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menyimpan Nota PO.', 'Gagal Menyimpan');
    }
  };

  const handlePrint = () => {
    try {
      const updated = buildNormalizedNota();
      setFormData(updated);
      onSaveNota(updated);
      window.print();
    } catch (err: any) {
      toast.error(err?.message || 'Gagal mencetak Nota PO.', 'Gagal Mencetak');
    }
  };

  const displayDeliveryDate = formatDateWithDashes(formData.deliveryDate || formData.date);
  const displaySignDate = formatDateIndonesian(formData.date || new Date().toISOString().slice(0, 10));

  // Render 1 blok nota pesanan (bisa compact untuk mode 2 lembar atau standar untuk 1 lembar)
  const renderNotaCard = (copyTitle?: string, isCompact: boolean = false, isSecondCopy: boolean = false) => {
    return (
      <div
        className={`nota-copy-block bg-white text-black font-sans flex flex-col justify-between ${
          isCompact
            ? 'p-4 sm:p-5 rounded-lg border border-slate-200 shadow-2xs print:border-none print:p-0 print:shadow-none'
            : 'p-6 sm:p-10'
        }`}
      >
        <div>
          {/* Header Penanda Rangkap / Lembar (jika mode 2 rangkap) */}
          {copyTitle && (
            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-200 text-[10px] text-slate-500">
              <span className="font-semibold text-slate-700 tracking-tight">
                {copyTitle}
              </span>
              <span className="font-mono text-[9px] text-slate-400">
                Badan Gizi Nasional • SPPG MLG TUMPANG JERU
              </span>
            </div>
          )}

          {/* ======================================================== */}
          {/* 1. KOP SURAT RESMI BADAN GIZI NASIONAL                   */}
          {/* ======================================================== */}
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
              <h1
                className={`${
                  isCompact ? 'text-xs sm:text-sm' : 'text-base sm:text-lg'
                } font-bold text-black tracking-normal leading-tight`}
              >
                BADAN GIZI NASIONAL
              </h1>
              <p
                className={`${
                  isCompact ? 'text-[9.5px] sm:text-[10px]' : 'text-[11px] sm:text-xs'
                } text-black leading-snug mt-0.5`}
              >
                Jl. Kebon Sirih No.1, RT.01/RW.07, Kb. Sirih, Kec. Menteng,
              </p>
              <p
                className={`${
                  isCompact ? 'text-[9.5px] sm:text-[10px]' : 'text-[11px] sm:text-xs'
                } text-black leading-snug`}
              >
                Kota Jakarta Pusat, Daerah Khusus Ibukota Jakarta 10340
              </p>
            </div>
          </div>

          {/* ======================================================== */}
          {/* 2. JUDUL DOKUMEN & NOMOR PO                              */}
          {/* ======================================================== */}
          <div className={`text-center ${isCompact ? 'my-2' : 'my-3.5'}`}>
            <h2
              className={`${
                isCompact ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm'
              } font-bold text-black uppercase tracking-normal`}
            >
              NOTA PESANAN BAHAN MAKANAN DAN OPERASIONAL
            </h2>
            <div
              className={`${
                isCompact ? 'text-[11px]' : 'text-xs'
              } font-semibold text-black mt-0.5 flex items-center justify-center gap-1`}
            >
              {!formData.poNumber?.trim().toUpperCase().startsWith('NO.') && <span>NO.</span>}
              <input
                type="text"
                value={formData.poNumber}
                onChange={e => handleFieldChange('poNumber', e.target.value)}
                className={`font-bold text-black bg-transparent text-center focus:outline-none font-mono ${
                  isCompact ? 'w-64 text-[11px]' : 'w-72 text-xs'
                }`}
              />
            </div>
          </div>

          {/* ======================================================== */}
          {/* 3. METADATA HEADER (DARI, KEPADA, ALAMAT, PENGIRIMAN)    */}
          {/* ======================================================== */}
          <div
            className={`${
              isCompact ? 'my-2 text-[11px] space-y-0.5' : 'my-3 text-xs space-y-1'
            } text-black font-normal`}
          >
            {/* Dari */}
            <div className="flex items-center">
              <span className={`${isCompact ? 'w-20' : 'w-24'} shrink-0 font-medium`}>Dari</span>
              <span className="w-3 text-center">:</span>
              <input
                type="text"
                value={deliveryFrom}
                onChange={e => setDeliveryFrom(e.target.value)}
                className="font-semibold text-black bg-transparent flex-1 focus:outline-none"
              />
            </div>

            {/* Kepada */}
            <div className="flex items-center">
              <span className={`${isCompact ? 'w-20' : 'w-24'} shrink-0 font-medium`}>Kepada</span>
              <span className="w-3 text-center">:</span>
              {suppliers.length > 0 ? (
                <select
                  value={formData.supplierId || ''}
                  onChange={e => handleSupplierSelect(e.target.value)}
                  className="font-semibold text-black bg-transparent cursor-pointer focus:outline-none flex-1"
                >
                  <option value="">{formData.supplierName || '-- Pilih Mitra Supplier --'}</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.supplyCategory})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={formData.supplierName}
                  onChange={e => handleFieldChange('supplierName', e.target.value)}
                  className="font-semibold text-black bg-transparent flex-1 focus:outline-none"
                />
              )}
            </div>

            {/* Alamat */}
            <div className="flex items-center">
              <span className={`${isCompact ? 'w-20' : 'w-24'} shrink-0 font-medium`}>Alamat</span>
              <span className="w-3 text-center">:</span>
              <input
                type="text"
                value={formData.supplierAddress || 'Kec. Pakis, Kab. Malang'}
                onChange={e => handleFieldChange('supplierAddress', e.target.value)}
                placeholder="Alamat supplier..."
                className="text-black bg-transparent flex-1 focus:outline-none"
              />
            </div>

            {/* Pengiriman */}
            <div className="flex items-center">
              <span className={`${isCompact ? 'w-20' : 'w-24'} shrink-0 font-medium`}>Pengiriman</span>
              <span className="w-3 text-center">:</span>
              <div className="flex items-center gap-1.5 flex-1">
                <span className="font-medium text-black">
                  {displayDeliveryDate || '27-September-2026'}
                </span>
                <input
                  type="text"
                  value={deliveryTimeNote}
                  onChange={e => setDeliveryTimeNote(e.target.value)}
                  className="text-black bg-transparent focus:outline-none flex-1"
                  placeholder="(Jam 12.00-15.00)"
                />
                <input
                  type="date"
                  value={formData.deliveryDate || formData.date}
                  onChange={e => {
                    const val = e.target.value;
                    handleFieldChange('deliveryDate', val);
                    if (!formData.date || formData.date === formData.deliveryDate) {
                      handleFieldChange('date', val);
                    }
                  }}
                  className="no-print text-[10px] text-slate-500 bg-transparent border border-slate-200 rounded px-1.5 py-0.5 cursor-pointer"
                  title="Ubah Tanggal Pengiriman"
                />
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* 4. TABEL RINCIAN BARANG RESMI                            */}
          {/* ======================================================== */}
          <div className={isCompact ? 'my-2' : 'my-3'}>
            <table
              className={`w-full ${
                isCompact ? 'text-[10.5px]' : 'text-xs'
              } border-collapse border border-black table-po-print`}
            >
              <thead>
                <tr className="bg-[#5b9bd5] text-black font-bold border-b border-black table-header-bgn">
                  <th className={`border border-black ${isCompact ? 'py-1 px-1.5 w-8' : 'py-1.5 px-2 w-10'} text-center`}>
                    No
                  </th>
                  <th className={`border border-black ${isCompact ? 'py-1 px-2.5' : 'py-1.5 px-3'} text-center`}>
                    Uraian Jenis Bahan Makanan
                  </th>
                  <th
                    className={`border border-black ${
                      isCompact ? 'py-1 px-2 w-24' : 'py-1.5 px-2.5 w-28'
                    } text-center leading-tight`}
                  >
                    Banyaknya<br />(Angka)
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
                  {!isSecondCopy && (
                    <th className="border border-black py-1 px-1 w-7 text-center no-print"></th>
                  )}
                </tr>
              </thead>
              <tbody>
                {formData.items.map((it, idx) => {
                  const lineTotal = it.subtotal || it.quantity * it.unitPrice;
                  const hasTotal = lineTotal && lineTotal > 0;

                  return (
                    <tr key={it.id || idx} className="hover:bg-slate-50/50">
                      <td
                        className={`border border-black ${
                          isCompact ? 'py-1 px-1.5' : 'py-1.5 px-2'
                        } text-center font-normal`}
                      >
                        {idx + 1}
                      </td>
                      <td
                        className={`border border-black ${
                          isCompact ? 'py-1 px-2.5' : 'py-1.5 px-3'
                        } text-left`}
                      >
                        <input
                          type="text"
                          list="nota-item-catalog"
                          value={it.name}
                          onChange={e => handleItemChange(idx, 'name', e.target.value)}
                          placeholder="Nama bahan makanan..."
                          className="w-full bg-transparent text-black font-normal focus:outline-none"
                        />
                      </td>
                      <td
                        className={`border border-black ${
                          isCompact ? 'py-1 px-1.5' : 'py-1.5 px-2'
                        } text-center font-normal`}
                      >
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={it.quantity || ''}
                          onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                          className="w-full text-center bg-transparent text-black font-normal focus:outline-none"
                        />
                      </td>
                      <td
                        className={`border border-black ${
                          isCompact ? 'py-1 px-1.5' : 'py-1.5 px-2'
                        } text-center font-normal`}
                      >
                        <input
                          type="text"
                          value={it.unit || ''}
                          onChange={e => handleItemChange(idx, 'unit', e.target.value)}
                          className="w-full text-center bg-transparent text-black font-normal focus:outline-none"
                        />
                      </td>
                      <td
                        className={`border border-black ${
                          isCompact ? 'py-1 px-2' : 'py-1.5 px-3'
                        } text-right tabular-nums font-normal`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-black font-normal">Rp</span>
                          <input
                            type="number"
                            min={0}
                            value={it.unitPrice || ''}
                            onChange={e => handleItemChange(idx, 'unitPrice', e.target.value)}
                            placeholder="-"
                            className={`${
                              isCompact ? 'w-18' : 'w-20'
                            } text-right bg-transparent text-black font-normal focus:outline-none`}
                          />
                        </div>
                      </td>
                      <td
                        className={`border border-black ${
                          isCompact ? 'py-1 px-2' : 'py-1.5 px-3'
                        } text-right tabular-nums font-normal`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-black font-normal">Rp</span>
                          <span className="text-black font-normal">
                            {hasTotal ? lineTotal.toLocaleString('id-ID') : '-'}
                          </span>
                        </div>
                      </td>
                      {!isSecondCopy && (
                        <td className="border border-black py-0.5 px-1 text-center no-print">
                          {formData.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="text-slate-400 hover:text-rose-600 p-0.5 transition-colors cursor-pointer"
                              title="Hapus baris"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}

                {/* BARIS TOTAL */}
                <tr className="border-t border-black font-bold">
                  <td
                    colSpan={4}
                    className={`border border-black ${
                      isCompact ? 'py-1 px-2' : 'py-1.5 px-3'
                    } text-center font-bold`}
                  >
                    TOTAL
                  </td>
                  <td
                    className={`border border-black ${
                      isCompact ? 'py-1 px-2' : 'py-1.5 px-3'
                    } text-left font-bold`}
                  >
                    Rp
                  </td>
                  <td
                    className={`border border-black ${
                      isCompact ? 'py-1 px-2' : 'py-1.5 px-3'
                    } text-right font-bold tabular-nums`}
                  >
                    {formData.grandTotal > 0 ? `${formData.grandTotal.toLocaleString('id-ID')} -` : '-'}
                  </td>
                  {!isSecondCopy && <td className="border border-black py-0.5 px-1 no-print"></td>}
                </tr>
              </tbody>
            </table>

            {/* Tombol Tambah Baris (Hanya di Layar, pada salinan pertama) */}
            {!isSecondCopy && (
              <div className="mt-1 no-print flex justify-end">
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-700 hover:text-sky-800 bg-sky-50 hover:bg-sky-100 px-2 py-0.5 rounded border border-sky-200 transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Tambah Baris Bahan Makanan</span>
                </button>
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* 5. BAGIAN BAWAH: CATATAN & TANDA TANGAN                  */}
          {/* ======================================================== */}
          <div
            className={`grid grid-cols-12 gap-3 ${
              isCompact ? 'mt-1 pt-0.5 text-[10px]' : 'mt-2 pt-1 text-xs'
            } text-black`}
          >
            {/* Sisi Kiri: Catatan Resmi */}
            <div
              className={`col-span-7 flex items-start gap-1 leading-snug ${
                isCompact ? 'text-[9.5px]' : 'text-[11px]'
              }`}
            >
              <span className="font-bold shrink-0">Catatan</span>
              <span className="font-bold shrink-0">:</span>
              <div className="space-y-0.5 text-black">
                <div>1. Harga sudah termasuk ongkos kirim (ongkir).</div>
                <div>
                  2. Apabila barang yang diterima tidak sesuai atau rusak, maka pihak supplier akan
                  mengganti barang tersebut sesuai kesepakatan
                </div>
                <div>
                  3. Pengiriman barang dilakukan sesuai jadwal yang telah ditentukan oleh pihak pembeli.
                </div>
              </div>
            </div>

            {/* Sisi Kanan: Pengesahan & Tanda Tangan */}
            <div className="col-span-5 text-center flex flex-col items-center justify-start">
              <div
                className={`${
                  isCompact ? 'text-[10px]' : 'text-[11px]'
                } font-medium text-black flex items-center justify-center gap-1.5`}
              >
                <span>Malang, {displaySignDate}</span>
                <input
                  type="date"
                  value={formData.date || new Date().toISOString().slice(0, 10)}
                  onChange={e => handleFieldChange('date', e.target.value)}
                  className="no-print text-[10px] text-slate-400 hover:text-slate-700 bg-transparent border border-slate-200 hover:border-slate-400 rounded px-1 py-0 cursor-pointer"
                  title="Ubah Tanggal Nota & Sinkronkan Bulan Romawi"
                />
              </div>
              <div className="font-bold text-black mt-0.5 leading-tight">
                <input
                  type="text"
                  value={signerRole1}
                  onChange={e => setSignerRole1(e.target.value)}
                  className="text-center font-bold text-black bg-transparent w-full focus:outline-none"
                />
                <input
                  type="text"
                  value={signerRole2}
                  onChange={e => setSignerRole2(e.target.value)}
                  className="text-center font-bold text-black bg-transparent w-full focus:outline-none"
                />
              </div>

              {/* TTD Rizky (Default Signature Image) */}
              <div className={`my-0.5 ${isCompact ? 'h-11 sm:h-12' : 'h-18 sm:h-20'} flex items-center justify-center`}>
                <img
                  src={ttdRizkyImg}
                  alt="Tanda Tangan Rizky"
                  className={`${isCompact ? 'h-11 sm:h-12' : 'h-18 sm:h-20'} w-auto object-contain`}
                />
              </div>

              {/* Nama Penandatangan Bergaris Bawah */}
              <div className="mt-0.5">
                <input
                  type="text"
                  value={signerName}
                  onChange={e => setSignerName(e.target.value)}
                  className={`text-center font-bold text-black underline underline-offset-2 bg-transparent focus:outline-none ${
                    isCompact ? 'w-44 text-[11px]' : 'w-52 text-xs'
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Print Footer Minimalis */}
        {!isCompact && (
          <div className="pt-4 mt-3 text-[9px] text-slate-400 flex justify-between items-center no-print border-t border-slate-200">
            <span>Dokumen Resmi Nota Pesanan Badan Gizi Nasional (SPPG MLG TUMPANG JERU)</span>
            <span className="font-mono">Waktu Cetak: {new Date().toLocaleDateString('id-ID')}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      {/* Print Specific CSS */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 8mm;
          }
          body * {
            visibility: hidden !important;
          }
          #print-nota-paper, #print-nota-paper * {
            visibility: visible !important;
          }
          #print-nota-paper {
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
          .no-print {
            display: none !important;
          }
          .nota-copy-block {
            page-break-inside: avoid !important;
            border: none !important;
            box-shadow: none !important;
            padding: 2mm 0 !important;
          }
          .cut-line-print {
            margin: 3mm 0 !important;
            padding: 1mm 0 !important;
          }
          input, select, textarea {
            border: none !important;
            background: transparent !important;
            appearance: none !important;
            -webkit-appearance: none !important;
            padding: 0 !important;
            box-shadow: none !important;
            color: #000000 !important;
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

      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-6xl w-full max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header Modal Sederhana & Bersih */}
        <div className="px-5 sm:px-6 py-3.5 border-b border-slate-200 bg-white flex items-center justify-between gap-3 shrink-0 no-print">
          <div className="flex items-center gap-2.5 min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">
              Nota Pesanan Bahan Makanan & Operasional
            </h2>
            <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
              {formData.poNumber}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Konten Modal: Preview Kertas di Kiri, Panel Aksi & CTA di Kanan */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-100/70">
          {/* Sisi Kiri: Pratinjau Kertas Dokumen Nota (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 flex justify-center">
            <div
              id="print-nota-paper"
              className={`w-full max-w-[850px] ${
                printLayout === 'SINGLE'
                  ? 'bg-white text-black p-8 sm:p-12 rounded-xl shadow-md border border-slate-300 min-h-[1050px]'
                  : 'flex flex-col gap-3.5'
              }`}
            >
              {printLayout === 'SINGLE' ? (
                // Mode Standar: 1 Lembar Penuh A4
                renderNotaCard(undefined, false, false)
              ) : (
                // Mode Hemat Kertas: 2 Lembar per Halaman (Atas & Bawah)
                <>
                  {/* Salinan 1: Bagian Atas */}
                  {renderNotaCard('Lembar 1: Arsip SPPG / Pembeli', true, false)}

                  {/* Garis Potong / Perforasi Gunting */}
                  <div className="py-1.5 flex items-center justify-center gap-2 text-[10px] text-slate-500 font-mono select-none cut-line-print">
                    <Scissors className="w-3.5 h-3.5 rotate-90 shrink-0 text-slate-500" />
                    <span className="border-b border-dashed border-slate-400 flex-1" />
                    <span className="px-2.5 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-700 text-[9.5px] font-medium tracking-tight">
                      Potong di sini (Batas Gunting Kertas A5)
                    </span>
                    <span className="border-b border-dashed border-slate-400 flex-1" />
                    <Scissors className="w-3.5 h-3.5 -rotate-90 shrink-0 text-slate-500" />
                  </div>

                  {/* Salinan 2: Bagian Bawah */}
                  {renderNotaCard('Lembar 2: Pihak Rekanan / Supplier', true, true)}
                </>
              )}
            </div>
          </div>

          {/* Sisi Kanan: Panel Kontrol & Aksi Dokumen Sederhana (no-print) */}
          <div className="w-full lg:w-72 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 p-5 flex flex-col justify-between shrink-0 no-print overflow-y-auto">
            <div className="space-y-5">
              {/* Pilihan Format Cetak */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-2">
                  Format Cetak Kertas
                </label>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setPrintLayout('SINGLE')}
                    className={`py-1.5 px-2 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      printLayout === 'SINGLE'
                        ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Cetak 1 lembar A4 penuh standar"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>1 Lembar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintLayout('DOUBLE')}
                    className={`py-1.5 px-2 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      printLayout === 'DOUBLE'
                        ? 'bg-emerald-600 text-white shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Hemat kertas: 1 lembar A4 untuk 2 salinan"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>2 Lembar</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                  {printLayout === 'DOUBLE'
                    ? '1 lembar A4 memuat 2 salinan (SPPG & Rekanan) lengkap dengan batas potong.'
                    : '1 lembar A4 penuh standar format resmi Badan Gizi Nasional.'}
                </p>
              </div>

              <div className="h-px bg-slate-200" />

              {/* Aksi Dokumen */}
              <div className="space-y-2.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Aksi Dokumen
                </label>

                {/* Primary CTA: Cetak Dokumen PO */}
                <button
                  type="button"
                  onClick={handlePrint}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                  title="Cetak dokumen resmi"
                >
                  <Printer className="w-4 h-4 text-emerald-100" />
                  <span>Cetak Dokumen PO</span>
                </button>

                {/* Simpan Perubahan */}
                <button
                  type="button"
                  onClick={handleSaveOnly}
                  className="w-full py-2 px-3.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs"
                  title="Simpan perubahan data nota"
                >
                  <Save className="w-3.5 h-3.5 text-slate-600" />
                  <span>Simpan Perubahan</span>
                </button>

                {/* Toggle Pool Cetak */}
                {onTogglePool && (
                  <button
                    type="button"
                    onClick={() => {
                      const updated = buildNormalizedNota();
                      onSaveNota(updated);
                      onTogglePool(updated.id);
                      if (!isInPool) {
                        toast.success(`Nota ${formData.poNumber} dimasukkan ke pool antrean cetak.`, 'Pool Cetak');
                      } else {
                        toast.info(`Nota ${formData.poNumber} dikeluarkan dari pool cetak.`, 'Pool Cetak');
                      }
                      setSaveToast(true);
                      setTimeout(() => setSaveToast(false), 2000);
                    }}
                    className={`w-full py-2 px-3.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs ${
                      isInPool
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                    title={isInPool ? 'Keluarkan nota ini dari pool antrean cetak' : 'Tampung nota ini ke pool antrean cetak'}
                  >
                    <Layers className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{isInPool ? 'Keluarkan dari Pool' : 'Masuk Pool Cetak'}</span>
                  </button>
                )}

                {/* Shortcut Buka Antrean Pool jika ada */}
                {onOpenBatchPool && poolCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const updated = buildNormalizedNota();
                      onSaveNota(updated);
                      onOpenBatchPool();
                    }}
                    className="w-full py-2 px-3.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    title="Buka antrean pool cetak gabungan"
                  >
                    <Printer className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Buka Pool Cetak ({poolCount})</span>
                  </button>
                )}
              </div>
            </div>

            {/* Aksi Hapus (Destructive di Bawah) */}
            {onDeleteNota && (
              <div className="pt-4 mt-6 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => onDeleteNota(formData)}
                  className="w-full py-2 px-3.5 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 hover:border-rose-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  title="Hapus Nota PO ini dari sistem"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  <span>Hapus Nota PO</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Datalist for autocomplete */}
      <datalist id="nota-item-catalog">
        {masterItems.map(it => (
          <option key={it.id} value={it.name}>
            {it.category} ({it.baseUnit})
          </option>
        ))}
      </datalist>
    </div>
  );
};
