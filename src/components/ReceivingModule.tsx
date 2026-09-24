import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { warehouseDb } from '../db/storage';
import { ItemMaster, ReceivingDocument, ReceivingLine, Supplier } from '../types/warehouse';
import { Plus, Trash2, CheckCircle, Search, FileText, AlertCircle, Eye, ArrowLeft } from 'lucide-react';
import { SignaturePad } from './SignaturePad';
import { ReceivingDetailModal } from './ReceivingDetailModal';
import { PhotoUploadCompressor } from './PhotoUploadCompressor';
import { SppgLogo } from './SppgLogo';

interface ReceivingModuleProps {
  onRefreshData?: () => void;
}

export const ReceivingModule: React.FC<ReceivingModuleProps> = ({ onRefreshData }) => {
  const { currentUser, can } = useAuth();

  const [receivings, setReceivings] = useState<ReceivingDocument[]>(() => warehouseDb.getReceivings());
  const [items] = useState<ItemMaster[]>(() => warehouseDb.getItems().filter(i => i.isActive && i.itemType !== 'EQUIPMENT'));
  const [suppliers] = useState<Supplier[]>(() => warehouseDb.getSuppliers().filter(s => s.isActive));

  const [isCreating, setIsCreating] = useState(false);
  const [selectedDocForDetail, setSelectedDocForDetail] = useState<ReceivingDocument | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Form State
  const today = new Date().toISOString().slice(0, 10);
  const currentTime = new Date().toTimeString().slice(0, 5);

  const [formSupplierId, setFormSupplierId] = useState('');
  const [formDate, setFormDate] = useState(today);
  const [formTime, setFormTime] = useState(currentTime);
  const [formDeliveryNote, setFormDeliveryNote] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formSupplierSign, setFormSupplierSign] = useState('');
  const [formReceiverSign, setFormReceiverSign] = useState('');
  const [formPhotos, setFormPhotos] = useState<string[]>([]);

  // Multi-item lines
  const [lines, setLines] = useState<Omit<ReceivingLine, 'id'>[]>([
    {
      itemId: items[0]?.id || '',
      itemName: items[0]?.name || '',
      category: items[0]?.category || 'Sembako',
      quantity: 1,
      unit: items[0]?.baseUnit || 'Kg',
      conditionNote: '',
      batchNumber: '',
    },
  ]);

  const refreshList = () => {
    setReceivings(warehouseDb.getReceivings());
    if (onRefreshData) onRefreshData();
  };

  const handleOpenCreate = () => {
    setFormSupplierId(suppliers[0]?.id || '');
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormTime(new Date().toTimeString().slice(0, 5));
    setFormDeliveryNote('');
    setFormNotes('');
    setFormSupplierSign('');
    setFormReceiverSign(`VERIFIED: ${currentUser.name}`);
    setFormPhotos([]);
    setErrorMessage('');
    setSuccessMessage('');

    if (items.length > 0) {
      setLines([
        {
          itemId: items[0].id,
          itemName: items[0].name,
          category: items[0].category,
          quantity: 1,
          unit: items[0].baseUnit,
          conditionNote: 'Kondisi kemasan baik & bersih',
          batchNumber: '',
        },
      ]);
    }
    setIsCreating(true);
  };

  const handleLineItemChange = (index: number, itemId: string) => {
    const selectedItem = items.find(i => i.id === itemId);
    if (!selectedItem) return;

    setLines(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        category: selectedItem.category,
        unit: selectedItem.baseUnit,
      };
      return updated;
    });
  };

  const handleLineQtyChange = (index: number, val: string) => {
    const num = parseFloat(val) || 0;
    setLines(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], quantity: num };
      return updated;
    });
  };

  const handleLineNoteChange = (index: number, val: string) => {
    setLines(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], conditionNote: val };
      return updated;
    });
  };

  const addLine = () => {
    const defaultItem = items[0];
    if (!defaultItem) return;
    setLines(prev => [
      ...prev,
      {
        itemId: defaultItem.id,
        itemName: defaultItem.name,
        category: defaultItem.category,
        quantity: 1,
        unit: defaultItem.baseUnit,
        conditionNote: '',
        batchNumber: '',
      },
    ]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 1) {
      setErrorMessage('Penerimaan harus memiliki minimal 1 baris item.');
      return;
    }
    setLines(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!formSupplierId) {
      setErrorMessage('Pilih supplier terlebih dahulu.');
      return;
    }

    const selectedSupplier = suppliers.find(s => s.id === formSupplierId);
    if (!selectedSupplier) {
      setErrorMessage('Supplier tidak valid.');
      return;
    }

    for (const [idx, line] of lines.entries()) {
      if (line.quantity <= 0) {
        setErrorMessage(`Baris #${idx + 1} (${line.itemName}): Kuantitas harus lebih dari 0.`);
        return;
      }
    }

    try {
      const newDoc = warehouseDb.postReceiving(
        {
          date: formDate,
          arrivalTime: formTime,
          supplierId: selectedSupplier.id,
          supplierName: selectedSupplier.name,
          deliveryNoteNo: formDeliveryNote || undefined,
          receiverId: currentUser.id,
          receiverName: currentUser.name,
          receiverRole: currentUser.role,
          notes: formNotes || undefined,
          lines: lines as any,
          supplierSignature: formSupplierSign || `TERVERIFIKASI: Staf Pengirim ${selectedSupplier.name}`,
          receiverSignature: formReceiverSign || `TERVERIFIKASI: ${currentUser.name} (${currentUser.role})`,
          documentationPhotos: formPhotos.length > 0 ? formPhotos : undefined,
        },
        currentUser
      );

      setSuccessMessage(`Penerimaan barang #${newDoc.id} berhasil diposting ke stok gudang!`);
      refreshList();
      setIsCreating(false);
      setSelectedDocForDetail(newDoc);
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan saat memposting penerimaan.');
    }
  };

  const filteredReceivings = receivings.filter(r => {
    const q = searchQuery.toLowerCase();
    return (
      r.id.toLowerCase().includes(q) ||
      r.supplierName.toLowerCase().includes(q) ||
      r.receiverName.toLowerCase().includes(q) ||
      r.lines.some(l => l.itemName.toLowerCase().includes(q))
    );
  });

  const selectedSupplierObj = suppliers.find(s => s.id === formSupplierId);

  return (
    <div className="space-y-6">
      {/* Detail Modal */}
      <ReceivingDetailModal
        document={selectedDocForDetail}
        onClose={() => setSelectedDocForDetail(null)}
      />

      {/* Notifications */}
      {successMessage && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3.5">
          <SppgLogo size="md" variant="color" />
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Input Barang Datang (Penerimaan dari Supplier)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pencatatan barang yang dikirim oleh supplier ke gudang SPPG Jeru Tumpang. Mendukung multi-item, timbangan, surat jalan, dan dokumentasi foto otomatis WebP.
            </p>
          </div>
        </div>

        {!isCreating && can('RECEIVE_GOODS') && (
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Input Barang Datang Baru
          </button>
        )}
      </div>

      {/* FORM MODE */}
      {isCreating ? (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-md transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Formulir Input Barang Datang dari Supplier</h3>
                <p className="text-[11px] text-slate-500">Pilih supplier yang datang, isi nomor surat jalan, lampirkan item barang & foto bukti fisik.</p>
              </div>
            </div>
            <span className="text-[11px] font-mono bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full font-semibold">
              Status: VERIFIED_POSTED
            </span>
          </div>

          {errorMessage && (
            <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="p-6 space-y-6">
            {/* Header Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              {/* Supplier Searchable Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Supplier / Pemasok <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formSupplierId}
                  onChange={e => setFormSupplierId(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                >
                  <option value="">-- Pilih Supplier --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.contactPerson})
                    </option>
                  ))}
                </select>
                {selectedSupplierObj && (
                  <p className="text-[10px] text-slate-500 mt-1 truncate">{selectedSupplierObj.address}</p>
                )}
              </div>

              {/* Tanggal */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tanggal Masuk <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              {/* Waktu Tiba */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Waktu Kedatangan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="time"
                  value={formTime}
                  onChange={e => setFormTime(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              {/* Penerima (PIC) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Penerima (PIC Gudang)</label>
                <div className="w-full text-xs rounded-lg border border-slate-200 bg-slate-100/80 px-3 py-2 text-slate-700 font-semibold truncate">
                  {currentUser.name} ({currentUser.role})
                </div>
              </div>

              {/* No Surat Jalan */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">No. Surat Jalan / Delivery Note</label>
                <input
                  type="text"
                  placeholder="Contoh: SJ-2026/09/8821"
                  value={formDeliveryNote}
                  onChange={e => setFormDeliveryNote(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Catatan Tambahan */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan Tambahan Penerimaan</label>
                <input
                  type="text"
                  placeholder="Catatan kondisi armada, suhu kendaraan, dsb."
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Multi-Item Lines Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="text-xs font-semibold text-slate-800">
                    Daftar Barang Diterima ({lines.length} Baris)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Satu dokumen penerimaan dapat memuat banyak item sekaligus. Kategori & satuan terisi otomatis.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addLine}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah Baris Item
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/90 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-10">No</th>
                      <th className="py-2.5 px-3 w-64">Nama Barang</th>
                      <th className="py-2.5 px-3 w-32">Kategori</th>
                      <th className="py-2.5 px-3 w-32">Kuantitas</th>
                      <th className="py-2.5 px-3 w-24">Satuan</th>
                      <th className="py-2.5 px-3">Catatan Fisik / Batch</th>
                      <th className="py-2.5 px-3 w-12 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lines.map((line, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          <select
                            value={line.itemId}
                            onChange={e => handleLineItemChange(idx, e.target.value)}
                            className="w-full text-xs rounded border border-slate-300 bg-white px-2 py-1.5 text-slate-800 font-medium focus:ring-1 focus:ring-emerald-500"
                          >
                            {items.map(item => (
                              <option key={item.id} value={item.id}>
                                {item.name} ({item.category})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-block px-2 py-1 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {line.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="number"
                            min="0.1"
                            step="any"
                            value={line.quantity || ''}
                            onChange={e => handleLineQtyChange(idx, e.target.value)}
                            className="w-full text-xs rounded border border-slate-300 px-2 py-1.5 font-mono font-bold text-slate-900 focus:ring-1 focus:ring-emerald-500"
                            required
                          />
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-600">{line.unit}</td>
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            placeholder="Kondisi segar, bebas cacat, batch #..."
                            value={line.conditionNote || ''}
                            onChange={e => handleLineNoteChange(idx, e.target.value)}
                            className="w-full text-xs rounded border border-slate-200 px-2 py-1 text-slate-700 placeholder:text-slate-400"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            disabled={lines.length === 1}
                            className="text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:hover:text-slate-400 p-1 rounded transition-colors"
                            title="Hapus baris"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Photo Documentation Section */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60">
              <PhotoUploadCompressor
                photos={formPhotos}
                onChange={setFormPhotos}
                maxPhotos={6}
                folder="receiving"
                label="Dokumentasi Foto Kedatangan (Auto-Kompres WebP)"
                description="Foto surat jalan, timbangan, atau fisik kemasan barang. Otomatis dikompres ke WebP di HP karyawan sebelum diunggah."
              />
            </div>

            {/* Signature Section */}
            <div>
              <h4 className="text-xs font-semibold text-slate-800 mb-2">
                Verifikasi & Tanda Tangan Digital
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SignaturePad
                  label="Tanda Tangan Staf Pengirim / Supplier"
                  signatoryName={selectedSupplierObj ? `${selectedSupplierObj.contactPerson} (${selectedSupplierObj.name})` : 'Pemasok'}
                  initialValue={formSupplierSign}
                  onSave={val => setFormSupplierSign(val)}
                />
                <SignaturePad
                  label="Tanda Tangan Penerima / PIC Gudang"
                  signatoryName={`${currentUser.name} (${currentUser.role})`}
                  initialValue={formReceiverSign}
                  onSave={val => setFormReceiverSign(val)}
                />
              </div>
            </div>
          </div>

          {/* Footer controls */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-lg transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              Simpan & Posting Penerimaan ke Stok
            </button>
          </div>
        </form>
      ) : (
        /* LIST VIEW */
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Search bar */}
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cari nomor GR, supplier, nama barang, atau penerima..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Total Dokumen: <span className="font-bold text-slate-800">{filteredReceivings.length}</span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">No. Penerimaan</th>
                  <th className="py-3 px-4">Tanggal & Jam</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Ringkasan Barang</th>
                  <th className="py-3 px-4">Penerima (PIC)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReceivings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                      Tidak ada data penerimaan barang yang sesuai filter.
                    </td>
                  </tr>
                ) : (
                  filteredReceivings.map(doc => (
                    <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-emerald-700 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-emerald-600" />
                        {doc.id}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        <div className="font-medium">{doc.date}</div>
                        <div className="text-[10px] text-slate-400">{doc.arrivalTime} WIB</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{doc.supplierName}</div>
                        {doc.deliveryNoteNo && (
                          <div className="text-[10px] text-slate-500 font-mono">SJ: {doc.deliveryNoteNo}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-0.5 max-w-xs">
                          {doc.lines.slice(0, 2).map((l, i) => (
                            <div key={i} className="text-slate-700 truncate">
                              • <span className="font-semibold">{l.itemName}</span>: {l.quantity} {l.unit}
                            </div>
                          ))}
                          {doc.lines.length > 2 && (
                            <span className="text-[10px] font-semibold text-emerald-700">
                              +{doc.lines.length - 2} item lainnya
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        <div className="font-medium">{doc.receiverName}</div>
                        <div className="text-[10px] text-slate-400">{doc.receiverRole}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                          <CheckCircle className="w-3 h-3" />
                          {doc.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedDocForDetail(doc)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Detail / Cetak
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
