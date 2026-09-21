import React from 'react';
import { ReceivingDocument } from '../types/warehouse';
import { X, Printer, CheckCircle2, Building2, UserCheck, Calendar, Clock } from 'lucide-react';

interface ReceivingDetailModalProps {
  document: ReceivingDocument | null;
  onClose: () => void;
}

export const ReceivingDetailModal: React.FC<ReceivingDetailModalProps> = ({ document, onClose }) => {
  if (!document) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
              GR
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800">{document.id}</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                  <CheckCircle2 className="w-3 h-3" />
                  {document.status}
                </span>
              </div>
              <p className="text-xs text-slate-500">Bukti Fisik Penerimaan Barang SPPG</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              Cetak / Print
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg bg-slate-50 border border-slate-100">
            <div>
              <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" /> Tanggal
              </span>
              <p className="text-xs font-semibold text-slate-800 mt-0.5">{document.date}</p>
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" /> Waktu Tiba
              </span>
              <p className="text-xs font-semibold text-slate-800 mt-0.5">{document.arrivalTime} WIB</p>
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                <Building2 className="w-3 h-3 text-slate-400" /> Supplier
              </span>
              <p className="text-xs font-semibold text-slate-800 mt-0.5 truncate">{document.supplierName}</p>
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                <UserCheck className="w-3 h-3 text-slate-400" /> Penerima (PIC)
              </span>
              <p className="text-xs font-semibold text-slate-800 mt-0.5 truncate">{document.receiverName}</p>
            </div>
          </div>

          {document.deliveryNoteNo && (
            <div className="flex items-center gap-2 text-xs bg-amber-50 text-amber-900 px-3 py-2 rounded-md border border-amber-200">
              <span className="font-semibold">No. Surat Jalan:</span>
              <span>{document.deliveryNoteNo}</span>
            </div>
          )}

          {document.notes && (
            <div>
              <span className="text-xs font-semibold text-slate-600">Catatan Penerimaan:</span>
              <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-200 mt-1">
                {document.notes}
              </p>
            </div>
          )}

          {/* Line Items Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Daftar Barang Diterima ({document.lines.length} Baris)
              </h4>
            </div>
            <div className="overflow-hidden border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">No</th>
                    <th className="py-2.5 px-3">Nama Barang</th>
                    <th className="py-2.5 px-3">Kategori</th>
                    <th className="py-2.5 px-3 text-right">Kuantitas</th>
                    <th className="py-2.5 px-3">Satuan</th>
                    <th className="py-2.5 px-3">Catatan / Batch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {document.lines.map((line, idx) => (
                    <tr key={line.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{line.itemName}</td>
                      <td className="py-2.5 px-3">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                          {line.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                        +{line.quantity}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{line.unit}</td>
                      <td className="py-2.5 px-3 text-slate-500 italic">
                        {line.conditionNote || line.batchNumber || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Signatures Section */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="border border-slate-200 rounded-lg p-3 text-center bg-slate-50/40">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                Tanda Tangan Pengirim / Supplier
              </span>
              <div className="h-20 flex items-center justify-center">
                {document.supplierSignature?.startsWith('data:image') ? (
                  <img
                    src={document.supplierSignature}
                    alt="Tanda Tangan Supplier"
                    className="max-h-16 max-w-full object-contain"
                  />
                ) : (
                  <span className="text-xs font-semibold text-slate-700 bg-white px-3 py-1.5 rounded border border-slate-200 shadow-2xs">
                    {document.supplierSignature || 'Terkonfirmasi'}
                  </span>
                )}
              </div>
              <p className="text-[11px] font-medium text-slate-600 border-t border-slate-200 pt-1 mt-1">
                {document.supplierName}
              </p>
            </div>

            <div className="border border-slate-200 rounded-lg p-3 text-center bg-slate-50/40">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                Tanda Tangan Penerima / SPPG
              </span>
              <div className="h-20 flex items-center justify-center">
                {document.receiverSignature?.startsWith('data:image') ? (
                  <img
                    src={document.receiverSignature}
                    alt="Tanda Tangan Penerima"
                    className="max-h-16 max-w-full object-contain"
                  />
                ) : (
                  <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded border border-emerald-200 shadow-2xs">
                    {document.receiverSignature || 'Terkonfirmasi'}
                  </span>
                )}
              </div>
              <p className="text-[11px] font-medium text-slate-600 border-t border-slate-200 pt-1 mt-1">
                {document.receiverName} ({document.receiverRole})
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
